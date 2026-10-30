-- Todo 앱 스키마 (Supabase SQL Editor에 통째로 붙여 넣어 실행)
-- 여러 번 실행해도 안전하도록 작성됨.

create table if not exists public.todos (
  id         bigint generated always as identity primary key,
  -- 소유 사용자. 값을 안 보내면 로그인한 사용자의 id가 자동으로 들어간다.
  user_id    uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  title      text not null check (length(btrim(title)) > 0 and length(title) <= 200),
  is_done    boolean not null default false,
  due_date   date,                                  -- 마감일(선택)
  created_at timestamptz not null default now()
);

create index if not exists idx_todos_user_due on public.todos (user_id, due_date);

-- RLS 켜기: 정책에 허용된 접근만 가능
alter table public.todos enable row level security;
alter table public.todos force row level security;

-- 정책: 로그인한 사용자(authenticated)가 자기 행만 조회·추가·수정·삭제
drop policy if exists "todos_select_own" on public.todos;
create policy "todos_select_own" on public.todos
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "todos_insert_own" on public.todos;
create policy "todos_insert_own" on public.todos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "todos_update_own" on public.todos;
create policy "todos_update_own" on public.todos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_delete_own" on public.todos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 비로그인(anon)에게는 표 권한 자체를 주지 않는다.
revoke all on public.todos from anon;
grant select, insert, update, delete on public.todos to authenticated;
