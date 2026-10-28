// YaarWin Client with Sound, Dual-Card Countdown (Image 3), 3D Gradient Balls (Images 1 & 2)
let socket;
let activeGameKey = '30s';
let allGamesState = {};
let currentBalance = 0.00;
let isLocked = false;
let globalMultiplier = 1;
let autoCloseTimer = null;

// Read uid from URL params (passed by parent page as ?uid=XXXX)
const _urlParams = new URLSearchParams(window.location.search);
const PLAYER_UID = _urlParams.get('uid') || localStorage.getItem('wingo_uid') || '951603';
if (PLAYER_UID) localStorage.setItem('wingo_uid', PLAYER_UID);

// Sound Controller
const countdownAudio = new Audio('audio/countdown.mp3');
countdownAudio.preload = 'auto';
let soundEnabled = localStorage.getItem('wingo_sound') !== 'false'; // default ON

const GAME_NAMES = {
  '30s': 'WinGo 30sec',
  '1m':  'WinGo 1 Min',
  '3m':  'WinGo 3 Min',
  '5m':  'WinGo 5 Min'
};

let activeBet = {
  type: null,
  selection: null,
  baseAmount: 1,
  quantity: 1,
  multiplier: 1
};

// DOM Elements
const displayBalance = document.getElementById('displayBalance');
const gameTitleDisplay = document.getElementById('gameTitleDisplay');
const sheetGameTitle = document.getElementById('sheetGameTitle');
const currentPeriodDisplay = document.getElementById('currentPeriodDisplay');
const cdM1 = document.getElementById('cdM1');
const cdM2 = document.getElementById('cdM2');
const cdS1 = document.getElementById('cdS1');
const cdS2 = document.getElementById('cdS2');
const countdownBoxes = document.getElementById('countdownBoxes');
const lockoutOverlay = document.getElementById('lockoutOverlay');
const giantDigitLeft = document.getElementById('giantDigitLeft');
const giantDigitRight = document.getElementById('giantDigitRight');
const recentBallsRow = document.getElementById('recentBallsRow');
const historyTableBody = document.getElementById('historyTableBody');
const chartContainer = document.getElementById('chartContainer');
const trendRowsList = document.getElementById('trendRowsList');
const trendLineSvg = document.getElementById('trendLineSvg');
const myHistoryContainer = document.getElementById('myHistoryContainer');
const myBetsList = document.getElementById('myBetsList');
const gameHistoryContainer = document.getElementById('gameHistoryContainer');
const toastMsg = document.getElementById('toastMsg');

// Sound Button & Icons
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIconOn = document.getElementById('soundIconOn');
const soundIconOff = document.getElementById('soundIconOff');

// Bet Modal Elements
const betModalOverlay = document.getElementById('betModalOverlay');
const modalSelectionBadge = document.getElementById('modalSelectionBadge');
const stepValue = document.getElementById('stepValue');
const modalTotalAmount = document.getElementById('modalTotalAmount');
const btnConfirmBet = document.getElementById('btnConfirmBet');
const btnCancelBet = document.getElementById('btnCancelBet');

// Image 1: Winning Modal Elements
const winModalOverlay = document.getElementById('winModalOverlay');
const winModalAmount = document.getElementById('winModalAmount');
const winModalPeriodText = document.getElementById('winModalPeriodText');
const winColorPill = document.getElementById('winColorPill');
const winNumberPill = document.getElementById('winNumberPill');
const winSizePill = document.getElementById('winSizePill');
const btnCloseWinModal = document.getElementById('btnCloseWinModal');
const winAutoCloseCheck = document.getElementById('winAutoCloseCheck');

// Image 2: Losing Modal Elements
const loseModalOverlay = document.getElementById('loseModalOverlay');
const loseModalPeriodText = document.getElementById('loseModalPeriodText');
const loseColorPill = document.getElementById('loseColorPill');
const loseNumberPill = document.getElementById('loseNumberPill');
const loseSizePill = document.getElementById('loseSizePill');
const btnCloseLoseModal = document.getElementById('btnCloseLoseModal');
const loseAutoCloseCheck = document.getElementById('loseAutoCloseCheck');

