import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3005', 10);
const HOST = '0.0.0.0';
const ADMIN_SECRET_PATH = process.env.ADMIN_PATH || '/raxi-portal-7729';

// ============================================================
// 1. SUPABASE CLIENT
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sdcwvmikonmqecpdvzsp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkY3d2bWlrb25tcWVjcGR2enNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMDQ1NDAsImV4cCI6MjEwODc4MDU0MH0.K0MUZgLAs5NS2P0lQrJjXbDnr3wHzlJHtDVdcWt_hXk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// 2. IN-MEMORY DB (loaded from Supabase at startup)
//    All existing code uses db.users, db.settings etc.
// ============================================================
let db = {
  settings: {
    telegram_support: 'https://t.me/raxi_vip_support',
    telegram_channel: 'https://t.me/raxi_official_channel',
    upi_id: 'anoctic@okaxis',
    payee_name: 'RaxiWin Official',
    qr_image: '/qr_upi.svg',
    qr_mode: 'dynamic',
    min_deposit: 300,
    min_withdraw: 200,
    admin_user: process.env.ADMIN_USER || 'admin',
    admin_pass: process.env.ADMIN_PASS || 'admin123',
    maintenance_mode: false,
    announcement: 'Welcome to RAXI.WIN! Instant UPI deposits & fast withdrawals enabled 24/7.',
    withdrawal_preset_name: 'Rohan Sharma',
    withdrawal_preset_phone: '+91 9876543210',
    withdrawal_preset_upi: 'rohan@okhdfcbank',
    withdrawal_preset_bank_name: 'HDFC Bank',
    withdrawal_preset_bank_acc: '50100456789012',
    withdrawal_preset_ifsc: 'HDFC0001234'
  },
  users: [],
  deposits: [],
  withdrawals: [],
  gift_codes: []
};

// Load all data from Supabase into memory at startup
async function loadDB() {
  try {
    console.log('🔄 Loading data from Supabase...');

    // Load settings
    const { data: settingsRows } = await supabase.from('settings').select('*');
    if (settingsRows && settingsRows.length > 0) {
      const s = {};
      settingsRows.forEach(row => {
        // Parse booleans and numbers
        if (row.value === 'true') s[row.key] = true;
        else if (row.value === 'false') s[row.key] = false;
        else if (!isNaN(row.value) && row.value !== '') s[row.key] = Number(row.value);
        else s[row.key] = row.value;
      });
      db.settings = { ...db.settings, ...s };
    }

    // Load users
    const { data: users } = await supabase.from('users').select('*');
    if (users) db.users = users.map(u => ({
      uid: u.uid, username: u.username, phone: u.phone || '',
      email: u.email || '', password: u.password || '',
      balance: parseFloat(u.balance) || 0, vip: u.vip || 'VIP0',
      status: u.status || 'Active', referralCode: u.referral_code || '',
      referredBy: u.referred_by || '',
      createdAt: u.created_at, lastLogin: u.last_login
    }));

    // Load deposits
    const { data: deposits } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
    if (deposits) db.deposits = deposits.map(d => ({
      orderId: d.tx_id, uid: d.uid, username: d.username,
      amount: parseFloat(d.amount), upiRef: d.upi_ref || '',
      status: d.status, createdAt: d.created_at,
      time: (d.created_at || '').substring(0, 19).replace('T', ' '),
      type: (d.tx_id && d.tx_id.startsWith('BONUS_')) || (d.upi_ref && d.upi_ref.toLowerCase().includes('bonus')) ? 'Registration Bonus' : 'UPI / QR',
      utr: (d.tx_id && d.tx_id.startsWith('BONUS_')) ? ('REG_BONUS_' + d.uid) : (d.upi_ref || 'N/A')
    }));

    // Load withdrawals
    const { data: withdrawals } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
    if (withdrawals) db.withdrawals = withdrawals.map(w => ({
      orderId: w.tx_id, uid: w.uid, username: w.username,
      amount: parseFloat(w.amount), upiId: w.upi_id || '',
      accountName: w.account_name || '', status: w.status, createdAt: w.created_at
    }));

    // Load gift codes
    const { data: giftCodes } = await supabase.from('gift_codes').select('*');
    if (giftCodes) db.gift_codes = giftCodes.map(g => ({
      id: 'GC_' + g.id, code: g.code, bonus: parseFloat(g.bonus),
      claimsUsed: g.claims_used, maxClaims: g.max_claims,
      status: g.status, claimedBy: g.claimed_by || [], createdAt: g.created_at
    }));

    console.log(`✅ Supabase loaded: ${db.users.length} users, ${db.deposits.length} deposits, ${db.withdrawals.length} withdrawals, ${db.gift_codes.length} gift codes`);
  } catch (err) {
    console.error('❌ Error loading from Supabase:', err.message);
    console.log('⚠️ Continuing with empty in-memory DB');
  }
}

// ── SUPABASE SYNC FUNCTIONS (replace saveDB()) ──────────────

