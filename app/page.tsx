import type { Metadata } from "next";
import Image from "next/image";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Demand Group — Independent Watch Faces for Wear OS",
  description:
    "An independent studio creating uncommon, vintage-inspired watch faces for Wear OS.",
};

const Arrow = () => <span aria-hidden="true">↗</span>;

export default function Home() {
  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Demand Group home">
          <span className="mark">DG</span>
          <span>Demand Group</span>
        </a>
        <div className="nav-links">
          <a href="#studio">Studio</a>
          <a href="#collection">Collection</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <Image
          className="hero-image"
          src="/hero-collection.png"
          alt="Five Demand Group Wear OS watch faces displayed in a vintage instrument atelier"
          fill
          priority
          sizes="100vw"
        />
        <div className="hero-shade" />
        <div className="hero-content">
          <p className="edition">Independent Wear OS studio · Italy</p>
          <h1>Uncommon timepieces for remarkable wrists.</h1>
          <p className="hero-copy">
            Small-batch watch faces shaped by vintage instruments, mechanical
            detail and a taste for the unexpected.
          </p>
          <a className="primary-action" href="#collection">
            Enter the collection <Arrow />
          </a>
        </div>
        <p className="hero-note">Real Demand Group faces · Presentation mockup</p>
      </section>

      <section className="statement" id="studio">
        <p className="section-index">Demand Group / The studio</p>
        <div>
          <h2>Designed for people who refuse the default.</h2>
          <p>
            Demand Group is a small independent studio devoted to distinctive
            Wear OS watch faces. We approach every dial as a compact designed
            object — precise enough for daily use, peculiar enough to remain
            memorable.
          </p>
        </div>
      </section>

      <section className="principles" aria-label="Design principles">
        <article>
          <span>01</span>
          <h3>Vintage, reconsidered</h3>
          <p>
            References to laboratory instruments, aviation panels and archival
            typography, translated for a contemporary wrist.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>Small by choice</h3>
          <p>
            A selective catalogue developed with care. No endless library, no
            disposable variations — only faces with a reason to exist.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>Useful eccentricity</h3>
          <p>
            Character never comes at the expense of legibility, battery-aware
            design or the information you need at a glance.
          </p>
        </article>
      </section>

      <section className="collection" id="collection">
        <header>
          <p>First collection</p>
          <h2>Instruments for a digital wrist.</h2>
          <span>Launching on Google Play</span>
        </header>
        <div className="product-grid">
          {[
            { number: "01", name: "ER4", images: ["er4-smartwatch.png", "er4-campaign.png"], description: "A luminous vintage instrument with an ivory radial dial, warm metallic details and an unmistakable sense of mechanical ceremony.", features: ["Analog time with central seconds", "Twin numeric information windows", "Day and date display", "Precision outer minute scale", "High-legibility applied numerals", "Vintage radial dial treatment"], provisional: true },
            { number: "02", name: "ER5", images: ["er5-smartwatch.png", "er5-campaign.png"], description: "A high-contrast flight instrument that pairs a bold outer minute scale with a compact twelve-hour register and sharp red accents.", features: ["Analog time with central seconds", "Dual-scale time reading", "Day and date display", "Precision outer minute track", "High-contrast monochrome dial", "Instrument-inspired hand set"], provisional: true },
            { number: "03", name: "ARTEMIS", images: ["artemis-smartwatch.png", "artemis-campaign.png"], description: "A celebration of Artemis II — the first crewed mission of NASA’s Artemis campaign. Four astronauts flew Orion around the Moon to validate deep-space systems and help prepare the way for future human lunar exploration.", features: ["Visual and numeric step counter", "Visual and numeric battery status", "Illustrated Artemis II trajectory around Earth", "Real-time lunar phase visualization", "Selectable additional time zone", "Current temperature and forecasts at +3, +6 and +9 hours", "Continuously rotating star field"] },
            { number: "04", name: "SPUTNIK", images: ["sputnik-smartwatch.png", "sputnik-campaign.png"], description: "A tribute to the first human-made satellite and the moment humanity entered the space age — a shared milestone that transformed science, communication and our view of Earth.", features: ["Analog time with central seconds", "Visual and numeric battery status", "Visual and numeric step counter", "Day and date display", "Current weather information", "Orbital satellite visualization", "Deep-space stellar background"] },
            { number: "05", name: "CYBER", images: ["cyber-smartwatch.png", "cyber-campaign.png"], description: "A precision-built hybrid dial where exposed hardware, vivid red hands and sculpted digital gauges meet in a bold technical instrument.", features: ["Analog time with central seconds", "Visual battery gauge", "Visual step-progress gauge", "Heart-rate display", "Date and weather information", "High-contrast cardinal numerals"], provisional: true },
            { number: "06", name: "GEAR", images: ["gear-smartwatch.png", "gear-campaign.png"], description: "A mechanical dashboard inspired by gears, workshop instruments and layered industrial forms, designed to make everyday information feel tactile.", features: ["Analog time with precision minute register", "Visual battery gauge", "Visual and numeric step counter", "Heart-rate display", "Date and temperature information", "Layered mechanical dial architecture"], provisional: true },
            { number: "07", name: "ZODIAC", images: ["zodiac-smartwatch.png", "zodiac-campaign.png"], description: "An elaborate celestial instrument where zodiac geometry, lunar information and classical astronomy meet in deep blue and gold.", features: ["Analog time with central seconds", "Zodiac ring and constellation display", "Visual lunar phase", "Day and date display", "Weather information", "Additional time indication", "Celestial-inspired night dial"], provisional: true },
          ].map(({ number, name, images, description, features, provisional }) => (
            <details className="product-card" key={name} suppressHydrationWarning>
              <summary>
                <span className={`product-carousel ${images.length > 1 ? "has-slides" : ""}`} aria-label={`${name} image gallery`} tabIndex={images.length > 1 ? 0 : -1}>
                  {images.map((image, index) => <Image key={image} src={`/products/${image}`} alt={images.length > 1 ? `${name} product image ${index + 1} of ${images.length}` : `${name} watch face`} width={900} height={900} />)}
                </span>
                <span className="product-title"><small>DG—{number}</small><strong>{name}</strong>{images.length > 1 ? <span className="slide-hint">Swipe the images →</span> : null}<em>View details +</em></span>
              </summary>
              <div className="product-details">
                {provisional ? <p className="provisional-note">Provisional product description · Final specifications to be confirmed</p> : null}
                <p>{description}</p>
                {features ? <div className="feature-spec"><h4>Functions at a glance</h4><ul>{features.map(feature => <li key={feature}>{feature}</li>)}</ul></div> : null}
                <dl><div><dt>Platform</dt><dd>Wear OS</dd></div><div><dt>Features</dt><dd>{features ? `${features.length} ${provisional ? "provisional" : "documented"} functions` : "Full specification coming soon"}</dd></div><div><dt>Status</dt><dd>In development</dd></div></dl>
                <span className="store-placeholder">Google Play · Coming soon</span>
              </div>
            </details>
          ))}
        </div>
        <p className="collection-disclaimer">Product specifications and Google Play links will be added as each watch face reaches release.</p>
      </section>

      <section className="wear-os">
        <div className="seal" aria-hidden="true">
          <span>W</span>
        </div>
        <div>
          <h2>Made for Wear OS.</h2>
          <p>
            Designed for compatible Wear OS smartwatches using Google&apos;s
            current watch-face standards, with clear information, considered
            always-on states and efficient everyday performance.
          </p>
          <p className="fine-print">
            Wear OS and Google Play are trademarks of Google LLC. Demand Group
            is an independent studio and is not affiliated with Google.
          </p>
        </div>
      </section>

      <section className="contact" id="contact">
        <div>
          <p className="section-index">Business & support</p>
          <h2>The collection is taking shape.</h2>
        </div>
        <div className="contact-copy">
          <p>
            Demand Group is preparing its first independent releases for Google
            Play. Official product links and support contact details will be
            added here before launch.
          </p>
          <a href="#top">Return to the beginning ↑</a>
        </div>
      </section>

      <section className="privacy" id="privacy">
        <h2>Website privacy</h2>
        <p>
          This presentation website does not use accounts, advertising cookies,
          analytics or contact forms, and does not intentionally collect
          personal information. If these features are introduced, this notice
          will be updated before they become active.
        </p>
        <p>Last updated: 13 August 2026.</p>
      </section>

      <footer>
        <div className="wordmark footer-wordmark">
          <span className="mark">DG</span>
          <span>Demand Group</span>
        </div>
        <p>Independent Wear OS watch-face studio.</p>
        <div>
          <a href="/privacy-policy/">App Privacy Policy</a>
          <span>© 2026 Demand Group</span>
        </div>
      </footer>
      <dialog className="product-lightbox" id="product-lightbox" aria-label="Expanded product image">
        <button className="lightbox-close" type="button" aria-label="Close expanded image">×</button>
        <button className="lightbox-arrow lightbox-prev" type="button" aria-label="Previous image">←</button>
        <figure><img alt="" /><figcaption></figcaption></figure>
        <button className="lightbox-arrow lightbox-next" type="button" aria-label="Next image">→</button>
      </dialog>
      <Script src="/gallery.js" strategy="afterInteractive" />
    </main>
  );
}
