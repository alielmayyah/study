-- Convert the shared two-person room into a private single-owner room.
-- WARNING: permanently deletes every existing profile, room, study session,
-- break, timer, status, goal, event and push subscription. Run once.

begin;

-- 1. Wipe all old data. TRUNCATE ... CASCADE also clears every table that
--    references these (profile_access, identity_secrets, room_members,
--    study_sessions, study_breaks, pomodoro_states, user_statuses,
--    daily_goals, room_events, push_subscriptions, push_log).
truncate table public.profiles, public.rooms cascade;

-- 2. Remove partner-only features.
drop function if exists public.partner_start_notifications();
drop function if exists private.partner_start_notifications();
drop function if exists public.partner_push_status(uuid);

-- 3. Limit PIN guessing. A 4-digit PIN has only 10,000 options, so failed
--    attempts are recorded and unlocking pauses after 5 failures in 15 minutes.
create table if not exists private.unlock_failures (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists unlock_failures_recent
  on private.unlock_failures(profile_id, attempted_at desc);

create or replace function public.unlock_identity(p_name text, p_passcode text)
returns uuid language plpgsql security definer
set search_path = public, private, extensions as $$
declare profile_uuid uuid; saved_hash text; recent_failures integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select p.id, s.passcode_hash into profile_uuid, saved_hash
    from public.profiles p join private.identity_secrets s on s.profile_id = p.id
    where p.display_name = p_name;
  if profile_uuid is null then return null; end if;

  -- Serialize attempts for this profile so parallel guesses can't skip the limit.
  perform pg_advisory_xact_lock(hashtext(profile_uuid::text));
  select count(*) into recent_failures from private.unlock_failures
    where profile_id = profile_uuid and attempted_at > now() - interval '15 minutes';
  if recent_failures >= 5 then raise exception 'Too many attempts'; end if;

  if p_passcode is null or extensions.crypt(p_passcode, saved_hash) is distinct from saved_hash then
    -- Return null instead of raising so the failure row is committed.
    insert into private.unlock_failures(profile_id) values (profile_uuid);
    return null;
  end if;

  delete from private.unlock_failures where profile_id = profile_uuid;
  delete from private.unlock_failures where attempted_at < now() - interval '1 day';
  insert into public.profile_access(auth_user_id, profile_id) values(auth.uid(), profile_uuid)
    on conflict(auth_user_id) do update set profile_id = excluded.profile_id;
  return profile_uuid;
end;
$$;
revoke all on function public.unlock_identity(text, text) from public, anon;
grant execute on function public.unlock_identity(text, text) to authenticated;

commit;
