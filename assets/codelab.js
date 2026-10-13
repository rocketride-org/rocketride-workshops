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

  ph.forEach(function(sec,i){
    var c = sec.querySelector('.cp input');
    if (c) {
      c.checked = !!st.done[i];
      c.addEventListener('change', function(){
        if (c.checked) st.done[i] = 1; else delete st.done[i];
        save(); paint();
      });
    }
    var nav = document.createElement('div');
    nav.className = 'pg';
    var back = document.createElement('button');
    back.type = 'button';
    back.disabled = (i === 0);
    back.innerHTML = '<small>Previous</small>' + (i>0 ? ph[i-1].dataset.title : 'Start');
    back.addEventListener('click', function(){ go(i-1); });
    var sp = document.createElement('div'); sp.className = 'sp';
    nav.appendChild(back); nav.appendChild(sp);
    if (i < ph.length-1) {
      var nx = document.createElement('button');
      nx.type = 'button'; nx.className = 'nx';
      nx.innerHTML = '<small>Next</small>' + ph[i+1].dataset.title;
      nx.addEventListener('click', function(){ go(i+1); });
      nav.appendChild(nx);
    }
    sec.appendChild(nav);
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

  function go(i, quiet){
    if (i<0 || i>=ph.length) return;
    st.at = i; save();
    ph.forEach(function(s,j){ s.hidden = (j!==i); });
    paint();
    window.scrollTo(0,0);
    if (!quiet && history.replaceState) history.replaceState(null,'','#p'+(i+1));
  }

  menub.addEventListener('click', function(){
    var o = rail.classList.toggle('open');
    menub.setAttribute('aria-expanded', o?'true':'false');
  });

  document.addEventListener('keydown', function(e){
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') go(st.at+1);
    if (e.key === 'ArrowLeft') go(st.at-1);
  });

  var m = (location.hash||'').match(/^#p(\d+)$/);
  var start = m ? parseInt(m[1],10)-1 : st.at;
  if (isNaN(start)||start<0||start>=ph.length) start = 0;
  go(start, true);
  window.scrollTo(0,0);
})();