// Initialize Sound UI
function initSoundUI() {
  if (soundEnabled) {
    soundToggleBtn.classList.remove('muted');
    soundIconOn.style.display = 'block';
    soundIconOff.style.display = 'none';
  } else {
    soundToggleBtn.classList.add('muted');
    soundIconOn.style.display = 'none';
    soundIconOff.style.display = 'block';
  }

  soundToggleBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem('wingo_sound', soundEnabled);

    if (soundEnabled) {
      soundToggleBtn.classList.remove('muted');
      soundIconOn.style.display = 'block';
      soundIconOff.style.display = 'none';
      showToast('Sound ON 🔊');
      // Warm up audio context on user gesture
      countdownAudio.play().then(() => countdownAudio.pause()).catch(() => {});
    } else {
      soundToggleBtn.classList.add('muted');
      soundIconOn.style.display = 'none';
      soundIconOff.style.display = 'block';
      countdownAudio.pause();
      countdownAudio.currentTime = 0;
      showToast('Sound OFF 🔇');
    }
  });
}

// Connect WebSocket
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('Connected to YaarWin Game Server');
    // Identify this player so server sends correct balance
    socket.send(JSON.stringify({ type: 'IDENTIFY', uid: PLAYER_UID }));
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (e) {
      console.error(e);
    }
  };

  socket.onclose = () => {
    setTimeout(initWebSocket, 2000);
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'INIT_ALL':
      updateBalance(msg.data.walletBalance);
      allGamesState = msg.data.games;
      loadActiveGameUI();
      renderMyBets(msg.data.allBets);
      break;

    case 'TICK_ALL':
      if (allGamesState) {
        for (const [k, v] of Object.entries(msg.data)) {
          if (allGamesState[k]) {
            allGamesState[k].timeRemaining = v.timeRemaining;
            allGamesState[k].currentPeriod = v.currentPeriod;
            allGamesState[k].isLocked = v.isLocked;
          }
        }
      }
      const currentGameTick = msg.data[activeGameKey];
      if (currentGameTick) {
        updateTimer(currentGameTick.timeRemaining);
        currentPeriodDisplay.textContent = currentGameTick.currentPeriod;
      }
      break;

    case 'ROUND_SETTLED':
      if (allGamesState && allGamesState[msg.gameKey]) {
        allGamesState[msg.gameKey].currentPeriod = msg.data.nextPeriod;
        allGamesState[msg.gameKey].history.unshift(msg.data.result);
      }

      updateBalance(msg.data.walletBalance);

      if (msg.gameKey === activeGameKey) {
        lockoutOverlay.classList.remove('active');
        currentPeriodDisplay.textContent = msg.data.nextPeriod;
        prependHistoryRow(msg.data.result);
        prependRecentBall(msg.data.result);
        if (chartContainer.style.display !== 'none') {
          renderChartTrend();
        }
      }

      // Check if user placed bets on this settled round
      if (msg.data.settledBets && msg.data.settledBets.length > 0) {
        if (msg.data.totalWonAmount > 0) {
          showWinningScreen(msg.data.totalWonAmount, msg.data.previousPeriod, msg.data.result, msg.gameKey);
          if (window.parent && window.parent !== window) {
            try {
              window.parent.postMessage({
                type: 'ROUND_WIN',
                wonAmount: msg.data.totalWonAmount,
                balance: msg.data.walletBalance
              }, '*');
            } catch (e) {}
          }
        } else {
          showLosingScreen(msg.data.previousPeriod, msg.data.result, msg.gameKey);
        }
      }

      refreshMyBets();
      break;

    case 'BET_PLACED':
      updateBalance(msg.data.walletBalance);
      break;

    case 'WALLET_UPDATE':
      updateBalance(msg.data.walletBalance);
      break;
  }
}

