
(function(){
  const STORAGE = {
    progress: "jlp_progress",
    streak: "jlp_streak",
    coachMin: "jlp_coach_minimized"
  };

  function getProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE.progress) || "{}"); }
    catch(e){ return {}; }
  }

  function updateStreak() {
    const today = new Date().toDateString();
    let data;
    try { data = JSON.parse(localStorage.getItem(STORAGE.streak) || "{}"); }
    catch(e){ data = {}; }

    if (data.last === today) return;

    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (data.last === yesterday) {
      data.count = (data.count || 0) + 1;
    } else {
      data.count = 1;
    }

    data.last = today;
    localStorage.setItem(STORAGE.streak, JSON.stringify(data));
  }

  function getStreak() {
    try { return JSON.parse(localStorage.getItem(STORAGE.streak) || "{}").count || 0; }
    catch(e){ return 0; }
  }

  function aiCoach() {
    const progress = getProgress();
    const total = Object.keys(progress).length;

    if (total === 0) return "Start with one focused checkpoint today.";
    if (total < 3) return "Good start. Stay consistent and finish one module.";
    if (total < 10) return "Momentum is building. Keep shipping small wins.";
    return "Strong pace. Protect depth and avoid random switching.";
  }

  function getNextAction() {
    const courses = document.querySelectorAll(".course[data-id], .course");
    for (let c of courses) {
      if (!c.dataset.id) continue;
      if (!getProgress()[c.dataset.id]) {
        const title = (c.querySelector('strong') ? c.querySelector('strong').innerText : c.innerText).trim();
        return title || "Continue your current track.";
      }
    }
    return "Review your active track and choose the next checkpoint.";
  }

  function isHomePage() {
    const path = location.pathname;
    return /(^|\/)(index\.html)?$/.test(path) || path.endsWith('/portal/') || path.endsWith('/portal');
  }

  function getMinimized() {
    return localStorage.getItem(STORAGE.coachMin) === '1';
  }

  function setMinimized(v) {
    localStorage.setItem(STORAGE.coachMin, v ? '1' : '0');
  }

  function injectElitePanel() {
    if (!isHomePage()) return;
    if (document.getElementById('eliteCoachDock')) return;

    const panel = document.createElement("div");
    panel.id = "eliteCoachDock";
    panel.className = getMinimized() ? "coach-dock minimized" : "coach-dock";
    panel.innerHTML = `
      <div class="coach-head">
        <div class="coach-title-wrap">
          <div class="coach-kicker">AI Coach</div>
          <div class="coach-title">Execution guidance</div>
        </div>
        <button type="button" class="coach-toggle" aria-label="Minimize AI Coach">${getMinimized() ? '＋' : '—'}</button>
      </div>
      <div class="coach-body">
        <div class="coach-line"><strong>Coach:</strong> <span>${aiCoach()}</span></div>
        <div class="coach-grid">
          <div class="coach-stat"><span>Streak</span><strong>${getStreak()}d</strong></div>
          <div class="coach-stat"><span>Progress</span><strong>${Object.keys(getProgress()).length}</strong></div>
        </div>
        <div class="coach-next">
          <span>Next action</span>
          <strong>${getNextAction()}</strong>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    const style = document.createElement('style');
    style.id = 'eliteCoachDockStyles';
    style.textContent = `
      .coach-dock{
        position:fixed;right:16px;bottom:16px;z-index:9999;width:300px;max-width:calc(100vw - 24px);
        background:linear-gradient(180deg,#0f172a,#111827);color:#fff;border-radius:16px;
        box-shadow:0 18px 50px rgba(2,6,23,.35);overflow:hidden;border:1px solid rgba(255,255,255,.08)
      }
      .coach-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:linear-gradient(135deg,#4f46e5,#2563eb)}
      .coach-kicker{font-size:11px;font-weight:800;opacity:.9}
      .coach-title{font-size:13px;font-weight:700}
      .coach-toggle{border:0;background:rgba(255,255,255,.18);color:#fff;width:30px;height:30px;border-radius:10px;font-size:18px;line-height:1;cursor:pointer}
      .coach-body{padding:12px 14px}
      .coach-line{font-size:12px;line-height:1.45;color:#e5e7eb}
      .coach-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      .coach-stat{background:rgba(255,255,255,.06);border-radius:12px;padding:10px 12px}
      .coach-stat span,.coach-next span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#cbd5e1}
      .coach-stat strong{display:block;font-size:16px;margin-top:2px}
      .coach-next{margin-top:10px;background:rgba(255,255,255,.06);border-radius:12px;padding:10px 12px}
      .coach-next strong{display:block;margin-top:4px;font-size:13px;line-height:1.35}
      .coach-dock.minimized{width:180px}
      .coach-dock.minimized .coach-body{display:none}
      @media (max-width: 700px){
        .coach-dock{left:12px;right:12px;bottom:12px;width:auto;max-width:none}
        .coach-dock.minimized{left:auto;right:12px;width:164px}
        .coach-head{padding:10px 12px}
        .coach-title{font-size:12px}
      }
    `;
    if (!document.getElementById(style.id)) document.head.appendChild(style);

    panel.querySelector('.coach-toggle').addEventListener('click', function(){
      const nextMin = !panel.classList.contains('minimized');
      panel.classList.toggle('minimized', nextMin);
      setMinimized(nextMin);
      this.textContent = nextMin ? '＋' : '—';
      this.setAttribute('aria-label', nextMin ? 'Expand AI Coach' : 'Minimize AI Coach');
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateStreak();
    injectElitePanel();
  });
})();
