# Architecture

The static React app uses Supabase anonymous Auth. `unlock` checks the PIN against salted bcrypt hashes, records failed attempts, pauses unlocking after 5 failures in 15 minutes, and maps the browser to the owner's profile. The owner's name and photo are stored only in the database (`profiles.display_name`, `profiles.avatar`) and are read after unlock, so the site bundle contains nothing identifying. RLS limits reads to the owner's room. The PIN is never stored in the frontend.

`pomodoro_command` validates membership and changes timer, focus session, break and emoji status in one database transaction. `sync_room` settles expired phases from saved timestamps. Realtime changes trigger reloads, so the timer stays in sync across her devices; the client also syncs while visible and on reconnect. Focus intervals subtract pauses and clip to the local day.

The room shows her card, today's focus time (or the running session), the pomodoro timer, and today's focus, completed sessions and longest session. History shows the 100 most recent completed sessions, five at a time.

Design tokens live in `src/styles.css` (pink `--pink` palette, faint photo wallpaper); room layout lives in `src/pages/room.css`. `src/pages/DemoRoom.tsx` renders the room with sample data at `#/demo` in development builds only.
