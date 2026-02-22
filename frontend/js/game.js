// ===== MINI GAMES PAGE =====

function renderGame() {
  const c = document.getElementById('page-game');
  c.innerHTML = `
    <div style="max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:20px" class="animate">
        <div style="font-size:2.5rem">🎮</div>
        <h1 style="font-size:1.3rem;font-weight:800;margin:6px 0">Mini Games</h1>
        <p style="color:var(--text3);font-size:.85rem">Take a break, officer! You deserve it 😄</p>
      </div>

      <div style="display:flex;flex-direction:column;gap:14px">

        <div class="game-card animate animate-delay-1" onclick="startCoinTap()">
          <div class="game-card-icon">🪙</div>
          <div class="game-card-info">
            <div class="game-card-title">Fee Collector</div>
            <div class="game-card-desc">Tap the coins before they fall! How many can you collect?</div>
            <div class="game-card-score">Best: <strong id="best-coin">${localStorage.getItem('game_coin_best')||0}</strong> coins</div>
          </div>
          <div class="game-card-arrow">▶</div>
        </div>

        <div class="game-card animate animate-delay-2" onclick="startMemoryGame()">
          <div class="game-card-icon">🧠</div>
          <div class="game-card-info">
            <div class="game-card-title">Memory Match</div>
            <div class="game-card-desc">Match all emoji pairs as fast as you can!</div>
            <div class="game-card-score">Best: <strong id="best-mem">${localStorage.getItem('game_mem_best')||'—'}</strong></div>
          </div>
          <div class="game-card-arrow">▶</div>
        </div>

        <div class="game-card animate animate-delay-3" onclick="startReactionGame()">
          <div class="game-card-icon">⚡</div>
          <div class="game-card-info">
            <div class="game-card-title">Lightning Reflex</div>
            <div class="game-card-desc">Tap the moment you see green! Test your reaction time.</div>
            <div class="game-card-score">Best: <strong id="best-react">${localStorage.getItem('game_react_best')||'—'}</strong></div>
          </div>
          <div class="game-card-arrow">▶</div>
        </div>

      </div>
    </div>
  `;
}

// ========== GAME 1: FEE COLLECTOR ==========
function startCoinTap() {
  let score = 0, misses = 0, lives = 3, active = true, spawnTimer, speedMs = 1200;
  openModal('🪙 Fee Collector', `
    <div style="text-align:center;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:1rem;font-weight:700">Score: <span id="gc-score">0</span></div>
      <div id="gc-lives" style="font-size:1.2rem">❤️❤️❤️</div>
    </div>
    <div id="gc-arena" style="position:relative;width:100%;height:280px;background:var(--surface2);border-radius:14px;overflow:hidden;cursor:default;border:2px solid var(--border)">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;color:var(--text3);font-size:.85rem" id="gc-hint">Coins will fall — tap them! 🪙</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;justify-content:center">
      <button class="btn btn-primary" onclick="gcStart()" id="gc-start-btn">▶ Start</button>
      <button class="btn btn-outline" onclick="closeModal()">Quit</button>
    </div>`, 400);

  window.gcStart = function() {
    document.getElementById('gc-start-btn').style.display = 'none';
    document.getElementById('gc-hint').style.display = 'none';
    score = 0; misses = 0; lives = 3; active = true; speedMs = 1200;
    spawnCoin();
  };

  window.gcMiss = function(el) {
    if (!active) return;
    el.remove();
    lives--;
    const livesEl = document.getElementById('gc-lives');
    if (livesEl) livesEl.textContent = ['❤️','❤️','❤️'].slice(0,lives).join('') + ['🖤','🖤','🖤'].slice(0,3-lives).join('');
    if (lives <= 0) { active = false; clearTimeout(spawnTimer); gcEnd(); }
  };

  window.gcHit = function(el) {
    if (!active) return;
    score++;
    const scoreEl = document.getElementById('gc-score');
    if (scoreEl) scoreEl.textContent = score;
    // Speed up every 5 coins
    if (score % 5 === 0 && speedMs > 600) speedMs -= 80;
    // Floating +1
    const plus = document.createElement('div');
    plus.textContent = '+1 🪙';
    plus.style.cssText = `position:absolute;left:${el.style.left};top:${el.style.top};color:#f59e0b;font-weight:800;font-size:.85rem;pointer-events:none;animation:floatUp .6s ease forwards;z-index:10`;
    const arena = document.getElementById('gc-arena');
    if (arena) arena.appendChild(plus);
    setTimeout(() => plus.remove(), 600);
    el.remove();
  };

  function spawnCoin() {
    if (!active) return;
    const arena = document.getElementById('gc-arena');
    if (!arena) { active = false; return; }
    const coin = document.createElement('div');
    const left = 10 + Math.random() * 75;
    const emojis = ['🪙','💰','💵','💎'];
    const emoji = emojis[Math.floor(Math.random()*emojis.length)];
    const fallTime = speedMs + Math.random() * 400;
    coin.textContent = emoji;
    coin.style.cssText = `position:absolute;top:-40px;left:${left}%;font-size:1.8rem;cursor:pointer;transition:top ${fallTime}ms linear;user-select:none;z-index:5`;
    coin.onclick = function(e) { e.stopPropagation(); window.gcHit(coin); };
    arena.appendChild(coin);
    requestAnimationFrame(() => { requestAnimationFrame(() => { coin.style.top = '290px'; }); });
    setTimeout(() => { if (coin.parentNode) window.gcMiss(coin); }, fallTime + 100);
    spawnTimer = setTimeout(spawnCoin, 600 + Math.random() * 400);
  }

  function gcEnd() {
    const best = parseInt(localStorage.getItem('game_coin_best') || 0);
    if (score > best) localStorage.setItem('game_coin_best', score);
    const arena = document.getElementById('gc-arena');
    if (arena) arena.innerHTML = `
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center">
        <div style="font-size:2rem">💸</div>
        <div style="font-size:1.3rem;font-weight:800;margin:8px 0">Game Over!</div>
        <div style="font-size:.9rem;color:var(--text2)">You collected <strong>${score}</strong> coins!</div>
        ${score > best ? '<div style="color:#f59e0b;margin-top:6px;font-weight:700">🏆 New Best!</div>' : ''}
      </div>`;
    const startBtn = document.getElementById('gc-start-btn');
    if (startBtn) { startBtn.style.display = ''; startBtn.textContent = '🔄 Play Again'; }
    const bestEl = document.getElementById('best-coin');
    if (bestEl) bestEl.textContent = Math.max(score, best);
  }
}

