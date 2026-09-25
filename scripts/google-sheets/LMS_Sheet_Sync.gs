/**
 * Creative Adhyayan LMS -> Google Sheets admin sync.
 *
 * Setup:
 * 1. Create/open a Google Sheet and open Extensions -> Apps Script.
 * 2. Paste this file into Code.gs and save.
 * 3. In Project Settings -> Script Properties add:
 *      SUPABASE_URL = https://YOUR_PROJECT.supabase.co
 *      SUPABASE_SERVICE_ROLE_KEY = your Supabase service_role/secret key
 * 4. Run setupLmsWorkbook() once, approve the Google Sheets/URL Fetch scopes.
 * 5. Run syncLmsData() or use the LMS Sync menu in the spreadsheet.
 *
 * Keep the spreadsheet and Apps Script project restricted to trusted admins.
 * Script editors can read Script Properties. Never put the service key in a
 * cell, a formula, frontend code, or a shared script project.
 */

const LMS_SHEETS = {
  Students: ["Student ID", "Name", "Email", "Phone", "Account status", "Joined at"],
  Teachers: ["Teacher ID", "Name", "Email", "Phone", "Account status", "Joined at"],
  Courses: ["Course ID", "Course title", "Teacher", "Price (INR)", "Course status", "Created at"],
  Enrollments: ["Enrollment ID", "Student", "Student email", "Course", "Enrolled at", "Access status", "Payment status", "Progress (%)", "Completed lessons"],
  "Payments & EMIs": ["Payment ID", "Student", "Student email", "Course", "Amount (INR)", "Currency", "Payment status", "Payment mode", "Installment", "Installments total", "Due at", "Created at", "Order ID", "Gateway payment ID"],
  "EMI Plans": ["Plan ID", "Student", "Student email", "Course", "Total (INR)", "Installment (INR)", "Registration (INR)", "Remaining (INR)", "Installments", "Paid installments", "Next due", "Plan status"],
  Attendance: ["Attendance ID", "Student", "Student email", "Course", "Teacher", "Session date", "Attendance status", "Marked at"],
};

const LMS_PAGE_SIZE = 1000;
const LMS_SPREADSHEET_ID_PROPERTY = "LMS_SPREADSHEET_ID";

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("LMS Sync")
    .addItem("Create / repair tabs", "setupLmsWorkbook")
    .addItem("Sync all tabs (runs in stages)", "syncLmsData")
    .addItem("Test Supabase connection", "testLmsConnection")
    .addSeparator()
    .addItem("Enable daily sync", "enableDailyLmsSync")
    .addItem("Disable daily sync", "disableDailyLmsSync")
    .addToUi();
}

function setupLmsWorkbook() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  rememberLmsSpreadsheet_(spreadsheet);
  Object.keys(LMS_SHEETS).forEach((name) => {
    const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    const headers = LMS_SHEETS[name];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#2e1a55")
      .setFontColor("#ffffff")
      .setFontWeight("bold")
      .setWrap(true);
    setLmsColumnWidths_(sheet, headers.length);
  });
  SpreadsheetApp.getUi().alert("LMS tabs are ready. Now use LMS Sync → Sync all tabs (runs in stages) to load the data.");
}

function syncLmsData() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  rememberLmsSpreadsheet_(spreadsheet);
  startLmsSync_(spreadsheet);
}

function startLmsSync_(spreadsheet) {
  removeSyncTriggers_();
  const queue = Object.keys(LMS_SHEETS);
  PropertiesService.getScriptProperties().setProperty("LMS_SYNC_QUEUE", JSON.stringify(queue));
  spreadsheet.toast("Starting staged LMS sync…", "LMS Sync", 5);
  // Do not do the first large fetch inside the menu invocation. Starting every
  // tab from a time-based trigger gives it a fresh Apps Script execution limit.
  scheduleNextLmsTab_(1000);
}

function scheduledLmsSync() {
  startLmsSync_(getLmsSpreadsheet_());
}

function enableDailyLmsSync() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  rememberLmsSpreadsheet_(spreadsheet);
  getLmsConfig_();
  removeDailySyncTriggers_();
  ScriptApp.newTrigger("scheduledLmsSync")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  SpreadsheetApp.getUi().alert("Daily LMS sync enabled. Google will start it once per day around 2:00 AM in the Apps Script project time zone.");
}

function disableDailyLmsSync() {
  removeDailySyncTriggers_();
  SpreadsheetApp.getUi().alert("Daily LMS sync disabled.");
}

