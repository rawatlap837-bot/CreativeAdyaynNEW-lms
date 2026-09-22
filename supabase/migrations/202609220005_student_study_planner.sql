-- Personal study-planner sessions belong to the signed-in student.
-- Course schedule events remain manageable by the course owner.

drop policy if exists lms_insert on public.lms_schedule_events;
create policy lms_insert on public.lms_schedule_events
for insert to authenticated
with check (
  (student_id = auth.uid() and course_id is null)
  or public.lms_owns_course(course_id)
);

drop policy if exists lms_update on public.lms_schedule_events;
create policy lms_update on public.lms_schedule_events
for update to authenticated
using (
  (student_id = auth.uid() and course_id is null)
  or public.lms_owns_course(course_id)
)
with check (
  (student_id = auth.uid() and course_id is null)
  or public.lms_owns_course(course_id)
);

drop policy if exists lms_delete on public.lms_schedule_events;
create policy lms_delete on public.lms_schedule_events
for delete to authenticated
using (
  (student_id = auth.uid() and course_id is null)
  or public.lms_owns_course(course_id)
);
