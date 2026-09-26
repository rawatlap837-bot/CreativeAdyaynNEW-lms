-- Record one automatic "present" mark per student, course, and calendar day
-- when an actively enrolled student engages with the learning page.
create or replace function public.lms_mark_course_engagement_attendance(course text)
returns public.lms_attendance_records
language plpgsql
security definer
set search_path=''
as $$
declare
  student uuid := auth.uid();
  teacher uuid;
  session_ref text;
  attendance_ref text;
  result public.lms_attendance_records;
begin
  if student is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.lms_enrollments e
    where e.student_id=student and e.course_id=course and e.status='active'
  ) then
    raise exception 'Active enrollment required' using errcode='42501';
  end if;

  select c.instructor_id into teacher
  from public.lms_courses c
  where c.id=course and c.status='published';
  if not found then raise exception 'Course is unavailable'; end if;

  session_ref := 'engagement_' || course || '_' || current_date::text;
  attendance_ref := session_ref || '_' || student::text;

  insert into public.lms_attendance_sessions(
    id,course_id,teacher_id,title,date,status,metadata
  ) values(
    session_ref,course,teacher,'Course engagement',current_date,'closed',
    jsonb_build_object('automatic',true,'source','course_engagement')
  )
  on conflict(id) do update set updated_at=now();

  insert into public.lms_attendance_records(
    id,session_id,student_id,course_id,teacher_id,date,status,marked_at,metadata
  ) values(
    attendance_ref,session_ref,student,course,teacher,current_date,'present',now(),
    jsonb_build_object('automatic',true,'source','course_engagement')
  )
  on conflict(session_id,student_id) do update set
    marked_at=coalesce(public.lms_attendance_records.marked_at,excluded.marked_at),
    updated_at=now()
  returning * into result;

  return result;
end $$;

revoke all on function public.lms_mark_course_engagement_attendance(text) from public,anon;
grant execute on function public.lms_mark_course_engagement_attendance(text) to authenticated;
