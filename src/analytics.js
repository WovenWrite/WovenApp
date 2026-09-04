// @ts-nocheck
// ── analytics.js ──
// PostHog initialization. Import `posthog` from here anywhere you need to
// fire a custom event — it's initialized once, at module load, the first
// time this file is imported anywhere in the app.
//
// Identity (posthog.identify / posthog.reset) is wired into App.jsx's
// existing supabase.auth.onAuthStateChange listener — SIGNED_IN calls
// identify with the Supabase user id, SIGNED_OUT calls reset. No
// duplicate auth listener needed.
//
// Pageviews: autocapture is on (captures clicks automatically regardless
// of routing), but its *automatic* $pageview firing is tied to browser
// History API changes — Woven navigates via React state (the `view`
// value in App.jsx), not real URL changes, so autocapture alone won't
// produce pageview data. A manual $pageview capture is wired into
// App.jsx's view-state instead (see the useEffect watching `view`).
//
// ── Setup ──
// Project API key is already set below (from PostHog → Project settings
// → Project token). This key is meant to be public/client-side (unlike a
// Supabase service-role key) — PostHog's own docs show it hardcoded the
// same way, so this is standard practice, not a shortcut. If you ever
// rotate it, just swap the value below.

import posthog from 'posthog-js';

var POSTHOG_KEY = 'phc_mpKVyWR6EFXkZutzW9x3krK8FyPex9oJDPUZNAfUhKEc';

if (typeof window !== 'undefined' && POSTHOG_KEY && POSTHOG_KEY.indexOf('YOUR_POSTHOG') !== 0) {
  posthog.init(POSTHOG_KEY, {
    api_host: 'https://us.i.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'identified_only', // don't create profiles for anonymous (pre-login) visitors
    autocapture: true,
    capture_pageview: false, // handled manually — see App.jsx's view-state effect
  });
} else if (typeof window !== 'undefined') {
  console.warn('[analytics] PostHog key not set — analytics disabled. Add your project API key in analytics.js.');
}

export default posthog;
