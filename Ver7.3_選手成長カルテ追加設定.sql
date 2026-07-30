-- 古堅南FC Ver.7.3 選手成長カルテ 追加設定
-- Supabase SQL Editorで1回だけ実行してください。

create extension if not exists pgcrypto;

create table if not exists public.player_growth_records (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  record_date date not null,
  height_cm numeric,
  weight_kg numeric,
  sleep_hours numeric,
  fatigue_level integer not null default 3 check (fatigue_level between 1 and 5),
  condition_level integer not null default 3 check (condition_level between 1 and 5),
  injury_status text not null default 'none'
    check (injury_status in ('none','watch','injured','returning')),
  training_status text not null default 'full'
    check (training_status in ('full','limited','rest','absent')),
  coach_score integer not null default 3 check (coach_score between 1 and 5),
  note text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, record_date)
);

create index if not exists player_growth_records_player_date_idx
  on public.player_growth_records(player_id, record_date desc);

alter table public.player_growth_records enable row level security;

drop policy if exists "player_growth_staff_read" on public.player_growth_records;
create policy "player_growth_staff_read" on public.player_growth_records
for select to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')
  )
);

drop policy if exists "player_growth_staff_write" on public.player_growth_records;
create policy "player_growth_staff_write" on public.player_growth_records
for all to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')
  )
)
with check (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')
  )
);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='player_growth_records'
  ) then
    alter publication supabase_realtime add table public.player_growth_records;
  end if;
end $$;
