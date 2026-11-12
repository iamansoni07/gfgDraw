# GFG Draw — Agent Source of Truth

This file is the single reference for AI coding agents working in this repository. Prefer facts in this document over assumptions from generic Excalidraw or MERN tutorials. Do not invent endpoints, routes, or files that are not listed here.

---

## 1. Project Overview & Problem Statement

**GFG Draw** is a MERN-stack persistent whiteboard for Data Structures & Algorithms instructors (mentorship / GeeksforGeeks-style teaching).

**Problem:** Live DSA lectures need diagrams (trees, arrays, linked lists, graphs) that survive the session. Generic drawing tools reset on refresh, do not give instructors a board library, and do not offer a student-safe read-only link.

**Product intent:** Instructors create and save Excalidraw scenes to MongoDB, browse them on a dashboard, and share a read-only student URL. Students can view the board; they cannot edit or save.

**Current phase:** Core persistence, instructor dashboard, student view, and a GFG light/dark theme are in place. DSA stencil helpers and lecture-playback features are not.

---

## 2. Tech Stack & Directory Structure

There is **no root `package.json`**. Run installs and scripts inside `frontend/` and `backend/` separately.

| Layer | Stack |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Axios, `@excalidraw/excalidraw` 0.18 |
| Backend | Node.js, Express 5, Mongoose 9, CORS, dotenv |
| Database | MongoDB (URI via `backend/.env` → `MONGO_URI`) |
| Dev | Frontend `npm run dev` (Vite, typically `:5173`); backend `npm run dev` (nodemon, `:5000`) |

```
gfgDraw/
├── AGENT.md                 # This file
├── README.md                # Stub ("# gfgDraw")
├── .gitignore               # Ignores node_modules/, .env, dist, etc.
├── backend/
│   ├── .env                 # PORT, MONGO_URI — never commit
│   ├── package.json
│   ├── index.js             # Express app, CORS, JSON, mounts /api/boards
│   ├── config/db.js         # mongoose.connect(process.env.MONGO_URI)
│   ├── models/Board.js
│   ├── controllers/boardController.js
│   └── routes/boardRoutes.js
└── frontend/
    ├── package.json
    ├── vite.config.js       # React plugin; Excalidraw CSS alias; IS_PREACT=false
    └── src/
        ├── main.jsx
        ├── App.jsx          # Router + theme (data-theme / localStorage)
        ├── App.css          # GFG design tokens + dashboard + whiteboard UI
        ├── index.css        # Global reset (still has leftover dark-page defaults)
        └── components/
            ├── Dashboard.jsx
            └── Whiteboard.jsx
```

**Not present (do not import until created):**

- `frontend/src/utils/` (including `dsaTemplates.js`)
- Root workspace scripts / monorepo tooling
- Auth, users, or board-ownership models

**Vite note:** `@excalidraw/excalidraw/index.css` is aliased to `node_modules/@excalidraw/excalidraw/dist/dev/index.css` because Vite 8 does not resolve that package’s CSS export conditions.

**API base URL** is hardcoded in the frontend as `http://localhost:5000/api/boards`. There is no Vite proxy and no env-based API URL yet.

---

## 3. Database Schema & REST API Contract

### Board Mongoose schema (`backend/models/Board.js`)

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `title` | String | `'Untitled Board'` | `required: true` |
| `elements` | Array | `[]` | Excalidraw scene elements (untyped) |
| `isPublic` | Boolean | `false` | Set `true` on instructor create from the canvas |
| `createdAt` | Date | (timestamps) | Automatic |
| `updatedAt` | Date | (timestamps) | Automatic; list endpoint sorts by this desc |

Mongoose also adds `_id` and `__v`. There is no `owner`, `files` (Excalidraw binary files), or `appState` field.

### Server (`backend/index.js`)

- `GET /` — health text: `GFG Draw API is running`
- `app.use('/api/boards', boardRoutes)`
- Middleware: `cors()`, `express.json()`
- Port: `process.env.PORT || 5000`

### `/api/boards` endpoints

All JSON errors use `{ message, error? }`. Missing documents return **404** `{ message: 'Board not found' }`. Unexpected failures return **500**.

#### `POST /api/boards` — `createBoard`

**Request body (all optional):**

```json
{
  "title": "Untitled Board",
  "elements": [],
  "isPublic": true
}
```

