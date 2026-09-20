-- Fresh Supabase backend. Existing unprefixed tables are untouched.
-- Run the entire file in SQL Editor. It is safe to rerun.
begin;
create table if not exists public.lms_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 name text default '',
 email text default '',
 role text not null default 'student' check(role in ('student','teacher','admin')),
 status text not null default 'active',
 avatar_url text default '',
 phone text default '',
 role_changed_at timestamptz
);
alter table public.lms_profiles enable row level security;
grant select,insert,update,delete on public.lms_profiles to authenticated;
grant all on public.lms_profiles to service_role;
create table if not exists public.lms_courses (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 title text default '' not null,
 slug text,
 description text default '',
 short_description text default '',
 category text default '',
 level text default '',
 duration text default '',
 type text not null check(type in ('short','long')),
 instructor_id uuid references public.lms_profiles(id) not null,
 instructor_name text default '',
 thumbnail_url text default '',
 thumbnail_path text default '',
 banner_url text default '',
 banner_path text default '',
 preview_video_url text default '',
 preview_video_path text default '',
 price numeric not null default 0 check(price>=0),
 discount_price numeric not null default 0 check(discount_price>=0),
 currency text not null default 'INR',
 status text not null default 'draft' check(status in ('draft','pending','published','rejected','archived')),
 featured boolean not null default false,
 course_order integer not null default 0,
 published_at timestamptz,
 rejection_reason text default '',
 student_count integer not null default 0,
 enrollment_count integer not null default 0,
 unique(slug)
);
alter table public.lms_courses enable row level security;
grant select,insert,update,delete on public.lms_courses to authenticated;
grant all on public.lms_courses to service_role;
create table if not exists public.lms_modules (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 course_id text references public.lms_courses(id) on delete cascade not null,
 title text default '' not null,
 description text default '',
 sort_order integer not null default 0,
 unique(id,course_id)
);
alter table public.lms_modules enable row level security;
grant select,insert,update,delete on public.lms_modules to authenticated;
grant all on public.lms_modules to service_role;
create table if not exists public.lms_lessons (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 course_id text references public.lms_courses(id) on delete cascade not null,
 module_id text references public.lms_modules(id) on delete cascade not null,
 title text default '' not null,
 description text default '',
 type text default '',
 sort_order integer not null default 0,
 published boolean not null default false,
 is_preview boolean not null default false,
 video_url text default '',
 video_path text default '',
 resource_url text default '',
 resource_path text default '',
 thumbnail_url text default '',
 thumbnail_path text default '',
 duration text default '',
 foreign key(module_id,course_id) references public.lms_modules(id,course_id) on delete cascade
);
alter table public.lms_lessons enable row level security;
grant select,insert,update,delete on public.lms_lessons to authenticated;
grant all on public.lms_lessons to service_role;
create table if not exists public.lms_enrollments (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 student_id uuid references public.lms_profiles(id) not null,
 course_id text references public.lms_courses(id) on delete cascade not null,
 status text not null default 'active',
 payment_status text not null default 'free',
 payment_id text default '',
 progress integer not null default 0,
 completed_lessons jsonb not null default '[]',
 last_lesson_id text default '',
 enrolled_at timestamptz not null default now(),
 last_accessed_at timestamptz,
 unique(student_id,course_id),
 check(progress between 0 and 100)
);
alter table public.lms_enrollments enable row level security;
grant select,insert,update,delete on public.lms_enrollments to authenticated;
grant all on public.lms_enrollments to service_role;
create table if not exists public.lms_payments (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 student_id uuid references public.lms_profiles(id) not null,
 course_id text references public.lms_courses(id) not null,
 order_id text default '' not null,
 payment_id text,
 amount bigint not null check(amount>0),
 currency text not null default 'INR',
 status text not null default 'created',
 unique(order_id),
 unique(payment_id)
);
alter table public.lms_payments enable row level security;
grant select,insert,update,delete on public.lms_payments to authenticated;
grant all on public.lms_payments to service_role;
create table if not exists public.lms_batches (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 course_id text references public.lms_courses(id) on delete cascade not null,
 teacher_id uuid references public.lms_profiles(id) not null,
 name text default '' not null,
 mode text not null default 'online' check(mode in ('online','offline','hybrid')),
 status text not null default 'active',
 schedule jsonb not null default '{}',
 student_ids jsonb not null default '[]',
 student_count integer not null default 0
);
alter table public.lms_batches enable row level security;
grant select,insert,update,delete on public.lms_batches to authenticated;
grant all on public.lms_batches to service_role;
create table if not exists public.lms_attendance_sessions (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 course_id text references public.lms_courses(id) on delete cascade not null,
 teacher_id uuid references public.lms_profiles(id) not null,
 title text default '',
 date date not null,
 status text not null default 'open',
 unique(id,course_id)
);
alter table public.lms_attendance_sessions enable row level security;
grant select,insert,update,delete on public.lms_attendance_sessions to authenticated;
grant all on public.lms_attendance_sessions to service_role;
create table if not exists public.lms_attendance_records (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 session_id text references public.lms_attendance_sessions(id) on delete cascade not null,
 student_id uuid references public.lms_profiles(id) not null,
 course_id text references public.lms_courses(id) on delete cascade not null,
 teacher_id uuid references public.lms_profiles(id),
 date date,
 status text not null default 'present' check(status in ('present','absent','late')),
 marked_at timestamptz,
 unique(session_id,student_id),
 foreign key(session_id,course_id) references public.lms_attendance_sessions(id,course_id) on delete cascade
);
alter table public.lms_attendance_records enable row level security;
grant select,insert,update,delete on public.lms_attendance_records to authenticated;
grant all on public.lms_attendance_records to service_role;
create table if not exists public.lms_batch_attendance (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 batch_id text references public.lms_batches(id) on delete cascade not null,
 teacher_id uuid references public.lms_profiles(id) not null,
 date date not null,
 records jsonb not null default '{}',
 marked_at timestamptz,
 unique(batch_id,date)
);
alter table public.lms_batch_attendance enable row level security;
grant select,insert,update,delete on public.lms_batch_attendance to authenticated;
grant all on public.lms_batch_attendance to service_role;
create table if not exists public.lms_assignments (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 course_id text references public.lms_courses(id) on delete cascade not null,
 teacher_id uuid references public.lms_profiles(id) not null,
 title text default '' not null,
 description text default '',
 status text not null default 'draft',
 target_batch_id text references public.lms_batches(id) on delete set null,
 due_date timestamptz,
 published_at timestamptz
);
alter table public.lms_assignments enable row level security;
grant select,insert,update,delete on public.lms_assignments to authenticated;
grant all on public.lms_assignments to service_role;
create table if not exists public.lms_assignment_submissions (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 assignment_id text references public.lms_assignments(id) on delete cascade not null,
 student_id uuid references public.lms_profiles(id) not null,
 course_id text references public.lms_courses(id) on delete cascade,
 status text not null default 'submitted',
 submitted_at timestamptz,
 grade numeric,
 feedback text default '',
 graded_at timestamptz,
 graded_by uuid references public.lms_profiles(id),
 unique(assignment_id,student_id)
);
alter table public.lms_assignment_submissions enable row level security;
grant select,insert,update,delete on public.lms_assignment_submissions to authenticated;
grant all on public.lms_assignment_submissions to service_role;
create table if not exists public.lms_announcements (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 course_id text references public.lms_courses(id) on delete cascade,
 author_id uuid references public.lms_profiles(id) not null,
 title text default '' not null,
 body text default '',
 audience_type text default '',
 status text not null default 'published',
 pinned boolean not null default false,
 published_at timestamptz
);
alter table public.lms_announcements enable row level security;
grant select,insert,update,delete on public.lms_announcements to authenticated;
grant all on public.lms_announcements to service_role;
create table if not exists public.lms_discussions (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 course_id text references public.lms_courses(id) on delete cascade not null,
 author_id uuid references public.lms_profiles(id) not null,
 title text default '' not null,
 body text default '',
 status text not null default 'open'
);
alter table public.lms_discussions enable row level security;
grant select,insert,update,delete on public.lms_discussions to authenticated;
grant all on public.lms_discussions to service_role;
create table if not exists public.lms_discussion_replies (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 discussion_id text references public.lms_discussions(id) on delete cascade not null,
 author_id uuid references public.lms_profiles(id) not null,
 body text default '' not null
);
alter table public.lms_discussion_replies enable row level security;
grant select,insert,update,delete on public.lms_discussion_replies to authenticated;
grant all on public.lms_discussion_replies to service_role;
create table if not exists public.lms_notifications (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 recipient_id uuid references public.lms_profiles(id) not null,
 course_id text references public.lms_courses(id) on delete cascade,
 title text default '' not null,
 message text default '',
 type text default '',
 read boolean not null default false,
 action_url text default ''
);
alter table public.lms_notifications enable row level security;
grant select,insert,update,delete on public.lms_notifications to authenticated;
grant all on public.lms_notifications to service_role;
create table if not exists public.lms_certificates (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 student_id uuid references public.lms_profiles(id) not null,
 course_id text references public.lms_courses(id) not null,
 enrollment_id text references public.lms_enrollments(id) not null,
 certificate_id text not null default ('CA-'||upper(substr(gen_random_uuid()::text,1,8))),
 course_name text default '' not null,
 student_name text default '' not null,
 issue_date timestamptz not null default now(),
 unique(enrollment_id),
 unique(certificate_id)
);
alter table public.lms_certificates enable row level security;
grant select,insert,update,delete on public.lms_certificates to authenticated;
grant all on public.lms_certificates to service_role;
create table if not exists public.lms_tasks (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 student_id uuid references public.lms_profiles(id) not null,
 title text default '' not null,
 date timestamptz,
 completed boolean not null default false
);
alter table public.lms_tasks enable row level security;
grant select,insert,update,delete on public.lms_tasks to authenticated;
grant all on public.lms_tasks to service_role;
create table if not exists public.lms_schedule_events (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 student_id uuid references public.lms_profiles(id) not null,
 course_id text references public.lms_courses(id) on delete cascade,
 title text default '' not null,
 date timestamptz not null
);
alter table public.lms_schedule_events enable row level security;
grant select,insert,update,delete on public.lms_schedule_events to authenticated;
grant all on public.lms_schedule_events to service_role;
create table if not exists public.lms_live_classes (
 id text primary key default gen_random_uuid()::text,
 metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 student_id uuid references public.lms_profiles(id) not null,
 course_id text references public.lms_courses(id) on delete cascade not null,
 title text default '' not null,
 start_time timestamptz not null
);
alter table public.lms_live_classes enable row level security;
grant select,insert,update,delete on public.lms_live_classes to authenticated;
grant all on public.lms_live_classes to service_role;
grant select on public.lms_courses,public.lms_modules,public.lms_lessons to anon;

