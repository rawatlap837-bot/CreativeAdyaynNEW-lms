-- Publishing is owned by teachers. Administrators may still inspect, feature,
-- archive, or emergency-unpublish courses, but cannot make a course live.
create or replace function public.lms_teacher_only_course_publish()
returns trigger language plpgsql set search_path='' as $$
begin
  if current_user in ('anon','authenticated')
    and public.lms_admin()
    and new.status='published'
    and (tg_op='INSERT' or old.status is distinct from 'published')
  then
    raise exception 'Only the course teacher can publish this course'
      using errcode='42501';
  end if;
  return new;
end $$;

drop trigger if exists lms_admin_course_publish_block on public.lms_courses;
create trigger lms_admin_course_publish_block
before insert or update on public.lms_courses
for each row execute function public.lms_teacher_only_course_publish();

revoke all on function public.lms_teacher_only_course_publish() from public,anon,authenticated;
