/**
 * Verifies the SQL migration against a real PostgreSQL engine (PGlite, WASM).
 * Supabase-specific pieces (auth schema, auth.uid(), API roles) are stubbed;
 * everything else — RLS, triggers, RPCs, views — is the real migration + seed.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
let db: PGlite;

const ADMIN = "11111111-1111-1111-1111-111111111111";
const STUDENT = "22222222-2222-2222-2222-222222222222";

async function as<T>(role: "anon" | "authenticated" | "service_role", sub: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${sub ?? ""}', false); set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

const q = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;

async function buildPayload(over: { roll?: string; pss?: number[]; badLast?: boolean } = {}) {
  const versionId = (await q<{ id: string }>("select id from public.survey_versions where status='published'"))[0].id;
  const qs = await q<{ id: string; key: string; section: string; type: string; options: { value: unknown }[] | null }>(
    "select id, key, section, type, options from public.questions where survey_version_id=$1 order by position",
    [versionId],
  );
  const pssVals = over.pss ?? [2, 3, 1, 3, 2, 4, 1, 0, 2, 3];
  const answers = qs
    .filter((x) => x.section !== "demographics")
    .map((x) => {
      if (x.section === "pss10") return { question_id: x.id, value: pssVals[Number(x.key.split("_")[1]) - 1] };
      if (x.section === "stressors") return { question_id: x.id, value: 3 };
      return { question_id: x.id, value: "Too many deadlines" };
    });
  if (over.badLast) answers[answers.length - 1] = { question_id: answers[answers.length - 1].question_id, value: "x".repeat(3000) };
  return {
    survey_version_id: versionId,
    consented: true,
    total_time_s: 240,
    respondent: { name: "Asha Rao", roll_no: over.roll ?? "24ucc001", email: "Asha@Example.com", year: 2, branch: "CCE" },
    answers,
  };
}

const submit = (payload: unknown) =>
  as("service_role", null, () => db.query("select public.submit_survey($1::jsonb)", [JSON.stringify(payload)]));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on auth.users to authenticated;
    insert into auth.users (id, email) values ('${ADMIN}', 'admin@x.test'), ('${STUDENT}', 'student@x.test');
  `);
  await db.exec(readFileSync(path.join(root, "migrations/001_schema.sql"), "utf8"));
  await db.exec(readFileSync(path.join(root, "migrations/002_flexible_questions.sql"), "utf8"));
  await db.exec(readFileSync(path.join(root, "seed.sql"), "utf8"));
  await db.exec(`insert into public.profiles (id, role) values ('${ADMIN}', 'admin');`);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("seed", () => {
  it("creates published version 1 with 10 PSS items, 7 scale stressors, 2 open-ended", async () => {
    const [v] = await q<{ status: string }>("select status from public.survey_versions where version=1");
    expect(v.status).toBe("published");
    const counts = await q<{ section: string; n: number }>(
      "select section, count(*)::int n from public.questions group by section order by section",
    );
    expect(counts.find((c) => c.section === "pss10")).toMatchObject({ n: 10 });
    expect(counts.find((c) => c.section === "stressors")?.n).toBe(7);
    expect(counts.find((c) => c.section === "open_ended")?.n).toBe(2);
    const rev = await q<{ key: string }>("select key from public.questions where reverse_scored order by position");
    expect(rev.map((r) => r.key)).toEqual(["pss_4", "pss_5", "pss_7", "pss_8"]);
  });
});

describe("RLS: anonymous visitors", () => {
  it("can read only active questions of the published version", async () => {
    const rows = await as("anon", null, () => q("select key from public.questions"));
    expect(rows).toHaveLength(21);
  });

  for (const table of ["respondents", "responses", "answers", "audit_logs", "cleaning_decisions", "profiles", "research_dataset", "admin_dataset"]) {
    it(`cannot SELECT ${table}`, async () => {
      await expect(as("anon", null, () => q(`select * from public.${table}`))).rejects.toThrow(/permission denied/i);
    });
  }

  it("cannot insert respondents/responses/answers directly", async () => {
    for (const sql of [
      "insert into public.respondents (name, roll_no, email, year, branch, consented_at) values ('a','b','a@b.co',1,'CSE',now())",
      "insert into public.questions (survey_version_id, key, section, type, text) select id, 'x', 'open_ended', 'text', 'x' from public.survey_versions limit 1",
    ]) {
      await expect(as("anon", null, () => db.exec(sql))).rejects.toThrow(/permission denied/i);
    }
  });

  it("cannot call submit_survey directly (service role only)", async () => {
    await expect(as("anon", null, () => db.query("select public.submit_survey('{}'::jsonb)"))).rejects.toThrow(/permission denied/i);
  });

  it("hides inactive questions", async () => {
    // Bypass the (correct) published-version guard just to prepare fixture data.
    await db.exec("alter table public.questions disable trigger questions_guard; update public.questions set active=false where key='stressor_sleep'; alter table public.questions enable trigger questions_guard;");
    const rows = await as("anon", null, () => q("select key from public.questions"));
    expect(rows).toHaveLength(20);
    expect(rows.map((r) => r.key)).not.toContain("stressor_sleep");
    await db.exec("alter table public.questions disable trigger questions_guard; update public.questions set active=true where key='stressor_sleep'; alter table public.questions enable trigger questions_guard;");
  });
});

describe("submit_survey RPC", () => {
  it("scores PSS-10 with reverse items and stores identity separately", async () => {
    await submit(await buildPayload());
    const [r] = await q<{ pss_score: number; helplessness_score: number; self_efficacy_score: number; total_time_s: number }>(
      "select pss_score, helplessness_score, self_efficacy_score, total_time_s from public.responses",
    );
    // answers [2,3,1,3,2,4,1,0,2,3]: helplessness 15, self-efficacy (4-3)+(4-2)+(4-1)+(4-0)=10
    expect(r).toMatchObject({ pss_score: 25, helplessness_score: 15, self_efficacy_score: 10, total_time_s: 240 });
    const [p] = await q<{ roll_no: string; email: string }>("select roll_no, email from public.respondents");
    expect(p).toEqual({ roll_no: "24UCC001", email: "asha@example.com" }); // normalised
  });

  it("rejects a duplicate roll number", async () => {
    await expect(submit(await buildPayload({ roll: "24UCC001" }))).rejects.toThrow(/duplicate_submission/);
  });

  it("is atomic: a failure while inserting answers leaves nothing behind", async () => {
    const before = await q<{ p: number; r: number; a: number }>(
      "select (select count(*) from public.respondents)::int p, (select count(*) from public.responses)::int r, (select count(*) from public.answers)::int a",
    );
    await expect(submit(await buildPayload({ roll: "24UCC002", badLast: true }))).rejects.toThrow(/invalid_answer/);
    const after = await q<{ p: number; r: number; a: number }>(
      "select (select count(*) from public.respondents)::int p, (select count(*) from public.responses)::int r, (select count(*) from public.answers)::int a",
    );
    expect(after).toEqual(before);
  });

  it("rejects out-of-range PSS values, missing consent and closed surveys", async () => {
    const bad = await buildPayload({ roll: "24UCC003", pss: [9, 3, 1, 3, 2, 4, 1, 0, 2, 3] });
    await expect(submit(bad)).rejects.toThrow(/invalid_answer/);
    const noConsent = { ...(await buildPayload({ roll: "24UCC004" })), consented: false };
    await expect(submit(noConsent)).rejects.toThrow(/consent_required/);
    expect((await q("select 1 from public.respondents where roll_no in ('24UCC003','24UCC004')"))).toHaveLength(0);
  });

  it("does not store any IP / device columns", async () => {
    const cols = await q<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and column_name ~* '(ip|agent|fingerprint|device)'",
    );
    expect(cols.filter((c) => !/^(description|zip|tip|skip|ship)/i.test(c.column_name))).toEqual([]);
  });
});

describe("admin access", () => {
  it("non-admin authenticated user sees no respondent data", async () => {
    const rows = await as("authenticated", STUDENT, () => q("select * from public.respondents"));
    expect(rows).toHaveLength(0);
    expect(await as("authenticated", STUDENT, () => q("select * from public.research_dataset"))).toHaveLength(0);
    expect((await as("authenticated", STUDENT, () => q<{ is_admin: boolean }>("select public.is_admin() as is_admin")))[0].is_admin).toBe(false);
  });

  it("admin sees respondents; research dataset has no identity columns", async () => {
    expect(await as("authenticated", ADMIN, () => q("select * from public.respondents"))).toHaveLength(1);
    const [row] = await as("authenticated", ADMIN, () => q("select * from public.research_dataset"));
    expect(Object.keys(row)).not.toContain("name");
    expect(Object.keys(row)).not.toContain("roll_no");
    expect(Object.keys(row)).not.toContain("email");
    expect(row).toMatchObject({ pss_score: 25, helplessness_score: 15, self_efficacy_score: 10, stressor_workload: 3, pss_4: 3 });
    const long = await as("authenticated", ADMIN, () => q("select * from public.research_answers_long"));
    expect(long.some((r) => r.section === "open_ended")).toBe(false);
  });

  it("admin cannot modify a published version's questions", async () => {
    await expect(
      as("authenticated", ADMIN, () => db.exec("update public.questions set text='changed' where key='stressor_workload'")),
    ).rejects.toThrow(/version_locked/);
  });

  it("audit log is append-only and bound to the caller", async () => {
    await as("authenticated", ADMIN, () =>
      db.query("insert into public.audit_logs (admin_id, action, entity) values ($1, 'CSV_EXPORTED', 'export')", [ADMIN]),
    );
    await expect(
      as("authenticated", ADMIN, () => db.query("insert into public.audit_logs (admin_id, action, entity) values ($1, 'X', 'y')", [STUDENT])),
    ).rejects.toThrow(/row-level security/i);
    await expect(as("authenticated", ADMIN, () => db.exec("delete from public.audit_logs"))).rejects.toThrow(/permission denied/i);
    await expect(
      as("authenticated", STUDENT, () => db.query("insert into public.audit_logs (admin_id, action, entity) values ($1, 'X', 'y')", [STUDENT])),
    ).rejects.toThrow(/row-level security/i);
  });
});

describe("survey versioning (edit anything in a draft, publish as a new version)", () => {
  let draftId: string;
  const adminQ = (sql: string, params: unknown[] = []) => as("authenticated", ADMIN, () => db.query(sql, params));

  it("non-admins cannot clone or publish", async () => {
    const v = (await q<{ id: string }>("select id from public.survey_versions where version=1"))[0].id;
    await expect(as("authenticated", STUDENT, () => db.query("select public.clone_survey_version($1)", [v]))).rejects.toThrow(/forbidden/);
  });

  it("admin clones v1 into a fully editable draft; only one draft at a time", async () => {
    const v1 = (await q<{ id: string }>("select id from public.survey_versions where version=1"))[0].id;
    const [{ id }] = await as("authenticated", ADMIN, () => q<{ id: string }>("select public.clone_survey_version($1) as id", [v1]));
    draftId = id;
    expect((await q<{ n: number }>("select count(*)::int n from public.questions where survey_version_id=$1", [draftId]))[0].n).toBe(21);
    await expect(adminQ("select public.clone_survey_version($1)", [v1])).rejects.toThrow(/draft_exists/);
  });

  it("draft: every question, including PSS-10, can be edited, retyped and deleted", async () => {
    await adminQ("update public.questions set text='Edited PSS item' where survey_version_id=$1 and key='pss_1'", [draftId]);
    await adminQ("update public.questions set reverse_scored=true where survey_version_id=$1 and key='pss_2'", [draftId]);
    await adminQ("delete from public.questions where survey_version_id=$1 and key='pss_3'", [draftId]);
    // retype a stressor scale into 1-7 and a demographic into multi-select
    await adminQ(`update public.questions set config='{"min":1,"max":7}' where survey_version_id=$1 and key='stressor_sleep'`, [draftId]);
    await adminQ(
      `update public.questions set type='multi', options='[{"value":"a","label":"A"},{"value":"b","label":"B"}]' where survey_version_id=$1 and key='demo_residence'`,
      [draftId],
    );
  });

  it("constraints reject malformed question definitions", async () => {
    await expect(adminQ(`update public.questions set type='scale' where survey_version_id=$1 and key='demo_income'`, [draftId])).rejects.toThrow(/violates check constraint/i);
    await expect(adminQ(`update public.questions set type='single', options=null where survey_version_id=$1 and key='demo_income'`, [draftId])).rejects.toThrow(/violates check constraint/i);
  });

  it("admin can add every question type, and atomically reorder", async () => {
    const defs = [
      ["c_single", "single", `'[{"value":"t","label":"True"},{"value":"f","label":"False"}]'`, "null", "true"],
      ["c_multi", "multi", `'[{"value":"x","label":"X"},{"value":"y","label":"Y"},{"value":"z","label":"Z"}]'`, "null", "false"],
      ["c_scale", "scale", "null", `'{"min":0,"max":10,"min_label":"None","max_label":"Extreme"}'`, "true"],
      ["c_number", "number", "null", `'{"min":0,"max":100}'`, "false"],
      ["c_text", "text", "null", "null", "false"],
    ];
    for (const [key, type, opts, cfg, req] of defs) {
      await adminQ(
        `insert into public.questions (survey_version_id,key,section,type,text,options,config,required,position) values ($1,'${key}','demographics','${type}','Q ${key}',${opts},${cfg},${req},${200 + defs.findIndex((d) => d[0] === key)})`,
        [draftId],
      );
    }
    const [a, b] = await q<{ id: string }>("select id from public.questions where key in ('c_text','c_number') and survey_version_id=$1 order by key", [draftId]);
    await adminQ("select public.reorder_questions($1::uuid[])", [[b.id, a.id]]);
    const order = await q<{ key: string }>("select key from public.questions where key in ('c_text','c_number') and survey_version_id=$1 order by position", [draftId]);
    expect(order.map((o) => o.key)).toEqual(["c_text", "c_number"]);
  });

  it("v1 is untouched while v2 is being drafted", async () => {
    const [r] = await q<{ text: string; n: number }>(
      "select (select text from public.questions q join public.survey_versions v on v.id=q.survey_version_id where v.version=1 and q.key='pss_1') text, (select count(*)::int from public.questions q join public.survey_versions v on v.id=q.survey_version_id where v.version=1) n",
    );
    expect(r.text).toMatch(/upset because of something/);
    expect(r.n).toBe(21);
  });

  it("a draft can be discarded; published/closed versions cannot", async () => {
    const v1 = (await q<{ id: string }>("select id from public.survey_versions where version=1"))[0].id;
    await expect(adminQ("select public.discard_draft_version($1)", [v1])).rejects.toThrow(/not_a_draft/);
    await expect(as("authenticated", STUDENT, () => db.query("select public.discard_draft_version($1)", [draftId]))).rejects.toThrow(/forbidden/);
  });

  it("publishing closes v1 and freezes v2", async () => {
    await adminQ("select public.publish_survey_version($1)", [draftId]);
    expect(await q("select version, status from public.survey_versions order by version")).toEqual([
      { version: 1, status: "closed" },
      { version: 2, status: "published" },
    ]);
    await expect(adminQ("update public.questions set text='late edit' where survey_version_id=$1 and key='stressor_workload'", [draftId])).rejects.toThrow(/version_locked/);
  });

  it("submissions for the closed version are refused", async () => {
    const closed = (await q<{ id: string }>("select id from public.survey_versions where version=1"))[0].id;
    const payload = { ...(await buildPayload({ roll: "24UCC010" })), survey_version_id: closed };
    await expect(submit(payload)).rejects.toThrow(/survey_not_open/);
  });

  it("v2 accepts all question types, validates them, and keeps its responses separate from v1", async () => {
    const versionId = draftId;
    const qs = await q<{ id: string; key: string; type: string; section: string }>("select id, key, type, section from public.questions where survey_version_id=$1 and active", [versionId]);
    const id = (k: string) => qs.find((x) => x.key === k)!.id;
    const base = () =>
      qs
        .filter((x) => x.section === "pss10" || x.section === "stressors")
        .map((x) => ({ question_id: x.id, value: x.section === "pss10" ? 2 : 3 }));
    const withExtras = (extra: Array<{ key: string; value: unknown }>) => [...base(), ...extra.map((e) => ({ question_id: id(e.key), value: e.value }))];
    const payload = (roll: string, answers: unknown[]) => ({
      survey_version_id: versionId,
      consented: true,
      total_time_s: 100,
      respondent: { name: "B", roll_no: roll, email: `${roll}@x.co`, year: 1, branch: "CSE" },
      answers,
    });
    const good = [
      { key: "c_single", value: "t" },
      { key: "c_scale", value: 7 },
      { key: "demo_residence", value: ["a", "b"] },
      { key: "c_number", value: 42 },
      { key: "c_text", value: "hello" },
    ];
    await submit(payload("V2A", withExtras(good)));
    // required c_single/c_scale missing, bad scale, bad option, duplicate multi value, out-of-range number, wrong type
    await expect(submit(payload("V2B", withExtras(good.filter((g) => g.key !== "c_single"))))).rejects.toThrow(/missing_required/);
    await expect(submit(payload("V2C", withExtras(good.map((g) => (g.key === "c_scale" ? { ...g, value: 11 } : g)))))).rejects.toThrow(/invalid_answer/);
    await expect(submit(payload("V2D", withExtras(good.map((g) => (g.key === "c_single" ? { ...g, value: "maybe" } : g)))))).rejects.toThrow(/invalid_answer/);
    await expect(submit(payload("V2E", withExtras(good.map((g) => (g.key === "demo_residence" ? { ...g, value: ["a", "a"] } : g)))))).rejects.toThrow(/invalid_answer/);
    await expect(submit(payload("V2F", withExtras(good.map((g) => (g.key === "c_number" ? { ...g, value: 500 } : g)))))).rejects.toThrow(/invalid_answer/);
    await expect(submit(payload("V2G", withExtras(good.map((g) => (g.key === "c_text" ? { ...g, value: 5 } : g)))))).rejects.toThrow(/invalid_answer/);
    // optional multi left empty is fine
    await submit(payload("V2H", withExtras(good.map((g) => (g.key === "demo_residence" ? { ...g, value: [] } : g)))));

    const rows = await q<{ v: number; n: number }>(
      "select sv.version v, count(*)::int n from public.responses r join public.survey_versions sv on sv.id=r.survey_version_id group by 1 order by 1",
    );
    expect(rows).toEqual([
      { v: 1, n: 1 },
      { v: 2, n: 2 },
    ]);
  });

  it("scoring adapts to the edited PSS: 9 items, pss_2 reversed", async () => {
    // v2 answers are all 2 on PSS items. Items: pss_3 deleted; reversed = pss_2, 4, 5, 7, 8 (4-2=2 each) -> every item scores 2.
    const [r] = await q<{ pss_score: number; helplessness_score: number; self_efficacy_score: number }>(
      "select pss_score, helplessness_score, self_efficacy_score from public.responses r join public.respondents p on p.id=r.respondent_id where p.roll_no='V2A'",
    );
    expect(r).toEqual({ pss_score: 18, helplessness_score: 10, self_efficacy_score: 8 });
    // v1 response scored under the original scoring is unchanged
    const [old] = await q<{ pss_score: number }>("select pss_score from public.responses r join public.respondents p on p.id=r.respondent_id where p.roll_no='24UCC001'");
    expect(old.pss_score).toBe(25);
  });

  it("research view separates versions", async () => {
    const rows = await as("authenticated", ADMIN, () => q<{ survey_version: number }>("select survey_version from public.research_dataset order by survey_version"));
    expect(rows.map((r) => r.survey_version)).toEqual([1, 2, 2]);
  });
});

describe("upgrade path: a database that already has 001 + the old seed", () => {
  it("002 migrates existing data and keeps existing responses valid", async () => {
    const old = new PGlite();
    await old.exec(`
      create schema auth;
      create table auth.users (id uuid primary key default gen_random_uuid(), email text);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      grant usage on schema public, auth to anon, authenticated, service_role;
    `);
    await old.exec(readFileSync(path.join(root, "migrations/001_schema.sql"), "utf8"));
    await old.exec(readFileSync(path.join(root, "tests/seed_v1_legacy.sql"), "utf8"));
    const [{ id: vid }] = (await old.query<{ id: string }>("select id from public.survey_versions where version=1")).rows;
    // a response stored under the old schema
    const [{ id: pid }] = (await old.query<{ id: string }>(
      "insert into public.respondents (name, roll_no, email, year, branch, consented_at) values ('Old','OLD1','o@x.co',2,'CSE',now()) returning id",
    )).rows;
    await old.query(
      "insert into public.responses (respondent_id, survey_version_id, pss_score, helplessness_score, self_efficacy_score) values ($1,$2,25,15,10)",
      [pid, vid],
    );
    await old.exec(readFileSync(path.join(root, "migrations/002_flexible_questions.sql"), "utf8"));
    const stress = (await old.query<{ type: string; config: { min: number; max: number } | null; options: unknown }>(
      "select type, config, options from public.questions where key='stressor_workload'",
    )).rows[0];
    expect(stress.type).toBe("scale");
    expect(stress.options).toBeNull();
    expect(stress.config).toMatchObject({ min: 1, max: 5 });
    expect((await old.query("select 1 from public.responses where pss_score=25")).rows).toHaveLength(1);
    expect((await old.query<{ n: number }>("select count(*)::int n from public.questions where survey_version_id=$1", [vid])).rows[0].n).toBe(21);
    await old.close();
  });
});