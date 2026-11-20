-- POPS Assess v4: response metadata, consent-based anonymised pooling, admin export.
alter table public.assess_responses add column if not exists meta jsonb;
alter table public.assessors add column if not exists pool_optin boolean not null default false;
alter table public.assessors add column if not exists pool_key uuid not null default gen_random_uuid();
grant update (pool_optin) on public.assessors to authenticated;

-- Anonymised pooled item-level data. No names, dates of birth, schools, free text or child answers.
-- Age is whole years only; date is the month only. `batch` is a random token held in the EP's own session so a contribution can be withdrawn.
create table if not exists public.assess_pool (
  id bigint generated always as identity primary key,
  batch uuid not null, contributor uuid not null,
  test_key text not null, item_id text not null, level int, form text, probe boolean not null default false,
  mark int, ms int, value numeric, value2 numeric,
  age_years int, year_group int, device text, connection text, quiet text, adult text, eal text, audio text,
  month date not null
);
create index if not exists assess_pool_item on public.assess_pool(test_key, item_id);
create index if not exists assess_pool_batch on public.assess_pool(batch);
alter table public.assess_pool enable row level security;
revoke all on public.assess_pool from anon, authenticated;
grant all on public.assess_pool to service_role;

create or replace function public.pool_submit(p_session uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare s public.assess_sessions; a public.assessors; b uuid := gen_random_uuid(); dob date; age int;
begin
  if not public.is_assessor() then raise exception 'not allowed'; end if;
  select * into s from public.assess_sessions where id = p_session and assessor_id = auth.uid();
  if s.id is null then raise exception 'session not found'; end if;
  select * into a from public.assessors where user_id = auth.uid();
  if not a.pool_optin then raise exception 'contributing anonymised data is not switched on for your account'; end if;
  if s.status <> 'ended' then raise exception 'finish the session first'; end if;
  if coalesce((s.setup->>'preview')::boolean, false) then raise exception 'preview sessions are never pooled'; end if;
  if coalesce((s.setup->>'pool_consent')::boolean, false) is not true then raise exception 'consent for pooling was not recorded for this child'; end if;
  if s.setup ? 'pool_batch' then raise exception 'this session has already been contributed'; end if;
  begin dob := (s.setup->>'dob')::date; exception when others then dob := null; end;
  age := case when dob is null then null else extract(year from age(coalesce(s.started_at, s.created_at)::date, dob))::int end;
  insert into public.assess_pool(batch, contributor, test_key, item_id, level, form, probe, mark, ms, value, value2, age_years, year_group, device, connection, quiet, adult, eal, audio, month)
  select b, a.pool_key, r.test_key, r.item_id, r.level, coalesce(i.payload->>'form', 'A'), coalesce((i.payload->>'probe')::boolean, false), r.mark,
    case when r.ms between 0 and 120000 then r.ms end,
    case when r.test_key = 'fluency' then (r.child_answer::jsonb->>'wcpm')::numeric when r.test_key = 'ran' then (r.child_answer::jsonb->>'secs')::numeric end,
    case when r.test_key in ('fluency','ran') then (r.child_answer::jsonb->>'errors')::numeric end,
    age, nullif(s.setup->>'year_group','')::int, left(s.setup->>'device',24), left(s.setup->>'connection',24), left(s.setup->>'quiet',24), left(s.setup->>'adult',40), left(s.setup->>'eal',40), left(s.setup->>'audio',24),
    date_trunc('month', coalesce(s.started_at, s.created_at))::date
  from public.assess_responses r left join public.assess_items i on i.test_key = r.test_key and i.item_id = r.item_id
  where r.session_id = p_session;
  update public.assess_sessions set setup = setup || jsonb_build_object('pool_batch', b, 'pool_at', now()) where id = p_session;
  return b;
end $$;

create or replace function public.pool_withdraw(p_session uuid) returns int
language plpgsql security definer set search_path = public as $$
declare s public.assess_sessions; n int; k uuid;
begin
  if not public.is_assessor() then raise exception 'not allowed'; end if;
  select * into s from public.assess_sessions where id = p_session and assessor_id = auth.uid();
  if s.id is null or not (s.setup ? 'pool_batch') then return 0; end if;
  select pool_key into k from public.assessors where user_id = auth.uid();
  delete from public.assess_pool where batch = (s.setup->>'pool_batch')::uuid and contributor = k;
  get diagnostics n = row_count;
  update public.assess_sessions set setup = (setup - 'pool_batch') - 'pool_at' where id = p_session;
  return n;
end $$;

create or replace function public.admin_pool_stats() returns table(test_key text, items bigint, rows bigint, batches bigint, contributors bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query select p.test_key, count(distinct p.item_id), count(*), count(distinct p.batch), count(distinct p.contributor) from public.assess_pool p group by p.test_key order by p.test_key;
end $$;
create or replace function public.admin_pool_export(p_from bigint default 0, p_limit int default 5000) returns setof public.assess_pool
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  return query select * from public.assess_pool where id > p_from order by id limit least(p_limit, 20000);
end $$;

revoke all on function public.pool_submit(uuid), public.pool_withdraw(uuid), public.admin_pool_stats(), public.admin_pool_export(bigint,int) from public, anon;
grant execute on function public.pool_submit(uuid), public.pool_withdraw(uuid), public.admin_pool_stats(), public.admin_pool_export(bigint,int) to authenticated;
