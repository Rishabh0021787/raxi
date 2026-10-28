// YaarWin Master Outcome Controller Logic
let socket;
let selectedGameKey = '30s';
let dashboardData = null;

const GAME_NAMES = {
  '30s': 'WinGo 30sec',
  '1m':  'WinGo 1 Min',
  '3m':  'WinGo 3 Min',
  '5m':  'WinGo 5 Min'
};

// DOM Elements
const activeGameTitle = document.getElementById('activeGameTitle');
const adminPeriodDisplay = document.getElementById('adminPeriodDisplay');
const adminTimerDisplay = document.getElementById('adminTimerDisplay');
const periodStatusBadge = document.getElementById('periodStatusBadge');
const adminBetsCount = document.getElementById('adminBetsCount');
const adminWalletDisplay = document.getElementById('adminWalletDisplay');

// Mini tab timers
const tabTimer30s = document.getElementById('tabTimer30s');
const tabTimer1m = document.getElementById('tabTimer1m');
const tabTimer3m = document.getElementById('tabTimer3m');
const tabTimer5m = document.getElementById('tabTimer5m');

// Outcome Displays
const currentModeLabel = document.getElementById('currentModeLabel');
const targetBallDisplay = document.getElementById('targetBallDisplay');
const overrideStatusText = document.getElementById('overrideStatusText');
const overrideSubtext = document.getElementById('overrideSubtext');
const btnResetOverride = document.getElementById('btnResetOverride');
const adminBallBtns = document.querySelectorAll('.admin-ball-btn');

// Pool Displays
const totalPoolDisplay = document.getElementById('totalPoolDisplay');
const poolGreen = document.getElementById('poolGreen');
const poolViolet = document.getElementById('poolViolet');
const poolRed = document.getElementById('poolRed');
const poolBig = document.getElementById('poolBig');
const poolSmall = document.getElementById('poolSmall');
const adminBetsTableBody = document.getElementById('adminBetsTableBody');
const adminToast = document.getElementById('adminToast');

// WebSocket Init
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('Admin connected to WebSocket');
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerEvent(msg);
    } catch (e) {
      console.error(e);
    }
  };

  socket.onclose = () => {
    setTimeout(initWebSocket, 2000);
  };
}

function handleServerEvent(msg) {
  switch (msg.type) {
    case 'INIT_ALL':
      adminWalletDisplay.textContent = `₹${msg.data.walletBalance.toFixed(2)}`;
      fetchDashboard();
      break;

    case 'TICK_ALL':
      // Update tab sub-timers
      if (tabTimer30s && msg.data['30s']) tabTimer30s.textContent = `${msg.data['30s'].timeRemaining}s`;
      if (tabTimer1m && msg.data['1m']) tabTimer1m.textContent = `${msg.data['1m'].timeRemaining}s`;
      if (tabTimer3m && msg.data['3m']) tabTimer3m.textContent = `${msg.data['3m'].timeRemaining}s`;
      if (tabTimer5m && msg.data['5m']) tabTimer5m.textContent = `${msg.data['5m'].timeRemaining}s`;

      const curTick = msg.data[selectedGameKey];
      if (curTick) {
        adminPeriodDisplay.textContent = curTick.currentPeriod;
        adminTimerDisplay.textContent = `${curTick.timeRemaining}s`;

        if (curTick.isLocked) {
          periodStatusBadge.textContent = 'Locked (Settling)';
          periodStatusBadge.className = 'stat-badge locked';
        } else {
          periodStatusBadge.textContent = 'Betting Open';
          periodStatusBadge.className = 'stat-badge open';
        }
      }
      break;

    case 'BET_PLACED':
      adminWalletDisplay.textContent = `₹${msg.data.walletBalance.toFixed(2)}`;
      if (msg.gameKey === selectedGameKey) {
        fetchDashboard();
      }
      break;

    case 'ROUND_SETTLED':
      adminWalletDisplay.textContent = `₹${msg.data.walletBalance.toFixed(2)}`;
      fetchDashboard();
      break;

    case 'ADMIN_UPDATE':
      if (msg.gameKey === selectedGameKey) {
        updateOverrideCard(msg.data.adminMode, msg.data.adminOverride, msg.data.adminTargetColor, msg.data.adminTargetSize);
      }
      break;

    case 'WALLET_UPDATE':
      adminWalletDisplay.textContent = `₹${msg.data.walletBalance.toFixed(2)}`;
      break;
  }
}

