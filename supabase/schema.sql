-- Frost Visuals database schema. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null default 'Player' check (char_length(username) between 1 and 16),
  role text not null default 'player' check (role in ('player','admin','owner')),
  level integer not null default 1 check (level >= 1),
  xp integer not null default 0 check (xp >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.visual_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 5000),
  author_id uuid references public.profiles(id) on delete set null,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.cosmetics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  rarity text not null default 'Обычная',
  price_points integer not null default 0 check (price_points >= 0),
  preview_emoji text not null default '✧',
  active boolean not null default true
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1), 'Player'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists visual_profiles_touch on public.visual_profiles;
create trigger visual_profiles_touch before update on public.visual_profiles
for each row execute procedure public.touch_updated_at();

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','owner')); $$;
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'owner'); $$;

alter table public.profiles enable row level security;
alter table public.visual_profiles enable row level security;
alter table public.news enable row level security;
alter table public.cosmetics enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles read self or staff" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_staff());
-- Only staff can update profile rows. Admins may assign player/admin;
-- only an existing Owner may retain/assign the owner role.
create policy "staff update profiles" on public.profiles for update to authenticated
using (public.is_staff())
with check (
  public.is_owner()
  or (public.is_staff() and role in ('player','admin'))
);

create policy "own visual profiles" on public.visual_profiles for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "published news public read" on public.news for select
using (published = true or public.is_staff());
create policy "staff insert news" on public.news for insert to authenticated
with check (public.is_staff() and author_id = auth.uid());
create policy "staff update news" on public.news for update to authenticated
using (public.is_staff()) with check (public.is_staff());

create policy "active cosmetics public read" on public.cosmetics for select
using (active = true or public.is_staff());
create policy "owner manage cosmetics" on public.cosmetics for all to authenticated
using (public.is_owner()) with check (public.is_owner());

create policy "staff read audit logs" on public.audit_logs for select to authenticated
using (public.is_staff());
create policy "staff write audit logs" on public.audit_logs for insert to authenticated
with check (public.is_staff() and actor_id = auth.uid());

insert into public.cosmetics(name,description,rarity,price_points,preview_emoji) values
('Violet Aura','Фиолетовая тема профиля','Обычная',100,'✧'),
('Frost Emblem','Значок снежинки','Редкая',250,'❄'),
('Aurora Frame','Рамка профиля','Эпическая',500,'◇')
on conflict do nothing;

-- After registering your own account, promote it to Owner manually:
-- update public.profiles set role = 'owner' where id = 'YOUR_AUTH_USER_UUID';
