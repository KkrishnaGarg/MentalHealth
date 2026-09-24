-- =====================================================================
-- LNMIIT HSS Academic Stress Study - schema, RLS, RPC, views
--
-- Privacy model: CONFIDENTIAL (not anonymous).
--   respondents  = identity   (admin-only)
--   responses    = scores     (admin-only, linked by random UUID)
--   answers      = raw values (admin-only)
-- No IP address, user-agent or device metadata is stored anywhere.
-- =====================================================================

-- ---------- Tables -------------------------------------------------

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

create table public.survey_versions (
  id           uuid primary key default gen_random_uuid(),
  version      integer not null unique check (version > 0),
  status       text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  created_at   timestamptz not null default now(),
  published_at timestamptz,
  closed_at    timestamptz
);
-- At most one published and one draft version at any time.
create unique index one_published_version on public.survey_versions (status) where status = 'published';
create unique index one_draft_version on public.survey_versions (status) where status = 'draft';

create table public.questions (
  id                uuid primary key default gen_random_uuid(),
  survey_version_id uuid not null references public.survey_versions (id) on delete cascade,
  key               text not null check (key ~ '^[a-z0-9_]+$'),
  section           text not null check (section in ('pss10', 'stressors', 'open_ended', 'demographics')),
  type              text not null check (type in ('likert', 'single', 'text', 'number')),
  text              text not null check (char_length(text) between 1 and 1000),
  options           jsonb,
  reverse_scored    boolean not null default false,
  subscale          text check (subscale in ('helplessness', 'self_efficacy')),
  required          boolean not null default true,
  locked            boolean not null default false,
  position          integer not null,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (survey_version_id, key),
  check ((type in ('likert', 'single')) = (options is not null)),
  check (subscale is null or section = 'pss10')
);
create index questions_version_idx on public.questions (survey_version_id, position);

create table public.respondents (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 200),
  roll_no      text not null unique check (char_length(roll_no) between 1 and 40),
  email        text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  year         smallint not null check (year between 1 and 4),
  branch       text not null check (char_length(branch) between 1 and 60),
  consented_at timestamptz not null,
  created_at   timestamptz not null default now()
);

create table public.responses (
  id                 uuid primary key default gen_random_uuid(),
  respondent_id      uuid not null unique references public.respondents (id) on delete cascade,
  survey_version_id  uuid not null references public.survey_versions (id),
  submitted_at       timestamptz not null default now(),
  total_time_s       integer check (total_time_s between 0 and 86400),
  pss_score          smallint not null check (pss_score between 0 and 40),
  helplessness_score smallint not null check (helplessness_score between 0 and 24),
  self_efficacy_score smallint not null check (self_efficacy_score between 0 and 16),
  check (pss_score = helplessness_score + self_efficacy_score)
);
create index responses_version_idx on public.responses (survey_version_id);

