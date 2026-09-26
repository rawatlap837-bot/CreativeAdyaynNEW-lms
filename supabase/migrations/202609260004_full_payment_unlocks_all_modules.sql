-- A one-time payment buys the complete course. Module scheduling is only an
-- EMI concern, so fully paid students must never inherit date-gated rows.
create or replace function public.recompute_module_access(
  p_student uuid,
  p_course text,
  p_plan_id text default null
)
returns void language plpgsql security definer set search_path='' as $$
declare
  p public.lms_installment_plans;
  b public.lms_batches;
  start_on date;
  days text[];
  module_count integer;
  r record;
  installment public.lms_emi_installments;
  target_installment_number integer;
begin
  -- No plan means a one-time/full payment. Unlock the whole course now,
  -- irrespective of batch dates, and overwrite any old EMI access rows.
  if p_plan_id is null then
    insert into public.lms_module_access(
      student_id,course_id,module_id,plan_id,installment_id,scheduled_for,
      unlocked,unlocked_at,updated_at
    )
    select p_student,p_course,m.id,null,null,current_date,true,now(),now()
    from public.lms_modules m
    where m.course_id=p_course
    on conflict(student_id,module_id) do update set
      plan_id=null,
      installment_id=null,
      scheduled_for=current_date,
      unlocked=true,
      unlocked_at=coalesce(public.lms_module_access.unlocked_at,now()),
      updated_at=now();
    return;
  end if;

  select * into p from public.lms_installment_plans where id=p_plan_id;
  if not found then raise exception 'Installment plan not found'; end if;

  select * into b from public.lms_batches
    where course_id=p_course
      and status='active'
      and (student_ids ? p_student::text or (p.batch_id is not null and id=p.batch_id))
    order by case when p.batch_id=id then 0 else 1 end,created_at
    limit 1;
  if not found then
    select * into b from public.lms_batches
      where course_id=p_course and status='active'
      order by created_at limit 1;
  end if;

  days:=array(select jsonb_array_elements_text(coalesce(b.schedule->'days','[]'::jsonb)));
  select count(*) into module_count from public.lms_modules where course_id=p_course;

  if coalesce(array_length(days,1),0)=0 then
    for r in
      select id,row_number() over(order by sort_order,id)::integer as n
      from public.lms_modules where course_id=p_course
    loop
      target_installment_number:=case
        when r.n=1 then 0
        else greatest(1,ceil((r.n-1)::numeric*p.installment_count/greatest(module_count-1,1))::integer)
      end;
      select * into installment from public.lms_emi_installments
        where plan_id=p_plan_id and installment_number=target_installment_number;

      insert into public.lms_module_access(
        student_id,course_id,module_id,plan_id,installment_id,scheduled_for,
        unlocked,unlocked_at,updated_at
      ) values(
        p_student,p_course,r.id,p_plan_id,installment.id,current_date,
        installment.status='paid',
        case when installment.status='paid' then now() end,
        now()
      )
      on conflict(student_id,module_id) do update set
        plan_id=excluded.plan_id,
        installment_id=excluded.installment_id,
        scheduled_for=excluded.scheduled_for,
        unlocked=excluded.unlocked,
        unlocked_at=case when excluded.unlocked then coalesce(public.lms_module_access.unlocked_at,now()) else null end,
        updated_at=now();
    end loop;
    return;
  end if;

  start_on:=coalesce(p.start_date,current_date);
  for r in
    select id,row_number() over(order by sort_order,id)::integer as n
    from public.lms_modules where course_id=p_course
  loop
    select * into installment from public.lms_emi_installments
      where plan_id=p_plan_id and installment_number=case
        when not p.registration_paid then 0
        else greatest(1,ceil(r.n::numeric*p.installment_count/greatest(module_count,1))::integer)
      end;

    insert into public.lms_module_access(
      student_id,course_id,module_id,plan_id,installment_id,scheduled_for,
      unlocked,unlocked_at,updated_at
    ) values(
      p_student,p_course,r.id,p_plan_id,installment.id,
      public.nth_session_date(start_on,days,r.n),
      current_date>=public.nth_session_date(start_on,days,r.n) and installment.status='paid',
      case when current_date>=public.nth_session_date(start_on,days,r.n) and installment.status='paid' then now() end,
      now()
    )
    on conflict(student_id,module_id) do update set
      plan_id=excluded.plan_id,
      installment_id=excluded.installment_id,
      scheduled_for=excluded.scheduled_for,
      unlocked=excluded.unlocked,
      unlocked_at=case when excluded.unlocked then coalesce(public.lms_module_access.unlocked_at,now()) else null end,
      updated_at=now();
  end loop;
end $$;

revoke all on function public.recompute_module_access(uuid,text,text) from public,anon,authenticated;
grant execute on function public.recompute_module_access(uuid,text,text) to service_role;

-- Repair students who completed a one-time purchase before this fix.
insert into public.lms_module_access(
  student_id,course_id,module_id,plan_id,installment_id,scheduled_for,
  unlocked,unlocked_at,updated_at
)
select e.student_id,e.course_id,m.id,null,null,current_date,true,now(),now()
from public.lms_enrollments e
join public.lms_modules m on m.course_id=e.course_id
where e.status='active' and e.payment_status='paid'
on conflict(student_id,module_id) do update set
  plan_id=null,
  installment_id=null,
  scheduled_for=current_date,
  unlocked=true,
  unlocked_at=coalesce(public.lms_module_access.unlocked_at,now()),
  updated_at=now();
