(function(){
  const STORAGE = {
    progress: 'jlp_progress',
    streak: 'jlp_streak',
    coachMin: 'jlp_coach_minimized'
  };

  function gp(){
    try { return JSON.parse(localStorage.getItem(STORAGE.progress) || '{}'); }
    catch(e){ return {}; }
  }

  function us(){
    const t = new Date().toDateString();
    let d;
    try { d = JSON.parse(localStorage.getItem(STORAGE.streak) || '{}'); }
    catch(e){ d = {}; }

    if(d.last === t) return;

    const y = new Date(Date.now() - 86400000).toDateString();
    d.count = d.last === y ? (d.count || 0) + 1 : 1;
    d.last = t;
    localStorage.setItem(STORAGE.streak, JSON.stringify(d));
  }

  function gs(){
    try { return JSON.parse(localStorage.getItem(STORAGE.streak) || '{}').count || 0; }
    catch(e){ return 0; }
  }

  function coach(){
    const total = Object.keys(gp()).length;
    if(total === 0) return 'Start with one focused checkpoint today.';
    if(total < 3) return 'Good start. Stay consistent and finish one module.';
    if(total < 10) return 'Momentum is building. Keep shipping small wins.';
    return 'Strong pace. Protect depth and avoid random switching.';
  }

  function next(){
    const cs = document.querySelectorAll('.course[data-id], .course');
    for(const c of cs){
      if(!c.dataset.id) continue;
      if(!gp()[c.dataset.id]){
        const t = (c.querySelector('strong') ? c.querySelector('strong').innerText : c.innerText).trim();
        return t || 'Continue your current track.';
      }
    }
    return 'Review your active track and choose the next checkpoint.';
  }

  function min(){
    return localStorage.getItem(STORAGE.coachMin) !== '0';
  }

  function setm(v){
    localStorage.setItem(STORAGE.coachMin, v ? '1' : '0');
  }

  function renderCoach(){
    const p = document.getElementById('eliteCoachDock');
    if(!p) return;

    p.className = min() ? 'coach-dock minimized' : 'coach-dock';
    p.innerHTML = `<div class="coach-head"><div><div class="coach-kicker">AI Coach</div><div class="coach-title">Execution guidance</div></div><button type="button" class="coach-toggle">${min() ? '＋' : '—'}</button></div><div class="coach-body"><div class="coach-line"><strong>Coach:</strong> <span>${coach()}</span></div><div class="coach-grid"><div class="coach-stat"><span>Streak</span><strong>${gs()} day${gs()===1?'':'s'}</strong></div><div class="coach-stat"><span>Progress</span><strong>${Object.keys(gp()).length}</strong></div></div><div class="coach-next"><span>Next action</span><strong>${next()}</strong></div></div>`;

    p.querySelector('.coach-toggle').addEventListener('click', function(){
      const nm = !p.classList.contains('minimized');
      p.classList.toggle('minimized', nm);
      setm(nm);
      this.textContent = nm ? '＋' : '—';
    });
  }

  window.resetStudyData = function(){
    [
      STORAGE.progress,
      STORAGE.streak,
      STORAGE.coachMin,
      'python_links_v1','python_thumbs_v1',
      'linux_links_v1','linux_thumbs_v1',
      'devops_links_v1','devops_thumbs_v1',
      'cloud_links_v1','cloud_thumbs_v1',
      'ai_links_v1','ai_thumbs_v1',
      'courses_links_v1','courses_thumbs_v1'
    ].forEach(key => localStorage.removeItem(key));

    renderCoach();
    location.reload();
  };

  window.compressThumbnailForLocalStorage = function(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const maxSide = 240;
          let { width, height } = img;
          const scale = Math.min(1, maxSide / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.82;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > 180000 && quality > 0.45) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(dataUrl);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    us();

    if(!/(^|\/)(index\.html)?$/.test(location.pathname) &&
       !location.pathname.endsWith('/portal/') &&
       !location.pathname.endsWith('/portal')) return;

    const p = document.createElement('div');
    p.id = 'eliteCoachDock';
    document.body.appendChild(p);

    const s = document.createElement('style');
    s.textContent = `.coach-dock{position:fixed;right:16px;bottom:16px;z-index:9999;width:300px;max-width:calc(100vw - 24px);background:linear-gradient(180deg,#0f172a,#111827);color:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(2,6,23,.35);overflow:hidden;border:1px solid rgba(255,255,255,.08)}.coach-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:linear-gradient(135deg,#4f46e5,#2563eb)}.coach-kicker{font-size:11px;font-weight:800;opacity:.9}.coach-title{font-size:13px;font-weight:700}.coach-toggle{border:0;background:rgba(255,255,255,.18);color:#fff;width:30px;height:30px;border-radius:10px;font-size:18px;line-height:1;cursor:pointer}.coach-body{padding:12px 14px}.coach-line{font-size:12px;line-height:1.45;color:#e5e7eb}.coach-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.coach-stat{background:rgba(255,255,255,.06);border-radius:12px;padding:10px 12px}.coach-stat span,.coach-next span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#cbd5e1}.coach-stat strong{display:block;font-size:16px;margin-top:2px}.coach-next{margin-top:10px;background:rgba(255,255,255,.06);border-radius:12px;padding:10px 12px}.coach-next strong{display:block;margin-top:4px;font-size:13px;line-height:1.35}.coach-dock.minimized{width:180px}.coach-dock.minimized .coach-body{display:none}@media (max-width:700px){.coach-dock{left:12px;right:12px;bottom:12px;width:auto;max-width:none}.coach-dock.minimized{left:auto;right:12px;width:164px}.coach-head{padding:10px 12px}.coach-title{font-size:12px}}`;
    document.head.appendChild(s);

    renderCoach();
  });
})();