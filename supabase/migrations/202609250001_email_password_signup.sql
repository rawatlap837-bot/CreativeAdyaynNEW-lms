-- Email/password registration with phone retained as profile metadata.
-- Safe to rerun. This replaces the earlier phone-auth-specific trigger body.
create or replace function public.lms_sync_auth_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare invitation public.lms_offline_admission_invites; course_row public.lms_courses; enrollment public.lms_enrollments; payment_order text; contact_email text; contact_phone text;
begin
  contact_email := lower(coalesce(nullif(new.email, ''), new.raw_user_meta_data->>'contactEmail', ''));
  contact_phone := coalesce(nullif(new.phone, ''), new.raw_user_meta_data->>'phone', '');
  insert into public.lms_profiles(id,name,email,avatar_url,phone)
  values(new.id,coalesce(new.raw_user_meta_data->>'name',new.raw_user_meta_data->>'full_name',''),contact_email,coalesce(new.raw_user_meta_data->>'avatar_url',''),contact_phone)
  on conflict(id) do update set name=excluded.name,email=excluded.email,avatar_url=excluded.avatar_url,phone=excluded.phone;

  for invitation in select * from public.lms_offline_admission_invites where email=contact_email and status='pending' for update loop
    select * into course_row from public.lms_courses where id=invitation.course_id;
    if found then
      insert into public.lms_enrollments(student_id,course_id,status,payment_status,metadata)
      values(new.id,invitation.course_id,'active','offline_paid',jsonb_build_object('paymentMethod','offline','grantedBy',invitation.teacher_id))
      on conflict(student_id,course_id) do update set status='active',payment_status='offline_paid',updated_at=now(),metadata=public.lms_enrollments.metadata||excluded.metadata
      returning * into enrollment;
      payment_order := 'offline_'||gen_random_uuid()::text;
      insert into public.lms_payments(student_id,course_id,order_id,payment_id,amount,currency,status,metadata)
      values(new.id,invitation.course_id,payment_order,payment_order,invitation.amount,'INR','paid',jsonb_build_object('paymentMethod','offline','source','teacher_offline_admission','recordedBy',invitation.teacher_id,'courseName',course_row.title));
      insert into public.lms_notifications(recipient_id,course_id,title,message,type,action_url,metadata)
      values(new.id,invitation.course_id,'Course access granted','Your offline payment has been recorded. You can now start learning '||course_row.title||'.','enrollment','/student/courses/'||invitation.course_id,jsonb_build_object('paymentMethod','offline'));
      update public.lms_offline_admission_invites set status='accepted',accepted_at=now() where id=invitation.id;
    end if;
  end loop;
  return new;
end $$;
