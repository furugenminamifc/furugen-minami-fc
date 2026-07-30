-- 古堅南FC Ver.9.0 試合評価・コーチコメント・AIアドバイス
-- Supabase SQL Editorで1回だけ実行してください。

create extension if not exists pgcrypto;

create table if not exists public.player_match_evaluations (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  match_id text not null,
  attack integer not null default 3 check (attack between 1 and 5),
  defense integer not null default 3 check (defense between 1 and 5),
  passing integer not null default 3 check (passing between 1 and 5),
  dribbling integer not null default 3 check (dribbling between 1 and 5),
  shooting integer not null default 3 check (shooting between 1 and 5),
  decision_making integer not null default 3 check (decision_making between 1 and 5),
  work_rate integer not null default 3 check (work_rate between 1 and 5),
  communication integer not null default 3 check (communication between 1 and 5),
  good_points text not null default '',
  improvement_points text not null default '',
  next_goal text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, match_id)
);

create index if not exists player_match_evaluations_player_idx
  on public.player_match_evaluations(player_id, created_at desc);

create index if not exists player_match_evaluations_match_idx
  on public.player_match_evaluations(match_id);

alter table public.player_match_evaluations enable row level security;

drop policy if exists "player_match_eval_staff_read" on public.player_match_evaluations;
create policy "player_match_eval_staff_read" on public.player_match_evaluations
for select to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.active=true
      and p.role in ('admin','coach')
  )
);

drop policy if exists "player_match_eval_staff_write" on public.player_match_evaluations;
create policy "player_match_eval_staff_write" on public.player_match_evaluations
for all to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.active=true
      and p.role in ('admin','coach')
  )
)
with check (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid()
      and p.active=true
      and p.role in ('admin','coach')
  )
);

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='player_match_evaluations'
  ) then
    alter publication supabase_realtime add table public.player_match_evaluations;
  end if;
end $$;
