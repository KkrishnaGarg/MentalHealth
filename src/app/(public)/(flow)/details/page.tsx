import type { Metadata } from "next";
import { DetailsForm } from "@/components/survey/DetailsForm";

export const metadata: Metadata = { title: "Your details" };

export default function DetailsPage() {
  return <DetailsForm />;
}
