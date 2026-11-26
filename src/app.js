// Login, and the menu: every user gets Chat; Files, Users and Tags are for admins.

import { getJson, isAdmin, logIn, logOut, request, session } from "./api.js";
import * as chat from "./chat.js";
import * as files from "./files.js";
import * as tags from "./tags.js";
import { $, SHOW_TAGS, report, say } from "./ui.js";
import * as users from "./users.js";

const views = { chat, files, users, tags };
const nav = $("nav");

function navigate(name) {
  const item = nav.querySelector(`[data-view="${name}"]`);
  // The api enforces this as well; hiding the menu only keeps a user from pages that would be empty.
  if (!item || item.hidden) name = "chat";
  for (const other of nav.children) other.classList.toggle("current", other.dataset.view === name);
  for (const view of document.querySelectorAll(".view")) view.hidden = view.id !== `${name}-view`;
  history.replaceState(null, "", `#${name}`);
  $("status").textContent = "";
  views[name].show().catch(report);
}

function showLogin(text = "") {
  $("login").hidden = false;
  say($("login-message"), text, "error");
  $("login-email").focus();
}

async function start() {
  const notice = sessionStorage.getItem("notice") || "";
  sessionStorage.removeItem("notice");
  if (!session.token) return showLogin(notice);
  try {
    session.user = await getJson("/auth/me");
  } catch (err) {
    return showLogin(err.status === 401 ? "Your login has expired. Log in again." : err.message);
  }
  for (const item of nav.querySelectorAll("[data-admin]")) item.hidden = !isAdmin();
  if (!SHOW_TAGS) nav.querySelector('[data-view="tags"]').hidden = true;
  $("who").textContent = `${session.user.name} · ${session.user.role}`;
  $("app").hidden = false;
  navigate(location.hash.slice(1));
}

$("login").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const body = { email: $("login-email").value, password: $("login-password").value };
    logIn((await (await request("/auth/login", { method: "POST", json: body })).json()).token);
  } catch (err) {
    say($("login-message"), err.message, "error");
  }
});
$("logout").addEventListener("click", () => logOut());
nav.addEventListener("click", (event) => event.target.dataset.view && navigate(event.target.dataset.view));
// Typing a menu's address (#files) switches to it; navigate() itself does not fire this event.
window.addEventListener("hashchange", () => session.user && navigate(location.hash.slice(1)));

start();
