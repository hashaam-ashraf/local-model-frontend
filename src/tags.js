// Tags: the labels shared by users and pages. Admins only.

import { getJson, request } from "./api.js";
import { $, PAGE_SIZE, button, el, lastPage, pager, say } from "./ui.js";

const list = $("tags");
const message = $("tags-message");
const form = $("tag-form");

let page = 1;

export const show = () => loadTags();

async function loadTags(keepMessage = false) {
  try {
    const { total, tags } = await getJson(`/tags?page=${page}&page_size=${PAGE_SIZE}`);
    if (page > lastPage(total)) {
      page = lastPage(total);
      return loadTags(keepMessage);
    }
    if (!keepMessage) say(message, total ? "" : "No tags yet.");
    list.replaceChildren(...tags.map(tagRow));
    pager($("tags-pager"), page, tags.length, total, (to) => {
      page = to;
      loadTags();
    });
  } catch (err) {
    say(message, err.message, "error");
  }
}

function tagRow(tag) {
  return el(
    "li",
    {},
    el("span", { className: "chip", textContent: tag.name }),
    el("span", { className: "main muted", textContent: tag.description || "" }),
    button("Delete", "danger", (node) => deleteTag(tag, node)),
  );
}

async function addTag(event) {
  event.preventDefault();
  const name = $("tag-name").value.trim();
  try {
    await request("/tags", { method: "POST", json: { name, description: $("tag-description").value.trim() || null } });
    say(message, `Added ${name}.`, "ok");
    form.reset();
  } catch (err) {
    say(message, err.message, "error");
  }
  loadTags(true);
}

async function deleteTag(tag, node) {
  if (!confirm(`Delete the tag "${tag.name}"? It is taken off every user. A tag still on a page cannot be deleted.`)) return;
  node.disabled = true;
  try {
    await request(`/tags/${tag.id}`, { method: "DELETE" });
    say(message, `Deleted ${tag.name}.`, "ok");
  } catch (err) {
    say(message, err.message, "error");
  }
  loadTags(true);
}

form.addEventListener("submit", addTag);