create table public.answers (
  response_id uuid not null references public.responses (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  value       jsonb not null,
  primary key (response_id, question_id)
);

create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references auth.users (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- Data-cleaning decisions: flags are computed, decisions are recorded here.
-- Nothing is ever deleted automatically.
create table public.cleaning_decisions (
  id            uuid primary key default gen_random_uuid(),
  respondent_id uuid references public.respondents (id) on delete set null,
  response_id   uuid references public.responses (id) on delete set null,
  flag_type     text not null check (flag_type in ('fast', 'incomplete', 'duplicate_email', 'straightline', 'other')),
  decision      text not null check (decision in ('keep', 'exclude', 'needs_review')),
  reason        text not null check (char_length(reason) between 1 and 1000),
  admin_id      uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index cleaning_decisions_response_idx on public.cleaning_decisions (response_id);

-- ---------- Helpers ------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();

-- ---------- Instrument protection ----------------------------------
-- Enforced in the database, not just the UI:
--   * questions may only change while their survey version is a DRAFT
--   * locked rows (the PSS-10 core instrument) are immutable and undeletable
--   * only the seed / clone function (no app user) may create locked rows

create or replace function public.guard_question_change() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_status text;
  v_vid    uuid := coalesce(new.survey_version_id, old.survey_version_id);
begin
  if tg_op = 'UPDATE' and new.survey_version_id <> old.survey_version_id then
    raise exception 'question_version_immutable' using errcode = 'P0001';
  end if;

  select status into v_status from public.survey_versions where id = v_vid;
  -- v_status is null only while a whole version is being cascade-deleted.
  if v_status is not null and v_status <> 'draft' then
    raise exception 'version_locked' using errcode = 'P0001';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.locked then
    raise exception 'locked_instrument' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' and new.locked
     and auth.uid() is not null
     and coalesce(current_setting('app.allow_locked_insert', true), '') <> '1' then
    raise exception 'locked_instrument' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and new.locked and not old.locked then
    raise exception 'locked_instrument' using errcode = 'P0001';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger questions_guard before insert or update or delete on public.questions
  for each row execute function public.guard_question_change();

-- ---------- Version management RPCs (admin only) ------------------

create or replace function public.clone_survey_version(source_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_new uuid;
  v_num integer;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.survey_versions where id = source_id) then
    raise exception 'invalid_version' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.survey_versions where status = 'draft') then
    raise exception 'draft_exists' using errcode = 'P0001';
  end if;

  select coalesce(max(version), 0) + 1 into v_num from public.survey_versions;
  insert into public.survey_versions (version, status) values (v_num, 'draft') returning id into v_new;

  perform set_config('app.allow_locked_insert', '1', true);
  insert into public.questions
    (survey_version_id, key, section, type, text, options, reverse_scored, subscale, required, locked, position, active)
  select v_new, key, section, type, text, options, reverse_scored, subscale, required, locked, position, active
  from public.questions where survey_version_id = source_id;
  perform set_config('app.allow_locked_insert', '', true);

  return v_new;
end;
$$;

create or replace function public.publish_survey_version(version_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.survey_versions where id = version_id and status = 'draft') then
    raise exception 'not_a_draft' using errcode = 'P0001';
  end if;
  if (select count(*) from public.questions
      where survey_version_id = version_id and section = 'pss10' and locked and active) <> 10 then
    raise exception 'pss10_incomplete' using errcode = 'P0001';
  end if;

  update public.survey_versions set status = 'closed', closed_at = now() where status = 'published';
  update public.survey_versions set status = 'published', published_at = now() where id = version_id;
end;
$$;

create or replace function public.close_survey_version(version_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.survey_versions set status = 'closed', closed_at = now()
    where id = version_id and status = 'published';
  if not found then raise exception 'not_published' using errcode = 'P0001'; end if;
end;
$$;

-- Atomic reorder: reassigns the positions already used by these questions.
-- SECURITY INVOKER: RLS + guard_question_change() still apply (draft only, no locked rows).
create or replace function public.reorder_questions(ordered_ids uuid[]) returns void
language plpgsql set search_path = '' as $$
declare
  v_positions integer[];
  i integer;
begin
  select array_agg(position order by position) into v_positions
    from public.questions where id = any (ordered_ids);
  if v_positions is null
     or array_length(v_positions, 1) <> array_length(ordered_ids, 1)
     or (select count(distinct survey_version_id) from public.questions where id = any (ordered_ids)) <> 1 then
    raise exception 'invalid_reorder' using errcode = 'P0001';
  end if;
  for i in 1 .. array_length(ordered_ids, 1) loop
    update public.questions set position = v_positions[i] where id = ordered_ids[i];
  end loop;
end;
$$;

-- ---------- Submission RPC (server-only) --------------------------
-- One atomic transaction: any exception rolls back the respondent,
-- response and every answer. Scores are computed here from question
-- metadata (reverse_scored, subscale) - never from question positions.
-- Scores are NOT returned to the caller.

create or replace function public.submit_survey(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_version   public.survey_versions%rowtype;
  v_r         jsonb := payload -> 'respondent';
  v_resp_id   uuid;
  v_person_id uuid;
  v_time      integer;
  v_seen      uuid[] := '{}';
  a           record;
  q           public.questions%rowtype;
  v_txt       text;
  v_val       jsonb;
  v_pss_n     integer;
  v_pss_need  integer;
  v_help      integer;
  v_self      integer;
begin
  select * into v_version from public.survey_versions
    where id = (payload ->> 'survey_version_id')::uuid;
  if not found or v_version.status <> 'published' then
    raise exception 'survey_not_open' using errcode = 'P0001';
  end if;
  if coalesce((payload ->> 'consented')::boolean, false) is not true then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;

  v_time := least(greatest(coalesce((payload ->> 'total_time_s')::integer, 0), 0), 86400);

  begin
    insert into public.respondents (name, roll_no, email, year, branch, consented_at)
    values (
      btrim(v_r ->> 'name'),
      upper(btrim(v_r ->> 'roll_no')),
      lower(btrim(v_r ->> 'email')),
      (v_r ->> 'year')::smallint,
      btrim(v_r ->> 'branch'),
      now()
    ) returning id into v_person_id;
  exception when unique_violation then
    raise exception 'duplicate_submission' using errcode = 'P0001';
  end;

  -- Placeholder scores; real values are written after validation below.
  insert into public.responses (respondent_id, survey_version_id, total_time_s, pss_score, helplessness_score, self_efficacy_score)
  values (v_person_id, v_version.id, v_time, 0, 0, 0)
  returning id into v_resp_id;

  for a in
    select (e ->> 'question_id')::uuid as qid, e -> 'value' as val
    from jsonb_array_elements(payload -> 'answers') e
  loop
    v_val := a.val;
    if a.qid = any (v_seen) then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
    v_seen := v_seen || a.qid;

    select * into q from public.questions
      where id = a.qid and survey_version_id = v_version.id and active;
    if not found then raise exception 'invalid_question' using errcode = 'P0001'; end if;

    -- Unanswered optional text: nothing stored.
    if v_val is null or jsonb_typeof(v_val) = 'null' then
      if q.required then raise exception 'missing_required' using errcode = 'P0001'; end if;
      v_seen := array_remove(v_seen, a.qid);
      continue;
    end if;

    if q.type in ('likert', 'single') then
      if not exists (select 1 from jsonb_array_elements(q.options) o where o -> 'value' = v_val) then
        raise exception 'invalid_answer' using errcode = 'P0001';
      end if;
    elsif q.type = 'text' then
      if jsonb_typeof(v_val) <> 'string' then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
      v_txt := btrim(v_val #>> '{}');
      if char_length(v_txt) > 2000 then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
      if v_txt = '' then
        if q.required then raise exception 'missing_required' using errcode = 'P0001'; end if;
        v_seen := array_remove(v_seen, a.qid);
        continue;
      end if;
      v_val := to_jsonb(v_txt);
    elsif q.type = 'number' then
      if jsonb_typeof(v_val) <> 'number' then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
    end if;

    insert into public.answers (response_id, question_id, value) values (v_resp_id, q.id, v_val);
  end loop;

  if exists (
    select 1 from public.questions qq
    where qq.survey_version_id = v_version.id and qq.active and qq.required
      and not (qq.id = any (v_seen))
  ) then
    raise exception 'missing_required' using errcode = 'P0001';
  end if;

  -- PSS-10 scoring from metadata: reverse_scored items use (4 - value).
  select count(*) into v_pss_need from public.questions
    where survey_version_id = v_version.id and section = 'pss10' and active;
  select count(*),
         coalesce(sum(case when qq.subscale = 'helplessness'
                           then case when qq.reverse_scored then 4 - (an.value #>> '{}')::int else (an.value #>> '{}')::int end end), 0),
         coalesce(sum(case when qq.subscale = 'self_efficacy'
                           then case when qq.reverse_scored then 4 - (an.value #>> '{}')::int else (an.value #>> '{}')::int end end), 0)
    into v_pss_n, v_help, v_self
  from public.answers an
  join public.questions qq on qq.id = an.question_id
  where an.response_id = v_resp_id and qq.section = 'pss10';

  if v_pss_n <> 10 or v_pss_need <> 10 then
    raise exception 'pss10_incomplete' using errcode = 'P0001';
  end if;

  update public.responses
     set pss_score = v_help + v_self,
         helplessness_score = v_help,
         self_efficacy_score = v_self
   where id = v_resp_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- Export / analysis views (admin only, RLS applies) ------

create or replace view public.research_dataset with (security_invoker = true) as
select
  r.respondent_id,
  sv.version                     as survey_version,
  p.year,
  p.branch,
  r.pss_score,
  r.helplessness_score,
  r.self_efficacy_score,
  r.total_time_s,
  r.submitted_at,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_1')  as pss_1,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_2')  as pss_2,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_3')  as pss_3,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_4')  as pss_4,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_5')  as pss_5,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_6')  as pss_6,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_7')  as pss_7,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_8')  as pss_8,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_9')  as pss_9,
  max((a.value #>> '{}')::int) filter (where q.key = 'pss_10') as pss_10,
  max((a.value #>> '{}')::int) filter (where q.key = 'stressor_workload')    as stressor_workload,
  max((a.value #>> '{}')::int) filter (where q.key = 'stressor_exams')       as stressor_exams,
  max((a.value #>> '{}')::int) filter (where q.key = 'stressor_cgpa')        as stressor_cgpa,
  max((a.value #>> '{}')::int) filter (where q.key = 'stressor_finance')     as stressor_finance,
  max((a.value #>> '{}')::int) filter (where q.key = 'stressor_placement')   as stressor_placement,
  max((a.value #>> '{}')::int) filter (where q.key = 'stressor_sleep')       as stressor_sleep,
  max((a.value #>> '{}')::int) filter (where q.key = 'stressor_personal')    as stressor_personal,
  max(a.value #>> '{}') filter (where q.key = 'demo_residence')              as residence,
  max(a.value #>> '{}') filter (where q.key = 'demo_income')                 as family_income_bracket
from public.responses r
join public.respondents p on p.id = r.respondent_id
join public.survey_versions sv on sv.id = r.survey_version_id
left join public.answers a on a.response_id = r.id
left join public.questions q on q.id = a.question_id
group by r.id, sv.version, p.year, p.branch;

-- Long format: every non-open-ended answer, keyed by question (covers custom
-- questions added in later versions). No identity fields.
create or replace view public.research_answers_long with (security_invoker = true) as
select r.respondent_id, sv.version as survey_version, q.key as question_key, q.section,
       q.text as question_text, a.value #>> '{}' as value
from public.answers a
join public.responses r on r.id = a.response_id
join public.survey_versions sv on sv.id = r.survey_version_id
join public.questions q on q.id = a.question_id
where q.section <> 'open_ended';

-- Raw open-ended text for thematic coding. Identity-free but sensitive: admin only.
create or replace view public.open_ended_responses with (security_invoker = true) as
select r.respondent_id, r.submitted_at, sv.version as survey_version,
       q.key as question_key, q.text as question_text, a.value #>> '{}' as response_text
from public.answers a
join public.responses r on r.id = a.response_id
join public.survey_versions sv on sv.id = r.survey_version_id
join public.questions q on q.id = a.question_id
where q.section = 'open_ended';

create or replace view public.admin_dataset with (security_invoker = true) as
select p.id as respondent_id, p.name, p.roll_no, p.email, p.year, p.branch,
       d.survey_version, d.pss_score, d.helplessness_score, d.self_efficacy_score,
       d.total_time_s, d.submitted_at
from public.respondents p
join public.responses r on r.respondent_id = p.id
join public.research_dataset d on d.respondent_id = p.id;

-- ---------- Row Level Security ------------------------------------

alter table public.profiles           enable row level security;
alter table public.survey_versions    enable row level security;
alter table public.questions          enable row level security;
alter table public.respondents        enable row level security;
alter table public.responses          enable row level security;
alter table public.answers            enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.cleaning_decisions enable row level security;

-- Reset default grants, then grant only what RLS policies build on.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant select on public.survey_versions, public.questions to anon, authenticated;
grant select on public.profiles, public.respondents, public.responses, public.answers,
                public.audit_logs, public.cleaning_decisions,
                public.research_dataset, public.admin_dataset,
                public.research_answers_long, public.open_ended_responses to authenticated;
grant insert, update, delete on public.questions to authenticated;
grant insert on public.audit_logs, public.cleaning_decisions to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.clone_survey_version(uuid), public.publish_survey_version(uuid),
                          public.close_survey_version(uuid), public.reorder_questions(uuid[]) to authenticated;
grant execute on function public.submit_survey(jsonb) to service_role;
-- POST /api/submit reads the published version and its questions as service_role.
grant usage on schema public to service_role;
grant select on public.survey_versions, public.questions to service_role;

-- profiles: a user can read only their own row (used by the admin gate).
create policy profiles_self_select on public.profiles
  for select to authenticated using (id = auth.uid());

-- survey_versions: public sees only the published version; admins see all.
create policy versions_public_select on public.survey_versions
  for select to anon, authenticated using (status = 'published');
create policy versions_admin_select on public.survey_versions
  for select to authenticated using (public.is_admin());

-- questions: public sees only active questions of the published version.
create policy questions_public_select on public.questions
  for select to anon, authenticated using (
    active and exists (
      select 1 from public.survey_versions v
      where v.id = survey_version_id and v.status = 'published'
    )
  );
create policy questions_admin_select on public.questions
  for select to authenticated using (public.is_admin());
create policy questions_admin_insert on public.questions
  for insert to authenticated with check (public.is_admin());
create policy questions_admin_update on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy questions_admin_delete on public.questions
  for delete to authenticated using (public.is_admin());

-- respondents / responses / answers: NO public access of any kind.
-- Submission happens only through submit_survey() (service role).
create policy respondents_admin_select on public.respondents
  for select to authenticated using (public.is_admin());
create policy responses_admin_select on public.responses
  for select to authenticated using (public.is_admin());
create policy answers_admin_select on public.answers
  for select to authenticated using (public.is_admin());

-- audit_logs: admins read and append; nobody updates or deletes.
create policy audit_admin_select on public.audit_logs
  for select to authenticated using (public.is_admin());
create policy audit_admin_insert on public.audit_logs
  for insert to authenticated with check (public.is_admin() and admin_id = auth.uid());

-- cleaning_decisions: admins read and append.
create policy cleaning_admin_select on public.cleaning_decisions
  for select to authenticated using (public.is_admin());
create policy cleaning_admin_insert on public.cleaning_decisions
  for insert to authenticated with check (public.is_admin() and admin_id = auth.uid());

-- ---------- Realtime (admin dashboard live counts) -----------------
do $$
begin
  alter publication supabase_realtime add table public.responses;
exception when undefined_object or duplicate_object then
  raise notice 'supabase_realtime publication not available or table already added';
end $$;
