-- Course deletion also removes its payment records. A payment belongs to one
-- course, and retaining it without that course is not supported by the LMS.
alter table public.lms_payments
  drop constraint if exists lms_payments_course_id_fkey;

alter table public.lms_payments
  add constraint lms_payments_course_id_fkey
  foreign key (course_id)
  references public.lms_courses(id)
  on delete cascade;
