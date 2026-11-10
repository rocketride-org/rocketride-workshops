/* Sign-up modal, shared by the hub and every project guide.
   Any element with data-signup opens it. A page whose <body> has data-signup-auto
   also opens it the first time a browser loads that page.
   It closes only on its × or a click outside the box. Styles live in codelab.css. */
(function(){
  var SIGNUP = 'https://auth.rocketride.ai/ui/v2/login/register';
  var CLOUD = 'https://cloud.rocketride.ai';
  var SETUP = 'https://github.com/rocketride-org/rocketride-workshops/blob/main/SETUP.md';

  var html =
    '<dialog class="signup" id="signup" aria-labelledby="signup-title" tabindex="-1" autofocus>' +
      '<button type="button" class="signup-x" data-close aria-label="Close">×</button>' +
      '<div class="note fac">' +
        '<b class="k">Before the event</b>' +
        '<p>Set up once, at home, in about 15 minutes: <a href="' + SETUP + '">SETUP.md</a>. ' +
        'Every project guide repeats the steps it needs in <strong>Set up at home</strong>.</p>' +
      '</div>' +
      '<p class="kicker">Before you start</p>' +
      '<h2 id="signup-title">Sign up for RocketRide Cloud</h2>' +
      '<p>Every project deploys to RocketRide Cloud, so do this first, before the event.</p>' +
      '<ol class="run">' +
        '<li><b>Open the <a href="' + SIGNUP + '" target="_blank" rel="noopener">RocketRide sign-up page</a></b> and create your account.</li>' +
        '<li><b>Confirm your email.</b> Open the email RocketRide sends you and click its link.' +
          '<p class="see">You\'re signed in to RocketRide Cloud.</p>' +
        '</li>' +
        '<li><b>Redeem the promo code.</b> Click <strong>Copy</strong>, then redeem it at ' +
          '<a href="' + CLOUD + '" target="_blank" rel="noopener">cloud.rocketride.ai</a>.' +
          '<div class="promo">' +
            '<div class="pt">' +
              '<span class="pk">Promo code: Excalidraw demo</span>' +
              '<p>For the Excalidraw diagram agent.</p>' +
            '</div>' +
            '<div class="pc">' +
              '<span class="code">EXCALIDRAW_WALKTHROUGH</span>' +
              '<button type="button" class="promo-cp">Copy</button>' +
            '</div>' +
          '</div>' +
        '</li>' +
      '</ol>' +
      '<div class="btns">' +
        '<a class="btn" href="' + SIGNUP + '" target="_blank" rel="noopener">Sign up for RocketRide Cloud →</a>' +
      '</div>' +
    '</dialog>';

  document.body.insertAdjacentHTML('beforeend', html);
  var dialog = document.getElementById('signup');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  // Focus the box itself, not the ×, so no focus ring shows when it opens.
  function open(){ if (!dialog.open) { dialog.showModal(); dialog.focus(); } }
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
  // Esc doesn't close it.
  dialog.addEventListener('cancel', function(e){ e.preventDefault(); });

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

  if (document.body.hasAttribute('data-signup-auto')) {
    var SEEN = 'rr.hub.signup-seen.v1', seen = false;
    try { seen = localStorage.getItem(SEEN) === '1'; localStorage.setItem(SEEN, '1'); } catch (e) {}
    if (!seen) open();
  }
})();
