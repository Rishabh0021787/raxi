/**
 * DmFirst ADMIN PANEL - CLIENT ENGINE
 * Handles authentication, real-time metrics, live WinGo & Aviator control,
 * Financial approvals, User balances, Gift Codes, and Payment Gateway configuration.
 */

const API_BASE = '';
let authToken = localStorage.getItem('dmfirst_admin_token') || localStorage.getItem('raxi_admin_token') || '';
let currentTab = 'dashboard';
let currentWingoGame = '30s';
let allUsers = [];
let allDeposits = [];
let allWithdrawals = [];
let allGiftCodes = [];
let cachedWingoGames = {};
let cachedPlatformSettings = {};
let fastGamesPollInterval = null;
let generalPollInterval = null;

// ========================================================
// 1. INITIALIZATION & AUTHENTICATION
// ========================================================
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('dmfirst_admin_token') || localStorage.getItem('raxi_admin_token');
  if (token) {
    showAdminApp();
    initAdminData();
  } else {
    showLoginScreen();
  }
  setupModalDismissals();
});

function showLoginScreen() {
  document.getElementById('adminLoginScreen').style.display = 'flex';
  document.getElementById('adminApp').style.display = 'none';
}

function showAdminApp() {
  document.getElementById('adminLoginScreen').style.display = 'none';
  document.getElementById('adminApp').style.display = 'flex';
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const username = document.getElementById('adminUserInput').value.trim();
  const password = document.getElementById('adminPassInput').value.trim();
  const loginBtn = document.getElementById('loginBtn');

  if (!username || !password) {
    showAdminToast('Please enter administrator credentials', 'error');
    return;
  }

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span>Verifying...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      authToken = data.token;
      localStorage.setItem('dmfirst_admin_token', authToken);
      showAdminToast('Welcome, Administrator. Access Authorized.', 'success');
      showAdminApp();
      initAdminData();
    } else {
      showAdminToast(data.message || 'Invalid Credentials', 'error');
    }
  } catch (err) {
    console.error('Login error:', err);
    showAdminToast('Network error during authentication', 'error');
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = '<span>Authorize Access</span>';
    }
  }
}

function handleAdminLogout() {
  localStorage.removeItem('dmfirst_admin_token');
  localStorage.removeItem('raxi_admin_token');
  authToken = '';
  showAdminToast('Signed out of Admin Console', 'info');
  showLoginScreen();
}

function initAdminData() {
  renderAdminBallsGrid();
  loadStats();
  loadUsers();
  loadDeposits();
  loadWithdrawals();
  loadGiftCodes();
  loadPlatformSettings();
  fetchWingoAdminStatus(true);
  fetchAviatorAdminStatus(true);

  // General dashboard poller every 6 seconds
  if (generalPollInterval) clearInterval(generalPollInterval);
  generalPollInterval = setInterval(() => {
    loadStats(true);
    if (currentTab === 'financials') {
      loadDeposits(true);
      loadWithdrawals(true);
    }
  }, 6000);
}

