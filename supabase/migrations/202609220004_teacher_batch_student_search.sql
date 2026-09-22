-- Teachers can search active student accounts for a batch they own. Only
-- names/emails required by the picker are returned, and the batch owner is
-- verified inside the database.
create or replace function public.lms_search_batch_students(
  p_course text,
  p_batch text,
  p_search text default ''
)
returns table(uid uuid, name text, email text, enrolled boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare b public.lms_batches;
begin
  select * into b from public.lms_batches where id = p_batch;
  if not found or b.course_id <> p_course or not public.lms_owns_course(p_course) then
    raise exception 'Batch access denied' using errcode = '42501';
  end if;

  return query
  select p.id, p.name, p.email, (e.student_id is not null)
  from public.lms_profiles p
  left join public.lms_enrollments e
    on e.student_id = p.id and e.course_id = p_course and e.status = 'active'
  where p.role = 'student'
    and p.status = 'active'
    and not (b.student_ids ? p.id::text)
    and (
      btrim(p_search) = ''
      or p.name ilike '%' || btrim(p_search) || '%'
      or p.email ilike '%' || btrim(p_search) || '%'
    )
  order by p.name, p.email
  limit 100;
end;
$$;

revoke all on function public.lms_search_batch_students(text, text, text) from public, anon;
grant execute on function public.lms_search_batch_students(text, text, text) to authenticated;

-- Adding a searched student to a teacher's batch also gives them an active
-- manual enrollment in that teacher's course, then adds them to the roster.
create or replace function public.lms_manage_batch_student(
  action text,
  batch text,
  student uuid,
  destination text default null
)
returns public.lms_batches
language plpgsql
security definer
set search_path = ''
as $$
declare b public.lms_batches; target public.lms_batches;
begin
  if action not in ('add','remove','shift') or student is null then
    raise exception 'Invalid membership change';
  end if;
  perform 1 from public.lms_batches where id in (batch,destination) order by id for update;
  select * into b from public.lms_batches where id = batch;
  if not found or not public.lms_owns_course(b.course_id) then
    raise exception 'Batch access denied' using errcode = '42501';
  end if;
  if b.status <> 'active' then raise exception 'Batch is archived'; end if;

  if action = 'add' then
    if not exists (
      select 1 from public.lms_profiles p
      where p.id = student and p.role = 'student' and p.status = 'active'
    ) then raise exception 'Active student account required'; end if;

    insert into public.lms_enrollments(student_id, course_id, status, payment_status, enrolled_at)
    values(student, b.course_id, 'active', 'manual', now())
    on conflict(student_id, course_id) do update
      set status = 'active', updated_at = now();
  elsif action = 'shift' then
    perform 1 from public.lms_enrollments
    where student_id = student and course_id = b.course_id and status = 'active' for share;
    if not found then raise exception 'Active enrollment required'; end if;
  end if;

  if action = 'add' then
    if b.student_ids ? student::text then raise exception 'Student is already in this batch'; end if;
    update public.lms_batches
    set student_ids = student_ids || jsonb_build_array(student::text),
        student_count = jsonb_array_length(student_ids) + 1
    where id = batch returning * into b;
  else
    if not (b.student_ids ? student::text) then raise exception 'Student is not in this batch'; end if;
    if action = 'shift' then
      select * into target from public.lms_batches where id = destination;
      if not found or target.id = b.id or target.course_id <> b.course_id
         or target.status <> 'active' or not public.lms_owns_course(target.course_id) then
        raise exception 'Invalid destination batch';
      end if;
      if target.student_ids ? student::text then raise exception 'Student is already in destination batch'; end if;
      update public.lms_batches
      set student_ids = student_ids || jsonb_build_array(student::text),
          student_count = jsonb_array_length(student_ids) + 1
      where id = destination;
    end if;
    update public.lms_batches
    set student_ids = student_ids - student::text,
        student_count = greatest(0, jsonb_array_length(student_ids) - 1)
    where id = batch returning * into b;
  end if;

  update public.lms_courses
  set enrollment_count = (
        select count(*) from public.lms_enrollments
        where course_id = b.course_id and status = 'active'
      ),
      student_count = (
        select count(*) from public.lms_enrollments
        where course_id = b.course_id and status = 'active'
      )
  where id = b.course_id;

  return b;
end;
$$;

revoke all on function public.lms_manage_batch_student(text, text, uuid, text) from public, anon;
grant execute on function public.lms_manage_batch_student(text, text, uuid, text) to authenticated;
