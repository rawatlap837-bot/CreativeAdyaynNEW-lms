import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const db = new PGlite();
let count = 0;
async function test(name, run) {
  await run(); count++; console.log(`PASS ${name}`);
}
async function denied(sql) {
  let rejected = false;
  try { await db.exec(sql); } catch { rejected = true; }
  assert.equal(rejected, true, "Expected database to reject the write");
}
const student = "00000000-0000-0000-0000-000000000001";
const teacher = "00000000-0000-0000-0000-000000000002";
const admin = "00000000-0000-0000-0000-000000000003";
const other = "00000000-0000-0000-0000-000000000004";
async function as(role, id = "") {
  await db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${id}',false);`);
}
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text);
    alter table storage.objects enable row level security;
    grant all on storage.objects to authenticated;
    grant select on storage.objects to anon;
  `);
  const sql = await readFile(new URL("../supabase/migrations/202609200001_lms.sql", import.meta.url), "utf8");
  await test("migration executes", () => db.exec(sql));
  await test("migration is rerunnable", () => db.exec(sql));
  await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values
    ('${student}','student@example.test','{"name":"Student","role":"admin"}'),
    ('${teacher}','teacher@example.test','{"name":"Teacher"}'),
    ('${admin}','admin@example.test','{"name":"Admin"}'),
    ('${other}','other@example.test','{"name":"Other"}');
    update public.lms_profiles set role='teacher' where id='${teacher}';
    update public.lms_profiles set role='admin' where id='${admin}';
  `);
  await test("signup cannot grant an admin role", async () => {
    const r = await db.query(`select role from public.lms_profiles where id=$1`, [student]);
    assert.equal(r.rows[0].role, "student");
  });
  await as("authenticated", student);
  await test("student cannot promote self", () => denied(`update public.lms_profiles set role='admin' where id='${student}'`));
  await test("student cannot read another profile", async () => assert.equal((await db.query(`select * from public.lms_profiles where id=$1`, [other])).rows.length, 0));
  await as("authenticated", teacher);
  await test("teacher creates a draft", () => db.exec(`insert into public.lms_courses(id,title,type,instructor_id) values('free','Free course','short','${teacher}'),('paid','Paid course','short','${teacher}');`));
  await test("teacher cannot publish directly", () => denied(`update public.lms_courses set status='published' where id='free'`));
  await as("authenticated", admin);
  await db.exec(`update public.lms_courses set status='published'; update public.lms_courses set price=100 where id='paid';
    insert into public.lms_modules(id,course_id,title) values('module','free','Module');
    insert into public.lms_lessons(id,course_id,module_id,title,published,video_url) values('lesson','free','module','Lesson',true,'https://example.test/private');
  `);
  await as("anon");
  await test("anonymous catalog works", async () => assert.equal((await db.query(`select * from public.lms_courses`)).rows.length, 2));
  await test("anonymous syllabus excludes private content", async () => {
    assert.equal((await db.query(`select * from public.lms_lessons`)).rows.length, 0);
    const r = await db.query(`select * from public.lms_course_outline('free')`);
    assert.equal(r.rows.length, 1); assert.equal("video_url" in r.rows[0], false);
  });
  await as("authenticated", student);
  await test("paid courses cannot be enrolled for free", () => denied(`select public.lms_enroll_free('paid')`));
  await test("client cannot forge paid enrollment", () => denied(`insert into public.lms_enrollments(id,student_id,course_id,payment_status) values('forged','${student}','paid','paid')`));
  await test("free enrollment is idempotent", async () => {
    await db.exec(`select public.lms_enroll_free('free'); select public.lms_enroll_free('free');`);
    assert.equal((await db.query(`select * from public.lms_enrollments`)).rows.length, 1);
  });
  await test("enrolled student can load lesson content", async () => assert.equal((await db.query(`select * from public.lms_lessons`)).rows.length, 1));
  await test("client cannot forge progress", () => denied(`update public.lms_enrollments set progress=100 where course_id='free'`));
  await test("completion validates lesson identity", () => denied(`select public.lms_complete_lesson('${student}_free','unknown')`));
  await test("completion issues only one certificate", async () => {
    await db.exec(`select public.lms_complete_lesson('${student}_free','lesson'); select public.lms_complete_lesson('${student}_free','lesson');`);
    assert.equal((await db.query(`select progress from public.lms_enrollments`)).rows[0].progress, 100);
    assert.equal((await db.query(`select * from public.lms_certificates`)).rows.length, 1);
  });
  await test("atomic repository merges metadata", async () => {
    await db.query(`select public.lms_write_records($1::jsonb)`, [JSON.stringify([{ kind: "set", table: "profiles", id: student, values: { phone: "123", metadata: { bio: "Hello" } } }])]);
    assert.equal((await db.query(`select phone,metadata from public.lms_profiles where id=$1`, [student])).rows[0].metadata.bio, "Hello");
  });
  await test("repository cannot bypass role protections", () => denied(`select public.lms_write_records('[{"kind":"update","table":"profiles","id":"${student}","values":{"role":"admin"}}]')`));
  await test("mutation batch rolls back on failure", async () => {
    await denied(`select public.lms_write_records('[{"kind":"update","table":"profiles","id":"${student}","values":{"phone":"999"}},{"kind":"update","table":"profiles","id":"${student}","values":{"role":"admin"}}]')`);
    assert.equal((await db.query(`select phone from public.lms_profiles where id=$1`, [student])).rows[0].phone, "123");
  });
  await test("private files reject other students", async () => {
    assert.equal((await db.query(`select public.lms_media_access('assignments/unknown/submissions/${other}/file.pdf',false) allowed`)).rows[0].allowed, false);
  });
  await test("student cannot call payment confirmation", () => denied(`select public.lms_confirm_payment('order_fake','pay_fake')`));
  await as("authenticated", teacher);
  await test("teacher creates course modules and lessons", () => db.exec(`
    insert into public.lms_modules(id,course_id,title) values('module2','free','Second module');
    insert into public.lms_lessons(id,course_id,module_id,title,published) values('lesson2','free','module2','Second lesson',true);
  `));
  await test("teacher cannot move a lesson to another course", () => denied(`update public.lms_lessons set course_id='paid' where id='lesson2'`));
  await db.exec(`insert into public.lms_batches(id,course_id,teacher_id,name) values('batch1','free','${teacher}','First'),('batch2','free','${teacher}','Second');`);
  await test("batch membership requires an active enrollment", () => denied(`select public.lms_manage_batch_student('add','batch1','${other}')`));
  await test("batch add updates roster and count", async () => {
    await db.exec(`select public.lms_manage_batch_student('add','batch1','${student}')`);
    const b = (await db.query(`select student_ids,student_count from public.lms_batches where id='batch1'`)).rows[0];
    assert.equal(b.student_count, 1); assert.deepEqual(b.student_ids, [student]);
  });
  await test("batch shift updates both rosters atomically", async () => {
    await db.exec(`select public.lms_manage_batch_student('shift','batch1','${student}','batch2')`);
    const b = (await db.query(`select id,student_count from public.lms_batches order by id`)).rows;
    assert.deepEqual(b.map((b) => b.student_count), [0, 1]);
  });
  await test("failed shift leaves original roster intact", async () => {
    await denied(`select public.lms_manage_batch_student('shift','batch2','${student}','missing')`);
    assert.equal((await db.query(`select student_count from public.lms_batches where id='batch2'`)).rows[0].student_count, 1);
  });
  await db.exec(`insert into public.lms_assignments(id,course_id,teacher_id,title,status,target_batch_id) values('assignment','free','${teacher}','Assignment','published','batch2');
    insert into public.lms_attendance_sessions(id,course_id,teacher_id,title,date) values('session','free','${teacher}','Session',current_date);
    insert into public.lms_discussions(id,course_id,author_id,title) values('discussion','free','${teacher}','Discussion');
  `);
  await as("authenticated", student);
  await test("enrolled batch student can submit an assignment", () => db.exec(`insert into public.lms_assignment_submissions(id,assignment_id,student_id,metadata) values('submission','assignment','${student}','{"answer":"Homework"}')`));
  await test("student cannot self-grade", () => denied(`update public.lms_assignment_submissions set grade=100 where id='submission'`));
  await test("student cannot submit for someone else", () => denied(`insert into public.lms_assignment_submissions(id,assignment_id,student_id) values('forged-submission','assignment','${other}')`));
  await test("student can mark an open attendance session", () => db.exec(`insert into public.lms_attendance_records(id,session_id,course_id,student_id,status) values('attendance','session','free','${student}','present')`));
  await test("student cannot mark another student's attendance", () => denied(`insert into public.lms_attendance_records(id,session_id,course_id,student_id,status) values('forged-attendance','session','free','${other}','present')`));
  await test("reply count is maintained on the server", async () => {
    await db.exec(`insert into public.lms_discussion_replies(id,discussion_id,author_id,body) values('reply','discussion','${student}','Reply')`);
    assert.equal((await db.query(`select metadata from public.lms_discussions where id='discussion'`)).rows[0].metadata.replyCount, 1);
  });
  await test("student cannot forge a certificate", () => denied(`insert into public.lms_certificates(student_id,course_id,enrollment_id,course_name,student_name) values('${student}','paid','fake','Fake','Student')`));
  await as("authenticated", other);
  await test("unrelated student cannot read assignments, attendance or submissions", async () => {
    for (const table of ["assignments", "assignment_submissions", "attendance_records", "discussions"]) assert.equal((await db.query(`select * from public.lms_${table}`)).rows.length, 0);
  });
  await test("unrelated student cannot read private course files", async () => assert.equal((await db.query(`select public.lms_media_access('courses/free/modules/module/lessons/lesson/video/file.mp4',false) allowed`)).rows[0].allowed, false));
  await as("authenticated", teacher);
  await test("teacher can grade their course's submission", () => db.exec(`update public.lms_assignment_submissions set grade=90,feedback='Good work',graded_by='${teacher}',graded_at=now() where id='submission'`));
  await test("stale transaction reads reject all writes", () => denied(`select public.lms_write_records('[{"kind":"update","table":"batches","id":"batch1","values":{"name":"Stale"}}]','[{"table":"batches","id":"batch1","version":"2000-01-01T00:00:00Z"}]')`));
  await as("service_role");
  await db.exec(`insert into public.lms_payments(id,student_id,course_id,order_id,amount,currency) values('order_test','${student}','paid','order_test',10000,'INR')`);
  await test("verified payment confirmation is idempotent", async () => {
    await db.exec(`select public.lms_confirm_payment('order_test','pay_test'); select public.lms_confirm_payment('order_test','pay_test');`);
    assert.equal((await db.query(`select * from public.lms_enrollments where course_id='paid'`)).rows.length, 1);
  });
  await test("a confirmed order cannot be reassigned to another payment", () => denied(`select public.lms_confirm_payment('order_test','pay_other')`));
  await as("authenticated", admin);
  await db.exec(`update public.lms_profiles set status='blocked' where id='${student}'`);
  await as("authenticated", student);
  await test("blocked accounts lose lesson and storage access", async () => {
    assert.equal((await db.query(`select * from public.lms_lessons`)).rows.length, 0);
    assert.equal((await db.query(`select public.lms_media_access('courses/free/modules/module/lessons/lesson/video/file.mp4',false) allowed`)).rows[0].allowed, false);
  });
  console.log(`${count} Supabase database checks passed.`);
} catch (error) {
  console.error("FAILED:", error.message, error.detail || "", error.where || "");
  process.exitCode = 1;
} finally { await db.close(); }
