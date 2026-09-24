-- =====================================================================
-- 002: Google-Forms-style questions
--   * all question types in every category: single choice (incl. true/false),
--     multiple choice, labelled scale, numeric-range scale, number, text
--   * compulsory / optional on every question
--   * PSS-10 is no longer locked: everything is editable in a DRAFT version
--   * published/closed versions are still frozen; edit = new draft version
--   * scoring is driven by question metadata (subscale, reverse_scored) and
--     is generic (any number of scored items, any scale range)
-- Safe to run on a database that already has 001 (+ old seed) applied.
-- Run order for a NEW database: 001, 002, seed.sql.
-- =====================================================================

-- ---------- Questions table ----------------------------------------

alter table public.questions add column if not exists config jsonb;

-- Drop the old CHECK constraints (names are auto-generated) and re-add named ones.
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.questions'::regclass and contype = 'c' loop
    execute format('alter table public.questions drop constraint %I', c.conname);
  end loop;
end $$;

-- Migrate legacy data (temporarily bypass the published-version guard; owner-only).
alter table public.questions disable trigger questions_guard;
update public.questions
   set type = 'scale',
       options = null,
       config = jsonb_build_object(
         'min', 1, 'max', 5,
         'min_label', 'Very low contribution', 'max_label', 'Very high contribution')
 where section = 'stressors' and type = 'likert' and config is null;
alter table public.questions drop column if exists locked;
alter table public.questions enable trigger questions_guard;

alter table public.questions
  add constraint questions_key_check     check (key ~ '^[a-z0-9_]+$'),
  add constraint questions_text_check    check (char_length(text) between 1 and 1000),
  add constraint questions_section_check check (section in ('pss10', 'stressors', 'open_ended', 'demographics')),
  add constraint questions_type_check    check (type in ('likert', 'single', 'multi', 'scale', 'number', 'text')),
  add constraint questions_shape_check   check (
    (type in ('likert', 'single', 'multi') and options is not null and config is null)
    or (type = 'scale' and options is null and config is not null)
    or (type in ('text', 'number') and options is null)
  ),
  add constraint questions_subscale_check check (subscale is null or type in ('likert', 'scale'));

-- ---------- Responses: scores are optional (a version may have no scored items)

