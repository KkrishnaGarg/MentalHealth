-- Seed: survey version 1 (published for initial testing).
-- Idempotent: does nothing if version 1 already exists.
-- Run in the Supabase SQL editor (as postgres) after 001_schema.sql and 002_flexible_questions.sql.
--
-- PSS-10 wording: Cohen, Kamarck & Mermelstein (1983).
-- Every question is editable, but only in a DRAFT version: edit, then publish it as a new version.
-- Published versions are frozen so each version's responses stay interpretable.

do $$
declare
  v_id uuid;
  pss_opts jsonb := '[
    {"value":0,"label":"Never"},
    {"value":1,"label":"Almost never"},
    {"value":2,"label":"Sometimes"},
    {"value":3,"label":"Fairly often"},
    {"value":4,"label":"Very often"}]';
  scale_cfg jsonb := '{"min":1,"max":5,"min_label":"Very low contribution","max_label":"Very high contribution"}';
begin
  if exists (select 1 from public.survey_versions where version = 1) then
    raise notice 'Survey version 1 already exists; skipping seed.';
    return;
  end if;

  insert into public.survey_versions (version, status) values (1, 'draft') returning id into v_id;

  -- PSS-10 (validated instrument). Items 4, 5, 7, 8 are reverse-scored.
  insert into public.questions
    (survey_version_id, key, section, type, text, options, reverse_scored, subscale, required, position)
  values
    (v_id, 'pss_1',  'pss10', 'likert', 'In the last month, how often have you been upset because of something that happened unexpectedly?', pss_opts, false, 'helplessness', true, 1),
    (v_id, 'pss_2',  'pss10', 'likert', 'In the last month, how often have you felt that you were unable to control the important things in your life?', pss_opts, false, 'helplessness', true, 2),
    (v_id, 'pss_3',  'pss10', 'likert', 'In the last month, how often have you felt nervous and "stressed"?', pss_opts, false, 'helplessness', true, 3),
    (v_id, 'pss_4',  'pss10', 'likert', 'In the last month, how often have you felt confident about your ability to handle your personal problems?', pss_opts, true, 'self_efficacy', true, 4),
    (v_id, 'pss_5',  'pss10', 'likert', 'In the last month, how often have you felt that things were going your way?', pss_opts, true, 'self_efficacy', true, 5),
    (v_id, 'pss_6',  'pss10', 'likert', 'In the last month, how often have you found that you could not cope with all the things that you had to do?', pss_opts, false, 'helplessness', true, 6),
    (v_id, 'pss_7',  'pss10', 'likert', 'In the last month, how often have you been able to control irritations in your life?', pss_opts, true, 'self_efficacy', true, 7),
    (v_id, 'pss_8',  'pss10', 'likert', 'In the last month, how often have you felt that you were on top of things?', pss_opts, true, 'self_efficacy', true, 8),
    (v_id, 'pss_9',  'pss10', 'likert', 'In the last month, how often have you been angered because of things that were outside of your control?', pss_opts, false, 'helplessness', true, 9),
    (v_id, 'pss_10', 'pss10', 'likert', 'In the last month, how often have you felt difficulties were piling up so high that you could not overcome them?', pss_opts, false, 'helplessness', true, 10);

  -- Seven stressor factors, each 1-5, kept separate from the PSS score.
  insert into public.questions
    (survey_version_id, key, section, type, text, config, required, position)
  values
    (v_id, 'stressor_workload',  'stressors', 'scale', 'How much does your academic workload contribute to the stress you experience?', scale_cfg, true, 11),
    (v_id, 'stressor_exams',     'stressors', 'scale', 'How much do examinations contribute to the stress you experience?', scale_cfg, true, 12),
    (v_id, 'stressor_cgpa',      'stressors', 'scale', 'How much do your CGPA and career prospects contribute to the stress you experience?', scale_cfg, true, 13),
    (v_id, 'stressor_finance',   'stressors', 'scale', 'How much does your family''s financial condition contribute to the stress you experience?', scale_cfg, true, 14),
    (v_id, 'stressor_placement', 'stressors', 'scale', 'How much does placement pressure contribute to the stress you experience?', scale_cfg, true, 15),
    (v_id, 'stressor_sleep',     'stressors', 'scale', 'How much does your sleep (amount or quality) contribute to the stress you experience?', scale_cfg, true, 16),
    (v_id, 'stressor_personal',  'stressors', 'scale', 'How much does your personal life contribute to the stress you experience?', scale_cfg, true, 17);

  -- Open-ended (optional, admin-only raw text).
  insert into public.questions
    (survey_version_id, key, section, type, text, required, position)
  values
    (v_id, 'open_biggest_source', 'open_ended', 'text', 'What is the single biggest source of academic stress for you right now?', false, 18),
    (v_id, 'open_college_changes', 'open_ended', 'text', 'What changes could the college make to reduce academic stress among students?', false, 19);

  -- Optional demographics.
  insert into public.questions
    (survey_version_id, key, section, type, text, options, required, position)
  values
    (v_id, 'demo_residence', 'demographics', 'single', 'Where do you live during the semester?',
      '[{"value":"hostel","label":"Hostel"},{"value":"day_scholar","label":"Day scholar"},{"value":"prefer_not","label":"Prefer not to say"}]', false, 20),
    (v_id, 'demo_income', 'demographics', 'single', 'Approximate annual family income bracket',
      '[{"value":"lt_3","label":"Below 3 lakh"},{"value":"3_8","label":"3 to 8 lakh"},{"value":"8_15","label":"8 to 15 lakh"},{"value":"gt_15","label":"Above 15 lakh"},{"value":"prefer_not","label":"Prefer not to say"}]', false, 21);

  -- Publish for initial testing.
  update public.survey_versions set status = 'published', published_at = now() where id = v_id;
end $$;
