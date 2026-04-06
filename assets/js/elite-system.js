
(function(){
  const PLAN_KEY = 'weekly_plan_v1';
  const PROJECT_NOTES_KEY = 'project_notes_v1';

  function $(sel, root){ return (root || document).querySelector(sel); }
  function $$(sel, root){ return Array.from((root || document).querySelectorAll(sel)); }

  function getJSON(key, fallback){
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e){ return fallback; }
  }
  function setJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  function pageName(){
    const p = location.pathname.split('/').pop() || 'index.html';
    return p.replace('.html','');
  }

  function trackDisplay(track){
    return ({ai:'AI',python:'Python',linux:'Linux',cloud:'Cloud',claude:'Claude'}[track] || track);
  }

  function readStreak(){
    const s = getJSON('streakData', {current:0,best:0,totalMins:0,sessions:[]});
    return {
      current: Number(s.current || 0),
      best: Number(s.best || 0),
      totalMins: Number(s.totalMins || 0),
      sessions: Array.isArray(s.sessions) ? s.sessions : []
    };
  }

  function calcTrackStats(){
    const stats = {
      ai:{done:0,total:0},
      python:{done:0,total:0},
      linux:{done:0,total:0},
      cloud:{done:0,total:0},
      claude:{done:0,total:0}
    };

    const aiState = getJSON('ai_module_tracking_v1', {});
    stats.ai.done = Object.values(aiState).filter(Boolean).length;
    stats.ai.total = 16;

    const py = getJSON('pythonProgress', {});
    stats.python.done = Object.values(py).filter(Boolean).length;
    stats.python.total = 16;

    const lx = getJSON('rhcsaProgress', {});
    stats.linux.done = Object.values(lx).filter(Boolean).length;
    stats.linux.total = 12;

    const cl = getJSON('cloudProgress', {});
    stats.cloud.done = Object.values(cl).filter(Boolean).length;
    stats.cloud.total = 12;

    const cla = getJSON('claudeSprint_Mar2026', {});
    stats.claude.done = Object.values(cla).filter(Boolean).length;
    stats.claude.total = 12;

    Object.keys(stats).forEach(k=>{
      stats[k].pct = stats[k].total ? Math.round((stats[k].done/stats[k].total)*100) : 0;
    });
    return stats;
  }

  function weakestTrack(stats){
    return Object.entries(stats)
      .sort((a,b)=>a[1].pct-b[1].pct)[0]?.[0] || 'python';
  }

  function getFocusMap(){
    return getJSON('resource_focus_map_v2', {});
  }

  function getTodayPriority(){
    const stats = calcTrackStats();
    const weak = weakestTrack(stats);
    const focus = getFocusMap()[weak] || {};
    return {
      track: weak,
      primary: focus.primary?.title || '',
      companion: focus.companion?.title || '',
      book: focus.book?.title || '',
      pct: stats[weak].pct
    };
  }

  function coachMessage(){
    const streak = readStreak();
    const p = getTodayPriority();
    if(streak.current === 0) return 'Start with ' + trackDisplay(p.track) + '. A short win today is better than a perfect plan tomorrow.';
    if(streak.current < 3) return 'Keep the streak alive. Continue ' + (p.primary || trackDisplay(p.track) + ' core work') + '.';
    if(streak.current < 7) return 'Momentum is building. Stay on ' + trackDisplay(p.track) + ' until you clear the next checkpoint.';
    return 'Strong consistency. Push one real output in ' + trackDisplay(p.track) + ' today.';
  }

  function getWeekStart(d){
    const dt = new Date(d || Date.now());
    const day = dt.getDay(); // 0..6
    const diff = (day === 0 ? -6 : 1 - day);
    dt.setDate(dt.getDate() + diff);
    dt.setHours(0,0,0,0);
    return dt;
  }
  function dateKey(d){
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }
  function readPlan(){
    return getJSON(PLAN_KEY, {weekOf:'', days:{}});
  }
  function ensureCurrentWeekPlan(){
    const plan = readPlan();
    const weekOf = dateKey(getWeekStart());
    if(plan.weekOf !== weekOf){
      const fresh = {weekOf, days:{}};
      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => fresh.days[d] = plan.days?.[d] || '');
      setJSON(PLAN_KEY, fresh);
      return fresh;
    }
    return plan;
  }
  function nextPlanTask(plan){
    const order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    for(const d of order){
      if((plan.days[d] || '').trim()) return {day:d, text:plan.days[d].trim()};
    }
    return null;
  }

  function projectSnapshot(){
    return getJSON('build_mode_snapshot', {});
  }
  function nextProject(){
    const snap = projectSnapshot();
    const pairs = Object.entries(snap);
    if(!pairs.length) return null;
    pairs.sort((a,b)=>a[1]-b[1]);
    return {id:pairs[0][0], pct:pairs[0][1]};
  }

  function injectStyles(){
    if(document.getElementById('eliteSystemStyles')) return;
    const style = document.createElement('style');
    style.id = 'eliteSystemStyles';
    style.textContent = `
      .elite-dock{position:fixed;left:16px;bottom:92px;z-index:9992;width:min(320px,calc(100vw - 32px));background:rgba(15,23,42,.94);color:#e2e8f0;border:1px solid rgba(255,255,255,.08);border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.28);backdrop-filter:blur(10px);overflow:hidden}
      .elite-dock-hdr{padding:12px 14px;background:linear-gradient(135deg,#2647c8,#6a5cff);font-weight:800;font-size:.85rem}
      .elite-dock-bd{padding:12px 14px;display:grid;gap:10px}
      .elite-k{font-size:.58rem;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#93c5fd;font-family:var(--mono,monospace)}
      .elite-big{font-size:.92rem;font-weight:800;line-height:1.35}
      .elite-mini{font-size:.74rem;color:#cbd5e1;line-height:1.45}
      .elite-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .elite-pill{background:rgba(255,255,255,.06);border-radius:12px;padding:8px;text-align:center}
      .elite-pill strong{display:block;font-size:.95rem}
      .elite-pill span{display:block;font-size:.62rem;color:#cbd5e1;margin-top:2px}
      .elite-inline{display:flex;gap:8px;flex-wrap:wrap}
      .elite-btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:999px;padding:8px 12px;background:#e2e8f0;color:#0f172a;font-size:.72rem;font-weight:800;cursor:pointer;text-decoration:none}
      .elite-btn.ghost{background:rgba(255,255,255,.08);color:#e2e8f0}
      .elite-card{background:var(--bg2,#fff);border:1px solid var(--border,rgba(15,23,42,.08));border-radius:18px;padding:16px;box-shadow:var(--shadow,0 10px 30px rgba(15,23,42,.08));margin-bottom:14px}
      .elite-card h3{margin:0 0 10px;font-size:1rem}
      .elite-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .elite-day{background:var(--bg3,#e8ecf4);border-radius:14px;padding:10px}
      .elite-day label{display:block;font-size:.62rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;color:var(--text2,#475569)}
      .elite-day input{width:100%;border:1px solid var(--border2,rgba(15,23,42,.14));background:var(--bg2,#fff);border-radius:10px;padding:10px 12px;color:var(--text)}
      .elite-project-row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--border,rgba(15,23,42,.08))}
      .elite-project-row:last-child{border-bottom:none}
      .elite-bar{height:8px;border-radius:999px;background:rgba(15,23,42,.08);overflow:hidden;margin-top:6px}
      .elite-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#38bdf8,#4f46e5)}
      @media (max-width:760px){.elite-plan-grid{grid-template-columns:1fr}.elite-dock{left:12px;right:12px;width:auto}}
    `;
    document.head.appendChild(style);
  }

  function renderDock(){
    if(document.getElementById('eliteDock')) document.getElementById('eliteDock').remove();
    const streak = readStreak();
    const priority = getTodayPriority();
    const plan = ensureCurrentWeekPlan();
    const nextTask = nextPlanTask(plan);
    const project = nextProject();

    const dock = document.createElement('aside');
    dock.id = 'eliteDock';
    dock.className = 'elite-dock';
    dock.innerHTML = `
      <div class="elite-dock-hdr">AI Coach</div>
      <div class="elite-dock-bd">
        <div>
          <div class="elite-k">Coach guidance</div>
          <div class="elite-big">${coachMessage()}</div>
          <div class="elite-mini">${priority.primary ? 'Primary resource: ' + priority.primary : 'Next focus track: ' + trackDisplay(priority.track)}</div>
        </div>
        <div class="elite-grid">
          <div class="elite-pill"><strong>${streak.current}</strong><span>Streak</span></div>
          <div class="elite-pill"><strong>${streak.best}</strong><span>Best</span></div>
          <div class="elite-pill"><strong>${priority.pct}%</strong><span>${trackDisplay(priority.track)}</span></div>
        </div>
        <div>
          <div class="elite-k">This week</div>
          <div class="elite-mini">${nextTask ? nextTask.day + ': ' + nextTask.text : 'Set your weekly plan in Playbook.'}</div>
        </div>
        <div>
          <div class="elite-k">Project pulse</div>
          <div class="elite-mini">${project ? project.id.replace(/-/g,' ') + ' · ' + project.pct + '%' : 'Open Playbook to set project rhythm.'}</div>
        </div>
        <div class="elite-inline">
          <a class="elite-btn" href="playbook.html">Open Playbook</a>
          <a class="elite-btn ghost" href="${priority.track === 'ai' ? 'ai.html' : priority.track + '.html'}">Open ${trackDisplay(priority.track)}</a>
        </div>
      </div>
    `;
    document.body.appendChild(dock);
  }

  function insertHomeCard(){
    if(pageName() !== 'index') return;
    const wrap = $('.wrap');
    if(!wrap || $('#eliteHomeCard')) return;
    const priority = getTodayPriority();
    const plan = ensureCurrentWeekPlan();
    const nextTask = nextPlanTask(plan);
    const project = nextProject();
    const card = document.createElement('section');
    card.id = 'eliteHomeCard';
    card.className = 'elite-card';
    card.innerHTML = `
      <div class="section-title"><h2>Weekly Intelligence</h2><span>coach + planning</span></div>
      <div class="elite-k">Next study move</div>
      <div class="elite-big">${priority.primary || trackDisplay(priority.track) + ' focus block'}</div>
      <div class="elite-mini">${nextTask ? 'Weekly plan → ' + nextTask.day + ': ' + nextTask.text : 'No weekly plan yet. Add one in Playbook.'}</div>
      <div style="height:10px"></div>
      <div class="elite-k">Project to push</div>
      <div class="elite-mini">${project ? project.id.replace(/-/g,' ') + ' is your lowest progress project at ' + project.pct + '%' : 'No project snapshot yet.'}</div>
      <div class="elite-inline" style="margin-top:12px">
        <a class="elite-btn" href="playbook.html">Plan the week</a>
        <a class="elite-btn ghost" href="${priority.track === 'ai' ? 'ai.html' : priority.track + '.html'}">Continue ${trackDisplay(priority.track)}</a>
      </div>
    `;
    wrap.insertBefore(card, wrap.children[1] || null);
  }

  function insertPlaybookModules(){
    if(pageName() !== 'playbook') return;
    const wrap = $('.wrap');
    if(!wrap || $('#eliteWeeklyCard')) return;

    const plan = ensureCurrentWeekPlan();
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    const weekly = document.createElement('section');
    weekly.id = 'eliteWeeklyCard';
    weekly.className = 'elite-card';
    weekly.innerHTML = `
      <div class="sec-lbl">Weekly Engine</div>
      <h3>This week’s focused plan</h3>
      <div class="elite-plan-grid">
        ${days.map(d => `
          <div class="elite-day">
            <label>${d}</label>
            <input type="text" data-week-day="${d}" value="${(plan.days[d] || '').replace(/"/g,'&quot;')}" placeholder="One focused task">
          </div>
        `).join('')}
      </div>
      <div class="elite-inline" style="margin-top:12px">
        <button class="elite-btn" type="button" id="saveWeekPlan">Save weekly plan</button>
        <button class="elite-btn ghost" type="button" id="clearWeekPlan">Clear week</button>
      </div>
    `;

    const projectCard = document.createElement('section');
    projectCard.id = 'eliteProjectCard';
    projectCard.className = 'elite-card';
    const snap = projectSnapshot();
    const notes = getJSON(PROJECT_NOTES_KEY, {});
    const rows = Object.entries(snap);
    projectCard.innerHTML = `
      <div class="sec-lbl">Project Integration</div>
      <h3>Build mode pulse</h3>
      ${rows.length ? rows.map(([id,pct]) => `
        <div class="elite-project-row">
          <div style="flex:1">
            <strong style="display:block;margin-bottom:2px">${id.replace(/-/g,' ')}</strong>
            <div class="elite-mini">${pct}% complete</div>
            <div class="elite-bar"><div class="elite-fill" style="width:${pct}%"></div></div>
            <input type="text" data-project-note="${id}" value="${(notes[id] || '').replace(/"/g,'&quot;')}" placeholder="Next concrete move" style="width:100%;margin-top:8px;border:1px solid var(--border2,rgba(15,23,42,.14));background:var(--bg3,#e8ecf4);border-radius:10px;padding:10px 12px;color:var(--text)">
          </div>
        </div>
      `).join('') : `<div class="elite-mini">Project progress appears here after Build Mode items are checked.</div>`}
      <div class="elite-inline" style="margin-top:12px">
        <button class="elite-btn" type="button" id="saveProjectNotes">Save project notes</button>
      </div>
    `;

    wrap.insertBefore(projectCard, wrap.children[1] || null);
    wrap.insertBefore(weekly, wrap.children[1] || null);

    $('#saveWeekPlan').onclick = function(){
      const current = ensureCurrentWeekPlan();
      days.forEach(d => {
        current.days[d] = document.querySelector('[data-week-day="'+d+'"]').value.trim();
      });
      setJSON(PLAN_KEY, current);
      renderDock();
      alert('Weekly plan saved.');
    };
    $('#clearWeekPlan').onclick = function(){
      const current = ensureCurrentWeekPlan();
      days.forEach(d => current.days[d] = '');
      setJSON(PLAN_KEY, current);
      $$('.elite-day input').forEach(i => i.value = '');
      renderDock();
    };
    const saveProjectNotes = $('#saveProjectNotes');
    if(saveProjectNotes){
      saveProjectNotes.onclick = function(){
        const next = {};
        $$('[data-project-note]').forEach(i => next[i.dataset.projectNote] = i.value.trim());
        setJSON(PROJECT_NOTES_KEY, next);
        renderDock();
        alert('Project notes saved.');
      };
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    injectStyles();
    insertHomeCard();
    insertPlaybookModules();
    renderDock();
  });
})();
