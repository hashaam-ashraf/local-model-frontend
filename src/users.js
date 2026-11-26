// Users: who can log in, their role and their tags. Admins only.

import { getJson, request, session } from "./api.js";
import { $, PAGE_SIZE, SHOW_TAGS, button, el, lastPage, loadTags, pager, say, tagChips, tagPicker } from "./ui.js";

const list = $("users");
const message = $("users-message");
const form = $("user-form");
const email = $("user-email");
const name = $("user-name");
const password = $("user-password");
const role = $("user-role");

let page = 1;
let tags = [];
let chosenTags = () => [];
let editing = null; // the user being edited; null while adding one

export async function show() {
  $("user-tags").parentElement.hidden = !SHOW_TAGS;
  if (SHOW_TAGS) tags = await loadTags();
  resetForm();
  await loadUsers();
}

async function loadUsers() {
  try {
    const { total, users } = await getJson(`/users?page=${page}&page_size=${PAGE_SIZE}`);
    if (page > lastPage(total)) {
      page = lastPage(total);
      return loadUsers();
    }
    list.replaceChildren(...users.map(userRow));
    pager($("users-pager"), page, users.length, total, (to) => {
      page = to;
      loadUsers();
    });
  } catch (err) {
    say(message, err.message, "error");
  }
}

function userRow(user) {
  const isMe = user.id === session.user.id;
  const remove = button("Delete", "danger", (node) => deleteUser(user, node));
  // The api refuses this too: an admin cannot delete their own account.
  remove.disabled = isMe;
  return el(
    "li",
    {},
    el("span", { className: "main" }, user.name + (isMe ? " (you)" : ""), el("span", { className: "muted", textContent: user.email })),
    el("span", { className: "chip " + user.role, textContent: user.role }),
    user.role === "admin" || !SHOW_TAGS ? null : tagChips(user.tags, "no tags · untagged pages only"),
    button("Edit", "secondary small", () => edit(user)),
    remove,
  );
}

function resetForm() {
  editing = null;
  form.reset();
  email.disabled = false;
  password.required = true;
  password.placeholder = "8 to 72 characters";
  $("user-form-title").textContent = "Add a user";
  $("user-save").textContent = "Add user";
  $("user-cancel").hidden = true;
  chosenTags = tagPicker($("user-tags"), tags);
}

function edit(user) {
  editing = user;
  email.value = user.email;
  email.disabled = true; // the api has no way to change it
  name.value = user.name;
  role.value = user.role;
  password.value = "";
  password.required = false;
  password.placeholder = "Leave empty to keep the current one";
  $("user-form-title").textContent = `Edit ${user.name}`;
  $("user-save").textContent = "Save changes";
  $("user-cancel").hidden = false;
  chosenTags = tagPicker($("user-tags"), tags, user.tags.map((tag) => tag.id));
  form.scrollIntoView({ block: "nearest" });
}

async function save(event) {
  event.preventDefault();
  const body = { name: name.value.trim(), role: role.value };
  // Left out while tags are hidden, so saving a user does not clear the tags they already have.
  if (SHOW_TAGS) body.tags = chosenTags();
  if (password.value) body.password = password.value;
  try {
    if (editing) {
      await request(`/users/${editing.id}`, { method: "PATCH", json: body });
      say(message, `Saved ${body.name}.`, "ok");
    } else {
      await request("/users", { method: "POST", json: { ...body, email: email.value.trim() } });
      say(message, `Added ${body.name}.`, "ok");
    }
    resetForm();
    loadUsers();
  } catch (err) {
    say(message, err.message, "error");
  }
}

async function deleteUser(user, node) {
  if (!confirm(`Delete ${user.name} (${user.email}) and their conversations?`)) return;
  node.disabled = true;
  try {
    await request(`/users/${user.id}`, { method: "DELETE" });
    say(message, `Deleted ${user.name}.`, "ok");
  } catch (err) {
    say(message, err.message, "error");
  }
  if (editing?.id === user.id) resetForm();
  loadUsers();
}

form.addEventListener("submit", save);
$("user-cancel").addEventListener("click", resetForm);