// ========================================================
// 2. TAB SWITCHING
// ========================================================
function switchAdminTab(tabName) {
  currentTab = tabName;

  // Nav Items Active Highlighting
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(btn => {
    const text = btn.innerText.toLowerCase();
    if (
      (tabName === 'dashboard' && text.includes('dashboard')) ||
      (tabName === 'wingo' && text.includes('wingo')) ||
      (tabName === 'aviator' && text.includes('aviator')) ||
      (tabName === 'users' && text.includes('user')) ||
      (tabName === 'financials' && (text.includes('deposit') || text.includes('payout'))) ||
      (tabName === 'giftcodes' && text.includes('gift')) ||
      (tabName === 'settings' && text.includes('setting'))
    ) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Views Active Toggle
  document.querySelectorAll('.admin-tab-view').forEach(v => v.classList.remove('active'));

  const viewMap = {
    'dashboard': 'viewDashboard',
    'wingo': 'viewWingoGame',
    'aviator': 'viewAviatorGame',
    'users': 'viewUsers',
    'financials': 'viewFinancials',
    'giftcodes': 'viewGiftCodes',
    'settings': 'viewSettings'
  };

  const titleMap = {
    'dashboard': 'Dashboard Overview',
    'wingo': 'WinGo Game Controller',
    'aviator': 'Aviator Crash Controller',
    'users': 'User Account Management',
    'financials': 'Financial Approvals (Recharge & Withdraw)',
    'giftcodes': 'Gift Code Manager',
    'settings': 'Platform & Payment Gateway Settings'
  };

  const targetView = document.getElementById(viewMap[tabName]);
  if (targetView) targetView.classList.add('active');

  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle) pageTitle.innerText = titleMap[tabName] || 'Admin Console';

  // Fast Poller for Games Tab
  if (tabName === 'wingo' || tabName === 'dashboard' || tabName === 'aviator') {
    startGamesPolling();
  } else {
    stopGamesPolling();
  }

  // Load Tab-specific data
  if (tabName === 'dashboard') {
    loadStats();
    fetchWingoAdminStatus();
  } else if (tabName === 'wingo') {
    fetchWingoAdminStatus();
  } else if (tabName === 'aviator') {
    fetchAviatorAdminStatus();
    loadAviatorHistory();
  } else if (tabName === 'users') {
    loadUsers();
  } else if (tabName === 'financials') {
    loadDeposits();
    loadWithdrawals();
  } else if (tabName === 'giftcodes') {
    loadGiftCodes();
  } else if (tabName === 'settings') {
    loadPlatformSettings();
  }
}

function startGamesPolling() {
  if (fastGamesPollInterval) clearInterval(fastGamesPollInterval);
  fastGamesPollInterval = setInterval(() => {
    if (currentTab === 'wingo' || currentTab === 'dashboard') {
      fetchWingoAdminStatus(true);
    }
    if (currentTab === 'aviator' || currentTab === 'dashboard') {
      fetchAviatorAdminStatus(true);
    }
  }, 1500);
}

function stopGamesPolling() {
  if (fastGamesPollInterval) {
    clearInterval(fastGamesPollInterval);
    fastGamesPollInterval = null;
  }
}

// ========================================================
// 3. DASHBOARD OVERVIEW & STATS (Screenshot 4)
// ========================================================
async function loadStats(silent = false) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/stats`);
    const data = await res.json();
    if (data.success && data.data) {
      const s = data.data;
      
      const elUsers = document.getElementById('statTotalUsers');
      const elAppDep = document.getElementById('statApprovedDeposits');
      const elAppWd = document.getElementById('statApprovedWithdrawals');
      const elNetRev = document.getElementById('statNetRevenue');
      const elPendingFin = document.getElementById('badgePendingFinances');

      if (elUsers) elUsers.innerText = Number(s.totalUsers || 0).toLocaleString();
      if (elAppDep) elAppDep.innerText = `₹${parseFloat(s.approvedDepositsTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
      if (elAppWd) elAppWd.innerText = `₹${parseFloat(s.approvedWithdrawalsTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      const depVal = parseFloat(s.approvedDepositsTotal) || 0;
      const wdVal = parseFloat(s.approvedWithdrawalsTotal) || 0;
      const netVal = depVal - wdVal;
      if (elNetRev) elNetRev.innerText = `₹${netVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      const totalPending = (s.pendingDeposits || 0) + (s.pendingWithdrawals || 0);
      if (elPendingFin) {
        elPendingFin.innerText = totalPending;
        elPendingFin.style.display = totalPending > 0 ? 'inline-block' : 'none';
      }
    }
  } catch (err) {
    if (!silent) console.error('Error loading stats:', err);
  }
}

function renderDashboardActivity() {
  const tbody = document.getElementById('dashboardActivityList');
  if (!tbody) return;

  const combined = [];
  allDeposits.forEach(d => {
    combined.push({
      id: d.orderId,
      uid: d.uid,
      type: 'Deposit',
      amount: d.amount,
      channel: d.type || 'UPI',
      status: d.status,
      time: d.createdAt
    });
  });
  allWithdrawals.forEach(w => {
    combined.push({
      id: w.orderId,
      uid: w.uid,
      type: 'Withdraw',
      amount: w.amount,
      channel: w.payoutMethod || 'Bank Transfer',
      status: w.status,
      time: w.createdAt
    });
  });

  combined.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  const recent = combined.slice(0, 8);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No financial transactions recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(item => {
    const isDep = item.type === 'Deposit';
    const typeClass = isDep ? 'text-green' : 'text-red';
    const statusClass = item.status === 'Approved' ? 'pill-active' : (item.status === 'Pending' ? 'pill-active' : 'pill-rejected');
    const timeFormatted = item.time ? (item.time.includes(' ') ? item.time.split(' ')[1] : new Date(item.time).toLocaleTimeString()) : '12:00:00';

    return `
      <tr>
        <td><strong class="text-white">${item.id}</strong></td>
        <td><span class="text-sage">UID: ${item.uid}</span></td>
        <td><strong class="${typeClass}">${item.type}</strong></td>
        <td><strong class="${isDep ? 'text-gold' : 'text-white'}">₹${parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td><span class="text-sage">${item.channel}</span></td>
        <td><span class="capsule-pill ${statusClass}">${item.status}</span></td>
        <td><span class="text-sage text-sm mono-val">${timeFormatted}</span></td>
      </tr>
    `;
  }).join('');
}

// ========================================================
// 4. USER ACCOUNT MANAGEMENT (Screenshot 3)
// ========================================================
async function loadUsers(silent = false) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/users`);
    const data = await res.json();
    if (data.success && data.data) {
      allUsers = data.data;
      renderUsersTable(allUsers);
    }
  } catch (err) {
    if (!silent) console.error('Error loading users:', err);
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No player accounts found.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isSuspended = u.status === 'Suspended';
    const statusPill = isSuspended ? '<span class="capsule-pill pill-rejected">Suspended</span>' : '<span class="capsule-pill pill-active">Active</span>';
    const vipTag = u.vip || 'VIP 1';

    return `
      <tr>
        <td><strong class="text-white mono-val">${u.uid}</strong></td>
        <td><span class="text-white font-medium">${u.username || 'Player'}</span></td>
        <td><span class="text-sage mono-val">${u.phone || '+91 9876543210'}</span></td>
        <td><strong class="text-gold mono-val">${vipTag}</strong></td>
        <td><strong class="text-gold mono-val">₹${parseFloat(u.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td>${statusPill}</td>
        <td>
          <div class="user-actions-cluster">
            <button class="btn-quick-plus" onclick="quickAdjustBalance('${u.uid}', 1000, 'add')" title="Add ₹1,000">+₹1,000</button>
            <button class="btn-quick-minus" onclick="quickAdjustBalance('${u.uid}', 1000, 'deduct')" title="Deduct ₹1,000">-₹1,000</button>
            <button class="btn-pill-action" onclick="openBalanceModal('${u.uid}')" title="Custom Amount">Adjust</button>
            <button class="${isSuspended ? 'btn-pill-action' : 'btn-pill-reject'}" onclick="toggleUserStatus('${u.uid}')">
              ${isSuspended ? 'Unban' : 'Suspend'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterUsersTable() {
  const query = (document.getElementById('userSearchInput')?.value || '').toLowerCase().trim();
  if (!query) {
    renderUsersTable(allUsers);
    return;
  }
  const filtered = allUsers.filter(u => 
    (u.uid && u.uid.toLowerCase().includes(query)) ||
    (u.username && u.username.toLowerCase().includes(query)) ||
    (u.phone && u.phone.includes(query))
  );
  renderUsersTable(filtered);
}

async function quickAdjustBalance(uid, amount, action) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/user/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, amount, action })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`UID ${uid} balance updated: ₹${parseFloat(data.balance).toFixed(2)}`, 'success');
      loadUsers(true);
      loadStats(true);
    } else {
      showAdminToast(data.message || 'Balance update failed', 'error');
    }
  } catch (err) {
    console.error('Quick adjust error:', err);
    showAdminToast('Network error while updating balance', 'error');
  }
}