// Fetch Full Dashboard for selected game
async function fetchDashboard() {
  try {
    const res = await fetch(`/api/admin/dashboard?gameKey=${selectedGameKey}`);
    const data = await res.json();
    if (data.ok) {
      dashboardData = data.data;
      const g = dashboardData.game;

      activeGameTitle.textContent = `${g.name} - Live Status`;
      adminPeriodDisplay.textContent = g.currentPeriod;
      adminTimerDisplay.textContent = `${g.timeRemaining}s`;
      adminWalletDisplay.textContent = `₹${dashboardData.walletBalance.toFixed(2)}`;
      adminBetsCount.textContent = g.currentBets.length;

      // Pool summary
      totalPoolDisplay.textContent = `Total Pool: ₹${g.betsSummary.totalPool.toFixed(2)}`;
      poolGreen.textContent = `₹${g.betsSummary.colors.green.toFixed(2)}`;
      poolViolet.textContent = `₹${g.betsSummary.colors.violet.toFixed(2)}`;
      poolRed.textContent = `₹${g.betsSummary.colors.red.toFixed(2)}`;
      poolBig.textContent = `₹${g.betsSummary.sizes.big.toFixed(2)}`;
      poolSmall.textContent = `₹${g.betsSummary.sizes.small.toFixed(2)}`;

      renderBetsTable(g.currentBets);
      updateOverrideCard(g.adminMode, g.adminOverride, g.adminTargetColor, g.adminTargetSize);
    }
  } catch (err) {
    console.error(err);
  }
}

