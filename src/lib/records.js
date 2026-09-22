// Schema mapping shared by repository queries, mutations, and UI normalization.
// SQL lives in supabase/migrations/202609200001_lms.sql.
export const tableColumns = {
  profiles: "name email role status avatar_url phone role_changed_at",
  courses: "title slug description short_description category level duration type instructor_id instructor_name thumbnail_url thumbnail_path banner_url banner_path preview_video_url preview_video_path price discount_price currency status featured course_order published_at rejection_reason student_count enrollment_count",
  modules: "course_id title description sort_order",
  lessons: "course_id module_id title description type sort_order published is_preview video_url video_path resource_url resource_path thumbnail_url thumbnail_path duration",
  enrollments: "student_id course_id status payment_status payment_id progress completed_lessons last_lesson_id enrolled_at last_accessed_at",
  payments: "student_id course_id order_id payment_id amount currency status",
  batches: "course_id teacher_id name mode status schedule student_ids student_count",
  attendance_sessions: "course_id teacher_id title date status",
  attendance_records: "session_id student_id course_id teacher_id date status marked_at",
  batch_attendance: "batch_id teacher_id date records marked_at",
  assignments: "course_id teacher_id title description status target_batch_id due_date published_at",
  assignment_submissions: "assignment_id student_id course_id status submitted_at grade feedback graded_at graded_by",
  announcements: "course_id author_id title body audience_type status pinned published_at",
  discussions: "course_id author_id title body status",
  discussion_replies: "discussion_id author_id body",
  notifications: "recipient_id course_id title message type read action_url",
  certificates: "student_id course_id enrollment_id certificate_id course_name student_name issue_date",
  tasks: "student_id title date completed",
  schedule_events: "student_id course_id title date",
  live_classes: "student_id course_id title start_time",
};

const aliases = {
  users: "profiles", students: "profiles", instructors: "profiles", attendanceSessions: "attendance_sessions",
  attendance: "attendance_records", scheduleEvents: "schedule_events", liveClasses: "live_classes",
};
export const tableName = (name) => aliases[name] || name;
export const snake = (value) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
export const camel = (value) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
export function columnName(table, field) {
  if (field === "__name__") return "id";
  if (field === "uid") return table === "profiles" ? "id" : table === "notifications" ? "recipient_id" : "student_id";
  if (field === "order") return table === "courses" ? "course_order" : "sort_order";
  if (field === "photoURL") return "avatar_url";
  if (field === "displayName" && table === "profiles") return "name";
  if (field === "audience" && table === "announcements") return "audience_type";
  return snake(field);
}
export function hasColumn(table, column) {
  return ["id", "created_at", "updated_at", ...tableColumns[table]?.split(" ") || []].includes(column);
}

export class Timestamp {
  constructor(value) { this.value = new Date(value); this.seconds = this.value.getTime() / 1000; }
  static now() { return new Timestamp(Date.now()); }
  static fromDate(date) { return new Timestamp(date); }
  toDate() { return new Date(this.value); }
  toMillis() { return this.value.getTime(); }
  toJSON() { return this.value.toISOString(); }
  valueOf() { return this.value.getTime(); }
}
export function toRow(table, value) {
  const result = {};
  for (const [key, input] of Object.entries(value || {})) {
    if (input === undefined || key === "id") continue;
    const column = columnName(table, key);
    let normalized = input instanceof Date || input instanceof Timestamp ? input.toJSON() : input;
    if (normalized === "" && (column.endsWith("_at") || column.endsWith("_date") || ["target_batch_id", "graded_by"].includes(column))) normalized = null;
    if (hasColumn(table, column)) result[column] = normalized;
    else (result.metadata ||= {})[key] = normalized;
  }
  return result;
}
export function fromRow(table, row) {
  if (!row) return null;
  const result = { ...row.metadata, ...row };
  delete result.metadata;
  for (const [column, value] of Object.entries(row)) {
    if (column === "metadata") continue;
    result[camel(column)] = value;
    if (value && (/(_at|_date|_time)$/.test(column) || (column === "date" && String(value).includes("T"))) && !Number.isNaN(Date.parse(value))) {
      result[camel(column)] = new Timestamp(value);
    }
  }
  if (row.student_id) result.uid = row.student_id;
  if (row.recipient_id) result.uid = row.recipient_id;
  if (table === "profiles") {
    result.uid = row.id;
    result.displayName = row.name;
    result.photoURL = row.avatar_url;
  }
  if (table === "announcements") result.audience = row.audience_type;
  if (row.sort_order !== undefined) result.order = row.sort_order;
  if (row.course_order !== undefined) result.order = row.course_order;
  if (table === "courses" && !(Number(row.discount_price) > 0 && Number(row.discount_price) < Number(row.price))) result.discountPrice = null;
  return result;
}
