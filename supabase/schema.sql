
create extension if not exists "pgcrypto";

create type public.team_role as enum ('owner', 'coach', 'staff', 'parent', 'player');
create type public.job_status as enum ('queued', 'processing', 'completed', 'failed');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.team_role not null default 'parent',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  number text,
  name text not null,
  grade text,
  position text,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  played_on date,
  opponent text,
  competition text,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  storage_path text not null,
  status public.job_status not null default 'queued',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.analysis_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  player_id uuid references public.players(id) on delete set null,
  event_type text not null,
  video_time numeric not null default 0,
  period text,
  x numeric,
  y numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  job_type text not null,
  status public.job_status not null default 'queued',
  progress integer not null default 0 check (progress between 0 and 100),
  message text,
  result jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.videos enable row level security;
alter table public.analysis_events enable row level security;
alter table public.processing_jobs enable row level security;

create or replace function public.is_team_member(target_team uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_team(target_team uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.team_members
    where team_id = target_team
      and user_id = auth.uid()
      and role in ('owner','coach','staff')
  );
$$;

create policy "members can view teams" on public.teams
for select using (public.is_team_member(id));

create policy "users can create teams" on public.teams
for insert with check (created_by = auth.uid());

create policy "members can view memberships" on public.team_members
for select using (public.is_team_member(team_id));

create policy "owners and coaches manage memberships" on public.team_members
for all using (public.can_edit_team(team_id)) with check (public.can_edit_team(team_id));

create policy "members view players" on public.players
for select using (public.is_team_member(team_id));
create policy "staff edit players" on public.players
for all using (public.can_edit_team(team_id)) with check (public.can_edit_team(team_id));

create policy "members view matches" on public.matches
for select using (public.is_team_member(team_id));
create policy "staff edit matches" on public.matches
for all using (public.can_edit_team(team_id)) with check (public.can_edit_team(team_id));

create policy "members view videos" on public.videos
for select using (public.is_team_member(team_id));
create policy "staff edit videos" on public.videos
for all using (public.can_edit_team(team_id)) with check (public.can_edit_team(team_id));

create policy "members view events" on public.analysis_events
for select using (public.is_team_member(team_id));
create policy "staff edit events" on public.analysis_events
for all using (public.can_edit_team(team_id)) with check (public.can_edit_team(team_id));

create policy "members view jobs" on public.processing_jobs
for select using (public.is_team_member(team_id));
create policy "staff manage jobs" on public.processing_jobs
for all using (public.can_edit_team(team_id)) with check (public.can_edit_team(team_id));

alter publication supabase_realtime add table public.analysis_events;
alter publication supabase_realtime add table public.processing_jobs;

insert into storage.buckets (id, name, public)
values ('match-videos', 'match-videos', false)
on conflict (id) do nothing;

create policy "team members read match videos"
on storage.objects for select
using (
  bucket_id = 'match-videos'
  and public.is_team_member((storage.foldername(name))[1]::uuid)
);

create policy "staff upload match videos"
on storage.objects for insert
with check (
  bucket_id = 'match-videos'
  and public.can_edit_team((storage.foldername(name))[1]::uuid)
);
