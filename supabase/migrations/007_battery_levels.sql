alter table public.assess_tests add column if not exists stop_mode text not null default 'consec';
alter table public.assess_sessions add column if not exists plan text[] not null default '{}';
alter table public.assess_responses add column if not exists test_key text;
update public.assess_responses r set test_key = s.test_key from public.assess_sessions s where s.id = r.session_id and r.test_key is null;
alter table public.assess_responses alter column test_key set not null;
alter table public.assess_responses drop constraint if exists assess_responses_pkey;
alter table public.assess_responses add primary key (session_id, test_key, ord);
create table if not exists public.assess_levels (
  test_key text not null references public.assess_tests(key) on delete cascade,
  level int not null, year_label text not null, year_num numeric not null,
  age_from int not null, age_to int not null, basis text,
  primary key (test_key, level));
alter table public.assess_levels enable row level security;
drop policy if exists a_levels on public.assess_levels;
create policy a_levels on public.assess_levels for select to authenticated using (public.is_assessor());
grant select on public.assess_levels to authenticated;
grant all on public.assess_levels to service_role;
