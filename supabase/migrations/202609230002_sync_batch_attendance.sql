-- Backfill batch attendance into the canonical attendance tables used by the
-- teacher Attendance page and student dashboard.
insert into public.lms_attendance_sessions (id, course_id, teacher_id, title, date, status, metadata)
select
  'batch_' || ba.batch_id || '_' || ba.date,
  b.course_id,
  ba.teacher_id,
  coalesce(b.name, 'Batch') || ' attendance',
  ba.date,
  'closed',
  jsonb_build_object('batchId', ba.batch_id)
from public.lms_batch_attendance ba
join public.lms_batches b on b.id = ba.batch_id
on conflict (id) do update set
  teacher_id = excluded.teacher_id,
  title = excluded.title,
  date = excluded.date,
  status = excluded.status,
  metadata = public.lms_attendance_sessions.metadata || excluded.metadata,
  updated_at = now();

insert into public.lms_attendance_records (id, session_id, student_id, course_id, teacher_id, date, status, marked_at, metadata)
select
  'batch_' || ba.batch_id || '_' || ba.date || '_' || marks.student_id,
  'batch_' || ba.batch_id || '_' || ba.date,
  marks.student_id::uuid,
  b.course_id,
  ba.teacher_id,
  ba.date,
  marks.status,
  coalesce(ba.marked_at, now()),
  jsonb_build_object('batchId', ba.batch_id)
from public.lms_batch_attendance ba
join public.lms_batches b on b.id = ba.batch_id
cross join lateral jsonb_each_text(ba.records) as marks(student_id, status)
on conflict (session_id, student_id) do update set
  status = excluded.status,
  marked_at = excluded.marked_at,
  metadata = public.lms_attendance_records.metadata || excluded.metadata,
  updated_at = now();
