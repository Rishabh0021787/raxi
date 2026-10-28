/**
 * AviatorX Betting & Session Engine
 * - Reads ?token= from URL → fetches real balance & username from server API
 * - Falls back to demo mode (₹10,000) if no token
 * - Admin outcome override is fetched from /api/outcome before each round
 * - Bet/Win API calls sync balance changes back to the server
 */

class AviatorBettingEngine {
  constructor(game) {
    this.game = game;

    // Session token / UID from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.uid = urlParams.get('uid') || '951603';
    this.token = urlParams.get('token') || `uid_${this.uid}`;
    this.isDemoMode = false; // Always live balance connected to website

    // User info
    this.balance = 0.00;
    this.userId = this.uid;
    this.username = 'Player';
    this.balanceEl = document.getElementById('userBalance');

    // Bet Cards
    this.card1 = this.initCard(1);
    this.card2 = this.initCard(2);

    // My bets & bot bets
    this.myBetsHistory = [];
    this.simulatedBets = [];
    this.betsListContainer = document.getElementById('betsList');
    this.allBetsCountEl = document.getElementById('allBetsCount');

    this.init();
  }

  initCard(id) {
    return {
      id,
      mode: 'bet',
      amount: 50.00,
      autoCashoutEnabled: false,
      autoCashoutMult: 2.00,
      status: 'idle',
      winAmount: 0,
      cashoutMult: 0,
      btnEl: document.getElementById(`betBtn${id}`),
      btnLabelTop: document.getElementById(`btnLabelTop${id}`),
      btnLabelSub: document.getElementById(`btnLabelSub${id}`),
      amountInput: document.getElementById(`betAmountInput${id}`),
      autoInput: document.getElementById(`autoCashoutInput${id}`),
      autoCheck: document.getElementById(`autoCashoutCheck${id}`)
    };
  }

  async init() {
    await this.loadSessionBalance();
    this.initBetCardEvents(this.card1);
    this.initBetCardEvents(this.card2);
    this.generateSimulatedBets();
    this.renderBetsList();
    this.initHistoryBar();
    this.initModals();
    this.initAudioHint();

    this.game.onStateChange((state, multiplier, roundId) => {
      this.handleGameStateChange(state, multiplier, roundId);
    });
    this.game.onMultiplierTick((multiplier) => {
      this.handleMultiplierTick(multiplier);
    });
  }

  /* ---------------------------------------------------------
   * SESSION / BALANCE LOADING
   * ------------------------------------------------------- */
  async loadSessionBalance() {
    try {
      const resp = await fetch(`/api/session/balance?uid=${this.uid}&token=${this.token}`);
      if (!resp.ok) throw new Error('Session not found');
      const data = await resp.json();
      if (data.success) {
        this.balance = parseFloat(data.balance) || 0.00;
        this.userId = data.userId || this.uid;
        this.username = data.username || 'Player';
        this.updateBalanceDisplay();
        this.updateProfileUI();
      }
    } catch (e) {
      console.warn('Session load error:', e);
      this.updateBalanceDisplay();
    }
  }

  updateProfileUI() {
    const nameEl = document.getElementById('profileUsername');
    const idEl = document.getElementById('profileUserId');
    if (nameEl) {
      nameEl.innerText = this.username || 'Player';
    }
    if (idEl) {
      idEl.innerText = `ID: ${this.userId || '951603'}`;
    }
  }

  updateBalanceDisplay() {
    if (this.balanceEl) {
      this.balanceEl.innerText = `${this.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₹`;
    }
  }

