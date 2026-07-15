# Job Founder Hunter — Backend Mail Server

A tiny self-hosted backend that sends real outreach emails through **Nodemailer**
with a **BullMQ + Redis** queue for rate-limited, retryable delivery. It adds
**open + click email tracking** (a 1×1 pixel + rewritten links) so you can see who
opened / clicked, both in the extension's **Data** tab and the **Dashboard** tab.

> **All configuration lives in environment variables (`.env` / Render dashboard).**
> Nothing sensitive (Redis URL, Gmail password) is entered in the browser extension.
> The extension only needs the **Backend URL** + **API Key** and a **Test** button.

---

## 1. Prerequisites

- **Node.js 18+**
- **Redis** — for local dev use Docker; for production use **Upstash** (serverless Redis).
- A **Gmail App Password** for `gaurav07c@gmail.com` (Google Account → Security → App passwords).

## 2. Local dev

```bash
cd server
npm install
cp .env.example .env        # then fill REDIS_URL + SMTP_PASS
# Redis:
docker compose up -d redis  # or set REDIS_URL to your Upstash rediss:// URL
npm start
curl http://localhost:3000/health
```

`.env` fields: `REDIS_URL`, `SMTP_*`, `MAIL_FROM`, `API_KEY`, `PUBLIC_BASE_URL`, `QUEUE_*`.

## 3. Deploy on Render (recommended)

1. Push the repo to GitHub.
2. In Render, create a **Blueprint** from `render.yaml` (or a new Web Service with the
   `server/` directory, `npm install` build, `npm start` start).
3. Set these **Environment Variables** in the Render dashboard:
   - `REDIS_URL` → your **Upstash** `rediss://default:...@xxx.upstash.io:6379`
   - `SMTP_USER` → `gaurav07c@gmail.com`
   - `SMTP_PASS` → the 16-char Gmail **App Password** (no spaces)
   - `MAIL_FROM` → `Gaurav Kumar <gaurav07c@gmail.com>`
   - `PUBLIC_BASE_URL` → your Render URL, e.g. `https://jfh-backend.onrender.com`
   - `API_KEY` → a secret; copy it into the extension's **Backend API Key** field.
4. Render auto-assigns `PORT` and runs the health check at `/health`.

### Upstash Redis
Create a Redis database at upstash.com, copy the **TLS** (`rediss://`) URL, and paste
it as `REDIS_URL`. BullMQ works with Upstash out of the box.

## 4. Connect the extension

1. **My Profile → 🖥️ Backend Mail Server**: Backend URL = your Render URL
   (e.g. `https://jfh-backend.onrender.com`), API Key = the value you set on Render.
   Click **Test Backend Connection** (✅). **Save & Verify Profile**.
2. Set **Email Action** to **🖥️ Send via Backend (Nodemailer + Queue)**.

### 3-phase outreach flow
1. **Home → Step 1: Find Emails (LinkedIn)** (or **Data → 🔍 Find Emails**) — finds emails only.
2. **Data tab → 👁 Preview** any founder to see the exact subject/body that will be sent.
3. **Home → Step 2: Send All via Backend** (or **Data → 🚀 Send All (Backend)**) — enqueues
   every pending, non-duplicate email. Already-sent emails are skipped.
4. **Dashboard tab** — see every sent email with **📖 Opened / 🔗 Clicked** status, plus
   **💬 Replies** after connecting Gmail.

**Test Mail to Myself** always sends via the backend (with tracking); on backend failure
it falls back to a Gmail draft (no tracking).

## 5. Gmail replies (Dashboard → 💬 Replies)

Replies are read with the **Gmail API (OAuth)**, not SMTP:

1. In **Google Cloud Console**, create an **OAuth 2.0 Client ID** (type: Chrome Extension),
   using your extension's ID.
2. Put the client ID into `manifest.json` → `oauth2.client_id`.
3. In the extension **Dashboard** tab, click **🔗 Connect Gmail** and approve.
4. Recent inbox threads (From + Subject) load into the Replies list.

Scope used: `gmail.readonly`. No emails are sent via Gmail API — only read.

## 6. API

| Method | Endpoint | Auth | Notes |
|--------|----------|------|-------|
| GET | `/health` | api-key | liveness |
| GET | `/api/queue` | api-key | job counts |
| POST | `/api/send` | api-key | `{ "emails": [ { to, subject, body, replyTo?, founderId? } ] }` |
| GET | `/api/sent` | api-key | recent sent emails + open/click status (for Dashboard) |
| GET | `/api/tracking/:id` | api-key | status for one email |
| GET | `/track/open/:id.png` | public | open pixel |
| GET | `/track/click/:id?to=URL` | public | click redirect + log |

## Tracking notes

- **Open** tracking = invisible 1×1 pixel; fires when the client loads remote images.
- **Click** tracking = links rewritten through the backend, logged, then 302-redirect.
- Pixels only fire if `PUBLIC_BASE_URL` is publicly reachable and images are loaded.
- Adds minor spam risk; some clients block images (no open signal).

## Caveats

- Rate limit is server-side (`QUEUE_*` env).
- Failed sends retry `JOB_ATTEMPTS` times, then are marked failed.
- The queue lives in Redis — restarting Redis loses in-flight jobs.
- Backend mode **sends directly**. Gmail "draft/send" modes still work via the legacy
  "Start Batch Process" button.
