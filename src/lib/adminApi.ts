import "server-only";
import { NextResponse } from "next/server";

/** Maps database guard/RPC errors to safe, user-facing API errors. */
export function dbError(error: { message: string; code?: string }) {
  const known: Record<string, [number, string]> = {
    version_locked: [409, "Published and closed versions are frozen so their responses stay comparable. Start a new draft version to make changes."],
    draft_exists: [409, "A draft version already exists. Publish or finish it first."],
    not_a_draft: [409, "Only a draft version can be published."],
    not_published: [409, "Only a published version can be closed."],
    no_questions: [409, "Add at least one active question before publishing."],
    invalid_version: [404, "Survey version not found."],
    invalid_reorder: [422, "Those questions cannot be reordered."],
    forbidden: [403, "Not authorised."],
  };
  const hit = known[error.message];
  if (hit) return NextResponse.json({ error: error.message, message: hit[1] }, { status: hit[0] });
  console.error("admin db error", error.code);
  return NextResponse.json({ error: "server", message: "Something went wrong. Please try again." }, { status: 500 });
}

export const forbidden = () => NextResponse.json({ error: "forbidden" }, { status: 403 });
export const invalid = () => NextResponse.json({ error: "invalid", message: "Invalid input." }, { status: 422 });
