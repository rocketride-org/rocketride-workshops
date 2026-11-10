/* Codelab behaviour for project guides: rail, pager, checkpoints, copy buttons, tabs.
   Progress is kept per page in localStorage under <body data-key="...">. */
(function(){
  var ph = Array.prototype.slice.call(document.querySelectorAll('.phase'));
  var list = document.getElementById('raillist');
  var rail = document.getElementById('rail');
  var menub = document.getElementById('menub');
  var meta = document.getElementById('meta');
  var prog = document.getElementById('prog');
  if (!ph.length || !list) return;
  var KEY = 'rr.' + (document.body.dataset.key || 'guide') + '.v1';
  var st = {done:{}, at:0};

  try { var raw = localStorage.getItem(KEY); if (raw) { var p = JSON.parse(raw); if (p && typeof p === 'object') { st.done = p.done||{}; st.at = p.at||0; } } } catch(e){}
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch(e){} }

  var n = 1, refStarted = false;
  ph.forEach(function(sec,i){
    sec.id = 'p' + (i+1);
    var isRef = !!sec.dataset.ref;
    if (isRef && !refStarted) { refStarted = true; var hr=document.createElement('hr'); hr.className='sep'; list.appendChild(hr);
      var h=document.createElement('h6'); h.textContent='Reference'; h.style.marginTop='0'; list.appendChild(h); }
    var li = document.createElement('li');
    if (isRef) li.className = 'ref';
    var b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<span class="num">' + (isRef ? '' : (n++)) + '</span><span class="nm">' + sec.dataset.title + '</span>';
    b.addEventListener('click', function(){ go(i); rail.classList.remove('open'); menub.setAttribute('aria-expanded','false'); });
    li.appendChild(b); list.appendChild(li);
  });
  var lis = Array.prototype.slice.call(list.querySelectorAll('li'));
  var steps = ph.filter(function(s){ return !s.dataset.ref; }).length;
  var NEXT_HREF = document.body.dataset.next || '';
  var NEXT_TITLE = document.body.dataset.nextTitle || 'Next project';
  function stepBefore(i){ for (var j=i-1; j>=0; j--) if (!ph[j].dataset.ref) return j; return -1; }
  function stepAfter(i){ for (var j=i+1; j<ph.length; j++) if (!ph[j].dataset.ref) return j; return -1; }
  var lastStep = stepBefore(ph.length);

  ph.forEach(function(sec,i){
    var c = sec.querySelector('.cp input');
    if (c) {
      c.checked = !!st.done[i];
      c.addEventListener('change', function(){
        if (c.checked) st.done[i] = 1; else delete st.done[i];
        save(); paint();
        if (c.checked) stepDone(i, 'checkpoint');
        if (c.checked && i === lastStep && !NEXT_HREF) finished();
      });
    }
    /* The pager walks the build steps only; reference steps (the glossary) are reached from the rail.
       On the last build step, Next leaves the page for <body data-next> (the next project, or feedback). */
    var isRef = !!sec.dataset.ref;
    var prev = isRef ? lastStep : stepBefore(i);
    var next = isRef ? -1 : stepAfter(i);
    var nav = document.createElement('div');
    nav.className = 'pg';
    var back = document.createElement('button');
    back.type = 'button';
    back.disabled = (prev < 0);
    back.innerHTML = '<small>Previous</small>' + (prev >= 0 ? ph[prev].dataset.title : 'Start');
    back.addEventListener('click', function(){ go(prev); });
    var sp = document.createElement('div'); sp.className = 'sp';
    nav.appendChild(back); nav.appendChild(sp);
    if (next >= 0) {
      var nx = document.createElement('button');
      nx.type = 'button'; nx.className = 'nx';
      nx.innerHTML = '<small>Next</small>' + ph[next].dataset.title;
      nx.addEventListener('click', function(){ complete(i); go(next); });
      nav.appendChild(nx);
    } else if (!isRef && NEXT_HREF) {
      var out = document.createElement('a');
      out.className = 'nx';
      out.href = NEXT_HREF;
      if (/^https?:/.test(NEXT_HREF)) { out.target = '_blank'; out.rel = 'noopener'; }
      out.innerHTML = '<small>Next</small>';
      out.appendChild(document.createTextNode(NEXT_TITLE));
      out.addEventListener('click', function(){ complete(i); paint(); });
      nav.appendChild(out);
    } else if (!isRef) {
      /* the last project of the workshop: Finish wraps up the hour (assets/feedback.js listens for rr:finished) */
      var fin = document.createElement('button');
      fin.type = 'button'; fin.className = 'nx fin';
      fin.innerHTML = '<small>All done</small>Finish 🎉';
      fin.addEventListener('click', function(){ complete(i); paint(); finished(); });
      nav.appendChild(fin);
    }
    /* step ends: checkpoint, then the pager, then the troubleshooting dropdowns under an FAQ heading */
    var faq = faqOf(sec);
    if (c) sec.appendChild(c.closest('.cp'));
    sec.appendChild(nav);
    if (faq) sec.appendChild(faq);
  });

  /* The FAQ is the step's last run of troubleshooting dropdowns; wrap it so it can sit below the pager.
     A dropdown marked .info explains rather than troubleshoots, so it stays where it is. */
  function faqOf(sec){
    var run = [], el = sec.lastElementChild, FAQ = 'details.fold:not(.info)';
    while (el && !el.matches('details.fold')) el = el.previousElementSibling;
    while (el && el.matches(FAQ)) { run.unshift(el); el = el.previousElementSibling; }
    if (!run.length) return null;
    var box = document.createElement('div');
    box.className = 'faq';
    var h = document.createElement('h2');
    h.className = 'faq-h';
    h.textContent = 'FAQ';
    box.appendChild(h);
    run.forEach(function(d){ box.appendChild(d); });
    return box;
  }

  /* copy buttons */
  Array.prototype.forEach.call(document.querySelectorAll('.cp-btn'), function(btn){
    btn.addEventListener('click', function(){
      var pre = btn.closest('.src').querySelector('pre');
      var ok = function(){ btn.textContent='Copied'; btn.classList.add('ok'); setTimeout(function(){btn.textContent='Copy'; btn.classList.remove('ok');},1500); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pre.innerText).then(ok, function(){ sel(pre); });
        else sel(pre);
      } catch(e){ sel(pre); }
    });
  });
  function sel(pre){ try { var r=document.createRange(); r.selectNodeContents(pre); var s=window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch(e){} }

  /* tabs */
  Array.prototype.forEach.call(document.querySelectorAll('.tabs'), function(box){
    var btns = box.querySelectorAll('.tl button');
    var panes = box.querySelectorAll('.tp');
    Array.prototype.forEach.call(btns, function(b,k){
      b.addEventListener('click', function(){
        Array.prototype.forEach.call(btns, function(x){ x.classList.remove('on'); });
        Array.prototype.forEach.call(panes, function(x){ x.classList.remove('on'); });
        b.classList.add('on'); if (panes[k]) panes[k].classList.add('on');
      });
    });
  });

  function paint(){
    lis.forEach(function(li,i){
      li.classList.toggle('on', i===st.at);
      li.classList.toggle('done', !!st.done[i]);
    });
    var sec = ph[st.at];
    var idx = ph.slice(0,st.at+1).filter(function(s){ return !s.dataset.ref; }).length;
    if (sec.dataset.ref) meta.innerHTML = 'reference';
    else meta.innerHTML = 'Step <b>' + idx + '</b> of ' + steps + (sec.dataset.dur && sec.dataset.dur !== '0' ? ' &nbsp;·&nbsp; ' + sec.dataset.dur + ' min' : '');
    var d = Object.keys(st.done).length;
    prog.style.width = Math.round((d/ph.length)*100) + '%';
  }

  /* The whole workshop is done: other scripts (assets/feedback.js) react to this. */
  function finished(){
    try { document.dispatchEvent(new CustomEvent('rr:finished')); } catch(e){}
  }

  /* A step was newly marked done: other scripts (assets/analytics.js) react to this. */
  function stepDone(i, via){
    var detail = { step: ph.slice(0, i+1).filter(function(s){ return !s.dataset.ref; }).length,
                   title: ph[i].dataset.title, steps: steps, via: via };
    try { document.dispatchEvent(new CustomEvent('rr:step-done', { detail: detail })); } catch(e){}
  }

  /* "Next" counts as finishing the step: tick it in the rail and its checkpoint box */
  function complete(i){
    var was = !!st.done[i];
    st.done[i] = 1;
    var c = ph[i].querySelector('.cp input');
    if (c) c.checked = true;
    save();
    if (!was) stepDone(i, 'next');
  }

  /* ============ scroll spy: tasks in the current step, the one being read highlighted ============ */
  var deck = document.querySelector('.deck');
  var toc = document.createElement('nav');
  toc.className = 'toc';
  toc.setAttribute('aria-label', 'Tasks in this step');
  toc.innerHTML = '<h6>In this step</h6><ol></ol>';
  var tocList = toc.querySelector('ol');
  if (deck) { deck.appendChild(toc); deck.classList.add('has-toc'); }
  var tasks = [];   /* [{head, li}] for the visible step */

  /* A step's tasks are its h2 sections; steps without them fall back to file headings, then numbered actions. */
  function taskHeads(sec){
    var pick = function(q){ return Array.prototype.slice.call(sec.querySelectorAll(q)); };
    var h = pick(':scope > h2');
    if (!h.length) h = pick(':scope > h3.fileh');
    if (!h.length) h = pick(':scope > ol.run > li');
    return h;
  }

  function buildToc(i){
    tocList.innerHTML = '';
    tasks = [];
    var sec = ph[i];
    var heads = taskHeads(sec);
    toc.hidden = heads.length < 2;
    if (toc.hidden) return;
    heads.forEach(function(h, k){
      if (!h.id) h.id = sec.id + '-t' + (k+1);
      var lbl = h.tagName === 'LI' ? (h.querySelector('b') || h) : h;
      var txt = lbl.cloneNode(true);
      Array.prototype.forEach.call(txt.querySelectorAll('.mins, small'), function(x){ x.remove(); });
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = '<span class="nm"></span>';
      b.querySelector('.nm').textContent = txt.textContent.replace(/^\s*\d+\.\s*/, '').replace(/[.,:]\s*$/, '').trim();
      b.addEventListener('click', function(){ h.scrollIntoView({behavior:'smooth', block:'start'}); });
      li.appendChild(b); tocList.appendChild(li);
      tasks.push({head:h, li:li});
    });
    spy();
  }

  function spy(){
    if (toc.hidden || !tasks.length) return;
    var line = window.innerHeight * 0.3;   /* the task whose heading is above this line is the one being read */
    var cur = 0;
    tasks.forEach(function(t, k){ if (t.head.getBoundingClientRect().top < line) cur = k; });
    tasks.forEach(function(t, k){ t.li.classList.toggle('on', k === cur); });
  }

  var ticking = false;
  function onScroll(){ if (ticking) return; ticking = true; requestAnimationFrame(function(){ ticking = false; spy(); }); }
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll);

  function go(i, quiet){
    if (i<0 || i>=ph.length) return;
    st.at = i; save();
    ph.forEach(function(s,j){ s.hidden = (j!==i); });
    paint();
    window.scrollTo(0,0);
    buildToc(i);
    if (!quiet && history.replaceState) history.replaceState(null,'','#p'+(i+1));
  }

  menub.addEventListener('click', function(){
    var o = rail.classList.toggle('open');
    menub.setAttribute('aria-expanded', o?'true':'false');
  });

  document.addEventListener('keydown', function(e){
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') go(stepAfter(st.at));
    if (e.key === 'ArrowLeft') go(stepBefore(st.at));
  });

  var m = (location.hash||'').match(/^#p(\d+)$/);
  var start = m ? parseInt(m[1],10)-1 : st.at;
  if (isNaN(start)||start<0||start>=ph.length) start = 0;
  go(start, true);
  window.scrollTo(0,0);
})();