// ========== GAME 2: MEMORY MATCH ==========
function startMemoryGame() {
  const emojis = ['📋','👥','💰','📢','✅','📊','🏫','⭐'];
  let cards = [...emojis,...emojis].sort(()=>Math.random()-.5).map((e,i)=>({id:i,emoji:e,flipped:false,matched:false}));
  let flipped=[], moves=0, startTime=null, timer=null;

  function render() {
    const c = document.getElementById('mm-grid');
    if (!c) return;
    c.innerHTML = cards.map(card=>`
      <div class="mm-card ${card.flipped||card.matched?'flipped':''} ${card.matched?'matched':''}"
           onclick="mmFlip(${card.id})" data-id="${card.id}">
        <div class="mm-front">?</div>
        <div class="mm-back">${card.emoji}</div>
      </div>`).join('');
  }

  openModal('🧠 Memory Match', `
    <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:.85rem">
      <span>Moves: <strong id="mm-moves">0</strong></span>
      <span>Time: <strong id="mm-time">0s</strong></span>
    </div>
    <div id="mm-grid" class="mm-grid"></div>
    <div style="text-align:center;margin-top:12px">
      <button class="btn btn-outline btn-sm" onclick="closeModal()">Quit</button>
    </div>`, 420);

  render();

  window.mmFlip = function(id) {
    const card = cards.find(c=>c.id===id);
    if (!card || card.flipped || card.matched || flipped.length===2) return;
    if (!startTime) {
      startTime = Date.now();
      timer = setInterval(()=>{
        const el = document.getElementById('mm-time');
        if (el) el.textContent = Math.floor((Date.now()-startTime)/1000)+'s';
      }, 500);
    }
    card.flipped = true;
    flipped.push(card);
    render();
    if (flipped.length === 2) {
      moves++;
      const mEl = document.getElementById('mm-moves');
      if (mEl) mEl.textContent = moves;
      if (flipped[0].emoji === flipped[1].emoji) {
        flipped.forEach(c=>c.matched=true);
        flipped=[];
        render();
        if (cards.every(c=>c.matched)) {
          clearInterval(timer);
          const elapsed = Math.floor((Date.now()-startTime)/1000);
          const best = localStorage.getItem('game_mem_best');
          const newBest = !best || elapsed < parseInt(best);
          if (newBest) localStorage.setItem('game_mem_best', elapsed);
          setTimeout(()=>{
            const grid = document.getElementById('mm-grid');
            if (grid) grid.innerHTML = `
              <div style="text-align:center;padding:30px">
                <div style="font-size:2rem">🏆</div>
                <div style="font-size:1.2rem;font-weight:800;margin:8px 0">You Win!</div>
                <div style="font-size:.9rem;color:var(--text2)">${moves} moves · ${elapsed}s</div>
                ${newBest?'<div style="color:#f59e0b;margin-top:6px;font-weight:700">🌟 New Best!</div>':''}
                <button class="btn btn-primary" style="margin-top:14px" onclick="startMemoryGame()">Play Again</button>
              </div>`;
          }, 400);
        }
      } else {
        setTimeout(()=>{
          flipped.forEach(c=>c.flipped=false);
          flipped=[];
          render();
        }, 900);
      }
    }
  };
}

