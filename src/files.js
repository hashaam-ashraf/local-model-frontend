// Files: the knowledge base pages and the tags that decide who gets answers from them. Admins only.

import { getJson, request } from "./api.js";
import { $, PAGE_SIZE, SHOW_TAGS, button, el, lastPage, loadTags, pager, say, tagChips, tagPicker } from "./ui.js";

const list = $("files");
const message = $("files-message");
const drop = $("drop");
const picker = $("picker");

let page = 1;
let tags = [];
let uploadTags = () => [];

export async function show() {
  $("upload-tags").parentElement.hidden = !SHOW_TAGS;
  if (SHOW_TAGS) {
    tags = await loadTags();
    uploadTags = tagPicker($("upload-tags"), tags, uploadTags());
  }
  await loadFiles();
}

const filePath = (path) => "/files/" + path.split("/").map(encodeURIComponent).join("/");
const formatSize = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

async function loadFiles(keepMessage = false) {
  try {
    const { total, files } = await getJson(`/files?page=${page}&page_size=${PAGE_SIZE}`);
    if (page > lastPage(total)) {
      // The last page emptied, for example after deleting its only file.
      page = lastPage(total);
      return loadFiles(keepMessage);
    }
    if (!keepMessage) say(message, total ? "" : "No pages yet. Upload one to start.");
    list.replaceChildren(...files.map(fileRow));
    pager($("files-pager"), page, files.length, total, (to) => {
      page = to;
      loadFiles();
    });
  } catch (err) {
    say(message, err.message, "error");
  }
}

function fileRow(file) {
  const row = el(
    "li",
    {},
    el("span", { className: "main", textContent: file.path }),
    SHOW_TAGS ? tagChips(file.tags, "no tags · everyone") : null,
    el("span", { className: "muted", textContent: formatSize(file.size) }),
    SHOW_TAGS ? button("Tags", "secondary small", () => editTags(file, row)) : null,
    button("Delete", "danger", (node) => deleteFile(file.path, node)),
  );
  return row;
}

function editTags(file, row) {
  const boxes = el("div", { className: "checks" });
  const chosen = tagPicker(boxes, tags, file.tags.map((tag) => tag.id));
  const save = button("Save tags", "small", async (node) => {
    node.disabled = true;
    try {
      await request(filePath(file.path), { method: "PUT", json: { tags: chosen() } });
      say(message, `Updated the tags of ${file.path}.`, "ok");
    } catch (err) {
      say(message, err.message, "error");
    }
    loadFiles(true);
  });
  const editor = el(
    "li",
    { className: "editor" },
    el("span", { className: "main", textContent: file.path }),
    boxes,
    save,
    button("Cancel", "secondary small", () => loadFiles(true)),
  );
  row.replaceWith(editor);
}

async function uploadFiles(files) {
  if (!files.length || picker.disabled) return;
  const body = new FormData();
  for (const file of files) body.append("files", file);
  for (const tag of uploadTags()) body.append("tags", tag);
  say(message, `Uploading and indexing ${files.length} file(s)…`);
  picker.disabled = true;
  try {
    const result = await (await request("/files", { method: "POST", body })).json();
    const names = result.files.length > 5 ? `${result.files.length} files` : result.files.join(", ");
    say(message, `Uploaded ${names}: ${result.sections} section(s) indexed.`, "ok");
  } catch (err) {
    say(message, err.message, "error");
  }
  picker.disabled = false;
  picker.value = "";
  loadFiles(true);
}

async function deleteFile(path, node) {
  if (!confirm(`Delete ${path} from the knowledge base?`)) return;
  node.disabled = true;
  try {
    await request(filePath(path), { method: "DELETE" });
    say(message, `Deleted ${path}.`, "ok");
  } catch (err) {
    say(message, err.message, "error");
  }
  loadFiles(true);
}

picker.addEventListener("change", () => uploadFiles([...picker.files]));
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
