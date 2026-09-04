// @ts-nocheck
// ── useTour ──
// Thin wrapper around driver.js for Woven's contextual micro-tours.
//
// Persistence: app.profile.seenTours (array of tour id strings), saved via
// app.setProfile — which already round-trips through Supabase
// (App.jsx: setProfile -> saveDB('woven:profile', p)). No new table or
// column needed: it's just another field on the existing woven:profile
// blob, so legacy profiles read fine with seenTours defaulting to [].
//
// Usage:
//   var driverRef = useRef(null);
//   useTour(app, 'draft-basics', [
//     { element: '[data-tour="props-btn"]', popover: { title: 'Properties', description: '...',
//         onNextClick: function(el, step, opts){
//           setShowProperties(true);
//           advanceWhenReady(driverRef.current, '[data-tour="tag-spool-chip"]');
//         }
//     }},
//     { element: '[data-tour="tag-spool-chip"]', popover: { title: 'Tag a Spool', description: '...' } }
//   ], { ready: !!draft.id, onCreated: function(d){ driverRef.current = d; } });

import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

var injectedCss = false;
function injectTourCss() {
  if (injectedCss) return;
  injectedCss = true;
  var style = document.createElement('style');
  style.textContent =
    '.driver-popover{background:var(--bg1,#FDF8F0);color:var(--text,#2a1f10);border-radius:var(--rl,14px);font-family:"DM Sans",sans-serif;box-shadow:0 8px 30px rgba(42,31,16,.18);max-width:320px;}' +
    '.driver-popover-title{font-family:var(--serif,"Crimson Text",serif);color:#6B4A26;font-size:18px;}' +
    '.driver-popover-description{color:var(--text,#2a1f10);font-size:14px;line-height:1.5;}' +
    '.driver-popover-progress-text{color:var(--mid,#a88060);font-size:12px;}' +
    '.driver-popover-footer button{border-radius:8px !important;font-family:"DM Sans",sans-serif !important;padding:6px 12px !important;}' +
    '.driver-popover-next-btn,.driver-popover-next-btn:hover{background:#C45E28 !important;color:#fff !important;text-shadow:none !important;border:none !important;}' +
    '.driver-popover-prev-btn,.driver-popover-prev-btn:hover{background:transparent !important;color:#6B4A26 !important;border:1px solid var(--border,#e6dcc8) !important;text-shadow:none !important;}' +
    '.driver-popover-close-btn{color:var(--mid,#a88060) !important;}' +
    '.driver-popover-arrow-side-left.driver-popover-arrow{border-left-color:var(--bg1,#FDF8F0) !important;}' +
    '.driver-active-element{border-radius:8px;}';
  document.head.appendChild(style);
}

export function hasTourBeenSeen(app, tourId) {
  var seen = (app.profile && app.profile.seenTours) || [];
  return seen.indexOf(tourId) !== -1;
}

export function markTourSeen(app, tourId) {
  if (hasTourBeenSeen(app, tourId)) return;
  var seen = (app.profile && app.profile.seenTours) || [];
  app.setProfile(Object.assign({}, app.profile, { seenTours: seen.concat([tourId]) }));
}

// Call from a step's onNextClick when the next step's target won't exist
// until a state change (opening a drawer, etc.) finishes rendering.
export function advanceWhenReady(driverObj, selector, maxTries) {
  if (!driverObj) return;
  maxTries = maxTries || 20;
  var tries = 0;
  var poll = setInterval(function () {
    tries++;
    if (document.querySelector(selector) || tries > maxTries) {
      clearInterval(poll);
      driverObj.moveNext();
    }
  }, 100);
}

// steps: driver.js step array (see driver.js docs for the popover shape).
// opts.ready: gate — don't even poll for the first element until true.
// opts.onCreated(driverObj): grab a handle to the live instance so step
//   callbacks (onNextClick etc.) can call advanceWhenReady/moveNext.
// opts.startDelay: ms to wait before first measuring the DOM (default 350).
export function useTour(app, tourId, steps, opts) {
  opts = opts || {};
  var startedRef = useRef(false);

  useEffect(function () {
    if (startedRef.current) return;
    if (!app || !app.profile) return;
    if (opts.ready === false) return;
    if (hasTourBeenSeen(app, tourId)) return;
    if (!steps || !steps.length) return;

    injectTourCss();

    var cancelled = false;
    var startTimer = setTimeout(function () {
      var tries = 0;
      var poll = setInterval(function () {
        if (cancelled) { clearInterval(poll); return; }
        tries++;
        var firstEl = document.querySelector(steps[0].element);
        if (firstEl) {
          clearInterval(poll);
          startedRef.current = true;
          var driverObj = driver({
            showProgress: true,
            allowClose: true,
            overlayOpacity: 0.5,
            stagePadding: 6,
            steps: steps,
            onDestroyed: function () { markTourSeen(app, tourId); }
          });
          if (opts.onCreated) opts.onCreated(driverObj);
          driverObj.drive();
        } else if (tries > 25) {
          clearInterval(poll);
        }
      }, 200);
    }, opts.startDelay || 350);

    return function () { cancelled = true; clearTimeout(startTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.ready, app.profile && app.profile.seenTours && app.profile.seenTours.length]);
}
