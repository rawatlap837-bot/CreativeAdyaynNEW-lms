import { supabase } from "../lib/supabase";

export async function listCourseCategories() {
  const { data, error } = await supabase
    .from("lms_course_categories")
    .select("id,name,created_by")
    .order("name");
  if (error) throw error;
  return data || [];
}

export async function createCourseCategory(name) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Enter a category name.");
  const { data: existing, error: lookupError } = await supabase.from("lms_course_categories").select("id").ilike("name", cleanName).limit(1);
  if (lookupError) throw lookupError;
  if (existing?.length) return;
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const { error } = await supabase.from("lms_course_categories").insert({ name: cleanName, created_by: user.id });
  if (error?.code === "23505") throw new Error("That category already exists.");
  if (error) throw error;
}

export async function renameCourseCategory(id, name) {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Enter a category name.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const { data: category, error: readError } = await supabase.from("lms_course_categories").select("name").eq("id", id).single();
  if (readError) throw readError;
  const { error: courseError } = await supabase.from("lms_courses").update({ category: cleanName }).eq("instructor_id", user.id).eq("category", category.name);
  if (courseError) throw courseError;
  const { error } = await supabase.from("lms_course_categories").update({ name: cleanName }).eq("id", id);
  if (error?.code === "23505") throw new Error("That category already exists.");
  if (error) throw error;
}

export async function deleteCourseCategory(id, name) {
  const { error } = await supabase.rpc("lms_delete_course_category", { category_id: id });
  if (error?.code === "23503") throw new Error("This category is used by a course and cannot be deleted yet.");
  if (error) throw error;
}
