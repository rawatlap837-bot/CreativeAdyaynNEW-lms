import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fromRow, toRow, columnName, Timestamp, tableColumns } from "../src/lib/records.js";
import { payableAmount, validSignature, assertCapturedPayment } from "../supabase/functions/_shared/payments.js";
import { createHmac } from "node:crypto";

let count = 0;
async function test(name, callback) { await callback(); count++; console.log(`PASS ${name}`); }
await test("course aliases preserve both current and migrated consumers", () => {
  const course = fromRow("courses", { id: "course", instructor_id: "teacher", thumbnail_url: "image", course_order: 3, price: 100, discount_price: 0, created_at: "2026-09-20T00:00:00Z" });
  assert.equal(course.instructorId, "teacher"); assert.equal(course.instructor_id, "teacher");
  assert.equal(course.thumbnailUrl, "image"); assert.equal(course.order, 3);
  assert.equal(course.discountPrice, null); assert.ok(course.createdAt instanceof Timestamp);
});
await test("discount normalization never makes a paid course free", () => {
  for (const discount of [0, null, 120, -1]) assert.equal(fromRow("courses", { price: 100, discount_price: discount }).discountPrice, null);
  assert.equal(fromRow("courses", { price: 100, discount_price: 75 }).discountPrice, 75);
});
await test("typed columns override legacy metadata", () => {
  assert.equal(fromRow("profiles", { id: "student", role: "student", metadata: { role: "admin", uid: "other" } }).role, "student");
  assert.equal(fromRow("profiles", { id: "student", metadata: { uid: "other" } }).uid, "student");
});
await test("mutation mapping preserves typed fields and supplemental data", () => {
  assert.deepEqual(toRow("lessons", { title: "Lesson", videoUrl: "url", order: 2, customNotes: "notes", ignored: undefined }), { title: "Lesson", video_url: "url", sort_order: 2, metadata: { customNotes: "notes" } });
  assert.deepEqual(toRow("assignment_submissions", { gradedAt: "", gradedBy: "", feedback: "" }), { graded_at: null, graded_by: null, feedback: "" });
});
await test("timestamps and date-only attendance remain compatible", () => {
  assert.equal(fromRow("attendance_sessions", { date: "2026-09-20" }).date, "2026-09-20");
  assert.ok(fromRow("tasks", { date: "2026-09-20T12:00:00Z" }).date instanceof Timestamp);
  assert.equal(toRow("assignments", { dueDate: new Date("2026-09-20T12:00:00Z") }).due_date, "2026-09-20T12:00:00.000Z");
});
await test("legacy ownership aliases target real SQL columns", () => {
  assert.equal(columnName("enrollments", "uid"), "student_id");
  assert.equal(columnName("notifications", "uid"), "recipient_id");
  assert.equal(columnName("profiles", "uid"), "id");
  assert.equal(columnName("courses", "__name__"), "id");
});

let rows = [], calls = [], rpcCalls = [], channels = [];
function request(table) {
  const filters = []; let offset = 0, end = Infinity;
  const chain = {
    select: () => chain,
    eq: (field, value) => { calls.push(["eq", field, value]); filters.push((r) => r[field] === value); return chain; },
    order: (field, options) => { calls.push(["order", field, options]); return chain; },
    limit: (n) => { end = n - 1; return chain; },
    range: (a, b) => { calls.push(["range", a, b]); offset = a; end = b; return chain; },
    maybeSingle: async () => ({ data: rows.filter((r) => filters.every((f) => f(r)))[0] || null, error: null }),
    then: (resolve) => Promise.resolve({ data: rows.filter((r) => filters.every((f) => f(r))).slice(offset, end + 1), error: null }).then(resolve),
  };
  calls.push(["from", table]); return chain;
}
globalThis.__lmsTestClient = {
  from: request,
  rpc: async (name, args) => { rpcCalls.push([name, args]); return { data: null, error: null }; },
  channel: (name) => {
    const channel = { name, removed: false, on: () => channel, subscribe: (callback) => { channel.status = callback; return channel; } };
    channels.push(channel); return channel;
  },
  removeChannel: (channel) => { channel.removed = true; },
};
let source = await readFile(new URL("../src/lib/database.js", import.meta.url), "utf8");
source = source.replace('import { supabase } from "./supabase";', "const supabase = globalThis.__lmsTestClient;")
  .replace('import { refreshMediaUrls } from "./storage";', "const refreshMediaUrls = async (value) => value;")
  .replaceAll('"./records"', JSON.stringify(new URL("../src/lib/records.js", import.meta.url).href));