// Generate SVG Ball HTML for any number 0 to 9 matching Image 1 & 2
function getBallSvgHtml(num, size = 26) {
  const n = parseInt(num, 10);
  const uid = Math.random().toString(36).substring(2, 7);

  if (n === 0) {
    return `
      <svg viewBox="0 0 60 60" class="mini-ball-svg" style="width:${size}px; height:${size}px;">
        <defs>
          <linearGradient id="m_ring0_${uid}" x1="20%" y1="20%" x2="80%" y2="80%">
            <stop offset="0%" stop-color="#ff4f5e" />
            <stop offset="50%" stop-color="#ef4444" />
            <stop offset="50.1%" stop-color="#9333ea" />
            <stop offset="100%" stop-color="#7e22ce" />
          </linearGradient>
          <radialGradient id="m_core0_${uid}" cx="36%" cy="32%" r="58%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="35%" stop-color="#ffffff" stop-opacity="0.95" />
            <stop offset="65%" stop-color="#f5d0fe" />
            <stop offset="100%" stop-color="#d8b4fe" />
          </radialGradient>
        </defs>
        <circle cx="30" cy="30" r="27" fill="url(#m_ring0_${uid})" />
        <ellipse cx="30" cy="5" rx="7" ry="3.5" fill="#ffffff" opacity="0.8" />
        <ellipse cx="30" cy="55" rx="7" ry="3.5" fill="#ffffff" opacity="0.8" />
        <ellipse cx="5" cy="30" rx="3.5" ry="7" fill="#ffffff" opacity="0.8" />
        <ellipse cx="55" cy="30" rx="3.5" ry="7" fill="#ffffff" opacity="0.8" />
        <circle cx="30" cy="30" r="19.5" fill="url(#m_core0_${uid})" />
        <ellipse cx="26" cy="18" rx="8" ry="4" fill="#ffffff" opacity="0.8" transform="rotate(-25 26 18)" />
        <text x="30" y="38" font-family="'Montserrat', sans-serif" font-size="24" font-weight="700" fill="#a21caf" text-anchor="middle">0</text>
      </svg>
    `;
  }
  if (n === 5) {
    return `
      <svg viewBox="0 0 60 60" class="mini-ball-svg" style="width:${size}px; height:${size}px;">
        <defs>
          <linearGradient id="m_ring5_${uid}" x1="20%" y1="20%" x2="80%" y2="80%">
            <stop offset="0%" stop-color="#34d399" />
            <stop offset="50%" stop-color="#059669" />
            <stop offset="50.1%" stop-color="#9333ea" />
            <stop offset="100%" stop-color="#7e22ce" />
          </linearGradient>
          <radialGradient id="m_core5_${uid}" cx="36%" cy="32%" r="58%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="35%" stop-color="#ffffff" stop-opacity="0.95" />
            <stop offset="65%" stop-color="#ede9fe" />
            <stop offset="100%" stop-color="#c4b5fd" />
          </radialGradient>
        </defs>
        <circle cx="30" cy="30" r="27" fill="url(#m_ring5_${uid})" />
        <ellipse cx="30" cy="5" rx="7" ry="3.5" fill="#ffffff" opacity="0.8" />
        <ellipse cx="30" cy="55" rx="7" ry="3.5" fill="#ffffff" opacity="0.8" />
        <ellipse cx="5" cy="30" rx="3.5" ry="7" fill="#ffffff" opacity="0.8" />
        <ellipse cx="55" cy="30" rx="3.5" ry="7" fill="#ffffff" opacity="0.8" />
        <circle cx="30" cy="30" r="19.5" fill="url(#m_core5_${uid})" />
        <ellipse cx="26" cy="18" rx="8" ry="4" fill="#ffffff" opacity="0.85" transform="rotate(-25 26 18)" />
        <text x="30" y="38" font-family="'Montserrat', sans-serif" font-size="24" font-weight="700" fill="#9333ea" text-anchor="middle">5</text>
      </svg>
    `;
  }

  const isGreen = [1, 3, 7, 9].includes(n);
  const ringGrad = isGreen
    ? `<stop offset="0%" stop-color="#34d399" /><stop offset="100%" stop-color="#059669" />`
    : `<stop offset="0%" stop-color="#ff5965" /><stop offset="100%" stop-color="#d82433" />`;
  const coreGrad = isGreen
    ? `<stop offset="0%" stop-color="#ffffff" /><stop offset="40%" stop-color="#ffffff" stop-opacity="0.95" /><stop offset="75%" stop-color="#e6f9f0" /><stop offset="100%" stop-color="#bbf0d8" />`
    : `<stop offset="0%" stop-color="#ffffff" /><stop offset="40%" stop-color="#ffffff" stop-opacity="0.95" /><stop offset="75%" stop-color="#ffebee" /><stop offset="100%" stop-color="#fcccd2" />`;
  const textColor = isGreen ? '#138952' : '#d92534';

  return `
    <svg viewBox="0 0 60 60" class="mini-ball-svg" style="width:${size}px; height:${size}px;">
      <defs>
        <linearGradient id="m_ring_${n}_${uid}" x1="30%" y1="0%" x2="70%" y2="100%">${ringGrad}</linearGradient>
        <radialGradient id="m_core_${n}_${uid}" cx="36%" cy="32%" r="58%">${coreGrad}</radialGradient>
      </defs>
      <circle cx="30" cy="30" r="27" fill="url(#m_ring_${n}_${uid})" />
      <ellipse cx="30" cy="5" rx="7" ry="3.5" fill="#ffffff" opacity="0.8" />
      <ellipse cx="30" cy="55" rx="7" ry="3.5" fill="#ffffff" opacity="0.8" />
      <ellipse cx="5" cy="30" rx="3.5" ry="7" fill="#ffffff" opacity="0.8" />
      <ellipse cx="55" cy="30" rx="3.5" ry="7" fill="#ffffff" opacity="0.8" />
      <circle cx="30" cy="30" r="19.5" fill="url(#m_core_${n}_${uid})" />
      <ellipse cx="26" cy="18" rx="8" ry="4" fill="#ffffff" opacity="0.85" transform="rotate(-25 26 18)" />
      <text x="30" y="38" font-family="'Montserrat', sans-serif" font-size="24" font-weight="700" fill="${textColor}" text-anchor="middle">${n}</text>
    </svg>
  `;
}