function openBalanceModal(uid = '') {
  const modal = document.getElementById('modalBalance');
  const uidInput = document.getElementById('modalBalUid');
  const amountInput = document.getElementById('modalBalAmount');
  if (!modal) return;
  if (uid) uidInput.value = uid;
  if (amountInput) amountInput.value = '';
  modal.classList.add('show');
}

function closeBalanceModal() {
  const modal = document.getElementById('modalBalance');
  if (modal) modal.classList.remove('show');
}

async function handleExecuteBalance(event) {
  event.preventDefault();
  const uid = document.getElementById('modalBalUid').value.trim();
  const action = document.getElementById('modalBalAction').value;
  const amount = parseFloat(document.getElementById('modalBalAmount').value);

  if (!uid || isNaN(amount) || amount <= 0) {
    showAdminToast('Please provide valid UID and amount', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/user/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, action, amount })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`UID ${uid} balance updated: ₹${parseFloat(data.balance).toFixed(2)}`, 'success');
      closeBalanceModal();
      loadUsers();
      loadStats();
    } else {
      showAdminToast(data.message || 'Failed to update balance', 'error');
    }
  } catch (err) {
    console.error('Balance modal submit error:', err);
    showAdminToast('Network error updating balance', 'error');
  }
}

async function toggleUserStatus(uid) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/user/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`User UID ${uid} is now ${data.status}.`, 'info');
      loadUsers();
    } else {
      showAdminToast(data.message || 'Failed to change status', 'error');
    }
  } catch (err) {
    console.error('User status error:', err);
    showAdminToast('Network error toggling status', 'error');
  }
}

// ========================================================
// 5. FINANCIAL APPROVALS (Screenshot 2)
// ========================================================
async function loadDeposits(silent = false) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/deposits`);
    const data = await res.json();
    if (data.success && data.data) {
      allDeposits = data.data;
      renderDepositsTable();
      renderDashboardActivity();
    }
  } catch (err) {
    if (!silent) console.error('Error loading deposits:', err);
  }
}

function renderDepositsTable() {
  const tbody = document.getElementById('depositsTableBody');
  if (!tbody) return;

  const pending = allDeposits.filter(d => d.status === 'Pending');
  if (pending.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No pending deposits in queue.</td></tr>`;
    return;
  }

  tbody.innerHTML = pending.map(d => `
    <tr>
      <td><strong class="text-white mono-val">${d.orderId}</strong></td>
      <td><span class="text-sage mono-val">${d.uid}</span></td>
      <td><strong class="text-gold mono-val">₹${parseFloat(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
      <td><span class="text-sage">${d.type || 'UPI-FastQR'}</span></td>
      <td><span class="text-white mono-val">${d.utr || 'UTR-NOT-SPECIFIED'}</span></td>
      <td>
        <div class="user-actions-cluster">
          <button class="btn-pill-action" onclick="executeDepositAction('${d.orderId}', 'approve')">Approve</button>
          <button class="btn-pill-reject" onclick="openRejectModal('${d.orderId}', 'deposit', ${d.amount}, '${d.uid}')">Reject</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function executeDepositAction(orderId, action, reason = '') {
  try {
    const res = await fetch(`${API_BASE}/api/admin/deposit/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, action, reason })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`Deposit ${orderId} ${action === 'approve' ? 'Approved & Balance Credited' : 'Rejected'}.`, 'success');
      loadDeposits();
      loadUsers(true);
      loadStats(true);
    } else {
      showAdminToast(data.message || 'Deposit action failed', 'error');
    }
  } catch (err) {
    console.error('Deposit action error:', err);
    showAdminToast('Network error processing deposit', 'error');
  }
}

async function loadWithdrawals(silent = false) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/withdrawals`);
    const data = await res.json();
    if (data.success && data.data) {
      allWithdrawals = data.data;
      renderWithdrawalsTable();
      renderDashboardActivity();
    }
  } catch (err) {
    if (!silent) console.error('Error loading withdrawals:', err);
  }
}

function renderWithdrawalsTable() {
  const tbody = document.getElementById('withdrawalsTableBody');
  if (!tbody) return;

  const pending = allWithdrawals.filter(w => w.status === 'Pending');
  if (pending.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No pending withdrawals in queue.</td></tr>`;
    return;
  }

  tbody.innerHTML = pending.map(w => {
    const bankDetails = w.bankDetails || {};
    const dest = w.upiId || bankDetails.accountNo || 'UPI Direct';

    return `
      <tr>
        <td><strong class="text-white mono-val">${w.orderId}</strong></td>
        <td><span class="text-sage mono-val">${w.uid}</span></td>
        <td><strong class="text-red mono-val">₹${parseFloat(w.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
        <td><span class="text-sage">${w.payoutMethod || 'UPI Direct'}</span></td>
        <td><span class="text-white mono-val">${dest}</span></td>
        <td>
          <div class="user-actions-cluster">
            <button class="btn-pill-action" onclick="executeWithdrawalAction('${w.orderId}', 'approve')">Approve Payout</button>
            <button class="btn-pill-reject" onclick="openRejectModal('${w.orderId}', 'withdrawal', ${w.amount}, '${w.uid}')">Reject</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function executeWithdrawalAction(orderId, action, reason = '') {
  try {
    const res = await fetch(`${API_BASE}/api/admin/withdrawal/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, action, reason })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`Withdrawal ${orderId} ${action === 'approve' ? 'Approved & Completed' : 'Rejected & Refunded'}.`, 'success');
      loadWithdrawals();
      loadUsers(true);
      loadStats(true);
    } else {
      showAdminToast(data.message || 'Withdrawal action failed', 'error');
    }
  } catch (err) {
    console.error('Withdrawal action error:', err);
    showAdminToast('Network error processing withdrawal', 'error');
  }
}