function renderBetsTable(bets) {
  if (!bets || bets.length === 0) {
    adminBetsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 16px;">No active bets placed on current round</td></tr>`;
    return;
  }

  adminBetsTableBody.innerHTML = '';
  bets.forEach(b => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: monospace; font-size: 11px;">${b.id}</td>
      <td>${b.period}</td>
      <td style="text-transform: capitalize;">${b.type}</td>
      <td style="font-weight: 800; text-transform: capitalize;">${b.selection}</td>
      <td style="color: #38bdf8; font-weight: 800;">₹${b.amount.toFixed(2)}</td>
      <td><span style="background: #064e3b; color: #34d399; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 800;">${b.status}</span></td>
    `;
    adminBetsTableBody.appendChild(tr);
  });
}

function updateOverrideCard(mode, num, color, size) {
  adminBallBtns.forEach(btn => btn.classList.remove('selected'));

  if (mode === 'auto' || (num === null && !color && !size)) {
    currentModeLabel.textContent = `Mode: Automatic (Fair RNG)`;
    targetBallDisplay.textContent = '?';
    targetBallDisplay.style.background = '#475569';
    overrideStatusText.textContent = `Next Outcome: Random Fair RNG`;
    overrideSubtext.textContent = `Server will pick an unrigged fair outcome for ${GAME_NAMES[selectedGameKey]}.`;
    return;
  }

  currentModeLabel.textContent = `Mode: FORCED OVERRIDE ACTIVE`;

  if (num !== null && num !== undefined) {
    const n = parseInt(num, 10);
    const selectedBtn = document.querySelector(`.admin-ball-btn[data-num="${n}"]`);
    if (selectedBtn) selectedBtn.classList.add('selected');

    targetBallDisplay.textContent = n;
    const isBig = n >= 5 ? 'Big' : 'Small';

    if (n === 0) {
      targetBallDisplay.style.background = 'linear-gradient(135deg, #f04944 50%, #b259f9 50%)';
      overrideStatusText.textContent = `Forced to: Number [ 0 ] (Red + Violet | Small)`;
    } else if (n === 5) {
      targetBallDisplay.style.background = 'linear-gradient(135deg, #18b660 50%, #b259f9 50%)';
      overrideStatusText.textContent = `Forced to: Number [ 5 ] (Green + Violet | Big)`;
    } else if ([1, 3, 7, 9].includes(n)) {
      targetBallDisplay.style.background = '#18b660';
      overrideStatusText.textContent = `Forced to: Number [ ${n} ] (Green | ${isBig})`;
    } else {
      targetBallDisplay.style.background = '#f04944';
      overrideStatusText.textContent = `Forced to: Number [ ${n} ] (Red | ${isBig})`;
    }
    overrideSubtext.textContent = `Will settle exact Number ${n} on next draw!`;
  } else {
    // Overridden by color or size
    targetBallDisplay.textContent = '★';
    if (color === 'green') targetBallDisplay.style.background = '#18b660';
    else if (color === 'red') targetBallDisplay.style.background = '#f04944';
    else if (color === 'violet') targetBallDisplay.style.background = '#b259f9';
    else if (size === 'Big') targetBallDisplay.style.background = '#f48b28';
    else if (size === 'Small') targetBallDisplay.style.background = '#4b85dc';
    else targetBallDisplay.style.background = '#0284c7';

    const colorDesc = color ? color.toUpperCase() : 'ANY';
    const sizeDesc = size ? size.toUpperCase() : 'ANY';
    overrideStatusText.textContent = `Forced to: Color ${colorDesc} | Size ${sizeDesc}`;
    overrideSubtext.textContent = `Server will randomly draw a winning ball that matches this criteria!`;
  }
}

// Send Override Request to Server
async function sendOutcomeOverride(payload) {
  try {
    const res = await fetch('/api/admin/set-outcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameKey: selectedGameKey,
        ...payload
      })
    });
    const data = await res.json();
    if (data.ok) {
      updateOverrideCard(data.data.adminMode, data.data.adminOverride, data.data.adminTargetColor, data.data.adminTargetSize);
      showToast(`Updated outcome for ${GAME_NAMES[selectedGameKey]}!`);
    } else {
      showToast(data.error || 'Failed to update');
    }
  } catch (e) {
    showToast('Network error');
  }
}

function showToast(text) {
  adminToast.textContent = text;
  adminToast.classList.add('show');
  setTimeout(() => {
    adminToast.classList.remove('show');
  }, 2200);
}

// Setup Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  fetchDashboard();

  // 4 Game Selector Tabs in Admin
  document.querySelectorAll('.btn-select-game').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.btn-select-game').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      selectedGameKey = tab.getAttribute('data-game');
      fetchDashboard();
    });
  });

  // Force Color Buttons
  document.querySelectorAll('[data-force-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-force-color');
      sendOutcomeOverride({ mode: 'manual', color: color, size: null, number: null });
    });
  });

  // Force Size Buttons
  document.querySelectorAll('[data-force-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.getAttribute('data-force-size');
      sendOutcomeOverride({ mode: 'manual', color: null, size: size, number: null });
    });
  });

  // Combined Presets
  document.querySelectorAll('[data-combo-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-combo-color');
      const size = btn.getAttribute('data-combo-size');
      sendOutcomeOverride({ mode: 'manual', color: color, size: size, number: null });
    });
  });

  // Specific Number Balls 0 to 9
  adminBallBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const num = parseInt(btn.getAttribute('data-num'), 10);
      sendOutcomeOverride({ mode: 'manual', number: num });
    });
  });

  // Reset to Fair RNG
  btnResetOverride.addEventListener('click', () => {
    sendOutcomeOverride({ mode: 'auto' });
  });

  // Wallet Management
  document.querySelectorAll('.btn-wallet-action[data-add]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const addAmt = parseFloat(btn.getAttribute('data-add'));
      try {
        const res = await fetch('/api/admin/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add', amount: addAmt })
        });
        const data = await res.json();
        if (data.ok) showToast(`Added ₹${addAmt} to wallet`);
      } catch (e) {
        showToast('Error updating wallet');
      }
    });
  });

  document.getElementById('btnResetWallet').addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      const data = await res.json();
      if (data.ok) showToast('Wallet reset to ₹1,000.00');
    } catch (e) {
      showToast('Error resetting wallet');
    }
  });
});
