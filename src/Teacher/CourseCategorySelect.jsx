import { useEffect, useState } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { deleteCourseCategory, listCourseCategories, renameCourseCategory } from "../services/CourseCategoryService";

export const NEW_CATEGORY_VALUE = "__create_new_category__";

export default function CourseCategorySelect({ value = "", allowCreate = false, onCategoryRenamed, ...props }) {
  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const reload = () => listCourseCategories().then((items) => { setCategories(items); setError(""); }).catch((err) => setError(`Could not load categories: ${err.message}`));
  useEffect(() => { reload(); }, []);

  async function saveRename(category) {
    try {
      setError("");
      const previousName = category.name;
      await renameCourseCategory(category.id, editName);
      setEditingId(null);
      await reload();
      onCategoryRenamed?.(previousName, editName.trim());
    } catch (err) { setError(err.message); }
  }

  async function removeCategory(category) {
    if (!window.confirm(`Delete "${category.name}"? It can only be deleted when none of your courses use it.`)) return;
    try {
      setError("");
      await deleteCourseCategory(category.id);
      await reload();
    } catch (err) { setError(err.message); }
  }

  // Keep legacy values selectable until their courses are recategorized.
  const options = [...categories.map((item) => item.name)];
  if (value && !options.includes(value) && value !== NEW_CATEGORY_VALUE) options.unshift(value);
  return (
    <div>
      <select {...props} value={value} aria-label="Category">
        <option value="" disabled>Select a category</option>
        {options.map((category) => <option key={category} value={category}>{category}</option>)}
        {allowCreate && <option value={NEW_CATEGORY_VALUE}>+ Create new category...</option>}
      </select>
      <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-700">Manage categories ({categories.length})</summary>
          <ul className="mt-1 max-h-44 divide-y divide-slate-100 overflow-y-auto">
            {categories.map((category) => (
              <li key={category.id} className="flex min-h-8 items-center gap-2 py-1">
                {editingId === category.id ? <input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" aria-label="Rename category" /> : <span className="min-w-0 flex-1 truncate text-xs">{category.name}{!category.created_by && <span className="ml-2 text-[10px] text-slate-400">Preset</span>}</span>}
                {category.created_by && editingId === category.id ? <>
                  <button type="button" onClick={() => saveRename(category)} className="rounded p-1 text-green-700" aria-label="Save category name"><Check size={16}/></button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded p-1 text-slate-500" aria-label="Cancel rename"><X size={16}/></button>
                </> : <>
                  {category.created_by && <button type="button" onClick={() => { setEditingId(category.id); setEditName(category.name); }} className="rounded p-1 text-slate-500 hover:text-violet-700" aria-label={`Edit ${category.name}`}><Pencil size={15}/></button>}
                  <button type="button" onClick={() => removeCategory(category)} className="rounded p-1 text-slate-500 hover:text-red-600" aria-label={`Delete ${category.name}`}><Trash2 size={15}/></button>
                </>}
              </li>
            ))}
          </ul>
          {categories.length === 0 && !error && <p className="mt-2 text-sm text-slate-500">No categories found.</p>}
          {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
      </details>
    </div>
  );
}