function loadActiveGameUI() {
  const game = allGamesState[activeGameKey];
  if (!game) return;

  gameTitleDisplay.textContent = game.name;
  sheetGameTitle.textContent = game.name;
  currentPeriodDisplay.textContent = game.currentPeriod;
  updateTimer(game.timeRemaining);

  renderRecentBalls(game.history.slice(0, 5));
  renderHistoryTable(game.history.slice(0, 20));
  renderChartTrend();
}

// 5-Second Dual Card Countdown Logic (Image 3) & Audio
function updateTimer(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  const mStr = mins.toString().padStart(2, '0');
  const sStr = secs.toString().padStart(2, '0');

  cdM1.textContent = mStr[0];
  cdM2.textContent = mStr[1];
  cdS1.textContent = sStr[0];
  cdS2.textContent = sStr[1];

  // 5-Second Countdown Dual Cards (Image 3)
  if (seconds <= 5 && seconds > 0) {
    isLocked = true;
    countdownBoxes.classList.add('danger');
    lockoutOverlay.classList.add('active');

    // Dual cards show: [ 0 ] [ seconds ]
    giantDigitLeft.textContent = '0';
    giantDigitRight.textContent = seconds;

    closeBetModal();

    // Trigger uploaded audio file at second 5
    if (seconds === 5 && soundEnabled) {
      try {
        countdownAudio.currentTime = 0;
        countdownAudio.play().catch(e => console.log('Audio autoplay prevented'));
      } catch (e) {}
    }
  } else {
    isLocked = false;
    countdownBoxes.classList.remove('danger');
    if (seconds > 5) {
      lockoutOverlay.classList.remove('active');
    }
  }
}