-- Helpers run with a fixed search_path to avoid recursive RLS and name shadowing.
create or replace function public.lms_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.lms_profiles where id=auth.uid() and status='active'
$$;
create or replace function public.lms_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.lms_role()='admin',false)
$$;
create or replace function public.lms_owns_course(cid text) returns boolean language sql stable security definer set search_path='' as $$
 select public.lms_admin() or coalesce(public.lms_role()='teacher' and exists(select 1 from public.lms_courses where id=cid and instructor_id=auth.uid()),false)
$$;
create or replace function public.lms_enrolled(cid text) returns boolean language sql stable security definer set search_path='' as $$
 select public.lms_role() is not null and exists(select 1 from public.lms_enrollments where course_id=cid and student_id=auth.uid() and status='active')
$$;
create or replace function public.lms_course_member(cid text) returns boolean language sql stable security definer set search_path='' as $$
 select public.lms_owns_course(cid) or public.lms_enrolled(cid)
$$;
create or replace function public.lms_assignment_visible(aid text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lms_assignments a where a.id=aid and (public.lms_owns_course(a.course_id) or
  (a.status='published' and public.lms_enrolled(a.course_id) and (a.target_batch_id is null or exists(
   select 1 from public.lms_batches b where b.id=a.target_batch_id and b.student_ids ? auth.uid()::text)))))
