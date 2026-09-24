# LNMIIT HSS Academic Stress Study — Survey Platform

A survey and research-data platform for the HSS mini project **"Mental Health & Academic Stress Among College Students"**. The research (survey design, analysis, interpretation) is the focus; this site is the supporting platform for secure data collection, data management and the predefined analysis.

> **Confidential, not anonymous.** The original project outline describes the survey as *anonymous*. This implementation collects respondents' name, roll number and email so that authorized administrators can identify them. Identity is stored **separately** from answers and linked only by a random UUID, but a response *can* be linked to a person by an administrator — so the site says **"confidential"** everywhere and never claims anonymity. If your ethics submission still says "anonymous", update it to match (see [§11](#11-confidentiality-architecture)).

---

## 1. Project overview

| | |
|---|---|
| Instrument | PSS-10 (locked core), 7 academic-stressor ratings (1–5), 1–2 optional open-ended questions, optional demographics |
| Design | Cross-sectional, self-selected, single-institute (associations only — never causal claims) |
| Primary variable | Continuous PSS-10 total (0–40). Bands (0–13 / 14–26 / 27–40) are secondary and labelled *"Commonly used interpretive bands — not clinical diagnostic thresholds."* |
| Predefined analysis | 7 factors × 2 PSS subscales = **14 correlations** (r, p, n) |
| Users | **Participants**: no account; consent → details → survey. **Admins**: sign in; manage questions/versions, view live results and identities, export, audit |

Participant journey: Landing → Consent → Details → PSS-10 → Academic Stressors → Open-ended → Review → Submit → Thanks. A participant **never** sees a score, band, average, comparison or "most students…" statement.

## 2. Tech stack

Next.js 16 (App Router, Turbopack, `src/proxy.ts` = former middleware) · TypeScript · Tailwind CSS v4 · Supabase (PostgreSQL, Auth, RLS, Realtime) · Zod · Recharts · Vitest (+ PGlite for SQL tests) · deployed on Vercel.

## 3. Local setup

```bash
npm install
cp .env.example .env.local      # then fill in the values (section 5)
npm run dev                     # http://localhost:3000
npm test                        # unit + database tests (no Supabase account needed)
npm run build
```

## 4. Supabase project creation

1. Create a project at <https://supabase.com>.
2. **Authentication → Providers → Email**: keep email/password enabled but turn **"Allow new users to sign up" OFF** (see §9).
3. Copy the project URL, `anon` key and `service_role` key (Project Settings → API).

## 5. Environment variables

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | safe to expose; RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | bypasses RLS. Never prefix with `NEXT_PUBLIC_`. Imported only by `src/lib/supabase/admin.ts` (`import "server-only"`, so the build fails if a client component imports it) and used only by `POST /api/submit`. |

## 6. Database migration

Open the Supabase **SQL editor** and run, in order:

1. `supabase/migrations/001_schema.sql`
2. `supabase/seed.sql`

(Or `supabase db push` with the Supabase CLI.) The migration creates the tables, guard triggers, RLS policies, RPC functions, admin-only views and enables Realtime on `responses`.

## 7. Seed data

`seed.sql` creates **survey version 1**, published for initial testing:

* 10 PSS-10 items (Cohen, Kamarck & Mermelstein, 1983) — **locked**; items 4, 5, 7, 8 reverse-scored
* 7 stressor questions (workload, examinations, CGPA/career, family finances, placement, sleep, personal life), 1–5 scale
* 2 optional open-ended questions
* 2 optional demographics (residence, family-income bracket)

> **Before real data collection:** the PSS-10 wording is standard and locked, but the seven stressor items, open-ended items and support links (`src/lib/constants.ts` → `SUPPORT`) are project-authored placeholders. Finalise them with the research team, pilot on 10–15 peers, then either edit them in a Draft version and publish it, or re-seed. **Replace the counselling/helpline links with LNMIIT's real resources.**

## 8. Creating the first admin

There is no public admin signup. In Supabase **Authentication → Users → Add user**, create the admin (email + password, auto-confirm). Then in the SQL editor:

```sql
insert into public.profiles (id, role)
select id, 'admin' from auth.users where email = 'you@lnmiit.ac.in';
```

Only rows in `profiles` with `role = 'admin'` are administrators. Sign in at `/admin/login`.

## 9. Disabling public signup

Supabase → Authentication → Providers/Sign In → disable **"Allow new users to sign up"**. Even if it were left on, a newly-registered account has no `profiles` row, so it is denied by the proxy, by every admin page/API (`requireAdmin`/`getAdmin`), and by RLS (`is_admin()` is false). Participants never authenticate at all.