alter table public.responses alter column pss_score drop not null;
alter table public.responses alter column helplessness_score drop not null;
alter table public.responses alter column self_efficacy_score drop not null;
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.responses'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ~ '(pss_score|helplessness_score|self_efficacy_score)' loop
    execute format('alter table public.responses drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.responses
  add constraint responses_scores_nonneg check (
    coalesce(pss_score, 0) >= 0 and coalesce(helplessness_score, 0) >= 0 and coalesce(self_efficacy_score, 0) >= 0);

-- ---------- Draft-only editing guard -------------------------------

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
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- ---------- Version management -------------------------------------

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

  insert into public.questions
    (survey_version_id, key, section, type, text, options, config, reverse_scored, subscale, required, position, active)
  select v_new, key, section, type, text, options, config, reverse_scored, subscale, required, position, active
  from public.questions where survey_version_id = source_id;

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
  if not exists (select 1 from public.questions where survey_version_id = version_id and active) then
    raise exception 'no_questions' using errcode = 'P0001';
  end if;

  update public.survey_versions set status = 'closed', closed_at = now() where status = 'published';
  update public.survey_versions set status = 'published', published_at = now() where id = version_id;
end;
$$;

-- Discard an unpublished draft (never a published/closed version, which own responses).
create or replace function public.discard_draft_version(version_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.survey_versions where id = version_id and status = 'draft';
  if not found then raise exception 'not_a_draft' using errcode = 'P0001'; end if;
end;
$$;
revoke all on function public.discard_draft_version(uuid) from public, anon;
grant execute on function public.discard_draft_version(uuid) to authenticated;

-- ---------- Submission RPC (server-only) ---------------------------
-- Same atomic contract as 001; now validates every question type and
-- computes the scores generically from metadata:
--   scored item = active question with a non-null subscale (likert/scale)
--   reverse-scored item value = (scale_min + scale_max) - value
--   pss_score = helplessness + self_efficacy; null when nothing is scored.

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
  v_val       jsonb;
  v_txt       text;
  v_num       numeric;
  v_lo        numeric;
  v_hi        numeric;
  v_scored_n  integer := 0;
  v_help      numeric := 0;
  v_self      numeric := 0;
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

  insert into public.responses (respondent_id, survey_version_id, total_time_s)
  values (v_person_id, v_version.id, v_time)
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

    -- Blank answer: allowed only for optional questions; nothing stored.
    if v_val is null or jsonb_typeof(v_val) = 'null'
       or (jsonb_typeof(v_val) = 'array' and jsonb_array_length(v_val) = 0)
       or (jsonb_typeof(v_val) = 'string' and btrim(v_val #>> '{}') = '') then
      if q.required then raise exception 'missing_required' using errcode = 'P0001'; end if;
      v_seen := array_remove(v_seen, a.qid);
      continue;
    end if;

    if q.type in ('likert', 'single') then
      if not exists (select 1 from jsonb_array_elements(q.options) o where o -> 'value' = v_val) then
        raise exception 'invalid_answer' using errcode = 'P0001';
      end if;

    elsif q.type = 'multi' then
      if jsonb_typeof(v_val) <> 'array'
         or jsonb_array_length(v_val) > jsonb_array_length(q.options)
         or (select count(distinct x) from jsonb_array_elements(v_val) x) <> jsonb_array_length(v_val)
         or exists (
           select 1 from jsonb_array_elements(v_val) x
           where not exists (select 1 from jsonb_array_elements(q.options) o where o -> 'value' = x)) then
        raise exception 'invalid_answer' using errcode = 'P0001';
      end if;

    elsif q.type = 'scale' then
      if jsonb_typeof(v_val) <> 'number' then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
      v_num := (v_val #>> '{}')::numeric;
      if v_num <> trunc(v_num)
         or v_num < (q.config ->> 'min')::numeric or v_num > (q.config ->> 'max')::numeric then
        raise exception 'invalid_answer' using errcode = 'P0001';
      end if;

    elsif q.type = 'number' then
      if jsonb_typeof(v_val) <> 'number' then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
      v_num := (v_val #>> '{}')::numeric;
      if (q.config ? 'min' and v_num < (q.config ->> 'min')::numeric)
         or (q.config ? 'max' and v_num > (q.config ->> 'max')::numeric) then
        raise exception 'invalid_answer' using errcode = 'P0001';
      end if;

    elsif q.type = 'text' then
      if jsonb_typeof(v_val) <> 'string' then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
      v_txt := btrim(v_val #>> '{}');
      if char_length(v_txt) > 2000 then raise exception 'invalid_answer' using errcode = 'P0001'; end if;
      v_val := to_jsonb(v_txt);
    end if;

    insert into public.answers (response_id, question_id, value) values (v_resp_id, q.id, v_val);

    -- Scoring from metadata.
    if q.subscale is not null and q.type in ('likert', 'scale') then
      v_num := (v_val #>> '{}')::numeric;
      if q.reverse_scored then
        if q.type = 'scale' then
          v_lo := (q.config ->> 'min')::numeric;
          v_hi := (q.config ->> 'max')::numeric;
        else
          select min((o ->> 'value')::numeric), max((o ->> 'value')::numeric)
            into v_lo, v_hi from jsonb_array_elements(q.options) o;
        end if;
        v_num := v_lo + v_hi - v_num;
      end if;
      if q.subscale = 'helplessness' then v_help := v_help + v_num; else v_self := v_self + v_num; end if;
      v_scored_n := v_scored_n + 1;
    end if;
  end loop;

  if exists (
    select 1 from public.questions qq
    where qq.survey_version_id = v_version.id and qq.active and qq.required
      and not (qq.id = any (v_seen))
  ) then
    raise exception 'missing_required' using errcode = 'P0001';
  end if;

  if v_scored_n > 0 then
    update public.responses
       set pss_score = (v_help + v_self)::smallint,
           helplessness_score = v_help::smallint,
           self_efficacy_score = v_self::smallint
     where id = v_resp_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- POST /api/submit needs to read the published version and its questions as service_role.
grant usage on schema public to service_role;
grant select on public.survey_versions, public.questions to service_role;
grant execute on function public.submit_survey(jsonb) to service_role;
