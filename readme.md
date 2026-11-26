# local-model-frontend

A browser console for the [local-model](../local-model) service: log in, chat with the assistant, and (as an admin) manage the knowledge base pages, the users and the tags.

```
browser ──► web (nginx, port 8080) ──► /api/* ──► local-model api
```

It is a static page served by nginx. nginx also forwards `/api/*` to the api over the local-model Docker network, so the browser talks to one server and the api needs no CORS setup.

## Run

Start the local-model stack first (see its readme), then:

```bash
docker compose up -d --build
```

Open http://localhost:8080 and log in. The first admin is the one local-model creates from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in its `.env`. The login is kept for the browser tab only and lasts 12 hours.

## What each role sees

| Menu | Who | What it does |
|---|---|---|
| **Chat** | everyone | Start conversations, send messages, reopen, rename and delete earlier ones. A user sees only their own conversations; an admin's list holds everyone's, with the others marked |
| **Files** | admin | Upload markdown pages, delete pages |
| **Users** | admin | Add users, change their name, role and password, delete them |

A user who is not an admin gets only the Chat menu. This is a convenience, not the protection: the api itself refuses the admin endpoints to users.

### Tags are hidden for now

The api limits a user's answers by tags, but this console currently hides everything about them: the **Tags** menu, the tag pickers on upload and on the user form, and the tag labels in the lists. Pages uploaded here get no tags, which makes them open to every user. Uploading a page that already has tags (given through the api or the import script) replaces the page and clears those tags.

The code is still there: set `SHOW_TAGS` to `true` in `src/ui.js` to bring it all back.

## Test the flow

1. Log in as the admin. Under **Files**, upload one or more `.md` pages. They are indexed straight away; the message shows how many sections were indexed.
2. Under **Users**, add a user.
3. Under **Chat**, ask a question the pages answer, then one they do not — the assistant should say it doesn't know.
4. Log in as the user and ask the same question; only the Chat menu shows.
5. If more than one model is allowed, pick another in the **Model** menu above the chat to compare. The default is listed first.

## Settings

All optional. Copy `env.example` to `.env` to change one.

| Variable | Default | Purpose |
|---|---|---|
| `WEB_PORT` | `8080` | Port of the console on the host |
| `API_NETWORK` | `local-model_default` | Docker network of the local-model stack |
| `API_UPSTREAM` | `api:8000` | The api's address on that network |

## Layout

```
src/
  index.html   the login form and the four views
  app.js       login, and the menu each role gets
  api.js       requests to the api, the login token
  ui.js        helpers the views share: lists, pager, tag picker
  chat.js, files.js, users.js, tags.js   one per menu
  styles.css
deploy/        Dockerfile and the nginx config template
```

No build step: the scripts are plain ES modules. `src/` is mounted into the container, so an edit shows on refresh. Rebuild only after changing `deploy/`.
