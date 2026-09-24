-- A shared trigger is used by lessons, assignments, and announcements.
-- Read table-specific fields from JSON only after identifying the source
-- table; direct NEW.audience_type access fails for a lesson row.
create or replace function public.lms_publish_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  published_now boolean;
  cid text;
  headline text;
  target text;
  batch text;
  audience text;
begin
  if tg_table_name = 'lms_lessons' then
    published_now = new.published and (tg_op = 'INSERT' or not old.published);
    cid = new.course_id;
    headline = 'New lesson: ' || new.title;
    target = '/student/courses/' || cid;
  else
    published_now = new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published');
    cid = new.course_id;
    headline = new.title;
    target = '/dashboard';
    if tg_table_name = 'lms_assignments' then
      batch = to_jsonb(new)->>'target_batch_id';
    end if;
  end if;

  if not published_now then return null; end if;

  if tg_table_name = 'lms_announcements' then
    audience = to_jsonb(new)->>'audience_type';
    if audience = 'teachers' then
      insert into public.lms_notifications(recipient_id, course_id, title, message, type, action_url)
      select p.id, null, headline, 'New announcement from the administrator.', 'announcement', '/teacher/announcements'
      from public.lms_profiles p
      where p.status = 'active' and p.role = 'teacher';
      return null;
    end if;
  end if;

  insert into public.lms_notifications(recipient_id, course_id, title, message, type, action_url)
  select p.id, cid, headline, 'New learning activity is available.',
    case when tg_table_name = 'lms_lessons' then 'lesson'
         when tg_table_name = 'lms_assignments' then 'assignment'
         else 'announcement' end,
    target
  from public.lms_profiles p
  where p.status = 'active'
    and p.role = 'student'
    and (cid is null or exists (
      select 1 from public.lms_enrollments e
      where e.course_id = cid and e.student_id = p.id and e.status = 'active'
    ))
    and (batch is null or exists (
      select 1 from public.lms_batches b
      where b.id = batch and b.student_ids ? p.id::text
    ));
  return null;
end;
$$;
