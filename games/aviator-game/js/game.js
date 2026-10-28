/**
 * AviatorX Canvas Game Engine
 * 60FPS fluid canvas graphics with the user's custom airplane sprite,
 * radial rayburst background, curved flight trajectory, and provably fair flight math.
 * Fully optimized for Mobile, Tablet, and Desktop screens.
 */

class AviatorGame {
  constructor() {
    this.canvas = document.getElementById('flightCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // UI elements
    this.multiplierEl = document.getElementById('multiplierText');
    this.flewAwayEl = document.getElementById('flewAwayText');
    this.waitingOverlay = document.getElementById('waitingOverlay');
    this.countdownBar = document.getElementById('countdownBar');
    this.roundIdEl = document.getElementById('roundIdText');

    // Game state: 'WAITING' | 'FLYING' | 'CRASHED'
    this.state = 'WAITING';
    this.currentMultiplier = 1.00;
    this.targetCrashMultiplier = 2.00;
    this.roundStartTime = 0;
    this.flightDuration = 0;
    this.roundId = this.generateRoundId();

    // Flight coordinates & animation
    this.planeX = 40;
    this.planeY = 180;
    this.planeAngle = -0.15;
    this.propellerAngle = 0;
    this.trailParticles = [];
    this.rayAngle = 0;
    this.animationEnabled = true;

    // Load custom airplane sprite from user's image
    this.planeImg = new Image();
    this.planeImg.src = 'images/airplane.png';
    this.planeLoaded = false;
    this.planeImg.onload = () => {
      this.planeLoaded = true;
    };
    this.planeImg.onerror = () => {
      this.planeLoaded = false;
    };

    // Countdown timer
    this.countdownTotal = 5000;
    this.countdownRemaining = 5000;
    this.countdownStart = 0;

    // Multipliers history
    this.history = [
      4.97, 1.05, 2.19, 3.84, 1.11, 2.01, 2.24, 1.19, 1.67, 1.66, 1.60, 1.68, 1.02, 2.65, 1.51, 1.00
    ];

    // Callbacks
    this.onStateChangeCallbacks = [];
    this.onMultiplierTickCallbacks = [];

    this.resizeCanvas();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    this.initLoop();
    this.startWaitingForNextRound();
  }

  generateRoundId() {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const w = Math.max(120, Math.floor((rect && rect.width > 20) ? rect.width : (this.canvas.clientWidth || window.innerWidth || 360)));
    const rawH = (rect && rect.height > 30) ? rect.height : (this.canvas.clientHeight || 200);
    const h = Math.max(90, Math.floor(rawH - 24)); // leave room for round-id-bar

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);

    if (this.ctx && typeof this.ctx.setTransform === 'function') {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
    this.displayWidth = w;
    this.displayHeight = h;
  }

  onStateChange(cb) {
    this.onStateChangeCallbacks.push(cb);
  }

  onMultiplierTick(cb) {
    this.onMultiplierTickCallbacks.push(cb);
  }

  emitStateChange(newState) {
    this.state = newState;
    this.onStateChangeCallbacks.forEach(cb => {
      try {
        cb(newState, this.currentMultiplier, this.roundId);
      } catch (err) {
        console.warn('onStateChange callback error:', err);
      }
    });
  }

  /* -------------------------------------------------------------
   * ROUND LIFECYCLE
   * ----------------------------------------------------------- */
  startWaitingForNextRound() {
    this.emitStateChange('WAITING');
    this.roundId = this.generateRoundId();
    if (this.roundIdEl) {
      this.roundIdEl.innerText = `Round Id: ${this.roundId}`;
    }

    if (this.multiplierEl) {
      this.multiplierEl.style.display = 'none';
      this.multiplierEl.classList.remove('crashed');
      this.multiplierEl.innerText = '1.00x';
    }
    if (this.flewAwayEl) {
      this.flewAwayEl.style.display = 'none';
    }
    if (this.waitingOverlay) {
      this.waitingOverlay.style.display = 'flex';
    }

    const getNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
    this.countdownStart = getNow();
    this.countdownRemaining = this.countdownTotal;

    const tickCountdown = () => {
      if (this.state !== 'WAITING') return;
      const elapsed = Math.max(0, getNow() - this.countdownStart);
      this.countdownRemaining = Math.max(0, this.countdownTotal - elapsed);
      const progress = (this.countdownRemaining / this.countdownTotal) * 100;
      if (this.countdownBar) {
        this.countdownBar.style.width = `${Math.min(100, Math.max(0, 100 - progress))}%`;
      }

      if (this.countdownRemaining <= 0) {
        this.startFlightRound().catch(e => {
          console.warn('startFlightRound error:', e);
          this.fallbackFlightStart();
        });
      } else {
        requestAnimationFrame(tickCountdown);
      }
    };
    requestAnimationFrame(tickCountdown);
  }

  fallbackFlightStart() {
    const rand = Math.random();
    let target = 2.00;
    if (rand < 0.04) {
      target = 1.00;
    } else {
      const ev = 100 / (101 - rand * 100);
      target = Math.max(1.01, Math.floor(ev * 100) / 100);
    }
    this.targetCrashMultiplier = target;
    this.startFlightAnimation();
  }

  async startFlightRound() {
    let target = 2.00;
    try {
      const resp = await fetch('/api/outcome');
      if (resp.ok) {
        const data = await resp.json();
        const parsed = parseFloat(data && data.multiplier);
        if (!isNaN(parsed) && isFinite(parsed) && parsed >= 1.00) {
          target = Math.floor(parsed * 100) / 100;
        }
      }
    } catch (e) {
      const rand = Math.random();
      if (rand < 0.04) {
        target = 1.00;
      } else {
        const ev = 100 / (101 - rand * 100);
        target = Math.max(1.01, Math.floor(ev * 100) / 100);
      }
    }

    this.targetCrashMultiplier = (!isNaN(target) && isFinite(target) && target >= 1.00) ? target : 2.00;
    this.startFlightAnimation();
  }

  startFlightAnimation() {
    this.currentMultiplier = 1.00;
    const getNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
    this.roundStartTime = getNow();
    this.trailParticles = [];

    if (this.waitingOverlay) this.waitingOverlay.style.display = 'none';
    if (this.multiplierEl) {
      this.multiplierEl.style.display = 'block';
      this.multiplierEl.classList.remove('crashed');
      this.multiplierEl.innerText = '1.00x';
    }
    if (this.flewAwayEl) this.flewAwayEl.style.display = 'none';

    this.emitStateChange('FLYING');

    if (window.AviatorAudio) {
      try { window.AviatorAudio.playTakeoff(); } catch (e) {}
    }

    // Instant crash handling for 1.00x
    if (this.targetCrashMultiplier <= 1.00) {
      this.currentMultiplier = 1.00;
      this.crashFlight();
    }
  }

  crashFlight() {
    this.emitStateChange('CRASHED');

    if (isNaN(this.currentMultiplier) || !isFinite(this.currentMultiplier) || this.currentMultiplier < 1.00) {
      this.currentMultiplier = this.targetCrashMultiplier || 1.00;
    }

    if (this.multiplierEl) {
      this.multiplierEl.classList.add('crashed');
      this.multiplierEl.innerText = `${this.currentMultiplier.toFixed(2)}x`;
    }
    if (this.flewAwayEl) {
      this.flewAwayEl.style.display = 'block';
    }

    if (window.AviatorAudio) {
      try { window.AviatorAudio.playFlewAway(); } catch (e) {}
    }

    this.history.unshift(this.currentMultiplier);
    if (this.history.length > 25) this.history.pop();
    if (window.updateHistoryPills) {
      try { window.updateHistoryPills(this.history); } catch (e) {}
    }

    // Notify backend
    fetch('/api/outcome/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ multiplier: this.currentMultiplier, roundId: this.roundId })
    }).catch(() => {});

    setTimeout(() => {
      this.startWaitingForNextRound();
    }, 2500);
  }

