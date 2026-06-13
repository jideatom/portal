(function(){
  const WEBHOOK_KEY = 'make_webhook_url_v1';
  const NOTION_TARGET_KEY = 'notion_goal_target_v1';
  const COURSE_META_KEY = 'course_resource_meta_v1';
  const LOCK_KEY = 'portal_resource_lock_v1';
  const CANONICAL_RESOURCE_KEYS = {
    link:'courses_links_v1',
    thumb:'courses_thumbs_v1',
    app:'courses_app_links_v1'
  };
  const RESOURCE_ALIAS_KEYS = {
    'ud-mastering-claude-ai-build-ai-apps-agents-mcp-systems':['ud-mastering-claude-ai'],
    'mastering-claude-ai':['ud-mastering-claude-ai'],
    'ud-ai-engineer-core-track-llm-engineering-rag-qlora-agents':['ud-ai-engineer-core-track'],
    'adrian-cantrill-aws-solutions-architect-associate-saa-c03':['adrian-cantrill-aws-solutions-architect-associate'],
    'ud-aws-networking-deep-dive-crash-course-vpc-essentials':['ud-aws-networking-deep-dive-vpc-essentials'],
    'pikuma-master-the-linux-command-line-bash-scripting':['pikuma-linux-command-line-bash'],
    'cbtnuggets-red-hat-certified-system-administrator-rhcsa-exam-ex200':['cbtnuggets-rhcsa-ex200'],
    'techworldnana-gitlab-ci-cd-from-zero-to-hero':['techworldnana-gitlab-ci-cd']
  };
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
      payload:payload || {},
      ...(payload || {})
    };
    try{
      const res = await fetch(url, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      });
      if(!res.ok) throw new Error('Make webhook failed: ' + res.status);
    }catch(err){
      const form = new URLSearchParams();
      form.set('type', body.type || '');
      form.set('source', body.source);
      form.set('destination', body.destination);
      form.set('notion_target', body.notion_target);
      form.set('sent_at', body.sent_at);
      Object.keys(payload || {}).forEach(function(key){
        const value = payload[key];
        form.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''));
      });
      form.set('payload_json', JSON.stringify(body.payload || {}));
      form.set('body_json', JSON.stringify(body));
      await fetch(url, {
        method:'POST',
        mode:'no-cors',
        body:form
      });
    }
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

  function resourceKeyList(card){
    const key = keyFor(card);
    const aliases = RESOURCE_ALIAS_KEYS[key] || [];
    const reverseAliases = Object.keys(RESOURCE_ALIAS_KEYS).filter(function(candidate){
      return RESOURCE_ALIAS_KEYS[candidate].indexOf(key) >= 0;
    });
    return [key].concat(aliases, reverseAliases).filter(function(value, index, list){
      return value && list.indexOf(value) === index;
    });
  }

  function mapLookup(map, keys){
    let found = '';
    keys.some(function(key){
      if(map[key]){
        found = map[key];
        return true;
      }
      const looseKey = Object.keys(map).find(function(candidate){
        return candidate.length > 8 && key.length > 8 && (candidate.indexOf(key) >= 0 || key.indexOf(candidate) >= 0);
      });
      if(looseKey && map[looseKey]){
        found = map[looseKey];
        return true;
      }
      return false;
    });
    return found;
  }

  function getMap(name){
    return getJSON(name, {});
  }

  function setMap(name, value){
    localStorage.setItem(name, JSON.stringify(value));
  }

  function isLocked(){
    return localStorage.getItem(LOCK_KEY) !== 'unlocked';
  }

  function setLocked(locked){
    localStorage.setItem(LOCK_KEY, locked ? 'locked' : 'unlocked');
    applyLockMode();
  }

  function lockStatusText(){
    return isLocked() ? 'Locked: study mode' : 'Unlocked: edit mode';
  }

  function showLockNotice(){
    const existing = document.getElementById('portalLockToast');
    if(existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'portalLockToast';
    toast.className = 'portal-lock-toast';
    toast.textContent = 'Locked mode is on. Tap Unlock to edit links, thumbnails, or course status.';
    document.body.appendChild(toast);
    setTimeout(function(){ toast.classList.add('show'); }, 10);
    setTimeout(function(){
      toast.classList.remove('show');
      setTimeout(function(){ toast.remove(); }, 220);
    }, 2600);
  }

  function ensureLockToggle(){
    if(document.getElementById('portalLockToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'portalLockToggle';
    btn.type = 'button';
    btn.className = 'portal-lock-toggle';
    btn.addEventListener('click', function(){
      if(isLocked()){
        const ok = window.confirm('Unlock edit mode? You will be able to change links, thumbnails, reader URLs, and course status.');
        if(!ok) return;
        setLocked(false);
      }else{
        setLocked(true);
      }
    });
    const headerActions = document.querySelector('.hdr-right');
    if(headerActions){
      btn.classList.add('in-header');
      headerActions.prepend(btn);
    }else{
      btn.classList.add('floating');
      document.body.appendChild(btn);
    }
  }

  function applyLockMode(){
    const locked = isLocked();
    document.body.classList.toggle('portal-locked', locked);
    document.body.classList.toggle('portal-unlocked', !locked);
    document.querySelectorAll('#portalLockToggle').forEach(function(btn){
      btn.textContent = locked ? '🔒 Locked' : '🔓 Unlocked';
      btn.setAttribute('aria-pressed', locked ? 'true' : 'false');
      btn.title = locked ? 'Study mode: editing is disabled' : 'Edit mode: resource maintenance is enabled';
    });
    const overlay = document.getElementById('portalResourceEditor');
    if(locked && overlay) closeResourceEditor();
  }

  function resourceKeys(){
    return {
      link:document.body.dataset.linkKey || 'courses_links_v1',
      thumb:document.body.dataset.thumbKey || 'courses_thumbs_v1',
      app:document.body.dataset.appKey || 'courses_app_links_v1'
    };
  }

  function resourceMapType(mapKey){
    if(/_app_links_v1$/.test(mapKey)) return 'app';
    if(/_thumbs_v1$/.test(mapKey)) return 'thumb';
    if(/_links_v1$/.test(mapKey)) return 'link';
    return '';
  }

  function getResourceLink(card){
    const keys = resourceKeys();
    const resourceKeysToTry = resourceKeyList(card);
    return mapLookup(getMap(CANONICAL_RESOURCE_KEYS.link), resourceKeysToTry) ||
      mapLookup(getMap(keys.link), resourceKeysToTry) ||
      card.dataset.link || '';
  }

  function getResourceThumb(card){
    const keys = resourceKeys();
    const resourceKeysToTry = resourceKeyList(card);
    return mapLookup(getMap(CANONICAL_RESOURCE_KEYS.thumb), resourceKeysToTry) ||
      mapLookup(getMap(keys.thumb), resourceKeysToTry) ||
      card.dataset.thumb || '';
  }

  function getResourceAppLink(card){
    const keys = resourceKeys();
    const resourceKeysToTry = resourceKeyList(card);
    return mapLookup(getMap(CANONICAL_RESOURCE_KEYS.app), resourceKeysToTry) ||
      mapLookup(getMap(keys.app), resourceKeysToTry) ||
      card.dataset.app || '';
  }

  function setResourceValue(card, mapKey, value){
    const keys = resourceKeyList(card);
    const map = getMap(mapKey);
    keys.forEach(function(key){ map[key] = value; });
    setMap(mapKey, map);
    const type = resourceMapType(mapKey);
    Object.keys(CANONICAL_RESOURCE_KEYS).filter(function(name){ return name === type; }).forEach(function(name){
      const canonicalKey = CANONICAL_RESOURCE_KEYS[name];
      const canonicalMap = getMap(canonicalKey);
      keys.forEach(function(key){ canonicalMap[key] = value; });
      setMap(canonicalKey, canonicalMap);
    });
  }

  function clearResourceValue(card, mapKey){
    const keys = resourceKeyList(card);
    const map = getMap(mapKey);
    keys.forEach(function(key){ delete map[key]; });
    setMap(mapKey, map);
    const type = resourceMapType(mapKey);
    Object.keys(CANONICAL_RESOURCE_KEYS).filter(function(name){ return name === type; }).forEach(function(name){
      const canonicalKey = CANONICAL_RESOURCE_KEYS[name];
      const canonicalMap = getMap(canonicalKey);
      keys.forEach(function(key){ delete canonicalMap[key]; });
      setMap(canonicalKey, canonicalMap);
    });
  }

  function isProgressResource(card){
    if(!card || card.classList.contains('book')) return false;
    if(card.dataset.status === 'Later') return false;
    if(card.dataset.priority === 'Reference') return false;
    if(inferCourseType(card) !== 'Course') return false;
    const section = card.closest('.stack-card');
    if(section && section.dataset.track === 'Parked') return false;
    return card.matches('.course,.stack-item');
  }

  function progressStatus(card){
    const meta = getCourseMeta()[keyFor(card)] || {};
    return card.dataset.filterStatus || meta.status || card.dataset.status || 'Not started';
  }

  function isProgressDone(card){
    return progressStatus(card) === 'Done';
  }

  function progressGroups(){
    const groups = [];
    document.querySelectorAll('.path-grid,.stack-row').forEach(function(container){
      const cards = Array.from(container.querySelectorAll('.course,.stack-item')).filter(isProgressResource);
      if(cards.length) groups.push(cards);
    });
    return groups;
  }

  function isProgressLocked(card){
    if(!isProgressResource(card)) return false;
    let locked = false;
    progressGroups().some(function(group){
      const index = group.indexOf(card);
      if(index < 0) return false;
      locked = index > 0 && !isProgressDone(group[index - 1]);
      return true;
    });
    return locked;
  }

  function showProgressNotice(card){
    const previous = progressGroups().reduce(function(found, group){
      const index = group.indexOf(card);
      return index > 0 ? group[index - 1] : found;
    }, null);
    const needed = previous ? resourceTitle(previous) : 'the previous course';
    alert('Course locked. Finish this first:\n\n' + needed);
  }

  function openReaderPage(title, url){
    const target = 'reader.html?title=' + encodeURIComponent(title) + '&url=' + encodeURIComponent(url);
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    if(mobile) location.href = target;
    else window.open(target, '_blank', 'noopener,noreferrer');
  }

  function setProgressStatus(card, status){
    updateCourseMeta(card, {status:status});
    card.dataset.filterStatus = status;
    const statusSelect = card.querySelector('[data-course-meta="status"]');
    if(statusSelect) statusSelect.value = status;
    applyProgressLocks();
    if(location.pathname.endsWith('courses.html')) applyCourseFilters();
  }

  function toggleProgressDone(card){
    if(isProgressLocked(card)){
      showProgressNotice(card);
      return;
    }
    if(isProgressDone(card)){
      if(isLocked()){
        alert('Already marked done. Unlock edit mode if you need to undo progress.');
        return;
      }
      const ok = window.confirm('Mark this course incomplete?');
      if(!ok) return;
      setProgressStatus(card, 'Not started');
      return;
    }
    setProgressStatus(card, 'Done');
  }

  function applyProgressLocks(){
    progressGroups().forEach(function(group){
      group.forEach(function(card, index){
        const locked = index > 0 && !isProgressDone(group[index - 1]);
        const done = isProgressDone(card);
        card.classList.toggle('portal-progress-locked', locked);
        card.classList.toggle('portal-progress-done', done);
        card.setAttribute('aria-disabled', locked ? 'true' : 'false');
        let badge = card.querySelector('.portal-progress-badge');
        if(!badge){
          badge = document.createElement('div');
          badge.className = 'portal-progress-badge';
          card.appendChild(badge);
        }
        badge.textContent = done ? 'done' : locked ? 'locked' : 'unlocked';
        const doneBtn = card.querySelector('[data-portal-action="mark-done"]');
        if(doneBtn) doneBtn.textContent = done ? 'Done ✓' : locked ? 'Locked' : 'Mark done';
      });
    });
  }

  const COURSE_TOPICS = {
    'claude-code-for-real-engineers':['Repo orientation and rules','Planning before coding','Prompting Claude Code with context','Multi-step implementation loops','Reviews, fixes, and shipping discipline'],
    'code-with-mosh-claude-code-for-professional-developers':['Claude Code workflow setup','Full-stack feature planning','Backend and database changes','Testing and debugging loops','Deployment-ready project polish'],
    'maven-the-ai-engineering-bootcamp':['LLM app foundations','Retrieval and RAG architecture','Evaluations and quality checks','Agents and tool use','Production patterns and project delivery'],
    'datatalksclub-llm-zoomcamp':['Embeddings and search','Vector databases','RAG pipelines','Evaluation and monitoring','Capstone document intelligence project'],
    'hugging-face-ai-agents-course':['Agent fundamentals','Tools and actions','Framework-based agents','Multi-step reasoning','Final agent project'],
    'deeplearning-ai-langchain-for-llm-application-development':['Chains and prompts','Memory and retrieval','Document loaders','RAG application flow','LLM app integration'],
    'academind-git-github-the-practical-guide':['Git mental model','Commits and history','Branches and merges','GitHub remotes','Pull request workflow'],
    'code-with-mosh-complete-python-mastery':['Python syntax refresh','Functions and modules','Classes and OOP','Files and exceptions','Practical scripts'],
    'fastapi-beginner-course':['API routes','Path and query parameters','Pydantic models','Request and response validation','First working API'],
    'testdriven-io-test-driven-development-with-fastapi-and-docker':['FastAPI project setup','Postgres and models','Dockerized development','Pytest and TDD','CI/CD and deployment flow'],
    'arjancodes-next-level-python':['Clean function design','Data models and typing','Composition over complexity','Testing and maintainability','Refactoring habits'],
    'talkpython-modern-apis-with-fastapi':['API routing and schemas','Async endpoints','Database integration','Authentication basics','Production API polish'],
    'code-with-mosh-complete-sql-mastery':['Relational data model','Select, joins, and aggregation','Data modification','Indexes and performance basics','Reporting queries'],
    'orhanergun-python-for-network-engineers':['Python network automation setup','SSH and device access','Parsing command output','Config backup/change workflows','Network automation project'],
    'master-python-network-automation-for-network-engineers':['Netmiko or SSH setup','Device inventory','Run show commands','Parse and save outputs','Backup or audit configs'],
    'bret-fisher-docker-mastery':['Container fundamentals','Images and Dockerfiles','Compose workflows','Volumes and networking','Production container habits'],
    'bret-fisher-kubernetes-and-cloud-native-courses':['Kubernetes core objects','Services and ingress','Config and secrets','Deployments and scaling','Cloud-native operations'],
    'devops-directive-github-actions':['Workflow files','Triggers and jobs','Secrets and variables','Test automation','Deploy automation'],
    'techworldnana-gitlab-ci-cd':['Pipeline basics','Build and test stages','Variables and environments','Artifacts and deployments','Pipeline troubleshooting'],
    'adrian-cantrill-aws-solutions-architect-associate':['AWS account and IAM foundation','Compute and storage','VPC networking','Databases and integration','Architecture patterns'],
    'ud-aws-networking-deep-dive-vpc-essentials':['VPC fundamentals','Subnets and route tables','Internet and NAT gateways','Security groups and NACLs','Hybrid connectivity thinking'],
    'tutorials-dojo-aws-saa-practice-exams':['Domain review','Timed practice exams','Wrong-answer analysis','Weak-area repair','Final readiness pass'],
    'pikuma-linux-command-line-bash':['Shell navigation','Files and permissions','Text processing','Bash scripting basics','Automation exercises'],
    'sander-van-vugt-rhcsa-rhel-9':['RHEL installation and tools','Users, groups, and permissions','Storage and filesystems','Services and systemd','RHCSA practice labs'],
    'pearsons-linux-networking-basics-and-beyond':['Linux network commands','IP addressing and routing','DNS and name resolution','Firewalls and troubleshooting','Server networking labs']
  };

  function topicsForCard(card){
    const keys = resourceKeyList(card);
    let topics = [];
    keys.some(function(key){
      if(COURSE_TOPICS[key]){
        topics = COURSE_TOPICS[key];
        return true;
      }
      return false;
    });
    return topics;
  }

  function addCourseTopics(){
    if(!location.pathname.endsWith('courses.html')) return;
    document.querySelectorAll('.stack-item').forEach(function(card){
      if(card.querySelector('.course-topic-list')) return;
      if(inferCourseType(card) !== 'Course') return;
      const topics = topicsForCard(card);
      if(!topics.length) return;
      const body = card.querySelector('.body') || card.querySelector('.resource-body') || card;
      const list = document.createElement('div');
      list.className = 'course-topic-list';
      list.innerHTML = '<div class="course-topic-title">Topics to finish</div>' + topics.map(function(topic){
        return '<div class="course-topic">• ' + esc(topic) + '</div>';
      }).join('');
      body.appendChild(list);
    });
  }

  function initParkedCollapse(){
    if(!location.pathname.endsWith('courses.html')) return;
    const section = document.querySelector('.stack-card[data-track="Parked"]');
    if(!section || section.dataset.collapseReady === '1') return;
    section.dataset.collapseReady = '1';
    section.classList.add('parked-collapsed');
    const title = section.querySelector('.section-title');
    if(!title) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'parked-toggle';
    btn.textContent = 'Expand';
    btn.addEventListener('click', function(){
      const collapsed = section.classList.toggle('parked-collapsed');
      btn.textContent = collapsed ? 'Expand' : 'Collapse';
    });
    title.appendChild(btn);
  }

  function renderResourceChrome(card){
    const thumb = card.querySelector('.thumb');
    const img = getResourceThumb(card);
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
      card.querySelectorAll('.mini-hint').forEach(function(hint){
        hint.textContent = 'Use Edit to manage URL, reader link, and thumbnail.';
      });
      card.addEventListener('click', function(e){
        if(e.defaultPrevented || e.target.closest('button,input,select,textarea,a,.portal-resource-actions,.course-meta-controls')) return;
        if(isProgressLocked(card)){
          e.preventDefault();
          e.stopImmediatePropagation();
          showProgressNotice(card);
          return;
        }
        const link = getResourceLink(card);
        if(!link) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        window.open(link, '_blank', 'noopener,noreferrer');
      }, true);
      card.addEventListener('contextmenu', function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        if(isLocked()){
          showLockNotice();
          return;
        }
        openResourceEditor(card);
      }, true);
      const actions = document.createElement('div');
      actions.className = 'portal-resource-actions';
      actions.innerHTML = '<button type="button" data-portal-action="mark-done">Mark done</button><button type="button" data-portal-action="open">Open</button><button type="button" data-portal-action="quick-edit">Edit</button><button type="button" data-portal-action="reader">Reader</button>';
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
        if(action === 'mark-done'){
          toggleProgressDone(card);
          return;
        }
        if(action === 'open'){
          if(isProgressLocked(card)){
            showProgressNotice(card);
            return;
          }
          if(link) window.open(link, '_blank', 'noopener,noreferrer');
          else alert('No link set yet.');
        }
        if(action === 'edit'){
          if(isLocked()){
            showLockNotice();
            return;
          }
          const val = prompt('Paste resource link for:\n' + title, link || 'https://');
          if(val) setResourceValue(card, keys.link, val.trim());
        }
        if(action === 'quick-edit'){
          if(isLocked()){
            showLockNotice();
            return;
          }
          openResourceEditor(card);
        }
        if(action === 'reader'){
          if(isProgressLocked(card)){
            showProgressNotice(card);
            return;
          }
          const finalUrl = getResourceAppLink(card) || link;
          if(finalUrl) openReaderPage(title, finalUrl);
          else alert('Set a Google Drive share link, direct PDF/EPUB URL, or normal link first.');
        }
        if(action === 'cover'){
          if(isLocked()){
            showLockNotice();
            return;
          }
          const current = getResourceThumb(card);
          const val = prompt('Paste thumbnail image URL for:\n' + title, current || 'https://');
          if(val) setResourceValue(card, keys.thumb, val.trim());
          if(val === '') clearResourceValue(card, keys.thumb);
        }
        renderResourceChrome(card);
      });
    });
  }

  function ensureResourceEditor(){
    let overlay = document.getElementById('portalResourceEditor');
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'portalResourceEditor';
    overlay.className = 'portal-editor-overlay';
    overlay.innerHTML = '<div class="portal-editor"><div class="portal-editor-head"><div><strong id="portalEditorTitle">Edit resource</strong><span id="portalEditorSub">URL, reader link, and thumbnail</span></div><button type="button" data-editor-action="close">Close</button></div><div class="portal-editor-preview"><div class="portal-editor-thumb" id="portalEditorThumb">📘</div><div><div class="portal-editor-name" id="portalEditorName"></div><div class="portal-editor-note">Reader URL can be a Google Drive share link or a direct PDF/EPUB link. Drive files hand off to your device reader.</div></div></div><div class="portal-editor-grid"><label>Resource URL<input id="portalEditorUrl" type="url" placeholder="https://..."></label><label>Reader URL<input id="portalEditorReaderUrl" type="url" placeholder="Google Drive share link or direct PDF/EPUB URL"></label><label>Thumbnail URL<input id="portalEditorThumbUrl" type="url" placeholder="https://...jpg"></label><label data-editor-course-meta>Status<select id="portalEditorStatus"><option>Not started</option><option>Active</option><option>Done</option><option>Later</option></select></label><label data-editor-course-meta>Priority<select id="portalEditorPriority"><option>Primary</option><option>Companion</option><option>Reference</option></select></label></div><div class="portal-editor-actions"><button type="button" class="primary" data-editor-action="save">Save</button><button type="button" data-editor-action="open">Open URL</button><button type="button" data-editor-action="reader">Open Reader</button><button type="button" data-editor-action="clear-thumb">Clear Thumbnail</button></div><div class="portal-editor-status" id="portalEditorStatusText"></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e){
      if(e.target === overlay) closeResourceEditor();
      const btn = e.target.closest('[data-editor-action]');
      if(!btn) return;
      const card = overlay._resourceCard;
      const action = btn.dataset.editorAction;
      if(action === 'close') closeResourceEditor();
      if(action === 'save' && card){
        if(isLocked()){
          showLockNotice();
          closeResourceEditor();
          return;
        }
        saveResourceEditor(card);
      }
      if(action === 'open' && card){
        if(isProgressLocked(card)){
          showProgressNotice(card);
          return;
        }
        const link = document.getElementById('portalEditorUrl').value.trim() || getResourceLink(card);
        if(link) window.open(link, '_blank', 'noopener,noreferrer');
      }
      if(action === 'reader' && card){
        if(isProgressLocked(card)){
          showProgressNotice(card);
          return;
        }
        const title = resourceTitle(card);
        const reader = document.getElementById('portalEditorReaderUrl').value.trim() || document.getElementById('portalEditorUrl').value.trim();
        if(reader) openReaderPage(title, reader);
      }
      if(action === 'clear-thumb' && card){
        if(isLocked()){
          showLockNotice();
          closeResourceEditor();
          return;
        }
        clearResourceValue(card, resourceKeys().thumb);
        document.getElementById('portalEditorThumbUrl').value = '';
        paintEditorThumb('');
        renderResourceChrome(card);
      }
    });
    overlay.querySelector('#portalEditorThumbUrl').addEventListener('input', function(){
      paintEditorThumb(this.value.trim());
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && overlay.classList.contains('open')) closeResourceEditor();
    });
    return overlay;
  }

  function paintEditorThumb(src){
    const thumb = document.getElementById('portalEditorThumb');
    if(!thumb) return;
    thumb.classList.toggle('has-image', !!src);
    thumb.style.backgroundImage = src ? 'url("' + src + '")' : '';
    thumb.textContent = src ? '' : '📘';
  }

  function openResourceEditor(card){
    if(isLocked()){
      showLockNotice();
      return;
    }
    const overlay = ensureResourceEditor();
    const title = resourceTitle(card);
    const meta = getCourseMeta()[keyFor(card)] || {};
    overlay._resourceCard = card;
    document.getElementById('portalEditorTitle').textContent = 'Edit resource';
    document.getElementById('portalEditorName').textContent = title;
    document.getElementById('portalEditorUrl').value = getResourceLink(card);
    document.getElementById('portalEditorReaderUrl').value = getResourceAppLink(card);
    document.getElementById('portalEditorThumbUrl').value = getResourceThumb(card);
    document.getElementById('portalEditorStatus').value = card.dataset.filterStatus || meta.status || 'Not started';
    document.getElementById('portalEditorPriority').value = card.dataset.filterPriority || meta.priority || 'Companion';
    document.querySelectorAll('[data-editor-course-meta]').forEach(function(el){
      el.style.display = location.pathname.endsWith('courses.html') ? 'grid' : 'none';
    });
    document.getElementById('portalEditorStatusText').textContent = '';
    paintEditorThumb(getResourceThumb(card));
    overlay.classList.add('open');
  }

  function closeResourceEditor(){
    const overlay = document.getElementById('portalResourceEditor');
    if(overlay) overlay.classList.remove('open');
  }

  function saveResourceEditor(card){
    if(isLocked()){
      showLockNotice();
      return;
    }
    const keys = resourceKeys();
    const url = document.getElementById('portalEditorUrl').value.trim();
    const reader = document.getElementById('portalEditorReaderUrl').value.trim();
    const thumb = document.getElementById('portalEditorThumbUrl').value.trim();
    const status = document.getElementById('portalEditorStatus').value;
    const priority = document.getElementById('portalEditorPriority').value;
    if(url) setResourceValue(card, keys.link, url); else clearResourceValue(card, keys.link);
    if(reader) setResourceValue(card, keys.app, reader); else clearResourceValue(card, keys.app);
    if(thumb) setResourceValue(card, keys.thumb, thumb); else clearResourceValue(card, keys.thumb);
    if(location.pathname.endsWith('courses.html')){
      updateCourseMeta(card, {status:status, priority:priority});
      card.dataset.filterStatus = status;
      card.dataset.filterPriority = priority;
      const statusSelect = card.querySelector('[data-course-meta="status"]');
      const prioritySelect = card.querySelector('[data-course-meta="priority"]');
      if(statusSelect) statusSelect.value = status;
      if(prioritySelect) prioritySelect.value = priority;
      applyCourseFilters();
    }
    renderResourceChrome(card);
    document.getElementById('portalEditorStatusText').textContent = 'Saved.';
  }

  function currentPage(){
    return location.pathname.split('/').pop() || 'index.html';
  }

  function activeNavFor(href){
    const page = currentPage();
    if(href === 'index.html') return page === 'index.html' || page === '';
    if(href === 'courses.html') return /^(courses|ai|linux|python|devops|cloud|tracks|reader)\.html$/.test(page);
    if(href === 'career.html') return page === 'career.html';
    return page === href;
  }

  function addSettingsNav(){
    const items = [
      {href:'index.html', icon:'🏠', label:'Home'},
      {href:'courses.html', icon:'📚', label:'Courses'},
      {href:'playbook.html', icon:'📘', label:'Playbook'},
      {href:'career.html', icon:'🎯', label:'Hub'},
      {href:'settings.html', icon:'⚙️', label:'Settings'}
    ];
    const bnavInner = document.querySelector('.bnav-inner');
    if(bnavInner){
      bnavInner.innerHTML = items.map(function(item){
        return '<a class="ni' + (activeNavFor(item.href) ? ' active' : '') + '" href="' + item.href + '"><span>' + item.icon + '</span><span class="ni-lbl">' + item.label + '</span></a>';
      }).join('');
    }
    const bottom = document.querySelector('.bottom-nav');
    if(bottom){
      bottom.innerHTML = items.map(function(item){
        return '<a class="' + (activeNavFor(item.href) ? 'active' : '') + '" href="' + item.href + '"><span>' + item.icon + '</span><span>' + item.label + '</span></a>';
      }).join('');
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
    if(text.indexOf('execution') >= 0 || text.indexOf('recommended order') >= 0) return 'Execution';
    if(text.indexOf('parked') >= 0 || text.indexOf('not now') >= 0 || text.indexOf('irrelevant') >= 0) return 'Parked';
    if(text.indexOf('ai') >= 0 || text.indexOf('claude') >= 0) return 'AI';
    if(text.indexOf('python') >= 0) return 'Python';
    if(text.indexOf('linux') >= 0) return 'Linux';
    if(text.indexOf('devops') >= 0) return 'DevOps';
    if(text.indexOf('cloud') >= 0 || text.indexOf('aws') >= 0 || text.indexOf('azure') >= 0) return 'Cloud';
    return 'Other';
  }

  function inferCourseType(card){
    if(card.dataset.type) return card.dataset.type;
    const title = resourceTitle(card);
    const link = getResourceLink(card);
    const text = (title + ' ' + link).toLowerCase();
    if(text.indexOf('docs') >= 0 || text.indexOf('documentation') >= 0 || text.indexOf('modelcontextprotocol.io') >= 0 || text.indexOf('pulumi.com/learn') >= 0) return 'Docs';
    if(/book|bible|handbook|guide|cookbook|introduction|reference|packtpub|manning|oreilly|wiley|amazon\.com/.test(text)) return 'Book';
    return 'Course';
  }

  function inferPriority(card, type, index){
    if(card.dataset.priority) return card.dataset.priority;
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
    const track = card.dataset.track || (section && section.dataset.track) || normalizeTrack(heading ? heading.textContent : '');
    const type = inferCourseType(card);
    const defaults = {
      track:track,
      type:type,
      status:card.dataset.status || 'Not started',
      priority:inferPriority(card, type, index)
    };
    const meta = courseMetaFor(card, defaults);
    card.dataset.filterTrack = card.dataset.track || (section && section.dataset.track) || meta.track || track;
    card.dataset.filterType = card.dataset.type || meta.type || type;
    card.dataset.filterStatus = card.dataset.status || meta.status || 'Not started';
    card.dataset.filterPriority = card.dataset.priority || meta.priority || defaults.priority;

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
      if(isLocked()){
        showLockNotice();
        e.preventDefault();
        applyCourseFilters();
        return;
      }
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
      applyProgressLocks();
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
    const libraryNote = document.querySelector('.library-note');
    if(libraryNote) libraryNote.classList.toggle('course-section-hidden', filters.track === 'Execution');
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
    panel.innerHTML = '<div class="course-filter-top"><strong>Filter resources</strong><span id="courseFilterCount">0 shown</span></div><div class="course-filter-grid"><label>Track<select data-course-filter="track"><option>All</option><option>Execution</option><option>AI</option><option>Python</option><option>Linux</option><option>DevOps</option><option>Cloud</option><option>Parked</option></select></label><label>Type<select data-course-filter="type"><option>All</option><option>Course</option><option>Book</option><option>Docs</option></select></label><label>Status<select data-course-filter="status"><option>All</option><option>Not started</option><option>Active</option><option>Done</option><option>Later</option></select></label><label>Priority<select data-course-filter="priority"><option>All</option><option>Primary</option><option>Companion</option><option>Reference</option></select></label><button type="button" id="courseFilterReset">Reset</button></div>';
    hero.insertAdjacentElement('afterend', panel);
    document.querySelectorAll('.stack-card').forEach(function(section){
      section.querySelectorAll('.stack-item').forEach(function(card, index){
        decorateCourseFilterMeta(card, index);
      });
    });
    panel.addEventListener('change', applyCourseFilters);
    const trackSelect = panel.querySelector('[data-course-filter="track"]');
    if(trackSelect) trackSelect.value = 'Execution';
    document.getElementById('courseFilterReset').addEventListener('click', function(){
      panel.querySelectorAll('select').forEach(function(select){ select.value = 'All'; });
      if(trackSelect) trackSelect.value = 'Execution';
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
    isLocked:isLocked,
    setLocked:setLocked,
    keys:{webhook:WEBHOOK_KEY, notionTarget:NOTION_TARGET_KEY}
  };

  function addStyles(){
    if(document.getElementById('portalProductStyles')) return;
    const style = document.createElement('style');
    style.id = 'portalProductStyles';
    style.textContent = '.portal-resource-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.portal-resource-actions button{border:1px solid rgba(15,23,42,.1);background:#fff;color:#312e81;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;cursor:pointer}.portal-resource-actions button:hover{border-color:#7c3aed}.portal-editor-overlay{position:fixed;inset:0;background:rgba(8,12,20,.62);backdrop-filter:blur(8px);z-index:10000;display:none;align-items:center;justify-content:center;padding:16px}.portal-editor-overlay.open{display:flex}.portal-editor{width:min(620px,100%);max-height:90vh;overflow:auto;background:#fff;color:#0f172a;border-radius:20px;padding:16px;box-shadow:0 24px 80px rgba(0,0,0,.32)}.portal-editor-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px}.portal-editor-head strong{display:block;font-size:18px}.portal-editor-head span{display:block;font-size:12px;color:#64748b;margin-top:2px}.portal-editor-head button,.portal-editor-actions button{border:0;border-radius:12px;padding:10px 12px;font-weight:900;cursor:pointer}.portal-editor-preview{display:grid;grid-template-columns:76px 1fr;gap:12px;align-items:center;padding:12px;background:#f1f5f9;border-radius:16px;margin-bottom:14px}.portal-editor-thumb{width:76px;height:76px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,#dbeafe,#c7d2fe);font-size:28px;background-size:cover;background-position:center}.portal-editor-thumb.has-image{color:transparent}.portal-editor-name{font-weight:900;line-height:1.25}.portal-editor-note{font-size:12px;color:#64748b;margin-top:4px;line-height:1.4}.portal-editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.portal-editor-grid label{display:grid;gap:5px;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#64748b}.portal-editor-grid input,.portal-editor-grid select{width:100%;border:1px solid #d9deea;border-radius:12px;padding:11px 12px;font-size:13px;font-weight:700}.portal-editor-grid label:nth-child(1),.portal-editor-grid label:nth-child(2),.portal-editor-grid label:nth-child(3){grid-column:1 / -1}.portal-editor-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.portal-editor-actions .primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}.portal-editor-status{min-height:20px;margin-top:8px;font-size:13px;font-weight:800;color:#64748b}.bottom-nav{grid-template-columns:repeat(5,minmax(0,1fr)) !important}.bottom-nav a{display:flex !important;flex-direction:column;align-items:center;justify-content:center;gap:3px}.bottom-nav a span:first-child{font-size:16px}.bottom-nav a span:last-child{font-size:11px}.bnav-inner{min-width:0 !important;width:100% !important}.ni{min-width:0 !important;flex:1}.course-filter-panel{background:var(--card,#fff);border:1px solid var(--line,rgba(15,23,42,.12));border-radius:20px;padding:14px 16px;box-shadow:var(--shadow,0 10px 30px rgba(15,23,42,.08));margin:-4px 0 16px}.course-filter-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.course-filter-top strong{font-size:15px}.course-filter-top span{font-size:12px;font-weight:800;color:var(--muted,#64748b)}.course-filter-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:end}.course-filter-grid label,.course-meta-controls label{display:grid;gap:5px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#64748b)}.course-filter-grid select,.course-meta-controls select{width:100%;border:1px solid var(--line,rgba(15,23,42,.12));border-radius:12px;background:#fff;color:var(--text,#0f172a);padding:9px 10px;font-size:12px;font-weight:800;text-transform:none;letter-spacing:0}.course-filter-grid button{border:0;border-radius:12px;background:linear-gradient(135deg,var(--accent,#ec4899),var(--accent2,#7c3aed));color:#fff;padding:10px 12px;font-size:12px;font-weight:900;cursor:pointer}.course-meta-controls{grid-column:1 / -1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.course-filter-hidden,.course-section-hidden{display:none !important}@media(max-width:760px){.portal-editor-grid{grid-template-columns:1fr}.course-filter-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.course-filter-grid button{grid-column:1 / -1}.course-meta-controls{grid-template-columns:1fr}}';
    document.head.appendChild(style);
  }

  function addLockStyles(){
    if(document.getElementById('portalLockStyles')) return;
    const style = document.createElement('style');
    style.id = 'portalLockStyles';
    style.textContent = '.portal-lock-toggle{border:1px solid rgba(15,23,42,.12);background:#0f172a;color:#fff;border-radius:999px;padding:10px 13px;font-size:12px;font-weight:900;box-shadow:0 12px 30px rgba(15,23,42,.18);cursor:pointer;white-space:nowrap}.portal-lock-toggle.in-header{min-height:40px;box-shadow:none;background:linear-gradient(135deg,#0f172a,#312e81)}.portal-lock-toggle.floating{position:fixed;right:14px;top:14px;z-index:10001}.portal-unlocked .portal-lock-toggle{background:linear-gradient(135deg,#16a34a,#0f766e);color:#fff}.portal-locked .portal-resource-actions [data-portal-action="quick-edit"],.portal-locked .portal-resource-actions [data-portal-action="cover"],.portal-locked .course-meta-controls{display:none!important}.portal-locked .portal-resource-actions::after{content:"edit locked";display:inline-flex;align-items:center;border:1px solid rgba(15,23,42,.1);background:#f8fafc;color:#64748b;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900}.portal-locked .ctx-menu button[data-action="edit"],.portal-locked .ctx-menu button[data-action="set-app-link"],.portal-locked .ctx-menu button[data-action="thumb-url"],.portal-locked .ctx-menu button[data-action="clear-thumb"]{display:none}.portal-progress-locked{opacity:.58;filter:grayscale(.15)}.portal-progress-locked .thumb{background:linear-gradient(135deg,#e5e7eb,#cbd5e1)!important}.portal-progress-locked .portal-resource-actions [data-portal-action="open"],.portal-progress-locked .portal-resource-actions [data-portal-action="reader"]{opacity:.45}.portal-progress-done{outline:2px solid rgba(34,197,94,.22);outline-offset:2px}.portal-progress-badge{position:absolute;top:10px;left:10px;font-size:10px;font-weight:900;text-transform:uppercase;border:1px solid rgba(15,23,42,.1);border-radius:999px;background:#fff;color:#64748b;padding:4px 8px;z-index:2}.portal-progress-done .portal-progress-badge{background:#dcfce7;color:#166534;border-color:#bbf7d0}.portal-progress-locked .portal-progress-badge{background:#f1f5f9;color:#64748b}.course-topic-list{grid-column:1/-1;margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.62);border:1px solid rgba(15,23,42,.08)}.course-topic-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#7c3aed;margin-bottom:6px}.course-topic{font-size:12px;line-height:1.45;color:#475569;font-weight:700;margin-top:3px}.parked-toggle{margin-left:auto;border:1px solid rgba(15,23,42,.12);background:#0f172a;color:#fff;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:900;cursor:pointer}.stack-card[data-track="Parked"].parked-collapsed .stack-row{display:none}.stack-card[data-track="Parked"].parked-collapsed{padding-bottom:12px}.portal-lock-toast{position:fixed;left:50%;top:72px;transform:translate(-50%,-8px);z-index:10002;max-width:min(520px,calc(100vw - 24px));background:#0f172a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:12px 14px;box-shadow:0 18px 50px rgba(2,6,23,.32);font-size:13px;font-weight:800;line-height:1.35;opacity:0;transition:opacity .18s ease,transform .18s ease}.portal-lock-toast.show{opacity:1;transform:translate(-50%,0)}@media(max-width:700px){.portal-lock-toggle.floating{top:auto;right:12px;bottom:92px}.portal-lock-toast{top:14px;font-size:12px}}';
    document.head.appendChild(style);
  }


  function addEnhancedStyles(){
    if(document.getElementById('portalEnhancedStyles')) return;
    const s = document.createElement('style');
    s.id = 'portalEnhancedStyles';
    s.textContent = [
      'html{scroll-behavior:smooth}',
      'body{-webkit-font-smoothing:antialiased;padding-bottom:96px!important}',
      '*{box-sizing:border-box}',
      /* nav pill shell */
      '.bottom-nav,.bnav{position:fixed!important;bottom:12px!important;left:50%!important;transform:translateX(-50%)!important;width:calc(100% - 24px)!important;max-width:480px!important;background:rgba(255,255,255,.96)!important;backdrop-filter:blur(28px) saturate(200%)!important;-webkit-backdrop-filter:blur(28px) saturate(200%)!important;border:1.5px solid rgba(255,255,255,.80)!important;border-radius:26px!important;box-shadow:0 4px 6px rgba(15,23,42,.04),0 12px 32px rgba(15,23,42,.10),0 32px 60px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,1)!important;padding:6px!important;z-index:9999!important;overflow:visible!important}',
      'body.dark .bottom-nav,body.dark .bnav{background:rgba(10,14,26,.94)!important;border-color:rgba(255,255,255,.08)!important;box-shadow:0 12px 40px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.05)!important}',
      /* bottom-nav: 4-col grid */
      '.bottom-nav{display:grid!important;grid-template-columns:repeat(5,1fr)!important;gap:4px!important}',
      '.bottom-nav a{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;padding:10px 6px!important;border-radius:20px!important;text-decoration:none!important;color:#94a3b8!important;font-weight:700!important;min-height:56px!important;transition:background .16s ease,color .16s ease,transform .14s ease,box-shadow .16s ease!important}',
      '.bottom-nav a:active{transform:scale(.94)!important}',
      '.bottom-nav a.active{background:linear-gradient(145deg,#4f46e5,#7c3aed)!important;color:#fff!important;box-shadow:0 6px 18px rgba(79,70,229,.38),inset 0 1px 0 rgba(255,255,255,.18)!important}',
      '.bottom-nav a span:first-child{font-size:20px!important;line-height:1!important;display:block!important}',
      '.bottom-nav a span:last-child{font-size:10px!important;font-weight:900!important;letter-spacing:.4px!important;text-transform:uppercase!important}',
      'body.dark .bottom-nav a{color:#475569!important}',
      'body.dark .bottom-nav a.active{color:#fff!important}',
      /* bnav */
      '.bnav-inner{display:flex!important;gap:4px!important;min-width:0!important;width:100%!important}',
      '.ni{flex:1!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:4px!important;padding:10px 6px!important;min-height:56px!important;border-radius:20px!important;text-decoration:none!important;color:#94a3b8!important;font-weight:700!important;transition:background .16s ease,color .16s ease,transform .14s ease,box-shadow .16s ease!important}',
      '.ni:active{transform:scale(.94)!important}',
      '.ni>span:first-child{font-size:20px!important;line-height:1!important;display:block!important;background:transparent!important;border-radius:0!important;width:auto!important;height:auto!important}',
      '.ni-lbl{font-size:10px!important;font-weight:900!important;letter-spacing:.4px!important;text-transform:uppercase!important}',
      '.ni.active{background:linear-gradient(145deg,#4f46e5,#7c3aed)!important;color:#fff!important;box-shadow:0 6px 18px rgba(79,70,229,.38),inset 0 1px 0 rgba(255,255,255,.18)!important}',
      '.ni.active .ni-lbl{color:#fff!important}',
      'body.dark .ni{color:#475569!important}',
      'body.dark .ni.active{color:#fff!important}',
      /* cards */
      '.card,.ql,.exec-card,.sk-card,.stack-card,.path-step,.heatmap-wrap,.prog-overview{border-radius:18px!important;transition:transform .18s ease,box-shadow .18s ease!important}',
      '.card:hover,.ql:hover,.path-step:hover{transform:translateY(-3px)!important;box-shadow:0 20px 50px rgba(15,23,42,.12)!important}',
      '.exec-card:hover,.sk-card:hover{transform:translateY(-2px)!important}',
      '.course,.book,.resource,.lib-item{cursor:pointer;transition:background .15s ease,transform .15s ease,box-shadow .15s ease!important}',
      '.course:hover,.book:hover,.resource:hover{transform:translateY(-2px)!important;box-shadow:0 10px 28px rgba(15,23,42,.09)!important}',
      '.lib-item:hover{background:rgba(79,70,229,.05)!important;transform:translateX(4px)!important}',
      /* lib sections */
      '.lib-section{background:#fff!important;border:1px solid rgba(15,23,42,.07)!important;border-radius:18px!important;margin-bottom:10px!important;overflow:hidden!important;box-shadow:0 2px 8px rgba(15,23,42,.04)!important}',
      'body.dark .lib-section{background:#0f1623!important;border-color:rgba(255,255,255,.06)!important}',
      '.lib-section-head{padding:14px 16px!important;display:flex!important;justify-content:space-between!important;align-items:center!important;cursor:pointer;user-select:none;transition:background .15s ease!important}',
      '.lib-section-head:hover{background:rgba(79,70,229,.04)!important}',
      '.lib-section:not(.expanded) .lib-section-head{border-bottom:none!important}',
      '.lib-section.expanded .lib-section-head{border-bottom:1px solid rgba(15,23,42,.07)!important}',
      '.lib-section.expanded .lib-body{padding:8px 10px!important}',
      '.lib-toggle{border:none!important;background:rgba(79,70,229,.09)!important;color:#4f46e5!important;border-radius:999px!important;padding:5px 14px!important;font-size:11px!important;font-weight:900!important;letter-spacing:.3px!important;cursor:pointer!important;transition:background .15s ease,transform .12s ease!important}',
      '.lib-toggle:hover{background:rgba(79,70,229,.18)!important;transform:scale(1.04)!important}',
      /* track chips */
      '.track-chip{border-radius:999px!important;padding:8px 16px!important;font-size:12px!important;font-weight:800!important;transition:all .16s ease!important;cursor:pointer}',
      '.track-chip:hover{border-color:#7c3aed!important;color:#7c3aed!important;transform:translateY(-1px)!important}',
      '.track-chip.active{background:linear-gradient(135deg,#4f46e5,#7c3aed)!important;color:#fff!important;border-color:transparent!important;box-shadow:0 4px 14px rgba(79,70,229,.32)!important}',
      /* hero shimmer */
      '.hero,.focus-wrap,.goal-banner{position:relative!important;overflow:hidden!important}',
      '.hero::after,.focus-wrap::after{content:""!important;position:absolute!important;inset:0!important;background:radial-gradient(circle at 85% 15%,rgba(255,255,255,.20) 0%,transparent 55%)!important;pointer-events:none!important}',
      /* streak gradient text */
      '.sk-num{background:linear-gradient(135deg,#4f46e5,#7c3aed)!important;-webkit-background-clip:text!important;-webkit-text-fill-color:transparent!important;background-clip:text!important}',
      /* quick links */
      '.ql-title{font-size:16px!important;font-weight:800!important;letter-spacing:-.01em!important}',
      '.ql-sub{font-size:13px!important;line-height:1.5!important;margin-top:5px!important}',
      /* buttons */
      '.focus-btn,.hdr-btn{transition:transform .14s ease,box-shadow .14s ease!important}',
      '.focus-btn:hover,.hdr-btn:hover{transform:translateY(-1px)!important}',
      '.focus-btn:active,.hdr-btn:active{transform:scale(.96)!important}',
      /* queue + stepper */
      '.queue-item{transition:background .15s ease,transform .15s ease!important}',
      '.queue-item:hover{transform:translateX(3px)!important}',
      '.current-card{box-shadow:0 0 0 2px rgba(79,70,229,.30),0 8px 24px rgba(79,70,229,.12)!important}',
      '.s-dot.active{box-shadow:0 0 0 3px rgba(79,70,229,.25)!important}',
      /* heatmap */
      '.hm-cell{border-radius:4px!important;transition:transform .12s ease!important}',
      '.hm-cell:hover{transform:scale(1.4)!important}',
      /* scrollbar */
      '::-webkit-scrollbar{width:4px;height:4px}',
      '::-webkit-scrollbar-track{background:transparent}',
      '::-webkit-scrollbar-thumb{background:rgba(15,23,42,.14);border-radius:99px}',
      'body.dark ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.10)}',
      /* focus ring */
      ':focus-visible{outline:2.5px solid #4f46e5!important;outline-offset:3px!important;border-radius:8px!important}',
      /* desktop: keep pill centered, reasonable width */
      '@media(min-width:600px){.bottom-nav,.bnav{max-width:380px!important;border-radius:28px!important}}'
    ].join('');
    document.head.appendChild(s);
  }


  // Apply dark/light theme from localStorage on every page
  function applyGlobalTheme(){
    const t = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark', t === 'dark');
  }

  document.addEventListener('DOMContentLoaded', function(){
    applyGlobalTheme();
    addStyles();
    addLockStyles();
    addEnhancedStyles();
    ensureLockToggle();
    applyLockMode();
    addSettingsNav();
    addCourseTopics();
    initParkedCollapse()
    addResourceActions();
    initCourseFilters();
    applyProgressLocks();
    initSettingsPage();
  });

})();