$$;
create or replace function public.lms_shared_student(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.lms_role()='teacher' and exists(select 1 from public.lms_enrollments e join public.lms_courses c on c.id=e.course_id where e.student_id=sid and c.instructor_id=auth.uid())
$$;
create or replace function public.lms_discussion_member(did text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.lms_discussions where id=did and public.lms_course_member(course_id))
$$;

-- Signup never trusts a role supplied by the browser.
create or replace function public.lms_sync_auth_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.lms_profiles(id,name,email,avatar_url) values(new.id,coalesce(new.raw_user_meta_data->>'name',new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'avatar_url',''))
 on conflict(id) do update set name=excluded.name,email=excluded.email,avatar_url=excluded.avatar_url;
 return new;
end $$;
drop trigger if exists lms_auth_profile on auth.users;
create trigger lms_auth_profile after insert or update of email,raw_user_meta_data on auth.users for each row execute function public.lms_sync_auth_profile();
insert into public.lms_profiles(id,name,email,avatar_url)
 select id,coalesce(raw_user_meta_data->>'name',raw_user_meta_data->>'full_name',''),coalesce(email,''),coalesce(raw_user_meta_data->>'avatar_url','') from auth.users
 on conflict(id) do nothing;

-- Protect privileged columns even when a caller bypasses the UI or repository.
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
   if new.featured is distinct from old.featured or new.course_order is distinct from old.course_order or new.student_count is distinct from old.student_count or new.enrollment_count is distinct from old.enrollment_count or (new.status is distinct from old.status and new.status not in ('draft','pending','archived')) then raise exception 'Only administrators can publish or feature courses' using errcode='42501'; end if;
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
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'lms\_%' escape '\' loop
  execute format('drop trigger if exists lms_guard on public.%I',t);
  execute format('create trigger lms_guard before insert or update on public.%I for each row execute function public.lms_guard_record()',t);
 end loop;
end $$;

drop policy if exists lms_select on public.lms_profiles;
create policy lms_select on public.lms_profiles for select to authenticated using (id=auth.uid() or public.lms_admin() or public.lms_shared_student(id));

drop policy if exists lms_update on public.lms_profiles;
create policy lms_update on public.lms_profiles for update to authenticated using (id=auth.uid() or public.lms_admin()) with check (id=auth.uid() or public.lms_admin());

drop policy if exists lms_delete on public.lms_profiles;
create policy lms_delete on public.lms_profiles for delete to authenticated using (public.lms_admin());

drop policy if exists lms_select on public.lms_courses;
create policy lms_select on public.lms_courses for select to anon, authenticated using (status='published' or public.lms_course_member(id));

drop policy if exists lms_insert on public.lms_courses;
create policy lms_insert on public.lms_courses for insert to authenticated with check (public.lms_admin() or (public.lms_role()='teacher' and instructor_id=auth.uid()));

drop policy if exists lms_update on public.lms_courses;
create policy lms_update on public.lms_courses for update to authenticated using (public.lms_owns_course(id)) with check (public.lms_owns_course(id));

drop policy if exists lms_delete on public.lms_courses;
create policy lms_delete on public.lms_courses for delete to authenticated using (public.lms_owns_course(id) and (public.lms_admin() or status in ('draft','rejected','archived')));

drop policy if exists lms_select on public.lms_modules;
create policy lms_select on public.lms_modules for select to anon, authenticated using (public.lms_course_member(course_id) or exists(select 1 from public.lms_courses c where c.id=course_id and c.status='published'));

drop policy if exists lms_insert on public.lms_modules;
create policy lms_insert on public.lms_modules for insert to authenticated with check (public.lms_owns_course(course_id));

drop policy if exists lms_update on public.lms_modules;
create policy lms_update on public.lms_modules for update to authenticated using (public.lms_owns_course(course_id)) with check (public.lms_owns_course(course_id));

drop policy if exists lms_delete on public.lms_modules;
create policy lms_delete on public.lms_modules for delete to authenticated using (public.lms_owns_course(course_id));

drop policy if exists lms_select on public.lms_lessons;
create policy lms_select on public.lms_lessons for select to anon, authenticated using (public.lms_owns_course(course_id) or (published and (public.lms_enrolled(course_id) or (is_preview and exists(select 1 from public.lms_courses c where c.id=course_id and c.status='published')))));

drop policy if exists lms_insert on public.lms_lessons;
create policy lms_insert on public.lms_lessons for insert to authenticated with check (public.lms_owns_course(course_id));

drop policy if exists lms_update on public.lms_lessons;
create policy lms_update on public.lms_lessons for update to authenticated using (public.lms_owns_course(course_id)) with check (public.lms_owns_course(course_id));

drop policy if exists lms_delete on public.lms_lessons;
create policy lms_delete on public.lms_lessons for delete to authenticated using (public.lms_owns_course(course_id));

drop policy if exists lms_select on public.lms_enrollments;
create policy lms_select on public.lms_enrollments for select to authenticated using (student_id=auth.uid() or public.lms_owns_course(course_id));

drop policy if exists lms_update on public.lms_enrollments;
create policy lms_update on public.lms_enrollments for update to authenticated using ((student_id=auth.uid() and public.lms_role() is not null) or public.lms_admin()) with check ((student_id=auth.uid() and public.lms_role() is not null) or public.lms_admin());

drop policy if exists lms_delete on public.lms_enrollments;
create policy lms_delete on public.lms_enrollments for delete to authenticated using (public.lms_admin());

drop policy if exists lms_select on public.lms_payments;
create policy lms_select on public.lms_payments for select to authenticated using ((student_id=auth.uid() and public.lms_role() is not null) or public.lms_admin());

drop policy if exists lms_select on public.lms_batches;
create policy lms_select on public.lms_batches for select to authenticated using (public.lms_owns_course(course_id) or (public.lms_enrolled(course_id) and student_ids ? auth.uid()::text));

drop policy if exists lms_insert on public.lms_batches;
create policy lms_insert on public.lms_batches for insert to authenticated with check (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin()));