function openRejectModal(orderId, type, amount, uid) {
  const modal = document.getElementById('modalReject');
  if (!modal) return;
  document.getElementById('rejectOrderId').value = orderId;
  document.getElementById('rejectType').value = type;
  document.getElementById('rejectOrderDesc').innerText = `Order: ${orderId} | UID: ${uid} | Amount: ₹${parseFloat(amount).toFixed(2)}`;
  modal.classList.add('show');
}

function closeRejectModal() {
  const modal = document.getElementById('modalReject');
  if (modal) modal.classList.remove('show');
}

function applyPresetReason(val) {
  const custom = document.getElementById('rejectCustomReason');
  if (!custom) return;
  if (val === 'custom') {
    custom.value = '';
    custom.focus();
  } else {
    custom.value = val;
  }
}

async function handleExecuteReject(event) {
  event.preventDefault();
  const orderId = document.getElementById('rejectOrderId').value;
  const type = document.getElementById('rejectType').value;
  const reason = document.getElementById('rejectCustomReason').value.trim() || document.getElementById('rejectPresetReason').value;

  if (type === 'deposit') {
    await executeDepositAction(orderId, 'reject', reason);
  } else {
    await executeWithdrawalAction(orderId, 'reject', reason);
  }
  closeRejectModal();
}

// ========================================================
// 6. GIFT CODE MANAGER (Screenshot 1)
// ========================================================
async function loadGiftCodes(silent = false) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/gift-codes`);
    const data = await res.json();
    if (data.success && data.data) {
      allGiftCodes = data.data;
      renderGiftCodesTable();
    }
  } catch (err) {
    if (!silent) console.error('Error loading gift codes:', err);
  }
}

function renderGiftCodesTable() {
  const tbody = document.getElementById('giftCodesTableBody');
  if (!tbody) return;

  if (!allGiftCodes || allGiftCodes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No promotional gift codes created yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = allGiftCodes.map(g => {
    const isActive = g.status === 'Active';
    const statusPill = isActive ? '<span class="capsule-pill pill-active">Active</span>' : '<span class="capsule-pill pill-rejected">Disabled</span>';
    const actionBtn = isActive ? 
      `<button class="btn-pill-reject" onclick="toggleGiftCode('${g.id}')">Disable</button>` :
      `<button class="btn-pill-action" onclick="toggleGiftCode('${g.id}')">Activate</button>`;

    return `
      <tr>
        <td><strong class="text-gold mono-val" style="letter-spacing: 0.5px;">${g.code}</strong></td>
        <td><strong class="text-white mono-val">₹${parseFloat(g.bonus).toFixed(2)}</strong></td>
        <td><span class="text-white mono-val">${g.claimsUsed || 0} / ${g.maxClaims || 500}</span></td>
        <td>${statusPill}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

async function handleCreateGiftCode(event) {
  event.preventDefault();
  const code = (document.getElementById('giftCodeInput')?.value || '').trim();
  const bonus = parseFloat(document.getElementById('giftBonusInput')?.value);
  const maxClaims = parseInt(document.getElementById('giftMaxClaimsInput')?.value, 10);

  if (!code || isNaN(bonus) || bonus <= 0) {
    showAdminToast('Please provide valid Code Name and Bonus amount', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/gift-codes/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, bonus, maxClaims })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`Gift code ${code} created successfully!`, 'success');
      document.getElementById('giftCodeInput').value = '';
      loadGiftCodes();
    } else {
      showAdminToast(data.message || 'Failed to create gift code', 'error');
    }
  } catch (err) {
    console.error('Create gift code error:', err);
    showAdminToast('Network error creating gift code', 'error');
  }
}

async function toggleGiftCode(id) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/gift-codes/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(data.message || 'Gift code updated', 'info');
      loadGiftCodes();
    } else {
      showAdminToast(data.message || 'Failed to update code', 'error');
    }
  } catch (err) {
    console.error('Toggle gift code error:', err);
    showAdminToast('Network error toggling gift code', 'error');
  }
}

// ========================================================
// 7. PRIMARY DEPOSIT UPI & QR GATEWAY CONFIGURATION
// ========================================================
async function loadPlatformSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/settings`);
    const data = await res.json();
    if (data.success && data.data) {
      cachedPlatformSettings = data.data;
      const s = data.data;

      // Gateway Settings
      const elUpi = document.getElementById('settingUpiId');
      const elPayee = document.getElementById('settingPayeeName');
      const elTgSupp = document.getElementById('settingTelegramSupport');
      const elTgChan = document.getElementById('settingTelegramChannel');
      const elMinDep = document.getElementById('settingMinDeposit');
      const elMinWd = document.getElementById('settingMinWithdraw');
      const elAnnounce = document.getElementById('settingAnnouncement');
      const elMaint = document.getElementById('settingMaintenance');
      const elAdminUser = document.getElementById('settingAdminUser');

      if (elUpi) elUpi.value = s.upi_id || 'raxiwin@upi';
      if (elPayee) elPayee.value = s.payee_name || 'DmFirst Pay';
      if (elTgSupp) elTgSupp.value = s.telegram_support || '';
      if (elTgChan) elTgChan.value = s.telegram_channel || '';
      if (elMinDep) elMinDep.value = s.min_deposit || 100;
      if (elMinWd) elMinWd.value = s.min_withdraw || 200;
      if (elAnnounce) elAnnounce.value = s.announcement || '';
      if (elMaint) elMaint.checked = !!s.maintenance_mode;
      if (elAdminUser) elAdminUser.value = s.admin_user || 'admin';

      // QR mode radio
      const qrModeRadios = document.getElementsByName('settingQrMode');
      const activeMode = s.qr_mode || 'dynamic';
      for (const r of qrModeRadios) {
        r.checked = (r.value === activeMode);
      }
      toggleQrModeDisplay();
      updateGatewayPreview();
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

function toggleQrModeDisplay() {
  const selectedMode = document.querySelector('input[name="settingQrMode"]:checked')?.value || 'dynamic';
  const customSection = document.getElementById('customQrUploadSection');
  if (customSection) {
    customSection.style.display = selectedMode === 'custom' ? 'block' : 'none';
  }
  updateGatewayPreview();
}

function updateGatewayPreview() {
  const upiId = document.getElementById('settingUpiId')?.value.trim() || cachedPlatformSettings.upi_id || 'raxiwin@upi';
  const payeeName = document.getElementById('settingPayeeName')?.value.trim() || cachedPlatformSettings.payee_name || 'DmFirst Pay';
  const qrMode = document.querySelector('input[name="settingQrMode"]:checked')?.value || cachedPlatformSettings.qr_mode || 'dynamic';

  const previewUpi = document.getElementById('previewUpiId');
  const previewPayee = document.getElementById('previewPayeeName');
  const previewImg = document.getElementById('liveQrPreviewImg');

  if (previewUpi) previewUpi.innerText = upiId;
  if (previewPayee) previewPayee.innerText = payeeName;

  if (previewImg) {
    if (qrMode === 'dynamic') {
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=500.00&cu=INR`;
      previewImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;
    } else {
      previewImg.src = cachedPlatformSettings.qr_image || '/qr_upi.svg';
    }
  }
}

