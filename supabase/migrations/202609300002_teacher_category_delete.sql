begin;

drop policy if exists lms_course_categories_delete on public.lms_course_categories;
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

commit;