drop policy if exists lms_update on public.lms_batches;
create policy lms_update on public.lms_batches for update to authenticated using (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin())) with check (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin()));

drop policy if exists lms_delete on public.lms_batches;
create policy lms_delete on public.lms_batches for delete to authenticated using (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin()));

drop policy if exists lms_select on public.lms_attendance_sessions;
create policy lms_select on public.lms_attendance_sessions for select to authenticated using (public.lms_course_member(course_id));

drop policy if exists lms_insert on public.lms_attendance_sessions;
create policy lms_insert on public.lms_attendance_sessions for insert to authenticated with check (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin()));

drop policy if exists lms_update on public.lms_attendance_sessions;
create policy lms_update on public.lms_attendance_sessions for update to authenticated using (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin())) with check (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin()));

drop policy if exists lms_delete on public.lms_attendance_sessions;
create policy lms_delete on public.lms_attendance_sessions for delete to authenticated using (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin()));

drop policy if exists lms_select on public.lms_attendance_records;
create policy lms_select on public.lms_attendance_records for select to authenticated using ((student_id=auth.uid() and public.lms_enrolled(course_id)) or public.lms_owns_course(course_id));

drop policy if exists lms_insert on public.lms_attendance_records;
create policy lms_insert on public.lms_attendance_records for insert to authenticated with check (public.lms_owns_course(course_id) or (student_id=auth.uid() and status='present' and public.lms_enrolled(course_id) and exists(select 1 from public.lms_attendance_sessions s where s.id=session_id and s.course_id=lms_attendance_records.course_id and s.status='open' and s.date=current_date)));

drop policy if exists lms_update on public.lms_attendance_records;
create policy lms_update on public.lms_attendance_records for update to authenticated using (public.lms_owns_course(course_id)) with check (public.lms_owns_course(course_id));

drop policy if exists lms_delete on public.lms_attendance_records;
create policy lms_delete on public.lms_attendance_records for delete to authenticated using (public.lms_owns_course(course_id));

drop policy if exists lms_select on public.lms_batch_attendance;
create policy lms_select on public.lms_batch_attendance for select to authenticated using (exists(select 1 from public.lms_batches b where b.id=batch_id and public.lms_owns_course(b.course_id)));

drop policy if exists lms_insert on public.lms_batch_attendance;
create policy lms_insert on public.lms_batch_attendance for insert to authenticated with check (exists(select 1 from public.lms_batches b where b.id=batch_id and public.lms_owns_course(b.course_id)));

drop policy if exists lms_update on public.lms_batch_attendance;
create policy lms_update on public.lms_batch_attendance for update to authenticated using (exists(select 1 from public.lms_batches b where b.id=batch_id and public.lms_owns_course(b.course_id))) with check (exists(select 1 from public.lms_batches b where b.id=batch_id and public.lms_owns_course(b.course_id)));

drop policy if exists lms_delete on public.lms_batch_attendance;
create policy lms_delete on public.lms_batch_attendance for delete to authenticated using (exists(select 1 from public.lms_batches b where b.id=batch_id and public.lms_owns_course(b.course_id)));

drop policy if exists lms_select on public.lms_assignments;
create policy lms_select on public.lms_assignments for select to authenticated using (public.lms_assignment_visible(id));

drop policy if exists lms_insert on public.lms_assignments;
create policy lms_insert on public.lms_assignments for insert to authenticated with check (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin()));

drop policy if exists lms_update on public.lms_assignments;
create policy lms_update on public.lms_assignments for update to authenticated using (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin())) with check (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin()));

drop policy if exists lms_delete on public.lms_assignments;
create policy lms_delete on public.lms_assignments for delete to authenticated using (public.lms_owns_course(course_id) and (teacher_id=auth.uid() or public.lms_admin()));

drop policy if exists lms_select on public.lms_assignment_submissions;
create policy lms_select on public.lms_assignment_submissions for select to authenticated using ((student_id=auth.uid() and public.lms_assignment_visible(assignment_id)) or exists(select 1 from public.lms_assignments a where a.id=assignment_id and public.lms_owns_course(a.course_id)));

drop policy if exists lms_insert on public.lms_assignment_submissions;
create policy lms_insert on public.lms_assignment_submissions for insert to authenticated with check (student_id=auth.uid() and public.lms_assignment_visible(assignment_id));

drop policy if exists lms_update on public.lms_assignment_submissions;
create policy lms_update on public.lms_assignment_submissions for update to authenticated using ((student_id=auth.uid() and public.lms_assignment_visible(assignment_id)) or exists(select 1 from public.lms_assignments a where a.id=assignment_id and public.lms_owns_course(a.course_id))) with check ((student_id=auth.uid() and public.lms_assignment_visible(assignment_id)) or exists(select 1 from public.lms_assignments a where a.id=assignment_id and public.lms_owns_course(a.course_id)));

drop policy if exists lms_delete on public.lms_assignment_submissions;
create policy lms_delete on public.lms_assignment_submissions for delete to authenticated using (exists(select 1 from public.lms_assignments a where a.id=assignment_id and public.lms_owns_course(a.course_id)));

drop policy if exists lms_select on public.lms_announcements;
create policy lms_select on public.lms_announcements for select to authenticated using (public.lms_admin() or public.lms_owns_course(course_id) or (public.lms_role() is not null and status='published' and (audience_type='global' or public.lms_enrolled(course_id))));

drop policy if exists lms_insert on public.lms_announcements;
create policy lms_insert on public.lms_announcements for insert to authenticated with check (public.lms_admin() or (author_id=auth.uid() and public.lms_owns_course(course_id)));

drop policy if exists lms_update on public.lms_announcements;
create policy lms_update on public.lms_announcements for update to authenticated using (public.lms_admin() or (author_id=auth.uid() and public.lms_owns_course(course_id))) with check (public.lms_admin() or (author_id=auth.uid() and public.lms_owns_course(course_id)));

