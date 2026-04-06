
(function(){
  const LINK_KEY = 'resource_custom_links_v2';

  function getLinks(){
    try { return JSON.parse(localStorage.getItem(LINK_KEY) || '{}'); }
    catch(e){ return {}; }
  }
  function saveLinks(data){
    localStorage.setItem(LINK_KEY, JSON.stringify(data));
  }
  function slugify(s){
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90);
  }
  function resourceTitle(card){
    const strong = card.querySelector('strong');
    return strong ? strong.textContent.trim() : (card.textContent || '').trim().split('\n')[0];
  }
  function resourceKey(card){
    if(!card.dataset.resourceKey){
      const page = (location.pathname.split('/').pop() || 'page').replace('.html','');
      card.dataset.resourceKey = page + '::' + slugify(resourceTitle(card));
    }
    return card.dataset.resourceKey;
  }
  function providerLink(title, kind){
    const q = encodeURIComponent(title);
    if(kind === 'course'){
      if (/\bFM\b|Frontend ?Masters/i.test(title)) return 'https://frontendmasters.com/courses/';
      if (/\bPLS\b|Plural ?Sight/i.test(title)) return 'https://www.pluralsight.com/browse';
      if (/Dometrain/i.test(title)) return 'https://dometrain.com/';
      if (/\bUD\b|Udemy/i.test(title)) return 'https://www.udemy.com/courses/search/?q=' + q;
      if (/Epic AI/i.test(title)) return 'https://www.epic-ai.app/';
      if (/MAVEN|Maven/i.test(title)) return 'https://maven.com/';
      if (/CBTNuggets/i.test(title)) return 'https://www.cbtnuggets.com/';
      if (/TalkPython|FastAPI/i.test(title)) return 'https://training.talkpython.fm/';
      if (/OrhanErgun/i.test(title)) return 'https://orhanergun.net/';
      if (/PEARSON|Pearson/i.test(title)) return 'https://www.pearsonitcertification.com/';
      if (/PIKUMA|Pikuma/i.test(title)) return 'https://pikuma.com/';
      if (/Red Hat|RHCSA|RHCE|Ansible/i.test(title)) return 'https://www.redhat.com/en/services/training-and-certification';
      if (/A Cloud Guru|ACG/i.test(title)) return 'https://www.pluralsight.com/cloud-guru';
      if (/ArjanCodes/i.test(title)) return 'https://www.arjancodes.com/';
      if (/ZTM|Zero ?To ?Mastery/i.test(title)) return 'https://zerotomastery.io/';
      return '';
    }
    if(kind === 'book'){
      if (/MANNING|Manning/i.test(title)) return 'https://www.manning.com/';
      if (/PEARSON|Pearson/i.test(title)) return 'https://www.pearson.com/';
      if (/PACKT|Packt/i.test(title)) return 'https://www.packtpub.com/';
      if (/O'?REILLY|Oreilly|OReilly/i.test(title)) return 'https://www.oreilly.com/';
      if (/Red Hat|RHCSA|RHCE/i.test(title)) return 'https://www.redhat.com/en/services/training-and-certification';
      return '';
    }
    return '';
  }
  function currentLink(card, kind){
    const links = getLinks();
    return links[resourceKey(card)] || providerLink(resourceTitle(card), kind) || '';
  }
  function decorateResourceCard(card, kind){
    if(card.dataset.linksReady === '1') return;
    card.dataset.linksReady = '1';
    card.classList.add('resource-card-enhanced');
    const key = resourceKey(card);
    const title = resourceTitle(card);
    const strong = card.querySelector('strong');
    if(strong && !strong.querySelector('a')){
      const a = document.createElement('a');
      a.className = 'resource-title-link';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = title;
      strong.textContent = '';
      strong.appendChild(a);
    }
    let tools = card.querySelector('.resource-link-tools');
    if(!tools){
      tools = document.createElement('div');
      tools.className = 'resource-link-tools';
      card.appendChild(tools);
    }

    function renderTools(){
      const link = currentLink(card, kind);
      const titleAnchor = card.querySelector('.resource-title-link');
      if(titleAnchor){
        if(link){
          titleAnchor.href = link;
          titleAnchor.removeAttribute('aria-disabled');
          titleAnchor.style.pointerEvents = 'auto';
          titleAnchor.style.opacity = '1';
        }else{
          titleAnchor.removeAttribute('href');
          titleAnchor.setAttribute('aria-disabled','true');
          titleAnchor.style.pointerEvents = 'none';
          titleAnchor.style.opacity = '.9';
        }
      }
      tools.innerHTML = '';
      if(link){
        const open = document.createElement('a');
        open.className = 'resource-link-btn';
        open.href = link;
        open.target = '_blank';
        open.rel = 'noopener noreferrer';
        open.textContent = 'Open link ↗';
        tools.appendChild(open);
      }
      const set = document.createElement('button');
      set.type = 'button';
      set.className = 'resource-link-btn';
      set.textContent = link ? 'Edit link' : 'Set link';
      set.onclick = function(){
        const val = prompt('Paste the exact external link for:\n' + title, link || 'https://');
        if(!val) return;
        const links = getLinks();
        links[key] = val.trim();
        saveLinks(links);
        renderTools();
      };
      tools.appendChild(set);

      if(link){
        const clear = document.createElement('button');
        clear.type = 'button';
        clear.className = 'resource-link-btn ghost';
        clear.textContent = 'Clear link';
        clear.onclick = function(){
          const links = getLinks();
          delete links[key];
          saveLinks(links);
          renderTools();
        };
        tools.appendChild(clear);
      }
    }

    renderTools();
  }

  function enhanceResources(){
    document.querySelectorAll('.course').forEach(card => decorateResourceCard(card, 'course'));
    document.querySelectorAll('.book').forEach(card => decorateResourceCard(card, 'book'));
  }

  function createStageProgress(step, idx){
    let box = step.querySelector('.stage-progress');
    if(!box){
      box = document.createElement('div');
      box.className = 'stage-progress';
      const anchor = step.querySelector('.step-sub') || step.firstElementChild;
      if(anchor && anchor.insertAdjacentElement){
        anchor.insertAdjacentElement('afterend', box);
      } else {
        step.prepend(box);
      }
    }
    return box;
  }

  function enhanceStages(){
    const steps = Array.from(document.querySelectorAll('.path-step'));
    if(!steps.length) return;

    let priorComplete = true;
    steps.forEach((step, idx) => {
      const checks = Array.from(step.querySelectorAll('input[type="checkbox"][data-id]'));
      const total = checks.length;
      const done = checks.filter(c => c.checked).length;
      const pct = total ? Math.round(done / total * 100) : 0;
      const complete = total > 0 && done === total;

      const code = step.getAttribute('data-code') || ('Stage ' + (idx + 1));
      const box = createStageProgress(step, idx);
      box.innerHTML = '<div class="stage-progress-top"><span>'+code+' progress</span><span>'+done+' / '+total+' · '+pct+'%</span></div><div class="stage-progress-bar"><div class="stage-progress-fill" style="width:'+pct+'%"></div></div>';

      const locked = !priorComplete && !complete;
      step.classList.toggle('locked-step', locked);
      checks.forEach(c => {
        c.disabled = locked;
      });
      priorComplete = priorComplete && complete;
    });
  }

  function addStyles(){
    if(document.getElementById('resourceStageEnhanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'resourceStageEnhanceStyles';
    style.textContent = `
      .resource-link-tools{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
      .resource-link-btn{border:0;border-radius:10px;padding:6px 10px;font-size:12px;font-weight:700;text-decoration:none;background:var(--bg3,#e8ecf4);color:var(--accent,#4f46e5);cursor:pointer}
      .resource-link-btn.ghost{background:transparent;border:1px solid var(--border2,rgba(15,23,42,.14));color:var(--text2,#475569)}
      .resource-title-link{color:inherit;text-decoration:none;border-bottom:1px dashed rgba(79,70,229,.35)}
      .resource-title-link:hover{color:var(--accent,#4f46e5)}
      .stage-progress{margin:10px 0 12px;padding:10px 12px;border-radius:12px;background:var(--bg3,#e8ecf4)}
      .stage-progress-top{display:flex;justify-content:space-between;gap:12px;font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text2,#475569)}
      .stage-progress-bar{height:10px;border-radius:999px;background:rgba(15,23,42,.08);overflow:hidden}
      .stage-progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#38bdf8,#4f46e5)}
      .locked-step{opacity:.62}
      .locked-step::after{content:'Complete the previous stage to unlock this one';display:block;margin-top:10px;font-size:12px;font-weight:700;color:#ef4444}

      .book-card-compact .resource-link-tools,.course-card-compact .resource-link-tools{display:none !important}
      .book-card-compact .resource-body,.course-card-compact .resource-body{display:flex;flex-direction:column;justify-content:center}
      .book-card-compact .book-rc-hint,.course-card-compact .book-rc-hint{margin-top:8px;font-size:.65rem;font-weight:700;color:var(--text3,#64748b)}
      .book-card-compact .resource-thumb,.course-card-compact .resource-thumb{margin-right:2px}
      .book-context-menu{position:fixed;z-index:9999;display:none;min-width:160px;background:#0f172a;color:#e2e8f0;border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 16px 40px rgba(0,0,0,.22);padding:6px}
      .book-context-menu.open{display:block}
      .book-context-menu button{display:block;width:100%;text-align:left;background:transparent;border:0;color:inherit;padding:10px 12px;border-radius:8px;font-size:.78rem;font-weight:700;cursor:pointer}
      .book-context-menu button:hover{background:rgba(255,255,255,.08)}
    `;
    document.head.appendChild(style);
  }

  function refreshEnhancements(){
    enhanceResources();
    enhanceStages();
  }


  function ensureBookContextMenu(){
    let menu = document.getElementById('bookContextMenu');
    if(menu) return menu;
    menu = document.createElement('div');
    menu.id = 'bookContextMenu';
    menu.className = 'book-context-menu';
    menu.innerHTML = '<button type="button" data-action="set">Set link</button><button type="button" data-action="edit">Edit link</button><button type="button" data-action="clear">Clear link</button>';
    document.body.appendChild(menu);

    let currentCard = null;
    function closeMenu(){
      menu.classList.remove('open');
      currentCard = null;
    }
    document.addEventListener('click', function(e){
      if(!menu.contains(e.target)) closeMenu();
    });
    document.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);

    menu.addEventListener('click', function(e){
      const btn = e.target.closest('button[data-action]');
      if(!btn || !currentCard) return;
      const action = btn.dataset.action;
      const key = resourceKey(currentCard);
      const title = resourceTitle(currentCard);
      const links = getLinks();
      const existing = links[key] || '';
      if(action === 'clear'){
        delete links[key];
        saveLinks(links);
      } else {
        const val = prompt((action === 'set' ? 'Paste the external link for:\n' : 'Edit external link for:\n') + title, existing || 'https://');
        if(!val) return closeMenu();
        links[key] = val.trim();
        saveLinks(links);
      }
      decorateBookCard(currentCard, true);
      closeMenu();
    });

    menu.openFor = function(card, x, y){
      currentCard = card;
      const links = getLinks();
      const hasLink = !!links[resourceKey(card)];
      menu.querySelector('[data-action="set"]').style.display = hasLink ? 'none' : 'block';
      menu.querySelector('[data-action="edit"]').style.display = hasLink ? 'block' : 'none';
      menu.querySelector('[data-action="clear"]').style.display = hasLink ? 'block' : 'none';
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      menu.classList.add('open');
    };
    return menu;
  }

  function decorateBookCard(card, rerender){
    if(card.dataset.bookCompact === '1' && !rerender) return;
    card.dataset.bookCompact = '1';
    card.classList.add('book-card-compact');
    const title = resourceTitle(card);
    const link = currentLink(card, 'book');

    // remove link toolbar for books
    const toolbar = card.querySelector('.resource-link-tools');
    if(toolbar) toolbar.remove();

    // make whole book card clickable
    card.style.cursor = link ? 'pointer' : 'default';
    card.onclick = function(e){
      if(e.target.closest('.resource-thumb')) return;
      const href = currentLink(card, 'book');
      if(href) window.open(href, '_blank', 'noopener');
    };

    // right click context menu
    card.oncontextmenu = function(e){
      e.preventDefault();
      ensureBookContextMenu().openFor(card, e.clientX, e.clientY);
    };

    // title anchor should go direct
    const a = card.querySelector('.resource-title-link');
    if(a){
      if(link){
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        a.removeAttribute('href');
      }
    }

    // compact helper text
    let hint = card.querySelector('.book-rc-hint');
    if(!hint){
      hint = document.createElement('div');
      hint.className = 'book-rc-hint';
      hint.textContent = 'Right-click for link options';
      const body = card.querySelector('.resource-body') || card;
      body.appendChild(hint);
    }
  }


  function decorateCourseCard(card, rerender){
    if(card.dataset.courseCompact === '1' && !rerender) return;
    card.dataset.courseCompact = '1';
    card.classList.add('course-card-compact');
    const link = currentLink(card, 'course');

    const toolbar = card.querySelector('.resource-link-tools');
    if(toolbar) toolbar.remove();

    card.style.cursor = link ? 'pointer' : 'default';
    card.onclick = function(e){
      if(e.target.closest('.resource-thumb')) return;
      const href = currentLink(card, 'course');
      if(href) window.open(href, '_blank', 'noopener');
    };

    card.oncontextmenu = function(e){
      e.preventDefault();
      ensureBookContextMenu().openFor(card, e.clientX, e.clientY);
    };

    const a = card.querySelector('.resource-title-link');
    if(a){
      if(link){
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      } else {
        a.removeAttribute('href');
      }
    }

    let hint = card.querySelector('.book-rc-hint');
    if(!hint){
      hint = document.createElement('div');
      hint.className = 'book-rc-hint';
      hint.textContent = 'Right-click for link options';
      const body = card.querySelector('.resource-body') || card;
      body.appendChild(hint);
    }
  }

  const _decorateResourceCard = decorateResourceCard;
  decorateResourceCard = function(card, kind){
    _decorateResourceCard(card, kind);
    if(kind === 'book'){
      decorateBookCard(card);
    }
    if(kind === 'course'){
      decorateCourseCard(card);
    }
  };

  document.addEventListener('DOMContentLoaded', function(){
    addStyles();
    refreshEnhancements();
    document.addEventListener('change', function(e){
      if(e.target && e.target.matches('input[type="checkbox"][data-id]')){
        setTimeout(refreshEnhancements, 0);
      }
    });
  });
})();
