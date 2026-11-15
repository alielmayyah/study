-- Keep the owner's name and photo out of the frontend: the browser unlocks with
-- the PIN alone, then reads the name and photo from the database.

begin;

-- The photo lives in the profile row (a data: URL), readable only after unlock via RLS.
alter table public.profiles add column if not exists avatar text;

-- Global attempt log: the PIN is checked against every profile, so limit globally.
create table if not exists private.unlock_attempts (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now()
);
create index if not exists unlock_attempts_recent on private.unlock_attempts(attempted_at desc);

create or replace function public.unlock(p_passcode text)
returns uuid language plpgsql security definer
set search_path = public, private, extensions as $$
declare match uuid; recent integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtext('unlock'));
  select count(*) into recent from private.unlock_attempts
    where attempted_at > now() - interval '15 minutes';
  if recent >= 5 then raise exception 'Too many attempts'; end if;

  select s.profile_id into match from private.identity_secrets s
    where p_passcode is not null and extensions.crypt(p_passcode, s.passcode_hash) = s.passcode_hash
    limit 1;

  if match is null then
    -- Return null instead of raising so the failed attempt is committed.
    insert into private.unlock_attempts default values;
    return null;
  end if;

  delete from private.unlock_attempts where attempted_at <= now();
  insert into public.profile_access(auth_user_id, profile_id) values(auth.uid(), match)
    on conflict(auth_user_id) do update set profile_id = excluded.profile_id;
  return match;
end;
$$;
revoke all on function public.unlock(text) from public, anon;
grant execute on function public.unlock(text) to authenticated;

-- The old name-based unlock is no longer used by the app.
revoke execute on function public.unlock_identity(text, text) from authenticated;

commit;
