-- Offline admission by email. New emails are stored until that email creates a student account.
create table if not exists public.lms_offline_admission_invites (
  id text primary key default gen_random_uuid()::text,
  email text not null,
  course_id text not null references public.lms_courses(id) on delete cascade,
  teacher_id uuid not null references public.lms_profiles(id),
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique(email, course_id)
);
alter table public.lms_offline_admission_invites enable row level security;
grant select, insert, update, delete on public.lms_offline_admission_invites to authenticated;
grant all on public.lms_offline_admission_invites to service_role;

drop policy if exists lms_select on public.lms_offline_admission_invites;
create policy lms_select on public.lms_offline_admission_invites for select to authenticated
  using (public.lms_admin() or teacher_id = auth.uid());

create or replace function public.lms_grant_offline_enrollment_by_email(
  p_course text,
  p_email text,
  p_amount bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare student public.lms_profiles; enrollment public.lms_enrollments; normal_email text;
begin
  normal_email := lower(btrim(coalesce(p_email, '')));
  if normal_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_amount is null or p_amount <= 0 then
    raise exception 'A valid email and positive offline amount are required';
  end if;
  if not public.lms_owns_course(p_course) then
    raise exception 'Course access denied' using errcode = '42501';
  end if;

  select * into student from public.lms_profiles
  where lower(email) = normal_email and role = 'student' and status = 'active'
  limit 1;

  if found then
    select * into enrollment from public.lms_grant_offline_enrollment(p_course, student.id, p_amount);
    return jsonb_build_object('status', 'active', 'enrollmentId', enrollment.id);
  end if;

  if exists (
    select 1 from public.lms_offline_admission_invites
    where email = normal_email and course_id = p_course and status = 'pending'
  ) then
    raise exception 'A pending admission already exists for this email and course';
  end if;

  insert into public.lms_offline_admission_invites(email, course_id, teacher_id, amount)
  values (normal_email, p_course, auth.uid(), p_amount);
  return jsonb_build_object('status', 'pending');
end;
$$;

-- Keep the existing profile sync, then activate any admissions stored for this email.
create or replace function public.lms_sync_auth_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare invitation public.lms_offline_admission_invites; course_row public.lms_courses; enrollment public.lms_enrollments; payment_order text;
begin
  insert into public.lms_profiles(id,name,email,avatar_url)
  values(new.id,coalesce(new.raw_user_meta_data->>'name',new.raw_user_meta_data->>'full_name',''),coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'avatar_url',''))
  on conflict(id) do update set name=excluded.name,email=excluded.email,avatar_url=excluded.avatar_url;

  for invitation in
    select * from public.lms_offline_admission_invites
    where email = lower(coalesce(new.email, '')) and status = 'pending'
    for update
  loop
    select * into course_row from public.lms_courses where id = invitation.course_id;
    if found then
      insert into public.lms_enrollments(student_id, course_id, status, payment_status, metadata)
      values(new.id, invitation.course_id, 'active', 'offline_paid', jsonb_build_object('paymentMethod','offline','grantedBy',invitation.teacher_id))
      on conflict(student_id, course_id) do update
        set status='active', payment_status='offline_paid', updated_at=now(),
            metadata=public.lms_enrollments.metadata || excluded.metadata
      returning * into enrollment;

      payment_order := 'offline_' || gen_random_uuid()::text;
      insert into public.lms_payments(student_id,course_id,order_id,payment_id,amount,currency,status,metadata)
      values(new.id, invitation.course_id, payment_order, payment_order, invitation.amount, 'INR', 'paid',
        jsonb_build_object('paymentMethod','offline','source','teacher_offline_admission','recordedBy',invitation.teacher_id,'courseName',course_row.title));

      insert into public.lms_notifications(recipient_id,course_id,title,message,type,action_url,metadata)
      values(new.id, invitation.course_id, 'Course access granted', 'Your offline payment has been recorded. You can now start learning ' || course_row.title || '.', 'enrollment', '/student/courses/' || invitation.course_id, jsonb_build_object('paymentMethod','offline'));

      update public.lms_offline_admission_invites set status='accepted', accepted_at=now() where id=invitation.id;
    end if;
  end loop;
  return new;
end $$;

revoke all on function public.lms_grant_offline_enrollment_by_email(text, text, bigint) from public, anon;
grant execute on function public.lms_grant_offline_enrollment_by_email(text, text, bigint) to authenticated;
