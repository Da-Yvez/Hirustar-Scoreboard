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

function createRow(c, rank, percent) {
  const row = document.createElement('div');
  row.className = `display-row ${rank <= 4 ? 'top' : 'low'}`;
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

function rebuildList(contestants) {
  contestantList.innerHTML = '';
  contestants.forEach((c, i) => {
    const percent = clampScore(c.score);
    contestantList.appendChild(createRow(c, i + 1, percent));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function animateScoreUpdate(trigger, contestants, judges) {
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

  rebuildList(contestants);

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

function renderList(contestants, judges, trigger) {
  if (trigger && currentState) {
    animateScoreUpdate(trigger, contestants, judges);
  } else {
    preloadAssets(contestants, judges); // Initial preload
    rebuildList(contestants);
    previousOrder = contestants.map(c => c.id);
  }
  currentState = { contestants, judges };
}

socket.on('state_update', (data) => {
  renderList(data.contestants, data.judges, data.trigger);
});
