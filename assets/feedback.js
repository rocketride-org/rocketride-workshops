/* Feedback, shared by the hub and every project guide. The one place the form's link lives.
   - A small "Feedback" pill in the top bar of every page.
   - A one-time "You did it" dialog (confetti, button, QR code) when the last project fires
     rr:finished (assets/codelab.js) on a page whose <body> has data-feedback-finale.
   - window.rrFeedback.hasProgress(): has this browser started any project? The hub uses it to
     lead with feedback instead of sign-up, and signup.js to skip its first-visit pop-up.
   On the hub, load it after the workshop cards are built and before signup.js. Styles live in codelab.css. */
(function(){
  var URL_FORM = 'https://bit.ly/4zwo6GB';
  var PROMPTED = 'rr.feedback.prompted.v1';
  var here = document.currentScript && document.currentScript.src;
  var QR = here ? new URL('../images/feedback-qr.svg', here).href : 'images/feedback-qr.svg';

  function get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function set(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  function link(cls, html){
    var a = document.createElement('a');
    a.className = cls; a.href = URL_FORM; a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = html;
    return a;
  }

  /* Progress is what assets/codelab.js saves: rr.<workshop>.<module>.v1 = {done:{...}} */
  function hasProgress(){
    return (window.WORKSHOPS || [{ id: 'zero-to-agent', modules: ['kanban', 'excalidraw-integration', 'specter-mutual'] }])
      .some(function(w){
        return (w.modules || []).some(function(m){
          try { var p = JSON.parse(get('rr.' + w.id + '.' + m + '.v1') || 'null'); return !!(p && p.done && Object.keys(p.done).length); }
          catch(e){ return false; }
        });
      });
  }

  /* ============ top-bar pill ============ */
  var bar = document.querySelector('.bar-in');
  if (bar) {
    var pill = link('fb-pill', '🎁 <span class="fb-long">500 free tokens · </span>Feedback');
    pill.setAttribute('aria-label', 'Give feedback and get 500 free tokens (opens in a new tab)');
    bar.insertBefore(pill, bar.querySelector('.home, nav, .meta') || null);
  }

  /* ============ hub: lead with feedback once someone has started ============ */
  var hub = document.getElementById('workshops');
  if (hub && hasProgress()) {
    var banner = document.createElement('div');
    banner.className = 'feedback fb-hub';
    banner.innerHTML =
      '<div class="ft"><span class="fk">Done with the workshop?</span>' +
      '<p><strong>Claim 500 free tokens:</strong> tell us how RocketRide worked for you. It takes 2 minutes.</p></div>' +
      '<img class="fb-qr-sm" src="' + QR + '" alt="" width="72" height="72">';
    banner.appendChild(link('btn', 'Give feedback →'));
    banner.querySelector('img').addEventListener('error', function(){ this.remove(); });
    hub.parentNode.insertBefore(banner, hub);
    Array.prototype.forEach.call(document.querySelectorAll('.ws-head .signup-open'), function(b){ b.classList.add('ghosted'); });
  }

  /* ============ the "you did it" dialog ============ */
  var dialog = null;
  function build(){
    document.body.insertAdjacentHTML('beforeend',
      '<dialog class="signup fb-done" id="fb-done" aria-labelledby="fb-done-title" tabindex="-1">' +
        '<button type="button" class="signup-x" data-close aria-label="Close">×</button>' +
        '<p class="kicker">Zero to Agent <i>/ done</i></p>' +
        '<h2 id="fb-done-title">You built 3 apps in an hour 🎉</h2>' +
        '<p>Claim your <strong>500 free tokens</strong>: tell us how RocketRide worked for you, what was fast and what got in the way. It takes 2 minutes.</p>' +
        '<div class="fb-row">' +
          '<figure class="fb-qr"><img src="' + QR + '" alt="QR code for the feedback form" width="148" height="148">' +
            '<figcaption>On your phone? Scan this.</figcaption></figure>' +
          '<div class="fb-act"><button type="button" class="fb-later" data-close>Not now</button></div>' +
        '</div>' +
      '</dialog>');
    dialog = document.getElementById('fb-done');
    var go = link('btn fb-go', 'Give feedback →');
    var act = dialog.querySelector('.fb-act');
    act.insertBefore(go, act.firstChild);
    go.addEventListener('click', function(){ dialog.close(); });
    dialog.querySelector('.fb-qr img').addEventListener('error', function(){ this.closest('.fb-qr').remove(); });
    dialog.addEventListener('click', function(e){
      if (e.target.closest && e.target.closest('[data-close]')) { dialog.close(); return; }
      if (e.target !== dialog) return;
      var r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
  }

  function celebrate(opts){
    if (!(opts && opts.force) && get(PROMPTED) === '1') return false;
    if (!dialog) build();
    if (typeof dialog.showModal !== 'function' || dialog.open) return false;
    set(PROMPTED, '1');
    dialog.showModal(); dialog.focus();
    confetti(dialog);
    return true;
  }

  if (document.body.hasAttribute('data-feedback-finale'))
    document.addEventListener('rr:finished', function(){ celebrate(); });

  /* ============ confetti: one burst, ~2.5s, skipped for reduced motion ============ */
  function confetti(host){
    try { if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch(e){}
    var cv = document.createElement('canvas');
    cv.className = 'fb-confetti';
    cv.setAttribute('aria-hidden', 'true');
    /* inside the dialog so it draws above the backdrop; position:fixed makes it cover the viewport */
    host.appendChild(cv);
    var ctx = cv.getContext('2d');
    if (!ctx) { cv.remove(); return; }
    var dpr = window.devicePixelRatio || 1, W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
    var css = getComputedStyle(document.documentElement);
    var colors = ['--accent', '--ok', '--info', '--warn'].map(function(v){ return css.getPropertyValue(v).trim(); }).filter(Boolean);
    if (!colors.length) colors = ['#F93822', '#1E8A5F', '#3340A8', '#C98A12'];
    var parts = [];
    for (var n = 0; n < 140; n++) {
      var a = -Math.PI / 2 + (Math.random() - .5) * 1.6, s = 7 + Math.random() * 9, fromLeft = n % 2 === 0;
      parts.push({
        x: fromLeft ? W * .2 : W * .8, y: H * .55,
        vx: Math.cos(a) * s + (fromLeft ? 2.5 : -2.5), vy: Math.sin(a) * s,
        w: 6 + Math.random() * 6, h: 3 + Math.random() * 4,
        r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
        c: colors[n % colors.length]
      });
    }
    var start = performance.now(), LIFE = 2600;
    (function frame(t){
      var k = (t - start) / LIFE;
      if (k >= 1 || !cv.isConnected) { cv.remove(); return; }
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = k < .7 ? 1 : 1 - (k - .7) / .3;
      parts.forEach(function(p){
        p.vy += .25; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
        ctx.restore();
      });
      requestAnimationFrame(frame);
    })(start);
  }

  window.rrFeedback = { url: URL_FORM, qr: QR, hasProgress: hasProgress, celebrate: celebrate };
})();