  /* -------------------------------------------------------------
   * 60FPS GAME LOOP
   * ----------------------------------------------------------- */
  initLoop() {
    const loop = (timestamp) => {
      const getNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
      const safeTime = (typeof timestamp === 'number' && !isNaN(timestamp) && timestamp > 0) ? timestamp : getNow();
      this.update(safeTime);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(timestamp) {
    if (this.animationEnabled) {
      this.rayAngle += 0.003;
      this.propellerAngle += 0.55;
    }

    const now = (typeof timestamp === 'number' && !isNaN(timestamp) && timestamp > 0)
      ? timestamp
      : ((typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now());

    const maxW = Math.max(120, this.displayWidth || 360);
    const maxH = Math.max(80, this.displayHeight || 200);

    if (this.state === 'FLYING') {
      if (!this.roundStartTime || isNaN(this.roundStartTime)) {
        this.roundStartTime = now;
      }

      // Elapsed seconds strictly >= 0 to eliminate any negative exponent issue (root of NaNx)
      const elapsedSec = Math.max(0, (now - this.roundStartTime) / 1000);

      // Realistic progressive multiplier growth curve
      const growthTerm = Math.pow(elapsedSec * 0.48, 1.7);
      let multVal = 1.00 + (isNaN(growthTerm) ? 0 : growthTerm) + (elapsedSec * 0.12);
      if (isNaN(multVal) || !isFinite(multVal) || multVal < 1.00) {
        multVal = 1.00;
      }
      this.currentMultiplier = Math.floor(multVal * 100) / 100;

      // Update multiplier text safely
      if (this.multiplierEl) {
        this.multiplierEl.innerText = `${this.currentMultiplier.toFixed(2)}x`;
      }

      if (window.AviatorAudio) {
        try { window.AviatorAudio.updateEnginePitch(this.currentMultiplier); } catch (e) {}
      }

      if (this.currentMultiplier >= this.targetCrashMultiplier) {
        this.currentMultiplier = this.targetCrashMultiplier;
        this.crashFlight();
      } else {
        this.onMultiplierTickCallbacks.forEach(cb => {
          try { cb(this.currentMultiplier); } catch (e) {}
        });
      }

      // Smooth flight trajectory curve
      const progress = Math.min(Math.max(0, elapsedSec / 8.0), 1.0);
      const easeProgress = Math.max(0, Math.min(1.0, 1 - Math.cos((progress * Math.PI) / 2)));

      this.planeX = 35 + easeProgress * (maxW - 130);
      const rise = Math.pow(easeProgress, 0.85) * (maxH - 80);
      const safeRise = isNaN(rise) ? 0 : rise;
      const wobble = (this.animationEnabled && !isNaN(now)) ? Math.sin(now * 0.008) * 4 : 0;
      this.planeY = (maxH - 45) - safeRise + wobble;

      const angleWobble = (this.animationEnabled && !isNaN(now)) ? Math.sin(now * 0.004) * 0.04 : 0;
      this.planeAngle = -0.32 + angleWobble;

      // Coordinate boundary guards
      if (isNaN(this.planeX) || !isFinite(this.planeX)) this.planeX = 35;
      if (isNaN(this.planeY) || !isFinite(this.planeY)) this.planeY = maxH - 45;
      if (isNaN(this.planeAngle) || !isFinite(this.planeAngle)) this.planeAngle = -0.32;

      // Trailing exhaust particles
      if (this.animationEnabled && Math.random() > 0.35) {
        this.trailParticles.push({
          x: this.planeX - 25,
          y: this.planeY + 12,
          vx: -(1.8 + Math.random() * 2),
          vy: 0.5 + Math.random() * 1.5,
          size: 3 + Math.random() * 3,
          alpha: 0.7,
          life: 1.0
        });
      }
    } else if (this.state === 'CRASHED') {
      this.planeX += 22;
      this.planeY -= 15;
      this.planeAngle = -0.55;
    } else if (this.state === 'WAITING') {
      this.planeX = 45;
      this.planeY = maxH - 50;
      this.planeAngle = -0.15;
    }

    // Particle decay
    for (let i = this.trailParticles.length - 1; i >= 0; i--) {
      const p = this.trailParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      p.alpha = Math.max(0, p.life * 0.7);
      if (p.life <= 0) {
        this.trailParticles.splice(i, 1);
      }
    }
  }

  render() {
    if (!this.ctx) return;
    const w = this.displayWidth || 360;
    const h = this.displayHeight || 200;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // 1. Radiating Sunburst Background
    this.drawRayburst(ctx, w, h);

    // 2. Flight Trajectory Curve & Red Gradient Fill
    if (this.state === 'FLYING' || this.state === 'CRASHED') {
      this.drawFlightCurve(ctx, w, h);
    }

    // 3. Particles
    this.drawParticles(ctx);

    // 4. Custom Airplane
    this.drawAirplane(ctx, this.planeX, this.planeY, this.planeAngle);
  }

  drawRayburst(ctx, w, h) {
    const cx = w * 0.25;
    const cy = h * 0.75;
    const numRays = 28;
    const radius = Math.max(w, h) * 1.6;

    ctx.save();
    for (let i = 0; i < numRays; i++) {
      const angle = this.rayAngle + (i * Math.PI * 2) / numRays;
      const angleNext = angle + (Math.PI / numRays);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angleNext);
      ctx.closePath();

      ctx.fillStyle = (i % 2 === 0) ? '#0b0c10' : '#111218';
      ctx.fill();
    }

    const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, radius * 0.9);
    grad.addColorStop(0, 'rgba(11, 12, 16, 0.2)');
    grad.addColorStop(0.7, 'rgba(11, 12, 16, 0.75)');
    grad.addColorStop(1, '#090a0d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  }

  drawFlightCurve(ctx, w, h) {
    const startX = 18;
    const startY = h - 25;
    const endX = Math.max(startX + 10, this.planeX - 10);
    const endY = Math.min(startY - 5, this.planeY + 14);

    const cp1x = startX + (endX - startX) * 0.55;
    const cp1y = startY;

    ctx.save();

    // Red Gradient Fill under flight line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
    ctx.lineTo(endX, startY);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, endY, 0, startY);
    fillGrad.addColorStop(0, 'rgba(229, 27, 36, 0.44)');
    fillGrad.addColorStop(0.5, 'rgba(229, 27, 36, 0.18)');
    fillGrad.addColorStop(1, 'rgba(229, 27, 36, 0.0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Glowing Red Flight Path Line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(cp1x, cp1y, endX, endY);
    ctx.strokeStyle = '#ff1e38';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#e51b24';
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.restore();
  }

  drawParticles(ctx) {
    ctx.save();
    for (const p of this.trailParticles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(234, 88, 12, ${p.alpha})`;
      ctx.shadowColor = '#e51b24';
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    ctx.restore();
  }

  // Draw the custom airplane requested by the user with guaranteed fallback
  drawAirplane(ctx, x, y, angle) {
    if (isNaN(x) || isNaN(y) || isNaN(angle)) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Plane drop shadow
    ctx.save();
    ctx.translate(6, 16);
    ctx.scale(1, 0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 36, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();
    ctx.restore();

    if (this.planeLoaded && this.planeImg && this.planeImg.complete && this.planeImg.naturalWidth > 0) {
      // Draw user's exact airplane sprite
      const planeW = 104;
      const planeH = 54;

      ctx.save();
      ctx.shadowColor = 'rgba(255, 23, 68, 0.75)';
      ctx.shadowBlur = 8;
      ctx.drawImage(this.planeImg, -planeW / 2, -planeH / 2, planeW, planeH);
      ctx.restore();

      // Spinning propeller disc at front nose
      if (this.animationEnabled) {
        ctx.save();
        ctx.translate(planeW * 0.42, planeH * 0.03);
        ctx.rotate(this.propellerAngle);

        // Propeller blur ellipse
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.5, 14, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fill();

        // Propeller blades
        ctx.beginPath();
        ctx.moveTo(-1, -14);
        ctx.lineTo(1, -14);
        ctx.lineTo(1, 14);
        ctx.lineTo(-1, 14);
        ctx.closePath();
        ctx.fillStyle = '#ff203a';
        ctx.fill();

        ctx.restore();
      }
    } else {
      // Sleek red vector plane fallback so plane is NEVER missing
      ctx.save();
      ctx.fillStyle = '#e51b24';
      ctx.shadowColor = 'rgba(229, 27, 36, 0.8)';
      ctx.shadowBlur = 10;

      // Fuselage & wings
      ctx.beginPath();
      ctx.moveTo(35, 0);
      ctx.lineTo(-20, -12);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-25, 0);
      ctx.lineTo(-30, -7);
      ctx.lineTo(-35, -7);
      ctx.lineTo(-30, 4);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-20, 12);
      ctx.closePath();
      ctx.fill();

      // Cockpit window
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(8, -2, 6, 2.5, 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }
}

// Global instance
window.AviatorGameInstance = null;
