-- POPS Assess: schema for a dedicated Supabase project (multi-practitioner).
-- Each educational psychologist (EP) signs up, is approved by the POPS admin, and sees only their own sessions.

create table if not exists public.assessors (
  user_id uuid primary key references auth.users on delete cascade,
  display_name text not null default '',
  practice text not null default '',
  hcpc_no text not null default '',
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  is_admin boolean not null default false,
  licence_until date,
  created_at timestamptz not null default now()
);
create table if not exists public.assess_tests (
  key text primary key, title text not null, intro text, stop_after int not null, sort int not null default 0,
  stop_mode text not null default 'consec'
);
create table if not exists public.assess_items (
  test_key text not null references public.assess_tests on delete cascade,
  ord int not null, item_id text not null, level int not null, skill text,
  payload jsonb not null, answer jsonb,
  primary key (test_key, ord)
);
create table if not exists public.assess_levels (
  test_key text not null references public.assess_tests(key) on delete cascade,
  level int not null, year_label text not null, year_num numeric not null,
  age_from int not null, age_to int not null, basis text,
  primary key (test_key, level)
);
create table if not exists public.assess_sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  assessor_id uuid not null references auth.users on delete cascade,
  child_ref text not null,
  test_key text not null references public.assess_tests,
  plan text[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting','running','paused','ended')),
  stimulus jsonb,
  stimulus_seq int not null default 0,
  setup jsonb not null default '{}'::jsonb,
  summary jsonb,
  created_at timestamptz not null default now(),
  started_at timestamptz, ended_at timestamptz
);
create index if not exists assess_sessions_owner on public.assess_sessions(assessor_id, created_at desc);
create table if not exists public.assess_responses (
  session_id uuid not null references public.assess_sessions on delete cascade,
  test_key text not null,
  ord int not null, item_id text not null, level int not null, skill text,
  child_answer text, mark int not null check (mark in (0,1)), flag text, ms int, note text,
  created_at timestamptz not null default now(),
  primary key (session_id, test_key, ord)
);
create table if not exists public.assess_child_answers (
  session_id uuid not null references public.assess_sessions on delete cascade,
  seq int not null, answer text, answered_at timestamptz not null default now(),
  primary key (session_id, seq)
);

alter table public.assessors enable row level security;
alter table public.assess_tests enable row level security;
alter table public.assess_items enable row level security;
alter table public.assess_levels enable row level security;
alter table public.assess_sessions enable row level security;
alter table public.assess_responses enable row level security;
alter table public.assess_child_answers enable row level security;

-- An active, in-licence EP
create or replace function public.is_assessor() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.assessors where user_id = auth.uid() and status = 'active' and (licence_until is null or licence_until >= current_date)) $$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.assessors where user_id = auth.uid() and status = 'active' and is_admin) $$;

-- Create the EP profile (pending) when someone signs up through the assessment console
create or replace function public.assess_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'app','') = 'assess' then
    insert into public.assessors(user_id, display_name, practice, hcpc_no)
    values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name',''),80), left(coalesce(new.raw_user_meta_data->>'practice',''),120), left(coalesce(new.raw_user_meta_data->>'hcpc_no',''),30))
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists assess_on_signup on auth.users;
create trigger assess_on_signup after insert on auth.users for each row execute function public.assess_new_user();

-- Admin tools (security definer; admin only)
create or replace function public.admin_list_assessors() returns table(user_id uuid, email text, confirmed boolean, display_name text, practice text, hcpc_no text, status text, is_admin boolean, licence_until date, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query select a.user_id, u.email::text, u.email_confirmed_at is not null, a.display_name, a.practice, a.hcpc_no, a.status, a.is_admin, a.licence_until, a.created_at
    from public.assessors a join auth.users u on u.id = a.user_id order by a.created_at desc;
end $$;
create or replace function public.admin_set_assessor(p_user uuid, p_status text, p_licence date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  if p_status not in ('pending','active','suspended') then raise exception 'bad status'; end if;
  update public.assessors set status = p_status, licence_until = p_licence where user_id = p_user and not (is_admin and user_id = auth.uid() and p_status <> 'active');
end $$;

-- Policies
drop policy if exists a_self on public.assessors;
create policy a_self on public.assessors for select to authenticated using (user_id = auth.uid());
drop policy if exists a_self_upd on public.assessors;
create policy a_self_upd on public.assessors for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists a_tests on public.assess_tests;
create policy a_tests on public.assess_tests for select to authenticated using (public.is_assessor());
drop policy if exists a_items on public.assess_items;
create policy a_items on public.assess_items for select to authenticated using (public.is_assessor());
drop policy if exists a_levels on public.assess_levels;
create policy a_levels on public.assess_levels for select to authenticated using (public.is_assessor());
drop policy if exists a_sessions on public.assess_sessions;
create policy a_sessions on public.assess_sessions for all to authenticated
  using (assessor_id = auth.uid() and public.is_assessor())
  with check (assessor_id = auth.uid() and public.is_assessor());
drop policy if exists a_resp on public.assess_responses;
create policy a_resp on public.assess_responses for all to authenticated
  using (public.is_assessor() and exists (select 1 from public.assess_sessions s where s.id = session_id and s.assessor_id = auth.uid()))
  with check (public.is_assessor() and exists (select 1 from public.assess_sessions s where s.id = session_id and s.assessor_id = auth.uid()));
drop policy if exists a_ca on public.assess_child_answers;
create policy a_ca on public.assess_child_answers for select to authenticated
  using (public.is_assessor() and exists (select 1 from public.assess_sessions s where s.id = session_id and s.assessor_id = auth.uid()));

revoke all on public.assessors, public.assess_tests, public.assess_items, public.assess_levels, public.assess_sessions, public.assess_responses, public.assess_child_answers from anon, authenticated;
grant select on public.assess_tests, public.assess_items, public.assess_levels, public.assess_child_answers to authenticated;
grant select on public.assessors to authenticated;
grant update (display_name, practice, hcpc_no) on public.assessors to authenticated;
grant select, insert, update, delete on public.assess_sessions, public.assess_responses to authenticated;
grant all on public.assessors, public.assess_tests, public.assess_items, public.assess_levels, public.assess_sessions, public.assess_responses, public.assess_child_answers to service_role;

-- The child's page: no sign-in. It sees only the current screen of a live session, found by its code (valid for 24 hours).
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

revoke all on function public.child_view(text), public.child_answer(text,int,text), public.is_assessor(), public.is_admin(), public.admin_list_assessors(), public.admin_set_assessor(uuid,text,date), public.assess_new_user() from public, anon, authenticated;
grant execute on function public.child_view(text), public.child_answer(text,int,text) to anon, authenticated;
grant execute on function public.is_assessor(), public.is_admin(), public.admin_list_assessors(), public.admin_set_assessor(uuid,text,date) to authenticated;
