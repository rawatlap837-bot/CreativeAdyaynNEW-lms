-- Private course community links and click analytics.
begin;

create table if not exists public.lms_course_community (
  course_id text primary key references public.lms_courses(id) on delete cascade,
  whatsapp_url text check (whatsapp_url is null or whatsapp_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]+$'),
  live_class_url text,
  group_rules text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.lms_community_join_clicks (
  id bigint generated always as identity primary key,
  course_id text not null references public.lms_courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  clicked_at timestamptz not null default now()
);

create index if not exists lms_community_clicks_course_date
  on public.lms_community_join_clicks(course_id, clicked_at desc);

alter table public.lms_course_community enable row level security;
alter table public.lms_community_join_clicks enable row level security;

grant select, insert, update, delete on public.lms_course_community to authenticated;
grant select, insert on public.lms_community_join_clicks to authenticated;
grant usage, select on sequence public.lms_community_join_clicks_id_seq to authenticated;
grant all on public.lms_course_community, public.lms_community_join_clicks to service_role;

create or replace function public.lms_is_course_teacher(cid text)
returns boolean language sql stable security definer set search_path=''
as $$ select public.lms_owns_course(cid) $$;

create or replace function public.lms_is_enrolled(cid text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists (
    select 1 from public.lms_enrollments e
    where e.course_id=cid and e.student_id=auth.uid()
      and e.status='active' and e.payment_status in ('free','paid','emi','offline_paid')
  )
$$;

drop policy if exists lms_community_select on public.lms_course_community;
create policy lms_community_select on public.lms_course_community
  for select to authenticated
  using (public.lms_is_course_teacher(course_id) or public.lms_is_enrolled(course_id));

drop policy if exists lms_community_insert on public.lms_course_community;
create policy lms_community_insert on public.lms_course_community
  for insert to authenticated with check (public.lms_is_course_teacher(course_id));

drop policy if exists lms_community_update on public.lms_course_community;
create policy lms_community_update on public.lms_course_community
  for update to authenticated using (public.lms_is_course_teacher(course_id))
  with check (public.lms_is_course_teacher(course_id));

drop policy if exists lms_community_delete on public.lms_course_community;
create policy lms_community_delete on public.lms_course_community
  for delete to authenticated using (public.lms_is_course_teacher(course_id));

drop policy if exists lms_community_clicks_insert on public.lms_community_join_clicks;
create policy lms_community_clicks_insert on public.lms_community_join_clicks
  for insert to authenticated
  with check (user_id=auth.uid() and public.lms_is_enrolled(course_id));

drop policy if exists lms_community_clicks_select on public.lms_community_join_clicks;
create policy lms_community_clicks_select on public.lms_community_join_clicks
  for select to authenticated
  using (public.lms_is_course_teacher(course_id));

-- Return the invite only after checking enrollment and recording the click.
create or replace function public.lms_join_course_community(cid text)
returns table(whatsapp_url text, live_class_url text, group_rules text)
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not public.lms_is_enrolled(cid) then
    raise exception 'Active enrollment required' using errcode='42501';
  end if;
  insert into public.lms_community_join_clicks(course_id,user_id)
    values(cid,auth.uid());
  return query select c.whatsapp_url,c.live_class_url,c.group_rules
    from public.lms_course_community c where c.course_id=cid;
end $$;

create or replace function public.lms_course_community_click_count(cid text)
returns bigint language sql stable security definer set search_path=''
as $$
  select count(*) from public.lms_community_join_clicks c
  where c.course_id=cid and public.lms_is_course_teacher(cid)
$$;

revoke all on function public.lms_is_course_teacher(text) from public,anon;
revoke all on function public.lms_is_enrolled(text) from public,anon;
grant execute on function public.lms_is_course_teacher(text),public.lms_is_enrolled(text) to authenticated,service_role;
revoke all on function public.lms_join_course_community(text) from public,anon;
grant execute on function public.lms_join_course_community(text) to authenticated;
revoke all on function public.lms_course_community_click_count(text) from public,anon;
grant execute on function public.lms_course_community_click_count(text) to authenticated;

-- Browser clients cannot create/change/delete enrollments. Free enrollment is
-- provided by lms_enroll_free; paid enrollment is confirmed by lms-payments.
revoke insert, update, delete on public.lms_enrollments from anon, authenticated;
grant select on public.lms_enrollments to authenticated;
-- The security-definer free enrollment RPC runs with its owner's table rights
-- and independently checks that the authoritative course price is zero.

commit;