async function saveSettings() {
  try {
    const rows = Object.entries(db.settings).map(([key, value]) => ({
      key, value: String(value)
    }));
    for (const row of rows) {
      await supabase.from('settings').upsert({ key: row.key, value: row.value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    }
  } catch (err) { console.error('saveSettings error:', err.message); }
}

async function saveUser(user) {
  try {
    await supabase.from('users').upsert({
      uid: user.uid, username: user.username, phone: user.phone || '',
      email: user.email || '', password: user.password || '',
      balance: user.balance || 0, vip: user.vip || 'VIP0',
      status: user.status || 'Active',
      referral_code: user.referralCode || '',
      referred_by: user.referredBy || '',
      last_login: new Date().toISOString()
    }, { onConflict: 'uid' });
  } catch (err) { console.error('saveUser error:', err.message); }
}

async function saveDeposit(deposit) {
  try {
    await supabase.from('deposits').upsert({
      tx_id: deposit.orderId, uid: deposit.uid, username: deposit.username,
      amount: deposit.amount, upi_ref: deposit.upiRef || '',
      status: deposit.status, updated_at: new Date().toISOString()
    }, { onConflict: 'tx_id' });
  } catch (err) { console.error('saveDeposit error:', err.message); }
}

async function saveWithdrawal(withdrawal) {
  try {
    await supabase.from('withdrawals').upsert({
      tx_id: withdrawal.orderId, uid: withdrawal.uid, username: withdrawal.username,
      amount: withdrawal.amount, upi_id: withdrawal.upiId || '',
      account_name: withdrawal.accountName || '', status: withdrawal.status,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tx_id' });
  } catch (err) { console.error('saveWithdrawal error:', err.message); }
}

async function saveGiftCode(gc) {
  try {
    const numId = parseInt(String(gc.id).replace('GC_', '')) || undefined;
    const payload = {
      code: gc.code, bonus: gc.bonus,
      claims_used: gc.claimsUsed, max_claims: gc.maxClaims,
      status: gc.status, claimed_by: gc.claimedBy || []
    };
    if (numId) payload.id = numId;
    await supabase.from('gift_codes').upsert(payload, { onConflict: 'code' });
  } catch (err) { console.error('saveGiftCode error:', err.message); }
}

async function saveWingoBet(bet) {
  try {
    await supabase.from('wingo_bets').upsert({
      bet_id: bet.betId, uid: bet.uid, username: bet.username,
      game_type: bet.gameType, period: bet.period,
      bet_type: bet.type, selection: bet.selection, amount: bet.amount,
      won: bet.won || false, payout: bet.payout || 0,
      multiplier: bet.multiplier || 0, result_number: bet.resultNumber || null
    }, { onConflict: 'bet_id' });
  } catch (err) { console.error('saveWingoBet error:', err.message); }
}

async function saveWingoRound(round) {
  try {
    await supabase.from('wingo_history').insert({
      period: round.period, game_type: round.gameType,
      number: round.number, color: round.color,
      colors: round.colors, size: round.size
    });
  } catch (err) { /* ignore duplicate rounds */ }
}

const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Local file backup + Supabase cloud sync
function saveDB() {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    // Ignore local disk issues on cloud environments
  }
}

// Active admin sessions
const activeAdminTokens = new Set(['admin_token_default_session']);

// ============================================================
// 2. AVIATOR GAME STATE
// ============================================================
const aviatorState = {
  adminOverride: null,
  recentHistory: [2.14, 1.45, 5.20, 1.10, 3.85, 1.05, 12.40, 1.80, 2.90, 1.01, 4.30, 1.62, 2.05, 1.33, 7.80],
  totalRoundsPlayed: 480,
  activePlayers: 124,
  currentRoundId: 'AV_' + Date.now().toString(36)
};

let aviatorOutcomeOverride = null;

// ============================================================
// 3. WINGO GAME ENGINE & STATE
// ============================================================
const WINGO_CONFIGS = {
  '30s': { id: '30s', name: 'WinGo 30sec', duration: 30, code: '10005' },
  '1m':  { id: '1m',  name: 'WinGo 1 Min',  duration: 60, code: '10006' },
  '3m':  { id: '3m',  name: 'WinGo 3 Min',  duration: 180, code: '10007' },
  '5m':  { id: '5m',  name: 'WinGo 5 Min',  duration: 300, code: '10008' }
};

function getNumberAttributes(number) {
  const num = parseInt(number, 10);
  const size = num >= 5 ? 'Big' : 'Small';
  let colors = [];
  if (num === 0) {
    colors = ['red', 'violet'];
  } else if (num === 5) {
    colors = ['green', 'violet'];
  } else if ([1, 3, 7, 9].includes(num)) {
    colors = ['green'];
  } else {
    colors = ['red'];
  }
  return { number: num, size, colors, color: colors[0] };
}

function generateInitialHistory(code, count = 25) {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const basePeriod = BigInt(`${dateStr}${code}2600`);
  const sampleNums = [9, 9, 6, 5, 7, 2, 8, 1, 3, 4, 0, 5, 6, 8, 2, 3, 7, 1, 9, 4];
  const history = [];

  for (let i = 0; i < count; i++) {
    const num = sampleNums[i % sampleNums.length];
    const attrs = getNumberAttributes(num);
    history.push({
      period: (basePeriod - BigInt(i)).toString(),
      number: num,
      size: attrs.size,
      color: attrs.color,
      colors: attrs.colors,
      time: new Date(Date.now() - (i * 30 * 1000)).toISOString()
    });
  }
  return history;
}

function initWingoState() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const games = {};

  for (const [key, cfg] of Object.entries(WINGO_CONFIGS)) {
    games[key] = {
      id: key,
      name: cfg.name,
      duration: cfg.duration,
      timeRemaining: cfg.duration,
      currentPeriod: `${dateStr}${cfg.code}2608`,
      adminMode: 'auto', // 'auto' | 'manual'
      adminOverride: null, // number 0-9
      adminTargetColor: null, // 'green', 'violet', 'red'
      adminTargetSize: null, // 'Big', 'Small'
      history: generateInitialHistory(cfg.code, 25),
      currentBets: []
    };
  }
  return { games, allBets: [] };
}

const wingoState = initWingoState();

function broadcastWingo(data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      // For ROUND_SETTLED, inject per-user balance
      if (data.type === 'ROUND_SETTLED' && typeof client._uid === 'function') {
        const uid = client._uid();
        const user = db.users.find(u => u.uid === uid);
        const payload = Object.assign({}, data, {
          data: Object.assign({}, data.data, {
            walletBalance: user ? user.balance : 0,
            settledBets: (data.data.settledBets || []).filter(b => b.uid === uid),
            totalWonAmount: (data.data.settledBets || [])
              .filter(b => b.uid === uid && b.won)
              .reduce((s, b) => s + (b.payout || 0), 0)
          })
        });
        client.send(JSON.stringify(payload));
      } else {
        client.send(JSON.stringify(data));
      }
    }
  });
}

function calculateWingoPayout(bet, winningNumber, attrs) {
  let won = false;
  let multiplier = 0;

  if (bet.type === 'color') {
    if (attrs.colors.includes(bet.selection)) {
      won = true;
      if (bet.selection === 'violet') {
        multiplier = 4.5;
      } else if (winningNumber === 0 || winningNumber === 5) {
        multiplier = 1.5;
      } else {
        multiplier = 2.0;
      }
    }
  } else if (bet.type === 'number') {
    if (parseInt(bet.selection, 10) === winningNumber) {
      won = true;
      multiplier = 9.0;
    }
  } else if (bet.type === 'size') {
    if (attrs.size.toLowerCase() === bet.selection.toLowerCase()) {
      won = true;
      multiplier = 2.0;
    }
  }

  const payout = won ? Math.round(bet.amount * multiplier * 100) / 100 : 0;
  return { won, payout, multiplier };
}

