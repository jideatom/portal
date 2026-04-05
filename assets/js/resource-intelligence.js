
(function(){
  const STORAGE_KEY = 'resource_thumbnail_map_v1';
  const FOCUS_KEY = 'resource_focus_map_v1';

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

  function ensureThumb(card, key){
    let thumb = card.querySelector('.resource-thumb');
    if(!thumb){
      thumb = document.createElement('div');
      thumb.className = 'resource-thumb';
      thumb.tabIndex = 0;
      thumb.innerHTML = '<span class="resource-thumb-label">Click then paste cover</span><button type="button" class="thumb-clear" title="Clear image">×</button>';
      card.insertBefore(thumb, card.firstChild);
    }
    thumb.dataset.resourceKey = key;
    renderThumb(thumb, key);

    thumb.addEventListener('click', function(e){
      if(e.target && e.target.classList.contains('thumb-clear')){
        e.stopPropagation();
        const map = getJSON(STORAGE_KEY, {});
        delete map[key];
        setJSON(STORAGE_KEY, map);
        renderThumb(thumb, key);
        return;
      }
      thumb.focus();
    });

    thumb.addEventListener('paste', function(e){
      const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
      const imageItem = items.find(item => item.type && item.type.indexOf('image/') === 0);
      if(!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      const reader = new FileReader();
      reader.onload = function(ev){
        const map = getJSON(STORAGE_KEY, {});
        map[key] = ev.target.result;
        setJSON(STORAGE_KEY, map);
        renderThumb(thumb, key);
      };
      reader.readAsDataURL(file);
    });

    thumb.addEventListener('dragover', e => e.preventDefault());
    thumb.addEventListener('drop', function(e){
      const file = Array.from(e.dataTransfer.files || []).find(f => f.type && f.type.indexOf('image/') === 0);
      if(!file) return;
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = function(ev){
        const map = getJSON(STORAGE_KEY, {});
        map[key] = ev.target.result;
        setJSON(STORAGE_KEY, map);
        renderThumb(thumb, key);
      };
      reader.readAsDataURL(file);
    });
  }

  function renderThumb(thumb, key){
    const map = getJSON(STORAGE_KEY, {});
    const src = map[key];
    thumb.classList.toggle('has-image', !!src);
    thumb.style.backgroundImage = src ? 'url("'+src+'")' : '';
    const label = thumb.querySelector('.resource-thumb-label');
    if(label) label.textContent = src ? 'Pasted cover' : 'Click then paste cover';
  }

  function markActive(track, payload){
    const focus = getJSON(FOCUS_KEY, {});
    focus[track] = payload;
    setJSON(FOCUS_KEY, focus);
  }

  function wireResourceCard(card, track, kind){
    if(card.dataset.resourceReady === '1') return;
    card.dataset.resourceReady = '1';
    card.classList.add('resource-card');
    const titleEl = card.querySelector('strong') || card.querySelector('h4') || card.firstElementChild;
    const title = titleEl ? titleEl.textContent.trim() : 'resource';
    const key = track + '::' + kind + '::' + slugify(title);
    card.dataset.resourceKey = key;
    card.dataset.track = track;
    card.dataset.kind = kind;
    ensureThumb(card, key);

    card.addEventListener('click', function(e){
      if(e.target && (e.target.classList.contains('thumb-clear') || e.target.closest('.resource-thumb'))) return;
      document.querySelectorAll('.resource-card.active-focus').forEach(el => {
        if(el.dataset.track === track) el.classList.remove('active-focus');
      });
      card.classList.add('active-focus');
      markActive(track, { title, kind, key, page: location.pathname.split('/').pop() });
      renderFocusPanels();
    });

    const focus = getJSON(FOCUS_KEY, {});
    if(focus[track] && focus[track].key === key){
      card.classList.add('active-focus');
    }
  }

  function findTrackLabelFromHeading(text){
    text = (text || '').toLowerCase();
    if(text.includes('python')) return 'python';
    if(text.includes('linux')) return 'linux';
    if(text.includes('cloud')) return 'cloud';
    if(text.includes('claude') || text.includes('ai / claude') || text.includes('ai/claude')) return 'claude';
    if(text === 'ai') return 'ai';
    return '';
  }

  function decorateCoursesPage(){
    
    Array.from(document.querySelectorAll('.wrap > .card, .track')).forEach(trackBlock => {
      const prev = trackBlock.previousElementSibling;
      const sectionHeading = prev && prev.classList && prev.classList.contains('section-title') ? prev.querySelector('h2') : null;
      const fallbackHeading = trackBlock.querySelector('.track-head h3');
      const heading = fallbackHeading || sectionHeading;

      const track = findTrackLabelFromHeading(heading ? heading.textContent : '');
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

  function renderFocusPanels(){
    const focus = getJSON(FOCUS_KEY, {});
    document.querySelectorAll('[data-focus-track]').forEach(panel => {
      const track = panel.dataset.focusTrack;
      const payload = focus[track];
      const title = panel.querySelector('.focus-title');
      const sub = panel.querySelector('.focus-sub');
      const thumb = panel.querySelector('.focus-thumb');
      if(payload){
        title.textContent = payload.title;
        sub.textContent = 'Active ' + payload.kind + ' focus · click another resource to switch.';
        panel.classList.add('has-focus');
        const map = getJSON(STORAGE_KEY, {});
        const src = map[payload.key];
        thumb.style.backgroundImage = src ? 'url("'+src+'")' : '';
        thumb.classList.toggle('has-image', !!src);
      }else{
        title.textContent = 'No active resource selected yet';
        sub.textContent = 'Click a course or companion book card to make it the active focus for this track.';
        panel.classList.remove('has-focus');
        thumb.style.backgroundImage = '';
        thumb.classList.remove('has-image');
      }
    });
  }

  function injectFocusPanel(track, anchor){
    if(!anchor || anchor.parentElement.querySelector('[data-focus-track="'+track+'"]')) return;
    const panel = document.createElement('article');
    panel.className = 'focus-panel';
    panel.dataset.focusTrack = track;
    panel.innerHTML = '<div class="focus-thumb"></div><div><div class="focus-kicker">Intelligence layer</div><h3 class="focus-title">No active resource selected yet</h3><p class="focus-sub">Click a course or companion book card to make it the active focus for this track.</p></div>';
    anchor.parentElement.insertBefore(panel, anchor.nextSibling);
  }

  function addFocusPanels(){
    if(location.pathname.endsWith('courses.html')){
      const wrap = document.querySelector('.wrap');
      if(!wrap) return;
      const intro = document.querySelector('.hero');
      const panel = document.createElement('article');
      panel.className = 'focus-panel multi-track';
      panel.innerHTML = '<div class="focus-thumb"></div><div><div class="focus-kicker">Covers + active focus</div><h3 class="focus-title">Click any course or book card, then paste a cover image into its thumbnail box.</h3><p class="focus-sub">That resource becomes the active focus for its track and shows up across the corresponding track page.</p></div>';
      intro.insertAdjacentElement('afterend', panel);
      return;
    }
    const track = (location.pathname.split('/').pop() || '').replace('.html','');
    const actualTrack = track === 'claude' ? 'claude' : track;
    const snapTitle = Array.from(document.querySelectorAll('.section-title h2')).find(h => /Track Snapshot/i.test(h.textContent));
    if(snapTitle) injectFocusPanel(actualTrack, snapTitle.parentElement);
  }

  function addStyles(){
    if(document.getElementById('resourceThumbStyles')) return;
    const style = document.createElement('style');
    style.id = 'resourceThumbStyles';
    style.textContent = `
      .focus-panel{display:grid;grid-template-columns:84px 1fr;gap:14px;align-items:center;background:var(--bg2,#fff);border:1px solid var(--border,rgba(15,23,42,.08));border-radius:18px;padding:14px 16px;box-shadow:var(--shadow,0 10px 30px rgba(15,23,42,.08));margin:8px 0 16px}
      .focus-panel.multi-track{margin-top:14px}
      .focus-kicker{font-size:.58rem;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;color:var(--accent,#4f46e5);font-family:var(--mono,monospace);margin-bottom:6px}
      .focus-panel h3{margin:0 0 4px;font-size:.98rem}
      .focus-panel p{margin:0;color:var(--text2,#475569);font-size:.76rem;line-height:1.5;font-weight:600}
      .focus-thumb,.resource-thumb{width:84px;height:84px;border-radius:16px;background:linear-gradient(135deg,rgba(99,102,241,.16),rgba(56,189,248,.16));border:1px dashed rgba(99,102,241,.32);background-size:cover;background-position:center;display:flex;align-items:flex-end;justify-content:center;position:relative;overflow:hidden}
      .resource-thumb{width:72px;height:72px;flex-shrink:0;outline:none;cursor:pointer}
      .resource-thumb-label{font-size:.52rem;line-height:1.15;font-weight:800;text-transform:uppercase;letter-spacing:.06em;text-align:center;color:var(--text2,#475569);background:rgba(255,255,255,.72);padding:4px 6px;border-radius:10px;margin:6px}
      .resource-thumb.has-image .resource-thumb-label,.focus-thumb.has-image::after{content:'Cover';display:block;font-size:.52rem;font-weight:800;background:rgba(15,23,42,.72);color:#fff;padding:4px 6px;border-radius:10px;position:absolute;right:6px;bottom:6px}
      .resource-thumb.has-image .resource-thumb-label{display:none}
      .thumb-clear{position:absolute;top:6px;right:6px;width:20px;height:20px;border:0;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;cursor:pointer;font-weight:800;display:grid;place-items:center;padding:0}
      .resource-card{position:relative;display:grid !important;grid-template-columns:72px 1fr;gap:10px;align-items:start}
      .resource-card.book{grid-template-columns:72px 1fr}
      .resource-card.active-focus{outline:2px solid rgba(79,70,229,.42);box-shadow:0 0 0 4px rgba(79,70,229,.10) inset}
      .resource-card.active-focus::before{content:'Active';position:absolute;top:8px;right:10px;font-size:.54rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--accent,#4f46e5)}
      .book .book-icon{display:none}
      @media (max-width:760px){.focus-panel{grid-template-columns:1fr}.focus-thumb{width:100%;height:120px}.resource-card{grid-template-columns:1fr}.resource-thumb{width:100%;height:112px}}
    `;
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', function(){
    addStyles();
    addFocusPanels();
    if(location.pathname.endsWith('courses.html')) decorateCoursesPage();
    else if(/python|linux|cloud|claude/.test(location.pathname)) decorateTrackPage();
    renderFocusPanels();
  });
})();
