(function(){
function localDateStr(d){d=d||new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function getJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch(e){return fallback;}}
function setJSON(key,val){localStorage.setItem(key,JSON.stringify(val));}
function getSD(){const s=getJSON('streakData',{}); s.days=s.days||{}; s.sessions=s.sessions||[]; s.totalMins=Number(s.totalMins||0); s.current=Number(s.current||0); s.best=Number(s.best||0); s.lastStudy=s.lastStudy||''; s.manualDays=s.manualDays||{}; return s;}
function setSD(s){setJSON('streakData',s);}
function recalc(s){
  const DAY=86400000;
  const keys = Array.from(new Set(Object.keys(s.days).filter(k=>s.days[k]>0).concat(Object.keys(s.manualDays||{}).filter(k=>s.manualDays[k])))).sort();
  let best=0,chain=0,prev=null;
  keys.forEach(k=>{const d=new Date(k+'T00:00:00'); chain=prev&&d-prev===DAY?chain+1:1; best=Math.max(best,chain); prev=d;});
  let cur=0; const today=localDateStr();
  if((s.days[today]&&s.days[today]>0) || (s.manualDays&&s.manualDays[today])){
    cur=1; let d=new Date(today+'T00:00:00');
    while(true){d=new Date(d.getTime()-DAY); const k=localDateStr(d); if((s.days[k]&&s.days[k]>0) || (s.manualDays&&s.manualDays[k])) cur+=1; else break;}
    s.lastStudy=today;
  }
  s.current=cur; s.best=Math.max(best,cur); return s;
}
window.logStudyMinutes=function(mins,topic){
  mins=Number(mins||25);
  const s=getSD(); const today=localDateStr();
  s.days[today]=(s.days[today]||0)+mins;
  s.totalMins+=mins;
  s.sessions.push({date:today,mins:mins,topic:topic||'',ts:Date.now(),source:'timer'});
  recalc(s); setSD(s);
  if(window.refreshHomeWidgets) window.refreshHomeWidgets();
};
window.markStudyActivity=function(){
  const s=getSD(); const today=localDateStr();
  if(s.manualDays[today]) return false;
  s.manualDays[today]=true;
  if(!s.sessions.some(x=>x.date===today && x.source==='manual')){
    s.sessions.push({date:today,mins:0,topic:'Manual activity check-in',ts:Date.now(),source:'manual'});
  }
  recalc(s); setSD(s);
  if(window.refreshHomeWidgets) window.refreshHomeWidgets();
  return true;
};
window.resetStudyData=function(){
  localStorage.removeItem('streakData');
  localStorage.removeItem('lastHeatmapLog');
  if(window.refreshHomeWidgets) window.refreshHomeWidgets();
};

function ensureTimer(){
  if(document.getElementById('coreTimerOverlay')) return;
  const style=document.createElement('style');
  style.textContent='.core-timer-fab{position:fixed;right:18px;bottom:88px;width:56px;height:56px;border:0;border-radius:999px;background:linear-gradient(135deg,#2647c8,#6a5cff);color:#fff;font-size:22px;box-shadow:0 10px 30px rgba(38,71,200,.35);z-index:9990;cursor:pointer}.core-timer-overlay{position:fixed;inset:0;background:rgba(8,12,20,.58);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;z-index:10000;padding:16px}.core-timer-overlay.open{display:flex}.core-timer-card{width:min(92vw,420px);background:#fff;color:#0f172a;border-radius:24px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.32)}.core-timer-k{font-size:.62rem;text-transform:uppercase;letter-spacing:1.3px;color:#64748b;font-weight:800;margin-bottom:8px}.core-timer-topic{font-size:1rem;font-weight:800;margin-bottom:10px}.core-timer-time{font-size:2.8rem;font-weight:900;letter-spacing:-.04em;text-align:center;margin:12px 0 16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.core-timer-row{display:flex;gap:10px;flex-wrap:wrap}.core-timer-btn{flex:1;min-width:110px;border:0;border-radius:14px;padding:12px 14px;font-weight:800;cursor:pointer}.core-timer-btn.primary{background:linear-gradient(135deg,#2647c8,#6a5cff);color:#fff}.core-timer-btn.secondary{background:#eef2ff;color:#223}.core-timer-note{text-align:center;color:#64748b;margin-top:12px;font-size:.74rem}';
  document.head.appendChild(style);
  const fab=document.createElement('button'); fab.className='core-timer-fab'; fab.type='button'; fab.title='Open timer'; fab.textContent='⏱';
  const overlay=document.createElement('div'); overlay.className='core-timer-overlay'; overlay.id='coreTimerOverlay';
  overlay.innerHTML='<div class="core-timer-card"><div class="core-timer-k">Focus Session</div><div class="core-timer-topic" id="coreTimerTopic">Study Session</div><div class="core-timer-time" id="coreTimerTime">25:00</div><div class="core-timer-row"><button class="core-timer-btn primary" id="coreTimerStart">Start</button><button class="core-timer-btn secondary" id="coreTimerReset">Reset</button><button class="core-timer-btn secondary" id="coreTimerClose">Close</button></div><div class="core-timer-note" id="coreTimerNote">Timer completion is what adds real study time.</div></div>';
  document.body.appendChild(fab); document.body.appendChild(overlay);
  const T={mins:25,left:1500,id:null,running:false,task:'Study Session'};
  function draw(){const m=Math.floor(T.left/60),s=T.left%60; document.getElementById('coreTimerTime').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); document.getElementById('coreTimerTopic').textContent=T.task;}
  function stop(){if(T.id) clearInterval(T.id); T.id=null; T.running=false; document.getElementById('coreTimerStart').textContent='Start';}
  function startPause(){if(T.running) return stop(); T.running=true; document.getElementById('coreTimerStart').textContent='Pause'; T.id=setInterval(function(){T.left-=1; draw(); if(T.left<=0){stop(); window.logStudyMinutes(T.mins,T.task); document.getElementById('coreTimerNote').textContent='✓ Timer completed and real study time logged'; T.left=T.mins*60; draw(); setTimeout(function(){document.getElementById('coreTimerNote').textContent='Timer completion is what adds real study time.';},1800);}},1000);}
  window.openTimer=function(task,mins){T.task=task||'Study Session'; T.mins=mins||25; T.left=T.mins*60; draw(); overlay.classList.add('open');};
  fab.onclick=function(){window.openTimer(document.body.getAttribute('data-today-topic')||'Study Session',25);};
  document.getElementById('coreTimerStart').onclick=startPause;
  document.getElementById('coreTimerReset').onclick=function(){stop(); T.left=T.mins*60; draw();};
  document.getElementById('coreTimerClose').onclick=function(){stop(); overlay.classList.remove('open');};
  overlay.addEventListener('click',function(e){if(e.target===overlay){stop(); overlay.classList.remove('open');}});
}

function trackPct(key,keys){const s=getJSON(key,{}); return keys.length?Math.round(keys.filter(k=>s[k]).length/keys.length*100):0;}
function aiPct(){
  const modSnap=getJSON('ai_module_snapshot', null);
  if(modSnap){
    const vals=Object.values(modSnap);
    if(vals.length) return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  }
  const stores={m1Progress:['py-main','py1a','py1b','py1c','py1d','py1e','py1f','py1g','py1h','py-proj1','py-proj2'],m2Progress:['p2a','p2b','p2c','p2d','p2e','p2f','m2s1','m2s2','m2s3','m2s4','m2s5','m2s6','m2s7','m2s8','m2p1','m2p2','m2p3'],m3Progress:['p4a','p4b','p4c','p4d','m3s1','m3s2','m3s3','m3s4','m3s5','m3s6','m3s7','m3s8','m3p1'],m4Progress:['p1b','p1c','p1d','p3a','p3b','p3c','m4s1','m4s2','m4s3','m4s4','m4s5','m4s6','m4s7','m4s8','m4p1','m4p2'],m5Progress:['p5a','p5b','p5c','p5d','p5e','m5s1','m5s2','m5s3','m5s4','m5s5','m5s6','m5s7','m5s8','m5s9','m5p1'],m6Progress:['p6a','p6b','p6c','m6s1','m6s2','m6s3','m6p1','m6p2','m6p3']}; let done=0,total=0; Object.keys(stores).forEach(k=>{const s=getJSON(k,{}),keys=stores[k]; done+=keys.filter(x=>s[x]).length; total+=keys.length;}); return total?Math.round(done/total*100):0;
}
function computeProgress(){const trackKeys={claude:['c1','c2','c3','c4','c5'],linux:['l1a','l1b','l1c','l1d','l2a','l2b','l2c','l2d','l3a','l3b','l3c','l3d','l4a','l4b','l4c','l4d','l5a','l5b','l5c','l6a','l6b','l6c','l6d'],python:['py1a','py1b','py1c','py1d','py1e','py2a','py2b','py2c','py2d','py2e','py3a','py3b','py3c','py3d','py3e','py4a','py4b','py4c','py4d'],cloud:['a-clf1','a-clf2','a-clf3','a-clf4','a-clf5','a-clf6','a-saa1','a-saa2','a-saa3','a-saa4','a-saa5','a-saa6','a-saa7','a-saa8','a-ans1','a-ans2','a-ans3','a-ans4','a-ans5','a-ans6','a-ans7','a-ans8','a-ans9','a-sap1','a-sap2','a-sap3','a-sap4','a-sap5','a-sap6']}; return {claude:trackPct('claudeSprint_Mar2026',trackKeys.claude),linux:trackPct('rhcsaProgress',trackKeys.linux),python:trackPct('pythonProgress',trackKeys.python),ai:aiPct(),cloud:trackPct('cloudProgress',trackKeys.cloud)};}
function pickSmartSession(goal,s,progress){const candidates=[]; if(goal.upcoming&&goal.upcoming[0]) candidates.push({score:100,phase:'Playbook Priority',title:goal.upcoming[0],sub:'Pulled from your next unfinished milestone so your daily session matches your actual plan.',href:'playbook.html'});
  const aiSnap=getJSON('ai_module_snapshot', null);
  if(aiSnap){
    const modules=[
      {k:'m0',phase:'M0 Claude',title:'Claude workflow base',sub:'Advance your Claude execution layer.',href:'ai.html'},
      {k:'m1',phase:'M1 LLMs',title:'Prompting + LLM intuition',sub:'Strengthen prompt discipline and model intuition.',href:'ai.html'},
      {k:'m2',phase:'M2 Core',title:'AI engineering core',sub:'Push your main AI bootcamp and companion reading.',href:'ai.html'},
      {k:'m3',phase:'M3 RAG',title:'RAG + production thinking',sub:'Build retrieval, evaluation, and architecture depth.',href:'ai.html'},
      {k:'m4',phase:'M4 Agents',title:'Agents + MCP',sub:'Ship agent workflows and MCP capability.',href:'ai.html'}
    ];
    modules.sort((a,b)=>(aiSnap[a.k]||0)-(aiSnap[b.k]||0));
    if(modules.length) candidates.push({score:92,phase:modules[0].phase,title:modules[0].title,sub:modules[0].sub,href:modules[0].href});
  } const tracks=[{pct:progress.linux,phase:'Linux',title:'Linux RHCSA push',sub:'Commands, permissions, shell, or RHCSA drills.',href:'linux.html'},{pct:progress.python,phase:'Python',title:'Python core practice',sub:'Automation momentum and AI engineering prep.',href:'python.html'},{pct:progress.ai,phase:'AI',title:'AI roadmap focus',sub:'Prompting, LLM fundamentals, retrieval, or evaluation.',href:'ai.html'},{pct:progress.claude,phase:'Claude',title:'Claude workflow session',sub:'Prompting, MCP, tool use, and Claude workflows.',href:'claude.html'},{pct:progress.cloud,phase:'Cloud',title:'Cloud networking block',sub:'Cloud foundations, AWS/Azure, or networking.',href:'cloud.html'}].sort((a,b)=>a.pct-b.pct); tracks.forEach((t,idx)=>{let score=60-idx*5; if(t.pct===0) score+=15; if(t.pct<20) score+=10; candidates.push({score:score,phase:t.phase,title:t.title,sub:t.sub,href:t.href});}); const buildSnap=getJSON('build_mode_snapshot', null);
  if(buildSnap){
    const buildChoices=[
      {id:'p1',phase:'Build Mode',title:'Work on Logistics + Car Sales Copilot',sub:'Advance shipment tracking, documents, and customer updates.',href:'playbook.html'},
      {id:'p2',phase:'Build Mode',title:'Work on SoftTouch Repair + Parts Intelligence',sub:'Move the manuals / parts intelligence assistant forward.',href:'playbook.html'},
      {id:'p3',phase:'Build Mode',title:'Work on Malaria Consortium Ops Intelligence',sub:'Prepare the professional ops-intelligence concept and workflow.',href:'playbook.html'}
    ].sort((a,b)=>(buildSnap[a.id]||0)-(buildSnap[b.id]||0));
    if(buildChoices.length) candidates.push({score:90,phase:buildChoices[0].phase,title:buildChoices[0].title,sub:buildChoices[0].sub,href:buildChoices[0].href});
  }
  if((s.current||0)<3) candidates.push({score:88,phase:'Streak Protection',title:'Quick win to protect your streak',sub:'Take a shorter, easier session today so momentum stays alive.',href:tracks[0]?tracks[0].href:'index.html'}); return candidates.sort((a,b)=>b.score-a.score)[0]||{phase:'Focus Session',title:'Study Session',sub:'Pick one meaningful block and move it forward.',href:'index.html'};}
window.refreshHomeWidgets=function(){
  const s=getSD(); const goal=getJSON('goals_snapshot',{}); const today=localDateStr(); const progress=computeProgress();
  const gb=document.getElementById('goalBanner'); if(gb){gb.style.display='flex'; document.getElementById('gbMonth').textContent=goal.month||'This Month'; document.getElementById('gbTitle').textContent=goal.total?(goal.done+' of '+goal.total+' milestones complete'):'No goals set yet'; document.getElementById('gbSub').textContent=goal.upcoming&&goal.upcoming[0]?('Next: '+goal.upcoming[0]):'Tap to set your monthly milestones →'; document.getElementById('gbPct').textContent=goal.total?(goal.pct+'%'):'-'; document.getElementById('gbFill').style.width=(goal.pct||0)+'%';}
  var cur=document.getElementById('skCurrent'),best=document.getElementById('skBest'),hours=document.getElementById('skHours'); if(cur)cur.textContent=s.current||0; if(best)best.textContent=s.best||0; if(hours){const m=s.totalMins||0; hours.textContent=m<60?(m+'m'):(Math.floor(m/60)+'h'+(m%60?(m%60+'m'):''));}
  const smart=pickSmartSession(goal,s,progress);
  try{
    const resourceFocus = JSON.parse(localStorage.getItem('resource_focus_map_v1')||'{}');
    const focusToHref = {python:'python.html', linux:'linux.html', cloud:'cloud.html', claude:'claude.html', ai:'ai.html'};
    Object.keys(focusToHref).forEach(function(track){
      if(resourceFocus[track] && smart.href===focusToHref[track]){
        smart.title = resourceFocus[track].title;
        smart.sub = 'Active '+resourceFocus[track].kind+' focus selected from your library.';
      }
    });
  }catch(e){} document.body.setAttribute('data-today-topic',smart.title); var ph=document.getElementById('focusPhase'),ti=document.getElementById('focusTitle'),su=document.getElementById('focusSub'),btn=document.getElementById('focusStartBtn'),resetBtn=document.getElementById('resetStudyBtn'),studied=document.getElementById('focusStudied'); if(ph)ph.textContent=smart.phase; if(ti)ti.textContent=smart.title; if(su)su.textContent=smart.sub; if(btn)btn.onclick=function(e){e.preventDefault(); e.stopPropagation(); window.openTimer(smart.title,25);}; if(resetBtn)resetBtn.onclick=function(e){e.preventDefault(); if(confirm('Reset study time, streak, heatmap, and achievement state?')) window.resetStudyData();}; if(studied)studied.style.display=((s.days[today]&&s.days[today]>0) || (s.manualDays&&s.manualDays[today]))?'inline-flex':'none';
  ['claude','linux','python','ai','cloud'].forEach(id=>{const bar=document.getElementById('pb-'+id),lbl=document.getElementById('pp-'+id); if(bar)bar.style.width=progress[id]+'%'; if(lbl)lbl.textContent=progress[id]+'%';});
  const overall=Math.round((progress.claude+progress.linux+progress.python+progress.ai+progress.cloud)/5); const overallEl=document.getElementById('overallPct'); if(overallEl)overallEl.textContent=overall+'% overall';
  const hm=document.getElementById('hmGrid'); if(hm){hm.innerHTML=''; const vals=Object.values(s.days).filter(v=>v>0),max=vals.length?Math.max.apply(null,vals):1; const todayDate=new Date(); todayDate.setHours(0,0,0,0); const cells=[]; for(let i=111;i>=0;i--){const d=new Date(todayDate); d.setDate(d.getDate()-i); cells.push({k:localDateStr(d),today:i===0});} for(let j=0;j<cells.length;j+=7){const col=document.createElement('div'); col.className='hm-col'; cells.slice(j,j+7).forEach(c=>{const cell=document.createElement('div'); const v=s.days[c.k]||0; const active=((s.manualDays&&s.manualDays[c.k]) || v>0); const lvl=!active?'':v===0?'l1':v/max<.25?'l1':v/max<.5?'l2':v/max<.75?'l3':'l4'; cell.className='hm-cell'+(lvl?' '+lvl:'')+(c.today?' today':''); cell.title=c.today?'Today — tap to mark activity':(c.k+(v?' · '+Math.round(v)+'min':((s.manualDays&&s.manualDays[c.k])?' · activity marked':''))); if(c.today){cell.onclick=function(){window.markStudyActivity();};} col.appendChild(cell);}); hm.appendChild(col);}}
  const ach=document.getElementById('achievementsCard'); if(ach){const timerSessions=(s.sessions||[]).filter(x=>x.source==='timer'); const buildSnap=getJSON('build_mode_snapshot', {}); const buildVals=Object.values(buildSnap||{}); const buildStarted=buildVals.some(v=>v>0); const buildHalf=buildVals.some(v=>v>=50); const buildDone=buildVals.some(v=>v>=100); const badges=[['First Session',timerSessions.length>=1],['Hour Builder',(s.totalMins||0)>=60 && timerSessions.length>=3],['3-Day Streak',(s.current||0)>=3],['7-Day Streak',(s.current||0)>=7],['First Project Started',buildStarted],['Project Momentum',buildHalf],['Project Shipped',buildDone],['Halfway There',overall>=50],['Claude Sprint',progress.claude>=100]]; ach.className='ach-card'; ach.innerHTML='<h3>Momentum looks better when it moves</h3><div class="ach-sub">Timer completion adds real study time. Heatmap taps only mark activity.</div><div class="ach-row">'+badges.map(b=>'<div class="ach-pill '+(b[1]?'on':'')+'">'+(b[1]?'✓ ':'• ')+b[0]+'</div>').join('')+'</div>';}
  const buildSnap=getJSON('build_mode_snapshot', null); const next=document.getElementById('nextActionsCard'); if(next){const actions=[]; if(goal.upcoming&&goal.upcoming[0]) actions.push({title:'Finish your next Playbook milestone',sub:goal.upcoming[0],href:'playbook.html'}); if(progress.python===0) actions.push({title:'Start Python core',sub:'Your Python track is still untouched',href:'python.html'}); if(progress.ai<20) actions.push({title:'Push the AI path forward',sub:'Build prompting and LLM fundamentals momentum',href:'ai.html'}); if(buildSnap){
      const builds=[
        {id:'p1',title:'Push Logistics + Car Sales Copilot',sub:'Keep your retrieval project moving this week.',href:'playbook.html'},
        {id:'p2',title:'Advance SoftTouch Repair + Parts Intelligence',sub:'Turn Python + network ops into an AI workflow.',href:'playbook.html'},
        {id:'p3',title:'Work on Malaria Consortium Ops Intelligence',sub:'Build a tool that reasons over logs and CLI text.',href:'playbook.html'}
      ].sort((a,b)=>(buildSnap[a.id]||0)-(buildSnap[b.id]||0));
      if(builds.length) actions.push(builds[0]);
    }
    if((s.current||0)<3) actions.push({title:'Protect your streak',sub:'A short focused session today keeps momentum alive.',href:'index.html'}); if(progress.cloud<15) actions.push({title:'Open Cloud and finish foundations',sub:'Start with cloud foundations and networking alignment.',href:'cloud.html'}); next.innerHTML='<div class="next-actions-list">'+(actions.slice(0,4).map((a,i)=>'<a class="next-act" href="'+a.href+'"><div class="next-num">'+(i+1)+'</div><div><strong>'+a.title+'</strong><span>'+a.sub+'</span></div></a>').join('')||'<div class="next-act"><div class="next-num">1</div><div><strong>Set your first milestone</strong><span>Use Playbook to define this month’s target.</span></div></div>')+'</div>';}
};
document.addEventListener('DOMContentLoaded',function(){ensureTimer(); if(window.refreshHomeWidgets) window.refreshHomeWidgets();});
})();