function updateBalance(val) {
  currentBalance = parseFloat(val) || 0;
  displayBalance.textContent = `₹${currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (window.parent && window.parent !== window) {
    try {
      if (typeof window.parent.updateAllBalanceDisplays === 'function') {
        window.parent.updateAllBalanceDisplays(currentBalance);
      }
      if (typeof window.parent.refreshUserBalance === 'function') {
        window.parent.refreshUserBalance(false);
      }
      window.parent.postMessage({ type: 'BALANCE_UPDATE', balance: currentBalance }, '*');
    } catch (e) {}
  }
}

function renderRecentBalls(items) {
  recentBallsRow.innerHTML = '';
  if (!items) return;
  items.forEach(it => {
    recentBallsRow.innerHTML += getBallSvgHtml(it.number, 26);
  });
}

function prependRecentBall(it) {
  const temp = document.createElement('div');
  temp.innerHTML = getBallSvgHtml(it.number, 26);
  recentBallsRow.insertBefore(temp.firstElementChild, recentBallsRow.firstChild);
  if (recentBallsRow.children.length > 5) {
    recentBallsRow.removeChild(recentBallsRow.lastChild);
  }
}

function renderHistoryTable(items) {
  historyTableBody.innerHTML = '';
  if (!items) return;
  items.forEach(it => {
    historyTableBody.appendChild(createHistoryRow(it));
  });
}

function prependHistoryRow(it) {
  const row = createHistoryRow(it);
  historyTableBody.insertBefore(row, historyTableBody.firstChild);
  if (historyTableBody.children.length > 25) {
    historyTableBody.removeChild(historyTableBody.lastChild);
  }
}

function createHistoryRow(it) {
  const row = document.createElement('div');
  row.className = 'table-row';

  let numColorClass = 'red';
  if (it.number === 0 || it.number === 5) numColorClass = 'violet';
  else if ([1, 3, 7, 9].includes(it.number)) numColorClass = 'green';

  let dotsHtml = '';
  if (it.number === 0) {
    dotsHtml = `<div class="color-dot red"></div><div class="color-dot violet"></div>`;
  } else if (it.number === 5) {
    dotsHtml = `<div class="color-dot green"></div><div class="color-dot violet"></div>`;
  } else if ([1, 3, 7, 9].includes(it.number)) {
    dotsHtml = `<div class="color-dot green"></div>`;
  } else {
    dotsHtml = `<div class="color-dot red"></div>`;
  }

  row.innerHTML = `
    <span class="row-period">${it.period}</span>
    <span class="row-number ${numColorClass}">${it.number}</span>
    <span class="row-size">${it.size}</span>
    <div class="row-color-dots">${dotsHtml}</div>
  `;
  return row;
}

// Chart Page Trend Line (Image 3)
function renderChartTrend() {
  const game = allGamesState[activeGameKey];
  if (!game || !game.history) return;

  trendRowsList.innerHTML = '';
  const historyItems = game.history.slice(0, 15);

  historyItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'trend-row';

    let gridHtml = '';
    for (let d = 0; d <= 9; d++) {
      if (d === item.number) {
        let hitClass = 'hit-red';
        if (d === 0 || d === 5) hitClass = 'hit-violet';
        else if ([1, 3, 7, 9].includes(d)) hitClass = 'hit-green';

        gridHtml += `<div class="trend-spot ${hitClass}" data-row="${index}" data-val="${d}">${d}</div>`;
      } else {
        gridHtml += `<div class="trend-spot" data-row="${index}" data-val="${d}">${d}</div>`;
      }
    }

    const sizeBadgeClass = item.size === 'Big' ? 'big' : 'small';
    const sizeBadgeLetter = item.size === 'Big' ? 'B' : 'S';

    row.innerHTML = `
      <div class="trend-period-col">${item.period}</div>
      <div class="trend-grid-col">${gridHtml}</div>
      <div class="trend-size-badge ${sizeBadgeClass}">${sizeBadgeLetter}</div>
    `;

    trendRowsList.appendChild(row);
  });

  setTimeout(() => {
    drawTrendLines();
  }, 100);
}

function drawTrendLines() {
  const containerRect = trendRowsList.getBoundingClientRect();
  const hitSpots = trendRowsList.querySelectorAll('.trend-spot.hit-green, .trend-spot.hit-red, .trend-spot.hit-violet');
  
  if (hitSpots.length < 2) {
    trendLineSvg.innerHTML = '';
    return;
  }

  let points = [];
  hitSpots.forEach(spot => {
    const r = spot.getBoundingClientRect();
    const cx = r.left - containerRect.left + (r.width / 2);
    const cy = r.top - containerRect.top + (r.height / 2);
    points.push(`${cx},${cy}`);
  });

  trendLineSvg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);
  trendLineSvg.style.width = `${containerRect.width}px`;
  trendLineSvg.style.height = `${containerRect.height}px`;

  trendLineSvg.innerHTML = `
    <polyline points="${points.join(' ')}" fill="none" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" opacity="0.85" />
  `;
}

// My History (Image 4)
function renderMyBets(bets) {
  if (!bets || bets.length === 0) {
    myBetsList.innerHTML = '<div style="text-align:center; padding: 40px; color:#9ca3af; font-weight:800;">No history records found.</div>';
    return;
  }

  myBetsList.innerHTML = '';
  bets.forEach(b => {
    const card = document.createElement('div');
    card.className = 'history-card-item';

    let boxClass = 'green';
    let boxLabel = b.selection;

    if (b.type === 'number') {
      const n = parseInt(b.selection, 10);
      if (n === 0) boxClass = 'dual0';
      else if (n === 5) boxClass = 'dual5';
      else if ([1, 3, 7, 9].includes(n)) boxClass = 'green';
      else boxClass = 'red';
      boxLabel = n;
    } else if (b.type === 'color') {
      boxClass = b.selection.toLowerCase();
      boxLabel = b.selection[0].toUpperCase();
    } else if (b.type === 'size') {
      boxClass = b.selection.toLowerCase();
      boxLabel = b.selection === 'Big' ? 'B' : 'S';
    }

    let statusPillHtml = '';
    let amountTextHtml = '';

    if (b.status === 'WON') {
      statusPillHtml = `<span class="history-status-pill succeed">Succeed</span>`;
      amountTextHtml = `<span class="history-amount-text win">+₹${b.payout.toFixed(2)}</span>`;
    } else if (b.status === 'LOST') {
      statusPillHtml = `<span class="history-status-pill failed">Failed</span>`;
      amountTextHtml = `<span class="history-amount-text loss">-₹${b.amount.toFixed(2)}</span>`;
    } else {
      statusPillHtml = `<span class="history-status-pill" style="border:1px solid #f59e0b; color:#f59e0b; background:#fef3c7;">Pending</span>`;
      amountTextHtml = `<span class="history-amount-text" style="color:#f59e0b;">₹${b.amount.toFixed(2)}</span>`;
    }

    const timeStr = b.settledAt ? b.settledAt.replace('T', ' ').slice(0, 19) : (b.createdAt || '').replace('T', ' ').slice(0, 19);

    card.innerHTML = `
      <div class="history-card-left">
        <div class="history-selection-box ${boxClass}">${boxLabel}</div>
        <div class="history-text-col">
          <span class="history-period-num">${b.period}</span>
          <span class="history-timestamp">${timeStr}</span>
        </div>
      </div>
      <div class="history-card-right">
        <button class="btn-detail-pill">Detail &gt;</button>
        ${statusPillHtml}
        ${amountTextHtml}
      </div>
    `;

    myBetsList.appendChild(card);
  });
}

// Winning Screen (Image 1)
function showWinningScreen(amount, period, result, gameKey) {
  clearTimeout(autoCloseTimer);

  winColorPill.textContent = result.color ? result.color.toUpperCase() : 'RED';
  winNumberPill.textContent = result.number;
  winSizePill.textContent = result.size;

  winModalAmount.textContent = `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  winModalPeriodText.textContent = `Period:${GAME_NAMES[gameKey] || ''} ${period}`;

  winModalOverlay.classList.add('active');

  if (winAutoCloseCheck.checked) {
    autoCloseTimer = setTimeout(() => {
      winModalOverlay.classList.remove('active');
    }, 3000);
  }
}