async function handleQrFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const previewName = document.getElementById('qrFileNamePreview');
  if (previewName) previewName.innerText = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const dataUrl = e.target.result;
    try {
      showAdminToast('Uploading QR code image to server...', 'info');
      const res = await fetch(`${API_BASE}/api/admin/settings/upload-qr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
      });
      const data = await res.json();
      if (data.success) {
        showAdminToast('Custom QR image uploaded & set as primary!', 'success');
        cachedPlatformSettings.qr_image = data.qr_image;
        cachedPlatformSettings.qr_mode = 'custom';
        const previewImg = document.getElementById('liveQrPreviewImg');
        if (previewImg) previewImg.src = data.qr_image;
      } else {
        showAdminToast(data.message || 'Failed to upload QR image', 'error');
      }
    } catch (err) {
      console.error('QR upload error:', err);
      showAdminToast('Network error uploading QR image', 'error');
    }
  };
  reader.readAsDataURL(file);
}

async function handleSavePaymentGateway(event) {
  event.preventDefault();
  const upi_id = document.getElementById('settingUpiId').value.trim();
  const payee_name = document.getElementById('settingPayeeName').value.trim();
  const qr_mode = document.querySelector('input[name="settingQrMode"]:checked')?.value || 'dynamic';

  if (!upi_id) {
    showAdminToast('Please provide your Primary UPI ID', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upi_id, payee_name, qr_mode })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast('Payment gateway updated! User deposits will land directly in your account.', 'success');
      cachedPlatformSettings.upi_id = upi_id;
      cachedPlatformSettings.payee_name = payee_name;
      cachedPlatformSettings.qr_mode = qr_mode;
      updateGatewayPreview();
    } else {
      showAdminToast(data.message || 'Failed to update gateway settings', 'error');
    }
  } catch (err) {
    console.error('Save gateway error:', err);
    showAdminToast('Network error saving gateway settings', 'error');
  }
}

async function handleSavePlatformSettings(event) {
  event.preventDefault();
  const telegram_support = document.getElementById('settingTelegramSupport').value.trim();
  const telegram_channel = document.getElementById('settingTelegramChannel').value.trim();
  const min_deposit = parseFloat(document.getElementById('settingMinDeposit').value) || 100;
  const min_withdraw = parseFloat(document.getElementById('settingMinWithdraw').value) || 200;
  const announcement = document.getElementById('settingAnnouncement').value.trim();
  const maintenance_mode = document.getElementById('settingMaintenance').checked;

  try {
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_support,
        telegram_channel,
        min_deposit,
        min_withdraw,
        announcement,
        maintenance_mode
      })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast('Platform configuration saved successfully!', 'success');
    } else {
      showAdminToast(data.message || 'Failed to save configuration', 'error');
    }
  } catch (err) {
    console.error('Save settings error:', err);
    showAdminToast('Network error saving platform settings', 'error');
  }
}

async function handleSaveAdminPass(event) {
  event.preventDefault();
  const admin_user = document.getElementById('settingAdminUser').value.trim();
  const admin_pass = document.getElementById('settingAdminPass').value;
  const confirm_pass = document.getElementById('settingAdminPassConfirm').value;

  if (admin_pass !== confirm_pass) {
    showAdminToast('Passwords do not match. Please verify.', 'error');
    return;
  }

  if (admin_pass.length < 6) {
    showAdminToast('Password should be at least 6 characters.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_user, admin_pass })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast('Administrator password updated securely.', 'success');
      document.getElementById('settingAdminPass').value = '';
      document.getElementById('settingAdminPassConfirm').value = '';
    } else {
      showAdminToast(data.message || 'Failed to update credentials', 'error');
    }
  } catch (err) {
    console.error('Password error:', err);
    showAdminToast('Network error updating password', 'error');
  }
}

// ========================================================
// 8. WINGO GAME CONTROLLER (DEDICATED SECTION)
// ========================================================
function selectWingoGame(gameKey) {
  currentWingoGame = gameKey;
  document.querySelectorAll('.wingo-mode-box').forEach(box => {
    if (box.getAttribute('data-game') === gameKey) {
      box.classList.add('active');
    } else {
      box.classList.remove('active');
    }
  });

  const titles = {
    '30s': 'WinGo 30sec - Live Controller',
    '1m': 'WinGo 1 Min - Live Controller',
    '3m': 'WinGo 3 Min - Live Controller',
    '5m': 'WinGo 5 Min - Live Controller'
  };
  const titleEl = document.getElementById('activeWingoTitle');
  if (titleEl) titleEl.innerText = titles[gameKey] || 'WinGo Live Controller';

  if (cachedWingoGames && cachedWingoGames[gameKey]) {
    updateWingoUI(cachedWingoGames[gameKey]);
  } else {
    fetchWingoAdminStatus();
  }
}

function renderAdminBallsGrid() {
  const container = document.getElementById('adminBallsGrid');
  if (!container) return;

  const balls = [
    { num: 0, bg: 'linear-gradient(135deg, #8E24AA 50%, #E52539 50%)', label: '0 (Red/Violet)' },
    { num: 1, bg: '#28A745', label: '1 (Green)' },
    { num: 2, bg: '#E52539', label: '2 (Red)' },
    { num: 3, bg: '#28A745', label: '3 (Green)' },
    { num: 4, bg: '#E52539', label: '4 (Red)' },
    { num: 5, bg: 'linear-gradient(135deg, #8E24AA 50%, #28A745 50%)', label: '5 (Green/Violet)' },
    { num: 6, bg: '#E52539', label: '6 (Red)' },
    { num: 7, bg: '#28A745', label: '7 (Green)' },
    { num: 8, bg: '#E52539', label: '8 (Red)' },
    { num: 9, bg: '#28A745', label: '9 (Green)' }
  ];

  container.innerHTML = balls.map(b => `
    <button class="admin-num-ball" style="background: ${b.bg};" onclick="forceWingoNumber(${b.num})" title="Force Number ${b.label}">
      <span class="ball-digit">${b.num}</span>
      <span class="ball-sub">${b.num >= 5 ? 'BIG' : 'SML'}</span>
    </button>
  `).join('');
}

async function fetchWingoAdminStatus(silent = false) {
  try {
    const res = await fetch(`${API_BASE}/admin/api/wingo/status`);
    const data = await res.json();
    if (data.success && data.games) {
      cachedWingoGames = data.games;
      
      // Update the 4 mode box timers & periods
      ['30s', '1m', '3m', '5m'].forEach(k => {
        const g = data.games[k];
        if (g) {
          const tEl = document.getElementById(`adminWingoTimer${k}`);
          const pEl = document.getElementById(`adminWingoPeriod${k}`);
          if (tEl) tEl.innerText = `${g.timeRemaining}s`;
          if (pEl) pEl.innerText = `Period: ...${(g.currentPeriod || '').slice(-5)}`;
        }
      });

      // Update Dashboard live card (Screenshot 4)
      const activeGame = data.games[currentWingoGame] || data.games['30s'];
      if (activeGame) {
        const dashPeriod = document.getElementById('dashWingoPeriod');
        const dashBets = document.getElementById('dashWingoActiveBets');
        const dashMode = document.getElementById('dashWingoMode');
        const dashOverride = document.getElementById('dashWingoOverride');

        if (dashPeriod) dashPeriod.innerText = activeGame.currentPeriod || '---';
        const bets = activeGame.currentBets || [];
        const poolVol = bets.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);
        if (dashBets) dashBets.innerText = `₹${poolVol.toFixed(2)}`;

        if (dashMode) {
          dashMode.innerText = activeGame.adminMode === 'manual' ? 'Manual Override' : 'Auto (Random)';
          dashMode.className = activeGame.adminMode === 'manual' ? 'dash-box-val text-red' : 'dash-box-val text-green';
        }

        if (dashOverride) {
          if (activeGame.adminMode === 'manual') {
            if (activeGame.adminOverride !== null && activeGame.adminOverride !== undefined) {
              dashOverride.innerText = `Forced #${activeGame.adminOverride}`;
            } else if (activeGame.adminTargetColor || activeGame.adminTargetSize) {
              dashOverride.innerText = `${activeGame.adminTargetColor || ''} ${activeGame.adminTargetSize || ''}`.trim().toUpperCase();
            } else {
              dashOverride.innerText = 'Manual Mode';
            }
          } else {
            dashOverride.innerText = 'None (Fair RNG)';
          }
        }
      }

      if (data.games[currentWingoGame]) {
        updateWingoUI(data.games[currentWingoGame]);
      }
    }
  } catch (err) {
    if (!silent) console.error('Error fetching wingo status:', err);
  }
}

