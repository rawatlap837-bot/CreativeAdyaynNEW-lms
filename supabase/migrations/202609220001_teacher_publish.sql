begin;
create or replace function public.lms_guard_record() returns trigger language plpgsql set search_path='' as $$
declare k text; oldj jsonb; newj jsonb; c text;
begin
 new.updated_at=clock_timestamp();
 if current_user not in ('anon','authenticated') then return new; end if;
 if public.lms_role() is null then raise exception 'Account is not active' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  oldj=to_jsonb(old); newj=to_jsonb(new);
  foreach k in array array['id','student_id','instructor_id','course_id','teacher_id','author_id','recipient_id','assignment_id','discussion_id','session_id','module_id','created_at'] loop
   if oldj ? k and oldj->k is distinct from newj->k then raise exception 'Ownership fields cannot be changed' using errcode='42501'; end if;
  end loop;
 end if;
 if tg_table_name='lms_batches' then
  if jsonb_typeof(new.student_ids)<>'array' then raise exception 'Invalid student roster'; end if;
  if exists(select 1 from jsonb_array_elements_text(new.student_ids) sid where not exists(select 1 from public.lms_enrollments e where e.student_id::text=sid and e.course_id=new.course_id and e.status='active')) then raise exception 'Only active enrolled students can join a batch'; end if;
  new.student_count=jsonb_array_length(new.student_ids);
 elsif tg_table_name='lms_assignments' then
  if new.target_batch_id is not null and not exists(select 1 from public.lms_batches b where b.id=new.target_batch_id and b.course_id=new.course_id) then raise exception 'Batch belongs to another course'; end if;
 elsif tg_table_name='lms_assignment_submissions' then
  select course_id into c from public.lms_assignments where id=new.assignment_id;
  new.course_id=c;
 end if;
 if public.lms_admin() then return new; end if;
 if tg_table_name='lms_profiles' and tg_op='UPDATE' then
  if new.role is distinct from old.role or new.status is distinct from old.status or new.email is distinct from old.email or new.role_changed_at is distinct from old.role_changed_at then raise exception 'Only administrators can change roles or account status' using errcode='42501'; end if;
 elsif tg_table_name='lms_courses' then
  if tg_op='INSERT' then
   if new.status<>'draft' or new.featured or new.course_order<>0 or new.student_count<>0 or new.enrollment_count<>0 then raise exception 'Courses must start as drafts' using errcode='42501'; end if;
  else
   if new.featured is distinct from old.featured or new.course_order is distinct from old.course_order or new.student_count is distinct from old.student_count or new.enrollment_count is distinct from old.enrollment_count or (new.status is distinct from old.status and new.status not in ('draft','pending','published','archived')) then raise exception 'Only administrators can feature courses or change protected course fields' using errcode='42501'; end if;
  end if;
 elsif tg_table_name='lms_enrollments' then
  if tg_op='INSERT' then raise exception 'Use the enrollment function' using errcode='42501'; end if;
  if (to_jsonb(new)-array['updated_at','last_accessed_at','last_lesson_id']) is distinct from (to_jsonb(old)-array['updated_at','last_accessed_at','last_lesson_id']) then raise exception 'Use the lesson completion function' using errcode='42501'; end if;
 elsif tg_table_name='lms_assignment_submissions' then
  select course_id into c from public.lms_assignments where id=new.assignment_id;
  if not public.lms_owns_course(c) then
   if tg_op='INSERT' then
    if new.grade is not null or new.graded_at is not null or new.graded_by is not null or coalesce(new.feedback,'')<>'' then raise exception 'Students cannot grade submissions' using errcode='42501'; end if;
   elsif new.grade is distinct from old.grade or new.feedback is distinct from old.feedback or new.graded_at is distinct from old.graded_at or new.graded_by is distinct from old.graded_by then raise exception 'Students cannot grade submissions' using errcode='42501'; end if;
  end if;
 elsif tg_table_name='lms_live_classes' and tg_op='UPDATE' then
  if not public.lms_owns_course(new.course_id) then
  if (to_jsonb(new)-array['metadata','updated_at']) is distinct from (to_jsonb(old)-array['metadata','updated_at']) or (new.metadata-'status') is distinct from (old.metadata-'status') then raise exception 'Only attendance status can be changed' using errcode='42501'; end if;
  end if;
 elsif tg_table_name='lms_notifications' and tg_op='UPDATE' then
  if new.recipient_id=auth.uid() then
  if (to_jsonb(new)-array['read','updated_at']) is distinct from (to_jsonb(old)-array['read','updated_at']) then raise exception 'Only read status can be changed' using errcode='42501'; end if;
  end if;
 end if;
 return new;
end $$;
commit;
