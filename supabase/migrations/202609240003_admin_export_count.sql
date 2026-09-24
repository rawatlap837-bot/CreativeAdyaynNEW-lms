-- Adds the scalar RPC used by Export Reports record previews.
-- Apply after 202609240002_admin_exports.sql.
begin;

create or replace function public.lms_admin_export_count(
  p_category text,
  p_course_id text default null,
  p_teacher_id uuid default null,
  p_payment_status text default null,
  p_student_status text default null,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result_count bigint;
begin
  if not public.lms_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select count(*)
    into result_count
    from public.lms_admin_export_rows(
      p_category,
      p_course_id,
      p_teacher_id,
      p_payment_status,
      p_student_status,
      p_from,
      p_to
    ) as report_rows;

  return result_count;
end;
$$;

revoke all on function public.lms_admin_export_count(text,text,uuid,text,text,timestamptz,timestamptz) from public, anon;
grant execute on function public.lms_admin_export_count(text,text,uuid,text,text,timestamptz,timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;
