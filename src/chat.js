// Chat: the conversations of the logged-in user, and the messages of the open one.

import { getJson, isAdmin, request, session } from "./api.js";
import { $, PAGE_SIZE, button, el, lastPage, pager, report } from "./ui.js";

const UNTITLED = "New conversation";

const list = $("conversations");
const log = $("log");
const title = $("conversation-title");
const modelSelect = $("model");
const input = $("message");
const sendButton = $("send");
const renameButton = $("rename-conversation");
const deleteButton = $("delete-conversation");

let page = 1;
let current = null; // the open conversation, with its messages
let loaded = false;

export async function show() {
  if (!loaded) {
    loaded = true;
    const models = await getJson("/models");
    modelSelect.replaceChildren(...models.map((name) => new Option(name)));
    $("model-label").hidden = models.length < 2;
  }
  await loadList();
  input.focus();
}

async function loadList() {
  const { total, conversations } = await getJson(`/conversations?page=${page}&page_size=${PAGE_SIZE}`);
  if (page > lastPage(total)) {
    page = lastPage(total);
    return loadList();
  }
  list.replaceChildren(...conversations.map(conversationRow));
  pager($("conversations-pager"), page, conversations.length, total, (to) => {
    page = to;
    loadList().catch(report);
  });
}

function conversationRow(conversation) {
  const row = button(conversation.title || UNTITLED, "row-button", () => open(conversation.id).catch(report));
  if (conversation.id === current?.id) row.classList.add("current");
  // An admin's list holds everyone's conversations.
  if (isAdmin() && conversation.user_id !== session.user.id) {
    row.append(el("span", { className: "chip none", textContent: "another user" }));
  }
  return el("li", {}, row);
}

async function open(id) {
  current = await getJson(`/conversations/${id}`);
  render();
  loadList();
}

function render() {
  title.textContent = current?.title || UNTITLED;
  renameButton.hidden = deleteButton.hidden = !current;
  log.replaceChildren();
  for (const message of current?.messages || []) bubble(message.role, message.content);
}

function bubble(role, text) {
  const node = el("div", { className: "msg " + role, textContent: text });
  log.append(node);
  node.scrollIntoView({ block: "end" });
  return node;
}

async function newConversation() {
  // An empty conversation is reused instead of leaving a trail of them behind.
  if (!current || current.messages.length) {
    current = { ...(await (await request("/conversations", { method: "POST" })).json()), messages: [] };
  }
  render();
  loadList();
  input.focus();
}

async function send(event) {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  sendButton.disabled = true;
  let reply;
  let answer = "";
  try {
    if (!current) await newConversation();
    const id = current.id;
    bubble("user", text);
    reply = bubble("assistant", "…");
    const res = await request(`/conversations/${id}/messages`, {
      method: "POST",
      json: { message: text, model: modelSelect.value || null },
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      answer += decoder.decode(value, { stream: true });
      reply.textContent = answer;
      reply.scrollIntoView({ block: "end" });
    }
    // The saved conversation has its title after a first message.
    if (current?.id === id) await open(id);
  } catch (err) {
    reply ??= bubble("assistant", "");
    reply.textContent = "Could not get an answer: " + err.message;
    reply.classList.add("failed");
  }
  sendButton.disabled = false;
  input.focus();
}

async function rename() {
  const name = prompt("Conversation title", current.title || "")?.trim();
  if (!name) return;
  await request(`/conversations/${current.id}`, { method: "PATCH", json: { title: name } });
  open(current.id);
}

async function remove() {
  if (!confirm(`Delete "${current.title || UNTITLED}" and its messages?`)) return;
  await request(`/conversations/${current.id}`, { method: "DELETE" });
  current = null;
  render();
  loadList();
}

$("new-conversation").addEventListener("click", () => newConversation().catch(report));
$("message-form").addEventListener("submit", send);
renameButton.addEventListener("click", () => rename().catch(report));
deleteButton.addEventListener("click", () => remove().catch(report));