const repository = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const { doc, collection, resolveReference, getDocs, getDoc, query, where, orderBy, limit, updateDoc, onSnapshot } = repository;
const root = { path: [] };
await test("nested lessons resolve to relational foreign keys", () => {
  assert.deepEqual(resolveReference(doc(root, "courses", "course", "modules", "module", "lessons", "lesson")), { table: "lessons", id: "lesson", filters: [["course_id", "course"], ["module_id", "module"]] });
});
await test("assignment IDs are unique per assignment and student", () => {
  assert.equal(resolveReference(doc(root, "assignments", "a", "submissions", "s")).id, "a_s");
});
await test("profile and student lists share the canonical profile table", () => {
  assert.equal(resolveReference(collection(root, "users")).table, "profiles");
  assert.deepEqual(resolveReference(collection(root, "students")).filters, [["role", "student"]]);
});
await test("queries translate column names and preserve ordering", async () => {
  rows = [{ id: "a", instructor_id: "teacher", title: "Course" }]; calls = [];
  const result = await getDocs(query(collection(root, "courses"), where("instructorId", "==", "teacher"), orderBy("order")));
  assert.equal(result.docs[0].data().instructorId, "teacher");
  assert.ok(calls.some((c) => c[0] === "from" && c[1] === "lms_courses"));
  assert.ok(calls.some((c) => c[0] === "order" && c[1] === "course_order"));
});
await test("roster queries paginate beyond the default page size", async () => {
  rows = Array.from({ length: 1201 }, (_, i) => ({ id: String(i), name: "Student" })); calls = [];
  const result = await getDocs(collection(root, "users"));
  assert.equal(result.size, 1201); assert.equal(calls.filter((c) => c[0] === "range").length, 3);
});
await test("explicit limits do not fetch all pages", async () => {
  calls = []; assert.equal((await getDocs(query(collection(root, "users"), limit(3)))).size, 3);
  assert.equal(calls.filter((c) => c[0] === "range").length, 1);
});
await test("nested progress IDs remain course IDs in the certificate UI", async () => {
  rows = [{ id: "student_course", student_id: "student", course_id: "course", progress: 40 }];
  const result = await getDocs(collection(root, "users", "student", "enrollments"));
  assert.equal(result.docs[0].id, "course");
  assert.equal(resolveReference(result.docs[0].ref).id, "student_course");
});
await test("missing records stay distinguishable from empty records", async () => {
  rows = []; const result = await getDoc(doc(root, "courses", "missing"));
  assert.equal(result.exists(), false); assert.equal(result.data(), null);
});
await test("writes use the atomic SQL function with canonical columns", async () => {
  rpcCalls = []; await updateDoc(doc(root, "courses", "course"), { thumbnailUrl: "new-url" });
  assert.equal(rpcCalls[0][0], "lms_write_records");
  assert.deepEqual(rpcCalls[0][1].operations[0].values, { thumbnail_url: "new-url" });
});
await test("strict-mode unmount cancels stale callbacks and uses distinct channels", async () => {
  rows = []; let received = 0;
  const first = onSnapshot(collection(root, "courses"), () => received++);
  first();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(received, 0);
  const second = onSnapshot(collection(root, "courses"), () => received++);
  await new Promise((resolve) => setTimeout(resolve, 0));
  second();
  assert.equal(received, 1); assert.notEqual(channels[0].name, channels[1].name);
  assert.ok(channels.every((channel) => channel.removed));
});

await test("payment amount is calculated from server prices", () => {
  assert.equal(payableAmount({ price: 499, discount_price: 0 }), 49900);
  assert.equal(payableAmount({ price: 499, discount_price: 399 }), 39900);
  assert.throws(() => payableAmount({ price: 0 }));
});
await test("payment signatures reject forged or altered input", async () => {
  const signature = createHmac("sha256", "test-secret").update("order_test|pay_test").digest("hex");
  assert.equal(await validSignature("test-secret", "order_test|pay_test", signature), true);
  assert.equal(await validSignature("test-secret", "order_other|pay_test", signature), false);
  assert.equal(await validSignature("test-secret", "order_test|pay_test", "invalid"), false);
});
await test("capture validation checks status, amount, currency, and order", () => {
  const order = { order_id: "order_test", amount: 10000, currency: "INR" };
  assertCapturedPayment({ ...order, status: "captured" }, order);
  for (const change of [{ status: "authorized" }, { amount: 1 }, { currency: "USD" }, { order_id: "other" }]) assert.throws(() => assertCapturedPayment({ ...order, status: "captured", ...change }, order));
});
await test("SQL contains every table used by the repository", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202609200001_lms.sql", import.meta.url), "utf8");
  for (const table of Object.keys(tableColumns)) assert.ok(sql.includes(`create table if not exists public.lms_${table} (`), table);
});
console.log(`${count} client and payment checks passed.`);
