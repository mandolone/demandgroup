import Script from 'next/script';
import { notFound } from 'next/navigation';
import { detailPages } from '../content';
type Props={params:Promise<{slug:string}>};
export function generateStaticParams(){return Object.keys(detailPages).map(slug=>({slug}));}
export async function generateMetadata({params}:Props){const {slug}=await params;const p=detailPages[slug];return p?{title:p.title,description:p.description,alternates:{canonical:`/watch-faces/${slug}/`},openGraph:{title:p.title,description:p.description,images:[p.image]}}:{};}
export default async function WatchFace({params}:Props){const {slug}=await params;const p=detailPages[slug];if(!p)notFound();return <><div dangerouslySetInnerHTML={{__html:p.body}}/><Script type="module" src="/storefront.js" strategy="afterInteractive"/><Script src="/shop.js" strategy="afterInteractive"/></>;}