drop policy if exists lms_delete on public.lms_announcements;
create policy lms_delete on public.lms_announcements for delete to authenticated using (public.lms_admin() or (author_id=auth.uid() and public.lms_owns_course(course_id)));

drop policy if exists lms_select on public.lms_discussions;
create policy lms_select on public.lms_discussions for select to authenticated using (public.lms_course_member(course_id));

drop policy if exists lms_insert on public.lms_discussions;
create policy lms_insert on public.lms_discussions for insert to authenticated with check (author_id=auth.uid() and public.lms_course_member(course_id));

drop policy if exists lms_update on public.lms_discussions;
create policy lms_update on public.lms_discussions for update to authenticated using (public.lms_owns_course(course_id) or (author_id=auth.uid() and public.lms_enrolled(course_id))) with check (public.lms_owns_course(course_id) or (author_id=auth.uid() and public.lms_enrolled(course_id)));

drop policy if exists lms_delete on public.lms_discussions;
create policy lms_delete on public.lms_discussions for delete to authenticated using (public.lms_owns_course(course_id) or (author_id=auth.uid() and public.lms_enrolled(course_id)));

drop policy if exists lms_select on public.lms_discussion_replies;
create policy lms_select on public.lms_discussion_replies for select to authenticated using (public.lms_discussion_member(discussion_id));

drop policy if exists lms_insert on public.lms_discussion_replies;
create policy lms_insert on public.lms_discussion_replies for insert to authenticated with check (author_id=auth.uid() and public.lms_discussion_member(discussion_id));

drop policy if exists lms_update on public.lms_discussion_replies;
create policy lms_update on public.lms_discussion_replies for update to authenticated using (author_id=auth.uid() and public.lms_discussion_member(discussion_id)) with check (author_id=auth.uid() and public.lms_discussion_member(discussion_id));

drop policy if exists lms_delete on public.lms_discussion_replies;
create policy lms_delete on public.lms_discussion_replies for delete to authenticated using ((author_id=auth.uid() and public.lms_discussion_member(discussion_id)) or public.lms_admin());

drop policy if exists lms_select on public.lms_notifications;
create policy lms_select on public.lms_notifications for select to authenticated using (recipient_id=auth.uid() or public.lms_admin());

drop policy if exists lms_insert on public.lms_notifications;
create policy lms_insert on public.lms_notifications for insert to authenticated with check (public.lms_admin() or (public.lms_owns_course(course_id) and exists(select 1 from public.lms_enrollments e where e.course_id=lms_notifications.course_id and e.student_id=recipient_id)));

drop policy if exists lms_update on public.lms_notifications;
create policy lms_update on public.lms_notifications for update to authenticated using (recipient_id=auth.uid() or public.lms_admin()) with check (recipient_id=auth.uid() or public.lms_admin());

drop policy if exists lms_delete on public.lms_notifications;
create policy lms_delete on public.lms_notifications for delete to authenticated using (recipient_id=auth.uid() or public.lms_admin());

drop policy if exists lms_select on public.lms_certificates;
create policy lms_select on public.lms_certificates for select to authenticated using (student_id=auth.uid() or public.lms_owns_course(course_id));

drop policy if exists lms_select on public.lms_tasks;
create policy lms_select on public.lms_tasks for select to authenticated using (student_id=auth.uid() or public.lms_admin());

drop policy if exists lms_insert on public.lms_tasks;
create policy lms_insert on public.lms_tasks for insert to authenticated with check (student_id=auth.uid() or public.lms_admin());

drop policy if exists lms_update on public.lms_tasks;
create policy lms_update on public.lms_tasks for update to authenticated using (student_id=auth.uid() or public.lms_admin()) with check (student_id=auth.uid() or public.lms_admin());

drop policy if exists lms_delete on public.lms_tasks;
create policy lms_delete on public.lms_tasks for delete to authenticated using (student_id=auth.uid() or public.lms_admin());

drop policy if exists lms_select on public.lms_schedule_events;
create policy lms_select on public.lms_schedule_events for select to authenticated using (student_id=auth.uid() or public.lms_owns_course(course_id));

drop policy if exists lms_insert on public.lms_schedule_events;
create policy lms_insert on public.lms_schedule_events for insert to authenticated with check (public.lms_owns_course(course_id));

drop policy if exists lms_update on public.lms_schedule_events;
create policy lms_update on public.lms_schedule_events for update to authenticated using (public.lms_owns_course(course_id)) with check (public.lms_owns_course(course_id));

drop policy if exists lms_delete on public.lms_schedule_events;
create policy lms_delete on public.lms_schedule_events for delete to authenticated using (public.lms_owns_course(course_id));

drop policy if exists lms_select on public.lms_live_classes;
create policy lms_select on public.lms_live_classes for select to authenticated using (student_id=auth.uid() or public.lms_owns_course(course_id));

drop policy if exists lms_insert on public.lms_live_classes;
create policy lms_insert on public.lms_live_classes for insert to authenticated with check (public.lms_owns_course(course_id));

drop policy if exists lms_update on public.lms_live_classes;
create policy lms_update on public.lms_live_classes for update to authenticated using (public.lms_owns_course(course_id) or (student_id=auth.uid() and public.lms_enrolled(course_id))) with check (public.lms_owns_course(course_id) or (student_id=auth.uid() and public.lms_enrolled(course_id)));

drop policy if exists lms_delete on public.lms_live_classes;
create policy lms_delete on public.lms_live_classes for delete to authenticated using (public.lms_owns_course(course_id));

