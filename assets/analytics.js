/* PostHog analytics, shared by the hub and every project guide. The one place the project token lives.
   Load it in <head> so the first pageview is captured early.
   - Pageviews, autocapture, heatmaps and session replay (inputs masked) come from posthog-js itself.
     Replay and heatmaps record only on the live site (the project's recording_domains).
   - Each visitor is an anonymous PostHog id kept in their browser; PostHog groups their activity into
     sessions on its own (a new one after 30 minutes idle). workshop_session groups visitors by day.
   - Workshop events come from the DOM events the other scripts already dispatch, so they never call PostHog:
       rr:step-done  (assets/codelab.js)  -> "workshop step completed"
       rr:finished   (assets/codelab.js)  -> "workshop finished"
       rr:signup-open (assets/signup.js)  -> "signup modal opened"
     plus delegated clicks on the feedback links, the Sign up button and the promo code's Copy.
   Off on localhost and file:// so local testing doesn't pollute the project; add ?posthog=1 to turn it on. */
(function(){
  var TOKEN = 'phc_Couv2YeLdmGYTsqgdJmvjxAyGygEJHewyXwD7kSPeUBQ';
  var HOST = 'https://us.i.posthog.com';

  var local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local && !/[?&]posthog=1\b/.test(location.search)) return;

  /* PostHog's HTML snippet, unmodified (https://posthog.com/docs/web-analytics/installation/html-snippet) */
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog && window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}p||((p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",p.onerror=function(){p=null},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r));var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  posthog.init(TOKEN, {
    api_host: HOST,
    defaults: '2026-08-30',
    person_profiles: 'identified_only'   /* nobody signs in here: keep everyone anonymous */
  });

  /* Every event says which day's workshop it belongs to, from the visitor's own clock: nov_10_26_workshop.
     Set on every page load, so a visitor who comes back another day is tagged with that day. */
  var MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  var now = new Date();
  var pad = function(n){ return (n < 10 ? '0' : '') + n; };
  posthog.register({
    workshop_session: MONTHS[now.getMonth()] + '_' + pad(now.getDate()) + '_' + pad(now.getFullYear() % 100) + '_workshop'
  });

  /* Every event says which page it came from. Guides carry <body data-key="<workshop>.<module>">.
     <head> scripts run before <body> exists, so read it once the DOM is ready. */
  function tagPage(){
    var key = (document.body && document.body.dataset.key) || '';
    var dot = key.indexOf('.');
    posthog.register(dot > 0
      ? { page_kind: 'guide', workshop: key.slice(0, dot), module: key.slice(dot + 1) }
      : { page_kind: 'hub' });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tagPage);
  else tagPage();

  /* ============ workshop progress ============ */
  document.addEventListener('rr:step-done', function(e){
    var d = e.detail || {};
    posthog.capture('workshop step completed', { step: d.step, step_title: d.title, steps_total: d.steps, via: d.via });
  });

  var finished = false;   /* Finish and the last checkpoint can both fire it: count it once per page load */
  document.addEventListener('rr:finished', function(){
    if (finished) return;
    finished = true;
    posthog.capture('workshop finished');
  });

  document.addEventListener('rr:signup-open', function(e){
    posthog.capture('signup modal opened', { trigger: (e.detail && e.detail.auto) ? 'auto' : 'click' });
  });

  /* ============ clicks on the asks ============ */
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('a, button');
    if (!t) return;
    if (t.matches('.fb-pill')) posthog.capture('feedback opened', { placement: 'pill' });
    else if (t.matches('.fb-go')) posthog.capture('feedback opened', { placement: 'finish dialog' });
    else if (t.matches('.fb-hub a')) posthog.capture('feedback opened', { placement: 'hub banner' });
    else if (t.matches('#signup a[href*="/register"]')) posthog.capture('signup link clicked');
    else if (t.matches('.promo-cp')) posthog.capture('promo code copied');
  }, true);
})();
