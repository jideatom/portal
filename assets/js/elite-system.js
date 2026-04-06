(function(){
  const STORAGE = { progress:'jlp_progress', streak:'jlp_streak', weekly:'jlp_week_plan_v1', projectNotes:'jlp_project_notes_v1' };
  function getJSON(k,f){ try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(f)); }catch(e){ return f; } }
  function setJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
  function getProgress(){ return getJSON(STORAGE.progress, {}); }
  function syncProgressFromCheckboxes(){
    const p = getProgress();
    document.querySelectorAll('input[type="checkbox"][data-id]').forEach(cb => { p[cb.dataset.id] = !!cb.checked; });
    setJSON(STORAGE.progress, p);
    return p;
  }
  function updateStreak(){
    const today = new Date().toDateString();
    let data = getJSON(STORAGE.streak, {});
    if (data.last === today) return data;
    const yesterday = new Date(Date.now()-86400000).toDateString();
    data.count = data.last === yesterday ? (data.count||0)+1 : 1;
    data.best = Math.max(data.best||0, data.count);
    data.last = today;
    setJSON(STORAGE.streak, data);
    return data;
  }
  function getStreak(){ return getJSON(STORAGE.streak, {}).count || 0; }
  function weakestTrack(){
    const map = [
      ['Linux', document.getElementById('pp-linux')],
      ['Python', document.getElementById('pp-python')],
      ['AI', document.getElementById('pp-ai')],
      ['Cloud', document.getElementById('pp-cloud')]
    ].map(([name, el]) => [name, el ? parseInt((el.textContent||'0').replace(/\D/g,''),10)||0 : 0]);
    map.sort((a,b)=>a[1]-b[1]);
    return map[0][0];
  }
  function aiCoach(){
    const progress = syncProgressFromCheckboxes();
    const total = Object.values(progress).filter(Boolean).length;
    const weak = weakestTrack();
    if (total === 0) return 'Start with one small checkpoint today. Momentum first.';
    if (total < 8) return 'Stay consistent. Your weakest lane is ' + weak + '.';
    if (total < 20) return 'Good momentum. Push the current stage before adding more courses.';
    return 'You are compounding well. Focus on shipping output, not hoarding inputs.';
  }
  function nextAction(){
    const first = document.querySelector('input[type="checkbox"][data-id]:not(:checked)');
    if (!first) return 'All visible checkpoints complete. Move to the next stage or project phase.';
    const row = first.closest('label, .row, .chk, .proj-item') || first.parentElement;
    return (row ? row.textContent : first.dataset.id || 'Next checkpoint').trim().replace(/\s+/g,' ');
  }
  function getWeekPlan(){ return getJSON(STORAGE.weekly, {mon:'',tue:'',wed:'',thu:'',fri:'',sat:'',sun:''}); }
  function getProjectNotes(){ return getJSON(STORAGE.projectNotes, {}); }
  function injectCoach(){
    if (document.getElementById('eliteCoachDock')) return;
    const dock = document.createElement('aside');
    dock.id = 'eliteCoachDock';
    dock.innerHTML = '<div class="coach-head">AI Coach</div><div class="coach-copy" id="coachCopy"></div><div class="coach-stats"><div><strong>'+getStreak()+'</strong><span>day streak</span></div><div><strong>'+weakestTrack()+'</strong><span>weakest lane</span></div></div><div class="coach-next"><div class="coach-k">Next focus</div><div id="coachNext"></div></div>';
    document.body.appendChild(dock);
    const style = document.createElement('style');
    style.textContent = '#eliteCoachDock{position:fixed;left:18px;bottom:18px;width:245px;z-index:9999;background:linear-gradient(180deg,#4338ca,#0f172a);color:#fff;border-radius:14px;box-shadow:0 18px 40px rgba(15,23,42,.28);padding:12px 12px 10px}#eliteCoachDock .coach-head{font-weight:800;font-size:.9rem;margin-bottom:8px}#eliteCoachDock .coach-copy{font-size:.74rem;line-height:1.45;color:rgba(255,255,255,.92)}#eliteCoachDock .coach-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}#eliteCoachDock .coach-stats div{background:rgba(255,255,255,.08);border-radius:10px;padding:8px}#eliteCoachDock strong{display:block;font-size:.95rem}#eliteCoachDock span{font-size:.62rem;color:rgba(255,255,255,.78)}#eliteCoachDock .coach-next{background:rgba(255,255,255,.08);border-radius:10px;padding:8px}#eliteCoachDock .coach-k{font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.72);margin-bottom:5px} @media (max-width:800px){#eliteCoachDock{left:10px;bottom:78px;width:210px}}';
    document.head.appendChild(style);
    document.getElementById('coachCopy').textContent = aiCoach();
    document.getElementById('coachNext').textContent = nextAction();
  }
  function injectWeeklyEngine(){
    const host = document.getElementById('weeklyEngineHost'); if(!host) return;
    const plan = getWeekPlan();
    const days=[['mon','Mon'],['tue','Tue'],['wed','Wed'],['thu','Thu'],['fri','Fri'],['sat','Sat'],['sun','Sun']];
    host.innerHTML = '<div class="weekly-grid">'+days.map(([k,l])=>'<label class="week-cell"><span>'+l+'</span><input data-weekday="'+k+'" value="'+(plan[k]||'').replace(/"/g,'&quot;')+'" placeholder="Main task"></label>').join('')+'</div><div class="week-actions"><button type="button" id="saveWeekPlan">Save weekly plan</button><button type="button" id="clearWeekPlan">Clear</button></div>';
    const style = document.createElement('style');
    style.textContent = '.weekly-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px}.week-cell{display:flex;flex-direction:column;gap:6px;background:var(--bg3);padding:10px;border-radius:14px}.week-cell span{font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text2)}.week-cell input{border:1px solid var(--border2);background:var(--bg2);border-radius:10px;padding:10px;color:var(--text)}.week-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}.week-actions button{border:0;border-radius:12px;padding:10px 14px;font-weight:800;background:var(--bg3);color:var(--text)} @media (max-width:900px){.weekly-grid{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(style);
    host.querySelector('#saveWeekPlan').onclick = function(){ const next={}; host.querySelectorAll('input[data-weekday]').forEach(i=>next[i.dataset.weekday]=i.value.trim()); setJSON(STORAGE.weekly,next); };
    host.querySelector('#clearWeekPlan').onclick = function(){ setJSON(STORAGE.weekly,{mon:'',tue:'',wed:'',thu:'',fri:'',sat:'',sun:''}); injectWeeklyEngine(); };
  }
  function injectProjectIntelligence(){
    const host = document.getElementById('projectIntelHost'); if(!host) return;
    const snap = getJSON('build_mode_snapshot', {}); const notes = getProjectNotes();
    const projects = [['p1','Logistics + Car Sales Copilot'],['p2','SoftTouch Repair + Parts Intelligence'],['p3','Malaria Consortium Ops Intelligence']];
    host.innerHTML = projects.map(([id,title])=>{ const pct=snap[id]||0; const note=notes[id]||''; return '<article class="proj-intel"><div class="pi-top"><h3>'+title+'</h3><div class="pi-pct">'+pct+'%</div></div><div class="pi-bar"><div class="pi-fill" style="width:'+pct+'%"></div></div><textarea data-proj-note="'+id+'" placeholder="Next concrete move for this project...">'+note.replace(/</g,'&lt;')+'</textarea></article>'; }).join('') + '<div class="week-actions"><button type="button" id="saveProjNotes">Save project next moves</button></div>';
    const style = document.createElement('style');
    style.textContent = '.proj-intel{background:var(--bg3);border-radius:16px;padding:14px;margin-bottom:12px}.proj-intel .pi-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.proj-intel h3{margin:0;font-size:.95rem}.pi-pct{font-family:var(--mono);font-size:.7rem;color:var(--text2)}.pi-bar{height:10px;background:rgba(15,23,42,.08);border-radius:999px;overflow:hidden;margin:10px 0}.pi-fill{height:100%;background:linear-gradient(90deg,#22c55e,#4f46e5)}.proj-intel textarea{width:100%;min-height:74px;border-radius:12px;border:1px solid var(--border2);padding:12px;background:var(--bg2);color:var(--text)}';
    document.head.appendChild(style);
    host.querySelector('#saveProjNotes').onclick = function(){ const next={}; host.querySelectorAll('textarea[data-proj-note]').forEach(t=>next[t.dataset.projNote]=t.value.trim()); setJSON(STORAGE.projectNotes,next); };
  }
  document.addEventListener('DOMContentLoaded', function(){ updateStreak(); injectCoach(); injectWeeklyEngine(); injectProjectIntelligence(); });
})();