-- Atomic repository mutations. SECURITY INVOKER preserves every table's RLS.
-- Reads are locked and version-checked before any writes, including batch shifts.
create or replace function public.lms_write_records(operations jsonb, reads jsonb default '[]') returns void
language plpgsql security invoker set search_path='' as $$
declare op jsonb; rd jsonb; t text; rid text; previous jsonb; patch jsonb; k text; v jsonb; cols text; affected bigint;
 allowed constant text[] := array['profiles','courses','modules','lessons','enrollments','payments','batches','attendance_sessions','attendance_records','batch_attendance','assignments','assignment_submissions','announcements','discussions','discussion_replies','notifications','certificates','tasks','schedule_events','live_classes'];
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(operations)<>'array' or jsonb_array_length(operations)>500 or jsonb_array_length(reads)>500 then raise exception 'Invalid mutation batch'; end if;
 for rd in select value from jsonb_array_elements(reads) order by value->>'table',value->>'id' loop
  if not (rd->>'table'=any(allowed)) then raise exception 'Invalid table'; end if;
  t='lms_'||(rd->>'table');
  execute format('select to_jsonb(r) from public.%I r where id::text=$1 for update',t) into previous using rd->>'id';
  if (previous->>'updated_at')::timestamptz is distinct from (rd->>'version')::timestamptz then raise exception 'Record changed; retry' using errcode='40001'; end if;
 end loop;
 for op in select value from jsonb_array_elements(operations) loop
  if not (op->>'table'=any(allowed)) then raise exception 'Invalid table'; end if;
  t='lms_'||(op->>'table'); rid=op->>'id'; patch=coalesce(op->'values','{}');
  if rid is null or rid='' or jsonb_typeof(patch)<>'object' then raise exception 'Invalid record'; end if;
  execute format('select to_jsonb(r) from public.%I r where id::text=$1 for update',t) into previous using rid;
  if op->>'kind'='delete' then
   execute format('delete from public.%I where id::text=$1',t) using rid;
   get diagnostics affected=row_count;
   if affected=0 then raise exception 'Record not found or access denied' using errcode='42501'; end if;
   continue;
  end if;
  if op->>'kind' not in ('set','insert','update') then raise exception 'Invalid operation'; end if;
  if op->>'kind'='update' and previous is null then raise exception 'Record not found or access denied' using errcode='42501'; end if;
  if patch ? 'id' then raise exception 'ID is immutable'; end if;
  if patch ? 'metadata' then patch=jsonb_set(patch,'{metadata}',coalesce(previous->'metadata','{}')||(patch->'metadata')); end if;
  for k,v in select key,value from jsonb_each(patch) loop
   if not exists(select 1 from pg_attribute a where a.attrelid=to_regclass('public.'||t) and a.attname=k and a.attnum>0 and not a.attisdropped) then raise exception 'Unknown column: %',k; end if;
   if jsonb_typeof(v)='object' and v->>'__op' in ('union','remove') then
    if v->>'__op'='union' then
     select coalesce(jsonb_agg(distinct value),'[]') into v from jsonb_array_elements(coalesce(previous->k,'[]')||(v->'values'));
    else
     select coalesce(jsonb_agg(value),'[]') into v from jsonb_array_elements(coalesce(previous->k,'[]')) where not (patch->k->'values' @> jsonb_build_array(value));
    end if;
    patch=jsonb_set(patch,array[k],v);
   end if;
  end loop;
  if previous is null or op->>'kind'='insert' then
   patch=patch||jsonb_build_object('id',rid);
   select string_agg(format('%I',key),',') into cols from jsonb_object_keys(patch) key;
   execute format('insert into public.%I(%s) select %s from jsonb_populate_record(null::public.%I,$1)',t,cols,cols,t) using patch;
  else
   select string_agg(format('%I',key),',') into cols from jsonb_object_keys(patch) key;
   if cols is not null then
    execute format('update public.%I set (%s)=(select %s from jsonb_populate_record(null::public.%I,$1)) where id::text=$2',t,cols,cols,t) using patch,rid;
    get diagnostics affected=row_count;
    if affected=0 then raise exception 'Record not found or access denied' using errcode='42501'; end if;
   end if;
  end if;
 end loop;
end $$;

-- Price and access decisions use authoritative database values.
create or replace function public.lms_enroll_free(course text) returns public.lms_enrollments
language plpgsql security definer set search_path='' as $$
declare c public.lms_courses; e public.lms_enrollments;
begin
 if public.lms_role() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into c from public.lms_courses where id=course and status='published' for share;
 if not found then raise exception 'Published course not found'; end if;
 if c.price>0 then raise exception 'Payment verification is required' using errcode='42501'; end if;
 insert into public.lms_enrollments(id,student_id,course_id,status,payment_status,metadata)
 values(auth.uid()::text||'_'||course,auth.uid(),course,'active','free',jsonb_build_object('courseName',c.title))
 on conflict(student_id,course_id) do nothing;
 select * into e from public.lms_enrollments where student_id=auth.uid() and course_id=course;
 return e;
end $$;

create or replace function public.lms_complete_lesson(enrollment text, lesson text) returns public.lms_enrollments
language plpgsql security definer set search_path='' as $$
declare e public.lms_enrollments; total integer; done integer; completed jsonb;
begin
 if public.lms_role() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into e from public.lms_enrollments where id=enrollment and student_id=auth.uid() and status='active' for update;
 if not found then raise exception 'Active enrollment required' using errcode='42501'; end if;
 if not exists(select 1 from public.lms_lessons where id=lesson and course_id=e.course_id and published) then raise exception 'Published lesson not found'; end if;
 select coalesce(jsonb_agg(distinct value),'[]') into completed from jsonb_array_elements(e.completed_lessons||jsonb_build_array(lesson));
 select count(*),count(*) filter(where completed ? id) into total,done from public.lms_lessons where course_id=e.course_id and published;
 update public.lms_enrollments set completed_lessons=completed,progress=least(100,round(done*100.0/greatest(total,1))::integer),last_lesson_id=lesson,last_accessed_at=now() where id=enrollment returning * into e;
 if total>0 and done=total then
  insert into public.lms_certificates(student_id,course_id,enrollment_id,course_name,student_name)
  select e.student_id,e.course_id,e.id,c.title,p.name from public.lms_courses c,public.lms_profiles p where c.id=e.course_id and p.id=e.student_id
  on conflict(enrollment_id) do nothing;
 end if;
 return e;
end $$;

