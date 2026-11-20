-- v5: second-marker fields, retest linking (pseudonymous hash, not reversible without the child reference)
alter table public.assess_pool add column if not exists cls text, add column if not exists cls2 text, add column if not exists score int, add column if not exists score2 int, add column if not exists child_link text, add column if not exists week date;
create index if not exists assess_pool_link on public.assess_pool(child_link);
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
  insert into public.assess_pool(batch, contributor, test_key, item_id, level, form, probe, mark, ms, value, value2, age_years, year_group, device, connection, quiet, adult, eal, audio, month, cls, cls2, score, score2, child_link, week)
  select b, a.pool_key, r.test_key, r.item_id, r.level, coalesce(i.payload->>'form', 'A'), coalesce((i.payload->>'probe')::boolean, false), r.mark,
    case when r.ms between 0 and 120000 then r.ms end,
    case when r.test_key = 'fluency' then (r.child_answer::jsonb->>'wcpm')::numeric when r.test_key = 'ran' then (r.child_answer::jsonb->>'secs')::numeric end,
    case when r.test_key in ('fluency','ran') then (r.child_answer::jsonb->>'errors')::numeric end,
    age, nullif(s.setup->>'year_group','')::int, left(s.setup->>'device',24), left(s.setup->>'connection',24), left(s.setup->>'quiet',24), left(s.setup->>'adult',40), left(s.setup->>'eal',40), left(s.setup->>'audio',24),
    date_trunc('month', coalesce(s.started_at, s.created_at))::date,
    r.meta->>'cls', r.meta->>'m2cls', nullif(r.meta->>'score','')::int, nullif(r.meta->>'m2score','')::int,
    md5(a.pool_key::text || '|' || lower(trim(s.child_ref))), date_trunc('week', coalesce(s.started_at, s.created_at))::date
  from public.assess_responses r left join public.assess_items i on i.test_key = r.test_key and i.item_id = r.item_id
  where r.session_id = p_session;
  update public.assess_sessions set setup = setup || jsonb_build_object('pool_batch', b, 'pool_at', now()) where id = p_session;
  return b;
end $$;
