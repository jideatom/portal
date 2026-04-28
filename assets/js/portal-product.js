(function(){
  const WEBHOOK_KEY = 'make_webhook_url_v1';
  const NOTION_TARGET_KEY = 'notion_goal_target_v1';
  const COURSE_META_KEY = 'course_resource_meta_v1';
  const BACKUP_PREFIX = 'portal-backup-';

  function esc(s){
    return String(s || '').replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function getJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e){ return fallback; }
  }

  function downloadText(filename, text){
    const blob = new Blob([text], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportPortalData(){
    const data = {};
    for(let i = 0; i < localStorage.length; i++){
      const key = localStorage.key(i);
      data[key] = localStorage.getItem(key);
    }
    const stamp = new Date().toISOString().slice(0,10);
    downloadText(BACKUP_PREFIX + stamp + '.json', JSON.stringify({
      app:'jideatom-portal',
      version:2,
      exportedAt:new Date().toISOString(),
      origin:location.origin,
      data:data
    }, null, 2));
  }

  function importPortalData(file, statusEl){
    const reader = new FileReader();
    reader.onload = function(){
      try{
        const parsed = JSON.parse(reader.result);
        const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        Object.keys(data).forEach(function(key){
          if(typeof data[key] === 'string') localStorage.setItem(key, data[key]);
        });
        if(statusEl) statusEl.textContent = 'Import complete. Refreshing...';
        setTimeout(function(){ location.reload(); }, 600);
      }catch(e){
        if(statusEl) statusEl.textContent = 'Import failed. Choose a portal backup JSON file.';
      }
    };
    reader.readAsText(file);
  }

  function clearPortalCache(statusEl){
    if(!('caches' in window)){
      if(statusEl) statusEl.textContent = 'Browser cache API is unavailable.';
      return;
    }
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(key){ return key.indexOf('portal-') === 0; }).map(function(key){ return caches.delete(key); }));
    }).then(function(){
      if(statusEl) statusEl.textContent = 'Offline cache cleared.';
    });
  }

  function saveSettingsFromForm(root){
    const webhook = root.querySelector('[data-setting="make-webhook"]');
    const notionTarget = root.querySelector('[data-setting="notion-target"]');
    if(webhook) localStorage.setItem(WEBHOOK_KEY, webhook.value.trim());
    if(notionTarget) localStorage.setItem(NOTION_TARGET_KEY, notionTarget.value.trim());
  }

  function loadSettingsIntoForm(root){
    const webhook = root.querySelector('[data-setting="make-webhook"]');
    const notionTarget = root.querySelector('[data-setting="notion-target"]');
    if(webhook) webhook.value = localStorage.getItem(WEBHOOK_KEY) || '';
    if(notionTarget) notionTarget.value = localStorage.getItem(NOTION_TARGET_KEY) || '';
  }

  async function sendMakeEvent(type, payload){
    const url = (localStorage.getItem(WEBHOOK_KEY) || '').trim();
    if(!url) throw new Error('Make webhook URL is not set');
    const body = {
      type:type,
      source:'jideatom-portal',
      destination:'notion',
      notion_target:localStorage.getItem(NOTION_TARGET_KEY) || '',
      sent_at:new Date().toISOString(),
      page:location.pathname.split('/').pop() || 'index.html',
      payload:payload || {}
    };
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    if(!res.ok) throw new Error('Make webhook failed: ' + res.status);
    return body;
  }

  function resourceTitle(card){
    const title = card.dataset.title || '';
    if(title) return title;
    const strong = card.querySelector('strong');
    return strong ? strong.textContent.trim() : (card.textContent || '').trim().split('\n')[0];
  }

  function keyFor(card){
    return (resourceTitle(card) || 'resource').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
  }

  function getMap(name){
    return getJSON(name, {});
  }

  function setMap(name, value){
    localStorage.setItem(name, JSON.stringify(value));
  }

  function resourceKeys(){
    return {
      link:document.body.dataset.linkKey || 'courses_links_v1',
      thumb:document.body.dataset.thumbKey || 'courses_thumbs_v1',
      app:document.body.dataset.appKey || 'courses_app_links_v1'
    };
  }

  function getResourceLink(card){
    const keys = resourceKeys();
    return getMap(keys.link)[keyFor(card)] || card.dataset.link || '';
  }

  function setResourceValue(card, mapKey, value){
    const map = getMap(mapKey);
    map[keyFor(card)] = value;
    setMap(mapKey, map);
  }

  function clearResourceValue(card, mapKey){
    const map = getMap(mapKey);
    delete map[keyFor(card)];
    setMap(mapKey, map);
  }

  function renderResourceChrome(card){
    const keys = resourceKeys();
    const thumb = card.querySelector('.thumb');
    const img = getMap(keys.thumb)[keyFor(card)] || card.dataset.thumb || '';
    if(thumb){
      thumb.classList.toggle('has-image', !!img);
      thumb.style.backgroundImage = img ? 'url("' + img + '")' : '';
      thumb.textContent = img ? '' : '📘';
    }
    let badge = card.querySelector('.badge-link');
    if(getResourceLink(card)){
      if(!badge){
        badge = document.createElement('div');
        badge.className = 'badge-link';
        badge.textContent = 'linked';
        card.appendChild(badge);
      }
    }else if(badge){
      badge.remove();
    }
  }

  function addResourceActions(){
    if(!document.body.dataset.linkKey) return;
    const cards = document.querySelectorAll('.resource,.course,.book,.stack-item');
    cards.forEach(function(card){
      if(card.dataset.visibleActionsReady === '1') return;
      card.dataset.visibleActionsReady = '1';
      renderResourceChrome(card);
      const actions = document.createElement('div');
      actions.className = 'portal-resource-actions';
      actions.innerHTML = '<button type="button" data-portal-action="open">Open</button><button type="button" data-portal-action="edit">Link</button><button type="button" data-portal-action="reader">Reader</button><button type="button" data-portal-action="cover">Cover</button>';
      const body = card.querySelector('.resource-body') || card.querySelector('.body') || card;
      body.appendChild(actions);
      actions.addEventListener('click', function(e){
        const btn = e.target.closest('button[data-portal-action]');
        if(!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const keys = resourceKeys();
        const title = resourceTitle(card);
        const action = btn.dataset.portalAction;
        const link = getResourceLink(card);
        if(action === 'open'){
          if(link) window.open(link, '_blank', 'noopener,noreferrer');
          else alert('No link set yet.');
        }
        if(action === 'edit'){
          const val = prompt('Paste resource link for:\n' + title, link || 'https://');
          if(val) setResourceValue(card, keys.link, val.trim());
        }
        if(action === 'reader'){
          const appMap = getMap(keys.app);
          const finalUrl = appMap[keyFor(card)] || link;
          if(finalUrl) window.open('reader.html?title=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(finalUrl), '_blank', 'noopener,noreferrer');
          else alert('Set a direct PDF/EPUB URL or normal link first.');
        }
        if(action === 'cover'){
          const current = getMap(keys.thumb)[keyFor(card)] || card.dataset.thumb || '';
          const val = prompt('Paste thumbnail image URL for:\n' + title, current || 'https://');
          if(val) setResourceValue(card, keys.thumb, val.trim());
          if(val === '') clearResourceValue(card, keys.thumb);
        }
        renderResourceChrome(card);
      });
    });
  }

  function addSettingsNav(){
    const label = '<span>⚙️</span><span class="ni-lbl">Settings</span>';
    const bnavInner = document.querySelector('.bnav-inner');
    if(bnavInner && !bnavInner.querySelector('a[href="settings.html"]')){
      const a = document.createElement('a');
      a.className = 'ni' + (location.pathname.endsWith('settings.html') ? ' active' : '');
      a.href = 'settings.html';
      a.innerHTML = label;
      bnavInner.appendChild(a);
    }
    const bottom = document.querySelector('.bottom-nav');
    if(bottom && !bottom.querySelector('a[href="settings.html"]')){
      const a = document.createElement('a');
      a.href = 'settings.html';
      a.textContent = 'Settings';
      if(location.pathname.endsWith('settings.html')) a.className = 'active';
      bottom.appendChild(a);
    }
  }

  function initSettingsPage(){
    const root = document.querySelector('[data-settings-page]');
    if(!root) return;
    loadSettingsIntoForm(root);
    const status = root.querySelector('[data-settings-status]');
    root.addEventListener('click', function(e){
      const btn = e.target.closest('[data-settings-action]');
      if(!btn) return;
      const action = btn.dataset.settingsAction;
      if(action === 'save'){
        saveSettingsFromForm(root);
        if(status) status.textContent = 'Settings saved.';
      }
      if(action === 'test'){
        saveSettingsFromForm(root);
        if(status) status.textContent = 'Sending test event...';
        sendMakeEvent('portal_connection_test', {message:'Portal Make webhook test'})
          .then(function(){ if(status) status.textContent = 'Make webhook test sent.'; })
          .catch(function(err){ if(status) status.textContent = err.message; });
      }
      if(action === 'export') exportPortalData();
      if(action === 'clear-cache') clearPortalCache(status);
    });
    const picker = root.querySelector('[data-settings-import]');
    if(picker){
      picker.addEventListener('change', function(){
        const file = picker.files && picker.files[0];
        if(file) importPortalData(file, status);
      });
    }
  }

  function normalizeTrack(text){
    text = (text || '').toLowerCase();
    if(text.indexOf('ai') >= 0 || text.indexOf('claude') >= 0) return 'AI';
    if(text.indexOf('python') >= 0) return 'Python';
    if(text.indexOf('linux') >= 0) return 'Linux';
    if(text.indexOf('devops') >= 0) return 'DevOps';
    if(text.indexOf('cloud') >= 0 || text.indexOf('aws') >= 0 || text.indexOf('azure') >= 0) return 'Cloud';
    return 'Other';
  }

  function inferCourseType(card){
    const title = resourceTitle(card);
    const link = getResourceLink(card);
    const text = (title + ' ' + link).toLowerCase();
    if(text.indexOf('docs') >= 0 || text.indexOf('documentation') >= 0 || text.indexOf('modelcontextprotocol.io') >= 0 || text.indexOf('pulumi.com/learn') >= 0) return 'Docs';
    if(/book|bible|handbook|guide|cookbook|introduction|reference|packtpub|manning|oreilly|wiley|amazon\.com/.test(text)) return 'Book';
    return 'Course';
  }

  function inferPriority(card, type, index){
    if(index === 0) return 'Primary';
    if(type === 'Book' || type === 'Docs') return 'Reference';
    return 'Companion';
  }

  function getCourseMeta(){
    return getJSON(COURSE_META_KEY, {});
  }

  function setCourseMeta(meta){
    localStorage.setItem(COURSE_META_KEY, JSON.stringify(meta));
  }

  function courseMetaFor(card, defaults){
    const meta = getCourseMeta();
    const key = keyFor(card);
    meta[key] = Object.assign({}, defaults, meta[key] || {});
    return meta[key];
  }

  function updateCourseMeta(card, patch){
    const meta = getCourseMeta();
    const key = keyFor(card);
    meta[key] = Object.assign({}, meta[key] || {}, patch);
    setCourseMeta(meta);
  }

  function decorateCourseFilterMeta(card, index){
    const section = card.closest('.stack-card');
    const heading = section ? section.querySelector('.section-title h2') : null;
    const track = normalizeTrack(heading ? heading.textContent : '');
    const type = inferCourseType(card);
    const defaults = {
      track:track,
      type:type,
      status:'Not started',
      priority:inferPriority(card, type, index)
    };
    const meta = courseMetaFor(card, defaults);
    card.dataset.filterTrack = meta.track || track;
    card.dataset.filterType = meta.type || type;
    card.dataset.filterStatus = meta.status || 'Not started';
    card.dataset.filterPriority = meta.priority || defaults.priority;

    if(card.querySelector('.course-meta-controls')) return;
    const controls = document.createElement('div');
    controls.className = 'course-meta-controls';
    controls.innerHTML =
      '<label>Status<select data-course-meta="status"><option>Not started</option><option>Active</option><option>Done</option><option>Later</option></select></label>' +
      '<label>Priority<select data-course-meta="priority"><option>Primary</option><option>Companion</option><option>Reference</option></select></label>';
    const body = card.querySelector('.body') || card.querySelector('.resource-body') || card;
    body.appendChild(controls);
    controls.querySelector('[data-course-meta="status"]').value = card.dataset.filterStatus;
    controls.querySelector('[data-course-meta="priority"]').value = card.dataset.filterPriority;
    controls.addEventListener('click', function(e){ e.stopPropagation(); });
    controls.addEventListener('change', function(e){
      const select = e.target.closest('select[data-course-meta]');
      if(!select) return;
      const patch = {};
      if(select.dataset.courseMeta === 'status'){
        patch.status = select.value;
        card.dataset.filterStatus = select.value;
      }
      if(select.dataset.courseMeta === 'priority'){
        patch.priority = select.value;
        card.dataset.filterPriority = select.value;
      }
      updateCourseMeta(card, patch);
      applyCourseFilters();
    });
  }

  function courseFilterValue(name){
    const el = document.querySelector('[data-course-filter="' + name + '"]');
    return el ? el.value : 'All';
  }

  function applyCourseFilters(){
    if(!location.pathname.endsWith('courses.html')) return;
    const filters = {
      track:courseFilterValue('track'),
      type:courseFilterValue('type'),
      status:courseFilterValue('status'),
      priority:courseFilterValue('priority')
    };
    let visible = 0;
    document.querySelectorAll('.stack-card').forEach(function(section){
      let sectionVisible = 0;
      section.querySelectorAll('.stack-item').forEach(function(card){
        const show = (filters.track === 'All' || card.dataset.filterTrack === filters.track) &&
          (filters.type === 'All' || card.dataset.filterType === filters.type) &&
          (filters.status === 'All' || card.dataset.filterStatus === filters.status) &&
          (filters.priority === 'All' || card.dataset.filterPriority === filters.priority);
        card.classList.toggle('course-filter-hidden', !show);
        if(show){ sectionVisible++; visible++; }
      });
      section.classList.toggle('course-section-hidden', sectionVisible === 0);
    });
    const count = document.getElementById('courseFilterCount');
    if(count) count.textContent = visible + ' shown';
  }

  function initCourseFilters(){
    if(!location.pathname.endsWith('courses.html')) return;
    const wrap = document.querySelector('.wrap');
    const hero = document.querySelector('.hero');
    if(!wrap || !hero || document.getElementById('courseFilterPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'courseFilterPanel';
    panel.className = 'course-filter-panel';
    panel.innerHTML = '<div class="course-filter-top"><strong>Filter resources</strong><span id="courseFilterCount">0 shown</span></div><div class="course-filter-grid"><label>Track<select data-course-filter="track"><option>All</option><option>AI</option><option>Python</option><option>Linux</option><option>DevOps</option><option>Cloud</option></select></label><label>Type<select data-course-filter="type"><option>All</option><option>Course</option><option>Book</option><option>Docs</option></select></label><label>Status<select data-course-filter="status"><option>All</option><option>Not started</option><option>Active</option><option>Done</option><option>Later</option></select></label><label>Priority<select data-course-filter="priority"><option>All</option><option>Primary</option><option>Companion</option><option>Reference</option></select></label><button type="button" id="courseFilterReset">Reset</button></div>';
    hero.insertAdjacentElement('afterend', panel);
    document.querySelectorAll('.stack-card').forEach(function(section){
      section.querySelectorAll('.stack-item').forEach(function(card, index){
        decorateCourseFilterMeta(card, index);
      });
    });
    panel.addEventListener('change', applyCourseFilters);
    document.getElementById('courseFilterReset').addEventListener('click', function(){
      panel.querySelectorAll('select').forEach(function(select){ select.value = 'All'; });
      applyCourseFilters();
    });
    applyCourseFilters();
  }

  window.PortalProduct = {
    sendMakeEvent:sendMakeEvent,
    exportPortalData:exportPortalData,
    importPortalData:importPortalData,
    loadSettingsIntoForm:loadSettingsIntoForm,
    saveSettingsFromForm:saveSettingsFromForm,
    keys:{webhook:WEBHOOK_KEY, notionTarget:NOTION_TARGET_KEY}
  };

  function addStyles(){
    if(document.getElementById('portalProductStyles')) return;
    const style = document.createElement('style');
    style.id = 'portalProductStyles';
    style.textContent = '.portal-resource-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.portal-resource-actions button{border:1px solid rgba(15,23,42,.1);background:#fff;color:#312e81;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer}.portal-resource-actions button:hover{border-color:#7c3aed}.bottom-nav{grid-template-columns:repeat(auto-fit,minmax(74px,1fr)) !important}.course-filter-panel{background:var(--card,#fff);border:1px solid var(--line,rgba(15,23,42,.12));border-radius:20px;padding:14px 16px;box-shadow:var(--shadow,0 10px 30px rgba(15,23,42,.08));margin:-4px 0 16px}.course-filter-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.course-filter-top strong{font-size:15px}.course-filter-top span{font-size:12px;font-weight:800;color:var(--muted,#64748b)}.course-filter-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:end}.course-filter-grid label,.course-meta-controls label{display:grid;gap:5px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#64748b)}.course-filter-grid select,.course-meta-controls select{width:100%;border:1px solid var(--line,rgba(15,23,42,.12));border-radius:12px;background:#fff;color:var(--text,#0f172a);padding:9px 10px;font-size:12px;font-weight:800;text-transform:none;letter-spacing:0}.course-filter-grid button{border:0;border-radius:12px;background:linear-gradient(135deg,var(--accent,#ec4899),var(--accent2,#7c3aed));color:#fff;padding:10px 12px;font-size:12px;font-weight:900;cursor:pointer}.course-meta-controls{grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.course-filter-hidden,.course-section-hidden{display:none !important}@media(max-width:760px){.course-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.course-filter-grid button{grid-column:1 / -1}.course-meta-controls{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', function(){
    addStyles();
    addSettingsNav();
    addResourceActions();
    initCourseFilters();
    initSettingsPage();
  });
})();