// Losing Screen (Image 2)
function showLosingScreen(period, result, gameKey) {
  clearTimeout(autoCloseTimer);

  loseColorPill.textContent = result.color ? result.color.toUpperCase() : 'RED';
  loseNumberPill.textContent = result.number;
  loseSizePill.textContent = result.size;

  loseModalPeriodText.textContent = `Period: ${period}`;

  loseModalOverlay.classList.add('active');

  if (loseAutoCloseCheck.checked) {
    autoCloseTimer = setTimeout(() => {
      loseModalOverlay.classList.remove('active');
    }, 3000);
  }
}

function showToast(msg) {
  toastMsg.textContent = msg;
  toastMsg.classList.add('show');
  setTimeout(() => {
    toastMsg.classList.remove('show');
  }, 2200);
}

// Bet Modal Actions
function openBetModal(type, val) {
  if (isLocked) {
    showToast('Betting locked for this round!');
    return;
  }

  activeBet.type = type;
  activeBet.selection = val;
  activeBet.multiplier = globalMultiplier;
  activeBet.quantity = 1;
  stepValue.textContent = '1';

  modalSelectionBadge.textContent = `${type.toUpperCase()}: ${val}`;
  modalSelectionBadge.className = 'badge-selection';

  if (type === 'color') {
    modalSelectionBadge.classList.add(val.toLowerCase());
  } else if (type === 'size') {
    modalSelectionBadge.classList.add(val.toLowerCase());
  } else {
    modalSelectionBadge.classList.add('number');
  }

  document.querySelectorAll('.modal-mult').forEach(btn => {
    if (parseInt(btn.getAttribute('data-mult'), 10) === globalMultiplier) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  recalculateTotal();
  betModalOverlay.classList.add('active');
}

function closeBetModal() {
  betModalOverlay.classList.remove('active');
}

function recalculateTotal() {
  const total = activeBet.baseAmount * activeBet.quantity * activeBet.multiplier;
  modalTotalAmount.textContent = `₹${total.toFixed(2)}`;
  btnConfirmBet.textContent = `Total amount ₹${total.toFixed(2)}`;
}

async function submitBet() {
  if (isLocked) {
    showToast('Round ended! Betting locked.');
    closeBetModal();
    return;
  }

  const total = activeBet.baseAmount * activeBet.quantity * activeBet.multiplier;
  if (total > currentBalance) {
    showToast('Insufficient wallet balance!');
    return;
  }

  try {
    const res = await fetch('/api/game/bet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: PLAYER_UID,
        gameKey: activeGameKey,
        type: activeBet.type,
        selection: activeBet.selection,
        amount: total,
        multiplier: activeBet.multiplier
      })
    });

    const data = await res.json();
    if (data.ok) {
      showToast(`Bet placed: ${activeBet.selection} (₹${total.toFixed(2)})`);
      closeBetModal();
      refreshMyBets();
    } else {
      showToast(data.error || 'Bet placement failed');
    }
  } catch (err) {
    showToast('Network error, please try again');
  }
}

