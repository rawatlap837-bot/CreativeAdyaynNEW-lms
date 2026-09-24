-- Interest-free course instalments. Amounts are stored in paise.
create table if not exists public.lms_installment_plans (
  id text primary key default gen_random_uuid()::text,
  student_id uuid not null references public.lms_profiles(id) on delete cascade,
  course_id text not null references public.lms_courses(id) on delete cascade,
  total_amount bigint not null check (total_amount > 0),
  -- The schedule is derived from the course duration by the payment function.
  -- Keep this range aligned with 202609230006_duration_based_emi.sql so a
  -- fresh install can create plans for any supported duration immediately.
  installment_count integer not null check (installment_count >= 1 and installment_count <= 120),
  installment_amount bigint not null check (installment_amount > 0),
  registration_amount bigint not null default 0 check (registration_amount >= 0),
  remaining_amount bigint not null default 0 check (remaining_amount >= 0),
  registration_paid boolean not null default false,
  paid_installments integer not null default 0 check (paid_installments >= 0),
  next_due_at timestamptz,
  status text not null default 'active' check (status in ('active','completed','overdue','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(student_id, course_id)
);
alter table public.lms_installment_plans enable row level security;
grant select on public.lms_installment_plans to authenticated;
grant all on public.lms_installment_plans to service_role;
drop policy if exists lms_installment_plan_select on public.lms_installment_plans;
create policy lms_installment_plan_select on public.lms_installment_plans for select to authenticated using (student_id=auth.uid() or public.lms_admin());

alter table public.lms_payments add column if not exists payment_mode text not null default 'one_time' check (payment_mode in ('one_time','emi'));
alter table public.lms_payments add column if not exists plan_id text references public.lms_installment_plans(id) on delete set null;
alter table public.lms_payments add column if not exists installment_number integer;
alter table public.lms_payments add column if not exists installment_count integer;
alter table public.lms_payments add column if not exists due_at timestamptz;
create index if not exists lms_payment_plan on public.lms_payments(plan_id,installment_number);

-- Only the service-role Edge Function can confirm captured Razorpay payments.
create or replace function public.lms_confirm_payment(order_ref text, payment_ref text) returns public.lms_enrollments language plpgsql security definer set search_path='' as $$
declare p public.lms_payments; e public.lms_enrollments; plan public.lms_installment_plans; already_paid boolean;
begin
 select * into p from public.lms_payments where order_id=order_ref for update;
 if not found then raise exception 'Payment order not found'; end if;
 if p.status='paid' and p.payment_id is distinct from payment_ref then raise exception 'Order already paid with another payment'; end if;
 already_paid:=p.status='paid';
 update public.lms_payments set status='paid',payment_id=payment_ref,updated_at=now() where id=p.id;
 if p.payment_mode='emi' then
   select * into plan from public.lms_installment_plans where id=p.plan_id for update;
   if not found then raise exception 'Installment plan not found'; end if;
   if not already_paid then
     update public.lms_installment_plans set paid_installments=least(installment_count,paid_installments+1), status=case when paid_installments+1>=installment_count then 'completed' else 'active' end, next_due_at=case when paid_installments+1>=installment_count then null else now()+interval '1 month' end, updated_at=now() where id=plan.id returning * into plan;
   end if;
 end if;
 insert into public.lms_enrollments(id,student_id,course_id,status,payment_status,payment_id,metadata)
 select p.student_id::text||'_'||p.course_id,p.student_id,p.course_id,'active',case when p.payment_mode='emi' then 'emi' else 'paid' end,payment_ref,jsonb_build_object('courseName',c.title,'paymentMode',p.payment_mode,'planId',p.plan_id) from public.lms_courses c where c.id=p.course_id
 on conflict(student_id,course_id) do update set status='active',payment_status=excluded.payment_status,payment_id=case when public.lms_enrollments.payment_id='' then excluded.payment_id else public.lms_enrollments.payment_id end,metadata=public.lms_enrollments.metadata||excluded.metadata;
 select * into e from public.lms_enrollments where student_id=p.student_id and course_id=p.course_id;
 return e;
end $$;
revoke all on function public.lms_confirm_payment(text,text) from public,anon,authenticated;
grant execute on function public.lms_confirm_payment(text,text) to service_role;

-- A late EMI cannot access paid course content, even when an old browser tab
-- still has a cached active-enrolment record.
create or replace function public.lms_enrolled(cid text) returns boolean language sql stable security definer set search_path='' as $$
 select public.lms_role() is not null and exists(
   select 1 from public.lms_enrollments e
   where e.course_id=cid and e.student_id=auth.uid() and e.status='active'
     and not exists(
       select 1 from public.lms_installment_plans p
       where p.student_id=e.student_id and p.course_id=e.course_id
         and p.status in ('active','overdue') and p.next_due_at is not null and p.next_due_at<=now()
     )
 )
$$;
revoke all on function public.lms_enrolled(text) from public,anon,authenticated;
grant execute on function public.lms_enrolled(text) to anon,authenticated,service_role;
