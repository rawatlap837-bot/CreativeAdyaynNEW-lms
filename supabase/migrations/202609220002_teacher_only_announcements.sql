-- Allow teacher accounts to read published announcements specifically
-- addressed to teachers, while students remain restricted to global and
-- enrolled-course announcements.
drop policy if exists lms_select on public.lms_announcements;

create policy lms_select
on public.lms_announcements
for select
to authenticated
using (
  public.lms_admin()
  or public.lms_owns_course(course_id)
  or (
    public.lms_role() = 'teacher'
    and status = 'published'
    and audience_type in ('global', 'teachers')
  )
  or (
    public.lms_role() = 'student'
    and status = 'published'
    and (
      audience_type = 'global'
      or public.lms_enrolled(course_id)
    )
  )
);