async function refreshMyBets() {
  try {
    const res = await fetch(`/api/game/status?gameKey=${activeGameKey}&uid=${PLAYER_UID}`);
    const data = await res.json();
    if (data.ok) {
      updateBalance(data.data.walletBalance);
      renderMyBets(data.data.recentBets);
    }
  } catch (e) {
    console.error(e);
  }
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initSoundUI();
  initWebSocket();

  // Header Back Button: close in-app iframe modal if embedded, or go back
  const backBtn = document.querySelector('.back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.parent && window.parent !== window && typeof window.parent.closeInAppGame === 'function') {
        window.parent.closeInAppGame();
      } else {
        window.history.back();
      }
    });
  }

  // 4 Game Tab Switcher
  document.querySelectorAll('.game-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.game-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      activeGameKey = tab.getAttribute('data-game');
      loadActiveGameUI();
      refreshMyBets();
    });
  });

  // Color Buttons
  document.querySelectorAll('.btn-color').forEach(btn => {
    btn.addEventListener('click', () => {
      openBetModal('color', btn.getAttribute('data-val'));
    });
  });

  // Number Sphere Buttons
  document.querySelectorAll('.ball-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      openBetModal('number', btn.getAttribute('data-val'));
    });
  });

  // Big / Small Buttons
  document.querySelectorAll('.btn-big, .btn-small').forEach(btn => {
    btn.addEventListener('click', () => {
      openBetModal('size', btn.getAttribute('data-val'));
    });
  });

  // Random Button
  document.getElementById('randomBetBtn').addEventListener('click', () => {
    const randomNum = Math.floor(Math.random() * 10);
    openBetModal('number', randomNum.toString());
  });

  // Multiplier Pills
  document.querySelectorAll('.multiplier-pills .pill-mult').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.multiplier-pills .pill-mult').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      globalMultiplier = parseInt(btn.getAttribute('data-mult'), 10);
    });
  });

  document.querySelectorAll('.modal-mult').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-mult').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeBet.multiplier = parseInt(btn.getAttribute('data-mult'), 10);
      recalculateTotal();
    });
  });

  // Amount Chips
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeBet.baseAmount = parseInt(btn.getAttribute('data-amount'), 10);
      recalculateTotal();
    });
  });

  // Stepper
  document.getElementById('stepPlus').addEventListener('click', () => {
    activeBet.quantity++;
    stepValue.textContent = activeBet.quantity;
    recalculateTotal();
  });

  document.getElementById('stepMinus').addEventListener('click', () => {
    if (activeBet.quantity > 1) {
      activeBet.quantity--;
      stepValue.textContent = activeBet.quantity;
      recalculateTotal();
    }
  });

  btnConfirmBet.addEventListener('click', submitBet);
  btnCancelBet.addEventListener('click', closeBetModal);
  betModalOverlay.addEventListener('click', (e) => {
    if (e.target === betModalOverlay) closeBetModal();
  });

  // Close Winning Modal
  btnCloseWinModal.addEventListener('click', () => {
    clearTimeout(autoCloseTimer);
    winModalOverlay.classList.remove('active');
  });

  // Close Losing Modal
  btnCloseLoseModal.addEventListener('click', () => {
    clearTimeout(autoCloseTimer);
    loseModalOverlay.classList.remove('active');
  });

  // Deposit button: open parent site's deposit page if embedded, or add test funds
  document.getElementById('depositBtn').addEventListener('click', async () => {
    if (window.parent && window.parent !== window && typeof window.parent.openDepositFromGame === 'function') {
      window.parent.openDepositFromGame();
      return;
    }
    try {
      const res = await fetch('/api/admin/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', amount: 500, uid: PLAYER_UID })
      });
      const data = await res.json();
      if (data.ok) showToast('Deposited ₹500.00 Test Balance!');
    } catch (e) {
      showToast('Deposit failed');
    }
  });

  // Withdraw button: open parent site's wallet/withdraw page if embedded
  document.getElementById('withdrawBtn').addEventListener('click', () => {
    if (window.parent && window.parent !== window) {
      if (typeof window.parent.closeInAppGame === 'function') {
        window.parent.closeInAppGame();
      }
      setTimeout(() => {
        if (typeof window.parent.openWithdrawPage === 'function') {
          window.parent.openWithdrawPage();
        } else if (typeof window.parent.switchMainTab === 'function') {
          window.parent.switchMainTab('wallet');
        }
      }, 200);
      return;
    }
    showToast(`Current balance: ₹${currentBalance.toFixed(2)}`);
  });

  document.getElementById('refreshBalanceBtn').addEventListener('click', () => {
    refreshMyBets();
    showToast('Balance refreshed');
  });

  document.getElementById('howToPlayBtn').addEventListener('click', () => {
    alert('WinGo Rules:\n• Numbers 0-9 drawn every round.\n• 1,3,7,9 = Green (2x)\n• 2,4,6,8 = Red (2x)\n• 0,5 = Violet (4.5x)\n• 0-4 = Small, 5-9 = Big (2x)\n• Exact Number Match = 9x Payout!');
  });

  // Navigation Tabs: Game History, Chart, My History
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.getAttribute('data-tab');
      gameHistoryContainer.style.display = 'none';
      chartContainer.style.display = 'none';
      myHistoryContainer.style.display = 'none';

      if (targetTab === 'gameHistory') {
        gameHistoryContainer.style.display = 'block';
      } else if (targetTab === 'chart') {
        chartContainer.style.display = 'block';
        renderChartTrend();
      } else if (targetTab === 'myHistory') {
        myHistoryContainer.style.display = 'block';
        refreshMyBets();
      }
    });
  });

  // Resize re-draws the SVG zigzag trend lines
  window.addEventListener('resize', () => {
    if (chartContainer.style.display !== 'none') {
      drawTrendLines();
    }
  });
});
