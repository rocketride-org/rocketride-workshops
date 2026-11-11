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
    /* the number circle ticks the step off (or back on) without leaving the current step */
    if (!isRef) {
      var num = b.querySelector('.num');
      num.title = 'Mark this step done';
      num.addEventListener('click', function(e){ e.stopPropagation(); toggleDone(i); });
    }
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
      /* party-popper icon (Lucide, ISC) */
      fin.innerHTML = '<small>All done</small>Finish ' +
        '<svg class="ico-pop" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/></svg>';
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

  /* syntax highlighting: the language comes from <div class="src" data-lang="...">,
     else from the box's label (terminal, a file name), else from the text itself.
     Prompts and plain names stay unhighlighted. Copy reads innerText, so spans don't leak. */
  var STR1 = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/;
  var LANGS = {
    sh: [
      ['c', /(?<=^|\s)#.*/],
      ['s', STR1],
      ['v', /\$\{?\w+\}?/],
      ['f', /(?<=^[ \t]*|(?:&&|\|\||[|;])[ \t]*)(?:sudo[ \t]+)?[A-Za-z_][\w.-]*/],
      ['a', /(?<=\s)--?[A-Za-z][\w-]*/],
      ['k', /&&|\|\||[|>;]/]
    ],
    env: [
      ['c', /^[ \t]*#.*/],
      ['p', /^[ \t]*[A-Za-z_]\w*(?==)/],
      ['v', /\$\{?\w+\}?/],
      ['s', /(?<==)[^$\n]+/]
    ],
    json: [
      ['p', /"(?:[^"\\\n]|\\.)*"(?=\s*:)/],
      ['s', /"(?:[^"\\\n]|\\.)*"/],
      ['k', /\b(?:true|false|null)\b/],
      ['n', /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/]
    ],
    js: [
      ['c', /\/\/.*|\/\*[\s\S]*?\*\//],
      ['s', /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/],
      ['k', /\b(?:import|export|from|default|as|const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|implements|interface|type|enum|async|await|try|catch|finally|throw|typeof|instanceof|in|of|void|delete|this|super|true|false|null|undefined|readonly|public|private|protected|static|keyof)\b/],
      ['t', /(?<=<\/?)[A-Za-z][\w.]*|\b[A-Z][A-Za-z0-9_]*\b/],
      ['f', /\b[A-Za-z_$][\w$]*(?=\s*(?:<[^<>()\n]*>)?\()/],
      ['n', /\b\d+(?:\.\d+)?\b/]
    ],
    css: [
      ['c', /\/\*[\s\S]*?\*\/|(?<![:\w])\/\/.*/],
      ['s', STR1],
      ['k', /@[\w-]+|!important/],
      ['v', /\$[\w-]+|--[\w-]+/],
      ['t', /(?<=^[ \t]*)[^\s{};\/@$][^{};\n]*?(?=\s*\{)/],
      ['p', /(?<=^[ \t]*|[{;][ \t]*)-?[A-Za-z][\w-]*(?=\s*:(?![^;{}\n]*\{))/],
      ['f', /[A-Za-z-][\w-]*(?=\()/],
      ['n', /#[0-9A-Fa-f]{3,8}\b|(?<![\w-])-?\d*\.?\d+(?:px|r?em|%|vh|vw|vmin|vmax|s|ms|deg|fr|ch)?\b/]
    ]
  };
  function langOf(box, pre){
    if (box.dataset.lang) return box.dataset.lang;
    var lab = box.querySelector('.bar2 span');
    var l = lab ? lab.textContent.toLowerCase() : '';
    if (l === 'terminal') return 'sh';
    if (/(^|[\s\/])\.env\b/.test(l)) return 'env';
    if (/\.(?:[cm]?[jt]sx?)\b/.test(l)) return 'js';
    if (/\.s?css\b/.test(l)) return 'css';
    if (/\.(?:json|pipe)\b/.test(l)) return 'json';
    if (/^\s*"[^"\n]+"\s*:/.test(pre.textContent)) return 'json';
    return null;
  }
  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function highlight(text, rules){
    var re = new RegExp(rules.map(function(r){ return '(' + r[1].source + ')'; }).join('|'), 'gm');
    var out = '', last = 0, m;
    while ((m = re.exec(text))){
      if (!m[0]) { re.lastIndex++; continue; }
      var g = 1; while (m[g] === undefined) g++;
      out += esc(text.slice(last, m.index)) + '<span class="' + rules[g-1][0] + '">' + esc(m[0]) + '</span>';
      last = re.lastIndex;
    }
    return out + esc(text.slice(last));
  }
  Array.prototype.forEach.call(document.querySelectorAll('.src'), function(box){
    var pre = box.querySelector('pre');
    if (!pre || pre.children.length) return;
    var lang = langOf(box, pre);
    if (!LANGS[lang]) return;
    box.classList.add('lang-' + lang);
    try { pre.innerHTML = highlight(pre.textContent, LANGS[lang]); } catch(e){}
  });

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

  /* The rail's number circle: flip the step's done state, keeping its checkpoint box in step */
  function toggleDone(i){
    var on = !st.done[i];
    if (on) st.done[i] = 1; else delete st.done[i];
    var c = ph[i].querySelector('.cp input');
    if (c) c.checked = on;
    save(); paint();
    if (on) stepDone(i, 'rail');
    if (on && i === lastStep && !NEXT_HREF) finished();
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
