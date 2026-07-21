/* OfficePal API wrapper — thin fetch helper around the PHP backend. */

const API_BASE = "api";

async function apiGet(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${path}${query ? "?" + query : ""}`;
  const res = await fetch(url, { credentials: "same-origin" });
  return parseApiResponse(res);
}

async function apiPost(path, body = {}) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(res);
}

/**
 * Like apiPost, but for a raw FormData body (file uploads) instead of JSON —
 * the browser sets its own multipart Content-Type header with the correct
 * boundary, so we must not set one ourselves.
 */
async function apiUpload(path, formData) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });
  return parseApiResponse(res);
}

async function parseApiResponse(res) {
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw { ok: false, error: "bad_response", message: "Unexpected server response." };
  }
  if (!data.ok) {
    throw data;
  }
  return data;
}