-- Only the payment Edge Function (service_role) may call this function.
create or replace function public.lms_confirm_payment(order_ref text, payment_ref text) returns public.lms_enrollments
language plpgsql security definer set search_path='' as $$
declare p public.lms_payments; e public.lms_enrollments;
begin
 select * into p from public.lms_payments where order_id=order_ref for update;
 if not found then raise exception 'Payment order not found'; end if;
 if p.status='paid' and p.payment_id is distinct from payment_ref then raise exception 'Order already paid with another payment'; end if;
 update public.lms_payments set status='paid',payment_id=payment_ref where id=p.id;
 insert into public.lms_enrollments(id,student_id,course_id,status,payment_status,payment_id,metadata)
 select p.student_id::text||'_'||p.course_id,p.student_id,p.course_id,'active','paid',payment_ref,jsonb_build_object('courseName',c.title) from public.lms_courses c where c.id=p.course_id
 on conflict(student_id,course_id) do update set status='active',payment_status='paid',payment_id=excluded.payment_id;
 select * into e from public.lms_enrollments where student_id=p.student_id and course_id=p.course_id;
 return e;
end $$;

-- Public syllabus never exposes paid lesson URLs, resources, or descriptions.
create or replace function public.lms_course_outline(course text) returns table(id text,module_id text,title text,type text,duration text,sort_order integer,is_preview boolean)
language sql stable security definer set search_path='' as $$
 select l.id,l.module_id,l.title,l.type,l.duration,l.sort_order,l.is_preview from public.lms_lessons l
 join public.lms_courses c on c.id=l.course_id where c.id=course and c.status='published' and l.published order by l.sort_order,l.id
$$;

create or replace function public.lms_enrollment_created() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.lms_courses set enrollment_count=(select count(*) from public.lms_enrollments where course_id=new.course_id and status='active'),
 student_count=(select count(*) from public.lms_enrollments where course_id=new.course_id and status='active') where id=new.course_id;
 insert into public.lms_notifications(recipient_id,course_id,title,message,type,action_url)
 select new.student_id,new.course_id,'Enrollment confirmed',title,'enrollment','/student/courses/'||id from public.lms_courses where id=new.course_id;
 return new;
end $$;
drop trigger if exists lms_new_enrollment on public.lms_enrollments;
create trigger lms_new_enrollment after insert on public.lms_enrollments for each row execute function public.lms_enrollment_created();

-- Application functions are explicitly granted; trigger helpers cannot be called by clients.
do $$ declare f record; begin
 for f in select oid::regprocedure signature,proname from pg_proc where pronamespace='public'::regnamespace and proname like 'lms\_%' escape '\' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  if f.proname in ('lms_role','lms_admin','lms_owns_course','lms_enrolled','lms_course_member','lms_assignment_visible','lms_shared_student','lms_discussion_member','lms_course_outline') then
   execute format('grant execute on function %s to anon,authenticated,service_role',f.signature);
  elsif f.proname in ('lms_write_records','lms_enroll_free','lms_complete_lesson') then
   execute format('grant execute on function %s to authenticated',f.signature);
  elsif f.proname='lms_confirm_payment' then
   execute format('grant execute on function %s to service_role',f.signature);
  end if;
 end loop;
end $$;

-- Index foreign keys and the dashboard's most common filters.
create index if not exists lms_courses_instructor on public.lms_courses(instructor_id,status);
create index if not exists lms_courses_catalog on public.lms_courses(status,type,course_order);
create index if not exists lms_modules_course on public.lms_modules(course_id,sort_order);
create index if not exists lms_lessons_course on public.lms_lessons(course_id,module_id,sort_order);
create index if not exists lms_enrollments_course on public.lms_enrollments(course_id,student_id);
create index if not exists lms_notifications_recipient on public.lms_notifications(recipient_id,created_at desc);
create index if not exists lms_assignments_course on public.lms_assignments(course_id,teacher_id);
create index if not exists lms_batches_teacher on public.lms_batches(teacher_id,course_id);
create index if not exists lms_attendance_course on public.lms_attendance_sessions(course_id,date);

-- Enable realtime for all application tables, without changing existing publications.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  for t in select tablename from pg_tables where schemaname='public' and tablename like 'lms\_%' escape '\' loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
    execute format('alter publication supabase_realtime add table public.%I',t);
   end if;
  end loop;
 end if;
end $$;

-- Public thumbnails/avatars and private lesson/submission files use separate buckets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('lms-public','lms-public',true,5242880,array['image/jpeg','image/png','image/webp','image/avif']),
 ('lms-media','lms-media',false,52428800,null)