## 10. RLS explanation

RLS is enabled on every table; default table grants are revoked and re-granted minimally.

| Table / view | anon (visitors) | authenticated non-admin | admin |
|---|---|---|---|
| `survey_versions` | SELECT published only | same | SELECT all (writes only via RPC) |
| `questions` | SELECT **active** questions of the **published** version | same | SELECT all; INSERT/UPDATE/DELETE (trigger-restricted, below) |
| `respondents`, `responses`, `answers` | **nothing** | nothing | SELECT |
| `audit_logs`, `cleaning_decisions` | nothing | nothing | SELECT + INSERT (as themselves); no UPDATE/DELETE |
| `profiles` | nothing | own row | own row |
| views `research_dataset`, `research_answers_long`, `open_ended_responses`, `admin_dataset` | nothing | 0 rows | SELECT (`security_invoker`, so RLS applies) |

Submissions are the only write path for participant data: `submit_survey()` is `SECURITY DEFINER` and executable **only by `service_role`**. Defence in depth for admin: **proxy** (session → profile → role=admin) + **server check** in every page/route + **RLS** in the database.

## 11. Confidentiality architecture

```
respondents (name, roll_no, email, year, branch)      <- identity, admin-only
      | random respondent UUID
      v
responses (scores, version, time)                     <- admin-only
      |
      v
answers (question_id, value)                          <- admin-only
```

* No IP address, user-agent, device or browser fingerprint is read, logged or stored (there are no such columns; the SQL test asserts it; the API route never reads request headers). No analytics/tracking scripts; no non-essential cookies, so no cookie banner. Your hosting provider may keep its own standard access logs, outside this project's control — the privacy page says so.
* The **research export** contains the random respondent UUID, never name/roll number/email. Raw open-ended text is admin-only.
* **Duplicate prevention** uses a unique roll number. This is a duplicate guard, **not authentication**. A rejected duplicate returns a generic message ("If you have already taken part, thank you…") that does not confirm whether a given roll number exists.
* Participant progress lives in `sessionStorage` (this tab only) and is cleared on submit or exit. Nothing reaches the server before final submission.

## 12. Survey versioning

`Draft → Published → Closed`. **A published version is never edited.** Every response stores its `survey_version_id`. To change the instrument: **Questions → Create new version** (clones the current version into a Draft; the PSS-10 stays locked, stressor/open-ended items are editable), edit, then **Publish** (which closes the previously published version). Enforced in the database, not just the UI:

* `guard_question_change` trigger rejects any INSERT/UPDATE/DELETE on questions whose version is not `draft` (`version_locked`), and any change to a `locked` row (`locked_instrument`), even by the table owner.
* Only one draft and one published version can exist (partial unique indexes).
* `publish_survey_version()` refuses versions without all 10 PSS-10 items.

## 13. PSS scoring

Computed **server-side in `submit_survey()`** from stored question metadata (`reverse_scored`, `subscale`) — never from question positions or IDs. Values 0–4 (Never … Very often); reverse-scored items use `4 − value`; total = sum of the 10 scored items (0–40). Scores are stored on `responses` and are **never returned to the browser**. `src/lib/scoring.ts` mirrors the SQL for unit tests, and the database test checks a hand-computed case.

## 14. PSS subscales

| Subscale | Items | Range |
|---|---|---|
| Perceived helplessness | 1, 2, 3, 6, 9, 10 | 0–24 |
| Lack of self-efficacy | 4, 5, 7, 8 (reverse-scored first) | 0–16 |

Stored as `helplessness_score`, `self_efficacy_score` (with a `CHECK` that they sum to `pss_score`).

## 15. The 14-correlation methodology

`/admin/analytics` §E computes Pearson *r*, two-sided *p* (t-distribution, n − 2 df) and *n* (complete pairs) for each of 7 stressor factors × 2 subscales, shown as a grouped horizontal bar chart plus a table. Not-computable cases (n < 3 or zero variance) show "—", never 0. All wording is *association*, never *effect/cause*. The 14 *p*-values are unadjusted; the page notes a Bonferroni threshold (0.05/14 ≈ 0.0036) for interpretation. Any other view (e.g. mean PSS by year/branch) sits in a section labelled **"Exploratory / not part of predefined analysis"** — there is deliberately no free-form "find any correlation" tool.

Limitations to report: self-selection bias, cross-sectional design, single-institute sample, modest sample size (target ≈ 75–150), response bias.

## 16. CSV exports (`/admin/exports`)

