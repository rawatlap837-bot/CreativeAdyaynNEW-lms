-- Admin-only reporting RPCs. Existing table RLS policies remain unchanged.
begin;

-- These additive policies make the admin reporting role explicit without
-- removing or changing existing student/teacher policies.
drop policy if exists lms_export_admin_profiles on public.lms_profiles;
create policy lms_export_admin_profiles on public.lms_profiles for select to authenticated using (public.lms_admin());
drop policy if exists lms_export_admin_courses on public.lms_courses;
create policy lms_export_admin_courses on public.lms_courses for select to authenticated using (public.lms_admin());
drop policy if exists lms_export_admin_enrollments on public.lms_enrollments;
create policy lms_export_admin_enrollments on public.lms_enrollments for select to authenticated using (public.lms_admin());
drop policy if exists lms_export_admin_payments on public.lms_payments;
create policy lms_export_admin_payments on public.lms_payments for select to authenticated using (public.lms_admin());
drop policy if exists lms_export_admin_attendance on public.lms_attendance_records;
create policy lms_export_admin_attendance on public.lms_attendance_records for select to authenticated using (public.lms_admin());
drop policy if exists lms_export_admin_notifications on public.lms_notifications;
create policy lms_export_admin_notifications on public.lms_notifications for select to authenticated using (public.lms_admin());

-- Remove the first deployed signature so PostgREST cannot choose an old overload.
drop function if exists public.lms_admin_export_rows(text,text,uuid,text,text);

