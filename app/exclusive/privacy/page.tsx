import Script from "next/script";
import { html } from "./content";
export const metadata = { title: "Promotion privacy — Demand Group", alternates: { canonical: "/exclusive/privacy/" } };
export default function Page() { return <><div dangerouslySetInnerHTML={{__html: html}} /></>; }
