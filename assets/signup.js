/* Sign-up modal, shared by the hub and every project guide.
   Any element with data-signup opens it. A page whose <body> has data-signup-auto
   also opens it the first time a browser loads that page.
   It closes on its ×, Esc, or a click outside the box. Styles live in codelab.css. */
(function(){
  var SIGNUP = 'https://auth.rocketride.ai/ui/v2/login/register';
  var CLOUD = 'https://cloud.rocketride.ai';
  var SETUP = 'https://github.com/rocketride-org/rocketride-workshops/blob/main/SETUP.md';

  var html =
    '<dialog class="signup" id="signup" aria-labelledby="signup-title" tabindex="-1" autofocus>' +
      '<button type="button" class="signup-x" data-close aria-label="Close">×</button>' +
      '<p class="kicker">Before the event <i>/ 2 minutes</i></p>' +
      '<h2 id="signup-title">Sign up for RocketRide Cloud</h2>' +
      '<p>Every project deploys to your RocketRide Cloud account.</p>' +
      '<ol class="run">' +
        '<li><b>Create your account.</b>' +
          '<div class="btns"><a class="btn" href="' + SIGNUP + '" target="_blank" rel="noopener">Sign up →</a></div>' +
          '<p class="see">You land on your desktop at cloud.rocketride.ai.</p>' +
        '</li>' +
        '<li><b>Redeem the workshop code.</b> In the <strong>Have a promo code?</strong> bar at the bottom of your ' +
          '<a href="' + CLOUD + '" target="_blank" rel="noopener">desktop</a>, paste it and click <strong>Redeem</strong>.' +
          '<div class="promo">' +
            '<div class="pc">' +
              '<span class="code">EXCALIDRAW_WALKTHROUGH</span>' +
              '<button type="button" class="promo-cp">Copy</button>' +
            '</div>' +
          '</div>' +
          '<p class="see">Your plan is active. There\'s no subscription to buy.</p>' +
        '</li>' +
      '</ol>' +
      '<div class="note">' +
        '<b class="k">Next, at home</b>' +
        '<p>Install the tools, add your Anthropic key and download Excalidraw: about 20 minutes, ' +
        'and much longer on venue wifi. <a href="' + SETUP + '" target="_blank" rel="noopener">Open the setup checklist →</a></p>' +
      '</div>' +
    '</dialog>';

  document.body.insertAdjacentHTML('beforeend', html);
  var dialog = document.getElementById('signup');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  // Focus the box itself, not the ×, so no focus ring shows when it opens.
  // Other scripts (assets/analytics.js) hear rr:signup-open; detail.auto is the first-visit pop-up.
  function open(auto){
    if (dialog.open) return;
    dialog.showModal(); dialog.focus();
    try { document.dispatchEvent(new CustomEvent('rr:signup-open', { detail: { auto: auto === true } })); } catch (e) {}
  }
  window.openSignup = open;

  document.addEventListener('click', function(e){
    var trigger = e.target.closest && e.target.closest('[data-signup]');
    if (trigger) { e.preventDefault(); open(); }
  });

  // Close on the × or a click outside the box. A click on the box's own padding
  // also targets the dialog, so check where it landed.
  dialog.addEventListener('click', function(e){
    if (e.target.closest && e.target.closest('[data-close]')) { dialog.close(); return; }
    if (e.target !== dialog) return;
    var r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  });

  // The promo code's Copy button.
  var copy = dialog.querySelector('.promo-cp');
  var code = dialog.querySelector('.promo .code');
  if (copy && code) {
    copy.addEventListener('click', function(){
      var select = function(){ try { var r = document.createRange(); r.selectNodeContents(code); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {} };
      var ok = function(){ copy.textContent = 'Copied'; copy.classList.add('ok'); setTimeout(function(){ copy.textContent = 'Copy'; copy.classList.remove('ok'); }, 1500); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code.textContent).then(ok, select);
        else select();
      } catch (e) { select(); }
    });
  }

  // Someone who has already started a project is past sign-up: let the feedback ask lead instead.
  var started = window.rrFeedback && window.rrFeedback.hasProgress && window.rrFeedback.hasProgress();
  if (document.body.hasAttribute('data-signup-auto') && !started) {
    var SEEN = 'rr.hub.signup-seen.v1', seen = false;
    try { seen = localStorage.getItem(SEEN) === '1'; localStorage.setItem(SEEN, '1'); } catch (e) {}
    if (!seen) open(true);
  }
})();