create or replace function public.lms_admin_export_rows(
  p_category text,
  p_course_id text default null,
  p_teacher_id uuid default null,
  p_payment_status text default null,
  p_student_status text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(created_at timestamptz, payload jsonb)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.lms_admin() then raise exception 'Admin access required' using errcode='42501'; end if;

  if p_category in ('students','teachers') then
    return query
      select p.created_at, jsonb_build_object('id',p.id,'name',p.name,'email',p.email,'join_date',p.created_at,'status',p.status,'role',p.role)
      from public.lms_profiles p
      where p.role=case when p_category='students' then 'student' else 'teacher' end
        and (p_from is null or p.created_at>=p_from) and (p_to is null or p.created_at<=p_to)
        and (p_student_status is null or (p_student_status='__non_active__' and p.status<>'active') or (p_student_status<>'__non_active__' and p.status=p_student_status))
        and (p_category<>'students' or p_course_id is null or exists(
          select 1 from public.lms_enrollments e join public.lms_courses c on c.id=e.course_id
          where e.student_id=p.id and c.id=p_course_id and (p_teacher_id is null or c.instructor_id=p_teacher_id)
        ))
      order by p.created_at desc;
  elsif p_category='courses' then
    return query
      select c.created_at, jsonb_build_object('id',c.id,'title',c.title,'price',c.price,'currency',c.currency,'instructor',coalesce(nullif(p.name,''),c.instructor_name,p.email),'instructor_email',p.email,'enrolled_count',(select count(*) from public.lms_enrollments e where e.course_id=c.id and e.status='active'),'status',c.status)
      from public.lms_courses c join public.lms_profiles p on p.id=c.instructor_id
      where (p_from is null or c.created_at>=p_from) and (p_to is null or c.created_at<=p_to)
        and (p_course_id is null or c.id=p_course_id) and (p_teacher_id is null or c.instructor_id=p_teacher_id)
      order by c.created_at desc;
  elsif p_category='enrollments_payments' then
    return query
      select q.created_at,q.payload from (
        select pay.created_at, jsonb_build_object('record_type','payment','student',coalesce(nullif(sp.name,''),sp.email),'student_email',sp.email,'course',c.title,'teacher',coalesce(nullif(tp.name,''),c.instructor_name,tp.email),'amount',case when pay.metadata->>'paymentMethod'='offline' then pay.amount::numeric else pay.amount::numeric/100 end,'currency',pay.currency,'payment_status',pay.status,'enrollment_status',e.status,'payment_mode',coalesce(pay.metadata->>'paymentMode', pay.metadata->>'paymentMethod'),'payment_id',pay.payment_id,'order_id',pay.order_id,'date',pay.created_at) payload
        from public.lms_payments pay
        join public.lms_profiles sp on sp.id=pay.student_id
        join public.lms_courses c on c.id=pay.course_id
        join public.lms_profiles tp on tp.id=c.instructor_id
        left join public.lms_enrollments e on e.student_id=pay.student_id and e.course_id=pay.course_id
        where (p_course_id is null or c.id=p_course_id)
          and (p_from is null or pay.created_at>=p_from) and (p_to is null or pay.created_at<=p_to)
          and (p_teacher_id is null or c.instructor_id=p_teacher_id)
          and (p_student_status is null or (p_student_status='__non_active__' and sp.status<>'active') or (p_student_status<>'__non_active__' and sp.status=p_student_status))
          and (p_payment_status is null or
            (p_payment_status='paid' and pay.status in ('paid','captured')) or
            (p_payment_status='pending' and (pay.status in ('created','authorized','pending') or e.status in ('pending','payment_due'))) or
            (p_payment_status='free' and false))
        union all
        select e.created_at, jsonb_build_object('record_type','enrollment','student',coalesce(nullif(sp.name,''),sp.email),'student_email',sp.email,'course',c.title,'teacher',coalesce(nullif(tp.name,''),c.instructor_name,tp.email),'amount',0,'currency',c.currency,'payment_status',e.payment_status,'enrollment_status',e.status,'payment_mode',null,'payment_id',null,'order_id',null,'date',e.created_at) payload
        from public.lms_enrollments e
        join public.lms_profiles sp on sp.id=e.student_id
        join public.lms_courses c on c.id=e.course_id
        join public.lms_profiles tp on tp.id=c.instructor_id
        where not exists(select 1 from public.lms_payments pay where pay.student_id=e.student_id and pay.course_id=e.course_id)
          and (p_from is null or e.created_at>=p_from) and (p_to is null or e.created_at<=p_to)
          and (p_course_id is null or c.id=p_course_id)
          and (p_teacher_id is null or c.instructor_id=p_teacher_id)
          and (p_student_status is null or (p_student_status='__non_active__' and sp.status<>'active') or (p_student_status<>'__non_active__' and sp.status=p_student_status))
          and (p_payment_status is null or (p_payment_status='free' and e.payment_status='free') or (p_payment_status='paid' and e.payment_status in ('paid','offline_paid','emi')) or (p_payment_status='pending' and e.status in ('pending','payment_due')))
      ) q order by q.created_at desc;
  elsif p_category='attendance' then
    return query
      select a.created_at,jsonb_build_object('student',coalesce(nullif(sp.name,''),sp.email),'student_email',sp.email,'course',c.title,'teacher',coalesce(nullif(tp.name,''),tp.email),'attendance_status',a.status,'attendance_date',coalesce(a.date::text,a.marked_at::date::text,a.created_at::date::text),'marked_at',a.marked_at) 
      from public.lms_attendance_records a
      join public.lms_profiles sp on sp.id=a.student_id
      join public.lms_courses c on c.id=a.course_id
      left join public.lms_profiles tp on tp.id=a.teacher_id
      where (p_course_id is null or c.id=p_course_id)
        and (p_from is null or a.created_at>=p_from) and (p_to is null or a.created_at<=p_to)
        and (p_teacher_id is null or coalesce(a.teacher_id,c.instructor_id)=p_teacher_id)
        and (p_student_status is null or (p_student_status='__non_active__' and sp.status<>'active') or (p_student_status<>'__non_active__' and sp.status=p_student_status))
      order by a.created_at desc;
  elsif p_category='notifications' then
    return query
      select n.created_at,jsonb_build_object('recipient',coalesce(nullif(p.name,''),p.email),'recipient_email',p.email,'course',c.title,'title',n.title,'message',n.message,'type',n.type,'read',n.read,'action_url',n.action_url)
      from public.lms_notifications n
      join public.lms_profiles p on p.id=n.recipient_id
      left join public.lms_courses c on c.id=n.course_id
      where (p_course_id is null or n.course_id=p_course_id)
        and (p_from is null or n.created_at>=p_from) and (p_to is null or n.created_at<=p_to)
        and (p_teacher_id is null or exists(select 1 from public.lms_courses tc where tc.id=n.course_id and tc.instructor_id=p_teacher_id))
        and (p_student_status is null or (p_student_status='__non_active__' and p.status<>'active') or (p_student_status<>'__non_active__' and p.status=p_student_status))
      order by n.created_at desc;
  else
    raise exception 'Unknown export category' using errcode='22023';
  end if;
end $$;

create or replace function public.lms_admin_export_summary(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_course_id text default null,
  p_teacher_id uuid default null,
  p_payment_status text default null,
  p_student_status text default null
)
returns table(total_students bigint,total_revenue bigint,total_enrollments bigint)
language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.lms_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  return query
    select
      (select count(*) from public.lms_profiles p where p.role='student' and (p_from is null or p.created_at>=p_from) and (p_to is null or p.created_at<=p_to) and (p_student_status is null or (p_student_status='__non_active__' and p.status<>'active') or (p_student_status<>'__non_active__' and p.status=p_student_status))),
      (select coalesce(sum(case when pay.metadata->>'paymentMethod'='offline' then pay.amount*100 else pay.amount end),0)::bigint from public.lms_payments pay join public.lms_courses c on c.id=pay.course_id join public.lms_profiles sp on sp.id=pay.student_id where (p_from is null or pay.created_at>=p_from) and (p_to is null or pay.created_at<=p_to) and pay.status in ('paid','captured') and (p_course_id is null or c.id=p_course_id) and (p_teacher_id is null or c.instructor_id=p_teacher_id) and (p_student_status is null or (p_student_status='__non_active__' and sp.status<>'active') or (p_student_status<>'__non_active__' and sp.status=p_student_status)) and (p_payment_status is null or p_payment_status='paid')),
      (select count(*) from public.lms_enrollments e join public.lms_courses c on c.id=e.course_id join public.lms_profiles sp on sp.id=e.student_id where (p_from is null or e.created_at>=p_from) and (p_to is null or e.created_at<=p_to) and (p_course_id is null or c.id=p_course_id) and (p_teacher_id is null or c.instructor_id=p_teacher_id) and (p_student_status is null or (p_student_status='__non_active__' and sp.status<>'active') or (p_student_status<>'__non_active__' and sp.status=p_student_status)) and (p_payment_status is null or (p_payment_status='paid' and e.payment_status in ('paid','offline_paid','emi')) or (p_payment_status='free' and e.payment_status='free') or (p_payment_status='pending' and e.status in ('pending','payment_due'))));
end $$;

-- Return a scalar count using a normal RPC response instead of a HEAD request.
create or replace function public.lms_admin_export_count(
  p_category text,
  p_course_id text default null,
  p_teacher_id uuid default null,
  p_payment_status text default null,
  p_student_status text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns bigint
language plpgsql stable security definer set search_path=''
as $$
declare result_count bigint;
begin
  if not public.lms_admin() then raise exception 'Admin access required' using errcode='42501'; end if;
  select count(*) into result_count
  from public.lms_admin_export_rows(p_category,p_course_id,p_teacher_id,p_payment_status,p_student_status,p_from,p_to) as report_rows;
  return result_count;
end $$;

revoke all on function public.lms_admin_export_rows(text,text,uuid,text,text,timestamptz,timestamptz) from public,anon;
revoke all on function public.lms_admin_export_summary(timestamptz,timestamptz,text,uuid,text,text) from public,anon;
revoke all on function public.lms_admin_export_count(text,text,uuid,text,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.lms_admin_export_rows(text,text,uuid,text,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.lms_admin_export_summary(timestamptz,timestamptz,text,uuid,text,text) to authenticated;
grant execute on function public.lms_admin_export_count(text,text,uuid,text,text,timestamptz,timestamptz) to authenticated;

-- Refresh PostgREST's function signature cache so it sees the replaced RPC.
notify pgrst, 'reload schema';

commit;
