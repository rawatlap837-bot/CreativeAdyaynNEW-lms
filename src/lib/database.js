import { supabase } from "./supabase";
import { tableName, tableColumns, columnName, hasColumn, toRow, fromRow, Timestamp } from "./records";
import { refreshMediaUrls } from "./storage";
export { Timestamp } from "./records";

// A document-shaped UI repository backed entirely by relational Supabase tables.
// Nested UI references become foreign-key filters, never separate databases.
export const collection = (parent, ...segments) => ({ path: [...(parent.path || []), ...segments], kind: "collection" });
export function doc(parent, ...segments) {
  const path = [...(parent.path || []), ...segments];
  if (path.length % 2) path.push(crypto.randomUUID());
  return { path, kind: "doc", id: path.at(-1) };
}
export const where = (field, op, value) => ({ type: "where", field, op, value });
export const orderBy = (field, direction = "asc") => ({ type: "order", field, direction });
export const limit = (count) => ({ type: "limit", count });
export const query = (reference, ...constraints) => ({ ...reference, constraints: [...reference.constraints || [], ...constraints] });
export const serverTimestamp = () => new Date().toISOString();
export const arrayUnion = (...values) => ({ __op: "union", values });
export const arrayRemove = (...values) => ({ __op: "remove", values });

export function resolveReference(reference) {
  const p = reference.path;
  let table = tableName(p[0]);
  const filters = [];
  let id = reference.kind === "doc" ? p.at(-1) : null;
  if (p[0] === "courses" && p.length >= 3) {
    table = p.length >= 5 ? "lessons" : "modules";
    filters.push(["course_id", p[1]]);
    if (p.length >= 5) filters.push(["module_id", p[3]]);
  } else if (p[0] === "assignments" && p.length >= 3) {
    table = "assignment_submissions";
    filters.push(["assignment_id", p[1]]);
    if (id) id = `${p[1]}_${id}`;
  } else if (p[0] === "discussions" && p.length >= 3) {
    table = "discussion_replies";
    filters.push(["discussion_id", p[1]]);
  } else if (p[0] === "users" && p[2] === "enrollments") {
    table = "enrollments";
    filters.push(["student_id", p[1]]);
    if (id) id = `${p[1]}_${id}`;
  }
  if (!tableColumns[table]) throw new Error(`Unsupported data table: ${table}`);
  if (p[0] === "students") filters.push(["role", "student"]);
  if (p[0] === "instructors") filters.push(["role", "teacher"]);
  return { table, id, filters };
}

function requestFor(reference) {
  const { table, id, filters } = resolveReference(reference);
  let request = supabase.from(`lms_${table}`).select("*");
  if (id) request = request.eq("id", id);
  for (const [field, value] of filters) request = request.eq(field, value);
  for (const constraint of reference.constraints || []) {
    const column = columnName(table, constraint.field || "");
    const field = hasColumn(table, column) ? column : `metadata->>${constraint.field}`;
    const value = constraint.value instanceof Timestamp ? constraint.value.toJSON() : constraint.value;
    if (constraint.type === "order") request = request.order(field, { ascending: constraint.direction !== "desc", nullsFirst: false });
    else if (constraint.type === "limit") request = request.limit(constraint.count);
    else {
      const methods = { "==": "eq", "!=": "neq", ">": "gt", ">=": "gte", "<": "lt", "<=": "lte", in: "in", "array-contains": "contains", "array-contains-any": "overlaps" };
      const method = methods[constraint.op];
      if (!method) throw new Error(`Unsupported query operator: ${constraint.op}`);
      request = value === null && constraint.op === "==" ? request.is(field, null)
        : request[method](field, constraint.op === "array-contains" ? [value] : value);
    }
  }
  return request;
}

function documentSnapshot(reference, row) {
  const { table } = resolveReference(reference);
  return { id: reference.id, ref: reference, exists: () => Boolean(row), data: () => fromRow(table, row), version: row?.updated_at ?? null };
}
export async function getDoc(reference) {
  const { data, error } = await requestFor(reference).maybeSingle();
  if (error) throw error;
  return documentSnapshot(reference, await refreshMediaUrls(data));
}
export async function getDocs(reference) {
  // Paginate to avoid silently truncating rosters at PostgREST's row limit.
  const rows = [];
  const requestedLimit = reference.constraints?.find((c) => c.type === "limit")?.count;
  for (let offset = 0; ; offset += 500) {
    const count = Math.min(500, (requestedLimit ?? Infinity) - offset);
    if (count <= 0) break;
    const { data, error } = await requestFor(reference).order("id").range(offset, offset + count - 1);
    if (error) throw error;
    rows.push(...await refreshMediaUrls(data));
    if (data.length < count) break;
  }
  const { table } = resolveReference(reference);
  const docs = rows.map((row) => documentSnapshot(doc(reference,
    table === "assignment_submissions" ? row.student_id : reference.path[0] === "users" && reference.path[2] === "enrollments" ? row.course_id : row.id), row));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}

// Subscribe before fetching and refetch after connection/reconnection. Unique
// names and a disposal guard make this safe under React StrictMode.
export function onSnapshot(reference, callback, onError = console.error) {
  let active = true;
  let running = false;
  let dirty = false;
  const { table } = resolveReference(reference);
  async function refresh() {
    dirty = true;
    if (running) return;
    running = true;
    while (active && dirty) {
      dirty = false;
      try {
        const snapshot = await (reference.kind === "doc" ? getDoc(reference) : getDocs(reference));
        if (active) await callback(snapshot);
      } catch (error) { if (active) onError(error); }
    }
    running = false;
  }
  const channel = supabase.channel(`lms-${table}-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: `lms_${table}` }, refresh)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") refresh();
      if (status === "CHANNEL_ERROR") onError(new Error("Live updates disconnected. Reconnecting…"));
    });
  refresh();
  // Refetch even if the deployment has not yet enabled Realtime replication.
  const timer = setInterval(refresh, 30000);
  return () => { active = false; clearInterval(timer); supabase.removeChannel(channel); };
}

function operation(kind, reference, values = {}) {
  const { table, id, filters } = resolveReference(reference);
  return { kind, table, id, values: { ...toRow(table, values), ...Object.fromEntries(filters.filter(([key]) => key !== "role")) } };
}
async function commit(operations, reads = []) {
  const { data, error } = await supabase.rpc("lms_write_records", { operations, reads });
  if (error) throw error;
  return data;
}
export const setDoc = (reference, values) => commit([operation("set", reference, values)]);
export const updateDoc = (reference, values) => commit([operation("update", reference, values)]);
export const deleteDoc = (reference) => commit([operation("delete", reference)]);
export async function addDoc(reference, values) {
  const created = doc(reference);
  await commit([operation("insert", created, values)]);
  return created;
}
export function writeBatch() {
  const operations = [];
  return {
    set: (ref, values) => operations.push(operation("set", ref, values)),
    update: (ref, values) => operations.push(operation("update", ref, values)),
    delete: (ref) => operations.push(operation("delete", ref)),
    commit: () => commit(operations),
  };
}
export async function runTransaction(_db, callback) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const operations = [], reads = [];
    const result = await callback({
      get: async (reference) => {
        const snapshot = await getDoc(reference);
        const { table, id } = resolveReference(reference);
        reads.push({ table, id, version: snapshot.version });
        return snapshot;
      },
      update: (reference, values) => operations.push(operation("update", reference, values)),
    });
    try { await commit(operations, reads); return result; }
    catch (error) { if (error.code !== "40001" || attempt === 3) throw error; }
  }
}
