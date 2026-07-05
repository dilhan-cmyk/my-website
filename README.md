# Roshan's 70th Birthday - Invite Site

A single-page invite site hosted on GitHub Pages, with RSVPs stored in a
Google Sheet via an Apps Script web app.

**Live site:** https://dilhan-cmyk.github.io/my-website/

## Structure

| File | Purpose |
|---|---|
| `index.html` + `css/` + `js/` | Public landing page: countdowns, RSVP modal, calendar download, photo upload, attendee list, map |
| `admin.html` | Host-only dashboard (password gated, not linked from the public page) |
| `apps-script/Code.gs` | Backend code to paste into the Google Sheet's Apps Script editor |
| `API-CONTRACT.md` | Request/response contract between frontend and backend |
| `DEPLOYMENT.md` | Step-by-step backend setup instructions (browser only, no CLI) |

## Status

- The site runs in **demo mode** (simulated data, no real storage) until the
  Apps Script backend is deployed and its URL is pasted into `js/config.js`
  as `APPS_SCRIPT_URL`. Follow `DEPLOYMENT.md`.
- The hero photo goes at `assets/hero.jpg` (portrait orientation). Collage
  photos go at `assets/collage1.jpg` etc. and need wiring into `index.html`.

## Local development

Serve the folder with any static server, for example:

```
python -m http.server 8123
```

Then open http://localhost:8123/. Demo mode admin password: `demo`.
