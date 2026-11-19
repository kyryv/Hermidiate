# Hermidiate – website

Static site (HTML + CSS + a little JavaScript). No build step, no packages to install.

## Structure

```
index.html                   home
how-it-works.html            the five steps and the rules
live-demo.html               interactive demo: chat + "what the system sees" panel
use-cases.html               heat pumps, boilers, air conditioning, ventilation
security.html                data handling, providers, safety
pilot.html                   pilot steps, pricing explanation, form, FAQ
privacy.html                 privacy policy (EN) – DRAFT, fill in the yellow parts
cz/                          Czech version: the same pages with the same file names
cz/ochrana-osobnich-udaju.html  privacy policy (CZ) – DRAFT, fill in the yellow parts
assets/styles.css            all styles (colours and fonts at the top, in :root)
assets/main.js               pilot form: sends the form (see "Pilot form")
assets/demo.js               live demo engine (understanding by keywords + the real decision rules)
assets/demo-company.js       fictional company for the demo: technicians, rules, job lengths, street map
assets/favicon.svg           logo / favicon
make-backup.py               saves a zip of the current version (see "Backups")
.vscode/                     recommended extensions and settings for VS Code
```

## Run locally

**VS Code (recommended):** open this folder, install the recommended extension
**Live Server**, right-click `index.html` → *Open with Live Server*. The page reloads on every save.

**Terminal (any OS, Python 3):**
```
cd hermidiate-website
python3 -m http.server 8000
```
Then open http://localhost:8000

**Double-click** `index.html` also works. Only the pilot form changes: it opens the
visitor's e-mail app instead of sending.

## Pilot form

`assets/main.js` picks the first matching option:

1. `FORM_ENDPOINT` is set (e.g. an n8n Webhook URL) → JSON POST to that URL.
2. Deployed on Netlify → **Netlify Forms**, no setup needed. Submissions appear in
   Netlify → your site → Forms → "pilot". Turn on e-mail notifications there.
3. Opened from disk or localhost → the visitor's e-mail app opens with the details filled in.

On other hosts (GitHub Pages, Vercel) set `FORM_ENDPOINT`, otherwise sending fails with a friendly message.

## Czech version

Every English page has a Czech twin in `cz/` with the same file name; the EN/CZ switch in the
header links the pair (`privacy.html` ↔ `cz/ochrana-osobnich-udaju.html`). When you change text on
an English page, change the Czech page too. The live demo speaks Czech on Czech pages
(`<html lang="cs">`): Czech replies live next to the English ones in `assets/demo.js`
(`L("English", "Czech")`) and Czech names in the `cs` block of `assets/demo-company.js`.

## Live demo

The demo runs the real agent's decision rules in the browser, on a fictional company:
question order (problem → name → phone → e-mail → address → city/district), phone and
e-mail checks, a small street map for the district check, technician choice by skill and
area, free-time search in generated calendars (30 min travel, +2 h / +1 h urgent, 21 days,
3 options), re-check before booking, move/cancel with the 24 h rule, duplicates, safety
words, out-of-area and out-of-trade refusals. Only "understanding" is simulated with keywords.

- Technicians, working hours, rules, job lengths and streets: `assets/demo-company.js`.
- Keywords the demo understands: section "Understanding" in `assets/demo.js`.
- Suggested replies under the chat: function `suggestions()` in `assets/demo.js`.
Nothing is sent anywhere.

## Backups

Before a big change, save the current version:

```
python make-backup.py
python make-backup.py before-new-hero     (optional name)
```

Run it in the VS Code terminal (Terminal → New Terminal) inside this folder.
It creates `_backup-<date>-<time>.zip` with all site files (without .git, node_modules
and older backups). Backups are ignored by git.

To go back: unzip the backup into this folder and replace the files
(Windows Explorer → right-click the zip → Extract All…).

## Publish (free)

- **Netlify**: drag this folder to app.netlify.com/drop.
- **GitHub Pages / Vercel**: push to a GitHub repo and connect it.

## Before going live

- Fill in the yellow `[...]` parts in both privacy pages (controller, IČO, address, date, hosting).
- Replace the example calendar details, phone number and technician name on the home page with real or clearly fictional ones.
- Optional: host the fonts yourself instead of Google Fonts, then remove the Google Fonts line from the pages and privacy policies.
