import type { Metadata } from "next";
import { ConsentGate } from "@/components/survey/ConsentGate";

export const metadata: Metadata = { title: "Consent" };

export default function ConsentPage() {
  return <ConsentGate />;
}
