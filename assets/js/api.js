/* OfficePal API wrapper — thin fetch helper around the PHP backend. */

const API_BASE = "api";

// Requests can legitimately overlap (e.g. a dashboard firing two apiGet()
// calls in a Promise.all), so this is an in-flight counter rather than a
// boolean — the blocking overlay only comes down once every outstanding
// request has settled, not just the first one to finish.
let activeRequestCount = 0;

/**
 * Shows (or keeps showing) the full-screen loading overlay the moment any
 * API call starts. The overlay sits above every other element (including
 * open modals) and intercepts all clicks, so there's no way to trigger a
 * second action while the app is still waiting on the server for the first
 * one — the user gets an unmistakable "please wait" signal instead of
 * wondering whether their click registered.
 */
function beginLoading() {
  activeRequestCount++;
  if (activeRequestCount === 1) {
    const overlay = document.getElementById("global-loading-overlay");
    if (overlay) overlay.classList.remove("hidden");
  }
}

/** Hides the overlay once the last in-flight request has settled (success or failure). */
function endLoading() {
  activeRequestCount = Math.max(0, activeRequestCount - 1);
  if (activeRequestCount === 0) {
    const overlay = document.getElementById("global-loading-overlay");
    if (overlay) overlay.classList.add("hidden");
  }
}

async function apiGet(path, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${API_BASE}/${path}${query ? "?" + query : ""}`;
  beginLoading();
  try {
    const res = await fetch(url, { credentials: "same-origin" });
    return await parseApiResponse(res);
  } finally {
    endLoading();
  }
}

async function apiPost(path, body = {}) {
  beginLoading();
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await parseApiResponse(res);
  } finally {
    endLoading();
  }
}

/**
 * Like apiPost, but for a raw FormData body (file uploads) instead of JSON —
 * the browser sets its own multipart Content-Type header with the correct
 * boundary, so we must not set one ourselves.
 */
async function apiUpload(path, formData) {
  beginLoading();
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: "POST",
      credentials: "same-origin",
      body: formData,
    });
    return await parseApiResponse(res);
  } finally {
    endLoading();
  }
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
