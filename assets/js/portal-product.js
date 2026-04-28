(function(){
  const WEBHOOK_KEY = 'make_webhook_url_v1';
  const NOTION_TARGET_KEY = 'notion_goal_target_v1';
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
    style.textContent = '.portal-resource-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.portal-resource-actions button{border:1px solid rgba(15,23,42,.1);background:#fff;color:#312e81;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer}.portal-resource-actions button:hover{border-color:#7c3aed}.bottom-nav{grid-template-columns:repeat(auto-fit,minmax(74px,1fr)) !important}';
    document.head.appendChild(style);
  }

  document.addEventListener('DOMContentLoaded', function(){
    addStyles();
    addSettingsNav();
    addResourceActions();
    initSettingsPage();
  });
})();