  /* ---------------------------------------------------------
   * SERVER BET / WIN CALLS
   * ------------------------------------------------------- */
  async serverDeductBet(amount) {
    try {
      const resp = await fetch('/api/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: this.uid, token: this.token, amount })
      });
      const data = await resp.json();
      if (data.success) {
        this.balance = data.balance;
        this.updateBalanceDisplay();
        if (window.parent && typeof window.parent.refreshUserBalance === 'function') {
          window.parent.refreshUserBalance(false);
        }
        return true;
      } else {
        alert(data.message || 'Insufficient balance. Please deposit to continue.');
        return false;
      }
    } catch (e) {
      this.balance = Math.max(0, this.balance - amount);
      this.updateBalanceDisplay();
      return true;
    }
  }

  async serverCreditWin(amount) {
    try {
      const resp = await fetch('/api/win', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: this.uid, token: this.token, winAmount: amount })
      });
      const data = await resp.json();
      if (data.success) {
        this.balance = data.balance;
        this.updateBalanceDisplay();
        if (window.parent && typeof window.parent.refreshUserBalance === 'function') {
          window.parent.refreshUserBalance(false);
        }
      }
    } catch (e) {
      this.balance += amount;
      this.updateBalanceDisplay();
    }
  }

  /* ---------------------------------------------------------
   * BET CARD EVENTS
   * ------------------------------------------------------- */
  initBetCardEvents(card) {
    const minusBtn = document.getElementById(`minusBtn${card.id}`);
    const plusBtn = document.getElementById(`plusBtn${card.id}`);

    if (minusBtn) {
      minusBtn.addEventListener('click', () => {
        if (window.AviatorAudio) window.AviatorAudio.playClick();
        card.amount = Math.max(10, card.amount - 50);
        card.amountInput.value = card.amount.toFixed(2);
        this.updateCardButton(card);
      });
    }
    if (plusBtn) {
      plusBtn.addEventListener('click', () => {
        if (window.AviatorAudio) window.AviatorAudio.playClick();
        card.amount += 50;
        card.amountInput.value = card.amount.toFixed(2);
        this.updateCardButton(card);
      });
    }
    if (card.amountInput) {
      card.amountInput.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val < 10) val = 10;
        card.amount = val;
        card.amountInput.value = val.toFixed(2);
        this.updateCardButton(card);
      });
    }

    const cardEl = document.getElementById(`betCard${card.id}`);
    if (cardEl) {
      cardEl.querySelectorAll('.chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (window.AviatorAudio) window.AviatorAudio.playClick();
          card.amount = parseFloat(btn.getAttribute('data-value'));
          card.amountInput.value = card.amount.toFixed(2);
          this.updateCardButton(card);
        });
      });
    }

    const betModeBtn = document.getElementById(`modeBet${card.id}`);
    const autoModeBtn = document.getElementById(`modeAuto${card.id}`);
    const autoOptionsRow = document.getElementById(`autoOptionsRow${card.id}`);

    if (betModeBtn) {
      betModeBtn.addEventListener('click', () => {
        if (window.AviatorAudio) window.AviatorAudio.playClick();
        card.mode = 'bet';
        betModeBtn.classList.add('active');
        autoModeBtn.classList.remove('active');
        if (autoOptionsRow) autoOptionsRow.classList.remove('active');
      });
    }
    if (autoModeBtn) {
      autoModeBtn.addEventListener('click', () => {
        if (window.AviatorAudio) window.AviatorAudio.playClick();
        card.mode = 'auto';
        autoModeBtn.classList.add('active');
        betModeBtn.classList.remove('active');
        if (autoOptionsRow) autoOptionsRow.classList.add('active');
      });
    }

    if (card.autoCheck) {
      card.autoCheck.addEventListener('change', (e) => {
        card.autoCashoutEnabled = e.target.checked;
      });
    }
    if (card.autoInput) {
      card.autoInput.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val < 1.01) val = 1.01;
        card.autoCashoutMult = val;
        card.autoInput.value = val.toFixed(2);
      });
    }

    if (card.btnEl) {
      card.btnEl.addEventListener('click', () => {
        this.handleActionClick(card);
      });
    }
  }

  async handleActionClick(card) {
    if (window.AviatorAudio) window.AviatorAudio.resumeContext();

    if (card.status === 'idle') {
      const ok = await this.serverDeductBet(card.amount);
      if (!ok) return;

      if (window.AviatorAudio) window.AviatorAudio.playClick();
      card.status = this.game.state === 'WAITING' ? 'placed' : 'waiting_next';
      this.updateCardButton(card);
      return;
    }

    if (card.status === 'waiting_next') {
      // Refund
      await this.serverCreditWin(card.amount);
      if (window.AviatorAudio) window.AviatorAudio.playClick();
      card.status = 'idle';
      this.updateCardButton(card);
      return;
    }

    if (card.status === 'placed' && this.game.state === 'FLYING') {
      this.cashOutCard(card, this.game.currentMultiplier);
    }
  }

  async cashOutCard(card, multiplier) {
    if (card.status !== 'placed') return;

    card.status = 'cashed_out';
    card.cashoutMult = multiplier;
    card.winAmount = Math.floor(card.amount * multiplier * 100) / 100;

    await this.serverCreditWin(card.winAmount);

    if (window.AviatorAudio) {
      window.AviatorAudio.playCashOut();
    }

    this.myBetsHistory.unshift({
      roundId: this.game.roundId,
      bet: card.amount,
      mult: multiplier,
      win: card.winAmount,
      time: new Date().toLocaleTimeString()
    });

    this.updateCardButton(card);
  }

  updateCardButton(card) {
    if (!card.btnEl) return;
    card.btnEl.className = 'big-action-btn';

    if (card.status === 'idle') {
      card.btnEl.classList.add('btn-bet');
      card.btnLabelTop.innerText = 'BET';
      card.btnLabelSub.innerText = `${card.amount.toFixed(2)} ₹`;
    } else if (card.status === 'waiting_next') {
      card.btnEl.classList.add('btn-waiting');
      card.btnLabelTop.innerText = 'WAITING';
      card.btnLabelSub.innerText = 'CANCEL';
    } else if (card.status === 'placed') {
      if (this.game.state === 'FLYING') {
        const safeM = (this.game && typeof this.game.currentMultiplier === 'number' && !isNaN(this.game.currentMultiplier) && this.game.currentMultiplier >= 1.00) ? this.game.currentMultiplier : 1.00;
        const potentialWin = (card.amount * safeM).toFixed(2);
        card.btnEl.classList.add('btn-cashout');
        card.btnLabelTop.innerText = 'CASH OUT';
        card.btnLabelSub.innerText = `${potentialWin} ₹`;
      } else {
        card.btnEl.classList.add('btn-waiting');
        card.btnLabelTop.innerText = 'WAITING';
        card.btnLabelSub.innerText = 'ROUND START';
      }
    } else if (card.status === 'cashed_out') {
      card.btnEl.classList.add('btn-bet');
      card.btnLabelTop.innerText = `WON ${card.cashoutMult.toFixed(2)}x`;
      card.btnLabelSub.innerText = `+${card.winAmount.toFixed(2)} ₹`;
    } else if (card.status === 'lost') {
      card.btnEl.classList.add('btn-waiting');
      card.btnLabelTop.innerText = 'LOST';
      card.btnLabelSub.innerText = `−${card.amount.toFixed(2)} ₹`;
    }
  }

  /* ---------------------------------------------------------
   * GAME STATE HANDLERS
   * ------------------------------------------------------- */
  handleGameStateChange(state, multiplier, roundId) {
    if (state === 'WAITING') {
      [this.card1, this.card2].forEach(card => {
        if (card.status === 'waiting_next') {
          card.status = 'placed';
        } else if (['cashed_out', 'lost'].includes(card.status)) {
          card.status = 'idle';
        }
        this.updateCardButton(card);
      });

      this.generateSimulatedBets();
      this.renderBetsList();
    } else if (state === 'FLYING') {
      [this.card1, this.card2].forEach(card => {
        if (card.status === 'placed') this.updateCardButton(card);
      });
    } else if (state === 'CRASHED') {
      [this.card1, this.card2].forEach(card => {
        if (card.status === 'placed') {
          card.status = 'lost';
          this.updateCardButton(card);
        }
      });
      this.simulatedBets.forEach(bot => {
        if (!bot.cashedOut) bot.crashed = true;
      });
      this.renderBetsList();
    }
  }

  handleMultiplierTick(multiplier) {
    const safeMult = (typeof multiplier === 'number' && !isNaN(multiplier) && multiplier >= 1.00) ? multiplier : 1.00;
    [this.card1, this.card2].forEach(card => {
      if (card.status === 'placed') {
        const currentWin = (card.amount * safeMult).toFixed(2);
        card.btnLabelSub.innerText = `${currentWin} ₹`;

        if (card.mode === 'auto' && card.autoCashoutEnabled && safeMult >= card.autoCashoutMult) {
          this.cashOutCard(card, safeMult);
        }
      }
    });

    let updated = false;
    this.simulatedBets.forEach(bot => {
      if (!bot.cashedOut && safeMult >= bot.targetMult) {
        bot.cashedOut = true;
        bot.win = Math.floor(bot.bet * bot.targetMult * 100) / 100;
        updated = true;
      }
    });
    if (updated) this.renderBetsList();
  }

  /* ---------------------------------------------------------
   * SIMULATED LIVE BETS
   * ------------------------------------------------------- */
  generateSimulatedBets() {
    const avatarColors = ['#e11d48','#8b5cf6','#10b981','#f59e0b','#06b6d4','#ec4899','#6366f1','#14b8a6','#f97316','#3b82f6'];
    const avatarIcons  = ['🧑','👧','🐘','🤠','👨‍💼','🧢','🐨','🦊','🦁','🚀'];
    const mockNames    = ['r***4','g***1','r***8','r***9','c***9','c***7','g***6','9***0','r***4','k***2','s***5','v***1','p***9','m***3','a***7','j***8','d***4','t***0','z***6','w***2'];
    const mockBets     = [2950,2150,1500,1400,1190,1000,1000,990,950,800,750,600,500,450,300,250,200,150,100,50];

    this.simulatedBets = [];
    const count = 35 + Math.floor(Math.random() * 20);

    for (let i = 0; i < count; i++) {
      this.simulatedBets.push({
        name: mockNames[i % mockNames.length],
        bet: mockBets[i % mockBets.length],
        color: avatarColors[i % avatarColors.length],
        icon: avatarIcons[i % avatarIcons.length],
        targetMult: Math.floor((1.10 + Math.pow(Math.random(), 2.2) * 6.5) * 100) / 100,
        cashedOut: false,
        win: 0,
        crashed: false
      });
    }

    if (this.allBetsCountEl) {
      this.allBetsCountEl.innerText = `${400 + Math.floor(Math.random() * 80)}`;
    }
  }

  renderBetsList() {
    if (!this.betsListContainer) return;
    let html = '';
    this.simulatedBets.forEach(bot => {
      const rowClass = bot.cashedOut ? 'bet-row cashed-out' : 'bet-row';
      const multDisplay = bot.cashedOut
        ? `<span class="bet-mult active-mult">${bot.targetMult.toFixed(2)}x</span>`
        : `<span class="bet-mult">-</span>`;
      const cashoutDisplay = bot.cashedOut
        ? `<span class="bet-cashout win">${bot.win.toFixed(2)}</span>`
        : `<span class="bet-cashout">0.00</span>`;

      html += `
        <div class="${rowClass}">
          <div class="bet-user">
            <div class="user-avatar" style="background-color:${bot.color};">${bot.icon}</div>
            <span class="user-name">${bot.name}</span>
          </div>
          <div class="bet-amount">${bot.bet.toFixed(2)}</div>
          <div>${multDisplay}</div>
          <div>${cashoutDisplay}</div>
        </div>`;
    });
    this.betsListContainer.innerHTML = html;
  }

  renderMyBets() {
    if (!this.betsListContainer) return;
    if (this.myBetsHistory.length === 0) {
      this.betsListContainer.innerHTML = `<div style="text-align:center;padding:40px 10px;color:#64748b;font-size:13px;">No personal bets yet.<br>Place a bet to see your history!</div>`;
      return;
    }
    let html = '';
    this.myBetsHistory.forEach(b => {
      html += `
        <div class="bet-row cashed-out">
          <div class="bet-user">
            <div class="user-avatar" style="background-color:#3b82f6;">⭐</div>
            <span class="user-name">You</span>
          </div>
          <div class="bet-amount">${b.bet.toFixed(2)}</div>
          <div><span class="bet-mult active-mult">${b.mult.toFixed(2)}x</span></div>
          <div><span class="bet-cashout win">${b.win.toFixed(2)}</span></div>
        </div>`;
    });
    this.betsListContainer.innerHTML = html;
  }

  /* ---------------------------------------------------------
   * HISTORY BAR
   * ------------------------------------------------------- */
  initHistoryBar() {
    const listEl = document.getElementById('historyList');
    if (!listEl) return;
    window.updateHistoryPills = (historyList) => {
      let html = '';
      historyList.forEach(mult => {
        let pillClass = 'pill-blue';
        if (mult >= 10.0) pillClass = 'pill-pink';
        else if (mult >= 2.0) pillClass = 'pill-purple';
        html += `<div class="history-pill ${pillClass}">${mult.toFixed(2)}x</div>`;
      });
      listEl.innerHTML = html;
    };
    window.updateHistoryPills(this.game.history);
  }

  /* ---------------------------------------------------------
   * MODALS
   * ------------------------------------------------------- */
  initModals() {
    const bind = (trigId, modalId, closeId) => {
      const trig = document.getElementById(trigId);
      const modal = document.getElementById(modalId);
      const close = document.getElementById(closeId);
      if (trig && modal) trig.addEventListener('click', () => {
        if (window.AviatorAudio) window.AviatorAudio.playClick();
        modal.style.display = 'flex';
      });
      if (close && modal) close.addEventListener('click', () => { modal.style.display = 'none'; });
    };

    bind('howToPlayBtn',    'howToPlayModal',    'closeHowToPlay');
    bind('provablyFairLink','provablyFairModal',  'closeProvablyFair');
    bind('menuBtn',         'menuModal',          'closeMenu');

    // Provably Fair Setting inside menu also opens Provably Fair modal
    const pfBtn = document.getElementById('provablyFairSettingBtn');
    if (pfBtn) {
      pfBtn.addEventListener('click', () => {
        document.getElementById('menuModal').style.display = 'none';
        document.getElementById('provablyFairModal').style.display = 'flex';
      });
    }

    // Game Rules inside menu
    const grBtn = document.getElementById('gameRulesBtn');
    if (grBtn) {
      grBtn.addEventListener('click', () => {
        document.getElementById('menuModal').style.display = 'none';
        document.getElementById('howToPlayModal').style.display = 'flex';
      });
    }

    // Quick Sound / Music Toggle Button
    const quickSoundBtn = document.getElementById('quickSoundBtn');
    if (quickSoundBtn) {
      quickSoundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.AviatorAudio) {
          window.AviatorAudio.resumeContext();
          const enabled = window.AviatorAudio.toggleMusic();
          const onIcon = document.getElementById('soundIconOn');
          const offIcon = document.getElementById('soundIconOff');
          if (onIcon) onIcon.style.display = enabled ? 'block' : 'none';
          if (offIcon) offIcon.style.display = enabled ? 'none' : 'block';
          quickSoundBtn.style.color = enabled ? '#22c55e' : '#ef4444';
          if (musicSwitch) musicSwitch.checked = enabled;
        }
      });
    }

    // Audio toggles
    const musicSwitch = document.getElementById('musicSwitch');
    const sfxSwitch = document.getElementById('sfxSwitch');
    const animSwitch = document.getElementById('animationSwitch');

    if (musicSwitch) musicSwitch.addEventListener('change', (e) => {
      if (window.AviatorAudio) {
        window.AviatorAudio.toggleMusic(e.target.checked);
        const onIcon = document.getElementById('soundIconOn');
        const offIcon = document.getElementById('soundIconOff');
        if (onIcon) onIcon.style.display = e.target.checked ? 'block' : 'none';
        if (offIcon) offIcon.style.display = e.target.checked ? 'none' : 'block';
        if (quickSoundBtn) quickSoundBtn.style.color = e.target.checked ? '#22c55e' : '#ef4444';
      }
    });
    if (sfxSwitch) sfxSwitch.addEventListener('change', (e) => {
      if (window.AviatorAudio) window.AviatorAudio.toggleSFX(e.target.checked);
    });
    if (animSwitch) animSwitch.addEventListener('change', (e) => {
      if (window.AviatorGameInstance) window.AviatorGameInstance.animationEnabled = e.target.checked;
    });

    // Reload balance button
    const reloadBtn = document.getElementById('reloadBalanceBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        if (window.AviatorAudio) window.AviatorAudio.playClick();
        this.loadSessionBalance();
      });
    }

    // Close on backdrop click
    window.addEventListener('click', (e) => {
      ['howToPlayModal','provablyFairModal','menuModal'].forEach(id => {
        const el = document.getElementById(id);
        if (e.target === el) el.style.display = 'none';
      });
    });

    // Second bet card toggle
    const closeCard2 = document.getElementById('closeBetCard2');
    const betCard2   = document.getElementById('betCard2');
    const addSecond  = document.getElementById('addSecondBetBtn');
    if (closeCard2 && betCard2 && addSecond) {
      if (window.innerWidth <= 768) {
        betCard2.style.display = 'none';
        addSecond.style.display = 'flex';
      }
      closeCard2.addEventListener('click', () => { betCard2.style.display = 'none'; addSecond.style.display = 'flex'; });
      addSecond.addEventListener('click',  () => { betCard2.style.display = 'flex'; addSecond.style.display = 'none'; });
    }

    // Sidebar tabs
    const tabAll = document.getElementById('tabAllBets');
    const tabMy  = document.getElementById('tabMyBets');
    if (tabAll && tabMy) {
      tabAll.addEventListener('click', () => { tabAll.classList.add('active'); tabMy.classList.remove('active'); this.renderBetsList(); });
      tabMy.addEventListener('click',  () => { tabMy.classList.add('active'); tabAll.classList.remove('active'); this.renderMyBets(); });
    }
  }

  initAudioHint() {
    const hint = document.getElementById('audioHint');
    const start = () => {
      if (window.AviatorAudio) {
        window.AviatorAudio.resumeContext();
      }
      if (hint) hint.style.display = 'none';
    };
    if (hint) hint.addEventListener('click', start);
    ['click', 'touchstart', 'touchend', 'pointerdown'].forEach(ev => {
      window.addEventListener(ev, start, { once: true, passive: true });
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.AviatorGameInstance = new AviatorGame();
  window.AviatorBettingInstance = new AviatorBettingEngine(window.AviatorGameInstance);
});
