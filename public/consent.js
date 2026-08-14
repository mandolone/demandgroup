(() => {
  const COOKIE_NAME = 'dg_cookie_consent';
  const MAX_AGE = 60 * 60 * 24 * 183;
  const readChoice = () => document.cookie.split('; ').find((row) => row.startsWith(`${COOKIE_NAME}=`))?.split('=')[1];
  const saveChoice = (choice) => {
    document.cookie = `${COOKIE_NAME}=${choice}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax; Secure`;
    window.dispatchEvent(new CustomEvent('dg-consent-change', { detail: { choice } }));
  };

  const siteRoot = new URL('/', window.location.origin);
  const banner = document.createElement('section');
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-modal', 'false');
  banner.setAttribute('aria-labelledby', 'cookie-title');
  banner.innerHTML = `
    <button class="cookie-close" type="button" aria-label="Continue with necessary cookies only">×</button>
    <h2 id="cookie-title">Your privacy choices</h2>
    <p>Demand Group currently uses only a necessary cookie to remember this choice. Analytics, advertising and profiling are disabled. Read our <a href="${new URL('cookie-policy/', siteRoot)}">Cookie Policy</a> and <a href="${new URL('website-privacy-policy/', siteRoot)}">Website Privacy Policy</a>.</p>
    <div class="cookie-preferences" id="cookie-preferences">
      <div class="cookie-category"><span><strong>Necessary</strong><br>Stores your privacy choice and supports essential site operation.</span><span class="cookie-status">Always active</span></div>
      <div class="cookie-category"><span><strong>Analytics</strong><br>Audience measurement tools.</span><span class="cookie-status">Not in use</span></div>
      <div class="cookie-category"><span><strong>Marketing</strong><br>Advertising or profiling tools.</span><span class="cookie-status">Not in use</span></div>
    </div>
    <div class="cookie-actions">
      <button class="cookie-reject" type="button">Necessary only</button>
      <button class="cookie-customise" type="button" aria-expanded="false" aria-controls="cookie-preferences">View preferences</button>
      <button class="cookie-accept" type="button">Accept current settings</button>
    </div>`;
  document.body.appendChild(banner);

  const show = () => banner.classList.add('is-visible');
  const hide = () => banner.classList.remove('is-visible');
  const choose = (choice) => { saveChoice(choice); hide(); };
  banner.querySelector('.cookie-close').addEventListener('click', () => choose('necessary'));
  banner.querySelector('.cookie-reject').addEventListener('click', () => choose('necessary'));
  banner.querySelector('.cookie-accept').addEventListener('click', () => choose('optional'));
  banner.querySelector('.cookie-customise').addEventListener('click', (event) => {
    const panel = banner.querySelector('.cookie-preferences');
    const open = panel.classList.toggle('is-open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('[data-cookie-settings]').forEach((button) => button.addEventListener('click', show));
  if (!readChoice()) show();
})();
