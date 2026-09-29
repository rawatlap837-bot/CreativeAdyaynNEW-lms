-- Course deletion removes records that cannot meaningfully exist without the
-- course. Historical certificates retain their course name and student name,
-- but are removed with the course under the current LMS data model.
alter table public.lms_payments
  drop constraint if exists lms_payments_course_id_fkey;

alter table public.lms_payments
  add constraint lms_payments_course_id_fkey
  foreign key (course_id)
  references public.lms_courses(id)
  on delete cascade;

alter table public.lms_certificates
  drop constraint if exists lms_certificates_course_id_fkey;

alter table public.lms_certificates
  add constraint lms_certificates_course_id_fkey
  foreign key (course_id)
  references public.lms_courses(id)
  on delete cascade;