function updateWingoUI(game) {
  if (!game) return;

  const periodEl = document.getElementById('wingoPeriodDisplay');
  const timerEl = document.getElementById('wingoTimerDisplay');
  const betsCountEl = document.getElementById('wingoBetsCount');
  const poolVolEl = document.getElementById('wingoPoolVolume');
  const statusBadge = document.getElementById('wingoPeriodStatusBadge');
  const modeLabel = document.getElementById('wingoCurrentModeLabel');

  if (periodEl) periodEl.innerText = game.currentPeriod || '---';
  if (timerEl) {
    timerEl.innerText = `${game.timeRemaining}s`;
    timerEl.style.color = game.timeRemaining <= 5 ? '#ff4d4f' : '#ffd043';
  }

  if (statusBadge) {
    if (game.timeRemaining <= 5) {
      statusBadge.className = 'capsule-pill pill-rejected';
      statusBadge.innerText = '🔒 Drawing Soon';
    } else {
      statusBadge.className = 'capsule-pill pill-active';
      statusBadge.innerText = 'Betting Open';
    }
  }

  const bets = game.currentBets || [];
  const totalPool = bets.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);
  if (betsCountEl) betsCountEl.innerText = bets.length;
  if (poolVolEl) poolVolEl.innerText = `₹${totalPool.toFixed(2)}`;

  // Override banner
  const banner = document.getElementById('wingoOverrideBanner');
  const previewBall = document.getElementById('wingoTargetBallPreview');
  const titleEl = document.getElementById('wingoOverrideStatusTitle');
  const subEl = document.getElementById('wingoOverrideStatusSub');

  if (game.adminMode === 'manual') {
    if (modeLabel) modeLabel.innerHTML = `<span style="color:#ff4d4f; font-weight:700;">⚠️ MANUAL OVERRIDE ACTIVE</span>`;
    if (banner) banner.classList.add('active-override');

    if (game.adminOverride !== null && game.adminOverride !== undefined) {
      const num = parseInt(game.adminOverride, 10);
      const isGreen = [1, 3, 7, 9].includes(num);
      const bg = num === 0 ? 'linear-gradient(135deg, #8E24AA 50%, #E52539 50%)' :
                 (num === 5 ? 'linear-gradient(135deg, #8E24AA 50%, #28A745 50%)' :
                 (isGreen ? '#28A745' : '#E52539'));
      if (previewBall) {
        previewBall.style.background = bg;
        previewBall.innerText = num;
      }
      if (titleEl) titleEl.innerText = `FORCED WIN: Number ${num} (${num >= 5 ? 'BIG' : 'SMALL'})`;
      if (subEl) subEl.innerText = `Active period ${game.currentPeriod} will settle winning Number ${num}.`;
    } else if (game.adminTargetColor || game.adminTargetSize) {
      const col = game.adminTargetColor ? game.adminTargetColor.toUpperCase() : 'ANY';
      const sz = game.adminTargetSize ? game.adminTargetSize.toUpperCase() : 'ANY';
      if (previewBall) {
        previewBall.style.background = game.adminTargetColor === 'green' ? '#28A745' : (game.adminTargetColor === 'violet' ? '#8E24AA' : '#E52539');
        previewBall.innerText = col[0] || '?';
      }
      if (titleEl) titleEl.innerText = `FORCED COMBO: ${col} + ${sz}`;
      if (subEl) subEl.innerText = `Active period will randomly pick a number matching Color: ${col} & Size: ${sz}.`;
    }
  } else {
    if (modeLabel) modeLabel.innerHTML = `Mode: <span style="color:#00e676;">Fair Automatic RNG</span>`;
    if (banner) banner.classList.remove('active-override');
    if (previewBall) {
      previewBall.style.background = 'rgba(255, 255, 255, 0.08)';
      previewBall.innerText = '?';
    }
    if (titleEl) titleEl.innerText = 'Fair Automatic RNG Active';
    if (subEl) subEl.innerText = 'Round will be drawn naturally using fair server RNG unless overridden below.';
  }

  // Pool Breakdown by Category
  let greenPool = 0, violetPool = 0, redPool = 0, bigPool = 0, smallPool = 0;
  bets.forEach(b => {
    const amt = parseFloat(b.amount) || 0;
    const sel = String(b.selection).toLowerCase();
    if (sel === 'green') greenPool += amt;
    else if (sel === 'violet') violetPool += amt;
    else if (sel === 'red') redPool += amt;
    else if (sel === 'big') bigPool += amt;
    else if (sel === 'small') smallPool += amt;
  });

  const pGreen = document.getElementById('poolAmountGreen');
  const pViolet = document.getElementById('poolAmountViolet');
  const pRed = document.getElementById('poolAmountRed');
  const pBig = document.getElementById('poolAmountBig');
  const pSmall = document.getElementById('poolAmountSmall');

  if (pGreen) pGreen.innerText = `₹${greenPool.toFixed(2)}`;
  if (pViolet) pViolet.innerText = `₹${violetPool.toFixed(2)}`;
  if (pRed) pRed.innerText = `₹${redPool.toFixed(2)}`;
  if (pBig) pBig.innerText = `₹${bigPool.toFixed(2)}`;
  if (pSmall) pSmall.innerText = `₹${smallPool.toFixed(2)}`;

  renderWingoBetsTable(bets);
}

