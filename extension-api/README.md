# Job Founder Hunter - Vercel API

Next.js backend deployed on Vercel. Uses Gmail SMTP (Nodemailer) for sending emails with open/click tracking.

## Local Development

```bash
cd vercel-api
npm install
cp .env.local .env.local  # edit with your values
npm run dev
```

Server runs at `http://localhost:3000`

## Deploy on Vercel

1. Push this repo to GitHub
2. Go to https://vercel.com/new
3. Import `vercel-api/` as a project
4. Set Environment Variables in Vercel Dashboard:
   - `API_KEY` = `job-founder-hunter-dev-key` (or any secret)
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `465`
   - `SMTP_SECURE` = `true`
   - `SMTP_USER` = `gaurav07c@gmail.com`
   - `SMTP_PASS` = your Gmail App Password (16 chars, no spaces)
   - `MAIL_FROM` = `Gaurav Kumar <gaurav07c@gmail.com>`
   - `PUBLIC_BASE_URL` = your Vercel URL after deploy (e.g. `https://jfh-vercel-api.vercel.app`)
5. Deploy

## Connect Extension

1. My Profile → Backend URL = your Vercel URL
2. API Key = same as `API_KEY` env
3. Test Backend Connection → ✅
4. Save

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/api/send` | API Key | Send email(s) with tracking |
| GET | `/api/sent` | API Key | List sent emails with tracking status |
| GET | `/track/open/:id.png` | No | Open tracking pixel |
| GET | `/track/click?id=...&to=...` | No | Click tracking + redirect |

## Notes

- CORS enabled globally (`*` origin)
- Gmail SMTP works on Vercel (no port blocking)
- Tracking data is in-memory (lost on cold start)
- Free tier: 100k function calls/month