// Runs one tab per Apps Script invocation so the six-minute execution cap
// does not stop a large full-workbook sync before the later tabs are written.
function syncNextLmsTab() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error("A sync is already running. Please wait for it to finish.");

  try {
    const spreadsheet = getLmsSpreadsheet_();
    const config = getLmsConfig_();
    const queue = JSON.parse(PropertiesService.getScriptProperties().getProperty("LMS_SYNC_QUEUE") || "[]");
    if (!queue.length) {
      spreadsheet.toast("No pending sync tabs.", "LMS Sync", 5);
      return;
    }

    const sheetName = queue[0];
    syncLmsSheet_(spreadsheet, config, sheetName);
    queue.shift();

    if (queue.length) {
      PropertiesService.getScriptProperties().setProperty("LMS_SYNC_QUEUE", JSON.stringify(queue));
      scheduleNextLmsTab_(60 * 1000);
      spreadsheet.toast(`${sheetName} synced. Next tab will sync automatically. ${queue.length} remaining.`, "LMS Sync", 8);
    } else {
      PropertiesService.getScriptProperties().deleteProperty("LMS_SYNC_QUEUE");
      spreadsheet.toast("All LMS tabs synced successfully.", "LMS Sync", 8);
    }
  } catch (error) {
    console.error(error);
    const spreadsheet = getLmsSpreadsheet_();
    spreadsheet.toast(`Sync stopped: ${error.message || error}`, "LMS Sync error", 10);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function testLmsConnection() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  rememberLmsSpreadsheet_(spreadsheet);
  const config = getLmsConfig_();
  const sample = fetchLmsRows_(config, "lms_profiles", "id", 1);
  SpreadsheetApp.getUi().alert(`Supabase connection works. Profile query returned ${sample.length} sample row(s). You can start the staged sync now.`);
}

function syncLmsSheet_(spreadsheet, config, sheetName) {
  const profiles = () => fetchLmsRows_(config, "lms_profiles", "id,name,email,phone,role,status,created_at");
  const courses = () => fetchLmsRows_(config, "lms_courses", "id,title,instructor_id,instructor_name,price,currency,status,created_at");

  if (sheetName === "Students" || sheetName === "Teachers") {
    const role = sheetName === "Students" ? "student" : "teacher";
    const rows = profiles().filter((row) => row.role === role).map((row) => [row.id, row.name, row.email, row.phone, row.status, row.created_at]);
    writeLmsSheet_(spreadsheet, sheetName, rows);
    return;
  }

  const profileRows = profiles();
  const profileById = indexBy_(profileRows, "id");
  const courseRows = courses();
  const courseById = indexBy_(courseRows, "id");
  const teacherName = (course) => {
    const teacher = profileById[course.instructor_id];
    return teacher?.name || course.instructor_name || teacher?.email || "";
  };

  if (sheetName === "Courses") {
    writeLmsSheet_(spreadsheet, sheetName, courseRows.map((row) => [row.id, row.title, teacherName(row), Number(row.price || 0), row.status, row.created_at]));
    return;
  }

  if (sheetName === "Enrollments") {
    const rows = fetchLmsRows_(config, "lms_enrollments", "id,student_id,course_id,status,payment_status,progress,completed_lessons,enrolled_at,created_at").map((row) => {
      const student = profileById[row.student_id] || {};
      const course = courseById[row.course_id] || {};
      const completed = Array.isArray(row.completed_lessons) ? row.completed_lessons.length : 0;
      return [row.id, student.name || "", student.email || "", course.title || "", row.enrolled_at || row.created_at, row.status, row.payment_status, Number(row.progress || 0), completed];
    });
    writeLmsSheet_(spreadsheet, sheetName, rows);
    return;
  }

  if (sheetName === "Payments & EMIs") {
    const rows = fetchLmsRows_(config, "lms_payments", "id,student_id,course_id,order_id,payment_id,amount,currency,status,payment_mode,installment_number,installment_count,due_at,created_at,metadata").map((row) => {
      const student = profileById[row.student_id] || {};
      const course = courseById[row.course_id] || {};
      const isOffline = row.metadata?.paymentMethod === "offline";
      const amountInRupees = Number(row.amount || 0) / (isOffline ? 1 : 100);
      return [row.id, student.name || "", student.email || "", course.title || "", amountInRupees, row.currency, row.status, row.payment_mode || row.metadata?.paymentMethod || "one_time", row.installment_number || "", row.installment_count || "", row.due_at || "", row.created_at, row.order_id, row.payment_id];
    });
    writeLmsSheet_(spreadsheet, sheetName, rows);
    return;
  }

  if (sheetName === "EMI Plans") {
    const rows = fetchLmsRows_(config, "lms_installment_plans", "id,student_id,course_id,total_amount,installment_amount,registration_amount,remaining_amount,installment_count,paid_installments,next_due_at,status").map((row) => {
      const student = profileById[row.student_id] || {};
      const course = courseById[row.course_id] || {};
      return [row.id, student.name || "", student.email || "", course.title || "", Number(row.total_amount || 0) / 100, Number(row.installment_amount || 0) / 100, Number(row.registration_amount || 0) / 100, Number(row.remaining_amount || 0) / 100, row.installment_count, row.paid_installments, row.next_due_at || "", row.status];
    });
    writeLmsSheet_(spreadsheet, sheetName, rows);
    return;
  }

  if (sheetName === "Attendance") {
    const rows = fetchLmsRows_(config, "lms_attendance_records", "id,student_id,course_id,teacher_id,date,status,marked_at,created_at").map((row) => {
      const student = profileById[row.student_id] || {};
      const course = courseById[row.course_id] || {};
      const teacher = profileById[row.teacher_id] || {};
      return [row.id, student.name || "", student.email || "", course.title || "", teacher.name || teacher.email || teacherName(course), row.date || "", row.status, row.marked_at || row.created_at];
    });
    writeLmsSheet_(spreadsheet, sheetName, rows);
    return;
  }

  throw new Error(`Unknown LMS sheet: ${sheetName}`);
}

