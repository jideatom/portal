
(function(){
  const THUMB_KEY = 'resource_thumbnail_map_v2';
  const FOCUS_KEY = 'resource_focus_map_v2';
  let activeThumb = null;
  let filePicker = null;

  function getJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e){ return fallback; }
  }
  function setJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  function slugify(text){
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'')
      .slice(0,80);
  }

  function trackDisplay(track){
    return ({python:'Python', linux:'Linux', cloud:'Cloud', claude:'Claude', ai:'AI'})[track] || track;
  }

  function pageForTrack(track){
    return ({python:'python.html', linux:'linux.html', cloud:'cloud.html', claude:'claude.html', ai:'ai.html'})[track] || 'index.html';
  }

  function getThumbMap(){ return getJSON(THUMB_KEY, {}); }
  function setThumbMap(v){ setJSON(THUMB_KEY, v); }
  function getFocus(){ 
    const raw = getJSON(FOCUS_KEY, {});
    // migrate older v1 shape if present
    const old = getJSON('resource_focus_map_v1', {});
    Object.keys(old).forEach(function(track){
      if(raw[track]) return;
      raw[track] = raw[track] || {};
      const p = old[track];
      if(p){
        if(p.kind === 'book') raw[track].book = p;
        else raw[track].primary = p;
        raw[track].active = p;
      }
    });
    return raw;
  }
  function setFocus(v){ setJSON(FOCUS_KEY, v); }

  function ensureFilePicker(){
    if(filePicker) return filePicker;
    filePicker = document.createElement('input');
    filePicker.type = 'file';
    filePicker.accept = 'image/*';
    filePicker.style.display = 'none';
    document.body.appendChild(filePicker);
    filePicker.addEventListener('change', function(){
      const file = filePicker.files && filePicker.files[0];
      if(file && activeThumb){
        saveFileToThumb(activeThumb, file);
      }
      filePicker.value = '';
    });
    return filePicker;
  }

  function setActiveThumb(thumb){
    document.querySelectorAll('.resource-thumb.awaiting-paste').forEach(el => el.classList.remove('awaiting-paste'));
    activeThumb = thumb;
    if(thumb) thumb.classList.add('awaiting-paste');
  }

  function saveFileToThumb(thumb, file){
    const reader = new FileReader();
    reader.onload = function(ev){
      const map = getThumbMap();
      map[thumb.dataset.resourceKey] = ev.target.result;
      setThumbMap(map);
      renderThumb(thumb);
      syncPanels();
    };
    reader.readAsDataURL(file);
  }

  function renderThumb(thumb){
    const key = thumb.dataset.resourceKey;
    const src = getThumbMap()[key];
    thumb.classList.toggle('has-image', !!src);
    thumb.style.backgroundImage = src ? 'url("'+src+'")' : '';
    const label = thumb.querySelector('.resource-thumb-label');
    if(label){
      if(src) label.textContent = 'Cover added';
      else if(thumb.classList.contains('awaiting-paste')) label.textContent = 'Double-click to upload cover';
      else label.textContent = 'Double-click to upload cover';
    }
  }

  function ensureThumb(card){
    let thumb = card.querySelector('.resource-thumb');
    if(!thumb){
      thumb = document.createElement('div');
      thumb.className = 'resource-thumb';
      thumb.tabIndex = 0;
      thumb.innerHTML = '<span class="resource-thumb-label">Double-click to upload cover</span><button type="button" class="thumb-clear" title="Clear image">×</button>';
      card.insertBefore(thumb, card.firstChild);
    }
    thumb.dataset.resourceKey = card.dataset.resourceKey;
    renderThumb(thumb);

    thumb.addEventListener('click', function(e){
      if(e.target && e.target.classList.contains('thumb-clear')){
        e.stopPropagation();
        const map = getThumbMap();
        delete map[thumb.dataset.resourceKey];
        setThumbMap(map);
        renderThumb(thumb);
        syncPanels();
        return;
      }
      setActiveThumb(thumb);
      renderThumb(thumb);
    });

    thumb.addEventListener('dblclick', function(e){
      e.preventDefault();
      setActiveThumb(thumb);
      ensureFilePicker().click();
    });

    thumb.addEventListener('dragover', function(e){ e.preventDefault(); thumb.classList.add('dragging'); });
    thumb.addEventListener('dragleave', function(){ thumb.classList.remove('dragging'); });
    thumb.addEventListener('drop', function(e){
      e.preventDefault();
      thumb.classList.remove('dragging');
      const file = Array.from(e.dataTransfer.files || []).find(f => f.type && f.type.indexOf('image/') === 0);
      if(file){
        setActiveThumb(thumb);
        saveFileToThumb(thumb, file);
      }
    });

    return thumb;
  }

  function payloadFromCard(card){
    const titleEl = card.querySelector('strong') || card.querySelector('h4') || card.firstElementChild;
    const title = titleEl ? titleEl.textContent.trim() : 'resource';
    return {
      title: title,
      key: card.dataset.resourceKey,
      kind: card.dataset.kind,
      track: card.dataset.track,
      page: location.pathname.split('/').pop()
    };
  }

  function setRole(track, role, payload){
    const focus = getFocus();
    focus[track] = focus[track] || {};
    if(payload) focus[track][role] = payload;
    else delete focus[track][role];
    if(payload) focus[track].active = payload;
    setFocus(focus);
    syncCardStates();
    syncPanels();
    enhanceHome();
  }

  function wireControls(card){
    let toolbar = card.querySelector('.resource-toolbar');
    if(!toolbar){
      toolbar = document.createElement('div');
      toolbar.className = 'resource-toolbar';
      const track = card.dataset.track;
      const kind = card.dataset.kind;
      if(kind === 'course'){
        toolbar.innerHTML = '<button type="button" class="rt-btn primary">Set Primary</button><button type="button" class="rt-btn companion">Set Companion</button>';
      }else{
        toolbar.innerHTML = '<button type="button" class="rt-btn book">Use Book</button>';
      }
      card.appendChild(toolbar);

      toolbar.addEventListener('click', function(e){
        const btn = e.target.closest('.rt-btn');
        if(!btn) return;
        e.stopPropagation();
        const payload = payloadFromCard(card);
        if(btn.classList.contains('primary')) setRole(track, 'primary', payload);
        if(btn.classList.contains('companion')) setRole(track, 'companion', payload);
        if(btn.classList.contains('book')) setRole(track, 'book', payload);
      });
    }
  }

  function wireResourceCard(card, track, kind){
    if(card.dataset.resourceReady === '1') return;
    card.dataset.resourceReady = '1';
    card.classList.add('resource-card');
    card.dataset.track = track;
    card.dataset.kind = kind;
    const titleEl = card.querySelector('strong') || card.querySelector('h4') || card.firstElementChild;
    const title = titleEl ? titleEl.textContent.trim() : 'resource';
    card.dataset.resourceKey = track + '::' + kind + '::' + slugify(title);
    ensureThumb(card);
    wireControls(card);

    card.addEventListener('click', function(e){
      if(e.target.closest('.resource-thumb') || e.target.closest('.resource-toolbar')) return;
      const payload = payloadFromCard(card);
      const focus = getFocus();
      const trackData = focus[track] || {};
      if(kind === 'book'){
        if(!trackData.book) setRole(track, 'book', payload);
        else setRole(track, 'active', payload);
      }else{
        if(!trackData.primary) setRole(track, 'primary', payload);
        else if(!trackData.companion) setRole(track, 'companion', payload);
        else setRole(track, 'active', payload);
      }
    });
  }

  function trackFromHeading(text){
    text = (text || '').toLowerCase();
    if(text.includes('python')) return 'python';
    if(text.includes('linux')) return 'linux';
    if(text.includes('cloud')) return 'cloud';
    if(text.includes('claude') || text.includes('ai / claude') || text.includes('ai/claude')) return 'claude';
    if(text === 'ai') return 'ai';
    return '';
  }

  function decorateCoursesPage(){
    Array.from(document.querySelectorAll('.track')).forEach(trackBlock => {
      const prev = trackBlock.previousElementSibling;
      const sectionHeading = prev && prev.classList && prev.classList.contains('section-title') ? prev.querySelector('h2') : null;
      const track = trackFromHeading(sectionHeading ? sectionHeading.textContent : '');
      if(!track) return;
      const cards = trackBlock.querySelectorAll('.card');
      if(cards[0]) cards[0].querySelectorAll('.item').forEach(item => wireResourceCard(item, track, 'course'));
      if(cards[1]) cards[1].querySelectorAll('.item').forEach(item => wireResourceCard(item, track, 'book'));
    });
  }

  function decorateTrackPage(){
    const page = (location.pathname.split('/').pop() || '').replace('.html','');
    const track = page === 'claude' ? 'claude' : page;
    const companionSection = Array.from(document.querySelectorAll('.section-title h2')).find(h => /Companion Courses/i.test(h.textContent));
    const booksSection = Array.from(document.querySelectorAll('.section-title h2')).find(h => /Companion Books/i.test(h.textContent));
    if(companionSection){
      const box = companionSection.parentElement.nextElementSibling;
      if(box) box.querySelectorAll('.course').forEach(item => wireResourceCard(item, track, 'course'));
    }
    if(booksSection){
      const box = booksSection.parentElement.nextElementSibling;
      if(box) box.querySelectorAll('.book').forEach(item => wireResourceCard(item, track, 'book'));
    }
  }

  function thumbSrcFor(payload){
    if(!payload) return '';
    return getThumbMap()[payload.key] || '';
  }

  function syncCardStates(){
    const focus = getFocus();
    document.querySelectorAll('.resource-card').forEach(card => {
      card.classList.remove('role-primary','role-companion','role-book','active-focus');
      const td = focus[card.dataset.track] || {};
      if(td.primary && td.primary.key === card.dataset.resourceKey) card.classList.add('role-primary');
      if(td.companion && td.companion.key === card.dataset.resourceKey) card.classList.add('role-companion');
      if(td.book && td.book.key === card.dataset.resourceKey) card.classList.add('role-book');
      if(td.active && td.active.key === card.dataset.resourceKey) card.classList.add('active-focus');
      renderThumb(card.querySelector('.resource-thumb'));
    });
  }

  function makeMiniThumb(src){
    return '<div class="mini-thumb'+(src?' has-image':'')+'" style="'+(src?'background-image:url(\''+src.replace(/'/g,"%27")+'\')':'')+'"></div>';
  }

  function syncPanels(){
    const focus = getFocus();
    document.querySelectorAll('[data-track-focus-panel]').forEach(panel => {
      const track = panel.dataset.trackFocusPanel;
      const td = focus[track] || {};
      const rows = [
        {role:'Primary course', payload: td.primary},
        {role:'Companion course', payload: td.companion},
        {role:'Companion book', payload: td.book}
      ];
      panel.innerHTML = '<div class="focus-kicker">Now studying</div><div class="focus-grid">'+rows.map(r=>{
        const p = r.payload;
        const src = thumbSrcFor(p);
        return '<div class="focus-item">'+makeMiniThumb(src)+'<div><strong>'+r.role+'</strong><span>'+(p ? p.title : 'Not selected yet')+'</span></div></div>';
      }).join('')+'</div>';
    });
  }

  function ensureTrackPanel(){
    const page = (location.pathname.split('/').pop() || '').replace('.html','');
    if(!/python|linux|cloud|claude/.test(page)) return;
    const track = page === 'claude' ? 'claude' : page;
    if(document.querySelector('[data-track-focus-panel="'+track+'"]')) return;
    const snap = Array.from(document.querySelectorAll('.section-title h2')).find(h => /Track Snapshot/i.test(h.textContent));
    if(!snap) return;
    const panel = document.createElement('article');
    panel.className = 'focus-panel';
    panel.dataset.trackFocusPanel = track;
    snap.parentElement.insertAdjacentElement('afterend', panel);
  }

  function getHomeProgress(){
    const ids = ['python','linux','cloud','ai','claude'];
    const out = {};
    ids.forEach(id => {
      const el = document.getElementById('pp-'+id);
      const num = el ? parseInt((el.textContent||'0').replace(/\D/g,''),10) : NaN;
      out[id] = isNaN(num) ? 0 : num;
    });
    return out;
  }

  function buildHomeActions(track, td){
    const actions = [];
    const href = pageForTrack(track);
    if(td && td.primary){
      actions.push({href, title:'Continue '+td.primary.title, sub:'Primary course selected for '+trackDisplay(track)+'.'});
    }
    if(td && td.companion){
      actions.push({href, title:'Use companion course: '+td.companion.title, sub:'Support your main path without stacking extra tracks.'});
    }
    if(td && td.book){
      actions.push({href, title:'Open companion book: '+td.book.title, sub:'Use your selected reference to unblock the next checkpoint.'});
    }
    return actions;
  }

  function ensureHomeIntelligenceCard(){
    if(document.getElementById('intelligenceCard')) return;
    const next = document.getElementById('nextActionsCard');
    if(!next) return;
    const card = document.createElement('section');
    card.id = 'intelligenceCard';
    card.className = 'card';
    card.innerHTML = '<div class="section-title" style="margin-top:0"><h2>Intelligence</h2><span>resource aware</span></div><div class="intel-track"></div><div class="intel-primary"></div><div class="intel-book"></div><a class="intel-launch" href="courses.html">Open Courses</a>';
    next.parentElement.insertBefore(card, next);
  }

  function enhanceHome(){
    if(!/index\.html$/.test(location.pathname) && location.pathname !== '/' && !location.pathname.endsWith('/portal/')) return;
    ensureHomeIntelligenceCard();
    const focus = getFocus();
    const progress = getHomeProgress();
    const tracks = ['python','linux','cloud','claude'];
    tracks.sort((a,b)=>(progress[a]||0)-(progress[b]||0));
    const nextTrack = tracks[0];
    const td = focus[nextTrack] || {};
    const titleEl = document.getElementById('focusTitle');
    const subEl = document.getElementById('focusSub');
    const phaseEl = document.getElementById('focusPhase');
    if(titleEl){
      if(td.primary){
        titleEl.textContent = td.primary.title;
        if(phaseEl) phaseEl.textContent = trackDisplay(nextTrack)+' primary';
        if(subEl) subEl.textContent = 'Continue your selected primary course for '+trackDisplay(nextTrack)+'.';
      } else if(td.book){
        titleEl.textContent = td.book.title;
        if(phaseEl) phaseEl.textContent = trackDisplay(nextTrack)+' reading';
        if(subEl) subEl.textContent = 'Use your selected book to unblock the next checkpoint.';
      }
    }
    const next = document.getElementById('nextActionsCard');
    if(next){
      const actions = buildHomeActions(nextTrack, td);
      if(actions.length){
        next.innerHTML = '<div class="next-actions-list">'+actions.slice(0,3).map((a,i)=>'<a class="next-act" href="'+a.href+'"><div class="next-num">'+(i+1)+'</div><div><strong>'+a.title+'</strong><span>'+a.sub+'</span></div></a>').join('')+'</div>';
      }
    }
    const intel = document.getElementById('intelligenceCard');
    if(intel){
      const t1 = intel.querySelector('.intel-track');
      const t2 = intel.querySelector('.intel-primary');
      const t3 = intel.querySelector('.intel-book');
      const launch = intel.querySelector('.intel-launch');
      t1.innerHTML = '<strong>Next focus track</strong><span>'+trackDisplay(nextTrack)+'</span>';
      t2.innerHTML = '<strong>Primary course</strong><span>'+(td.primary ? td.primary.title : 'Not selected yet')+'</span>';
      t3.innerHTML = '<strong>Companion book</strong><span>'+(td.book ? td.book.title : 'Not selected yet')+'</span>';
      launch.textContent = td.primary ? 'Open '+trackDisplay(nextTrack)+' resources' : 'Set track resources';
      launch.href = td.primary ? pageForTrack(nextTrack) : 'courses.html';
    }
  }

  function addStyles(){
    if(document.getElementById('resourceThumbStyles')) return;
    const style = document.createElement('style');
    style.id = 'resourceThumbStyles';
    style.textContent = `
      .resource-card{position:relative;display:grid !important;grid-template-columns:72px 1fr;gap:10px;align-items:start}
      .resource-thumb,.mini-thumb{width:72px;height:72px;border-radius:16px;background:linear-gradient(135deg,rgba(99,102,241,.16),rgba(56,189,248,.16));border:1px dashed rgba(99,102,241,.32);background-size:cover;background-position:center;position:relative;overflow:hidden}
      .mini-thumb{width:52px;height:52px;border-radius:14px;flex-shrink:0}
      .resource-thumb{cursor:pointer;outline:none;display:flex;align-items:flex-end;justify-content:center}
      .resource-thumb-label{font-size:.5rem;line-height:1.15;font-weight:800;text-transform:uppercase;letter-spacing:.06em;text-align:center;color:var(--text2,#475569);background:rgba(255,255,255,.78);padding:4px 6px;border-radius:10px;margin:6px}
      .resource-thumb.has-image .resource-thumb-label{display:none}
      .resource-thumb.awaiting-paste{box-shadow:0 0 0 3px rgba(79,70,229,.2) inset}
      .resource-thumb.awaiting-paste::after{content:'Paste now';position:absolute;right:6px;bottom:6px;font-size:.5rem;font-weight:800;background:rgba(15,23,42,.72);color:#fff;padding:4px 6px;border-radius:10px}
      .resource-thumb.dragging{border-style:solid}
      .thumb-clear{position:absolute;top:6px;right:6px;width:20px;height:20px;border:0;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;cursor:pointer;font-weight:800;display:grid;place-items:center;padding:0}
      .resource-toolbar{grid-column:2;display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
      .rt-btn{border:0;border-radius:999px;background:var(--bg2,#fff);color:var(--text,#0f172a);padding:6px 10px;font-size:.62rem;font-weight:800;cursor:pointer;box-shadow:0 2px 10px rgba(15,23,42,.06)}
      .resource-card.role-primary::before,.resource-card.role-companion::before,.resource-card.role-book::before,.resource-card.active-focus::after{position:absolute;top:8px;right:10px;font-size:.52rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:4px 6px;border-radius:999px}
      .resource-card.role-primary::before{content:'Primary';background:rgba(79,70,229,.12);color:var(--accent,#4f46e5)}
      .resource-card.role-companion::before{content:'Companion';background:rgba(14,165,233,.12);color:#0284c7}
      .resource-card.role-book::before{content:'Book';background:rgba(16,185,129,.12);color:#059669}
      .resource-card.active-focus::after{content:'Active';top:auto;bottom:10px;background:rgba(15,23,42,.72);color:#fff}
      .focus-panel{background:var(--bg2,#fff);border:1px solid var(--border,rgba(15,23,42,.08));border-radius:18px;padding:14px 16px;box-shadow:var(--shadow,0 10px 30px rgba(15,23,42,.08));margin:8px 0 16px}
      .focus-kicker{font-size:.58rem;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;color:var(--accent,#4f46e5);font-family:var(--mono,monospace);margin-bottom:8px}
      .focus-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .focus-item{display:grid;grid-template-columns:52px 1fr;gap:10px;align-items:center;padding:10px 12px;background:var(--bg3,#e8ecf4);border-radius:14px}
      .focus-item strong{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
      .focus-item span{display:block;font-size:.75rem;color:var(--text2,#475569);line-height:1.35;font-weight:700}
      #intelligenceCard .intel-track,#intelligenceCard .intel-primary,#intelligenceCard .intel-book{padding:10px 12px;background:var(--bg3,#e8ecf4);border-radius:14px;margin-top:8px}
      #intelligenceCard strong{display:block;font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
      #intelligenceCard span{display:block;font-size:.8rem;color:var(--text2,#475569);font-weight:700}
      .intel-launch{display:inline-flex;margin-top:10px;padding:10px 14px;border-radius:12px;background:linear-gradient(135deg,#2647c8,#6a5cff);color:#fff !important;font-weight:800;text-decoration:none}
      @media (max-width:760px){.resource-card{grid-template-columns:1fr}.resource-thumb{width:100%;height:112px}.focus-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('paste', function(e){
    if(!activeThumb) return;
    const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
    const imageItem = items.find(item => item.type && item.type.indexOf('image/') === 0);
    if(!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if(file) saveFileToThumb(activeThumb, file);
  });

  document.addEventListener('DOMContentLoaded', function(){
    addStyles();
    if(location.pathname.endsWith('courses.html')) decorateCoursesPage();
    else if(/python|linux|cloud|claude/.test(location.pathname)) decorateTrackPage();
    ensureTrackPanel();
    syncCardStates();
    syncPanels();

    if(window.refreshHomeWidgets){
      const original = window.refreshHomeWidgets;
      window.refreshHomeWidgets = function(){
        original();
        enhanceHome();
      };
    }
    setTimeout(enhanceHome, 0);
  });
})();
