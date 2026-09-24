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
  await db.exec(readFileSync(path.join(root, "seed.sql"), "utf8"));
  await db.exec(`insert into public.profiles (id, role) values ('${ADMIN}', 'admin');`);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("seed", () => {
  it("creates published version 1 with 10 locked PSS items, 7 stressors, 2 open-ended", async () => {
    const [v] = await q<{ status: string }>("select status from public.survey_versions where version=1");
    expect(v.status).toBe("published");
    const counts = await q<{ section: string; n: number; locked: number }>(
      "select section, count(*)::int n, count(*) filter (where locked)::int locked from public.questions group by section order by section",
    );
    expect(counts.find((c) => c.section === "pss10")).toMatchObject({ n: 10, locked: 10 });
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

describe("survey versioning", () => {
  let draftId: string;

  it("non-admins cannot clone or publish", async () => {
    const v = (await q<{ id: string }>("select id from public.survey_versions where version=1"))[0].id;
    await expect(as("authenticated", STUDENT, () => db.query("select public.clone_survey_version($1)", [v]))).rejects.toThrow(/forbidden/);
  });

  it("admin clones v1 into an editable draft with PSS-10 still locked", async () => {
    const v1 = (await q<{ id: string }>("select id from public.survey_versions where version=1"))[0].id;
    const [{ clone_survey_version }] = await as("authenticated", ADMIN, () =>
      q<{ clone_survey_version: string }>("select public.clone_survey_version($1) as clone_survey_version", [v1]),
    );
    draftId = clone_survey_version;
    const stats = await q<{ n: number; locked: number }>(
      "select count(*)::int n, count(*) filter (where locked)::int locked from public.questions where survey_version_id=$1",
      [draftId],
    );
    expect(stats).toEqual([{ n: 21, locked: 10 }]);
    // a second draft is refused
    await expect(as("authenticated", ADMIN, () => db.query("select public.clone_survey_version($1)", [v1]))).rejects.toThrow(/draft_exists/);
  });

  it("draft: stressor questions are editable, PSS-10 is not", async () => {
    await as("authenticated", ADMIN, () =>
      db.query("update public.questions set text='Edited stressor' where survey_version_id=$1 and key='stressor_workload'", [draftId]),
    );
    await expect(
      as("authenticated", ADMIN, () => db.query("update public.questions set text='hacked' where survey_version_id=$1 and key='pss_1'", [draftId])),
    ).rejects.toThrow(/locked_instrument/);
    await expect(
      as("authenticated", ADMIN, () => db.query("update public.questions set reverse_scored=true where survey_version_id=$1 and key='pss_2'", [draftId])),
    ).rejects.toThrow(/locked_instrument/);
    await expect(
      as("authenticated", ADMIN, () => db.query("delete from public.questions where survey_version_id=$1 and key='pss_3'", [draftId])),
    ).rejects.toThrow(/locked_instrument/);
    await expect(
      as("authenticated", ADMIN, () =>
        db.query(
          "insert into public.questions (survey_version_id,key,section,type,text,options,locked,reverse_scored,subscale,position) values ($1,'pss_x','pss10','likert','fake','[{\"value\":0,\"label\":\"a\"},{\"value\":1,\"label\":\"b\"}]',true,false,'helplessness',99)",
          [draftId],
        ),
      ),
    ).rejects.toThrow(/locked_instrument/);
  });

  it("admin can add and atomically reorder custom questions", async () => {
    await as("authenticated", ADMIN, () =>
      db.query(
        "insert into public.questions (survey_version_id,key,section,type,text,required,position) values ($1,'custom_open_a','open_ended','text','A?',false,100), ($1,'custom_open_b','open_ended','text','B?',false,101)",
        [draftId],
      ),
    );
    const [a, b] = await q<{ id: string }>("select id from public.questions where key in ('custom_open_a','custom_open_b') and survey_version_id=$1 order by key", [draftId]);
    await as("authenticated", ADMIN, () => db.query("select public.reorder_questions($1::uuid[])", [[b.id, a.id]]));
    const order = await q<{ key: string }>(
      "select key from public.questions where key in ('custom_open_a','custom_open_b') and survey_version_id=$1 order by position",
      [draftId],
    );
    expect(order.map((o) => o.key)).toEqual(["custom_open_b", "custom_open_a"]);
  });

  it("publishing closes v1 and freezes v2; responses keep their version", async () => {
    await as("authenticated", ADMIN, () => db.query("select public.publish_survey_version($1)", [draftId]));
    const statuses = await q<{ version: number; status: string }>("select version, status from public.survey_versions order by version");
    expect(statuses).toEqual([
      { version: 1, status: "closed" },
      { version: 2, status: "published" },
    ]);
    await expect(
      as("authenticated", ADMIN, () => db.query("update public.questions set text='late edit' where survey_version_id=$1 and key='stressor_workload'", [draftId])),
    ).rejects.toThrow(/version_locked/);
    const [{ v }] = await q<{ v: number }>("select sv.version v from public.responses r join public.survey_versions sv on sv.id=r.survey_version_id");
    expect(v).toBe(1);
  });

  it("submissions for the closed version are refused", async () => {
    const closed = (await q<{ id: string }>("select id from public.survey_versions where version=1"))[0].id;
    const payload = { ...(await buildPayload({ roll: "24UCC010" })), survey_version_id: closed };
    await expect(submit(payload)).rejects.toThrow(/survey_not_open/);
  });
});