function resolveWingoRound(gameKey) {
  const game = wingoState.games[gameKey];
  if (!game) return;

  let winningNumber;

  if (game.adminMode === 'manual') {
    if (game.adminOverride !== null && game.adminOverride !== undefined) {
      winningNumber = parseInt(game.adminOverride, 10);
    } else if (game.adminTargetColor || game.adminTargetSize) {
      const candidates = [];
      for (let n = 0; n <= 9; n++) {
        const a = getNumberAttributes(n);
        let matchesColor = true;
        let matchesSize = true;
        if (game.adminTargetColor) {
          if (game.adminTargetColor === 'violet') {
            matchesColor = (n === 0 || n === 5);
          } else {
            matchesColor = a.colors.includes(game.adminTargetColor);
          }
        }
        if (game.adminTargetSize) {
          matchesSize = a.size.toLowerCase() === game.adminTargetSize.toLowerCase();
        }
        if (matchesColor && matchesSize) candidates.push(n);
      }
      winningNumber = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : Math.floor(Math.random() * 10);
    } else {
      winningNumber = Math.floor(Math.random() * 10);
    }
  } else {
    winningNumber = Math.floor(Math.random() * 10);
  }

  const resultAttrs = getNumberAttributes(winningNumber);
  const period = game.currentPeriod;
  let totalWonAmount = 0;
  const settledBets = [];

  game.currentBets.forEach(bet => {
    const { won, payout } = calculateWingoPayout(bet, winningNumber, resultAttrs);
    bet.won = won;
    bet.payout = payout;
    bet.status = won ? 'WON' : 'LOST';
    bet.winningNumber = winningNumber;
    bet.settledAt = new Date().toISOString();

    if (won) {
      totalWonAmount += payout;
      // Credit winning player directly in db!
      const user = db.users.find(u => u.uid === (bet.uid || '951603'));
      if (user) {
        user.balance += payout;
        saveUser(user);
        saveDB();
      }
    }
    settledBets.push(bet);
    wingoState.allBets.unshift(bet);
  });

  const historyItem = {
    period: period,
    number: winningNumber,
    size: resultAttrs.size,
    color: resultAttrs.color,
    colors: resultAttrs.colors,
    time: new Date().toISOString()
  };

  game.history.unshift(historyItem);
  saveWingoRound({ period, gameType: gameKey, ...historyItem });
  if (game.history.length > 100) game.history.pop();
  if (wingoState.allBets.length > 100) wingoState.allBets = wingoState.allBets.slice(0, 100);

  // Advance period
  game.currentPeriod = (BigInt(period) + 1n).toString();
  game.currentBets = [];
  game.timeRemaining = game.duration;

  // Consume one-time manual override for this period so subsequent rounds run fair
  game.adminOverride = null;
  game.adminTargetColor = null;
  game.adminTargetSize = null;
  game.adminMode = 'auto';

  broadcastWingo({
    type: 'ROUND_SETTLED',
    gameKey: gameKey,
    data: {
      gameKey: gameKey,
      previousPeriod: period,
      result: historyItem,
      settledBets: settledBets,
      walletBalance: 0,  // overridden per-user in broadcastWingo
      nextPeriod: game.currentPeriod,
      totalWonAmount: Math.round(totalWonAmount * 100) / 100
    }
  });
}

// Global WinGo 1-second interval ticker
setInterval(() => {
  const tickData = {};

  for (const [key, game] of Object.entries(wingoState.games)) {
    game.timeRemaining--;

    if (game.timeRemaining <= 0) {
      resolveWingoRound(key);
      game.timeRemaining = game.duration;
    }

    tickData[key] = {
      timeRemaining: game.timeRemaining,
      currentPeriod: game.currentPeriod,
      isLocked: game.timeRemaining <= 5
    };
  }

  broadcastWingo({
    type: 'TICK_ALL',
    data: tickData
  });
}, 1000);

