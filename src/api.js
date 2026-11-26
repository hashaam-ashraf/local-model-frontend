// Talking to the api, and who is logged in.

const API = "/api/v1";

export const session = { token: sessionStorage.getItem("token"), user: null };
export const isAdmin = () => session.user?.role === "admin";

export function logIn(token) {
  sessionStorage.setItem("token", token);
  location.reload();
}

// Reloading drops everything the previous user loaded.
export function logOut(notice = "") {
  sessionStorage.removeItem("token");
  if (notice) sessionStorage.setItem("notice", notice);
  location.reload();
}

export async function request(path, { json, ...options } = {}) {
  const headers = { ...options.headers };
  if (session.token) headers.Authorization = `Bearer ${session.token}`;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(json);
  }
  let res;
  try {
    res = await fetch(API + path, { ...options, headers });
  } catch {
    throw new Error("The frontend server is not reachable.");
  }
  if (res.status === 401 && session.user) logOut("Your login has expired. Log in again.");
  if (!res.ok) throw await describe(res);
  return res;
}

export const getJson = async (path) => (await request(path)).json();

async function describe(res) {
  let detail = "";
  try {
    const body = await res.clone().json();
    if (typeof body.detail === "string") detail = body.detail;
    // A rejected field comes back as a list, one entry per field.
    else if (Array.isArray(body.detail)) detail = body.detail.map((d) => `${d.loc.at(-1)}: ${d.msg}`).join("; ");
  } catch {}
  const error = new Error(detail || fallback(res.status));
  error.status = res.status;
  return error;
}

function fallback(status) {
  if (status === 401) return "Log in to continue.";
  if (status === 403) return "Only an admin can do this.";
  if (status === 502 || status === 504) return "The api is not reachable. Is the local-model stack running?";
  if (status === 500) return "The api failed (500). Check that the model server is running and the models are pulled.";
  return `Request failed (${status}).`;
}
