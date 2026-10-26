-- Beta feedback, authenticated testers only. Apply to the confirmed test Supabase project.
-- No access to other users' feedback from the client.
create table if not exists public.beta_feedback (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 area text not null check (area in ('首頁','收藏庫','我的旅行','購物清單','每日行程','旅行錢包','帳號登入','其他')),
 feedback_type text not null check (feedback_type in ('問題回報','功能建議','使用感想')),
 rating integer check (rating between 1 and 5),
 message text not null check (char_length(trim(message)) between 10 and 2000),
 page_path text not null default '',
 created_at timestamptz not null default now()
);
create index if not exists beta_feedback_created_idx on public.beta_feedback(created_at desc);
alter table public.beta_feedback enable row level security;
drop policy if exists "beta_feedback_insert_own" on public.beta_feedback;
create policy "beta_feedback_insert_own" on public.beta_feedback
for insert to authenticated with check (user_id=(select auth.uid()));
-- No SELECT/UPDATE/DELETE policy: feedback is read by the project owner using Supabase dashboard.