function renderWingoBetsTable(bets) {
  const tbody = document.getElementById('wingoLiveBetsTbody');
  if (!tbody) return;

  if (!bets || bets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No bets placed in this round yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = bets.map(b => {
    const t = b.time ? new Date(b.time).toLocaleTimeString() : 'Just now';
    return `
      <tr>
        <td><strong class="text-white mono-val">UID ${b.uid}</strong></td>
        <td><span class="capsule-pill pill-active">${b.selection}</span></td>
        <td><span class="text-sage text-sm">${b.type || 'Standard'}</span></td>
        <td><strong class="text-gold mono-val">₹${parseFloat(b.amount).toFixed(2)}</strong></td>
        <td><span class="text-sage text-sm mono-val">${t}</span></td>
      </tr>
    `;
  }).join('');
}

async function forceWingoNumber(num) {
  try {
    const res = await fetch(`${API_BASE}/admin/api/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: currentWingoGame, number: num })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`🎯 WinGo ${currentWingoGame}: Forced Number ${num} for active period!`, 'success');
      fetchWingoAdminStatus();
    } else {
      showAdminToast(data.message || 'Failed to force number', 'error');
    }
  } catch (err) {
    console.error('Force number error:', err);
    showAdminToast('Network error setting outcome', 'error');
  }
}

async function forceWingoColor(color) {
  try {
    const res = await fetch(`${API_BASE}/admin/api/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: currentWingoGame, color: color, number: null })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`🎯 WinGo ${currentWingoGame}: Forced Color ${color.toUpperCase()}!`, 'success');
      fetchWingoAdminStatus();
    } else {
      showAdminToast(data.message || 'Failed to force color', 'error');
    }
  } catch (err) {
    console.error('Force color error:', err);
    showAdminToast('Network error setting color', 'error');
  }
}

