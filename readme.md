# local-model-frontend

A browser console for testing the [local-model](../local-model) service end to end: pick a project, upload or delete knowledge base pages, and ask questions with any of the models the project allows.

```
browser ──► web (nginx, port 8080) ──► /api/* ──► local-model api
```

It is a static page served by nginx. nginx also forwards `/api/*` to the api over the local-model Docker network, so the browser talks to one server and the api needs no CORS setup.

## Run

Start the local-model stack first (see its readme), then:

```bash
docker compose up -d --build
```

Open http://localhost:8080 and paste the `ADMIN_TOKEN` from local-model's `.env` into the **Admin token** field. The token is kept for the browser tab only.

## Test the flow

1. Choose a project.
2. Upload one or more `.md` pages. They are indexed straight away; the message shows how many sections the index holds.
3. Ask a question the pages answer, then one they do not — the agent should say it doesn't know and offer a person.
4. Delete a page and ask again: the answer should no longer use it.
5. If the project lists more than one model, pick another in the **Model** menu above the chat and ask again to compare. The project's default is listed first.

**Re-index** rebuilds the index from the files on the server; use it after changing files in local-model's `kb/` folder by hand.

## Settings

All optional. Copy `env.example` to `.env` to change one.

| Variable | Default | Purpose |
|---|---|---|
| `WEB_PORT` | `8080` | Port of the console on the host |
| `API_NETWORK` | `local-model_default` | Docker network of the local-model stack |
| `API_UPSTREAM` | `api:8000` | The api's address on that network |

## Layout

```
src/         index.html, app.js, styles.css — no build step
deploy/      Dockerfile and the nginx config template
```

`src/` is mounted into the container, so an edit shows on refresh. Rebuild only after changing `deploy/`.
