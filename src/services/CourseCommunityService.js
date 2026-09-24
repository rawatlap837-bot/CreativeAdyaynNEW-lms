import { supabase } from "../lib/supabase";
import { auth } from "../lib/backend";

const WHATSAPP_URL = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/;

export function validateWhatsAppInvite(value) {
  const url = String(value || "").trim();
  return !url || WHATSAPP_URL.test(url);
}

function requireUser() {
  if (!auth.currentUser) throw new Error("Sign in to continue.");
}

export async function getCourseCommunity(courseId) {
  requireUser();
  const { data, error } = await supabase
    .from("lms_course_community")
    .select("course_id,whatsapp_url,live_class_url,group_rules,updated_by,updated_at")
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getStudentCourseCommunity(courseId) {
  requireUser();
  const { data, error } = await supabase
    .from("lms_course_community")
    .select("whatsapp_url,live_class_url,group_rules")
    .eq("course_id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveCourseCommunity(courseId, values) {
  requireUser();
  const whatsappUrl = String(values.whatsappUrl || "").trim();
  if (!validateWhatsAppInvite(whatsappUrl)) {
    throw new Error("Enter a valid link starting with https://chat.whatsapp.com/.");
  }
  const payload = {
    course_id: courseId,
    whatsapp_url: whatsappUrl || null,
    live_class_url: String(values.liveClassUrl || "").trim() || null,
    group_rules: String(values.groupRules || "").trim(),
    updated_by: auth.currentUser.uid,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("lms_course_community")
    .upsert(payload, { onConflict: "course_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeCourseCommunity(courseId) {
  requireUser();
  const { error } = await supabase
    .from("lms_course_community")
    .delete()
    .eq("course_id", courseId);
  if (error) throw error;
}

export async function getCommunityJoinClickCount(courseId) {
  requireUser();
  const { data, error } = await supabase.rpc("lms_course_community_click_count", { cid: courseId });
  if (error) throw error;
  return Number(data || 0);
}

export async function openCourseWhatsAppGroup(courseId) {
  requireUser();
  const { data, error } = await supabase.rpc("lms_join_course_community", { cid: courseId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : data || null;
}