// ========== GAME 3: REACTION TEST ==========
function startReactionGame() {
  let state = 'idle', startTime=0, round=0, results=[], waitTimer=null;

  function setBox(color, text, sub='') {
    const box = document.getElementById('rt-box');
    if (!box) return;
    box.style.background = color;
    box.style.transform = 'scale(1)';
    box.innerHTML = `<div style="font-size:1.4rem;font-weight:800;color:#fff">${text}</div><div style="font-size:.8rem;color:rgba(255,255,255,.8);margin-top:4px">${sub}</div>`;
  }

  function nextRound() {
    if (round >= 5) { showResults(); return; }
    round++;
    setBox('var(--red)', '⛔ WAIT...', `Round ${round}/5`);
    state = 'waiting';
    const delay = 1500 + Math.random() * 2500;
    waitTimer = setTimeout(()=>{
      if (state !== 'waiting') return;
      state = 'ready';
      startTime = Date.now();
      setBox('#16a34a', '⚡ TAP NOW!', 'Tap as fast as you can!');
    }, delay);
  }

  function showResults() {
    const avg = Math.round(results.reduce((a,b)=>a+b,0)/results.length);
    const best = localStorage.getItem('game_react_best');
    const newBest = !best || avg < parseInt(best);
    if (newBest) localStorage.setItem('game_react_best', avg+'ms');
    const box = document.getElementById('rt-box');
    const info = document.getElementById('rt-info');
    if (box) box.style.display='none';
    if (info) info.innerHTML = `
      <div style="text-align:center;padding:10px">
        <div style="font-size:2rem">⚡</div>
        <div style="font-size:1.2rem;font-weight:800;margin:8px 0">Average: ${avg}ms</div>
        <div style="font-size:.8rem;color:var(--text3)">Rounds: ${results.map(r=>r+'ms').join(', ')}</div>
        ${newBest?'<div style="color:#f59e0b;margin-top:6px;font-weight:700">🏆 New Best!</div>':''}
        <div style="margin-top:6px;font-size:.8rem;color:var(--text3)">${avg<200?'🔥 Insane!':avg<300?'⚡ Fast!':avg<450?'👍 Good!':'😴 Keep practicing!'}</div>
        <button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="startReactionGame()">Try Again</button>
      </div>`;
  }

  openModal('⚡ Lightning Reflex', `
    <p style="text-align:center;font-size:.82rem;color:var(--text3);margin-bottom:10px">Tap the box the MOMENT it turns green!</p>
    <div id="rt-box" style="width:100%;height:180px;border-radius:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#64748b;transition:background .1s;flex-direction:column;user-select:none" onclick="rtTap()">
      <div style="font-size:1.4rem;font-weight:800;color:#fff">Tap to Start</div>
      <div style="font-size:.8rem;color:rgba(255,255,255,.7);margin-top:4px">5 rounds</div>
    </div>
    <div id="rt-info" style="margin-top:10px;min-height:40px"></div>
    <div style="text-align:center;margin-top:8px">
      <button class="btn btn-outline btn-sm" onclick="clearTimeout(waitTimer);closeModal()">Quit</button>
    </div>`, 400);

  window.rtTap = function() {
    if (state === 'idle') { nextRound(); return; }
    if (state === 'waiting') {
      clearTimeout(waitTimer);
      setBox('var(--red)', '❌ Too Early!', 'Wait for green...');
      state = 'idle';
      setTimeout(()=>{ if(state==='idle') nextRound(); }, 1200);
      return;
    }
    if (state === 'ready') {
      const ms = Date.now() - startTime;
      results.push(ms);
      state = 'idle';
      setBox('var(--primary)', `${ms}ms`, round < 5 ? 'Tap for next round' : 'Tap for results!');
      setTimeout(()=>{ if(state==='idle') nextRound(); }, 1000);
    }
  };
}
