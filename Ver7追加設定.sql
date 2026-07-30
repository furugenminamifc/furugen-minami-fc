-- 古堅南FC Ver.7.0 追加設定（Supabase SQL Editorで1回だけ実行）
create extension if not exists pgcrypto;

create table if not exists public.ai_plans (
  id uuid primary key default gen_random_uuid(),
  plan_type text not null check (plan_type in ('lineup','substitution','match_report','parents','season')),
  title text not null default '',
  content text not null,
  match_id uuid references public.matches(id) on delete set null,
  season text,
  input_data jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists ai_plans_created_at_idx on public.ai_plans(created_at desc);
create index if not exists ai_plans_match_id_idx on public.ai_plans(match_id);
alter table public.ai_plans enable row level security;

drop policy if exists "ai_plans_read" on public.ai_plans;
create policy "ai_plans_read" on public.ai_plans for select using (true);

drop policy if exists "ai_plans_staff_write" on public.ai_plans;
create policy "ai_plans_staff_write" on public.ai_plans for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','coach')));
