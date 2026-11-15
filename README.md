# Study Room

A private pomodoro study room for one person. The sign-in screen is anonymous; the room, history and timer appear only after the PIN is entered.

## Stack

React, Vite, TypeScript, Tailwind CSS, Supabase (anonymous Auth, Postgres, Realtime, an Edge Function for push), and GitHub Pages.

## Set up Supabase

1. Apply every file in [`supabase/migrations`](supabase/migrations) in order, in the SQL editor or with the Supabase CLI. `202611150001_single_owner.sql` deletes all earlier data; `202611150002_private_identity.sql` adds PIN-only unlock, an attempt limit (5 wrong tries per 15 minutes) and the owner photo column.
2. In Authentication → Providers, enable **Anonymous Sign-Ins**.
3. Open [`supabase/seed.sql`](supabase/seed.sql), replace `OWNER_NAME_HERE` and `OWNER_PIN_HERE`, and run it in the SQL editor. Set the photo with `update public.profiles set avatar = 'data:image/webp;base64,…'`; keep that SQL out of the repository. Do not commit the real PIN: the repository is public, and a hashed 4-digit PIN is easy to crack offline.
4. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_VAPID_PUBLIC_KEY`. These are public client values. Never put a service role key in the frontend.
5. In Realtime settings, enable private channels.
6. For closed-browser push, deploy the Edge Function and cron job: see [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Develop

```bash
npm install
npm run dev
```

Open `http://localhost:5173/#/demo` to see the room with sample data (development only, no database needed).

Checks: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.

## Deploy to GitHub Pages

Push to `main` with GitHub repository variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_VAPID_PUBLIC_KEY` set, and **GitHub Actions** selected as the Pages source. Vite derives the base path from the repository name. Add the published `https://OWNER.github.io/REPOSITORY/**` URL to Supabase Auth redirect URLs.
