-- Scheduled module access for full-payment and EMI enrollments.
-- Amounts remain in paise. All writes are service-role/RPC only.

alter table public.lms_installment_plans
  add column if not exists batch_id text references public.lms_batches(id) on delete set null,
  add column if not exists start_date date,
  add column if not exists grace_days integer not null default 7 check (grace_days between 0 and 90);
alter table public.lms_installment_plans drop constraint if exists lms_installment_plans_status_check;
alter table public.lms_installment_plans add constraint lms_installment_plans_status_check
  check (status in ('active','completed','overdue','cancelled','defaulted'));

create table if not exists public.lms_emi_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.lms_installment_plans(id) on delete cascade,
  installment_number integer not null check (installment_number >= 0),
  amount bigint not null check (amount > 0),
  due_at timestamptz,
  status text not null default 'unpaid' check (status in ('unpaid','created','paid','overdue','cancelled')),
  unlocks_module_id text references public.lms_modules(id) on delete set null,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, installment_number)
);

create table if not exists public.lms_module_access (
  student_id uuid not null references public.lms_profiles(id) on delete cascade,
  course_id text not null references public.lms_courses(id) on delete cascade,
  module_id text not null references public.lms_modules(id) on delete cascade,
  plan_id text references public.lms_installment_plans(id) on delete cascade,
  installment_id uuid references public.lms_emi_installments(id) on delete set null,
  scheduled_for date not null,
  unlocked boolean not null default false,
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(student_id,module_id)
);

alter table public.lms_emi_installments enable row level security;
alter table public.lms_module_access enable row level security;
revoke all on public.lms_emi_installments, public.lms_module_access from anon, authenticated;
grant select on public.lms_emi_installments, public.lms_module_access to authenticated;
grant all on public.lms_emi_installments, public.lms_module_access to service_role;

create policy lms_emi_installments_select on public.lms_emi_installments
for select to authenticated using (
  exists(select 1 from public.lms_installment_plans p where p.id=plan_id and (p.student_id=auth.uid() or public.lms_admin()))
);
create policy lms_module_access_select on public.lms_module_access
for select to authenticated using (student_id=auth.uid() or public.lms_owns_course(course_id));

create index if not exists lms_emi_installments_plan_status on public.lms_emi_installments(plan_id,status,installment_number);
create index if not exists lms_module_access_student_course on public.lms_module_access(student_id,course_id,unlocked);

create or replace function public.lms_weekday_number(day_name text) returns integer
language sql immutable strict set search_path='' as $$
  select case lower(left(trim(day_name),3))
    when 'sun' then 0 when 'mon' then 1 when 'tue' then 2 when 'wed' then 3
    when 'thu' then 4 when 'fri' then 5 when 'sat' then 6 else null end
$$;

create or replace function public.nth_session_date(start_on date, weekdays text[], occurrence integer)
returns date language plpgsql immutable set search_path='' as $$
declare candidate date:=start_on; found integer:=0;
begin
  if occurrence < 1 or coalesce(array_length(weekdays,1),0)=0 then return null; end if;
  while candidate <= start_on + 730 loop
    if extract(dow from candidate)::integer = any(
      select public.lms_weekday_number(value) from unnest(weekdays) value
    ) then
      found:=found+1;
      if found=occurrence then return candidate; end if;
    end if;
    candidate:=candidate+1;
  end loop;
  return null;
end $$;

