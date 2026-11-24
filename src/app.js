const API = "/api/v1";
const PAGE_SIZE = 50;

const $ = (id) => document.getElementById(id);
const projectSelect = $("project");
const tokenInput = $("token");
const apiStatus = $("api-status");
const kbMessage = $("kb-message");
const fileList = $("files");
const drop = $("drop");
const picker = $("picker");
const reindexButton = $("reindex");
const pager = $("pager");
const prevButton = $("prev");
const nextButton = $("next");
const modelSelect = $("model");
const log = $("log");
const questionInput = $("question");
const sendButton = $("send");

let project = null;
let filesPage = 1;
let projects = [];
let messages = [];

// --- api ---

async function request(path, options = {}, admin = false) {
  const headers = { ...options.headers };
  if (admin) headers.Authorization = `Bearer ${tokenInput.value.trim()}`;
  let res;
  try {
    res = await fetch(API + path, { ...options, headers });
  } catch {
    throw new Error("The frontend server is not reachable.");
  }
  if (!res.ok) throw await describe(res);
  return res;
}

async function describe(res) {
  let detail = "";
  try {
    const body = await res.clone().json();
    detail = typeof body.detail === "string" ? body.detail : "";
  } catch {}
  const error = new Error(detail || fallback(res.status));
  error.status = res.status;
  return error;
}

function fallback(status) {
  if (status === 401) return "Admin token required.";
  if (status === 502 || status === 504) return "The api is not reachable. Is the local-model stack running?";
  if (status === 500) return "The api failed (500). Check that the model server is running and the models are pulled.";
  return `Request failed (${status}).`;
}

// --- projects ---

async function loadProjects() {
  try {
    const list = (projects = await (await request("/projects")).json());
    apiStatus.textContent = list.length ? "api connected" : "api connected, no projects configured";
    apiStatus.className = "status";
    const wanted = new URLSearchParams(location.search).get("project");
    projectSelect.replaceChildren(...list.map((p) => new Option(p.name, p.slug)));
    if (list.some((p) => p.slug === wanted)) projectSelect.value = wanted;
    selectProject();
  } catch (err) {
    apiStatus.textContent = err.message;
    apiStatus.className = "status error";
  }
}

function selectProject() {
  project = projectSelect.value || null;
  const models = projects.find((p) => p.slug === project)?.models || [];
  modelSelect.replaceChildren(...models.map((name) => new Option(name)));
  $("model-label").hidden = models.length < 2;
  newChat();
  filesPage = 1;
  loadFiles();
}

// --- knowledge base ---

function say(text, kind = "") {
  kbMessage.textContent = text;
  kbMessage.className = "message " + kind;
  kbMessage.hidden = !text;
}

function setKbEnabled(enabled) {
  picker.disabled = !enabled;
  reindexButton.disabled = !enabled;
  drop.style.opacity = enabled ? "" : "0.5";
}

function formatSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

async function loadFiles(keepMessage = false) {
  fileList.replaceChildren();
  pager.hidden = true;
  if (!project) return setKbEnabled(false);
  if (!tokenInput.value.trim()) {
    setKbEnabled(false);
    return say("Enter the admin token to manage the knowledge base.");
  }
  try {
    const query = `page=${filesPage}&page_size=${PAGE_SIZE}`;
    const { total, files } = await (await request(`/${project}/files?${query}`, {}, true)).json();
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (filesPage > lastPage) {
      // The last page emptied, for example after deleting its only file.
      filesPage = lastPage;
      return loadFiles(keepMessage);
    }
    setKbEnabled(true);
    if (!keepMessage) say(total ? "" : "No pages yet. Upload one to start.");
    fileList.replaceChildren(...files.map(fileRow));
    const first = (filesPage - 1) * PAGE_SIZE + 1;
    $("page-info").textContent = `${first}–${first + files.length - 1} of ${total}`;
    prevButton.disabled = filesPage === 1;
    nextButton.disabled = filesPage === lastPage;
    pager.hidden = total <= PAGE_SIZE;
  } catch (err) {
    setKbEnabled(false);
    say(err.message, "error");
  }
}

