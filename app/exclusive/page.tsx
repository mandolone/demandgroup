import Script from "next/script";
import { html } from "./content";
export const metadata = { title: "The complimentary collection — Demand Group", alternates: { canonical: "/exclusive/" } };
export default function Page() { return <><div dangerouslySetInnerHTML={{__html: html}} /><Script type="module" src="/exclusive/catalog.js" strategy="afterInteractive" /></>; }
