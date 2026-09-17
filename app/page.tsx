import Script from "next/script";
import { shopHtml } from "./shop-content";
export default function Home() { return <><div dangerouslySetInnerHTML={{__html: shopHtml}} /><Script src="/shop.js" strategy="afterInteractive" /></>; }
