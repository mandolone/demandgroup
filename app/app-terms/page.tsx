import type { Metadata } from "next";
import { termsHtml } from "./content";

export const metadata: Metadata = {
  title: "App Terms of Service — Demand Group",
  description: "Terms of use for Demand Group Wear OS watch faces and companion apps.",
  alternates: { canonical: "/app-terms/" },
};

export default function AppTerms() {
  return <div dangerouslySetInnerHTML={{ __html: termsHtml }} />;
}
