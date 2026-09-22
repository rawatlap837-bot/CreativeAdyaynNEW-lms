const CATEGORIES = [
  "Digital Marketing", "Web Development", "App Development",
  "Graphic Design", "UI/UX Design", "Video Editing", "Animation",
  "Artificial Intelligence", "Data Science", "Programming",
  "Cybersecurity", "Cloud Computing", "Business & Entrepreneurship",
  "Finance & Accounting", "Photography", "Content Writing",
  "Communication Skills", "Personal Development", "Other",
];

export default function CourseCategorySelect({ value = "", ...props }) {
  // Retain existing course categories when editing older records.
  const options = value && !CATEGORIES.includes(value)
    ? [value, ...CATEGORIES]
    : CATEGORIES;
  return (
    <select {...props} value={value} aria-label="Category">
      <option value="" disabled>Select a category</option>
      {options.map((category) => (
        <option key={category} value={category}>{category}</option>
      ))}
    </select>
  );
}
