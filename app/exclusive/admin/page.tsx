import Script from "next/script";
import { html } from "./content";
export const metadata = { title: "Partner desk — Demand Group", alternates: { canonical: "/exclusive/admin/" } };
export default function Page() { return <><div dangerouslySetInnerHTML={{__html: html}} /><Script type="module" src="/exclusive/admin.js" strategy="afterInteractive" /></>; }
