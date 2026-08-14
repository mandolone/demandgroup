import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie Policy — Demand Group", description: "Cookies and privacy choices on the Demand Group website." };

export default function CookiePolicy() {
  return <main className="policy-page"><nav className="policy-nav"><a className="wordmark" href="/"><img className="brand-logo" src="/demand-group-logo.jpg" alt="Demand Group Italy" width="1280" height="368" /></a><a href="/">Back to studio</a></nav><article className="policy-document">
    <header><p>Demand Group website</p><h1>Cookie Policy</h1><p className="policy-date"><strong>Last updated:</strong> 14 August 2026</p></header>
    <p>This policy explains the cookies and similar technologies used on the Demand Group website. Under Italian rules, technical cookies do not require prior consent but must be disclosed. Non-technical tracking may be activated only after valid consent.</p>
    <h2>What we currently use</h2><p>The site currently uses <strong>no analytics, advertising or profiling cookies</strong>. It stores only the technical preference cookie shown below.</p>
    <div className="feature-spec"><h4>Technical cookie</h4><dl><div><dt>Name</dt><dd>dg_cookie_consent</dd></div><div><dt>Purpose</dt><dd>Remembers whether you selected necessary-only or accepted optional categories.</dd></div><div><dt>Provider</dt><dd>Demand Group (first party)</dd></div><div><dt>Duration</dt><dd>Up to 183 days</dd></div><div><dt>Legal basis</dt><dd>Necessary to store the user&apos;s privacy preference.</dd></div></dl></div>
    <h2>Optional categories</h2><p>Analytics and marketing categories are shown for transparency, but they are currently marked “Not in use” and no related script or cookie is loaded. Accepting the current settings does not activate tracking and does not authorise any future tool. A new, specific consent request will be required before optional tracking is introduced.</p>
    <h2>Your choice</h2><p>You may confirm the current settings, continue with necessary cookies only, or close the banner without consent. The available options do not restrict access to the website. You can review your choice at any time using <button className="footer-link" type="button" data-cookie-settings>Cookie settings</button>.</p>
    <h2>Browser controls</h2><p>You may also inspect, block or delete cookies in your browser settings. Deleting the preference cookie causes the banner to appear again.</p>
    <h2>Italian summary</h2><p>Il sito utilizza attualmente solo il cookie tecnico <strong>dg_cookie_consent</strong>, necessario per ricordare la scelta espressa e conservato fino a 183 giorni. Non sono attivi cookie analytics, pubblicitari o di profilazione. È sempre possibile proseguire con i soli cookie necessari e modificare successivamente la scelta.</p>
    <h2>Contact</h2><p>For questions, contact <a href="mailto:demandgroup@tuta.io">demandgroup@tuta.io</a>. Additional information is available in the <a href="/website-privacy-policy/">Website Privacy Policy</a>.</p>
  </article><footer className="policy-footer"><span>© 2026 Demand Group</span><div><a href="/website-privacy-policy/">Website Privacy</a><a href="/privacy-policy/">App Privacy Policy</a></div></footer></main>;
}