| Export | Contains identity? |
|---|---|
| Research dataset (wide: UUID, version, year, branch, PSS + subscales, 10 raw PSS items, 7 stressors, demographics) | **No** |
| Research answers (long, all non-open-ended answers, keyed by question) | **No** |
| Open-ended responses (for thematic coding) | No (UUID only; sensitive) |
| Administrative dataset | **Yes** (name, roll no, email) |

All exports require an admin session and are recorded in the audit log. CSV cells beginning with `= + - @` are neutralised against spreadsheet formula injection.

## 17. Audit logs

`audit_logs` (append-only via RLS): `ADMIN_LOGIN`, `QUESTION_CREATED/UPDATED/ACTIVATED/DEACTIVATED/DELETED/REORDERED`, `VERSION_CLONED/PUBLISHED/CLOSED`, `CSV_EXPORTED`, `RESPONDENT_VIEWED`, `CLEANING_DECISION_RECORDED`. Metadata never contains answer content or identity fields. Viewable at `/admin/audit`.

**Data cleaning:** the site *flags* (completed in < 60 s, missing stressor ratings, shared email, identical answer to all 10 PSS items) but never deletes. An admin records a decision (keep / exclude / needs review + reason) in `cleaning_decisions`. Excluding is a documented analysis decision, not a deletion.

## 18. Local testing

```bash
npm test
```

* `src/lib/*.test.ts` — PSS scoring (normal, reverse, extremes, hand-checked case, metadata-not-position), statistics (t-distribution p-values, Pearson), 14-correlation shape, quality flags, CSV escaping.
* `supabase/tests/database.test.ts` — applies the **real** migration + seed to an in-process PostgreSQL (PGlite; only `auth.uid()` and the API roles are stubbed) and checks: anon reads only active published questions; anon cannot read/write respondents/responses/answers/audit/views or call `submit_survey`; scoring and subscales; identity normalisation; duplicate rejection; **atomic rollback** when an answer insert fails; out-of-range/no-consent/closed-version rejection; non-admin sees no data; research view has no identity columns; admin cannot edit published versions; PSS-10 immutable (update/delete/insert-locked); clone/draft/publish lifecycle; append-only audit log; no IP/device columns.

**Not covered by automated tests** (needs a real Supabase project): Supabase Auth sign-in, Realtime delivery, and the Next.js server routes talking to a live database. Verify these once after deploy using the checklist in §21.

## 19. Production deployment

1. Push to GitHub. 2. Run the migration and seed on the production Supabase project and create the first admin (§6–8). 3. Deploy on Vercel (§20). 4. Edit `SUPPORT` in `src/lib/constants.ts` with real LNMIIT counselling/helpline details. 5. Obtain institutional/departmental ethics sign-off **before** publishing version 1 for real data collection. 6. Set a closing date and target N in advance (per the outline) and close the version when done.

## 20. Vercel deployment

Import the repo in Vercel (framework: Next.js). Add the three environment variables from §5 (mark `SUPABASE_SERVICE_ROLE_KEY` as server-only — do not expose it to the browser). Build command `npm run build`. In Supabase → Authentication → URL Configuration, add the Vercel domain as the site URL. Security headers are set in `next.config.ts`.

## 21. Security checklist

- [ ] Public signup disabled in Supabase Auth
- [ ] Only intended admins have `profiles` rows
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set as server-only env var; not in the client bundle (`.next/static` contains no service-role key — verified with a canary build)
- [ ] With the **anon key**, `select` on `respondents`, `responses`, `answers`, `audit_logs` returns an error/no rows (Supabase → API docs → try, or `curl` the REST endpoint)
- [ ] `/admin` redirects to `/admin/login` when signed out; a signed-in non-admin is refused
- [ ] Submit a test response → check scores against a hand calculation; then delete the test respondent
- [ ] Open `/admin` in one tab and submit in another → response count updates (Realtime)
- [ ] Research CSV has no name/roll/email; admin export appears in the audit log
- [ ] Support/helpline links replaced with real campus resources
- [ ] Ethics/consent wording matches "confidential, not anonymous"
- [ ] Supabase database backups enabled; project access limited to the research team

---

### Project layout

```
supabase/migrations/001_schema.sql   tables, triggers, RLS, RPCs, views
supabase/seed.sql                    survey version 1
supabase/tests/database.test.ts      SQL tests (PGlite)
src/proxy.ts                         admin gate (Next.js 16 proxy)
src/lib/                             scoring, stats, analytics, validation, supabase clients, audit
src/components/{ui,survey,admin}/    design-system primitives, survey flow, admin console
src/app/(public)/                    landing, consent, details, survey, thanks, results, study, privacy
src/app/admin/                       login + console (dashboard, analytics, questions, respondents, exports, audit)
src/app/api/                         submit, admin/*
```
