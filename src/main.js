import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || 'support@cooperqsa.com';
const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const cookieConsentEl = document.querySelector('#cookie-consent');
const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
const signupIntentKey = 'tourit-pending-email-confirmation';
const authRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || location.origin;
const cookieConsentName = 'tourit_cookie_consent';
const cookieConsentVersion = 1;
const analyticsMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || '';
let analyticsActive = false;
// Keep social login wired up, but out of the interface until provider setup is complete.
const socialSignInEnabled = false;
const onAirNamePattern = '^[A-Za-z0-9](?:[A-Za-z0-9 ._-]{0,14}[A-Za-z0-9])?$';
const onAirNameRegex = new RegExp(onAirNamePattern);
const onAirNameHelp = '1–16 characters. Use letters, numbers, spaces, hyphens, underscores or periods; start and end with a letter or number.';
const usernamePattern = '^[a-z0-9](?:[a-z0-9_]{1,22}[a-z0-9])?$';
const usernameRegex = new RegExp(usernamePattern);
const usernameHelp = '3–24 characters. Use lowercase letters, numbers and underscores; start and end with a letter or number.';
const normalizedUsername = value => String(value ?? '').trim().toLowerCase();
const authErrorMessage = error => error?.code === '23505' || /profiles_username_unique_idx|username.*already (?:exists|taken|in use)|duplicate key.*username/i.test(error?.message || '')
  ? 'That username is already in use. Choose another one.'
  : error?.message || 'Something went wrong. Please try again.';
const signupIntentIsFresh = () => {
  try { const started=Number(localStorage.getItem(signupIntentKey)); return started>0 && Date.now()-started<24*60*60*1000; }
  catch { return false; }
};
const emailConfirmationReturn = (() => {
  const query=new URLSearchParams(location.search);
  const hash=new URLSearchParams(location.hash.replace(/^#/,'').replace(/^\//,''));
  return query.get('tourit_auth')==='signup' || hash.get('tourit_auth')==='signup' || query.get('type')==='signup' || hash.get('type')==='signup' || (((query.has('code') || hash.has('access_token')) && signupIntentIsFresh()));
})();
const games = ['Valorant','League of Legends','CS2','Dota 2','Rocket League','Overwatch 2','Apex Legends','Fortnite','EA FC','Street Fighter 6'];
const roles = ['Play-by-play Caster','Colour Commentator','Observer','Desk Host','Analyst','Interviewer','Co-streamer'];
let session = null;
let profile = null;
let filters = { q: '', game: '', role: '' };
let lastShellRoute = null;
let lastShellWasTalent = false;
let approvedCoverFile = null;
let approvedCoverOriginal = null;
let approvedCoverPreviewUrl = null;
let pendingCoverCrop = null;
let deletedJobCountdownTimer = null;
let landingRevealObserver = null;
let availabilityMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);
let availabilityMonthChanging = false;
let availabilityChangedDate = '';
let inboxChannel = null;
let inboxRefreshTimer = null;
let notificationChannel = null;
let notificationChannelUserId = null;
let unreadNotificationCount = 0;

const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
const safeExternalUrl = value => {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch { return ''; }
};
const communityPlatformUrl = (value, domains) => {
  const href = safeExternalUrl(value);
  if (!href) return '';
  const hostname = new URL(href).hostname.toLowerCase();
  return domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`)) ? href : '';
};
const communityChannels = [
  { name:'Discord', mark:'D', tone:'discord', description:'Join the conversation with casters, observers and tournament teams.', url:communityPlatformUrl(import.meta.env.VITE_COMMUNITY_DISCORD_URL,['discord.com','discord.gg']) },
  { name:'X', mark:'𝕏', tone:'x', description:'Follow Tourit for platform news, community highlights and opportunities.', url:communityPlatformUrl(import.meta.env.VITE_COMMUNITY_X_URL,['x.com','twitter.com']) },
  { name:'Twitch', mark:'T', tone:'twitch', description:'Find Tourit on stream for broadcasts, showcases and live community moments.', url:communityPlatformUrl(import.meta.env.VITE_COMMUNITY_TWITCH_URL,['twitch.tv']) },
];
const date = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—';
const go = route => { location.hash = `#/${route}`; };
const toast = message => { toastEl.innerHTML = `<div class="toast">${esc(message)}</div>`; setTimeout(() => toastEl.replaceChildren(), 2600); };
function showEmailConfirmedPopup() {
  const identity=profile?.display_name || session?.user?.email || 'your Tourit account';
  toastEl.innerHTML=`<div class="confirmation-backdrop" data-action="close-confirmation"><section class="confirmation-popup" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-copy" tabindex="-1"><button class="confirmation-close" type="button" data-action="close-confirmation" aria-label="Close">×</button><span class="confirmation-check" aria-hidden="true">✓</span><span class="num">EMAIL CONFIRMED</span><h2 id="confirmation-title">You’re all set.</h2><p id="confirmation-copy">Your Tourit account is ready, and you’re signed in as <b>${esc(identity)}</b>.</p><div class="confirmation-actions"><button class="btn p" type="button" data-action="confirmation-dashboard">Go to dashboard</button><button class="btn" type="button" data-action="close-confirmation">Explore Tourit</button></div></section></div>`;
  toastEl.querySelector('.confirmation-popup')?.focus();
}
const read = async (promise) => { const {data,error} = await promise; if(error) throw error; return data; };
const userId = () => session?.user?.id;
function showDeleteJobConfirmation(id,title) {
  toastEl.innerHTML=`<div class="confirmation-backdrop" data-action="cancel-delete-job"><section class="confirmation-popup delete-job-confirmation" role="dialog" aria-modal="true" aria-labelledby="delete-job-title" aria-describedby="delete-job-copy" tabindex="-1"><button class="confirmation-close" type="button" data-action="cancel-delete-job" aria-label="Close">×</button><span class="num">JOB RECOVERY WINDOW</span><h2 id="delete-job-title">Move this job to deleted?</h2><p id="delete-job-copy"><b>${esc(title)}</b> will be hidden from Find Jobs and stored for 24 hours. You can recover it during that time. After 24 hours, the job, its applications and its cover image will be permanently deleted.</p><div class="confirmation-actions"><button class="btn" type="button" data-action="cancel-delete-job">Keep job</button><button class="btn p" type="button" data-action="confirm-delete-job" data-id="${esc(id)}">Move to deleted</button></div></section></div>`;
  toastEl.querySelector('.confirmation-popup')?.focus();
}
function showForceDeleteJobConfirmation(id,title) {
  toastEl.innerHTML=`<div class="confirmation-backdrop" data-action="cancel-force-delete-job"><section class="confirmation-popup delete-job-confirmation force-delete-confirmation" role="dialog" aria-modal="true" aria-labelledby="force-delete-job-title" aria-describedby="force-delete-job-copy" tabindex="-1"><button class="confirmation-close" type="button" data-action="cancel-force-delete-job" aria-label="Close">×</button><span class="num">PERMANENT ACTION</span><h2 id="force-delete-job-title">Delete this job now?</h2><p id="force-delete-job-copy"><b>${esc(title)}</b> and all of its applications and cover image will be permanently deleted now. This skips the remaining recovery time and cannot be undone.</p><div class="confirmation-actions"><button class="btn" type="button" data-action="cancel-force-delete-job">Keep in deleted</button><button class="btn force-delete-submit" type="button" data-action="confirm-force-delete-job" data-id="${esc(id)}">Delete permanently</button></div></section></div>`;
  toastEl.querySelector('.confirmation-popup')?.focus();
}
function showDeleteAllNotificationsConfirmation() {
  toastEl.innerHTML=`<div class="confirmation-backdrop" data-action="cancel-delete-all-notifications"><section class="confirmation-popup delete-job-confirmation force-delete-confirmation" role="dialog" aria-modal="true" aria-labelledby="delete-all-notifications-title" aria-describedby="delete-all-notifications-copy" tabindex="-1"><button class="confirmation-close" type="button" data-action="cancel-delete-all-notifications" aria-label="Close">×</button><span class="num">PERMANENT ACTION</span><h2 id="delete-all-notifications-title">Delete all notifications?</h2><p id="delete-all-notifications-copy">Are you sure you want to do this? It will clear all your notifications, even ones you may have missed. This cannot be undone.</p><div class="confirmation-actions"><button class="btn" type="button" data-action="cancel-delete-all-notifications">Keep notifications</button><button class="btn force-delete-submit" type="button" data-action="confirm-delete-all-notifications">Delete all</button></div></section></div>`;
  toastEl.querySelector('.confirmation-popup')?.focus();
}
function formatDeleteCountdown() {
  document.querySelectorAll('[data-delete-expires]').forEach(node=>{
    const remaining=new Date(node.dataset.deleteExpires).getTime()-Date.now();
    if(remaining<=0){node.textContent='Deleting…';const recover=node.closest('.job-actions')?.querySelector('[data-action="recover-job"]');if(recover)recover.disabled=true;return;}
    const seconds=Math.floor(remaining/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;
    node.textContent=`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  });
}
const oauthProviders = [
  { id:'google', label:'Continue with Google', logo:'https://developers.google.com/static/identity/images/g-logo.png' },
  { id:'azure', label:'Continue with Microsoft', logo:'https://learn.microsoft.com/en-us/entra/identity-platform/media/howto-add-branding-in-apps/ms-symbollockup_mssymbol_19.png' },
  { id:'x', label:'Continue with X', logo:'https://cdn.simpleicons.org/x/FFFFFF' },
  { id:'discord', label:'Continue with Discord', logo:'https://cdn.simpleicons.org/discord/5865F2' },
];
function oauthButtons() {
  return `<div class="oauth-divider"><span>Or continue with</span></div><div class="oauth-grid">${oauthProviders.map(provider=>`<button class="oauth-btn" type="button" data-action="oauth" data-provider="${provider.id}"><img class="oauth-logo oauth-${provider.id}" src="${provider.logo}" alt="" aria-hidden="true"><span>${provider.label}</span></button>`).join('')}</div><p class="oauth-note">First-time social sign-ins will ask you to finish setting up your Tourit profile.</p>`;
}
function oauthOnboardingPage() {
  const metadata=session?.user?.user_metadata||{};
  const suggestedName=profile?.display_name||metadata.full_name||metadata.name||metadata.preferred_username||'';
  const suggestedType=sessionStorage.getItem('tourit-oauth-account-type')||'';
  const isTalent=suggestedType==='talent';
  return `<section class="card oauth-onboarding"><span class="num">ONE LAST STEP</span><h1>Set up your Tourit account.</h1><p class="mu">Choose how you’ll use Tourit. This determines which account tools are available.</p><form id="oauth-onboarding-form"><label>Account type</label><select name="account_type" required><option value="" ${suggestedType?'':'selected'} disabled>Choose an account type</option><option value="talent" ${isTalent?'selected':''}>Talent — find roles and apply</option><option value="host" ${suggestedType==='host'?'selected':''}>Host — recruit talent and post jobs</option></select><label for="oauth-username">Username</label><input id="oauth-username" name="username" minlength="3" maxlength="24" pattern="${usernamePattern}" aria-describedby="username-help" required autocomplete="username"><p id="username-help" class="mu">${usernameHelp} Usernames are unique.</p><label for="oauth-display-name">${isTalent?'On-air name':'Display name'}</label><input id="oauth-display-name" name="display_name" value="${esc(suggestedName)}" maxlength="${isTalent?16:100}" ${isTalent?`pattern="${onAirNamePattern}" aria-describedby="on-air-name-help"`:''} required autocomplete="name"><p id="on-air-name-help" class="mu" ${isTalent?'':'hidden'}>${onAirNameHelp}</p><div id="form-error"></div><button class="btn p" type="submit">Finish account setup</button></form></section>`;
}

function usernameSetupPage() {
  return `<section class="card oauth-onboarding username-setup"><span class="num">ACCOUNT UPDATE REQUIRED</span><h1>Choose your username.</h1><p class="mu">Your on-air name stays ${esc(profile?.display_name || 'your nickname')}. Add a unique username for your Tourit account to continue.</p><form id="username-setup-form"><label for="required-username">Username</label><input id="required-username" name="username" minlength="3" maxlength="24" pattern="${usernamePattern}" aria-describedby="username-help" required autocomplete="username" autofocus><p id="username-help" class="mu">${usernameHelp} Usernames are unique.</p><div id="form-error"></div><button class="btn p" type="submit">Save username and continue</button></form></section>`;
}

function shell(body) {
  const route = location.hash || '#/';
  const isTalentBrowse = body.includes('class="talent-page"');
  const arrivingOnTalent = isTalentBrowse && lastShellRoute !== null && route !== lastShellRoute;
  const leavingTalent = !isTalentBrowse && lastShellWasTalent && lastShellRoute !== null && route !== lastShellRoute;
  const logoMotion = arrivingOnTalent ? ' cyan-arrival' : leavingTalent ? ' yellow-return' : '';
  const authActions = session ? `<a class="l" href="#/dash">Dashboard</a><a class="l" href="#/inbox">Inbox</a><a class="l notification-nav-link" href="#/notifications"><span>Notifications</span><span class="notification-count" ${unreadNotificationCount?'':'hidden'}>${unreadNotificationCount?`+${unreadNotificationCount}`:''}</span></a><button class="btn s" data-action="logout">Log out</button>` : `<span class="header-auth"><a class="btn s" href="#/login">Log in</a><a class="btn p s" href="#/login?signup=1">Sign up</a></span>`;
  const menuItems = `${session?'':authActions}<a class="l" href="#/jobs">Find Jobs</a><a class="l find-talent-nav" href="#/talent">Find Talent</a><a class="l" href="#/promise">Our Promise</a><a class="l" href="#/community">Community</a>${session?authActions:''}`;
  const links = `<nav class="${session?'signed-in':'signed-out'}"><a class="logo" href="#/" aria-label="Tourit home"><span class="logo-mark${logoMotion}" aria-hidden="true"><img src="${isTalentBrowse?'/tourit-app-icon-cyan.png':'/tourit-app-icon-4k.png'}" alt=""></span><span class="logo-word">TOUR<span>IT</span></span></a><button class="mobile-nav-toggle" type="button" data-action="toggle-mobile-menu" aria-label="Open navigation menu" aria-expanded="false" aria-controls="mobile-nav-menu"><span></span><span></span><span></span></button><div class="mobile-nav-menu" id="mobile-nav-menu">${menuItems}</div></nav>`;
  const pageTransition = lastShellRoute !== null && route !== lastShellRoute ? ' class="page-enter"' : '';
  lastShellRoute = route;
  lastShellWasTalent = isTalentBrowse;
  app.innerHTML = `${links}<main${pageTransition}>${body}</main><footer>© 2026 Tourit · Esports broadcast talent · <a href="#/promise">Our Promise</a> · <a href="#/community">Community</a> · <a href="#/contact">Contact us</a> · <a href="#/terms">Terms of Service</a> · <a href="#/legal">Legal &amp; privacy</a> · <button class="cookie-settings-link" type="button" data-action="cookie-settings">Cookie settings</button></footer>`;
  if(isTalentBrowse){const logoIcon=app.querySelector('nav .logo-mark img');if(logoIcon)logoIcon.src='/tourit-app-icon-cyan.png';}
  if(landingRevealObserver){landingRevealObserver.disconnect();landingRevealObserver=null;}
  const revealNodes=app.querySelectorAll('[data-scroll-reveal]');
  if(revealNodes.length&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&'IntersectionObserver' in window){
    revealNodes.forEach(node=>node.classList.add('scroll-reveal'));
    landingRevealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('in-view');landingRevealObserver?.unobserve(entry.target);}
    }),{threshold:.12,rootMargin:'0px 0px -6% 0px'});
    revealNodes.forEach(node=>landingRevealObserver.observe(node));
  }
}

function readCookieConsent() {
  try {
    const cookie = document.cookie.split('; ').find(item => item.startsWith(`${cookieConsentName}=`));
    const saved = cookie ? JSON.parse(decodeURIComponent(cookie.slice(cookieConsentName.length + 1))) : null;
    return saved?.version === cookieConsentVersion && typeof saved.optional === 'boolean' ? saved : null;
  } catch { return null; }
}

function getSavedCookieConsent() {
  const saved = readCookieConsent();
  if (saved) return saved;
  try {
    const fallback = JSON.parse(decodeURIComponent(localStorage.getItem(cookieConsentName) || 'null'));
    return fallback?.version === cookieConsentVersion && typeof fallback.optional === 'boolean' ? fallback : null;
  } catch { return null; }
}

function analyticsPageView() {
  if (!analyticsActive || typeof window.gtag !== 'function') return;
  // Record only the route category. Never send query strings, IDs, or profile/job paths to analytics.
  const route = (location.hash.replace(/^#\/?/, '').split(/[/?&]/)[0] || 'home').toLowerCase();
  const pageTitles = { '': 'Home', home: 'Home', jobs: 'Find Jobs', talent: 'Find Talent', dash: 'Dashboard', inbox: 'Inbox', promise: 'Our Promise', contact: 'Contact', legal: 'Legal and Privacy', login: 'Sign In', signup: 'Sign Up', 'oauth-onboarding': 'Account Setup', demo: 'Demo' };
  const pagePath = route ? `/${route}` : '/home';
  window.gtag('event', 'page_view', {
    page_title: pageTitles[route] || 'Tourit',
    page_location: `${location.origin}${pagePath}`,
    page_path: pagePath,
    page_referrer: location.origin,
  });
}

function clearAnalyticsCookies() {
  const names = document.cookie.split(';').map(item => item.trim().split('=')[0]).filter(name => name === '_ga' || name.startsWith('_ga_') || name === '_gid');
  const hostParts = location.hostname.split('.');
  const domains = [];
  for (let i = 0; i < hostParts.length - 1; i++) domains.push(`.${hostParts.slice(i).join('.')}`);
  names.forEach(name => {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    domains.forEach(domain => { document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`; });
  });
}

function updateAnalyticsConsent(allowed) {
  const validMeasurementId = /^G-[A-Z0-9]+$/i.test(analyticsMeasurementId);
  if (!allowed || !validMeasurementId) {
    analyticsActive = false;
    if (validMeasurementId) window[`ga-disable-${analyticsMeasurementId}`] = true;
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', { analytics_storage: 'denied' });
    if (!allowed) clearAnalyticsCookies();
    return;
  }

  window[`ga-disable-${analyticsMeasurementId}`] = false;
  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', analyticsMeasurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsMeasurementId)}`;
    script.dataset.touritAnalytics = 'true';
    document.head.append(script);
  } else {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
  }
  analyticsActive = true;
  analyticsPageView();
}

