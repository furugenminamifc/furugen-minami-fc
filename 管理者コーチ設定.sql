-- 先に Supabase「認証」→「ユーザー」で管理者ユーザーを作成してください。
-- 下の USER_UUID と名前を置き換えて実行します。
insert into public.profiles(id,display_name,role,active)
values('USER_UUID','儀間 隼人','admin',true)
on conflict(id) do update set display_name=excluded.display_name,role='admin',active=true;

-- コーチを追加する例
-- insert into public.profiles(id,display_name,role,active)
-- values('COACH_USER_UUID','コーチ名','coach',true)
-- on conflict(id) do update set display_name=excluded.display_name,role='coach',active=true;
