import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Demand Group",
  description: "Privacy policy for applications and Wear OS watch faces published by Demand Group.",
};

export default function PrivacyPolicy() {
  return (
    <main className="policy-page">
      <nav className="policy-nav">
        <a className="wordmark" href="/" aria-label="Return to Demand Group home">
          <span className="mark">DG</span>
          <span>Demand Group</span>
        </a>
        <a href="/">Back to studio</a>
      </nav>

      <article className="policy-document">
        <header>
          <p>Applications & Wear OS watch faces</p>
          <h1>Privacy Policy</h1>
          <p className="policy-date"><strong>Last updated:</strong> July 2026</p>
        </header>

        <p>This Privacy Policy explains how applications and watch faces published by <strong>Demand Group</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) handle user information.</p>

        <h2>Information Collection</h2>
        <p>Our Wear OS watch faces and applications do <strong>not collect, store, transmit, or sell any personal information</strong>.</p>
        <p>No user accounts are created. No personal identifiers are collected. No analytics services are used. No advertising SDKs are integrated.</p>

        <h2>Device Permissions</h2>
        <p>Some watch faces may display information provided directly by the Wear OS operating system through official complications or system APIs, including:</p>
        <ul>
          <li>Current time and date</li>
          <li>Battery level</li>
          <li>Heart rate</li>
          <li>Step count</li>
          <li>Distance</li>
          <li>Calories</li>
          <li>Weather information</li>
          <li>Sunrise and sunset times</li>
          <li>Other health or sensor information made available by Wear OS</li>
        </ul>
        <p>This information is processed locally on your device solely for displaying it on the watch face. It is never transmitted to our servers, stored, shared, or used for profiling.</p>

        <h2>Data Sharing</h2>
        <p>We do not share any user information with third parties.</p>

        <h2>Children&apos;s Privacy</h2>
        <p>Our applications are intended for a general audience and do not knowingly collect personal information from children.</p>

        <h2>Changes to this Privacy Policy</h2>
        <p>This Privacy Policy may be updated from time to time. Any modifications will be published on this page with the updated revision date.</p>

        <h2>Contact</h2>
        <p>If you have any questions regarding this Privacy Policy, you may contact us at:</p>
        <p><strong>Email:</strong><br /><a href="mailto:demandgroup@tuta.io">demandgroup@tuta.io</a></p>
      </article>

      <footer className="policy-footer">
        <span>© 2026 Demand Group. All rights reserved.</span>
        <a href="/">demand.group</a>
      </footer>
    </main>
  );
}