create or replace function public.lms_prepare_emi_plan(p_plan_id text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.lms_installment_plans; i integer; base bigint; extra bigint;
begin
  select * into p from public.lms_installment_plans where id=p_plan_id for update;
  if not found then raise exception 'Installment plan not found'; end if;
  if p.registration_amount > 0 then
    insert into public.lms_emi_installments(plan_id,installment_number,amount,due_at,status)
    values(p.id,0,p.registration_amount,now(),'unpaid') on conflict(plan_id,installment_number) do nothing;
  end if;
  base:=p.remaining_amount/greatest(p.installment_count,1);
  extra:=p.remaining_amount%greatest(p.installment_count,1);
  for i in 1..p.installment_count loop
    insert into public.lms_emi_installments(plan_id,installment_number,amount,due_at,status)
    values(p.id,i,base+case when i<=extra then 1 else 0 end,
      case when p.start_date is null then null else (p.start_date+(i||' months')::interval)::timestamptz end,'unpaid')
    on conflict(plan_id,installment_number) do nothing;
  end loop;
end $$;

create or replace function public.recompute_module_access(p_student uuid, p_course text, p_plan_id text default null)
returns void language plpgsql security definer set search_path='' as $$
declare p public.lms_installment_plans; b public.lms_batches; start_on date; days text[]; module_count integer; r record; installment public.lms_emi_installments;
begin
  if p_plan_id is not null then select * into p from public.lms_installment_plans where id=p_plan_id; end if;
  select * into b from public.lms_batches
    where course_id=p_course and status='active' and (student_ids ? p_student::text or (p.batch_id is not null and id=p.batch_id))
    order by case when p.batch_id=id then 0 else 1 end,created_at limit 1;
  if not found then select * into b from public.lms_batches where course_id=p_course and status='active' order by created_at limit 1; end if;
  days:=array(select jsonb_array_elements_text(coalesce(b.schedule->'days','[]'::jsonb)));
  if coalesce(array_length(days,1),0)=0 then raise exception 'Active batch schedule is missing for course %',p_course; end if;
  start_on:=coalesce(p.start_date,current_date);
  select count(*) into module_count from public.lms_modules where course_id=p_course;
  for r in select id,row_number() over(order by sort_order,id)::integer as n from public.lms_modules where course_id=p_course loop
    installment:=null;
    if p_plan_id is not null then
      select * into installment from public.lms_emi_installments
      where plan_id=p_plan_id and installment_number=
        case when not p.registration_paid then 0 else greatest(1,ceil(r.n::numeric*p.installment_count/greatest(module_count,1))::integer) end;
    end if;
    insert into public.lms_module_access(student_id,course_id,module_id,plan_id,installment_id,scheduled_for,unlocked,unlocked_at,updated_at)
    values(p_student,p_course,r.id,p_plan_id,installment.id,public.nth_session_date(start_on,days,r.n),
      current_date>=public.nth_session_date(start_on,days,r.n) and (p_plan_id is null or installment.status='paid'),
      case when current_date>=public.nth_session_date(start_on,days,r.n) and (p_plan_id is null or installment.status='paid') then now() end,now())
    on conflict(student_id,module_id) do update set plan_id=excluded.plan_id,installment_id=excluded.installment_id,
      scheduled_for=excluded.scheduled_for,unlocked=excluded.unlocked,
      unlocked_at=case when excluded.unlocked then coalesce(public.lms_module_access.unlocked_at,now()) else null end,updated_at=now();
  end loop;
end $$;

revoke all on function public.lms_prepare_emi_plan(text) from public,anon,authenticated;
revoke all on function public.recompute_module_access(uuid,text,text) from public,anon,authenticated;
grant execute on function public.lms_prepare_emi_plan(text), public.recompute_module_access(uuid,text,text) to service_role;

create or replace function public.lms_confirm_emi_installment(order_ref text, payment_ref text)
returns void language plpgsql security definer set search_path='' as $$
declare inst public.lms_emi_installments; plan public.lms_installment_plans; paid_count integer;
begin
  select * into inst from public.lms_emi_installments where razorpay_order_id=order_ref for update;
  if not found then raise exception 'Installment order not found'; end if;
  if inst.razorpay_payment_id is not null and inst.razorpay_payment_id<>payment_ref then raise exception 'Installment already paid by another payment'; end if;
  select * into plan from public.lms_installment_plans where id=inst.plan_id for update;
  if inst.status<>'paid' then
    update public.lms_emi_installments set status='paid',razorpay_payment_id=payment_ref,paid_at=now(),updated_at=now() where id=inst.id;
  end if;
  select count(*) into paid_count from public.lms_emi_installments where plan_id=plan.id and installment_number>0 and status='paid';
  update public.lms_installment_plans set
    registration_paid=registration_paid or inst.installment_number=0,
    start_date=case when inst.installment_number=0 then coalesce(start_date,current_date) else start_date end,
    paid_installments=paid_count,
    status=case when paid_count>=installment_count and (registration_amount=0 or registration_paid or inst.installment_number=0) then 'completed' else 'active' end,
    next_due_at=(select due_at from public.lms_emi_installments where plan_id=plan.id and status<>'paid' order by installment_number limit 1),
    updated_at=now() where id=plan.id returning * into plan;
  if inst.installment_number=0 then
    update public.lms_emi_installments set due_at=(plan.start_date+(installment_number||' months')::interval)::timestamptz,updated_at=now()
      where plan_id=plan.id and installment_number>0 and due_at is null;
  end if;
  perform public.recompute_module_access(plan.student_id,plan.course_id,plan.id);
end $$;
revoke all on function public.lms_confirm_emi_installment(text,text) from public,anon,authenticated;
grant execute on function public.lms_confirm_emi_installment(text,text) to service_role;

drop policy if exists lms_select on public.lms_lessons;
create policy lms_select on public.lms_lessons for select to anon,authenticated using (
  public.lms_owns_course(course_id) or
  (published and is_preview and exists(select 1 from public.lms_courses c where c.id=course_id and c.status='published')) or
  (published and exists(select 1 from public.lms_module_access a where a.student_id=auth.uid() and a.module_id=public.lms_lessons.module_id and a.unlocked)) or
  -- Preserve access for pre-migration/free/offline enrollments until an
  -- access schedule is initialized for them. Clients cannot create enrollment.
  (published and public.lms_enrolled(course_id) and not exists(
    select 1 from public.lms_module_access a where a.student_id=auth.uid() and a.course_id=public.lms_lessons.course_id
  ))
);

-- Webhook-only confirmation. The caller is restricted to service_role below.
create or replace function public.lms_confirm_payment(order_ref text, payment_ref text)
returns public.lms_enrollments language plpgsql security definer set search_path='' as $$
declare pay public.lms_payments; enrolled public.lms_enrollments; plan public.lms_installment_plans; inst public.lms_emi_installments; already_paid boolean;
begin
  select * into pay from public.lms_payments where order_id=order_ref for update;
  if not found then raise exception 'Payment order not found'; end if;
  if pay.status='paid' and pay.payment_id is distinct from payment_ref then raise exception 'Order already paid with another payment'; end if;
  already_paid:=pay.status='paid';
  update public.lms_payments set status='paid',payment_id=payment_ref,updated_at=now() where id=pay.id;

  if pay.payment_mode='emi' then
    select * into plan from public.lms_installment_plans where id=pay.plan_id for update;
    if not found then raise exception 'Installment plan not found'; end if;
    perform public.lms_prepare_emi_plan(plan.id);
    select * into inst from public.lms_emi_installments
      where plan_id=plan.id and installment_number=coalesce(pay.installment_number,0) for update;
    if inst.razorpay_payment_id is not null and inst.razorpay_payment_id<>payment_ref then raise exception 'Installment already paid'; end if;
    if not already_paid then
      update public.lms_emi_installments set status='paid',razorpay_order_id=order_ref,
        razorpay_payment_id=payment_ref,paid_at=now(),updated_at=now() where id=inst.id;
      if coalesce(pay.installment_number,0)=0 then
        update public.lms_installment_plans set registration_paid=true,start_date=coalesce(start_date,current_date),
          status=case when remaining_amount=0 then 'completed' else 'active' end,
          next_due_at=case when remaining_amount=0 then null else now()+interval '1 month' end,updated_at=now()
          where id=plan.id returning * into plan;
        update public.lms_emi_installments set due_at=(plan.start_date+(installment_number||' months')::interval)::timestamptz,updated_at=now()
          where plan_id=plan.id and installment_number>0 and due_at is null;
      else
        update public.lms_installment_plans set paid_installments=least(installment_count,paid_installments+1),
          status=case when paid_installments+1>=installment_count then 'completed' else 'active' end,
          next_due_at=case when paid_installments+1>=installment_count then null else now()+interval '1 month' end,updated_at=now()
          where id=plan.id returning * into plan;
      end if;
    end if;
  end if;

  insert into public.lms_enrollments(id,student_id,course_id,status,payment_status,payment_id,metadata)
  select pay.student_id::text||'_'||pay.course_id,pay.student_id,pay.course_id,'active',case when pay.payment_mode='emi' then 'emi' else 'paid' end,
    payment_ref,jsonb_build_object('courseName',c.title,'paymentMode',pay.payment_mode,'planId',pay.plan_id,'startDate',current_date)
  from public.lms_courses c where c.id=pay.course_id
  on conflict(student_id,course_id) do update set status='active',payment_status=excluded.payment_status,
    payment_id=case when public.lms_enrollments.payment_id='' then excluded.payment_id else public.lms_enrollments.payment_id end,
    metadata=public.lms_enrollments.metadata||excluded.metadata;

  perform public.recompute_module_access(pay.student_id,pay.course_id,case when pay.payment_mode='emi' then pay.plan_id else null end);
  select * into enrolled from public.lms_enrollments where student_id=pay.student_id and course_id=pay.course_id;
  return enrolled;
end $$;
revoke all on function public.lms_confirm_payment(text,text) from public,anon,authenticated;
grant execute on function public.lms_confirm_payment(text,text) to service_role;