function fileRow(file) {
  const li = document.createElement("li");
  const path = document.createElement("span");
  path.className = "path";
  path.textContent = file.path;
  const size = document.createElement("span");
  size.className = "size";
  size.textContent = formatSize(file.size);
  const remove = document.createElement("button");
  remove.className = "danger";
  remove.type = "button";
  remove.textContent = "Delete";
  remove.addEventListener("click", () => deleteFile(file.path, remove));
  li.append(path, size, remove);
  return li;
}

async function uploadFiles(files) {
  if (!files.length || picker.disabled) return;
  const body = new FormData();
  for (const file of files) body.append("files", file);
  say(`Uploading and indexing ${files.length} file(s)…`);
  setKbEnabled(false);
  try {
    const result = await (await request(`/${project}/files`, { method: "POST", body }, true)).json();
    const names = result.files.length > 5 ? `${result.files.length} files` : result.files.join(", ");
    say(`Uploaded ${names}: ${result.sections} section(s) indexed.`, "ok");
  } catch (err) {
    say(err.message, "error");
  }
  picker.value = "";
  loadFiles(true);
}

async function deleteFile(path, button) {
  if (!confirm(`Delete ${path} from the knowledge base?`)) return;
  button.disabled = true;
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  try {
    await request(`/${project}/files/${encoded}`, { method: "DELETE" }, true);
    say(`Deleted ${path}.`, "ok");
  } catch (err) {
    say(err.message, "error");
  }
  loadFiles(true);
}

async function reindex() {
  say("Re-indexing…");
  reindexButton.disabled = true;
  try {
    const result = await (await request(`/${project}/index`, { method: "POST" }, true)).json();
    say(`The index now has ${result.sections} section(s).`, "ok");
  } catch (err) {
    say(err.message, "error");
  }
  loadFiles(true);
}

// --- chat ---

function bubble(role, text) {
  const el = document.createElement("div");
  el.className = "msg " + role;
  el.textContent = text;
  log.appendChild(el);
  el.scrollIntoView({ block: "end" });
  return el;
}

function newChat() {
  messages = [];
  log.replaceChildren();
}

async function ask(event) {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question || !project) return;
  questionInput.value = "";
  sendButton.disabled = true;
  messages.push({ role: "user", content: question });
  bubble("user", question);
  const el = bubble("assistant", "…");
  let answer = "";
  try {
    const res = await request(`/${project}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model: modelSelect.value || null }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      answer += decoder.decode(value, { stream: true });
      el.textContent = answer;
      el.scrollIntoView({ block: "end" });
    }
    messages.push({ role: "assistant", content: answer });
  } catch (err) {
    messages.pop();
    el.textContent = "Could not get an answer: " + err.message;
    el.classList.add("failed");
  }
  sendButton.disabled = false;
  questionInput.focus();
}

// --- wiring ---

tokenInput.value = sessionStorage.getItem("adminToken") || "";
tokenInput.addEventListener("change", () => {
  sessionStorage.setItem("adminToken", tokenInput.value.trim());
  filesPage = 1;
  loadFiles();
});
projectSelect.addEventListener("change", selectProject);
picker.addEventListener("change", () => uploadFiles([...picker.files]));
reindexButton.addEventListener("click", reindex);
prevButton.addEventListener("click", () => {
  filesPage -= 1;
  loadFiles();
});
nextButton.addEventListener("click", () => {
  filesPage += 1;
  loadFiles();
});
$("new-chat").addEventListener("click", newChat);
$("form").addEventListener("submit", ask);

for (const type of ["dragenter", "dragover"]) {
  drop.addEventListener(type, (event) => {
    event.preventDefault();
    drop.classList.add("over");
  });
}
for (const type of ["dragleave", "drop"]) {
  drop.addEventListener(type, (event) => {
    event.preventDefault();
    drop.classList.remove("over");
  });
}
drop.addEventListener("drop", (event) => uploadFiles([...event.dataTransfer.files]));

loadProjects();
