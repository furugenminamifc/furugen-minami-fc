-- 古堅南FC Ver.4 追加設定（何度実行しても安全です）
alter table public.players add column if not exists photo_url text;

create table if not exists public.team_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.team_settings enable row level security;

drop policy if exists "team_settings_read_all" on public.team_settings;
create policy "team_settings_read_all" on public.team_settings
for select using (true);

drop policy if exists "team_settings_staff_write" on public.team_settings;
create policy "team_settings_staff_write" on public.team_settings
for all using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','coach'))
) with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.active=true and p.role in ('admin','coach'))
);

insert into public.team_settings(key,value) values
('team_name','古堅南FC'),('emblem_url','')
on conflict(key) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='team_settings'
  ) then
    alter publication supabase_realtime add table public.team_settings;
  end if;
end $$;
