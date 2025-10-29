# Digital Residue Exchange Portal – Architecture & Review Notes

This document explains how the app works end-to-end: technologies used, frontend/backend/database interactions, and CRUD flows. Use it for viva/review preparation.

## 1) Concept Overview
- Share leftover/unused digital files (code, images, docs, datasets, etc.).
- Browse, search, like, and download files.
- Leaderboard shows popular uploads.
- Update/Delete are protected by a 6-character secret code generated on upload (no login needed).

## 2) Tech Stack (Deliberately Minimal)
- Backend: Node.js + Express.js
- Database: SQLite (file `digital_residue.db`, runs locally, no separate server)
- File uploads: Multer (saves to local `uploads/` folder)
- Frontend: Plain HTML, CSS, and JavaScript (no frameworks)
- Runtime: Works completely offline after `npm install`

Why SQLite? Simpler for a course demo, zero config, file-based DB.

## 3) Project Structure
```
Digital_Residual_Portal/
├─ server.js                  # Express app + API routes + DB init
├─ digital_residue.db         # SQLite database file (auto created)
├─ uploads/                   # Stored uploaded files
├─ public/                    # Static frontend
│  ├─ index.html              # Home (hero, stats, recent uploads)
│  ├─ upload.html             # Upload form + secret-code modal
│  ├─ search.html             # Search by title/description/tags
│  ├─ leaderboard.html        # Top by likes (optional month filter)
│  ├─ manage.html             # Update/Delete via secret code
│  ├─ styles.css              # Dark theme, layout & components
│  └─ script.js               # Frontend logic and API calls
├─ package.json               # Dependencies + scripts
├─ README.md                  # Quick setup and API summary
└─ ARCHITECTURE.md            # This document
```

## 4) Data Model (Table: `uploads`)
Columns:
- `id` INTEGER PK AUTOINCREMENT
- `title` TEXT
- `description` TEXT
- `tags` TEXT (comma-separated)
- `filename` TEXT (stored name on disk)
- `original_name` TEXT (user’s original filename)
- `uploader_name` TEXT
- `like_count` INTEGER DEFAULT 0
- `download_count` INTEGER DEFAULT 0
- `upload_date` DATETIME DEFAULT CURRENT_TIMESTAMP
- `secret_code` TEXT (6-char code; added on startup if missing)

Migrations: on server start, we create the table if missing and ensure `secret_code` column exists (simple PRAGMA check + ALTER TABLE).

## 5) Request/Response Flow (High Level)
1. Browser requests a page under `/public` (e.g., `index.html`).
2. Frontend JS (`script.js`) calls REST endpoints under `/api/...` for data.
3. Express handles the request, uses SQLite for reads/writes, and returns JSON (or a file download stream).
4. UI updates with returned data (cards, counters, etc.).

## 6) CRUD Operations (with Secret Code for U/D)

### Create (Upload)
- Endpoint: `POST /api/upload` (multipart/form-data)
- Fields: `title`, `description` (optional), `tags` (optional), `uploader_name`, `file`
- Flow:
  1) Multer stores file in `uploads/` with a unique name.
  2) Server generates a 6-char alphanumeric `secret_code` (e.g., `AB12CD`).
  3) Metadata + `secret_code` inserted into SQLite.
  4) Response includes `id`, `filename`, and `secret_code`.
- UX: After upload, a custom modal shows “Keep this secret code safe” with Copy button.

### Read
- `GET /api/uploads` → all uploads
- `GET /api/uploads/:id` → one upload
- `GET /api/search?q=...&tag=...` → LIKE-based search for title/description and tags
- `GET /api/leaderboard?month=MM` → sorted by likes (and downloads as tiebreaker)

### Update (Metadata only)
- Endpoint: `PUT /api/uploads/:id`
- Body: `{ secret_code, title?, description?, tags? }`
- Flow: Server verifies `(id, secret_code)` pair. If valid, updates provided fields. No file re-upload here by design (kept minimal). Standard 403 for invalid code.
- UX: Each card has a small “✏️” action that navigates to `manage.html?action=update&id=...`. The page asks for the secret code and new values.

