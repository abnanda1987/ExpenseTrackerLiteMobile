# ExpTrackerLite

A lightweight expense tracker: React + Vite frontend, Google Sheets as your data
store, free Google Apps Script backend, hosted free on Vercel.

Your sheet: https://docs.google.com/spreadsheets/d/1Mw-G_u4xTMyf_c9NaVFR0o2cVH71HyYq-o9D9WXsiFg

## How it works

```
React app (Vercel)  --fetch-->  Apps Script Web App  --reads/writes-->  Your Google Sheet
```

No paid Google Cloud project, no OAuth login screen — the Apps Script runs
under your Google account and simply reads/writes the two tabs: **Budget**
and **Expense Log**.

## One assumption to know about

`src/config.ts` treats the Budget sheet's **Year** column as a plain calendar
year (Jan–Dec). If you actually run an April–March fiscal year, open that
file and change `FISCAL_YEAR_START_MONTH` to `4`.

The backend also auto-adds a **Remarks** column to Expense Log the first time
you save an expense, since your current sheet only has Main/Category/Amount/Date.

## Step 1 — Deploy the Apps Script backend (free)

1. Open your Google Sheet.
2. Extensions → Apps Script.
3. Delete any starter code, then paste in the contents of `apps-script/Code.gs`
   (in this folder).
4. Click **Deploy → New deployment**.
5. Click the gear icon next to "Select type" → choose **Web app**.
6. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy**, authorize when prompted (it's your own script/sheet).
8. Copy the **Web app URL** — it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.

That URL is your free API. Test it by pasting it into a browser — you should
see JSON with `budgets` and `expenses`.

## Step 2 — Configure the frontend

1. In this project folder, copy `.env.example` to `.env`.
2. Paste your Web App URL as `VITE_APPS_SCRIPT_URL`.

```bash
cp .env.example .env
# then edit .env
```

## Step 3 — Run it locally (optional, to test first)

```bash
npm install
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

## Step 4 — Deploy to Vercel (free)

**Easiest path (no command line):**
1. Push this folder to a new GitHub repo.
2. Go to https://vercel.com → New Project → Import that repo.
3. Vercel auto-detects Vite. Before deploying, add an environment variable:
   - Name: `VITE_APPS_SCRIPT_URL`
   - Value: your Apps Script Web App URL
4. Click Deploy. You'll get a free `https://your-app.vercel.app` URL.

**Or via CLI:**
```bash
npm i -g vercel
vercel
# follow prompts, then when asked for env vars add VITE_APPS_SCRIPT_URL
```

## Updating the Apps Script later

If you edit `Code.gs` again, you must **Deploy → Manage deployments → Edit →
New version** for changes to go live (saving alone isn't enough).

## Project structure

```
apps-script/Code.gs       Backend — deploy this inside your Sheet
src/api.ts                Talks to the Apps Script URL
src/config.ts              The one fiscal-year assumption, easy to change
src/types.ts               Shared TypeScript types
src/components/Dashboard.tsx    FY / Main / Month filters, budget bars
src/components/AddExpense.tsx   Add Expense form
src/styles.css             Design system (passbook/ledger look)
```

## Roadmap (from your docs)

- v0.1 — Dashboard + Google Sheets + Add Expense ✅ (this build)
- v0.2 — Edit/Delete
- v0.3 — OCR
- v0.4 — NLP
