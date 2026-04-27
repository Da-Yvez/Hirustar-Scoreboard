const socket = io();
socket.on('connect', () => socket.emit('identify', { type: 'display' }));
let currentState = null;
let previousOrder = [];
const contestantList = document.getElementById('contestantList');
const preloadedImages = new Set();

function preloadAssets(contestants, judges) {
  judges.forEach(j => {
    const url = `/images/judges/${j.image}`;
    if (!preloadedImages.has(url)) {
      const img = new Image();
      img.src = url;
      preloadedImages.add(url);
    }
  });
  contestants.forEach(c => {
    const url = `/images/contestants/${c.image}`;
    if (!preloadedImages.has(url)) {
      const img = new Image();
      img.src = url;
      preloadedImages.add(url);
    }
  });
}

function fallbackSvg(letter, bg) {
  return `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22${bg}%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2262%22 text-anchor=%22middle%22 fill=%22%23fff%22 font-size=%2238%22 font-family=%22sans-serif%22>${letter}</text></svg>`;
}

function clampScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function createRow(c, rank, percent, topN) {
  const row = document.createElement('div');
  row.className = `display-row ${rank <= topN ? 'top' : 'low'}`;
  row.dataset.id = c.id;
  row.innerHTML = `
    <div class="display-bar">
      <div class="display-bar-fill" style="width:${percent}%"></div>
      <div class="display-content">
        <div class="display-rank">${String(rank).padStart(2, '0')}</div>
        <div class="display-name">${c.name}</div>
        <div class="display-percent"><span id="score-${c.id}">${percent}</span>%</div>
        <img class="display-avatar" src="/images/contestants/${c.image}" alt="${c.name}"
             onerror="this.src='${fallbackSvg(c.name.charAt(0), '%23333')}'">
      </div>
      <div class="score-popup" id="popup-${c.id}">
        <img class="judge-mini-avatar" id="popup-judge-img-${c.id}" src="" alt="">
        <span class="delta-text">+7</span>
      </div>
    </div>`;
  return row;
}

function rebuildList(contestants, topN) {
  contestantList.innerHTML = '';
  contestants.forEach((c, i) => {
    const percent = clampScore(c.score);
    contestantList.appendChild(createRow(c, i + 1, percent, topN));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function animateScoreUpdate(trigger, contestants, judges, topN) {
  const { contestantId, judgeId } = trigger;
  const judge = judges.find(j => j.id === judgeId);
  const popup = document.getElementById(`popup-${contestantId}`);
  const judgeImg = document.getElementById(`popup-judge-img-${contestantId}`);

  if (popup && judge) {
    judgeImg.src = `/images/judges/${judge.image}`;
    judgeImg.onerror = function() { this.src = fallbackSvg(judge.name.charAt(0), '%23444'); };
    popup.classList.remove('animate-out');
    popup.classList.add('animate-in');
  }

  await sleep(400);
  const scoreEl = document.getElementById(`score-${contestantId}`);
  if (scoreEl) {
    const c = contestants.find(x => x.id === contestantId);
    scoreEl.textContent = clampScore(c?.score);
    scoreEl.classList.add('score-tick');
    scoreEl.addEventListener('animationend', () => scoreEl.classList.remove('score-tick'), { once: true });
  }

  await sleep(1200);
  if (popup) { popup.classList.remove('animate-in'); popup.classList.add('animate-out'); }

  await sleep(400);
  const oldRects = {};
  document.querySelectorAll('.display-row').forEach(r => {
    oldRects[r.dataset.id] = r.getBoundingClientRect();
  });

  rebuildList(contestants, topN);

  document.querySelectorAll('.display-row').forEach(r => {
    const old = oldRects[r.dataset.id];
    if (!old) return;
    const ny = r.getBoundingClientRect();
    const dy = old.top - ny.top;
    if (Math.abs(dy) > 1) {
      r.style.transform = `translateY(${dy}px)`;
      r.style.transition = 'none';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          r.classList.add('flip-animate');
          r.style.transform = '';
          r.style.transition = '';
          r.addEventListener('transitionend', () => r.classList.remove('flip-animate'), { once: true });
        });
      });
    }
  });

  previousOrder = contestants.map(c => c.id);
}

