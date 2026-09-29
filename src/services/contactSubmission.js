const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx_cuxwBSk4MHGQASnrfQQ2Jw3Fdw5cGXHYqA96DEUPcBah2tgm-CYFKOKz0RQ152bS/exec";

export async function submitToSheet(payload) {
  const response = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "Submission was rejected");
  return result;
}
