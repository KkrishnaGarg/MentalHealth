import type { Metadata } from "next";
import { ThanksView } from "@/components/survey/ThanksView";

export const metadata: Metadata = { title: "Thank you" };

export default function ThanksPage() {
  return <ThanksView />;
}