on conflict(id) do nothing;
create or replace function public.lms_media_access(object_name text, writing boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare parts text[]:=string_to_array(object_name,'/'); c text;
begin
 if public.lms_role() is null then return false; end if;
 if public.lms_admin() then return true; end if;
 if parts[1]='courses' then
  if public.lms_owns_course(parts[2]) then return true; end if;
  if writing then return false; end if;
  return public.lms_enrolled(parts[2]) and (parts[5]<>'lessons' or exists(select 1 from public.lms_lessons where id=parts[6] and course_id=parts[2] and published));
 elsif parts[1]='course-resources' then
  return case when writing then public.lms_owns_course(parts[2]) else public.lms_course_member(parts[2]) end;
 elsif parts[1]='assignments' then
  select course_id into c from public.lms_assignments where id=parts[2];
  return public.lms_owns_course(c) or (parts[3]='submissions' and parts[4]=auth.uid()::text and public.lms_assignment_visible(parts[2]));
 end if;
 return false;
end $$;
revoke all on function public.lms_media_access(text,boolean) from public;
grant execute on function public.lms_media_access(text,boolean) to authenticated;
drop policy if exists lms_public_read on storage.objects;
create policy lms_public_read on storage.objects for select to anon,authenticated using(bucket_id='lms-public');
drop policy if exists lms_public_insert on storage.objects;
create policy lms_public_insert on storage.objects for insert to authenticated with check(bucket_id='lms-public' and public.lms_role() is not null and ((string_to_array(name,'/'))[1]=auth.uid()::text or ((string_to_array(name,'/'))[1]='avatars' and (string_to_array(name,'/'))[2]=auth.uid()::text)));
drop policy if exists lms_public_update on storage.objects;
create policy lms_public_update on storage.objects for update to authenticated using(bucket_id='lms-public' and (owner_id=auth.uid()::text or public.lms_admin())) with check(bucket_id='lms-public' and (owner_id=auth.uid()::text or public.lms_admin()));
drop policy if exists lms_public_delete on storage.objects;
create policy lms_public_delete on storage.objects for delete to authenticated using(bucket_id='lms-public' and (owner_id=auth.uid()::text or public.lms_admin()));
drop policy if exists lms_media_read on storage.objects;
create policy lms_media_read on storage.objects for select to authenticated using(bucket_id='lms-media' and public.lms_media_access(name,false));
drop policy if exists lms_media_insert on storage.objects;
create policy lms_media_insert on storage.objects for insert to authenticated with check(bucket_id='lms-media' and public.lms_media_access(name,true));
drop policy if exists lms_media_update on storage.objects;
create policy lms_media_update on storage.objects for update to authenticated using(bucket_id='lms-media' and public.lms_media_access(name,true)) with check(bucket_id='lms-media' and public.lms_media_access(name,true));
drop policy if exists lms_media_delete on storage.objects;
create policy lms_media_delete on storage.objects for delete to authenticated using(bucket_id='lms-media' and public.lms_media_access(name,true));

create or replace function public.lms_reply_count() returns trigger language plpgsql security definer set search_path='' as $$
declare did text;
begin
 did=case when tg_op='DELETE' then old.discussion_id else new.discussion_id end;
 update public.lms_discussions set metadata=metadata||jsonb_build_object('replyCount',(select count(*) from public.lms_discussion_replies where discussion_id=did)) where id=did;
 return null;
end $$;
drop trigger if exists lms_reply_count on public.lms_discussion_replies;
create trigger lms_reply_count after insert or delete on public.lms_discussion_replies for each row execute function public.lms_reply_count();
revoke all on function public.lms_reply_count() from public,anon,authenticated;

create or replace function public.lms_publish_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare published_now boolean; cid text; headline text; target text; batch text;
begin
 if tg_table_name='lms_lessons' then
  published_now=new.published and (tg_op='INSERT' or not old.published);
  cid=new.course_id; headline='New lesson: '||new.title; target='/student/courses/'||cid;
 else
  published_now=new.status='published' and (tg_op='INSERT' or old.status is distinct from 'published');
  cid=new.course_id; headline=new.title; target='/dashboard';
  if tg_table_name='lms_assignments' then batch=new.target_batch_id; end if;
 end if;
 if published_now then
  insert into public.lms_notifications(recipient_id,course_id,title,message,type,action_url)
  select p.id,cid,headline,'New learning activity is available.',case when tg_table_name='lms_lessons' then 'lesson' when tg_table_name='lms_assignments' then 'assignment' else 'announcement' end,target
  from public.lms_profiles p where p.status='active' and p.role='student' and
   (cid is null or exists(select 1 from public.lms_enrollments e where e.course_id=cid and e.student_id=p.id and e.status='active')) and
   (batch is null or exists(select 1 from public.lms_batches b where b.id=batch and b.student_ids ? p.id::text));
 end if;
 return null;
end $$;
drop trigger if exists lms_publish_notice on public.lms_announcements;
create trigger lms_publish_notice after insert or update on public.lms_announcements for each row execute function public.lms_publish_notification();
drop trigger if exists lms_publish_notice on public.lms_assignments;
create trigger lms_publish_notice after insert or update on public.lms_assignments for each row execute function public.lms_publish_notification();
drop trigger if exists lms_publish_notice on public.lms_lessons;
create trigger lms_publish_notice after insert or update on public.lms_lessons for each row execute function public.lms_publish_notification();
revoke all on function public.lms_publish_notification() from public,anon,authenticated;


-- Membership changes validate enrollment and lock both rosters in one transaction.
create or replace function public.lms_manage_batch_student(action text,batch text,student uuid,destination text default null) returns public.lms_batches
language plpgsql security definer set search_path='' as $$
declare b public.lms_batches; target public.lms_batches;
begin
 if action not in ('add','remove','shift') or student is null then raise exception 'Invalid membership change'; end if;
 perform 1 from public.lms_batches where id in (batch,destination) order by id for update;
 select * into b from public.lms_batches where id=batch;
 if not found or not public.lms_owns_course(b.course_id) then raise exception 'Batch access denied' using errcode='42501'; end if;
 if b.status<>'active' then raise exception 'Batch is archived'; end if;
 if action in ('add','shift') then
  perform 1 from public.lms_enrollments where student_id=student and course_id=b.course_id and status='active' for share;
  if not found then raise exception 'Active enrollment required'; end if;
 end if;
 if action='add' then
  if b.student_ids ? student::text then raise exception 'Student is already in this batch'; end if;
  update public.lms_batches set student_ids=student_ids||jsonb_build_array(student::text),student_count=jsonb_array_length(student_ids)+1 where id=batch returning * into b;
 else
  if not (b.student_ids ? student::text) then raise exception 'Student is not in this batch'; end if;
  if action='shift' then
   select * into target from public.lms_batches where id=destination;
   if not found or target.id=b.id or target.course_id<>b.course_id or target.status<>'active' or not public.lms_owns_course(target.course_id) then raise exception 'Invalid destination batch'; end if;
   if target.student_ids ? student::text then raise exception 'Student is already in destination batch'; end if;
   update public.lms_batches set student_ids=student_ids||jsonb_build_array(student::text),student_count=jsonb_array_length(student_ids)+1 where id=destination;
  end if;
  update public.lms_batches set student_ids=student_ids-student::text,student_count=greatest(0,jsonb_array_length(student_ids)-1) where id=batch returning * into b;
 end if;
 return b;
end $$;
revoke all on function public.lms_manage_batch_student(text,text,uuid,text) from public,anon;
grant execute on function public.lms_manage_batch_student(text,text,uuid,text) to authenticated;

notify pgrst,'reload schema';
commit;
