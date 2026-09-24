import "server-only";
import { NextResponse } from "next/server";

/** Maps database guard/RPC errors to safe, user-facing API errors. */
export function dbError(error: { message: string; code?: string }) {
  const known: Record<string, [number, string]> = {
    version_locked: [409, "This survey version is published or closed and can no longer be edited. Create a new version instead."],
    locked_instrument: [409, "The PSS-10 core instrument is locked and cannot be changed."],
    draft_exists: [409, "A draft version already exists. Publish or finish it first."],
    not_a_draft: [409, "Only a draft version can be published."],
    not_published: [409, "Only a published version can be closed."],
    pss10_incomplete: [409, "A version needs all 10 PSS-10 items before it can be published."],
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
