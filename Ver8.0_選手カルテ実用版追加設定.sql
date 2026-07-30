-- 古堅南FC Ver.8.0 選手カルテ実用版 追加設定
-- Supabase SQL Editorで1回だけ実行してください。

create extension if not exists pgcrypto;

create table if not exists public.player_medical_records (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  record_date date not null,
  body_part text not null default '',
  diagnosis text not null default '',
  severity integer not null default 3 check (severity between 1 and 5),
  participation_status text not null default 'full'
    check (participation_status in ('full','limited','rest','absent')),
  return_date date,
  clinic text not null default '',
  visit_status text not null default 'none'
    check (visit_status in ('none','scheduled','visited','treatment','cleared')),
  action_note text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_medical_records_player_date_idx
  on public.player_medical_records(player_id, record_date desc);

alter table public.player_medical_records enable row level security;

drop policy if exists "player_medical_staff_read" on public.player_medical_records;
create policy "player_medical_staff_read" on public.player_medical_records
for select to authenticated
using (
  exists(select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach'))
);

drop policy if exists "player_medical_staff_write" on public.player_medical_records;
create policy "player_medical_staff_write" on public.player_medical_records
for all to authenticated
using (
  exists(select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach'))
)
with check (
  exists(select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach'))
);

create table if not exists public.player_skill_evaluations (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  evaluation_date date not null,
  dribbling integer not null default 3 check (dribbling between 1 and 5),
  passing integer not null default 3 check (passing between 1 and 5),
  shooting integer not null default 3 check (shooting between 1 and 5),
  defending integer not null default 3 check (defending between 1 and 5),
  speed integer not null default 3 check (speed between 1 and 5),
  decision_making integer not null default 3 check (decision_making between 1 and 5),
  physical integer not null default 3 check (physical between 1 and 5),
  mental integer not null default 3 check (mental between 1 and 5),
  comment text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, evaluation_date)
);

create index if not exists player_skill_evaluations_player_date_idx
  on public.player_skill_evaluations(player_id, evaluation_date desc);

alter table public.player_skill_evaluations enable row level security;

drop policy if exists "player_skill_staff_read" on public.player_skill_evaluations;
create policy "player_skill_staff_read" on public.player_skill_evaluations
for select to authenticated
using (
  exists(select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach'))
);

drop policy if exists "player_skill_staff_write" on public.player_skill_evaluations;
create policy "player_skill_staff_write" on public.player_skill_evaluations
for all to authenticated
using (
  exists(select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach'))
)
with check (
  exists(select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach'))
);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='player_medical_records'
  ) then
    alter publication supabase_realtime add table public.player_medical_records;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='player_skill_evaluations'
  ) then
    alter publication supabase_realtime add table public.player_skill_evaluations;
  end if;
end $$;
