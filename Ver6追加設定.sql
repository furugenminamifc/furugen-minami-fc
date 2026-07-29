-- 古堅南FC Ver.6 追加設定（Supabase SQL Editorで1回だけ実行）
create extension if not exists pgcrypto;

create table if not exists public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  report_type text not null check (report_type in ('coach','parents','training')),
  title text not null default '',
  content text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.video_notes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade,
  timestamp text default '',
  event_type text default 'その他',
  player_id uuid references public.players(id) on delete set null,
  note text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.ai_reports enable row level security;
alter table public.video_notes enable row level security;

drop policy if exists "ai_reports_read" on public.ai_reports;
create policy "ai_reports_read" on public.ai_reports for select using (true);
drop policy if exists "video_notes_read" on public.video_notes;
create policy "video_notes_read" on public.video_notes for select using (true);

drop policy if exists "ai_reports_staff_write" on public.ai_reports;
create policy "ai_reports_staff_write" on public.ai_reports for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')));

drop policy if exists "video_notes_staff_write" on public.video_notes;
create policy "video_notes_staff_write" on public.video_notes for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')));