function saveCookieConsent(optional) {
  const value = encodeURIComponent(JSON.stringify({ version: cookieConsentVersion, essential: true, optional, savedAt: new Date().toISOString() }));
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${cookieConsentName}=${value}; Max-Age=15552000; Path=/; SameSite=Lax${secure}`;
  // Some privacy modes block cookies; retain the choice for the current browser profile where possible.
  if (!readCookieConsent()) {
    try { localStorage.setItem(cookieConsentName, value); } catch {}
  }
  updateAnalyticsConsent(optional);
  renderCookieConsent(false);
}

function renderCookieConsent(forceOpen = false) {
  if (!cookieConsentEl) return;
  const saved = getSavedCookieConsent();
  const open = forceOpen || !saved;
  cookieConsentEl.innerHTML = open ? `<section class="cookie-banner" role="region" aria-label="Cookie preferences" aria-describedby="cookie-copy"><div class="cookie-copy"><b>Cookies, your call.</b><p id="cookie-copy">Essential browser storage keeps your Tourit sign-in working. Optional analytics cookies stay off unless you allow them.</p><button class="cookie-details" type="button" data-action="cookie-details" aria-expanded="false">What does this mean?</button><p class="cookie-details-copy" hidden>Tourit loads Google Analytics only when it is configured and you allow analytics cookies. Analytics stores usage information such as page views. Rejecting or later turning off analytics prevents the tag from loading and clears its cookies. Your choice is saved on this device for six months and can be changed from Cookie settings.</p></div><div class="cookie-actions"><button class="btn s" type="button" data-action="cookie-reject">Reject analytics</button><button class="btn p s" type="button" data-action="cookie-allow">Allow analytics</button></div></section>` : '';
}

renderCookieConsent();
updateAnalyticsConsent(Boolean(getSavedCookieConsent()?.optional));
function errorBox(message) { return `<p class="err" role="alert">${esc(message)}</p>`; }

const demoProfiles = {
  caster: {
    name:'Riley Chen', handle:'RILEY “SWITCH” CHEN', initials:'RC', role:'Play-by-play Caster',
    games:['Valorant','Rocket League'], languages:['English','Mandarin'], location:'Leeds, UK', region:'Europe', years:6, mode:'Remote',
    brief:'High-energy play-by-play for the rounds fans remember.',
    bio:'I bring clear calls, fast reads and a little theatre to every broadcast. I work closely with observers and desk talent to keep the story moving between rounds.',
    events:['NOVA Circuit · Spring Finals','Northern LAN · Main Stage'], reel:'rileychen.example/reel', accent:'245,224,0',
  },
  host: {
    name:'Maya Thompson', handle:'MAYA “MAYDAY” THOMPSON', initials:'MT', role:'Desk Host',
    games:['Apex Legends','Overwatch 2'], languages:['English','Spanish'], location:'Manchester, UK', region:'Europe', years:8, mode:'Both',
    brief:'Warm, sharp desk hosting that makes every guest feel at home.',
    bio:'From opening desk to trophy lift, I help players and viewers connect with the people behind the plays. Comfortable with live interviews, sponsor reads and fast format changes.',
    events:['Apex Ascension · EMEA','Overwatch Open · Grand Final'], reel:'mayathompson.example/showreel', accent:'38,211,238',
  },
  analyst: {
    name:'Theo Laurent', handle:'THEO “FRAME” LAURENT', initials:'TL', role:'Analyst',
    games:['League of Legends','CS2'], languages:['English','French'], location:'Paris, France', region:'Europe', years:4, mode:'Remote',
    brief:'Turning drafts, data and tiny details into the big picture.',
    bio:'I build accessible analysis around the decisions that change a series. My prep combines VOD review, clear visual notes and concise desk segments that work for new fans and veterans.',
    events:['Summit Series · Playoffs','Continental Clash · Week 5'], reel:'theolaurent.example/analysis', accent:'167,139,250',
  },
};
const demoOrganisation = {
  name:'Northstar Broadcast', initials:'N★', location:'London · EMEA',
  description:'Independent esports production built around thoughtful storytelling, crisp competition coverage and talent-first broadcasts.',
  website:'northstarbroadcast.example',
  productions:['NOVA Circuit','Northern LAN','Summit Series'],
};

function localHomePreview() {
  if (!import.meta.env.DEV) return '';
  const samples = Object.values(demoProfiles);
  return `<section class="local-preview" aria-label="Local sample content"><div class="local-preview-head" data-scroll-reveal><div><span class="num">LOCAL BUILD PREVIEW · FICTIONAL DATA</span><h2>Meet the broadcast talent.</h2></div><span class="mu">Examples appear only while running the local development server.</span></div><div class="local-preview-grid">${samples.map((person,index)=>`<article class="card local-person" data-scroll-reveal style="--sample-accent:${person.accent};--reveal-delay:${120+index*80}ms"><div class="local-person-mark">${esc(person.initials)}</div><div><span class="num">${esc(person.role.toUpperCase())}</span><h3>${esc(person.name)}</h3><p>${esc(person.brief)}</p><div class="row">${person.games.map(game=>`<span class="tag">${esc(game)}</span>`).join('')}</div></div><span class="tag local-years">${person.years} years · ${esc(person.region)}</span></article>`).join('')}<article class="card local-tournament" data-scroll-reveal style="--reveal-delay:360ms"><div><span class="num">SAMPLE TOURNAMENT · ${esc(demoOrganisation.name.toUpperCase())}</span><h3>NOVA RIFT OPEN</h3><p>Two days. Eight teams. One broadcast team to bring it to life.</p></div><div class="row"><span class="tag y">VALORANT</span><span class="tag">20–21 Feb 2027</span><span class="tag">6 sample roles</span></div></article></div></section>`;
}

function homePage() {
  return `<div class="home-page"><div class="hero" data-scroll-reveal="hero"><span class="num">THE HOME FOR ESPORTS BROADCAST TALENT</span><h1>Where esports <em>broadcast talent</em> meets opportunity.</h1><p class="mu">Tourit connects tournament organisers and production companies with casters, hosts, analysts and interviewers.</p><a class="promise-inline-link" href="#/promise">A professional network this community should have had from the start <span aria-hidden="true">↗</span></a></div><div class="pick lg landing-picks"><a class="pk t" data-scroll-reveal style="--reveal-delay:100ms" href="#/jobs"><span class="num">FOR TALENT</span><h2>Find jobs</h2><span class="mu">Browse casting, hosting and analyst roles.</span></a><a class="pk c" data-scroll-reveal style="--reveal-delay:220ms" href="#/talent"><span class="num">FOR RECRUITERS</span><h2>Find talent</h2><span class="mu">Discover and contact esports broadcast talent.</span></a></div>${localHomePreview()}</div>`;
}

function promisePage() {
  return `<article class="promise-page">
    <header class="promise-hero" data-scroll-reveal="hero"><span class="num">OUR PROMISE · BUILT FOR THE BROADCAST COMMUNITY</span><h1>Esports broadcasting deserves a foundation of its own.</h1><p>Casters and observers help make competition mean something to the people watching. Yet finding peers, building experience and discovering the next opportunity can still depend on who you know and who happens to be looking.</p><p class="promise-emphasis">That network should have existed all along. We’re building it.</p></header>
    <section class="promise-story" data-scroll-reveal><h2>Talent is everywhere. The pathways are scattered.</h2><p>For Valorant casters and observers especially, the craft is real: reading a round, telling its story, guiding the viewer’s eye and earning trust on a live show. But practice, connections and paid work are often found in separate places, through private chats, one-off calls and word of mouth.</p><p>That makes it harder for new voices to get a first real credit, and harder for experienced talent to find the next consistent role.</p></section>
    <section class="promise-pillars" aria-label="What Tourit is building"><div class="promise-pillar" data-scroll-reveal style="--reveal-delay:80ms"><span class="num">FOR THE PEOPLE BEHIND THE SHOW</span><h2>Make your work visible.</h2><p>Create a home for your role, games, experience, past events and reel. Find opportunities, meet the people putting broadcasts together and keep building your craft.</p><a href="#/talent">Meet the talent community <span aria-hidden="true">↗</span></a></div><div class="promise-pillar" data-scroll-reveal style="--reveal-delay:180ms"><span class="num">FOR THE PEOPLE BUILDING EVENTS</span><h2>Find the right voices and eyes.</h2><p>Bring casting, observing, hosting and analysis needs into one clear brief. Find people who fit the game and the production, and build relationships that can carry into the next event.</p><a href="#/jobs">Explore open roles <span aria-hidden="true">↗</span></a></div></section>
    <section class="promise-foundation" data-scroll-reveal><span class="num">A LONG-MISSING PIECE OF THE ECOSYSTEM</span><h2>Not a shortcut around the work. A better place for the work to meet.</h2><p>Tourit is here to give esports broadcast talent a more open, dependable way to be discovered—and give tournaments a dedicated place to find the people who bring the game to life. Every profile, conversation and opportunity can help turn a one-off connection into a lasting part of the scene.</p><p>We can’t promise every application becomes a booking. We can promise to keep building a clearer, more connected starting point for the people who make broadcasts happen.</p><div class="row"><a class="btn p" href="#/login?signup=1&amp;type=talent">Build your profile</a><a class="btn" href="#/login?signup=1&amp;type=host">Find broadcast talent</a></div></section>
  </article>`;
}

function contactPage() {
  return `<article class="info-page contact-page"><header class="info-hero"><span class="num">GET IN TOUCH</span><h1>Contact Tourit.</h1><p class="mu">Questions about an account, a casting call, working together or something that needs our attention? Send the team a note.</p></header><div class="contact-layout"><section class="card contact-card"><span class="num">GENERAL & ACCOUNT SUPPORT</span><h2>We’re here to help.</h2><p class="mu">For account access, profile updates, job listings and general questions, email our team. Please don’t include passwords, payment details or sensitive personal information.</p><a class="btn p" href="mailto:${esc(contactEmail)}?subject=Tourit%20support">Email ${esc(contactEmail)} <span aria-hidden="true">↗</span></a><small class="mu contact-response-note">This opens your email app; Tourit does not send or store this message through the website.</small></section><aside class="contact-side"><div class="contact-route"><span class="contact-symbol" aria-hidden="true">01</span><div><b>Privacy requests</b><p>Ask about access, correction or deletion of your personal information.</p></div></div><div class="contact-route"><span class="contact-symbol" aria-hidden="true">02</span><div><b>Safety & content</b><p>Report a profile, message or listing that appears misleading or inappropriate.</p></div></div><div class="contact-route"><span class="contact-symbol" aria-hidden="true">03</span><div><b>Partnerships</b><p>Talk to us about bringing Tourit to your tournament or production team.</p></div></div></aside></div><p class="contact-legal-note">For details about how information is handled, read our <a href="#/legal">Legal &amp; privacy page</a>.</p></article>`;
}

function communityPage() {
  const channels = communityChannels.map(channel => channel.url
    ? `<a class="community-channel ${channel.tone}" href="${esc(channel.url)}" target="_blank" rel="noopener noreferrer"><span class="community-mark" aria-hidden="true">${channel.mark}</span><span class="community-copy"><b>${channel.name}</b><span>${channel.description}</span></span><span class="community-action">Visit channel <span aria-hidden="true">↗</span></span></a>`
    : `<div class="community-channel ${channel.tone} community-pending" aria-label="${channel.name} link coming soon"><span class="community-mark" aria-hidden="true">${channel.mark}</span><span class="community-copy"><b>${channel.name}</b><span>${channel.description}</span></span><span class="community-action">Coming soon</span></div>`).join('');
  return `<article class="info-page community-page"><header class="info-hero"><span class="num">TOURIT · COMMUNITY</span><h1>Stay close to the scene.</h1><p class="mu">Follow Tourit, meet people building esports broadcasts and keep up with the opportunities shaping the community.</p></header><section class="community-grid" aria-label="Tourit social channels">${channels}</section><p class="community-note">Have a question or want to work with us? <a href="#/contact">Get in touch <span aria-hidden="true">↗</span></a></p></article>`;
}

function termsPage() {
  return `<article class="info-page legal-page terms-page"><header class="info-hero"><span class="num">TOURIT · TERMS OF SERVICE</span><h1>Terms of Service</h1><p class="mu">These terms apply to your use of the Tourit website and services.</p><p class="legal-updated">Draft for operator review · Last reviewed 15 October 2026</p></header><aside class="legal-review-notice"><b>Draft terms — operator review required.</b><span>Before launch, confirm the legal operator name and address, governing law, liability provisions and any age or eligibility requirements for your markets.</span></aside>
    <section class="legal-section"><span class="num">01 · AGREEMENT</span><h2>Acceptance and eligibility</h2><p>By creating an account or using Tourit, you agree to these Terms of Service and our <a href="#/legal">Privacy Notice</a>. If you do not agree, do not use Tourit. You must be legally eligible to use the service in your location and comply with applicable age requirements.</p><p>Tourit is owned, managed and maintained by CooperQSA. The service operator’s legal name and contact address must be added before public launch.</p></section>
    <section class="legal-section"><span class="num">02 · ACCOUNTS</span><h2>Account information and security</h2><p>You must provide accurate account information and keep your sign-in credentials confidential. You are responsible for activity carried out through your account. Contact us promptly if you believe your account has been accessed without permission.</p><p>You must not create an account to impersonate another person, avoid a restriction or mislead another user. We may ask you to correct information that is materially inaccurate or inappropriate for Tourit.</p></section>
    <section class="legal-section"><span class="num">03 · ACCEPTABLE USE</span><h2>Profiles, listings and communications</h2><p>You may use Tourit to publish talent profiles, view and post opportunities, apply for roles and communicate with other members. You must use these features lawfully and must not post fraudulent, deceptive, discriminatory, abusive or unlawful content; harass or threaten another person; misuse personal information; infringe rights; upload malware; attempt unauthorised access; or interfere with the service.</p><p>Recruiters are responsible for the accuracy of organisation information, listings, requirements, dates, payment details and communications. Talent members are responsible for the accuracy of their profiles, applications, availability and portfolio material. Do not include confidential or sensitive information in public fields.</p><p>Tourit provides tools for users to connect. Tourit does not employ or represent users, verify every user or listing, negotiate engagements, guarantee payment or guarantee that an application will result in work. Users must check the other party and agree directly on scope, schedule, compensation, rights, expenses and other engagement terms.</p></section>
    <section class="legal-section"><span class="num">04 · USER CONTENT</span><h2>Ownership and permission</h2><p>You retain ownership of content you submit. You must own that content or have permission to use and share it, including images, recordings, logos, reels and personal information about other people.</p><p>You give Tourit a non-exclusive, worldwide, royalty-free licence to host, store, reproduce, format and display your content as necessary to operate, secure and provide the service. This licence ends when the content is removed, except for copies retained temporarily in backups or where retention is required by law. Public profiles and active listings may be visible to visitors.</p><p>Contact <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a> to report content that may breach these terms or another person’s rights.</p></section>
    <section class="legal-section"><span class="num">05 · CONTENT AND ACCOUNTS</span><h2>Removal and suspension</h2><p>You can edit profile and listing information using the available account tools. A deleted job is hidden from public listings and can be recovered for 24 hours. After that, it and associated data are scheduled for permanent removal. Force deletion removes the job and associated data immediately. Some information may remain in backups for a limited period or where retention is required by law.</p><p>We may restrict access, remove content or close an account if we reasonably believe these terms have been breached, a person or the service is at risk, or action is required by law. Where practical, we will explain the reason and provide a contact route.</p></section>
    <section class="legal-section"><span class="num">06 · SERVICE CHANGES</span><h2>Availability</h2><p>We may update, suspend or discontinue features to maintain or protect Tourit. We will try to give notice when a material change affects users. The service is provided as available. To the extent permitted by law, we do not guarantee uninterrupted access, error-free operation or the accuracy or availability of user-submitted information.</p></section>
    <section class="legal-section"><span class="num">07 · LIABILITY AND GOVERNING LAW</span><h2>Legal terms</h2><p>Nothing in these terms limits a right or liability that cannot legally be limited. The operator’s responsibility for losses arising from use of Tourit must be reviewed and stated in accordance with the law that applies to the operator and each user. These draft terms do not exclude liability for fraud, deliberate wrongdoing or other liability that cannot legally be excluded.</p><p>The operator must specify the governing law and courts before launch. Mandatory consumer rights in a user’s place of residence continue to apply where required.</p></section>
    <section class="legal-section"><span class="num">08 · CHANGES AND CONTACT</span><h2>Updates to these terms</h2><p>We may revise these terms as Tourit changes. Where required, we will explain material changes before they take effect. The date above shows when this draft was last reviewed.</p><p>Contact <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a> or visit our <a href="#/contact">Contact page</a>. For personal information and cookies, read the <a href="#/legal">Legal &amp; privacy page</a>.</p></section>
  </article>`;
}

function legalPage() {
  return `<article class="info-page legal-page"><header class="info-hero"><span class="num">TOURIT · LEGAL & PRIVACY</span><h1>Clear terms. Respect for your work and information.</h1><p class="mu">This page explains the basic rules for using Tourit and how the current product handles information.</p><p class="legal-updated">Draft for operator review · Last reviewed 15 October 2026</p></header><aside class="legal-review-notice"><b>Complete the operator details before public launch.</b><span>The legal business name, registered/contact address, verified support mailbox, retention schedule and hosting-region details still need confirmation.</span></aside>
    <section class="legal-section"><span class="num">01 · USING TOURIT</span><h2>Terms of use</h2><p>Tourit is a platform for esports broadcast talent and the organisers and production teams looking to work with them. Use of the service is subject to our <a href="#/terms">Terms of Service</a>, which cover accounts, listings, applications, messages, user content and how the service operates.</p><p>These terms need review against the operator’s legal jurisdiction and intended business model before launch.</p></section>
    <section class="legal-section"><span class="num">02 · PERSONAL INFORMATION</span><h2>Privacy notice</h2><h3>Who operates Tourit</h3><p>Tourit is the service name. The legal name and address of the person or business responsible for personal information must be confirmed and published here before public launch. Contact: <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a>.</p><h3>What we handle and why</h3><p>The current product can handle account email and sign-in details; display names and account type; talent profile fields, portfolio links and profile photos; organisation details; job listings and cover images; applications; private messages; and essential security and cookie-preference data. We use this information to operate accounts, profiles, listings, applications and messaging, protect the service, and respond to support requests.</p><p>Published profiles, organisation information and open jobs are visible to site visitors. Applications and messages are available to their intended participants. Do not put sensitive information in public profile fields or messages.</p><h3>Service providers</h3><p>Tourit is owned, managed and maintained by CooperQSA, a service business that builds and operates digital products including Tourit. The current build also uses Supabase for authentication, database and file storage, Vercel for website hosting, and Google Fonts for typography. If configured, Google Analytics 4 is loaded only after a visitor allows analytics cookies and receives page-view events using a reduced route name. The operator must confirm service regions, relevant subprocessors, international transfers, safeguards, Google Analytics settings and the appropriate retention period before public launch.</p><h3>Legal basis and retention</h3><p>The operator must document the lawful basis for each use of personal information and publish the applicable retention periods. Analytics is optional and remains disabled until consent is given; a visitor can change this choice at any time in Cookie settings. Job deletion currently has a 24-hour recovery window; after that, the job and associated data are scheduled for permanent removal. Retention rules for accounts, applications, messages, support enquiries, analytics data and backups still need to be set and verified.</p><h3>Your choices and rights</h3><p>Depending on the applicable law and circumstances, you may be able to request access, correction, deletion, restriction or a copy of your information, or object to certain processing. Contact <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a> to make a request. You can also complain to the UK Information Commissioner’s Office if UK data protection law applies: <a href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">ico.org.uk/make-a-complaint</a>.</p></section>
    <section class="legal-section"><span class="num">03 · COOKIES & DEVICE STORAGE</span><h2>Cookie choices</h2><p>Tourit uses a small preference cookie to remember whether you allowed analytics, for up to six months. The sign-in flow also stores authentication state in browser storage so you can stay signed in. If Google Analytics 4 is configured, it is loaded only after you allow analytics and may set first-party identifiers such as <code>_ga</code> and <code>_ga_*</code> to measure visits and page views. Rejecting analytics prevents the tag from loading; changing your choice later updates consent and removes those cookies. You can reopen your preference panel at any time with <button type="button" class="inline-action" data-action="cookie-settings">Cookie settings</button>.</p><p>Analytics data retention and the final privacy disclosures must be reviewed by the operator before public launch.</p></section>
    <section class="legal-section"><span class="num">04 · UPDATES & CONTACT</span><h2>Keeping this page current</h2><p>We will update this page when the service, providers or data practices change. The operator should review the page regularly and tell users about material changes before introducing new uses of their information.</p><p>Questions, privacy requests or reports: <a href="mailto:${esc(contactEmail)}">${esc(contactEmail)}</a>. Read our <a href="#/contact">Contact page</a> for the best route.</p></section>
  </article>`;
}

function authPage(signup, type = '') {
  if (signup && !type) return `<section class="signup-choice"><span class="num">YOUR NEXT PLAY STARTS HERE</span><h1>Choose your lane.</h1><p class="mu">Join the people bringing esports broadcasts to life. Set up the account that fits what you do.</p><div class="pick lg signup-pick"><a class="pk t" href="#/login?signup=1&amp;type=talent"><span class="num">CASTERS · HOSTS · ANALYSTS</span><h2>Build your talent profile.</h2><span class="mu">Showcase your on-air style, find opportunities and apply to casting calls.</span><span class="btn p">Join as talent <span aria-hidden="true">→</span></span></a><a class="pk c" href="#/login?signup=1&amp;type=host"><span class="num">ORGANISERS · PRODUCERS · TEAMS</span><h2>Build your broadcast team.</h2><span class="mu">Create your organisation profile, post roles and connect with broadcast talent.</span><span class="btn p">Join as a host <span aria-hidden="true">→</span></span></a></div><p class="signup-existing">Already have an account? <a href="#/login">Log in</a></p></section>`;
  return `<section class="card auth-card"><h2>${signup ? `Register as ${type}` : 'Log in'}</h2><div class="auth-email-label">${signup?'Register with email':'Use your email and password'}</div><form id="auth-form">${signup ? `<label for="signup-username">Username</label><input id="signup-username" name="username" minlength="3" maxlength="24" pattern="${usernamePattern}" aria-describedby="username-help" required autocomplete="username"><p id="username-help" class="mu">${usernameHelp} Usernames are unique.</p><label for="signup-display-name">${type === 'host' ? 'Organisation name' : 'On-air name (your nickname)'}</label><input id="signup-display-name" name="display_name" required maxlength="${type==='talent'?16:100}" ${type==='talent'?`pattern="${onAirNamePattern}" aria-describedby="on-air-name-help"`:''} autocomplete="name">${type==='talent'?`<p id="on-air-name-help" class="mu">${onAirNameHelp}</p>`:''}<input type="hidden" name="account_type" value="${esc(type)}">` : ''}<label>Email</label><input name="email" type="email" autocomplete="email" required><label>Password</label><input name="password" type="password" minlength="8" autocomplete="${signup?'new-password':'current-password'}" required><div id="form-error"></div><button class="btn p" type="submit">${signup?'Sign up':'Log in'}</button>${signup ? '<p class="mu">We’ll email you a confirmation link before your first sign in.</p>' : '<p class="mu"><a href="#/reset">Forgot your password?</a></p>'}</form>${socialSignInEnabled?oauthButtons():''}</section>`;
}
function jobCard(job) {
  const cover=job.cover_path?supabase.storage.from('tourit-job-covers').getPublicUrl(job.cover_path).data.publicUrl:'';
  return `<article class="card jc">${cover?`<img class="cv" alt="${esc(job.title)} cover" src="${esc(cover)}">`:''}<div class="jb"><b>${esc(job.title)}</b><div class="mu">${esc(job.organisations?.name || 'Organisation')} · ${esc(job.game)}</div><div class="row"><span class="tag ${job.payment_type==='Paid'?'g':'y'}">${esc(job.payment_type)}${job.budget_minor?` · £${Math.round(job.budget_minor/100)}`:''}</span><span class="tag">${esc(job.work_mode)}</span></div><div class="row"><span class="tag">Event ${date(job.event_date)}</span><span class="tag">Apply by ${date(job.application_deadline)}</span></div><p class="pv">${esc(job.description)}</p><div class="row"><a class="btn s p" href="#/job/${job.id}">View details</a>${session && profile?.account_type==='talent'?`<button class="btn s" data-action="save-job" data-id="${job.id}"><span class="ui-icon" aria-hidden="true">☆</span> Save</button>`:''}</div></div></article>`;
}
async function uploadPublicImage(bucket,file,maxBytes) {
  if(!file || file.size===0) return null;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
  if(file.size>maxBytes) throw new Error(`Image must be smaller than ${Math.round(maxBytes/1048576)} MB.`);
  const extension={ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[file.type];
  const path=`${userId()}/${crypto.randomUUID()}.${extension}`;
  const {error}=await supabase.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
  if(error) throw error;
  return path;
}
function updateCoverCropPreview() {
  const state=pendingCoverCrop;
  const stage=toastEl.querySelector('#cover-crop-stage');
  const image=toastEl.querySelector('#cover-crop-image');
  if(!state||!stage||!image||!state.image.naturalWidth) return;
  const width=stage.clientWidth,height=stage.clientHeight;
  if(!width||!height) return;
  const scale=Math.max(width/state.image.naturalWidth,height/state.image.naturalHeight)*state.zoom;
  const imageWidth=state.image.naturalWidth*scale,imageHeight=state.image.naturalHeight*scale;
  state.scale=scale;state.imageWidth=imageWidth;state.imageHeight=imageHeight;
  image.style.width=`${imageWidth}px`;image.style.height=`${imageHeight}px`;
  image.style.left=`${(width-imageWidth)*state.panX}px`;image.style.top=`${(height-imageHeight)*state.panY}px`;
  const zoomLabel=toastEl.querySelector('#cover-zoom-value');if(zoomLabel)zoomLabel.textContent=`${Math.round(state.zoom*100)}%`;
}
async function openCoverCropper(file) {
  if(!file) return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Choose a JPEG, PNG or WebP image.');return;}
  if(file.size>8*1024*1024){toast('Cover image must be smaller than 8 MB.');return;}
  if(pendingCoverCrop?.url) URL.revokeObjectURL(pendingCoverCrop.url);
  const input=document.querySelector('#post-job [name="cover_file"]');if(input)input.value='';
  const state={file,url:URL.createObjectURL(file),image:new Image(),zoom:1,panX:.5,panY:.5,drag:null};
  pendingCoverCrop=state;
  toastEl.innerHTML=`<div class="cover-crop-backdrop" data-action="cancel-cover-crop"><section class="cover-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="cover-crop-title" tabindex="-1"><button class="confirmation-close" type="button" data-action="cancel-cover-crop" aria-label="Close">×</button><span class="num">JOB COVER IMAGE</span><h2 id="cover-crop-title">Frame your image.</h2><p class="mu">Drag the image to reposition it. Adjust the zoom until the important details fit inside the preview.</p><div id="cover-crop-stage" class="cover-crop-stage"><img id="cover-crop-image" alt="Image crop preview"><span class="cover-crop-guides" aria-hidden="true"></span></div><div class="cover-zoom-control"><label for="cover-zoom">Zoom <output id="cover-zoom-value">100%</output></label><input id="cover-zoom" type="range" min="1" max="3" step="0.01" value="1"></div><p id="cover-crop-error" class="form-error" role="alert"></p><div class="cover-crop-actions"><button class="btn" type="button" data-action="cancel-cover-crop">Cancel</button><button class="btn p" type="button" data-action="confirm-cover-crop">Confirm image</button></div></section></div>`;
  state.image.onload=()=>{if(pendingCoverCrop!==state)return;toastEl.querySelector('#cover-crop-image').src=state.url;updateCoverCropPreview();toastEl.querySelector('.cover-crop-dialog')?.focus();};
  state.image.onerror=()=>{if(pendingCoverCrop===state){closeCoverCropper();toast('This image could not be opened. Try another JPEG, PNG or WebP image.');}};
  state.image.src=state.url;
  const stage=toastEl.querySelector('#cover-crop-stage');
  stage.addEventListener('pointerdown',event=>{if(!pendingCoverCrop)return;state.drag={x:event.clientX,y:event.clientY};stage.setPointerCapture(event.pointerId);stage.classList.add('dragging');});
  stage.addEventListener('pointermove',event=>{if(!state.drag)return;const dx=event.clientX-state.drag.x,dy=event.clientY-state.drag.y;state.drag={x:event.clientX,y:event.clientY};const maxX=Math.max(1,state.imageWidth-stage.clientWidth),maxY=Math.max(1,state.imageHeight-stage.clientHeight);state.panX=Math.max(0,Math.min(1,state.panX-dx/maxX));state.panY=Math.max(0,Math.min(1,state.panY-dy/maxY));updateCoverCropPreview();});
  stage.addEventListener('pointerup',()=>{state.drag=null;stage.classList.remove('dragging');});
  stage.addEventListener('pointercancel',()=>{state.drag=null;stage.classList.remove('dragging');});
  toastEl.querySelector('#cover-zoom').addEventListener('input',event=>{state.zoom=Number(event.target.value);updateCoverCropPreview();});
}
function closeCoverCropper() {
  if(pendingCoverCrop?.url) URL.revokeObjectURL(pendingCoverCrop.url);
  pendingCoverCrop=null;toastEl.replaceChildren();
}
async function confirmCoverCrop() {
  const state=pendingCoverCrop,stage=toastEl.querySelector('#cover-crop-stage');
  if(!state||!stage)return;
  try {
    const width=stage.clientWidth,height=stage.clientHeight,scale=state.scale;
    if(!width||!height||!scale) throw new Error('The crop preview is still loading. Try again in a moment.');
    const sx=Math.max(0,Math.min(state.image.naturalWidth-width/scale,-((width-state.imageWidth)*state.panX)/scale));
    const sy=Math.max(0,Math.min(state.image.naturalHeight-height/scale,-((height-state.imageHeight)*state.panY)/scale));
    const sw=Math.min(width/scale,state.image.naturalWidth-sx),sh=Math.min(height/scale,state.image.naturalHeight-sy);
    // Match the fixed 240:220 cover box used by desktop Find Jobs cards.
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1100;
    const context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not prepare this image.');
    context.fillStyle='#111114';context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(state.image,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Could not crop this image.')),'image/jpeg',.92));
    approvedCoverFile=new File([blob],`${state.file.name.replace(/\.[^.]+$/,'')}-cover.jpg`,{type:'image/jpeg'});
    approvedCoverOriginal=state.file;
    if(approvedCoverPreviewUrl)URL.revokeObjectURL(approvedCoverPreviewUrl);
    approvedCoverPreviewUrl=URL.createObjectURL(approvedCoverFile);
    const preview=document.querySelector('#cover-preview');if(preview)preview.src=approvedCoverPreviewUrl;
    const previewWrap=document.querySelector('#cover-preview-wrap');if(previewWrap)previewWrap.hidden=false;
    const status=document.querySelector('#cover-image-status');if(status)status.textContent='Image ready — you can adjust the crop or choose another image.';
    const input=document.querySelector('#post-job [name="cover_file"]');if(input)input.value='';
    closeCoverCropper();
  } catch(error) {
    const errorNode=toastEl.querySelector('#cover-crop-error');if(errorNode)errorNode.textContent=error.message;
  }
}
async function jobsPage() {
  const term = filters.q.trim();
  let query = supabase.from('jobs').select('*,organisations(name)').eq('status','open').gte('application_deadline',new Date().toISOString().slice(0,10)).order('created_at',{ascending:false}).limit(60);
  if(filters.game) query = query.eq('game',filters.game);
  if(filters.role) query = query.eq('role',filters.role);
  const rows = await read(query);
  const matched = rows.filter(j => !term || `${j.title} ${j.game} ${j.role} ${j.organisations?.name}`.toLowerCase().includes(term.toLowerCase()));
  shell(`<div class="jobs-page"><h2>Find Jobs</h2><div class="filters talent-filters job-filters"><label class="talent-filter talent-search-field"><span>SEARCH</span><input id="search" class="talent-search" placeholder="Search title, organisation, game" value="${esc(filters.q)}"></label>${talentFilterDropdown('filter-game','GAME',games,filters.game,'All games')}${talentFilterDropdown('filter-role','ROLE',roles,filters.role,'All roles')}</div><div class="list">${matched.map(jobCard).join('')||'<p class="mu">No live jobs match these filters.</p>'}</div></div>`);
}
function talentFilterDropdown(id,label,options,selected,placeholder) {
  const allOptions=[{value:'',label:placeholder},...options.map(value=>({value,label:value}))];
  const current=allOptions.find(option=>option.value===selected)||allOptions[0];
  return `<div class="talent-filter"><span>${label}</span><div class="talent-dropdown" data-filter-dropdown="${id}"><button class="talent-dropdown-trigger" type="button" data-action="toggle-talent-filter" data-filter="${id}" aria-label="Filter by ${label.toLowerCase()}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-options"><span class="talent-dropdown-value${selected?'':' placeholder'}">${esc(current.label)}</span><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="talent-dropdown-menu" id="${id}-options" role="listbox" aria-label="${label} options">${allOptions.map((option,index)=>`<button class="talent-dropdown-option${option.value===selected?' selected':''}" type="button" role="option" aria-selected="${option.value===selected}" tabindex="0" data-action="choose-talent-filter" data-filter="${id}" data-value="${esc(option.value)}" style="--option-index:${index}"><span>${esc(option.label)}</span>${option.value===selected?'<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8 3 3 7-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>':''}</button>`).join('')}</div><select id="${id}" hidden aria-hidden="true" tabindex="-1"><option value="">${esc(placeholder)}</option>${options.map(option=>`<option value="${esc(option)}" ${option===selected?'selected':''}>${esc(option)}</option>`).join('')}</select></div></div>`;
}
async function talentPage() {
  availabilityMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);
  const data = await read(supabase.from('talent_profiles').select('user_id,role,games,languages,location,region,experience_years,work_mode,brief,bio,portfolio_url').eq('published',true).limit(80));
  const ids = data.map(t=>t.user_id);
  const names = ids.length ? await read(supabase.from('profiles').select('id,display_name,username,avatar_path').in('id',ids)) : [];
  const byId = Object.fromEntries(names.map(n=>[n.id,{display_name:n.display_name,username:n.username,avatar_path:n.avatar_path}]));
  const term = filters.q.trim().toLowerCase();
  const people = data.filter(t=>(!filters.game || t.games.includes(filters.game))&&(!filters.role||t.role===filters.role)&&(!term||`${byId[t.user_id]?.display_name} ${byId[t.user_id]?.username} ${t.brief} ${t.bio} ${t.games.join(' ')}`.toLowerCase().includes(term)));
  const range=calendarRange(availabilityMonth);
  const availabilityRows=people.length?await read(supabase.from('talent_availability').select('user_id,available_on,is_available').in('user_id',people.map(t=>t.user_id)).gte('available_on',range.start).lte('available_on',range.end)):[];
  const availabilityByTalent=new Map();
  for(const row of availabilityRows){const rows=availabilityByTalent.get(row.user_id)||[];rows.push(row);availabilityByTalent.set(row.user_id,rows);}
  const cards=people.map(t=>{
    const availability=availabilitySummary(availabilityByTalent.get(t.user_id)||[],availabilityMonth);
    const indicatorTone=availability.tone==='g'?'is-available':'is-limited';
    const talentName=byId[t.user_id]?.display_name||'?';
    const initials=talentName.split(' ').map(x=>x[0]).join('').slice(0,2);
    const username=byId[t.user_id]?.username;
    const avatarPath=byId[t.user_id]?.avatar_path;
    const avatarUrl=avatarPath?supabase.storage.from('tourit-avatars').getPublicUrl(avatarPath).data.publicUrl:'';
    return `<article class="card tc"><span class="availability-indicator ${indicatorTone}" role="img" aria-label="Availability: ${availability.label}; ${availability.availableDays} of ${availability.daysInMonth} days marked this month"><span class="availability-orb" aria-hidden="true"></span><span class="availability-label">${availability.available?'Available':'Limited'}</span></span><div class="row talent-card-heading"><div class="av talent-card-avatar">${esc(initials)}${avatarUrl?`<img class="talent-card-avatar-image" src="${esc(avatarUrl)}" alt="" loading="lazy" decoding="async">`:''}</div><div><b>${esc(talentName)}</b><div class="mu">${username?`@${esc(username)} · `:''}${esc(t.role)} · ${esc(t.location)}</div></div></div><div class="row talent-card-tags">${t.games.map(g=>`<span class="tag y">${esc(g)}</span>`).join('')}</div><p class="pv">${esc(t.brief||t.bio)}</p><span class="mu">${t.experience_years} years · ${esc(t.work_mode)}</span><div class="row"><a class="btn s p" href="#/talent/${t.user_id}">View profile</a>${session&&profile?.account_type==='host'?`<button class="btn s" data-action="shortlist" data-id="${t.user_id}"><span class="ui-icon" aria-hidden="true">☆</span> Shortlist</button><button class="btn s" data-action="message" data-id="${t.user_id}">Message</button>`:''}</div></article>`;
  }).join('');
  shell(`<div class="talent-page"><h2>Find Talent</h2><div class="filters talent-filters"><label class="talent-filter talent-search-field"><span>SEARCH</span><input id="search" class="talent-search" placeholder="Search name, game, keyword" value="${esc(filters.q)}"></label>${talentFilterDropdown('filter-game','GAME',games,filters.game,'All games')}${talentFilterDropdown('filter-role','ROLE',roles,filters.role,'All roles')}</div><div class="grid">${cards||'<p class="mu">No published talent profiles match these filters.</p>'}</div></div>`);
}
async function jobPage(id) {
  const job = await read(supabase.from('jobs').select('*,organisations(name,description,website,past_productions)').eq('id',id).single());
  const open = job.status==='open' && job.application_deadline>=new Date().toISOString().slice(0,10);
  const form = open && profile?.account_type==='talent' ? `<form id="apply-form"><h3>Apply now</h3><label>Message</label><textarea name="message" required minlength="10" maxlength="5000"></textarea><label>Relevant experience</label><input name="experience" maxlength="3000"><label>Portfolio / demo reel link</label><input name="portfolio_url" type="url" placeholder="https://" required><label>Private attachments (PDF, JPEG, PNG or WebP; up to 3 files, 10 MB each)</label><input name="attachments" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple><button class="btn p">Apply Now</button></form>` : !session ? '<a class="btn p" href="#/login">Log in to apply</a>' : !open ? '<span class="tag r">Applications closed</span>' : profile?.account_type==='talent' ? '<p class="mu">Publish your talent profile from your Dashboard before applying.</p>' : '<p class="mu">Talent accounts can apply to this job.</p>';
  shell(`<div class="two"><div class="card"><h2>${esc(job.title)}</h2><div class="row"><span class="tag y">${esc(job.game)}</span><span class="tag">${esc(job.role)}</span><span class="tag">${esc(job.work_mode)}</span><span class="tag g">${esc(job.payment_type)}</span></div><p>${esc(job.description)}</p><div class="sx"><h3>Event</h3><div class="kv"><div><small>Date</small>${date(job.event_date)}</div><div><small>Location</small>${esc(job.location)}</div><div><small>Experience</small>${job.min_experience}+ years</div></div></div></div><div class="card"><b>${esc(job.organisations?.name)}</b><p class="mu">${esc(job.organisations?.description)}</p><p>${form}</p></div></div>`);
}
function calendarRange(month) {
  const first=new Date(month.getFullYear(),month.getMonth(),1);
  const offset=(first.getDay()+6)%7;
  const start=new Date(first);start.setDate(first.getDate()-offset);
  const end=new Date(start);end.setDate(start.getDate()+41);
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return {start:iso(start),end:iso(end)};
}
function availabilityCalendar(ownerId,rows,editable=false) {
  const first=new Date(availabilityMonth.getFullYear(),availabilityMonth.getMonth(),1), offset=(first.getDay()+6)%7;
  const now=new Date(),todayIso=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const cells=Array.from({length:42},(_,i)=>{const day=new Date(first);day.setDate(1-offset+i);const iso=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;const row=rows.find(item=>String(item.available_on).slice(0,10)===iso);const available=row?.is_available!==false;const current=day.getMonth()===first.getMonth();const isToday=iso===todayIso,isPast=iso<todayIso,canEdit=editable&&!isPast;return `<button type="button" class="availability-day${current?'':' outside'}${available?' available':' unavailable'}${isPast?' past':''}${isToday?' today':''}${availabilityChangedDate===iso?' just-changed':''}" ${canEdit?`data-action="availability-day" data-date="${iso}"`:'disabled'} ${isToday?'aria-current="date" title="Today"':''} aria-label="${day.toLocaleDateString('en-GB',{day:'numeric',month:'long'})}${available?', available':', unavailable'}${isToday?', today':''}${isPast?', in the past; locked':''}">${isToday?'<span class="availability-today-tooltip" aria-hidden="true">Today</span>':''}${day.getDate()}</button>`;}).join('');
  const monthAction=editable?'availability-month':'availability-view-month';
  const monthTransition=availabilityMonthChanging?' month-changing':'';
  return `<div class="availability-head"><button class="btn s" type="button" data-action="${monthAction}" data-offset="-1" aria-label="Previous month">‹</button><b>${first.toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</b><button class="btn s" type="button" data-action="${monthAction}" data-offset="1" aria-label="Next month">›</button></div><div class="availability-grid${monthTransition}" role="grid"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>${cells}</div>${editable?'<small class="mu">Past dates are locked. Tap today or a future date to set availability.</small>':''}`;
}
function availabilitySummary(rows,month) {
  const year=month.getFullYear(),monthIndex=month.getMonth(),daysInMonth=new Date(year,monthIndex+1,0).getDate();
  const monthPrefix=`${year}-${String(monthIndex+1).padStart(2,'0')}-`;
  const unavailableDays=new Set(rows.filter(row=>row.is_available===false&&String(row.available_on).slice(0,10).startsWith(monthPrefix)).map(row=>String(row.available_on).slice(0,10))).size;
  const availableDays=Math.max(0,daysInMonth-unavailableDays);
  const available=availableDays/daysInMonth>=0.7;
  return {available,label:available?'Available':'Limited availability',tone:available?'g':'y',availableDays,daysInMonth};
}
async function applicationAttachments(applicationId,displayOnly=false) {
  const {data,error}=await supabase.storage.from('tourit-private').list(applicationId,{limit:20});
  if(error)throw error;
  const items=(data||[]).filter(file=>file.name&&!file.name.startsWith('.'));
  const links=[];
  for(const file of items){const path=`${applicationId}/${file.name}`;const {data:signed,error:signedError}=await supabase.storage.from('tourit-private').createSignedUrl(path,300);if(signedError)throw signedError;links.push(`<a href="${esc(signed.signedUrl)}" target="_blank" rel="noopener noreferrer">${esc(file.name.split('_').slice(1).join('_')||file.name)} ↗</a>`);}
  return links.length?`<span class="private-attachments">${links.join(' ')}</span>`:(displayOnly?'<span class="mu">No attachments</span>':'');
}
async function dashboard() {
  if(!session) return go('login');
  if(profile?.account_type==='talent') {
    const t = await read(supabase.from('talent_profiles').select('*').eq('user_id',userId()).single());
    const apps = await read(supabase.from('applications').select('id,status,jobs(title)').eq('talent_id',userId()).order('submitted_at',{ascending:false}));
    const ownAppFiles=Object.fromEntries(await Promise.all(apps.map(async a=>[a.id,await applicationAttachments(a.id,true).catch(()=>'<span class="mu">Attachments unavailable</span>')])));
    const availabilityRows=await read(supabase.from('talent_availability').select('available_on,is_available').eq('user_id',userId()).gte('available_on',calendarRange(availabilityMonth).start).lte('available_on',calendarRange(availabilityMonth).end));
    shell(`<h2>Talent dashboard</h2><div class="two"><form class="card" id="talent-profile" enctype="multipart/form-data"><div class="talent-editor-head"><b>Edit profile</b><a class="btn s" href="#/talent/${userId()}">Preview profile ↗</a></div><p class="mu talent-preview-hint">Preview shows your latest saved profile details.</p><label>Role</label><select name="role">${roles.map(r=>`<option ${r===t.role?'selected':''}>${esc(r)}</option>`).join('')}</select><label>Games (comma separated)</label><input name="games" value="${esc(t.games.join(', '))}"><label>Languages</label><input name="languages" value="${esc(t.languages.join(', '))}"><label>Location</label><input name="location" value="${esc(t.location)}"><label>Region</label><input name="region" value="${esc(t.region)}"><label>Experience in years</label><input name="experience_years" type="number" min="0" value="${t.experience_years}"><label>Work mode</label><select name="work_mode"><option ${t.work_mode==='Both'?'selected':''}>Both</option><option ${t.work_mode==='Remote'?'selected':''}>Remote</option><option ${t.work_mode==='On-site'?'selected':''}>On-site</option></select><label>Brief listing description</label><input name="brief" maxlength="140" value="${esc(t.brief)}"><label>Bio</label><textarea name="bio">${esc(t.bio)}</textarea><label>Past events (comma separated)</label><input name="past_events" value="${esc((t.past_events||[]).join(', '))}" placeholder="Tournament or broadcast credits"><label>Demo reel / portfolio URL</label><input name="portfolio_url" type="url" value="${esc(t.portfolio_url)}"><label>Profile photo (JPEG, PNG or WebP, max 5 MB)</label><input name="avatar_file" type="file" accept="image/jpeg,image/png,image/webp"><label><input type="checkbox" name="published" ${t.published?'checked':''} style="width:auto"> Publish my profile to recruiters</label><button class="btn p">Save profile</button></form><div><section class="card"><b>My availability</b>${availabilityCalendar(userId(),availabilityRows,true)}</section><section class="card"><b>My applications</b>${apps.map(a=>`<div class="row application-row"><span>${esc(a.jobs?.title)}</span><span class="tag y">${esc(a.status)}</span>${ownAppFiles[a.id]}</div>`).join('')||'<span class="mu">None yet</span>'}</section></div></div>`);
  } else if(profile?.account_type==='host') {
    const member = await read(supabase.from('organisation_members').select('organisation_id').eq('user_id',userId()).single());
    const org = await read(supabase.from('organisations').select('*').eq('id',member.organisation_id).single());
    const jobs = await read(supabase.from('jobs').select('id,title,status,application_deadline,deleted_at,created_at').eq('organisation_id',org.id).order('deleted_at',{ascending:true,nullsFirst:true}).order('created_at',{ascending:false}));
    const apps = jobs.length ? await read(supabase.from('applications').select('id,job_id,talent_id,message,status,portfolio_url').in('job_id',jobs.map(j=>j.id))) : [];
    const appFiles=Object.fromEntries(await Promise.all(apps.map(async a=>[a.id,await applicationAttachments(a.id,true).catch(()=>'<span class="mu">Attachments unavailable</span>')])));
    const talentIds=[...new Set(apps.map(a=>a.talent_id))];
    const applicantProfiles=talentIds.length?await read(supabase.from('profiles').select('id,display_name').in('id',talentIds)):[];
    const applicantNames=Object.fromEntries(applicantProfiles.map(p=>[p.id,p.display_name]));
    const appsByJob=new Map();
    for(const application of apps){const list=appsByJob.get(application.job_id)||[];list.push(application);appsByJob.set(application.job_id,list);}
    const renderYourJob=j=>{const deleted=Boolean(j.deleted_at),jobApps=appsByJob.get(j.id)||[];return `<article class="sx recruiter-job${deleted?' recruiter-job-deleted':''}"><div class="recruiter-job-head"><div><b>${esc(j.title)}</b> <span class="tag ${deleted?'r':j.status==='open'?'g':'r'}">${deleted?'Deleted':esc(j.status)}</span></div><div class="row job-actions">${deleted?`<button class="btn s p" data-action="recover-job" data-id="${esc(j.id)}">Recover</button><span class="job-countdown mu" data-delete-expires="${esc(new Date(new Date(j.deleted_at).getTime()+24*60*60*1000).toISOString())}" aria-label="Time remaining before permanent deletion"></span><button class="btn s force-delete-button" data-action="force-delete-job" data-id="${esc(j.id)}" data-title="${esc(j.title)}">Force delete</button>`:`<a class="btn s" href="#/post?edit=${esc(j.id)}">Edit</a><button class="btn s" data-action="toggle-job" data-id="${esc(j.id)}" data-status="${esc(j.status)}">${j.status==='open'?'Close':'Open'}</button><button class="btn s danger-button" data-action="delete-job" data-id="${esc(j.id)}" data-title="${esc(j.title)}">Delete</button>`}</div></div>${deleted?'<p class="mu deleted-job-note">This job is hidden from Find Jobs. Recover it before the countdown ends.</p>':''}${jobApps.map(a=>{const reel=safeExternalUrl(a.portfolio_url);return `<div class="row application-row"><b>${esc(applicantNames[a.talent_id]||'Talent')}</b><span class="mu">${esc(a.message).slice(0,70)}</span>${reel?`<a href="${esc(reel)}" target="_blank" rel="noopener noreferrer">Reel ↗</a>`:''}${appFiles[a.id]}<select data-action="status" data-id="${esc(a.id)}">${['Submitted','Under Review','Shortlisted','Accepted','Rejected'].map(s=>`<option ${s===a.status?'selected':''}>${s}</option>`).join('')}</select><button class="btn s" data-action="message" data-id="${esc(a.talent_id)}">Message</button></div>`}).join('')}</article>`;};
    if(deletedJobCountdownTimer)clearInterval(deletedJobCountdownTimer);
    shell(`<h2>Recruiter dashboard</h2><div class="two"><form class="card" id="organisation-profile"><b>${esc(org.name)}</b><label>Description</label><textarea name="description">${esc(org.description)}</textarea><label>Website</label><input name="website" value="${esc(org.website)}"><label>Past productions</label><input name="past_productions" value="${esc(org.past_productions)}"><label><input type="checkbox" name="published" ${org.published?'checked':''} style="width:auto"> Publish organisation profile</label><button class="btn p">Save organisation</button></form><div class="card your-jobs"><h3>Your jobs</h3><a class="btn p" href="#/post">+ Post job</a>${jobs.map(renderYourJob).join('')||'<p class="mu">You haven’t posted any jobs yet.</p>'}</div></div>`);
    formatDeleteCountdown();if(jobs.some(j=>j.deleted_at))deletedJobCountdownTimer=setInterval(formatDeleteCountdown,1000);
  }
}
async function postPage(editId='') {
  if(!session || profile?.account_type!=='host') return go('login');
  if(pendingCoverCrop?.url)URL.revokeObjectURL(pendingCoverCrop.url);
  if(approvedCoverPreviewUrl)URL.revokeObjectURL(approvedCoverPreviewUrl);
  pendingCoverCrop=null;approvedCoverFile=null;approvedCoverOriginal=null;approvedCoverPreviewUrl=null;
  const job=editId?await read(supabase.from('jobs').select('*').eq('id',editId).single()):null;
  const selected=(name,value)=>`<option ${value===name?'selected':''}>${esc(value)}</option>`;
  const dateValue=value=>value?.slice(0,10)||'';
  const cover=job?.cover_path?supabase.storage.from('tourit-job-covers').getPublicUrl(job.cover_path).data.publicUrl:'';
  shell(`<form class="card" id="post-job" enctype="multipart/form-data" style="max-width:560px;margin:auto"><h2>${job?'Edit job':'Post a job'}</h2>${job?`<input type="hidden" name="job_id" value="${esc(job.id)}"><input type="hidden" name="existing_cover_path" value="${esc(job.cover_path||'')}"><input type="hidden" name="job_status" value="${esc(job.status)}">`:''}<label>Title</label><input name="title" required maxlength="160" value="${esc(job?.title||'')}"><label>Game</label><select name="game">${games.map(g=>selected(job?.game,g)).join('')}</select><label>Role</label><select name="role">${roles.map(g=>selected(job?.role,g)).join('')}</select><label>Payment</label><select name="payment_type">${['Paid','Unpaid','Volunteer','Negotiable'].map(g=>selected(job?.payment_type,g)).join('')}</select><label>Budget (£)</label><input name="budget" type="number" min="0" value="${job?Math.round(job.budget_minor/100):0}"><label>Location</label><input name="location" value="${esc(job?.location||'Remote')}" required><label>Remote / On-site</label><select name="work_mode">${['Remote','On-site'].map(g=>selected(job?.work_mode,g)).join('')}</select><label>Event date</label><input name="event_date" type="date" required value="${dateValue(job?.event_date)}"><label>Application deadline</label><input name="application_deadline" type="date" required value="${dateValue(job?.application_deadline)}"><label>Required experience</label><input name="min_experience" type="number" min="0" value="${job?.min_experience||0}"><label>Description</label><textarea name="description" required minlength="10">${esc(job?.description||'')}</textarea><label for="job-cover-file">Cover image (JPEG, PNG or WebP, max 8 MB)</label><input id="job-cover-file" name="cover_file" type="file" accept="image/jpeg,image/png,image/webp"><p id="cover-image-status" class="mu" aria-live="polite">${cover?'Current image retained unless you choose a replacement.':'Choose a cover image to adjust its crop before publishing.'}</p>${cover?`<img class="cv" alt="Current job cover" src="${esc(cover)}">`:''}<div id="cover-preview-wrap" class="cover-preview-wrap" hidden><img id="cover-preview" alt="Confirmed job cover crop preview"><div class="cover-preview-actions"><button class="btn s" type="button" data-action="adjust-cover">Adjust crop</button><button class="btn s" type="button" data-action="remove-cover">Remove image</button></div></div><button class="btn p">${job?'Save changes':'Publish job'}</button></form>`);
}
async function inboxPage() {
  if(!session) return go('login');
  const query=new URLSearchParams(location.hash.split('?')[1]||'');
  const target=query.get('to');
  const convRows=await read(supabase.from('conversation_members').select('conversation_id,conversations(id,participant_low,participant_high,related_job_id,updated_at)').eq('user_id',userId()));
  const conversations=convRows.map(x=>x.conversations).filter(Boolean).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
  let active=query.get('c')?conversations.find(c=>c.id===query.get('c')):conversations.find(c=>target && (c.participant_low===target||c.participant_high===target));
  if(!active && !target) active=conversations[0];
  const peerIds=[...new Set(conversations.map(c=>c.participant_low===userId()?c.participant_high:c.participant_low))];
  const names=peerIds.length?await read(supabase.from('profiles').select('id,display_name').in('id',peerIds)):[];
  const byId=Object.fromEntries(names.map(p=>[p.id,p.display_name]));
  const peer=active?(active.participant_low===userId()?active.participant_high:active.participant_low):target;
  let messages=[];
  if(active) {
    messages=await read(supabase.from('messages').select('id,sender_id,body,created_at').eq('conversation_id',active.id).order('created_at',{ascending:true}).limit(200));
    await supabase.from('conversation_members').update({last_read_at:new Date().toISOString()}).eq('conversation_id',active.id).eq('user_id',userId());
  }
  shell(`<h2>Inbox</h2><div class="two" style="grid-template-columns:minmax(190px,240px) 1fr"><div class="card">${conversations.map(c=>{const id=c.participant_low===userId()?c.participant_high:c.participant_low;return `<a class="btn s" style="display:block;margin:4px 0;${active?.id===c.id?'border-color:var(--y)':''}" href="#/inbox?c=${c.id}">${esc(byId[id]||'Tourit member')}</a>`}).join('')||'<span class="mu">No conversations yet.</span>'}</div><div class="card">${peer?`<b>${esc(byId[peer]||'Tourit member')}</b><div id="message-list" style="display:flex;flex-direction:column;gap:8px;margin:16px 0;max-height:55vh;overflow:auto">${messages.map(m=>`<div class="msg ${m.sender_id===userId()?'me':''}">${esc(m.body)}</div>`).join('')||'<span class="mu">Start the conversation.</span>'}</div><form id="message-form"><input type="hidden" name="to" value="${esc(peer)}"><input type="hidden" name="conversation_id" value="${esc(active?.id||'')}"><div class="row"><input name="body" maxlength="4000" required placeholder="Write a message" style="flex:1"><button class="btn p">Send</button></div></form>`:'<span class="mu">Select a conversation or contact talent from a profile.</span>'}</div></div>`);
  startInboxRefresh(active?.id||'');
}
function syncNotificationBadge(){document.querySelectorAll('.notification-count').forEach(badge=>{badge.textContent=unreadNotificationCount?`+${unreadNotificationCount}`:'';badge.hidden=unreadNotificationCount===0;badge.setAttribute('aria-label',`${unreadNotificationCount} unread notifications`);});}
async function refreshUnreadNotificationCount(){if(!session){unreadNotificationCount=0;syncNotificationBadge();return;}const owner=userId();const {count,error}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',owner).is('read_at',null);if(error){console.warn('Notification count refresh failed',error);return;}if(owner!==userId())return;unreadNotificationCount=count||0;syncNotificationBadge();}
function stopInboxRefresh(){if(inboxRefreshTimer)clearInterval(inboxRefreshTimer);inboxRefreshTimer=null;if(inboxChannel)supabase.removeChannel(inboxChannel);inboxChannel=null;}
function stopNotificationRefresh(){if(notificationChannel)supabase.removeChannel(notificationChannel);notificationChannel=null;notificationChannelUserId=null;unreadNotificationCount=0;syncNotificationBadge();}
function stopLiveChannels(){stopInboxRefresh();stopNotificationRefresh();}
function startNotificationRefresh(){const owner=userId();if(!owner){stopNotificationRefresh();return;}if(notificationChannelUserId&&notificationChannelUserId!==owner)stopInboxRefresh();void refreshUnreadNotificationCount();if(notificationChannel&&notificationChannelUserId===owner)return;if(notificationChannel)supabase.removeChannel(notificationChannel);notificationChannelUserId=owner;notificationChannel=supabase.channel(`notifications:${owner}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${owner}`},payload=>{void refreshUnreadNotificationCount();if(payload.eventType==='INSERT'&&location.hash.startsWith('#/notifications'))notificationsPage().catch(console.error);}).subscribe();}
function startInboxRefresh(conversationId){stopInboxRefresh();if(!session||!conversationId)return;const refresh=async()=>{if(!location.hash.startsWith('#/inbox'))return;try{const rows=await read(supabase.from('messages').select('id,sender_id,body,created_at').eq('conversation_id',conversationId).order('created_at',{ascending:true}).limit(200));const list=document.querySelector('#message-list');if(list){list.innerHTML=rows.map(m=>`<div class="msg ${m.sender_id===userId()?'me':''}">${esc(m.body)}</div>`).join('')||'<span class="mu">Start the conversation.</span>';list.scrollTop=list.scrollHeight;}}catch(error){console.warn('Inbox refresh failed',error);}};inboxChannel=supabase.channel(`inbox:${userId()}:${conversationId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${conversationId}`},refresh).subscribe();inboxRefreshTimer=setInterval(refresh,12000);}
async function notificationsPage(){if(!session)return go('login');const rows=await read(supabase.from('notifications').select('id,kind,message,related_id,created_at,read_at').eq('user_id',userId()).order('created_at',{ascending:false}).limit(50));const hasUnread=rows.some(n=>!n.read_at);shell(`<div class="notification-page-head"><h2>Notifications</h2><div class="notification-page-actions"><button type="button" class="btn s" data-action="read-all-notifications" ${hasUnread?'':'disabled'}>Mark all as read</button><button type="button" class="btn s notification-delete" data-action="delete-all-notifications" ${rows.length?'':'disabled'}>Delete all</button></div></div><div class="card notification-list">${rows.map(n=>`<article class="notification-item${n.read_at?'':' unread'}"><div class="notification-copy"><b>${esc(n.message)}</b><small class="mu">${date(n.created_at.slice(0,10))} · ${esc(n.kind.replace('_',' '))}</small></div><div class="notification-actions">${n.related_id&&n.kind==='message'?`<a class="btn s" href="#/inbox?c=${esc(n.related_id)}">Open inbox</a>`:''}${!n.read_at?`<button type="button" class="btn s" data-action="read-notification" data-id="${esc(n.id)}">Mark read</button>`:''}<button type="button" class="btn s notification-delete" data-action="delete-notification" data-id="${esc(n.id)}" aria-label="Delete notification: ${esc(n.message)}">Delete</button></div></article>`).join('')||'<p class="mu">You’re all caught up.</p>'}</div>`);}
async function render() {
  if(deletedJobCountdownTimer){clearInterval(deletedJobCountdownTimer);deletedJobCountdownTimer=null;}
  const [route,query=''] = location.hash.replace(/^#\/?/,'').split('?');
  const [path,id] = route.split('/');
  const params = new URLSearchParams(query);
  try {
    if(session && profile && !profile.account_type && path!=='oauth-onboarding') return shell(oauthOnboardingPage());
    if(session && profile?.account_type==='talent' && !profile.username && path!=='username-setup') return go('username-setup');
    if(path==='oauth-onboarding') return session ? shell(oauthOnboardingPage()) : shell(authPage(false));
    if(path==='username-setup') return session&&profile?.account_type==='talent'&&!profile.username ? shell(usernameSetupPage()) : session ? go('dash') : shell(authPage(false));
    if(path==='login') return shell(authPage(params.has('signup'),params.get('type')||''));
    if(path==='reset') return shell(`<form class="card" id="reset-form" style="max-width:420px;margin:auto"><h2>Reset password</h2><label>Email</label><input name="email" type="email" required><button class="btn p">Send reset link</button></form>`);
    if(path==='jobs') return await jobsPage();
    if(path==='promise') return shell(promisePage());
    if(path==='community') return shell(communityPage());
    if(path==='terms') return shell(termsPage());
    if(path==='contact') return shell(contactPage());
    if(path==='legal') return shell(legalPage());
    if(path==='talent' && id) {
      const t=await read(supabase.from('talent_profiles').select('*').eq('user_id',id).single());
      const p=await read(supabase.from('profiles').select('display_name,username,avatar_path').eq('id',id).single());
      const range=calendarRange(availabilityMonth);const avail=await read(supabase.from('talent_availability').select('available_on,is_available').eq('user_id',id).gte('available_on',range.start).lte('available_on',range.end));
      const availabilityStatus=availabilitySummary(avail,availabilityMonth);
      const avatar=p.avatar_path?supabase.storage.from('tourit-avatars').getPublicUrl(p.avatar_path).data.publicUrl:'';
      const ownPrivatePreview=session?.user?.id===id&&!t.published;
      const portfolioUrl=safeExternalUrl(t.portfolio_url);
      return shell(`${ownPrivatePreview?'<div class="profile-preview-notice"><span><b>Private profile preview</b><small>Only you can see this profile until you publish it.</small></span><a class="btn s" href="#/dash">Edit profile</a></div>':''}<div class="two"><div class="card"><div class="row">${avatar?`<img class="av" style="object-fit:cover" alt="" src="${esc(avatar)}">`:''}<div><h2>${esc(p.display_name)}</h2><div class="mu">${p.username?`@${esc(p.username)} · `:''}${esc(t.role)} · ${esc(t.location)}</div></div></div><p>${esc(t.brief)}</p><p>${esc(t.bio)}</p><div class="row">${t.games.map(g=>`<span class="tag y">${esc(g)}</span>`).join('')}</div><div class="bx"><small>Languages</small>${esc(t.languages.join(', '))}</div><div class="bx"><small>Experience</small>${t.experience_years} years · ${esc(t.work_mode)}</div>${t.past_events?.length?`<div class="bx"><small>Past events</small><div class="row">${t.past_events.map(event=>`<span class="tag">${esc(event)}</span>`).join('')}</div></div>`:''}${portfolioUrl?`<a class="btn s" target="_blank" rel="noopener noreferrer" href="${esc(portfolioUrl)}">Demo reel / portfolio ↗</a>`:''}${session&&profile?.account_type==='host'?`<button class="btn s" data-action="shortlist" data-id="${id}"><span class="ui-icon" aria-hidden="true">☆</span> Shortlist</button><button class="btn s p" data-action="message" data-id="${id}">Contact</button>`:''}</div><section class="card"><div class="availability-title"><b>Availability</b><span class="tag ${availabilityStatus.tone}">${availabilityStatus.label}</span></div>${availabilityCalendar(id,avail,false)}</section></div>`);
    }
    if(path==='talent') return await talentPage();
    if(path==='job' && id) return await jobPage(id);
    if(path==='dash') return await dashboard();
    if(path==='post') return await postPage(params.get('edit')||'');
    if(path==='inbox') return await inboxPage();
    if(path==='notifications') return await notificationsPage();
    if(path==='demo') return shell('<h2>Preview moved</h2><p class="mu">Fictional talent and tournament samples are shown on the home page while running the local development server.</p><a class="btn" href="#/">Return home</a>');
    if(!path || path==='home') return shell(homePage());
    return shell('<h2>Page not found</h2>');
  } catch(error) { console.error(error); shell(`<h2>Could not load this page</h2><p class="mu">${esc(error.message)}</p><a class="btn" href="#/">Home</a>`); }
}

document.addEventListener('submit', async event => {
  const form = event.target;
  if(!form.id) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const errorNode = document.querySelector('#form-error');
  try {
    if(form.id==='auth-form') {
      if(data.account_type) {
        const displayName=data.display_name.trim();
        const username=normalizedUsername(data.username);
        if(!usernameRegex.test(username)) throw new Error(usernameHelp);
        if(data.account_type==='talent'&&!onAirNameRegex.test(displayName)) throw new Error(onAirNameHelp);
        try { localStorage.setItem(signupIntentKey,String(Date.now())); } catch {}
        const callback=new URL(authRedirectUrl,location.origin);callback.searchParams.set('tourit_auth','signup');
        const {error} = await supabase.auth.signUp({email:data.email.trim().toLowerCase(),password:data.password,options:{data:{display_name:displayName,username,account_type:data.account_type},emailRedirectTo:callback.href}});
        if(error) throw new Error(authErrorMessage(error));
        toast('Check your email to confirm your account');
      } else {
        const {error} = await supabase.auth.signInWithPassword({email:data.email.trim().toLowerCase(),password:data.password});
        if(error) throw error;
        go('dash');
      }
    } else if(form.id==='oauth-onboarding-form') {
      const displayName=data.display_name.trim();
      const username=normalizedUsername(data.username);
      if(!usernameRegex.test(username)) throw new Error(usernameHelp);
      if(data.account_type==='talent'&&!onAirNameRegex.test(displayName)) throw new Error(onAirNameHelp);
      const {error}=await supabase.rpc('complete_oauth_onboarding',{p_account_type:data.account_type,p_display_name:displayName,p_username:username});
      if(error) throw new Error(authErrorMessage(error));
      sessionStorage.removeItem('tourit-oauth-account-type');
      toast('Tourit account ready');
      await refreshSession();
      go('dash');
    } else if(form.id==='username-setup-form') {
      const username=normalizedUsername(data.username);
      if(!usernameRegex.test(username)) throw new Error(usernameHelp);
      const {error}=await supabase.from('profiles').update({username}).eq('id',userId());
      if(error) throw new Error(authErrorMessage(error));
      await refreshSession();
      go('dash');
    } else if(form.id==='reset-form') {
      const {error} = await supabase.auth.resetPasswordForEmail(data.email,{redirectTo:location.origin}); if(error) throw error; toast('Password reset email sent');
    } else if(form.id==='talent-profile') {
      const games = data.games.split(',').map(x=>x.trim()).filter(Boolean);
      const languages = data.languages.split(',').map(x=>x.trim()).filter(Boolean);
      const past_events = data.past_events.split(',').map(x=>x.trim()).filter(Boolean);
      const avatarPath=await uploadPublicImage('tourit-avatars',form.elements.avatar_file.files[0],5*1024*1024);
      if(avatarPath){const {error}=await supabase.from('profiles').update({avatar_path:avatarPath}).eq('id',userId());if(error)throw error;}
      delete data.avatar_file;
      const {error} = await supabase.from('talent_profiles').update({...data,games,languages,past_events,experience_years:Number(data.experience_years),published:form.elements.published.checked}).eq('user_id',userId()); if(error) throw error; toast('Profile saved'); await refreshSession();
    } else if(form.id==='organisation-profile') {
      const member = await read(supabase.from('organisation_members').select('organisation_id').eq('user_id',userId()).single());
      const {error} = await supabase.from('organisations').update({...data,published:form.elements.published.checked}).eq('id',member.organisation_id); if(error) throw error; toast('Organisation saved'); await render();
    } else if(form.id==='post-job') {
      const member = await read(supabase.from('organisation_members').select('organisation_id').eq('user_id',userId()).single());
      const coverPath=await uploadPublicImage('tourit-job-covers',approvedCoverFile,8*1024*1024);
      const jobId=data.job_id,existingCover=data.existing_cover_path,status=data.job_status||'open';
      const row = { ...data, organisation_id:member.organisation_id, created_by:userId(), budget_minor:Math.round(Number(data.budget||0)*100), min_experience:Number(data.min_experience||0), status };
      delete row.budget; delete row.cover_file;delete row.job_id;delete row.existing_cover_path;delete row.job_status;row.cover_path=coverPath||existingCover||null;
      const result=jobId?await supabase.from('jobs').update(row).eq('id',jobId):await supabase.from('jobs').insert(row);if(result.error)throw result.error;toast(jobId?'Job updated':'Job published');go('dash');
    } else if(form.id==='apply-form') {
      const jobId=location.hash.replace(/^#\/?/,'').split('?')[0].split('/')[1];
      const files=[...(form.elements.attachments.files||[])];if(files.length>3)throw new Error('Attach up to 3 files.');const allowed=['application/pdf','image/jpeg','image/png','image/webp'];if(files.some(file=>!allowed.includes(file.type)||file.size>10*1024*1024))throw new Error('Each attachment must be a PDF, JPEG, PNG or WebP file under 10 MB.');
      const {data:application,error}=await supabase.from('applications').insert({job_id:jobId,talent_id:userId(),message:data.message,experience:data.experience,portfolio_url:data.portfolio_url,status:'Submitted'}).select('id').single();if(error)throw error;
      for(const file of files){const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'attachment';const path=`${application.id}/${crypto.randomUUID()}_${safeName}`;const {error:uploadError}=await supabase.storage.from('tourit-private').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw new Error(`Application submitted, but “${safeName}” did not upload: ${uploadError.message}`);}
      toast('Application submitted'); go('dash');
    } else if(form.id==='message-form') {
      let conversationId=data.conversation_id;
      if(!conversationId){
        const {data:started,error}=await supabase.rpc('start_conversation',{p_other_user_id:data.to,p_related_job_id:null});
        if(error) throw error;
        conversationId=started;
      }
      const {error}=await supabase.from('messages').insert({conversation_id:conversationId,sender_id:userId(),body:data.body.trim()});
      if(error) throw error;
      go(`inbox?c=${conversationId}`);
    }
  } catch(error) { const usernameFlow=['auth-form','oauth-onboarding-form','username-setup-form'].includes(form.id);const message=usernameFlow?authErrorMessage(error):error.message;if(errorNode) errorNode.innerHTML=errorBox(message);else toast(message); }
});

document.addEventListener('input',event=>{ if(event.target.id==='search'){filters.q=event.target.value; const wasFocused=document.activeElement===event.target; const cursor=event.target.selectionStart; clearTimeout(window._searchTimer); window._searchTimer=setTimeout(async()=>{await render();if(wasFocused){const input=document.querySelector('#search');input?.focus();input?.setSelectionRange(cursor,cursor);}},250);} });
document.addEventListener('change',event=>{ if(event.target.id==='filter-game'){filters.game=event.target.value;render();} if(event.target.id==='filter-role'){filters.role=event.target.value;render();} if(event.target.dataset.action==='status') updateStatus(event.target.dataset.id,event.target.value); if(event.target.matches('#oauth-onboarding-form select[name="account_type"]')){const talent=event.target.value==='talent';const nameField=event.target.form.elements.display_name;const label=event.target.form.querySelector('label[for="oauth-display-name"]');const help=event.target.form.querySelector('#on-air-name-help');nameField.maxLength=talent?16:100;label.textContent=talent?'On-air name':'Display name';if(talent){nameField.setAttribute('pattern',onAirNamePattern);nameField.setAttribute('aria-describedby','on-air-name-help');}else{nameField.removeAttribute('pattern');nameField.removeAttribute('aria-describedby');}help.hidden=!talent;} });
document.addEventListener('change',event=>{if(event.target.matches('#post-job input[name="cover_file"]')&&event.target.files?.[0])openCoverCropper(event.target.files[0]);});
document.addEventListener('keydown',event=>{
  const option=event.target.closest('.talent-dropdown-option');
  const trigger=event.target.closest('.talent-dropdown-trigger');
  const dropdown=(option||trigger)?.closest('.talent-dropdown');
  if(!dropdown)return;
  const options=[...dropdown.querySelectorAll('.talent-dropdown-option')];
  if(trigger&&(event.key==='ArrowDown'||event.key==='ArrowUp')){
    event.preventDefault();
    document.querySelectorAll('.talent-dropdown.open').forEach(item=>{item.classList.remove('open');item.querySelector('.talent-dropdown-trigger')?.setAttribute('aria-expanded','false');});
    dropdown.classList.add('open');trigger.setAttribute('aria-expanded','true');
    options[event.key==='ArrowDown'?0:options.length-1]?.focus();return;
  }
  if(event.key==='Escape'){
    event.preventDefault();dropdown.classList.remove('open');dropdown.querySelector('.talent-dropdown-trigger')?.setAttribute('aria-expanded','false');dropdown.querySelector('.talent-dropdown-trigger')?.focus();return;
  }
  if(option&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
    event.preventDefault();const current=options.indexOf(option);
    const next=event.key==='Home'?0:event.key==='End'?options.length-1:(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
    options[next]?.focus();
  }
});
document.addEventListener('error',event=>{if(event.target.matches?.('.talent-card-avatar-image'))event.target.hidden=true;},true);
document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');
  if(event.target.closest('nav a')||!event.target.closest('nav')) document.querySelectorAll('nav.menu-open').forEach(nav=>{nav.classList.remove('menu-open');const toggle=nav.querySelector('.mobile-nav-toggle');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation menu');});
  if(!button){document.querySelectorAll('.talent-dropdown.open').forEach(item=>{item.classList.remove('open');item.querySelector('.talent-dropdown-trigger')?.setAttribute('aria-expanded','false');});return;}
  const {action,id}=button.dataset;
  try {
    if(action==='toggle-mobile-menu'){const nav=button.closest('nav'),open=button.getAttribute('aria-expanded')!=='true';nav.classList.toggle('menu-open',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',open?'Close navigation menu':'Open navigation menu');return;}
    if(action==='toggle-talent-filter'){
      const dropdown=button.closest('.talent-dropdown');const willOpen=!dropdown.classList.contains('open');
      document.querySelectorAll('.talent-dropdown.open').forEach(item=>{item.classList.remove('open');item.querySelector('.talent-dropdown-trigger')?.setAttribute('aria-expanded','false');});
      if(willOpen){dropdown.classList.add('open');button.setAttribute('aria-expanded','true');}return;
    }
    if(action==='choose-talent-filter'){
      const dropdown=button.closest('.talent-dropdown');const select=dropdown?.querySelector('select');
      if(select){select.value=button.dataset.value;select.dispatchEvent(new Event('change',{bubbles:true}));}return;
    }
    if(action==='cookie-settings'){renderCookieConsent(true);return;}
    if(action==='cookie-allow'){saveCookieConsent(true);return;}
    if(action==='cookie-reject'){saveCookieConsent(false);return;}
    if(action==='cookie-details'){const details=cookieConsentEl.querySelector('.cookie-details-copy');const expanded=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!expanded));button.textContent=expanded?'What does this mean?':'Cookie details';if(details)details.hidden=expanded;return;}
    if(action==='close-confirmation'){if(button.classList.contains('confirmation-backdrop')&&event.target!==button)return;toastEl.replaceChildren();return;}
    if(action==='availability-month'||action==='availability-view-month'){availabilityMonth=new Date(availabilityMonth.getFullYear(),availabilityMonth.getMonth()+Number(button.dataset.offset),1);availabilityMonthChanging=true;availabilityChangedDate='';await render();setTimeout(()=>{availabilityMonthChanging=false;},500);return;}
    if(action==='availability-day'){const day=button.dataset.date;const {data:existing,error:readError}=await supabase.from('talent_availability').select('is_available').eq('user_id',userId()).eq('available_on',day).maybeSingle();if(readError)throw readError;const result=existing?.is_available===false?await supabase.from('talent_availability').delete().eq('user_id',userId()).eq('available_on',day):await supabase.from('talent_availability').upsert({user_id:userId(),available_on:day,is_available:false});if(result.error)throw result.error;availabilityChangedDate=day;await render();setTimeout(()=>{availabilityChangedDate='';},700);return;}
    if(action==='read-notification'){const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);if(error)throw error;await refreshUnreadNotificationCount();await notificationsPage();return;}
    if(action==='read-all-notifications'){const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',userId()).is('read_at',null);if(error)throw error;await refreshUnreadNotificationCount();await notificationsPage();return;}
    if(action==='delete-all-notifications'){showDeleteAllNotificationsConfirmation();return;}
    if(action==='cancel-delete-all-notifications'){if(button.classList.contains('confirmation-backdrop')&&event.target!==button)return;toastEl.replaceChildren();return;}
    if(action==='confirm-delete-all-notifications'){button.disabled=true;button.textContent='Deleting…';const {error}=await supabase.from('notifications').delete().eq('user_id',userId());if(error)throw error;toastEl.replaceChildren();await refreshUnreadNotificationCount();await notificationsPage();toast('All notifications deleted');return;}
    if(action==='delete-notification'){const {error}=await supabase.from('notifications').delete().eq('id',id).eq('user_id',userId());if(error)throw error;await refreshUnreadNotificationCount();await notificationsPage();return;}
    if(action==='confirmation-dashboard'){toastEl.replaceChildren();go('dash');return;}
    if(action==='cancel-delete-job'){if(button.classList.contains('confirmation-backdrop')&&event.target!==button)return;toastEl.replaceChildren();return;}
    if(action==='delete-job'){showDeleteJobConfirmation(id,button.dataset.title||'this job');return;}
    if(action==='confirm-delete-job'){const {error}=await supabase.from('jobs').update({deleted_at:new Date().toISOString()}).eq('id',id);if(error)throw error;toastEl.replaceChildren();toast('Job moved to deleted for 24 hours');await render();return;}
    if(action==='cancel-force-delete-job'){if(button.classList.contains('confirmation-backdrop')&&event.target!==button)return;toastEl.replaceChildren();return;}
    if(action==='force-delete-job'){showForceDeleteJobConfirmation(id,button.dataset.title||'this job');return;}
    if(action==='confirm-force-delete-job'){
      button.disabled=true;
      button.textContent='Deleting…';
      const {data,error}=await supabase.functions.invoke('purge-expired-jobs',{body:{action:'force-delete-job',job_id:id}});
      if(error){
        let message=error.message;
        try{const response=error.context;if(response instanceof Response){const detail=await response.clone().json();if(detail?.error)message=detail.error;}}catch{}
        button.disabled=false;
        button.textContent='Delete permanently';
        throw new Error(message);
      }
      if(!data?.deleted){button.disabled=false;button.textContent='Delete permanently';throw new Error('The server did not confirm that the job was deleted. Refresh Your Jobs and check its status.');}
      toastEl.replaceChildren();toast('Job and its data permanently deleted');await render();return;
    }
    if(action==='recover-job'){const {error}=await supabase.from('jobs').update({deleted_at:null}).eq('id',id);if(error)throw error;toast('Job recovered');await render();return;}
    if(action==='cancel-cover-crop'){if(button.classList.contains('cover-crop-backdrop')&&event.target!==button)return;closeCoverCropper();return;}
    if(action==='confirm-cover-crop'){await confirmCoverCrop();return;}
    if(action==='adjust-cover'){if(approvedCoverOriginal)await openCoverCropper(approvedCoverOriginal);return;}
    if(action==='remove-cover'){approvedCoverFile=null;approvedCoverOriginal=null;if(approvedCoverPreviewUrl)URL.revokeObjectURL(approvedCoverPreviewUrl);approvedCoverPreviewUrl=null;const previewWrap=document.querySelector('#cover-preview-wrap');if(previewWrap)previewWrap.hidden=true;const existing=document.querySelector('#post-job [name="existing_cover_path"]');if(existing)existing.value='';const current=document.querySelector('#post-job img.cv');if(current)current.remove();const status=document.querySelector('#cover-image-status');if(status)status.textContent='Choose a cover image to adjust its crop before publishing.';return;}
    if(action==='oauth'){
      if(!socialSignInEnabled) throw new Error('Social sign-in is temporarily unavailable. Use your email and password for now.');
      const [currentRoute,currentQuery='']=location.hash.replace(/^#\/?/,'').split('?');
      const params=new URLSearchParams(currentQuery); const isSignup=currentRoute==='login'&&params.has('signup');
      const selectedType=params.get('type');
      if(isSignup&&(!selectedType||!['talent','host'].includes(selectedType))) throw new Error('Choose talent or host before continuing with social sign-up.');
      if(isSignup) sessionStorage.setItem('tourit-oauth-account-type',selectedType); else sessionStorage.removeItem('tourit-oauth-account-type');
      const provider=button.dataset.provider; const options={redirectTo:`${location.origin}/`};
      if(provider==='azure') options.scopes='email';
      const {error}=await supabase.auth.signInWithOAuth({provider,options}); if(error) throw error;
    }
    if(action==='logout'){await supabase.auth.signOut();go('');}
    if(action==='toggle-job'){const {error}=await supabase.from('jobs').update({status:button.dataset.status==='open'?'closed':'open'}).eq('id',id);if(error)throw error;await render();}
    if(action==='save-job'){const {error}=await supabase.from('saved_jobs').upsert({user_id:userId(),job_id:id});if(error)throw error;toast('Job saved');}
    if(action==='shortlist'){const {error}=await supabase.from('shortlisted_talent').upsert({recruiter_id:userId(),talent_id:id});if(error)throw error;toast('Talent shortlisted');}
    if(action==='message'){go(`inbox?to=${encodeURIComponent(id)}`);}
  } catch(error){toast(error.message);}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toastEl.querySelector('.confirmation-popup'))toastEl.replaceChildren();if(event.key==='Escape'&&pendingCoverCrop)closeCoverCropper();if(event.key==='Escape'){document.querySelectorAll('nav.menu-open').forEach(nav=>{nav.classList.remove('menu-open');const toggle=nav.querySelector('.mobile-nav-toggle');toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Open navigation menu');toggle?.focus();});}});
async function updateStatus(id,status){try{const {error}=await supabase.from('applications').update({status}).eq('id',id);if(error)throw error;toast('Application status updated');}catch(error){toast(error.message);await render();}}
async function refreshSession() {
  const {data:{session:current}} = await supabase.auth.getSession();
  session=current;
  profile=null;
  if(session) {
    const {data,error}=await supabase.from('profiles').select('id,display_name,account_type,username').eq('id',session.user.id).maybeSingle();
    if(error) console.error(error); else profile=data;
    startNotificationRefresh();
  } else stopLiveChannels();
  if(profile?.account_type) sessionStorage.removeItem('tourit-oauth-account-type');
  if(session && profile && !profile.account_type && !location.hash.includes('/oauth-onboarding')) { go('oauth-onboarding'); return; }
  await render();
}
let confirmationPopupShown=false;
supabase.auth.onAuthStateChange((event,next)=>{
  session=next;
  if(['SIGNED_IN','INITIAL_SESSION'].includes(event)&&next?.user?.email_confirmed_at&&emailConfirmationReturn&&!confirmationPopupShown){
    confirmationPopupShown=true;
    try { localStorage.removeItem(signupIntentKey); } catch {}
    setTimeout(async()=>{history.replaceState({},document.title,`${location.pathname}${location.hash}`);await refreshSession();if(session)showEmailConfirmedPopup();},0);
  } else setTimeout(refreshSession,0);
});
window.addEventListener('hashchange',()=>{render();analyticsPageView();});
if(!url || !key) shell('<h2>Supabase is not configured</h2><p class="mu">Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the dev server.</p>');
else refreshSession();
