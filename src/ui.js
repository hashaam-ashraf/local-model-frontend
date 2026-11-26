// Small helpers the views share. Text always goes in through textContent, never as HTML.

import { getJson } from "./api.js";

export const PAGE_SIZE = 50;
// Tag management is hidden for now: the Tags menu, the tag pickers and the tag labels. Set to true to bring it back.
export const SHOW_TAGS = false;
const ALL_TAGS = 200; // the most the api returns in one page

export const $ = (id) => document.getElementById(id);

export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((child) => child != null));
  return node;
}

export function say(node, text, kind = "") {
  node.textContent = text;
  node.className = "message " + kind;
  node.hidden = !text;
}

// For failures with no message line of their own: shown in the header until the next one.
export function report(err) {
  $("status").textContent = err.message;
}

export function button(text, className, onClick) {
  const node = el("button", { type: "button", className, textContent: text });
  node.addEventListener("click", () => onClick(node));
  return node;
}

export const loadTags = async () => (await getJson(`/tags?page_size=${ALL_TAGS}`)).tags;

export function tagChips(tags, empty) {
  const chips = tags.map((tag) => el("span", { className: "chip", textContent: tag.name, title: tag.description || "" }));
  return el("span", { className: "chips" }, ...(chips.length ? chips : [el("span", { className: "chip none", textContent: empty })]));
}

// Fills the container with one checkbox per tag and returns a function that reads the ticked ids.
export function tagPicker(container, tags, selected = []) {
  const chosen = new Set(selected);
  const boxes = tags.map((tag) =>
    el(
      "label",
      { className: "check", title: tag.description || "" },
      el("input", { type: "checkbox", value: tag.id, checked: chosen.has(tag.id) }),
      tag.name,
    ),
  );
  const empty = el("span", { className: "hint", textContent: "No tags yet. Create one under Tags." });
  container.replaceChildren(...(boxes.length ? boxes : [empty]));
  return () => [...container.querySelectorAll("input:checked")].map((box) => box.value);
}

// Previous / "1–50 of 120" / Next, hidden while everything fits on one page.
export function pager(container, page, shown, total, go) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const previous = button("Previous", "secondary", () => go(page - 1));
  const next = button("Next", "secondary", () => go(page + 1));
  previous.disabled = page === 1;
  next.disabled = page * PAGE_SIZE >= total;
  container.replaceChildren(previous, el("span", { textContent: `${first}–${first + shown - 1} of ${total}` }), next);
  container.hidden = total <= PAGE_SIZE;
}

export const lastPage = (total) => Math.max(1, Math.ceil(total / PAGE_SIZE));
