-- A teacher can record an offline fee and grant access only to a course they own.
-- The payment record is retained for the admin's online/offline reporting.
create or replace function public.lms_search_course_students(
  p_course text,
  p_search text default ''
)
returns table(uid uuid, name text, email text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.lms_owns_course(p_course) then
    raise exception 'Course access denied' using errcode = '42501';
  end if;

  return query
  select p.id,
         coalesce(nullif(p.name, ''), split_part(p.email, '@', 1)),
         p.email
  from public.lms_profiles p
  where p.role = 'student'
    and p.status = 'active'
    and (
      coalesce(trim(p_search), '') = ''
      or p.email ilike '%' || trim(p_search) || '%'
      or coalesce(p.name, '') ilike '%' || trim(p_search) || '%'
    )
  order by p.name nulls last, p.email
  limit 20;
end;
$$;

create or replace function public.lms_grant_offline_enrollment(
  p_course text,
  p_student uuid,
  p_amount bigint
)
returns public.lms_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.lms_courses;
  e public.lms_enrollments;
  payment_order text;
begin
  if p_student is null or p_amount is null or p_amount <= 0 then
    raise exception 'A student and a positive offline amount are required';
  end if;

  select * into c from public.lms_courses where id = p_course;
  if not found or not public.lms_owns_course(p_course) then
    raise exception 'Course access denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.lms_profiles
    where id = p_student and role = 'student' and status = 'active'
  ) then
    raise exception 'Active student account required';
  end if;

  if exists (
    select 1 from public.lms_enrollments
    where student_id = p_student and course_id = p_course and status = 'active'
  ) then
    raise exception 'This student already has access to this course';
  end if;

  insert into public.lms_enrollments(student_id, course_id, status, payment_status, metadata)
  values (
    p_student, p_course, 'active', 'offline_paid',
    jsonb_build_object('paymentMethod', 'offline', 'grantedBy', auth.uid())
  )
  on conflict(student_id, course_id) do update
    set status = 'active', payment_status = 'offline_paid', updated_at = now(),
        metadata = public.lms_enrollments.metadata || excluded.metadata
  returning * into e;

  payment_order := 'offline_' || gen_random_uuid()::text;
  insert into public.lms_payments(student_id, course_id, order_id, payment_id, amount, currency, status, metadata)
  values (
    p_student, p_course, payment_order, payment_order, p_amount, 'INR', 'paid',
    jsonb_build_object(
      'paymentMethod', 'offline',
      'source', 'teacher_offline_admission',
      'recordedBy', auth.uid(),
      'courseName', c.title
    )
  );

  insert into public.lms_notifications(recipient_id, course_id, title, message, type, action_url, metadata)
  values (
    p_student, p_course, 'Course access granted',
    'Your offline payment has been recorded. You can now start learning ' || c.title || '.',
    'enrollment', '/student/courses/' || p_course,
    jsonb_build_object('paymentMethod', 'offline')
  );

  return e;
end;
$$;

revoke all on function public.lms_search_course_students(text, text) from public, anon;
grant execute on function public.lms_search_course_students(text, text) to authenticated;
revoke all on function public.lms_grant_offline_enrollment(text, uuid, bigint) from public, anon;
grant execute on function public.lms_grant_offline_enrollment(text, uuid, bigint) to authenticated;