- Empty/whitespace `title` is omitted so the schema default applies.
- `elements` is applied only if it is an array.
- `isPublic` is applied only if it is a boolean.

**Response:** `201` + created Board document (includes `_id`).

#### `GET /api/boards` — `getAllBoards`

**Request body:** none.

**Response:** `200` + array of Board documents, `sort({ updatedAt: -1 })`.

#### `GET /api/boards/:id` — `getBoardById`

**Response:** `200` + Board, or `404`.

#### `PUT /api/boards/:id` — `updateBoard`

**Request body (partial):**

```json
{
  "title": "Graph Traversal",
  "elements": []
}
```

Only `title` and `elements` are updated. **`isPublic` is not updated** on PUT.

**Response:** `200` + updated Board (`new: true`, validators on), or `404`.

#### `DELETE /api/boards/:id` — `deleteBoard`

**Request body:** none.

**Response:** `200` `{ "message": "Board deleted successfully" }`, or `404`.

There is **no** PATCH, no query filters, and no auth middleware.

---

## 4. Frontend Routing & Architecture

### Theme

`App.jsx` owns theme:

- State: `localStorage.getItem('gfg_theme')` or `'light'`
- `document.documentElement.setAttribute('data-theme', theme)`
- Persist key: `gfg_theme`
- Tokens live in `App.css` under `:root[data-theme='light']` and `:root[data-theme='dark']` (GeeksforGeeks green `#2F9E44`)
- Dashboard and Whiteboard receive `theme` and `onToggleTheme`

Working-tree theme wiring is **ahead of git** (see status). Committed `App.jsx` did not yet pass theme props.

### Routes (`frontend/src/App.jsx`)

| Path | Component | Behavior |
| --- | --- | --- |
| `/` | `Dashboard` | Instructor library |
| `/board/new` | `Whiteboard` | Empty canvas; first save POSTs then `replace` navigates to `/board/:id` |
| `/board/:id` | `Whiteboard` | Load + edit + save (PUT) |
| `/view/:id` | `Whiteboard` `readOnly={true}` | Student view |

Whiteboard treats `id === 'new'` as “no persisted board” (no GET, POST on save). That is defensive; the real new-board path is `/board/new` (no `:id`).

### `Whiteboard.jsx`

- **`excalidrawAPI`:** `useState` + `excalidrawAPI={(api) => setExcalidrawAPI(api)}`
- **Load:** `GET /api/boards/:id` then `setTitle` and `excalidrawAPI.updateScene({ elements, appState.viewBackgroundColor })`
- **Save:** `getSceneElements()` → PUT if real `id`, else POST `{ title, elements, isPublic: true }` then `navigate(/board/${_id}, { replace: true })`
- **`viewModeEnabled={readOnly}`** on `<Excalidraw>` for student mode
- **Share:** copies `${origin}/view/${id}` (header + clipboard / execCommand fallback)
- **Theme:** Excalidraw `theme` prop; canvas background `#12161A` (dark) / `#F8F9FA` (light)
- Read-only: static title, “Student View (Read-Only)” badge, no save/share/dashboard back link
- **Not serialized:** Excalidraw `files`, scroll/zoom `appState` (except background color on load)

### `Dashboard.jsx`

- **Load:** `GET /api/boards` into `boards` state; loading skeletons, error + retry, empty and no-search-match states
- **Create:** navigate `/board/new`
- **Open:** navigate `/board/${_id}`
- **Search / sort:** client-side title filter; recent / A–Z / oldest
- **Share:** copy `/view/:id`, toast
- **Delete:** confirm modal → `DELETE /api/boards/:id` → remove from local state + toast
- **Theme toggle:** same App-level handler

### CSS split

- `App.css` — product UI (dashboard, header, cards, modal, whiteboard chrome)
- `index.css` — leftover global dark `#070a08` background and `overflow: hidden` on `html, body, #root` (can fight dashboard scroll; prefer `--bg-app` going forward)

---

## 5. Engineering Conventions & Guardrails

### Secrets and ignores

- Keep `node_modules/` and `.env` out of git (already in `.gitignore`).
- Never commit `backend/.env` or paste `MONGO_URI` credentials into docs or chat logs.
- Provide `.env.example` with keys only (`PORT`, `MONGO_URI`) if documenting setup.

### UI

