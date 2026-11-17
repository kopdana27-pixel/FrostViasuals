create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  role text not null default 'player'
    check (role in ('player','admin','owner')),
  created_at timestamptz not null default now()
);

create table if not exists public.visual_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Мой профиль',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.mod_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  minecraft_version text not null,
  download_url text not null,
  changelog text not null default '',
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('admin','owner')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'owner'
  );
$$;

create or replace function public.create_frost_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists frost_user_created on auth.users;
create trigger frost_user_created
after insert on auth.users
for each row execute procedure public.create_frost_profile();

alter table public.profiles enable row level security;
alter table public.visual_profiles enable row level security;
alter table public.news enable row level security;
alter table public.mod_releases enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profile read own or staff" on public.profiles;
create policy "profile read own or staff"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_staff()));

drop policy if exists "profile update own" on public.profiles;
revoke update on public.profiles from authenticated;
grant update (username, avatar_url) on public.profiles to authenticated;
create policy "profile update own"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "visual profiles own or staff" on public.visual_profiles;
create policy "visual profiles own or staff"
on public.visual_profiles for all to authenticated
using (user_id = (select auth.uid()) or (select public.is_staff()))
with check (user_id = (select auth.uid()) or (select public.is_staff()));

drop policy if exists "published news visible" on public.news;
create policy "published news visible"
on public.news for select
using (published = true or (select public.is_staff()));

drop policy if exists "staff manage news" on public.news;
create policy "staff manage news"
on public.news for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "published mods visible" on public.mod_releases;
create policy "published mods visible"
on public.mod_releases for select
using (published = true or (select public.is_staff()));

drop policy if exists "staff manage mods" on public.mod_releases;
create policy "staff manage mods"
on public.mod_releases for all to authenticated
using ((select public.is_staff()))
with check ((select public.is_staff()));

drop policy if exists "staff read audit" on public.audit_logs;
create policy "staff read audit"
on public.audit_logs for select to authenticated
using ((select public.is_staff()));

drop policy if exists "staff write audit" on public.audit_logs;
create policy "staff write audit"
on public.audit_logs for insert to authenticated
with check ((select public.is_staff()));

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.visual_profiles to authenticated;
grant select on public.news, public.mod_releases to anon, authenticated;
grant insert, update, delete on public.news, public.mod_releases to authenticated;
grant select, insert on public.audit_logs to authenticated;

