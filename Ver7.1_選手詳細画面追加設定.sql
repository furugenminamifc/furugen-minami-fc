-- 古堅南FC Ver.7.1 選手詳細画面 追加設定
-- Supabase SQL Editorで1回だけ実行してください。

alter table public.players add column if not exists birth_date date;
alter table public.players add column if not exists dominant_foot text;
alter table public.players add column if not exists height_cm numeric;
alter table public.players add column if not exists weight_kg numeric;
alter table public.players add column if not exists strengths text not null default '';
alter table public.players add column if not exists development_goal text not null default '';

create table if not exists public.player_private (
  player_id text primary key,
  fatigue_level integer not null default 3 check (fatigue_level between 1 and 5),
  condition_level integer not null default 3 check (condition_level between 1 and 5),
  coach_note text not null default '',
  guardian_name text not null default '',
  guardian_phone text not null default '',
  guardian_email text not null default '',
  emergency_contact text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.player_private enable row level security;

drop policy if exists "player_private_staff_read" on public.player_private;
create policy "player_private_staff_read" on public.player_private
for select to authenticated
using (
  exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')
  )
);

drop policy if exists "player_private_staff_write" on public.player_private;
create policy "player_private_staff_write" on public.player_private
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
    where pubname='supabase_realtime' and schemaname='public' and tablename='player_private'
  ) then
    alter publication supabase_realtime add table public.player_private;
  end if;
end $$;
