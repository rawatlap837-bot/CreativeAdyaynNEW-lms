-- Send announcement notifications only to their intended audience.
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
    if tg_table_name = 'lms_assignments' then batch = new.target_batch_id; end if;
  end if;

  if not published_now then return null; end if;

  -- Teachers-only admin announcements: teacher accounts only.
  if tg_table_name = 'lms_announcements' and new.audience_type = 'teachers' then
    insert into public.lms_notifications(recipient_id, course_id, title, message, type, action_url)
    select p.id, null, headline, 'New announcement from the administrator.', 'announcement', '/teacher/announcements'
    from public.lms_profiles p
    where p.status = 'active' and p.role = 'teacher';
    return null;
  end if;

  -- Lessons, assignments, global announcements, and course announcements:
  -- enrolled students only (or all active students for a global announcement).
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

-- Remove only the incorrect historical student notifications for
-- announcements addressed to teachers. The announcements themselves remain.
delete from public.lms_notifications n
using public.lms_profiles p
where n.recipient_id = p.id
  and p.role = 'student'
  and n.type = 'announcement'
  and n.title in (
    select a.title
    from public.lms_announcements a
    where a.audience_type = 'teachers'
  );
