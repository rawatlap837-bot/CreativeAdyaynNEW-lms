// Central place to call your backend once it exists.
// Example pattern:
//
// const BASE_URL = import.meta.env.VITE_API_URL
//
// export async function getCourses() {
//   const res = await fetch(`${BASE_URL}/courses`)
//   return res.json()
// }

export const BASE_URL = import.meta.env.VITE_API_URL || ''
