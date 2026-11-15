-- Creates the owner's profile, PIN, photo and room. Run after the migrations.
-- Replace OWNER_NAME_HERE and OWNER_PIN_HERE before running, and never commit the real PIN:
-- this repository is public, and even a hashed 4-digit PIN is easy to crack offline.
insert into public.profiles(display_name) values ('OWNER_NAME_HERE') on conflict(display_name) do nothing;
insert into private.identity_secrets(profile_id, passcode_hash)
select id, extensions.crypt('OWNER_PIN_HERE', extensions.gen_salt('bf')) from public.profiles where display_name = 'OWNER_NAME_HERE'
on conflict(profile_id) do update set passcode_hash = excluded.passcode_hash;

insert into public.rooms(name) select 'OWNER_NAME_HERE' where not exists(select 1 from public.rooms where name = 'OWNER_NAME_HERE');
insert into public.room_members(room_id, user_id)
select r.id, p.id from public.rooms r cross join public.profiles p
where r.name = 'OWNER_NAME_HERE' and p.display_name = 'OWNER_NAME_HERE'
on conflict do nothing;
insert into public.user_statuses(room_id, user_id)
select r.id, p.id from public.rooms r cross join public.profiles p
where r.name = 'OWNER_NAME_HERE' and p.display_name = 'OWNER_NAME_HERE'
on conflict do nothing;