function renderList(contestants, judges, trigger, showResultsMode, judgeVotes, topN) {
  const scoreboardPanel = document.getElementById('scoreboardPanel');
  const scoreboardSubtitle = document.getElementById('scoreboardSubtitle');

  if (showResultsMode) {
    if (!scoreboardPanel.classList.contains('final-results-active')) {
      scoreboardPanel.classList.add('final-results-active');
      renderFinalResults(contestants, judges, judgeVotes, topN);
    }
  } else {
    scoreboardPanel.classList.remove('final-results-active');
    scoreboardPanel.classList.remove('centered-layout');
    if (scoreboardSubtitle) scoreboardSubtitle.textContent = 'Live Scoreboard';
    
    if (trigger && currentState) {
      animateScoreUpdate(trigger, contestants, judges, topN);
    } else {
      preloadAssets(contestants, judges); // Initial preload
      rebuildList(contestants, topN);
      previousOrder = contestants.map(c => c.id);
    }
  }
  currentState = { contestants, judges };
}

async function renderFinalResults(contestants, judges, judgeVotes, topN) {
  const scoreboardSubtitle = document.getElementById('scoreboardSubtitle');
  
  // 1. First, identify and fade out the red rows
  const rows = document.querySelectorAll('.display-row');
  let losers = [];
  let winners = [];
  
  rows.forEach(row => {
    if (row.classList.contains('low')) {
      losers.push(row);
    } else {
      winners.push(row);
    }
  });

  // Fade out losers
  losers.forEach(row => row.classList.add('phasing-out'));
  await sleep(1500); // Wait for fade out
  
  // 1.5. Now change layout to center
  const scoreboardPanel = document.getElementById('scoreboardPanel');
  if (scoreboardPanel) scoreboardPanel.classList.add('centered-layout');
  
  // Hide losers completely
  losers.forEach(row => row.classList.add('hidden-final'));

  // 2. Move winners to center and scale up
  winners.forEach((row, i) => {
    row.classList.add('final-winner');
    // Add judge badges (hidden initially)
    const cid = row.dataset.id;
    const contestant = contestants.find(x => String(x.id) === String(cid));
    const votingJudges = judges.filter(j => judgeVotes[j.id] === contestant?.id);
    
    if (votingJudges.length > 0) {
      const badgeContainer = document.createElement('div');
      badgeContainer.className = 'judge-badges';
      badgeContainer.id = `badges-${cid}`;
      
      let badgesHtml = `<span class="voted-by-label">Voted By</span><div class="judge-badge-list">`;
      votingJudges.forEach(j => {
        badgesHtml += `<img class="judge-badge-img" src="/images/judges/${j.image}" 
                           alt="${j.name}" title="${j.name}"
                           onerror="this.src='${fallbackSvg(j.name.charAt(0), '%23444')}'">`;
      });
      badgesHtml += `</div>`;
      badgeContainer.innerHTML = badgesHtml;
      row.appendChild(badgeContainer);
    }
  });

  await sleep(100); // Brief pause before scaling
  winners.forEach(row => row.classList.add('active'));
  
  // 3. Trigger winning particles
  await sleep(800);
  winners.forEach((row, i) => {
    setTimeout(() => spawnParticles(row), i * 300);
  });

  // 4. Show who voted (fade in badges)
  await sleep(1000);
  winners.forEach(row => {
    const badges = row.querySelector('.judge-badges');
    if (badges) badges.classList.add('visible');
  });

  // 5. Update header title
  if (scoreboardSubtitle) {
    scoreboardSubtitle.style.opacity = '0';
    await sleep(500);
    scoreboardSubtitle.textContent = 'WINNING CONTESTANTS';
    scoreboardSubtitle.style.opacity = '1';
    scoreboardSubtitle.style.transition = 'opacity 0.8s ease';
  }
}

function spawnParticles(element) {
  const rect = element.getBoundingClientRect();
  const colors = ['#f5c842', '#26b962', '#fff', '#4e8cff'];
  
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 8 + 4;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    
    // Position randomly within the element
    const x = rect.left + Math.random() * rect.width;
    const y = rect.top + Math.random() * rect.height;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    
    // Random target direction
    const tx = (Math.random() - 0.5) * 400;
    const ty = (Math.random() - 0.5) * 400;
    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);
    
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

socket.on('state_update', (data) => {
  renderList(data.contestants, data.judges, data.trigger, data.showResultsMode, data.judgeVotes, data.topN || 4);
});
