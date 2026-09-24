-- ₹2,000 registration EMI and course-duration monthly schedule.
-- Monetary values are stored in paise.
alter table public.lms_installment_plans
  add column if not exists registration_amount bigint not null default 0 check (registration_amount >= 0),
  add column if not exists remaining_amount bigint not null default 0 check (remaining_amount >= 0),
  add column if not exists registration_paid boolean not null default false;

alter table public.lms_installment_plans drop constraint if exists lms_installment_plans_installment_count_check;
alter table public.lms_installment_plans add constraint lms_installment_plans_installment_count_check check (installment_count >= 1 and installment_count <= 120);

-- Preserve existing paid plans. New plans are created by the payment function
-- with a ₹2,000 registration amount and the remaining balance.
update public.lms_installment_plans
set registration_paid = true,
    remaining_amount = total_amount,
    registration_amount = 0
where paid_installments > 0;

update public.lms_installment_plans
set registration_paid = false,
    registration_amount = least(200000, total_amount),
    remaining_amount = greatest(0, total_amount - least(200000, total_amount))
where paid_installments = 0;

create or replace function public.lms_confirm_payment(order_ref text, payment_ref text)
returns public.lms_enrollments
language plpgsql security definer set search_path='' as $$
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
      if not plan.registration_paid then
        update public.lms_installment_plans
        set registration_paid=true,
            status=case when remaining_amount=0 then 'completed' else 'active' end,
            next_due_at=case when remaining_amount=0 then null else now()+interval '1 month' end,
            updated_at=now()
        where id=plan.id returning * into plan;
      else
        update public.lms_installment_plans
        set paid_installments=least(installment_count,paid_installments+1),
            status=case when paid_installments+1>=installment_count then 'completed' else 'active' end,
            next_due_at=case when paid_installments+1>=installment_count then null else now()+interval '1 month' end,
            updated_at=now()
        where id=plan.id returning * into plan;
      end if;
    end if;
  end if;

  insert into public.lms_enrollments(id,student_id,course_id,status,payment_status,payment_id,metadata)
  select p.student_id::text||'_'||p.course_id,p.student_id,p.course_id,'active',case when p.payment_mode='emi' then 'emi' else 'paid' end,payment_ref,jsonb_build_object('courseName',c.title,'paymentMode',p.payment_mode,'planId',p.plan_id)
  from public.lms_courses c where c.id=p.course_id
  on conflict(student_id,course_id) do update set status='active',payment_status=excluded.payment_status,payment_id=case when public.lms_enrollments.payment_id='' then excluded.payment_id else public.lms_enrollments.payment_id end,metadata=public.lms_enrollments.metadata||excluded.metadata;
  select * into e from public.lms_enrollments where student_id=p.student_id and course_id=p.course_id;
  return e;
end $$;
revoke all on function public.lms_confirm_payment(text,text) from public,anon,authenticated;
grant execute on function public.lms_confirm_payment(text,text) to service_role;

-- Course access remains available after the registration fee, but is blocked as
-- soon as a subsequent monthly EMI becomes overdue.
create or replace function public.lms_enrolled(cid text) returns boolean language sql stable security definer set search_path='' as $$
  select public.lms_role() is not null and exists(
    select 1 from public.lms_enrollments e
    where e.course_id=cid and e.student_id=auth.uid() and e.status='active'
      and not exists(
        select 1 from public.lms_installment_plans p
        where p.student_id=e.student_id and p.course_id=e.course_id and p.registration_paid
          and p.status in ('active','overdue') and p.next_due_at is not null and p.next_due_at<=now()
      )
  )
$$;
revoke all on function public.lms_enrolled(text) from public,anon,authenticated;
grant execute on function public.lms_enrolled(text) to anon,authenticated,service_role;