function removeSyncTriggers_() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "syncNextLmsTab") ScriptApp.deleteTrigger(trigger);
  });
}

function removeDailySyncTriggers_() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "scheduledLmsSync") ScriptApp.deleteTrigger(trigger);
  });
}

function scheduleNextLmsTab_(delayMs) {
  ScriptApp.newTrigger("syncNextLmsTab").timeBased().after(delayMs).create();
}

function rememberLmsSpreadsheet_(spreadsheet) {
  if (!spreadsheet) throw new Error("Open the bound Google Sheet before starting the sync.");
  PropertiesService.getScriptProperties().setProperty(LMS_SPREADSHEET_ID_PROPERTY, spreadsheet.getId());
}

function getLmsSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(LMS_SPREADSHEET_ID_PROPERTY);
  if (!id) throw new Error("Spreadsheet ID is missing. Run setupLmsWorkbook once from the Google Sheet.");
  return SpreadsheetApp.openById(id);
}

function getLmsConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const url = (properties.getProperty("SUPABASE_URL") || "").replace(/\/$/, "");
  const key = properties.getProperty("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Apps Script Project Settings → Script Properties.");
  }
  if (!/^https:\/\//i.test(url)) throw new Error("SUPABASE_URL must use HTTPS.");
  if (/^sb_publishable_/i.test(key)) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is using a publishable key. Add the secret/service-role key in Script Properties; publishable keys cannot read all LMS admin data.");
  }
  return { url, key };
}

function fetchLmsRows_(config, table, columns, rowLimit) {
  const rows = [];
  for (let offset = 0; ; offset += LMS_PAGE_SIZE) {
    const pageSize = rowLimit ? Math.min(LMS_PAGE_SIZE, rowLimit - rows.length) : LMS_PAGE_SIZE;
    if (pageSize <= 0) break;
    const params = `select=${encodeURIComponent(columns)}&order=created_at.asc`;
    const response = UrlFetchApp.fetch(`${config.url}/rest/v1/${table}?${params}`, {
      method: "get",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Range-Unit": "items",
        Range: `${offset}-${offset + pageSize - 1}`,
      },
      muteHttpExceptions: true,
    });
    const status = response.getResponseCode();
    const body = response.getContentText();
    if (status < 200 || status >= 300) {
      throw new Error(`Supabase ${table} request failed (${status}): ${body.slice(0, 500)}`);
    }
    const batch = JSON.parse(body || "[]");
    rows.push(...batch);
    if (batch.length < pageSize || (rowLimit && rows.length >= rowLimit)) break;
  }
  return rows;
}

function indexBy_(rows, key) {
  return rows.reduce((index, row) => {
    index[row[key]] = row;
    return index;
  }, {});
}

function writeLmsSheet_(spreadsheet, name, values) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const headers = LMS_SHEETS[name];
  const safeRows = values.map((row) => row.map(safeSheetCell_));
  const existingRows = sheet.getLastRow();
  if (existingRows > 1) sheet.getRange(2, 1, existingRows - 1, Math.max(sheet.getLastColumn(), headers.length)).clearContent();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (safeRows.length) sheet.getRange(2, 1, safeRows.length, headers.length).setValues(safeRows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBackground("#2e1a55").setFontColor("#ffffff").setFontWeight("bold").setWrap(true);
  setLmsColumnWidths_(sheet, headers.length);
}

function setLmsColumnWidths_(sheet, columnCount) {
  // Fixed widths are predictable and much faster than autoResizeColumns on a
  // large tab, where Apps Script may scan enough cells to hit its time limit.
  sheet.setColumnWidths(1, columnCount, 140);
  sheet.setColumnWidth(1, 220);
}

function safeSheetCell_(value) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return value;
  // Prevent names/content beginning with formula characters from executing
  // when written into spreadsheet cells.
  return /^[=+@\-]/.test(value) ? `'${value}` : value;
}
