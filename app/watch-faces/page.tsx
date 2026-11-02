import Script from 'next/script';
import { catalogHtml } from './content';
export const metadata={title:'All Watch Faces — Demand Group',description:'Search Demand Group watch faces by collection and availability.',alternates:{canonical:'/watch-faces/'}};
export default function Catalog(){return <><div dangerouslySetInnerHTML={{__html:catalogHtml}}/><Script type="module" src="/storefront.js" strategy="afterInteractive"/><Script src="/shop.js" strategy="afterInteractive"/></>;}