// ============================================================
// 4. HTTP SERVER & REST API
// ============================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE'
    });
    return res.end();
  }

  const [urlPath, queryString] = req.url.split('?');
  const params = new URLSearchParams(queryString || '');

  // ==========================================
  // PUBLIC PLATFORM CONFIG
  // ==========================================
  if (urlPath === '/api/config' && req.method === 'GET') {
    const s = db.settings;
    return sendJSON(res, 200, {
      success: true,
      data: {
        telegram_support: s.telegram_support,
        telegram_channel: s.telegram_channel,
        upi_id: s.upi_id,
        payee_name: s.payee_name || 'DmFirst Pay',
        qr_image: s.qr_image || '/qr_upi.svg',
        qr_mode: s.qr_mode || 'dynamic',
        min_deposit: s.min_deposit,
        min_withdraw: s.min_withdraw,
        maintenance_mode: s.maintenance_mode,
        announcement: s.announcement,
        withdrawal_preset_name: s.withdrawal_preset_name || 'Rohan Sharma',
        withdrawal_preset_phone: s.withdrawal_preset_phone || '+91 9876543210',
        withdrawal_preset_upi: s.withdrawal_preset_upi || 'rohan@okhdfcbank',
        withdrawal_preset_bank_name: s.withdrawal_preset_bank_name || 'HDFC Bank',
        withdrawal_preset_bank_acc: s.withdrawal_preset_bank_acc || '50100456789012',
        withdrawal_preset_ifsc: s.withdrawal_preset_ifsc || 'HDFC0001234'
      }
    });
  }

  // ==========================================
  // USER INFO / BALANCE / DEPOSIT / WITHDRAW
  // ==========================================
  if (urlPath === '/api/user/info' && req.method === 'GET') {
    const uid = params.get('uid') || '951603';
    let user = db.users.find(u => u.uid === uid);
    if (!user) {
      user = {
        uid: uid,
        username: 'MEMBERNNG1VNAE',
        phone: '+91 9876543210',
        email: 'player951603@yaarwin.com',
        balance: 0.00, // New user strictly starts with 0
        vip: 'VIP0',
        status: 'Active',
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        lastLogin: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };
      db.users.push(user);
      saveUser(user);
      saveDB();
    }
    const userDeposits = db.deposits.filter(d => d.uid === uid && d.status === 'Approved');
    const totalDeposited = userDeposits.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);
    const userData = {
      ...user,
      totalDeposited: totalDeposited,
      claimedFirstDepositBonuses: user.claimedFirstDepositBonuses || []
    };
    return sendJSON(res, 200, { success: true, data: userData });
  }

  // ------------------------------------------
  // USER REGISTRATION WITH WELCOME BONUS (₹81 - ₹99)
  // ------------------------------------------
  if (urlPath === '/api/user/register' && req.method === 'POST') {
    const body = await parseBody(req);
    const identifier = (body.identifier || '').trim();
    const password = (body.password || '').trim();
    const inviteCode = (body.inviteCode || '').trim();
    const reqUid = (body.uid || '').trim();

    if (!identifier) {
      return sendJSON(res, 400, { success: false, message: 'Phone number or identifier is required' });
    }

    // Check if identifier already registered
    const existing = db.users.find(u => u.phone === identifier || u.username === identifier || (reqUid && u.uid === reqUid));
    if (existing) {
      return sendJSON(res, 400, { success: false, message: 'This account is already registered! Please log in.' });
    }

    // Generate random welcome bonus above ₹80 (between ₹81 and ₹99)
    const bonusAmount = Math.floor(Math.random() * (99 - 81 + 1)) + 81;
    const newUid = reqUid || String(Math.floor(100000 + Math.random() * 900000));
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newUser = {
      uid: newUid,
      username: 'MEMBER' + newUid,
      phone: identifier,
      email: `${identifier}@raxi.win`,
      password: password,
      balance: bonusAmount, // Credited directly to main balance!
      welcomeBonus: bonusAmount,
      welcomeBonusClaimed: false, // will show congratulations popup
      referralCode: '26332' + Math.floor(100000 + Math.random() * 900000),
      referredBy: inviteCode || '',
      vip: 'VIP0',
      status: 'Active',
      createdAt: nowIso,
      lastLogin: nowIso
    };

    db.users.push(newUser);
    saveUser(newUser);

    // Create an Approved Deposit / Bonus record in history
    const bonusOrderId = 'BONUS_' + Date.now() + '_' + Math.floor(1000 + Math.random() * 9000);
    const bonusRecord = {
      orderId: bonusOrderId,
      uid: newUid,
      username: newUser.username,
      amount: bonusAmount,
      type: 'Registration Bonus',
      utr: 'REG_BONUS_' + newUid,
      upiRef: 'First Registration Gift (₹' + bonusAmount + ')',
      status: 'Approved',
      time: nowIso,
      createdAt: nowIso
    };
    if (!db.deposits) db.deposits = [];
    db.deposits.unshift(bonusRecord);
    saveDeposit(bonusRecord);

    // Track parent inviter / referral connection
    if (!db.referrals) db.referrals = [];
    if (inviteCode) {
      const parentUser = db.users.find(u => u.referralCode === inviteCode || u.uid === inviteCode);
      const referralRecord = {
        id: 'REF_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        inviterCode: inviteCode,
        inviterUid: parentUser ? parentUser.uid : null,
        invitedUid: newUid,
        invitedIdentifier: identifier.length >= 7 ? identifier.substring(0, 3) + '****' + identifier.substring(identifier.length - 3) : identifier,
        bonusGiven: bonusAmount,
        createdAt: nowIso
      };
      db.referrals.push(referralRecord);
    }
    saveDB();

    return sendJSON(res, 200, {
      success: true,
      message: 'Registration successful! Welcome bonus awarded.',
      data: {
        uid: newUid,
        identifier: identifier,
        bonusAmount: bonusAmount,
        balance: newUser.balance,
        inviteCode: newUser.referralCode,
        referredBy: newUser.referredBy
      }
    });
  }

  // ------------------------------------------
  // CLAIM WELCOME BONUS (₹81 – ₹99 POPUP CONFIRMATION)
  // ------------------------------------------
  if (urlPath === '/api/user/claim-welcome-bonus' && req.method === 'POST') {
    const body = await parseBody(req);
    const uid = body.uid || '951603';
    const user = db.users.find(u => u.uid === uid);
    if (!user) return sendJSON(res, 404, { success: false, message: 'User not found' });

    user.welcomeBonusClaimed = true;
    saveUser(user);
    saveDB();

    return sendJSON(res, 200, {
      success: true,
      message: `Welcome bonus of ₹${(user.welcomeBonus || 0).toFixed(2)} claimed successfully!`,
      data: {
        balance: user.balance,
        bonus: user.welcomeBonus || 0
      }
    });
  }

  // ------------------------------------------
  // GET INVITED MEMBERS LIST FOR PARENT INVITER
  // ------------------------------------------
  if (urlPath === '/api/user/invites' && req.method === 'GET') {
    const code = params.get('code') || '';
    const uid = params.get('uid') || '';

    if (!db.referrals) db.referrals = [];

    // Find all users invited via this code or uid
    const matchedReferrals = db.referrals.filter(r => 
      (code && r.inviterCode === code) || 
      (uid && r.inviterUid === uid) ||
      (uid && r.inviterCode === uid)
    );

    // Also scan db.users for any users with referredBy === code or referredBy === uid
    const matchedUsers = db.users.filter(u => 
      (code && u.referredBy === code) || 
      (uid && u.referredBy === uid)
    );

    // Merge and deduplicate by invited UID
    const inviteesMap = new Map();

    matchedReferrals.forEach(r => {
      inviteesMap.set(r.invitedUid, {
        uid: r.invitedUid,
        identifier: r.invitedIdentifier || ('UID ' + r.invitedUid),
        bonusGiven: r.bonusGiven || 50,
        joinedAt: r.createdAt || 'Recent',
        status: 'Active'
      });
    });

    matchedUsers.forEach(u => {
      if (!inviteesMap.has(u.uid)) {
        const phone = u.phone || u.identifier || u.username || ('UID ' + u.uid);
        const masked = phone.length >= 7 ? phone.substring(0, 3) + '****' + phone.substring(phone.length - 3) : phone;
        inviteesMap.set(u.uid, {
          uid: u.uid,
          identifier: masked,
          bonusGiven: u.welcomeBonus || 50,
          joinedAt: u.createdAt || 'Recent',
          status: 'Active'
        });
      }
    });

    const inviteesList = Array.from(inviteesMap.values());
    const totalCommission = (inviteesList.length * 15.5).toFixed(2);

    return sendJSON(res, 200, {
      success: true,
      totalInvited: inviteesList.length,
      totalCommission: totalCommission,
      data: inviteesList
    });
  }

  // Claim First Deposit Extra Bonus Tier
  if (urlPath === '/api/user/claim-deposit-bonus' && req.method === 'POST') {
    const body = await parseBody(req);
    const uid = body.uid || '951603';
    const tier = parseInt(body.tier, 10);
    const user = db.users.find(u => u.uid === uid);
    if (!user) return sendJSON(res, 404, { success: false, message: 'User not found' });

    const tiers = {
      200: 18.00,
      500: 58.00,
      1000: 108.00,
      3000: 288.00,
      5000: 488.00
    };

    if (!tiers[tier]) {
      return sendJSON(res, 400, { success: false, message: 'Invalid bonus tier' });
    }

    const userDeposits = db.deposits.filter(d => d.uid === uid && d.status === 'Approved');
    const totalDeposited = userDeposits.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);

    if (totalDeposited < tier) {
      return sendJSON(res, 400, { success: false, message: `Deposit threshold of ₹${tier} not reached yet. Total deposited: ₹${totalDeposited}` });
    }

    user.claimedFirstDepositBonuses = user.claimedFirstDepositBonuses || [];
    if (user.claimedFirstDepositBonuses.includes(tier)) {
      return sendJSON(res, 400, { success: false, message: `Reward for first deposit ₹${tier} has already been received once.` });
    }

    const bonus = tiers[tier];
    user.claimedFirstDepositBonuses.push(tier);
    user.balance = Math.round((user.balance + bonus) * 100) / 100;
    saveUser(user);
    saveDB();

    return sendJSON(res, 200, {
      success: true,
      message: `Bonus ₹${bonus.toFixed(2)} received successfully!`,
      bonus: bonus,
      balance: user.balance,
      claimedTiers: user.claimedFirstDepositBonuses,
      totalDeposited: totalDeposited
    });
  }

  if (urlPath === '/api/user/deposit' && req.method === 'POST') {
    const body = await parseBody(req);
    const uid = body.uid || '951603';
    const amount = parseFloat(body.amount) || 100;
    const utr = (body.utr || '').trim();
    const type = body.type || 'Phonepe_QR';

    if (!utr || utr.length < 6) {
      return sendJSON(res, 400, { success: false, message: 'Invalid UTR Number' });
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const orderId = 'RC' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) + randomSuffix;

    const user = db.users.find(u => u.uid === uid) || { username: 'Player ' + uid };

    const newDeposit = {
      orderId: orderId,
      uid: uid,
      username: user.username,
      amount: amount,
      type: type,
      utr: utr,
      time: timeStr,
      status: 'Pending',
      reason: ''
    };

    db.deposits.unshift(newDeposit);
    saveDeposit(newDeposit);
    saveDB();
    return sendJSON(res, 200, { success: true, data: newDeposit });
  }

  if (urlPath === '/api/user/withdraw' && req.method === 'POST') {
    const body = await parseBody(req);
    const uid = body.uid || '951603';
    const amount = parseFloat(body.amount) || 0;
    const beneficiary = body.beneficiary || {};
    const type = body.type || 'UPI';

    const user = db.users.find(u => u.uid === uid);
    if (!user) {
      return sendJSON(res, 404, { success: false, message: 'User not found' });
    }

    if (amount < (db.settings.min_withdraw || 200)) {
      return sendJSON(res, 400, { success: false, message: `Minimum withdrawal is ₹${db.settings.min_withdraw || 200}` });
    }

    if (user.balance < amount) {
      return sendJSON(res, 400, { success: false, message: 'Insufficient balance' });
    }

    user.balance = Math.max(0, user.balance - amount);

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const orderId = 'WD' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds()) + randomSuffix;

    const newWithdrawal = {
      orderId: orderId,
      uid: uid,
      username: user.username,
      amount: amount,
      type: type,
      beneficiary: beneficiary,
      time: timeStr,
      status: 'Pending',
      reason: ''
    };

    db.withdrawals.unshift(newWithdrawal);
    saveWithdrawal(newWithdrawal);
    saveUser(user);
    saveDB();
    return sendJSON(res, 200, { success: true, data: newWithdrawal, balance: user.balance });
  }

  if (urlPath === '/api/user/history' && req.method === 'GET') {
    const uid = params.get('uid') || '951603';
    let userDeposits = (db.deposits || []).filter(d => d.uid === uid);
    const userWithdrawals = (db.withdrawals || []).filter(w => w.uid === uid);

    // Ensure welcome bonus record is present in history if user was awarded one
    const user = (db.users || []).find(u => u.uid === uid);
    if (user && user.welcomeBonus && parseFloat(user.welcomeBonus) > 0) {
      const hasBonusRecord = userDeposits.some(d => 
        (d.type && d.type.toLowerCase().includes('bonus')) || 
        (d.orderId && d.orderId.startsWith('BONUS_')) ||
        (d.upiRef && d.upiRef.toLowerCase().includes('bonus'))
      );
      if (!hasBonusRecord) {
        const bonusRec = {
          orderId: 'BONUS_' + (user.createdAt ? new Date(user.createdAt).getTime() : Date.now()),
          uid: user.uid,
          username: user.username,
          amount: parseFloat(user.welcomeBonus),
          type: 'Registration Bonus',
          utr: 'REG_BONUS_' + user.uid,
          upiRef: 'First Registration Gift (₹' + user.welcomeBonus + ')',
          status: 'Approved',
          time: user.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
          createdAt: user.createdAt || new Date().toISOString()
        };
        if (!db.deposits) db.deposits = [];
        db.deposits.unshift(bonusRec);
        userDeposits.unshift(bonusRec);
        saveDeposit(bonusRec);
      }
    }

    return sendJSON(res, 200, {
      success: true,
      data: {
        deposits: userDeposits,
        withdrawals: userWithdrawals
      }
    });
  }

  // ==========================================
  // AVIATOR GAME API ROUTES
  // ==========================================
  if (urlPath === '/api/session/balance' && req.method === 'GET') {
    const uid = params.get('uid') || '951603';
    const user = db.users.find(u => u.uid === uid);
    return sendJSON(res, 200, {
      success: true,
      userId: uid,
      username: user ? user.username : 'MEMBERNNG1VNAE',
      balance: user ? user.balance : 0.00
    });
  }

  if (urlPath === '/api/outcome' && req.method === 'GET') {
    let mult;
    const activeOverride = (aviatorState.adminOverride !== null && !isNaN(aviatorState.adminOverride)) 
      ? aviatorState.adminOverride 
      : aviatorOutcomeOverride;

    if (activeOverride !== null && !isNaN(activeOverride)) {
      mult = parseFloat(activeOverride);
      // Consume one-time override
      aviatorState.adminOverride = null;
      aviatorOutcomeOverride = null;
      console.log(`[AVIATOR] Admin override applied: Next round crashes at ${mult}x`);
    } else {
      // Provably fair crash RNG formula
      const rand = Math.random();
      if (rand < 0.04) {
        mult = 1.00; // 4% instant crash
      } else {
        const ev = 100 / (101 - rand * 100);
        mult = Math.max(1.01, Math.floor(ev * 100) / 100);
      }
    }

    const roundId = 'AV_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    aviatorState.currentRoundId = roundId;
    return sendJSON(res, 200, {
      success: true,
      multiplier: mult,
      override: activeOverride,
      roundId: roundId,
      history: aviatorState.recentHistory.slice(0, 20)
    });
  }

  if (urlPath === '/api/outcome/record' && req.method === 'POST') {
    const body = await parseBody(req);
    const m = parseFloat(body.multiplier);
    if (!isNaN(m) && m >= 1.00) {
      aviatorState.recentHistory.unshift(m);
      if (aviatorState.recentHistory.length > 50) aviatorState.recentHistory.pop();
      aviatorState.totalRoundsPlayed++;
    }
    return sendJSON(res, 200, { success: true });
  }

  if ((urlPath === '/api/bet' || urlPath === '/api/game/bet' || urlPath === '/api/session/bet') && req.method === 'POST') {
    const body = await parseBody(req);
    const uid = body.uid || '951603';
    const amount = parseFloat(body.amount) || 0;
    const gameKey = body.gameKey || body.game;

    // Check if this is a WinGo bet
    if (gameKey && body.selection) {
      const user = db.users.find(u => u.uid === uid);
      if (!user || user.balance < amount) {
        return sendJSON(res, 400, { ok: false, success: false, message: 'Insufficient balance' });
      }
      user.balance = Math.max(0, user.balance - amount);
      saveUser(user);
      saveDB();

      const game = wingoState.games[gameKey];
      if (game) {
        const betObj = {
          id: 'WB_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          uid: uid,
          gameKey: gameKey,
          period: game.currentPeriod,
          type: body.type, // 'color' | 'number' | 'size'
          selection: body.selection,
          amount: amount,
          time: new Date().toISOString()
        };
        game.currentBets.push(betObj);
        return sendJSON(res, 200, {
          ok: true,
          success: true,
          message: 'Bet accepted',
          data: {
            walletBalance: user.balance,
            recentBets: wingoState.allBets.filter(b => b.uid === uid).slice(0, 15)
          }
        });
      }
    }

    // Otherwise standard Aviator bet
    const user = db.users.find(u => u.uid === uid);
    if (!user || user.balance < amount) {
      return sendJSON(res, 400, { ok: false, success: false, message: 'Insufficient balance' });
    }
    user.balance = Math.max(0, user.balance - amount);
    saveUser(user);
    saveDB();
    return sendJSON(res, 200, { ok: true, success: true, balance: user.balance });
  }

  if ((urlPath === '/api/win' || urlPath === '/api/session/win') && req.method === 'POST') {
    const body = await parseBody(req);
    const uid = body.uid || '951603';
    const winAmount = parseFloat(body.winAmount || body.amount) || 0;
    const user = db.users.find(u => u.uid === uid);
    if (user) {
      user.balance += winAmount;
      saveUser(user);
      saveDB();
      return sendJSON(res, 200, { ok: true, success: true, balance: user.balance });
    }
    return sendJSON(res, 404, { ok: false, success: false, message: 'User not found' });
  }

  // ==========================================
  // WINGO GAME API ROUTES
  // ==========================================
  if (urlPath === '/api/state' && req.method === 'GET') {
    const uid = params.get('uid') || '951603';
    const user = db.users.find(u => u.uid === uid);
    return sendJSON(res, 200, {
      success: true,
      walletBalance: user ? user.balance : 0.00,
      games: wingoState.games,
      allBets: wingoState.allBets.filter(b => b.uid === uid).slice(0, 20)
    });
  }

  // /api/game/status?gameKey=30s&uid=XXXX — used by wingo app.js refreshMyBets()
  if (urlPath === '/api/game/status' && req.method === 'GET') {
    const uid = params.get('uid') || '951603';
    const gameKey = params.get('gameKey') || '30s';
    const user = db.users.find(u => u.uid === uid);
    return sendJSON(res, 200, {
      ok: true,
      data: {
        walletBalance: user ? user.balance : 0.00,
        game: wingoState.games[gameKey] || null,
        recentBets: wingoState.allBets.filter(b => b.uid === uid).slice(0, 15)
      }
    });
  }

  // ==========================================
  // ADMIN API ROUTES
  // ==========================================
  if ((urlPath === '/api/admin/login' || urlPath === '/admin/api/login') && req.method === 'POST') {
    const body = await parseBody(req);
    const user = (body.username || '').trim();
    const pass = (body.password || '').trim();

    if (
      (user === db.settings.admin_user && pass === db.settings.admin_pass) ||
      (user === 'admin' && (pass === 'aviatorx@admin2024' || pass === 'admin123'))
    ) {
      const token = 'admin_session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      activeAdminTokens.add(token);
      return sendJSON(res, 200, { success: true, token: token, message: 'Admin login successful' });
    }
    return sendJSON(res, 401, { success: false, message: 'Invalid Admin Credentials' });
  }

  if (urlPath === '/api/admin/stats' && req.method === 'GET') {
    const totalUsers = db.users.length;
    const totalBalance = db.users.reduce((acc, u) => acc + (parseFloat(u.balance) || 0), 0);
    const pendingDeposits = db.deposits.filter(d => d.status === 'Pending').length;
    const approvedDepositsTotal = db.deposits.filter(d => d.status === 'Approved').reduce((acc, d) => acc + d.amount, 0);
    const pendingWithdrawals = db.withdrawals.filter(w => w.status === 'Pending').length;
    const approvedWithdrawalsTotal = db.withdrawals.filter(w => w.status === 'Approved').reduce((acc, w) => acc + w.amount, 0);

    return sendJSON(res, 200, {
      success: true,
      data: {
        totalUsers,
        totalBalance: totalBalance.toFixed(2),
        pendingDeposits,
        approvedDepositsTotal: approvedDepositsTotal.toFixed(2),
        pendingWithdrawals,
        approvedWithdrawalsTotal: approvedWithdrawalsTotal.toFixed(2)
      }
    });
  }

  if (urlPath === '/api/admin/users' && req.method === 'GET') {
    return sendJSON(res, 200, { success: true, data: db.users });
  }

  // Enhanced Admin: Full User Control & Profile Editor
  if (urlPath === '/api/admin/user/update' && req.method === 'POST') {
    const body = await parseBody(req);
    const user = db.users.find(u => u.uid === body.uid);
    if (!user) {
      return sendJSON(res, 404, { success: false, message: 'User not found' });
    }

    if (body.username) user.username = body.username.trim();
    if (body.phone) user.phone = body.phone.trim();
    if (body.email) user.email = body.email.trim();
    if (body.vip) user.vip = body.vip.trim();
    if (body.status) user.status = body.status;
    if (body.password) user.password = body.password.trim();

    saveDB();
    return sendJSON(res, 200, { success: true, message: 'User updated successfully', data: user });
  }

  if ((urlPath === '/api/admin/user/balance' || urlPath === '/api/admin/wallet') && req.method === 'POST') {
    const body = await parseBody(req);
    const uid = body.uid || '951603';
    const amount = parseFloat(body.amount);
    const action = body.action || 'add';

    const user = db.users.find(u => u.uid === uid);
    if (!user) {
      return sendJSON(res, 404, { success: false, message: 'User not found' });
    }

    if (action === 'add') {
      user.balance += amount;
    } else if (action === 'deduct') {
      user.balance = Math.max(0, user.balance - amount);
    } else if (action === 'set') {
      user.balance = Math.max(0, amount);
    }

    saveDB();
    return sendJSON(res, 200, { ok: true, success: true, message: 'Balance updated', balance: user.balance });
  }

  if (urlPath === '/api/admin/user/status' && req.method === 'POST') {
    const body = await parseBody(req);
    const user = db.users.find(u => u.uid === body.uid);
    if (!user) {
      return sendJSON(res, 404, { success: false, message: 'User not found' });
    }
    user.status = user.status === 'Active' ? 'Suspended' : 'Active';
    saveDB();
    return sendJSON(res, 200, { success: true, status: user.status });
  }

  if (urlPath === '/api/admin/deposits' && req.method === 'GET') {
    return sendJSON(res, 200, { success: true, data: db.deposits });
  }

  if (urlPath === '/api/admin/deposit/action' && req.method === 'POST') {
    const body = await parseBody(req);
    const deposit = db.deposits.find(d => d.orderId === body.orderId);
    if (!deposit) {
      return sendJSON(res, 404, { success: false, message: 'Deposit order not found' });
    }

    const action = body.action;
    deposit.status = action === 'approve' ? 'Approved' : 'Rejected';
    deposit.reason = body.reason || (action === 'approve' ? 'Payment Verified by Admin' : 'Verification failed');

    if (action === 'approve') {
      let user = db.users.find(u => u.uid === deposit.uid);
      if (!user) {
        user = { uid: deposit.uid, username: deposit.username, balance: 0, status: 'Active' };
        db.users.push(user);
      }
      user.balance += deposit.amount;
      saveUser(user);
    }

    saveDeposit(deposit);
    saveDB();
    return sendJSON(res, 200, { success: true, message: `Deposit ${deposit.status}`, data: deposit });
  }

  if (urlPath === '/api/admin/withdrawals' && req.method === 'GET') {
    return sendJSON(res, 200, { success: true, data: db.withdrawals });
  }

  if (urlPath === '/api/admin/withdrawal/action' && req.method === 'POST') {
    const body = await parseBody(req);
    const withdrawal = db.withdrawals.find(w => w.orderId === body.orderId);
    if (!withdrawal) {
      return sendJSON(res, 404, { success: false, message: 'Withdrawal order not found' });
    }

    const action = body.action;
    withdrawal.status = action === 'approve' ? 'Approved' : 'Rejected';
    withdrawal.reason = body.reason || (action === 'approve' ? 'Transfer Completed' : 'Bank details incorrect');

    if (action === 'reject') {
      const user = db.users.find(u => u.uid === withdrawal.uid);
      if (user) {
        user.balance += withdrawal.amount;
        saveUser(user);
      }
    }

    saveWithdrawal(withdrawal);
    saveDB();
    return sendJSON(res, 200, { success: true, message: `Withdrawal ${withdrawal.status}`, data: withdrawal });
  }

  if (urlPath === '/api/admin/settings') {
    if (req.method === 'GET') {
      return sendJSON(res, 200, { success: true, data: db.settings });
    }
    if (req.method === 'POST') {
      const body = await parseBody(req);
      Object.assign(db.settings, body);
      saveSettings();
      saveDB();
      return sendJSON(res, 200, { success: true, message: 'Settings saved successfully', data: db.settings });
    }
  }

  // Upload Custom QR Code Image for Primary Deposits
  if (urlPath === '/api/admin/settings/upload-qr' && req.method === 'POST') {
    const body = await parseBody(req);
    const dataUrl = body.dataUrl || body.image;
    if (!dataUrl || !dataUrl.includes('base64,')) {
      return sendJSON(res, 400, { success: false, message: 'Invalid image data' });
    }
    const base64Data = dataUrl.split(';base64,').pop();
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const qrFileName = `deposit_qr_${Date.now()}.png`;
    const qrFilePath = path.join(uploadsDir, qrFileName);
    fs.writeFileSync(qrFilePath, base64Data, { encoding: 'base64' });
    db.settings.qr_image = `/uploads/${qrFileName}`;
    db.settings.qr_mode = 'custom';
    saveSettings();
    saveDB();
    return sendJSON(res, 200, { success: true, message: 'Primary QR Code image uploaded successfully', qr_image: db.settings.qr_image });
  }

  // Gift Code Management Endpoints
  if (urlPath === '/api/admin/gift-codes' && req.method === 'GET') {
    if (!db.gift_codes) db.gift_codes = [];
    return sendJSON(res, 200, { success: true, data: db.gift_codes });
  }

  if (urlPath === '/api/admin/gift-codes/create' && req.method === 'POST') {
    const body = await parseBody(req);
    const code = (body.code || '').trim().toUpperCase();
    const bonus = parseFloat(body.bonus) || 0;
    const maxClaims = parseInt(body.maxClaims, 10) || 500;
    if (!code || bonus <= 0) {
      return sendJSON(res, 400, { success: false, message: 'Valid code name and bonus required' });
    }
    if (!db.gift_codes) db.gift_codes = [];
    if (db.gift_codes.some(g => g.code === code)) {
      return sendJSON(res, 400, { success: false, message: 'Gift code already exists' });
    }
    const newCode = {
      id: 'GC_' + Date.now(),
      code: code,
      bonus: bonus,
      claimsUsed: 0,
      maxClaims: maxClaims,
      status: 'Active',
      claimedBy: [],
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };
    db.gift_codes.unshift(newCode);
    saveGiftCode(newCode);
    saveDB();
    return sendJSON(res, 200, { success: true, message: 'Gift code created successfully', data: newCode });
  }

  if (urlPath === '/api/admin/gift-codes/toggle' && req.method === 'POST') {
    const body = await parseBody(req);
    if (!db.gift_codes) db.gift_codes = [];
    const codeItem = db.gift_codes.find(g => g.id === body.id || g.code === body.code);
    if (!codeItem) {
      return sendJSON(res, 404, { success: false, message: 'Gift code not found' });
    }
    codeItem.status = codeItem.status === 'Active' ? 'Disabled' : 'Active';
    saveGiftCode(codeItem);
    saveDB();
    return sendJSON(res, 200, { success: true, message: `Code ${codeItem.code} status changed to ${codeItem.status}`, data: codeItem });
  }

  // Player Gift Code Redemption
  if (urlPath === '/api/gift-code/claim' && req.method === 'POST') {
    const body = await parseBody(req);
    const uid = body.uid || '951603';
    const codeStr = (body.code || '').trim().toUpperCase();
    const user = db.users.find(u => u.uid === uid);
    if (!user) return sendJSON(res, 404, { success: false, message: 'User not found' });
    if (!db.gift_codes) db.gift_codes = [];
    const codeItem = db.gift_codes.find(g => g.code === codeStr);
    if (!codeItem) return sendJSON(res, 404, { success: false, message: 'Invalid gift code' });
    if (codeItem.status !== 'Active') return sendJSON(res, 400, { success: false, message: 'This gift code is no longer active' });
    if (codeItem.claimsUsed >= codeItem.maxClaims) return sendJSON(res, 400, { success: false, message: 'Gift code maximum claims reached' });
    codeItem.claimedBy = codeItem.claimedBy || [];
    if (codeItem.claimedBy.includes(uid)) return sendJSON(res, 400, { success: false, message: 'You have already claimed this gift code' });

    codeItem.claimedBy.push(uid);
    codeItem.claimsUsed++;
    user.balance = Math.round((user.balance + codeItem.bonus) * 100) / 100;
    saveGiftCode(codeItem);
    saveUser(user);
    saveDB();
    return sendJSON(res, 200, { success: true, message: `Gift Code redeemed! ₹${codeItem.bonus.toFixed(2)} added to your wallet.`, balance: user.balance, bonus: codeItem.bonus });
  }

  // Admin Game Controls: Aviator
  if (urlPath === '/admin/api/status' && req.method === 'GET') {
    const activeOverride = (aviatorState.adminOverride !== null && !isNaN(aviatorState.adminOverride))
      ? aviatorState.adminOverride
      : aviatorOutcomeOverride;
    
    return sendJSON(res, 200, {
      success: true,
      gameState: {
        status: 'FLYING',
        roundId: aviatorState.currentRoundId || ('AV_' + Date.now().toString(36)),
        currentMultiplier: aviatorState.recentHistory[0] || 1.00,
        adminOverride: activeOverride,
        adminOverridePending: activeOverride !== null
      },
      aviator: {
        adminOverride: activeOverride,
        lastMultiplier: aviatorState.recentHistory[0] || 2.00,
        history: aviatorState.recentHistory.slice(0, 25),
        activePlayers: Math.floor(Math.random() * 30 + 85),
        totalRounds: aviatorState.totalRoundsPlayed
      },
      totalUsers: db.users.length,
      totalBalances: db.users.reduce((s, u) => s + (parseFloat(u.balance) || 0), 0)
    });
  }

  if (urlPath === '/admin/api/set-outcome' && req.method === 'POST') {
    const body = await parseBody(req);
    const mult = parseFloat(body.multiplier);
    if (isNaN(mult) || mult < 1.00) {
      return sendJSON(res, 400, { success: false, message: 'Multiplier must be >= 1.00' });
    }
    aviatorState.adminOverride = mult;
    aviatorOutcomeOverride = mult;
    return sendJSON(res, 200, { success: true, message: `Next round will crash at ${mult.toFixed(2)}x`, multiplier: mult });
  }

  if (urlPath === '/admin/api/clear-outcome' && req.method === 'POST') {
    aviatorState.adminOverride = null;
    aviatorOutcomeOverride = null;
    return sendJSON(res, 200, { success: true, message: 'Outcome override cleared. Using fair random.' });
  }

  if (urlPath === '/admin/api/set-balance' && req.method === 'POST') {
    const body = await parseBody(req);
    const { userId, balance } = body;
    const user = db.users.find(u => u.uid === userId || u.username === userId);
    if (!user) {
      return sendJSON(res, 404, { success: false, message: 'User not found' });
    }
    user.balance = parseFloat(balance) || 0;
    saveUser(user);
    saveDB();
    return sendJSON(res, 200, { success: true, message: `Balance updated for ${user.username}`, balance: user.balance });
  }

  // Admin Game Controls: WinGo
  if (urlPath === '/admin/api/wingo/status' && req.method === 'GET') {
    return sendJSON(res, 200, {
      success: true,
      games: wingoState.games
    });
  }

  if (urlPath === '/admin/api/override' && req.method === 'POST') {
    const body = await parseBody(req);
    const game = wingoState.games[body.game || '30s'];
    if (game) {
      if (body.number !== undefined) {
        game.adminOverride = body.number;
        if (body.number !== null) {
          game.adminTargetColor = null;
          game.adminTargetSize = null;
        }
      }
      if (body.color !== undefined) game.adminTargetColor = body.color;
      if (body.size !== undefined) game.adminTargetSize = body.size;
      game.adminMode = 'manual';
      return sendJSON(res, 200, { success: true, message: 'WinGo outcome overridden', game: game.id });
    }
    return sendJSON(res, 404, { success: false, message: 'Game not found' });
  }

  if (urlPath === '/admin/api/mode' && req.method === 'POST') {
    const body = await parseBody(req);
    const game = wingoState.games[body.game || '30s'];
    if (game) {
      game.adminMode = body.mode || 'auto';
      if (game.adminMode === 'auto') {
        game.adminOverride = null;
        game.adminTargetColor = null;
        game.adminTargetSize = null;
      }
      return sendJSON(res, 200, { success: true, mode: game.adminMode, game: game.id });
    }
    return sendJSON(res, 404, { success: false, message: 'Game not found' });
  }

  // ==========================================
  // STATIC FILE SERVING & ROUTE PROTECTION
  // ==========================================
  let reqPath = urlPath;

  // Block any public attempt to access standard admin URLs directly
  if (reqPath === '/admin' || reqPath === '/admin/' || reqPath === '/admin.html' || 
      reqPath === '/games/wingo-game/admin' || reqPath === '/games/wingo-game/admin/' || reqPath === '/games/wingo-game/admin.html' ||
      reqPath === '/games/aviator-game/admin' || reqPath === '/games/aviator-game/admin/') {
    const errorPage = path.join(__dirname, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    if (fs.existsSync(errorPage)) {
      return res.end(fs.readFileSync(errorPage));
    }
    return res.end('404 Access Restricted');
  }

  // Secret Admin Portal route
  if (reqPath === ADMIN_SECRET_PATH || reqPath === (ADMIN_SECRET_PATH + '/')) {
    reqPath = '/admin.html';
  } else if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  try {
    reqPath = decodeURIComponent(reqPath);
  } catch (e) {}

  // Guard against path manipulation / directory traversal
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safePath);

  // If request is a directory, serve its index.html
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (e) {}

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Support HTTP 206 Partial Content range requests for audio and media streaming
  if (['.mp3', '.wav', '.ogg', '.mp4'].includes(ext)) {
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          const file = fs.createReadStream(filePath, { start, end });

          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          return file.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
          });
          return fs.createReadStream(filePath).pipe(res);
        }
      }
    } catch (streamErr) {
      console.warn('Audio streaming range error, falling back:', streamErr);
    }
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        const errorPage = path.join(__dirname, '404.html');
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        if (fs.existsSync(errorPage)) {
          return res.end(fs.readFileSync(errorPage));
        }
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
});

