-- Offline payments and enrollments are administrative operations. Keep
-- existing owner checks for unrelated course features, but restrict these
-- RPCs and pending admission records to admins.

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
  if not public.lms_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.lms_courses where id = p_course) then
    raise exception 'Course not found';
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
  if not public.lms_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_student is null or p_amount is null or p_amount <= 0 then
    raise exception 'A student and a positive offline amount are required';
  end if;

  select * into c from public.lms_courses where id = p_course;
  if not found then
    raise exception 'Course not found';
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
      'source', 'admin_offline_admission',
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

create or replace function public.lms_grant_offline_enrollment_by_email(
  p_course text,
  p_email text,
  p_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  student public.lms_profiles;
  enrollment public.lms_enrollments;
  normal_email text;
begin
  if not public.lms_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  normal_email := lower(btrim(coalesce(p_email, '')));
  if normal_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_amount is null or p_amount <= 0 then
    raise exception 'A valid email and positive offline amount are required';
  end if;

  if not exists (select 1 from public.lms_courses where id = p_course) then
    raise exception 'Course not found';
  end if;

  select * into student from public.lms_profiles
  where lower(email) = normal_email and role = 'student' and status = 'active'
  limit 1;

  if found then
    select * into enrollment from public.lms_grant_offline_enrollment(p_course, student.id, p_amount);
    return jsonb_build_object('status', 'active', 'enrollmentId', enrollment.id);
  end if;

  if exists (
    select 1 from public.lms_offline_admission_invites
    where email = normal_email and course_id = p_course and status = 'pending'
  ) then
    raise exception 'A pending admission already exists for this email and course';
  end if;

  insert into public.lms_offline_admission_invites(email, course_id, teacher_id, amount)
  values (normal_email, p_course, auth.uid(), p_amount);
  return jsonb_build_object('status', 'pending');
end;
$$;

revoke all on function public.lms_search_course_students(text, text) from public, anon;
grant execute on function public.lms_search_course_students(text, text) to authenticated;
revoke all on function public.lms_grant_offline_enrollment(text, uuid, bigint) from public, anon;
grant execute on function public.lms_grant_offline_enrollment(text, uuid, bigint) to authenticated;
revoke all on function public.lms_grant_offline_enrollment_by_email(text, text, bigint) from public, anon;
grant execute on function public.lms_grant_offline_enrollment_by_email(text, text, bigint) to authenticated;

drop policy if exists lms_select on public.lms_offline_admission_invites;
create policy lms_select on public.lms_offline_admission_invites for select to authenticated
  using (public.lms_admin());