- Keep Light/Dark consistent with the GFG green system in `App.css` (`--gfg-primary`, `--bg-app`, `--text-heading`).
- Do not restyle the app as a stock Excalidraw clone (custom header, GFG mark, instructor dashboard).
- Student `/view/:id` must remain non-editable (`viewModeEnabled`).

### Git

Use conventional commits:

- `feat:` new user-facing capability
- `fix:` bug fix
- `chore:` tooling, deps, ignore files
- `docs:` AGENT.md / README

Do not commit unless the human asks. Current `main` can be **ahead of `origin/main`**; do not `git push` unless asked.

### Code habits

- Backend handlers: async try/catch, JSON errors, 404 for missing ids.
- Frontend API calls: Axios + local status (saving / toasts); do not silently swallow UX.
- Prefer updating `elements` + `title` together on save so PUT does not wipe the scene.
- Do not add `deleteBoard` or routes that already exist.
- Do not write exploits, attack scripts, or commit secrets.

---

## 6. Current Implementation Status & Roadmap

### Completed (verified in repo)

**Backend**

- Express server, CORS, JSON, health `GET /`
- MongoDB connection via `config/db.js`
- Board schema: `title`, `elements`, `isPublic`, timestamps
- `createBoard`, `getAllBoards`, `getBoardById`, `updateBoard`, **`deleteBoard`**
- Routes: `POST/GET /api/boards`, `GET/PUT/DELETE /api/boards/:id`

**Frontend (working tree)**

- Dependencies: `@excalidraw/excalidraw`, `axios`, `react-router-dom`
- Routes: `/`, `/board/new`, `/board/:id`, `/view/:id`
- `Whiteboard.jsx`: Excalidraw embed, title edit, create-vs-update save, `viewModeEnabled`, share-link copy, theme-aware canvas
- `Dashboard.jsx`: list, search, sort, share copy, delete modal + `DELETE` API
- GFG `data-theme` + `localStorage` (`gfg_theme`) in `App.jsx` / `App.css`

**Git (at audit time)**

- Branch: `main`, **ahead of origin by 1 commit**
- Last 5 commits:
  1. `feat: add backend board controllers, routes, frontend dashboard component, and styles`
  2. `feat: implement public student view and persistent share link generator`
  3. `feat: add instructor dashboard, board search, and full routing flow`
  4. `feat: implement core Excalidraw canvas, custom UI header, and MongoDB save/update logic`
  5. `Initial commit`
- **Uncommitted:** `frontend/src/App.css`, `App.jsx`, `Dashboard.jsx`, `Whiteboard.jsx` (theme engine / GFG redesign). Backend DELETE is **already committed**.

### Partial / gaps

| Item | Status |
| --- | --- |
| GFG Light/Dark | Implemented in working tree; **not committed** |
| `index.css` vs theme tokens | Leftover dark globals / `overflow: hidden` |
| PUT `isPublic` | Not supported |
| Excalidraw `files` / full `appState` | Not persisted |
| API URL | Hardcoded localhost |
| Auth | None |
| `frontend/src/utils/dsaTemplates.js` | **Missing** |

No broken imports found among existing components (`Dashboard` and `Whiteboard` resolve from `App.jsx`). `dsaTemplates` is simply absent.

### Next up — Phase 2

Highest-value missing product feature:

1. **DSA Templates drawer** — add `frontend/src/utils/dsaTemplates.js` with Binary Tree, Array, and Linked List helpers, plus a Whiteboard UI to insert generated Excalidraw elements via `excalidrawAPI.updateScene` / `addFiles` as needed.
2. **Commit the theme working tree** (after human approval) so Light/Dark is not lost.
3. Optional polish: align `index.css` with `--bg-app`, allow dashboard scroll, env-based API URL, PUT `isPublic` if sharing policy needs it.

### Phase 3 (not started)

- **Focus Mode** — hide instructor chrome during live lecture
- **Stroke Playback** — replay element creation order for walkthroughs
- **Code Blocks** — first-class code/snippet objects on the canvas (beyond raw Excalidraw text)

---

## Quick start (local)

```bash
# backend
cd backend && npm install && npm run dev

# frontend (second terminal)
cd frontend && npm install && npm run dev
```

Create `backend/.env` locally with `PORT` and `MONGO_URI`. Do not copy production secrets into this file.
