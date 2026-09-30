begin;

create table if not exists public.lms_course_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint lms_course_categories_name_not_empty check (length(trim(name)) > 0)
);

alter table public.lms_course_categories enable row level security;
grant select, insert, update, delete on public.lms_course_categories to authenticated;
grant all on public.lms_course_categories to service_role;

create policy lms_course_categories_select on public.lms_course_categories
  for select to authenticated using (created_by is null or created_by = auth.uid());
create policy lms_course_categories_insert on public.lms_course_categories
  for insert to authenticated with check (created_by = auth.uid() and public.lms_role() = 'teacher');
create policy lms_course_categories_update on public.lms_course_categories
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
revoke delete on public.lms_course_categories from authenticated;

create or replace function public.lms_delete_course_category(category_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare category_name text;
begin
  if public.lms_role() <> 'teacher' then
    raise exception 'Only teachers can delete course categories' using errcode = '42501';
  end if;
  select name into category_name from public.lms_course_categories where id = category_id for update;
  if category_name is null then raise exception 'Category not found'; end if;
  if exists (select 1 from public.lms_courses where category = category_name) then
    raise exception 'Category is in use by one or more courses' using errcode = '23503';
  end if;
  delete from public.lms_course_categories where id = category_id;
end;
$$;
revoke all on function public.lms_delete_course_category(uuid) from public, anon;
grant execute on function public.lms_delete_course_category(uuid) to authenticated;

insert into public.lms_course_categories(name) values
 ('Digital Marketing'), ('Web Development'), ('App Development'), ('Graphic Design'),
 ('UI/UX Design'), ('Video Editing'), ('Animation'), ('Artificial Intelligence'),
 ('Data Science'), ('Programming'), ('Cybersecurity'), ('Cloud Computing'),
 ('Business & Entrepreneurship'), ('Finance & Accounting'), ('Photography'),
 ('Content Writing'), ('Communication Skills'), ('Personal Development'), ('Other')
on conflict (name) do nothing;

-- Preserve existing teacher-created category labels during the rollout.
insert into public.lms_course_categories(name, created_by)
select distinct on (lower(trim(category))) trim(category), instructor_id
from public.lms_courses
where trim(coalesce(category, '')) <> ''
order by lower(trim(category)), instructor_id
on conflict (name) do nothing;

commit;