### Delete
- Endpoint: `DELETE /api/uploads/:id`
- Body: `{ secret_code }`
- Flow: Server verifies `(id, secret_code)`. On success, deletes DB row and attempts to remove the file from disk. Returns success even if file is already missing (best effort).
- UX: Each card has a small “🗑️” action that navigates to `manage.html?action=delete&id=...`. The page asks for the secret code and shows a clear “No / Yes, delete” confirmation.

## 7) Other Actions
- Like: `POST /api/like/:id` increments `like_count`.
- Download: `GET /api/download/:id` streams the file and increments `download_count`.

## 8) Frontend – Pages & Behavior
- `index.html` (Home)
  - Moving tag marquee and animated hero.
  - Stats (Files/Downloads/Likes) computed client-side from `/api/uploads` and animated.
  - Recent uploads grid rendered as cards: title, description, tags, uploader, like/download counts, actions (Like/Download/Update/Delete).
- `upload.html`
  - Form posts to `/api/upload` via Fetch.
  - On success, shows custom modal with secret code (Copy and Close).
- `search.html`
  - Form submits to `/api/search`; results rendered as the same file cards.
- `leaderboard.html`
  - Calls `/api/leaderboard` (optional month filter) and renders top files.
- `manage.html`
  - Update mode: asks secret code + new metadata, calls PUT.
  - Delete mode: asks secret code, confirmation UI, calls DELETE.

## 9) Styling & UX (Dark Theme)
- Single CSS file: `public/styles.css` (no Bootstrap/Tailwind).
- Modern dark palette, rounded cards, soft shadows, hover lifts.
- Mini action buttons appear on card hover (top-right) to avoid clutter.
- Buttons use gradients and glows for clear affordance.
- Responsive via media queries (mobile-first adjustments).

## 10) Backend Internals (Express + SQLite)
- Middlewares: `cors`, `express.json`, `express.urlencoded`, static serving of `public/` and `/uploads`.
- Multer storage: `diskStorage` with timestamped unique filenames.
- DB: `sqlite3` package; simple `db.run`, `db.get`, `db.all` calls.
- Graceful shutdown: closes DB on `SIGINT`.

## 11) Database Notes
- SQLite file is `digital_residue.db` in project root.
- Table creation and lightweight migration run at server start.
- For a “reset”, stop server, delete `digital_residue.db`, restart (useful in demos).

## 12) Security & Constraints (Educational Scope)
- No user accounts/login: secret code acts as simple ownership proof for U/D.
- No external storage or cloud; files saved locally in `uploads/`.
- No heavy libraries; only Express, Multer, SQLite, and minimal CORS.
- For production, you would add: auth, file scanning, rate limits, robust migrations, validations, and better error UX.

## 13) Typical Demo Flows
- Upload:
  1) Open Upload → choose file → fill title/name → Submit
  2) Modal shows secret code; Copy it
  3) Home shows the new card; stats update
- Update:
  1) On Home/Search/Leaderboard, hover a card → click ✏️
  2) Enter secret code + new details → Save → Success message
- Delete:
  1) Hover card → click 🗑️ → enter code → confirm delete → Card disappears
- Like/Download: click buttons, counters increase
- Search: go to Search, enter q/tag → results filter
- Leaderboard: open page → apply month filter (optional)

## 14) API Quick Reference
- `POST /api/upload` (multipart) → returns `{ id, filename, secret_code }`
- `GET /api/uploads` → list
- `GET /api/uploads/:id` → single item
- `GET /api/search?q=...&tag=...` → filtered list
- `POST /api/like/:id` → like
- `GET /api/download/:id` → download + increments counter
- `GET /api/leaderboard?month=MM` → top files
- `PUT /api/uploads/:id` `{ secret_code, title?, description?, tags? }` → update
- `DELETE /api/uploads/:id` `{ secret_code }` → delete

## 15) Running Locally
1) Install deps: `npm install`
2) Start server: `npm start`
3) Open: `http://localhost:3000`

That’s it — a clean, fully offline demo of server-side CRUD with file uploads, minimal dependencies, and a modern UI.
