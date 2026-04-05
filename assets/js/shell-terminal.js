
(function(){
  const URL_KEY = 'shell_backend_url_v1';
  const HISTORY_KEY = 'shell_history_v1';
  const DEFAULT_URL = 'http://127.0.0.1:8000';

  function getURL(){ return (localStorage.getItem(URL_KEY) || DEFAULT_URL).replace(/\/+$/,''); }
  function setURL(v){ localStorage.setItem(URL_KEY, (v || DEFAULT_URL).replace(/\/+$/,'')); }
  function getHistory(){ try { return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); } catch(e){ return []; } }
  function setHistory(v){ localStorage.setItem(HISTORY_KEY, JSON.stringify(v)); }

  async function health(url){
    const res = await fetch(url + '/health');
    if(!res.ok) throw new Error('health failed');
    return await res.json();
  }

  function renderHistory(card){
    const list = card.querySelector('.shell-history-list');
    if(!list) return;
    const history = getHistory().slice(-12).reverse();
    list.innerHTML = history.length ? history.map(item =>
      '<div class="shell-history-item"><strong>'+item.cmd+'</strong><span>'+item.when+'</span></div>'
    ).join('') : '<div class="note">No shell history yet.</div>';
  }

  function logHistory(cmd){
    const history = getHistory();
    history.push({cmd: cmd, when: new Date().toLocaleString()});
    setHistory(history.slice(-50));
  }

  function detectTopic(track, cmd){
    if(track === 'python') return 'Python shell';
    if(track === 'linux') return 'Linux shell';
    return 'Shell practice: ' + cmd;
  }

  async function execute(card){
    const input = card.querySelector('.shell-command');
    const output = card.querySelector('.shell-output');
    const status = card.querySelector('.shell-status');
    const urlField = card.querySelector('.shell-url');
    const url = (urlField && urlField.value.trim()) ? urlField.value.trim().replace(/\/+$/,'') : getURL();
    const cmd = input.value.trim();
    if(!cmd){
      output.textContent = 'Type a command first.';
      return;
    }
    output.textContent = 'Running...';
    status.textContent = 'Connecting...';
    try{
      const res = await fetch(url + '/run', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({cmd:cmd})
      });
      const data = await res.json();
      output.textContent = (data.output || '') + ((data.error && !data.output) ? data.error : '') || 'No output.';
      status.textContent = data.error ? 'Response received' : 'Command finished';
      logHistory(cmd);
      renderHistory(card);
      if(window.logStudyMinutes){
        const mins = Math.max(1, Math.ceil(Number(data.duration||1) / 60));
        window.logStudyMinutes(mins, detectTopic(card.dataset.shellTrack || 'general', cmd));
      }
    }catch(err){
      output.textContent = 'Backend not reachable.\nCheck that the shell backend is running and the URL is correct.';
      status.textContent = 'Offline';
    }
  }

  async function testConnection(card){
    const status = card.querySelector('.shell-status');
    const urlField = card.querySelector('.shell-url');
    const url = (urlField && urlField.value.trim()) ? urlField.value.trim().replace(/\/+$/,'') : getURL();
    try{
      const data = await health(url);
      status.textContent = 'Connected (' + data.platform + ')';
    }catch(err){
      status.textContent = 'Backend not reachable';
    }
  }

  function initCard(card){
    if(card.dataset.shellReady === '1') return;
    card.dataset.shellReady = '1';
    const urlField = card.querySelector('.shell-url');
    if(urlField) urlField.value = getURL();
    card.querySelectorAll('.shell-chip').forEach(btn => {
      btn.addEventListener('click', function(){
        const input = card.querySelector('.shell-command');
        const cmd = btn.dataset.cmd || '';
        if(input) input.value = cmd;
      });
    });
    const saveBtn = card.querySelector('[data-shell-action="save-url"]');
    if(saveBtn){
      saveBtn.addEventListener('click', function(){
        setURL(urlField.value.trim() || DEFAULT_URL);
        testConnection(card);
      });
    }
    const testBtn = card.querySelector('[data-shell-action="test-url"]');
    if(testBtn){
      testBtn.addEventListener('click', function(){ testConnection(card); });
    }
    const clearBtn = card.querySelector('[data-shell-action="clear-output"]');
    if(clearBtn){
      clearBtn.addEventListener('click', function(){
        const output = card.querySelector('.shell-output');
        if(output) output.textContent = '';
      });
    }
    const runBtn = card.querySelector('[data-shell-action="run"]');
    if(runBtn){
      runBtn.addEventListener('click', function(){ execute(card); });
    }
    const input = card.querySelector('.shell-command');
    if(input){
      input.addEventListener('keydown', function(e){
        if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
          e.preventDefault();
          execute(card);
        }
      });
    }
    renderHistory(card);
    testConnection(card);
  }

  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.shell-runner').forEach(initCard);
  });
})();
