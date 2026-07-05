# API Contract — RSVP Backend (Google Apps Script)

The frontend (GitHub Pages) talks to a Google Apps Script web app deployed as
"Execute as: Me, Who has access: Anyone". Its URL lives in `js/config.js` as
`CONFIG.APPS_SCRIPT_URL`.

## Transport rules (critical for CORS)

- All POST requests are sent with `Content-Type: text/plain;charset=utf-8` and a
  JSON string body. This makes them "simple requests" so the browser skips the
  CORS preflight, which Apps Script cannot answer.
- All responses are JSON via `ContentService.createTextOutput(...).setMimeType(ContentService.MimeType.JSON)`.
- GET endpoints pass parameters as query string. The client must follow
  redirects (Apps Script 302s to script.googleusercontent.com; `fetch` handles
  this automatically).
- Every response has the shape `{ ok: true, ... }` or `{ ok: false, error: "message" }`.

## Endpoints

### POST { action: "rsvp" }
Request body (JSON):
```json
{ "action": "rsvp", "name": "Dilhan Perera", "email": "d@x.com",
  "guests": ["Will Smith", "Sam"], "guestCount": 3, "website": "" }
```
- `guests` is the list of ADDITIONAL guest names (not including the RSVP-er).
  May be empty. Server trims entries, drops empty ones, caps each at 80 chars.
- `guestCount` is still sent by the client as `1 + guests.length`. The server
  recomputes it from `guests` when the `guests` field is present (backwards
  compatibility: an old client sending only guestCount still works, guests
  is stored empty).
- `website` is a honeypot field. If non-empty, silently return `{ ok: true, id: "fake" }` and store nothing.
- `name` and `email` required. Trim strings. Basic email shape check.
- Creates a row with a new UUID id and server timestamp.
Response: `{ "ok": true, "id": "<uuid>" }`

### POST { action: "editRsvp" }
```json
{ "action": "editRsvp", "id": "<uuid>", "name": "...", "email": "...",
  "guests": ["..."], "guestCount": 2 }
```
- Finds the row by id, updates name/email/guests/guest_count. 404-style error if id not found:
  `{ "ok": false, "error": "not_found" }`.
Response: `{ "ok": true }`

### GET ?action=attendees
Public list for the "Attending" section.
Response:
```json
{ "ok": true, "attendees": [ { "name": "Dilhan", "guestCount": 3, "guests": ["Will", "Sam"] } ] }
```
- `name` is the FIRST NAME ONLY (server-side: first whitespace-separated token of stored name).
- `guests` contains the FIRST NAME ONLY of each additional guest. Empty array when none.
- Never include emails or ids. Sorted newest first.
- Frontend renders "Dilhan + 2"; clicking expands to list the guest first names.
  A client talking to an old backend (no `guests` in response) must treat guests
  as [] and render a non-expandable "+ N".

### POST { action: "uploadPhoto" }
```json
{ "action": "uploadPhoto", "id": "<uuid>", "filename": "me.jpg", "mimeType": "image/jpeg", "dataBase64": "<base64>" }
```
- Only if `id` matches an existing RSVP record, else `{ ok:false, error:"not_found" }`.
- Reject non-`image/*` mime types: `{ ok:false, error:"not_an_image" }`.
- Reject decoded size > 10 MB: `{ ok:false, error:"too_large" }`.
- Reject if the record already has 5 photo URLs: `{ ok:false, error:"photo_limit" }`.
- Saves the file to a Drive folder named "Roshan 70th - Guest Photos" (create if missing),
  appends the Drive URL to the record's `photo_urls` (comma-separated in the sheet cell).
Response: `{ "ok": true, "url": "<drive url>", "remaining": 4 }`

### GET ?action=admin&token=TOKEN
- `token` must equal the `ADMIN_TOKEN` Script Property, else `{ ok:false, error:"unauthorized" }`.
Response:
```json
{ "ok": true, "records": [ { "id": "...", "name": "...", "email": "...", "guestCount": 3,
  "timestamp": "2026-07-05T10:00:00.000Z", "photoUrls": ["..."] } ], "totalGuests": 6 }
```

### POST { action: "deleteRsvp" }
```json
{ "action": "deleteRsvp", "token": "TOKEN", "id": "<uuid>" }
```
- Token checked as above. Deletes the sheet row.
Response: `{ "ok": true }`

## Sheet schema (sheet name: "RSVPs", header row 1)

| id | name | email | guest_count | timestamp | photo_urls | guest_names |

- `guest_names` stores the additional guest full names, comma-separated
  (names have commas stripped on write). Column added at the END so
  existing rows keep working; setup() adds the header when missing and
  handlers must tolerate rows/sheets where the column is absent.

## Secrets

- `ADMIN_TOKEN` lives ONLY in Apps Script Script Properties. It is never in the
  repo (repo is public). The admin page asks the admin to type it and uses it
  as the token for admin calls.

## Client-side RSVP state (localStorage)

Key: `roshan70_rsvp`
Value: JSON `{ "id": "<uuid>", "name": "Dilhan", "email": "d@x.com", "guests": ["Will", "Sam"], "guestCount": 3, "photosUploaded": 0 }`
- Older stored records may lack `guests`; treat as [].
- Written after a successful rsvp/editRsvp. Drives the sticky banner,
  Edit RSVP button state, and the 5-photo client-side counter.

## Demo mode

If `CONFIG.APPS_SCRIPT_URL` is an empty string, the frontend runs in demo mode:
all API calls are simulated locally (in-memory + localStorage) so the site can
be developed and tested before the backend is deployed. Demo attendees:
Tamara (2), Peter (1).