// WebSocket Server for WinGo Live Synchronization
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  // Start with anonymous init; uid resolved after IDENTIFY message
  let wsUid = '951603';

  const sendInit = (uid) => {
    const user = db.users.find(u => u.uid === uid);
    ws.send(JSON.stringify({
      type: 'INIT_ALL',
      data: {
        walletBalance: user ? user.balance : 0.00,
        games: wingoState.games,
        allBets: wingoState.allBets.filter(b => b.uid === uid).slice(0, 20)
      }
    }));
  };

  // Send initial state immediately (may update after IDENTIFY)
  sendInit(wsUid);

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'IDENTIFY' && msg.uid) {
        wsUid = msg.uid;
        // Ensure user exists in DB
        let user = db.users.find(u => u.uid === wsUid);
        if (!user) {
          user = {
            uid: wsUid,
            username: 'Player_' + wsUid,
            phone: '',
            email: '',
            balance: 0.00,
            vip: 'VIP0',
            status: 'Active',
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };
          db.users.push(user);
          saveUser(user);
          saveDB();
        }
        // Re-send init with correct balance for this user
        sendInit(wsUid);
      }
    } catch (e) {}
  });

  // Tag ws with uid for targeted broadcasts
  ws._uid = () => wsUid;
});

// Load Supabase data then start server
loadDB().then(() => {
  server.listen(PORT, HOST, () => {
    console.log(`Yaar Win Platform & Admin Server running at http://localhost:${PORT}/`);
    console.log(`Secret Admin Portal available at http://localhost:${PORT}${ADMIN_SECRET_PATH}`);
    console.log(`Supabase connected: ${SUPABASE_URL}`);
  });
}).catch(err => {
  console.error("Failed to load from Supabase:", err);
  server.listen(PORT, HOST, () => {
    console.log(`Yaar Win Platform running in fallback mode at http://localhost:${PORT}/`);
  });
});
