-- POPS remote assessment tool: tables, access rules and the two functions the child's page may call.
create table if not exists public.assessors (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null
);
create table if not exists public.assess_tests (
  key text primary key, title text not null, intro text, stop_after int not null, sort int not null default 0
);
create table if not exists public.assess_items (
  test_key text not null references public.assess_tests on delete cascade,
  ord int not null, item_id text not null, level int not null, skill text,
  payload jsonb not null, answer jsonb,
  primary key (test_key, ord)
);
create table if not exists public.assess_sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  assessor_id uuid not null references auth.users on delete cascade,
  child_ref text not null,
  test_key text not null references public.assess_tests,
  status text not null default 'waiting' check (status in ('waiting','running','paused','ended')),
  stimulus jsonb,
  stimulus_seq int not null default 0,
  setup jsonb not null default '{}'::jsonb,
  summary jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz, ended_at timestamptz
);
create table if not exists public.assess_responses (
  session_id uuid not null references public.assess_sessions on delete cascade,
  ord int not null, item_id text not null, level int not null, skill text,
  child_answer text, mark int not null check (mark in (0,1)), flag text, ms int, note text,
  created_at timestamptz not null default now(),
  primary key (session_id, ord)
);
create table if not exists public.assess_child_answers (
  session_id uuid not null references public.assess_sessions on delete cascade,
  seq int not null, answer text, answered_at timestamptz not null default now(),
  primary key (session_id, seq)
);

alter table public.assessors enable row level security;
alter table public.assess_tests enable row level security;
alter table public.assess_items enable row level security;
alter table public.assess_sessions enable row level security;
alter table public.assess_responses enable row level security;
alter table public.assess_child_answers enable row level security;

create or replace function public.is_assessor() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.assessors where user_id = auth.uid()) $$;

drop policy if exists a_self on public.assessors;
create policy a_self on public.assessors for select to authenticated using (user_id = auth.uid());
drop policy if exists a_tests on public.assess_tests;
create policy a_tests on public.assess_tests for select to authenticated using (public.is_assessor());
drop policy if exists a_items on public.assess_items;
create policy a_items on public.assess_items for select to authenticated using (public.is_assessor());
drop policy if exists a_sessions on public.assess_sessions;
create policy a_sessions on public.assess_sessions for all to authenticated
  using (assessor_id = auth.uid() and public.is_assessor())
  with check (assessor_id = auth.uid() and public.is_assessor());
drop policy if exists a_resp on public.assess_responses;
create policy a_resp on public.assess_responses for all to authenticated
  using (exists (select 1 from public.assess_sessions s where s.id = session_id and s.assessor_id = auth.uid()))
  with check (exists (select 1 from public.assess_sessions s where s.id = session_id and s.assessor_id = auth.uid()));
drop policy if exists a_ca on public.assess_child_answers;
create policy a_ca on public.assess_child_answers for select to authenticated
  using (exists (select 1 from public.assess_sessions s where s.id = session_id and s.assessor_id = auth.uid()));

revoke all on public.assessors, public.assess_tests, public.assess_items, public.assess_sessions, public.assess_responses, public.assess_child_answers from anon, authenticated;
grant select on public.assessors, public.assess_tests, public.assess_items, public.assess_child_answers to authenticated;
grant select, insert, update, delete on public.assess_sessions, public.assess_responses to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

-- The child's page: no sign-in. It can only see the current stimulus of a live session, found by its code (valid for 24 hours).
create or replace function public.child_view(p_code text) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('status', s.status, 'seq', s.stimulus_seq, 'stimulus', s.stimulus, 'title', t.title, 'intro', t.intro)
  from public.assess_sessions s join public.assess_tests t on t.key = s.test_key
  where s.code = upper(trim(p_code)) and s.created_at > now() - interval '24 hours'
$$;

create or replace function public.child_answer(p_code text, p_seq int, p_answer text) returns boolean
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  select id into sid from public.assess_sessions
   where code = upper(trim(p_code)) and status = 'running' and stimulus_seq = p_seq and created_at > now() - interval '24 hours';
  if sid is null then return false; end if;
  insert into public.assess_child_answers(session_id, seq, answer) values (sid, p_seq, left(coalesce(p_answer,''), 200))
  on conflict (session_id, seq) do update set answer = excluded.answer, answered_at = now();
  return true;
end $$;

revoke all on function public.child_view(text), public.child_answer(text,int,text) from public;
grant execute on function public.child_view(text), public.child_answer(text,int,text) to anon, authenticated;
revoke all on function public.is_assessor() from public, anon;
grant execute on function public.is_assessor() to authenticated;
