# suresquare-marketing

The public marketing site for **suresquare.bid**: static HTML plus one serverless function. The SureSquare app itself lives at **suresquare.app** in a separate Vercel project.

## What's here

| Path | What it is |
|---|---|
| `index.html`, `crm.html`, `pricing.html`, `about.html`, `waitlist.html` | Marketing pages (served without `.html` thanks to `cleanUrls`) |
| `terms.html`, `privacy.html`, `estimating-disclaimer.html` | Legal pages. Terms and Privacy are marked as drafts until reviewed. |
| `404.html` | Branded not-found page |
| `assets/` | Shared stylesheet, favicon, app icons, social share image |
| `api/waitlist.js` | `POST /api/waitlist`: saves sign-ups to Supabase and optionally emails sales via Postmark |
| `supabase/leads.sql` | One-time SQL that creates the `leads` table |
| `vercel.json` | Clean URLs, redirects from the old Softr paths, security headers |

No build step and no dependencies. To edit copy, edit the HTML directly. Every page shares `assets/site.css`, and the header and footer are repeated in each page.

## Setup

1. **Supabase:** open the SQL editor, paste `supabase/leads.sql` and run it. Then copy the Project URL and the `service_role` key from *Project Settings → API*.
2. **Vercel:** Add New → Project → import this repo. Choose the "Other" framework preset, leave the build settings blank and deploy.
3. **Environment variables** (Vercel → this project → Settings → Environment Variables), followed by a redeploy:
   - `SUPABASE_URL` (required)
   - `SUPABASE_SERVICE_ROLE_KEY` (required, server-only, never put it in the repo)
   - `POSTMARK_SERVER_TOKEN` (optional, enables an email to sales for each sign-up)
   - `NOTIFY_TO` (optional, default `sales@suresquare.bid`)
   - `NOTIFY_FROM` (optional, default `SureSquare Website <hello@suresquare.bid>`; must be a Postmark-verified sender)
4. **Test** on the `*.vercel.app` URL: submit the waitlist form and check that a row appears in Supabase → Table editor → `leads`.
5. **Domain:** once it works, add `suresquare.bid` and `www.suresquare.bid` under Settings → Domains, update DNS at the registrar as Vercel instructs, then remove the domain from Softr.

## Local preview

```bash
npx vercel dev        # full site including /api/waitlist (needs the env vars locally)
# or, pages only:
npx serve .
```