async function forceWingoSize(size) {
  try {
    const res = await fetch(`${API_BASE}/admin/api/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: currentWingoGame, size: size, number: null })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`🎯 WinGo ${currentWingoGame}: Forced Size ${size.toUpperCase()}!`, 'success');
      fetchWingoAdminStatus();
    } else {
      showAdminToast(data.message || 'Failed to force size', 'error');
    }
  } catch (err) {
    console.error('Force size error:', err);
    showAdminToast('Network error setting size', 'error');
  }
}

async function applyWingoPreset(color, size) {
  try {
    const res = await fetch(`${API_BASE}/admin/api/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: currentWingoGame, color: color, size: size, number: null })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`🎯 WinGo ${currentWingoGame}: Preset Applied (${color.toUpperCase()} + ${size})!`, 'success');
      fetchWingoAdminStatus();
    } else {
      showAdminToast(data.message || 'Failed to apply preset', 'error');
    }
  } catch (err) {
    console.error('Preset error:', err);
    showAdminToast('Network error applying preset', 'error');
  }
}

async function resetWingoOverride() {
  try {
    const res = await fetch(`${API_BASE}/admin/api/mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: currentWingoGame, mode: 'auto' })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`⚡ WinGo ${currentWingoGame}: Reverted to Fair Automatic RNG.`, 'info');
      fetchWingoAdminStatus();
    } else {
      showAdminToast(data.message || 'Failed to reset mode', 'error');
    }
  } catch (err) {
    console.error('Reset mode error:', err);
    showAdminToast('Network error resetting mode', 'error');
  }
}

// ========================================================
// 9. AVIATOR CRASH CONTROLLER (DEDICATED SECTION)
// ========================================================
async function fetchAviatorAdminStatus(silent = false) {
  try {
    const res = await fetch(`${API_BASE}/admin/api/status`);
    const data = await res.json();
    if (data.success && data.aviator) {
      updateAviatorUI(data.aviator);
    }
  } catch (err) {
    if (!silent) console.error('Error fetching aviator status:', err);
  }
}

function updateAviatorUI(aviator) {
  const badge   = document.getElementById('aviatorModeBadge');
  const preview = document.getElementById('aviatorCrashPreview');
  const overSts = document.getElementById('aviOverrideStatus');
  const apEl    = document.getElementById('aviActivePlayers');
  const lastEl  = document.getElementById('aviLastMult');

  if (aviator && aviator.adminOverride !== null && aviator.adminOverride !== undefined) {
    const mult = parseFloat(aviator.adminOverride);
    if (badge)   { badge.className = 'capsule-pill pill-rejected'; badge.innerText = '⚠️ Override Active'; }
    if (preview) { preview.innerText = `${mult.toFixed(2)}x`; preview.style.color = '#ff4d61'; }
    if (overSts) { overSts.innerText = `${mult.toFixed(2)}x Locked`; overSts.style.color = '#ff4d61'; }
  } else {
    if (badge)   { badge.className = 'capsule-pill pill-active'; badge.innerText = '🎲 Fair Auto RNG'; }
    if (preview) { preview.innerText = 'AUTO'; preview.style.color = '#22c55e'; }
    if (overSts) { overSts.innerText = 'None (Auto)'; overSts.style.color = '#22c55e'; }
  }

  if (apEl && aviator && aviator.activePlayers) {
    apEl.innerText = aviator.activePlayers;
  }
  if (lastEl && aviator && aviator.lastMultiplier) {
    const last = parseFloat(aviator.lastMultiplier);
    lastEl.innerText = `${last.toFixed(2)}x`;
    lastEl.style.color = last >= 3 ? '#22c55e' : last >= 2 ? '#eab308' : '#ef4444';
  }

  if (aviator && Array.isArray(aviator.history)) {
    renderAviatorHistory(aviator.history);
  }
}

function renderAviatorHistory(historyList) {
  const el = document.getElementById('aviHistoryList');
  if (!el || !historyList) return;
  el.innerHTML = historyList.map(m => {
    const val = parseFloat(m) || 1.00;
    let cls = 'low';
    if (val >= 10) cls = 'mega';
    else if (val >= 3) cls = 'high';
    else if (val >= 2) cls = 'mid';
    return `<span class="avi-hist-chip ${cls}">${val.toFixed(2)}x</span>`;
  }).join('');
}

function loadAviatorHistory() {
  fetchAviatorAdminStatus();
}

async function forceAviatorCrash(mult) {
  try {
    const res = await fetch(`${API_BASE}/admin/api/set-outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ multiplier: mult })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`✈️ Aviator crash point locked to ${mult.toFixed(2)}x!`, 'success');
      fetchAviatorAdminStatus();
    } else {
      showAdminToast(data.message || 'Failed to set multiplier', 'error');
    }
  } catch (err) {
    console.error('Aviator crash error:', err);
    showAdminToast('Network error setting multiplier', 'error');
  }
}

function submitAviatorCustomCrash() {
  const input = document.getElementById('aviatorCustomInput');
  if (!input) return;
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 1.00) {
    showAdminToast('Multiplier must be at least 1.00x', 'error');
    return;
  }
  forceAviatorCrash(val);
  input.value = '';
}

async function clearAviatorOverride() {
  try {
    const res = await fetch(`${API_BASE}/admin/api/clear-outcome`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showAdminToast('⚡ Aviator reverted to Fair Auto RNG algorithm.', 'info');
      fetchAviatorAdminStatus();
    } else {
      showAdminToast(data.message || 'Failed to clear override', 'error');
    }
  } catch (err) {
    console.error('Clear aviator error:', err);
    showAdminToast('Network error clearing override', 'error');
  }
}

// ========================================================
// 10. TOAST NOTIFICATIONS & MODAL DISMISSALS
// ========================================================
function showAdminToast(message, type = 'info') {
  const container = document.getElementById('adminToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `admin-toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <span class="toast-close" onclick="this.parentElement.remove()">&times;</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

function setupModalDismissals() {
  window.addEventListener('click', (e) => {
    const modalBal = document.getElementById('modalBalance');
    const modalRej = document.getElementById('modalReject');
    if (e.target === modalBal) closeBalanceModal();
    if (e.target === modalRej) closeRejectModal();
  });
}
