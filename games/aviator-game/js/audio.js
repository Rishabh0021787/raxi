/**
 * AviatorX Audio Engine
 * Uses the user's uploaded background music track (bg_music.mp3)
 * and plane crash sound effect (crash.mp3), complemented by
 * interactive propeller pitch, takeoff, and victory cashout chimes.
 */

class AviatorAudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxGain = null;
    this.masterGain = null;

    this.isMuted = false;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.initialized = false;

    // Resolve relative path robustly regardless of trailing slash
    const baseDir = (function() {
      try {
        const p = window.location.pathname;
        return p.substring(0, p.lastIndexOf('/') + 1) || './';
      } catch (e) {
        return './';
      }
    })();

    // HTML5 Audio Elements for uploaded files
    this.bgMusic = new Audio(baseDir + 'audio/bg_music.mp3');
    this.bgMusic.loop = true;
    this.bgMusic.volume = 0.65;
    this.bgMusic.preload = 'auto';

    let triedFallbackMusic = false;
    this.bgMusic.addEventListener('error', (e) => {
      console.warn("audio/bg_music.mp3 load warning, trying direct bg_music.mp3", e);
      if (!triedFallbackMusic) {
        triedFallbackMusic = true;
        this.bgMusic.src = baseDir + 'bg_music.mp3';
        this.bgMusic.load();
        if (this.musicEnabled) this.playMusic();
      }
    });

    this.crashSfx = new Audio(baseDir + 'audio/crash.mp3');
    this.crashSfx.volume = 0.90;
    this.crashSfx.preload = 'auto';

    let triedFallbackCrash = false;
    this.crashSfx.addEventListener('error', () => {
      if (!triedFallbackCrash) {
        triedFallbackCrash = true;
        this.crashSfx.src = baseDir + 'crash.mp3';
        this.crashSfx.load();
      }
    });

    // Propeller hum Web Audio nodes
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.isEngineRunning = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);
      }
      this.initialized = true;

      // Start user uploaded background music if enabled
      if (this.musicEnabled) {
        this.playMusic();
      }
    } catch (e) {
      console.warn("AudioContext init error:", e);
    }
  }

  resumeContext() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.musicEnabled && this.bgMusic && this.bgMusic.paused) {
      this.playMusic();
    }
  }

  /* -------------------------------------------------------------
   * BACKGROUND MUSIC (Uploaded File)
   * ----------------------------------------------------------- */
  playMusic() {
    if (!this.musicEnabled) return;
    try {
      const playPromise = this.bgMusic.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          this.updateSoundIconUI(true);
        }).catch(err => {
          // Autoplay policy prevented playback, will resume on user gesture
          console.log("Autoplay waiting for gesture:", err.message);
          this.updateSoundIconUI(false);
        });
      }
    } catch (e) {
      console.warn("playMusic error:", e);
    }
  }

  pauseMusic() {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.updateSoundIconUI(false);
    }
  }

  updateSoundIconUI(isPlaying) {
    const onIcon = document.getElementById('soundIconOn');
    const offIcon = document.getElementById('soundIconOff');
    const quickSoundBtn = document.getElementById('quickSoundBtn');
    if (onIcon && offIcon) {
      onIcon.style.display = isPlaying ? 'block' : 'none';
      offIcon.style.display = isPlaying ? 'none' : 'block';
    }
    if (quickSoundBtn) {
      quickSoundBtn.style.color = isPlaying ? '#22c55e' : '#ef4444';
    }
    const hint = document.getElementById('audioHint');
    if (hint && isPlaying) {
      hint.style.display = 'none';
    }
  }

  toggleMusic(enabled) {
    if (enabled !== undefined) this.musicEnabled = enabled;
    else this.musicEnabled = !this.musicEnabled;

    if (this.musicEnabled) {
      this.playMusic();
    } else {
      this.pauseMusic();
    }
    return this.musicEnabled;
  }

  toggleSFX(enabled) {
    if (enabled !== undefined) this.sfxEnabled = enabled;
    else this.sfxEnabled = !this.sfxEnabled;

    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? 0.85 : 0, this.ctx.currentTime);
    }
    return this.sfxEnabled;
  }

  /* -------------------------------------------------------------
   * PLANE CRASH SOUND (Uploaded File)
   * ----------------------------------------------------------- */
  playFlewAway() {
    this.stopEngineSound();
    if (!this.sfxEnabled) return;

    try {
      this.crashSfx.currentTime = 0;
      const playPromise = this.crashSfx.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.log("Crash SFX error:", e));
      }
    } catch (e) {
      console.warn("Crash SFX play error:", e);
    }
  }

  /* -------------------------------------------------------------
   * PROPELLER ENGINE PITCH & SFX
   * ----------------------------------------------------------- */
  startEngineSound() {
    if (!this.ctx || !this.sfxEnabled || this.isEngineRunning) return;
    try {
      this.isEngineRunning = true;

      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.setValueAtTime(60, this.ctx.currentTime);

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.setValueAtTime(120, this.ctx.currentTime);

      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(280, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      this.engineGain.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + 0.3);

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxGain);

      this.engineOsc1.start();
      this.engineOsc2.start();
    } catch (e) {
      console.warn("Engine audio error:", e);
    }
  }

  updateEnginePitch(multiplier) {
    if (!this.isEngineRunning || !this.engineOsc1 || !this.ctx) return;
    const normalized = Math.min(Math.log10(Math.max(multiplier, 1)) * 1.6, 2.5);
    const targetFreq1 = 60 + normalized * 70;
    const targetFreq2 = targetFreq1 * 2;
    const targetFilter = 280 + normalized * 380;

    this.engineOsc1.frequency.setTargetAtTime(targetFreq1, this.ctx.currentTime, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(targetFreq2, this.ctx.currentTime, 0.08);
    this.engineFilter.frequency.setTargetAtTime(targetFilter, this.ctx.currentTime, 0.08);
  }

  stopEngineSound() {
    if (!this.isEngineRunning || !this.engineGain || !this.ctx) return;
    try {
      this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, this.ctx.currentTime);
      this.engineGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      setTimeout(() => {
        if (this.engineOsc1) {
          try { this.engineOsc1.stop(); this.engineOsc1.disconnect(); } catch (_) {}
        }
        if (this.engineOsc2) {
          try { this.engineOsc2.stop(); this.engineOsc2.disconnect(); } catch (_) {}
        }
        this.isEngineRunning = false;
      }, 140);
    } catch (e) {
      this.isEngineRunning = false;
    }
  }

  playTakeoff() {
    if (!this.sfxEnabled) return;
    this.startEngineSound();
  }

  playCashOut() {
    if (!this.ctx || !this.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6 harmonic arpeggio

    notes.forEach((freq, idx) => {
      const startTime = t + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  playClick() {
    if (!this.ctx || !this.sfxEnabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.04);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }
}

// Global audio singleton
window.AviatorAudio = new AviatorAudioEngine();

// Auto-unlock WebAudio context & start background music on first user touch/click anywhere
(function() {
  const unlockAudio = () => {
    if (window.AviatorAudio) {
      window.AviatorAudio.resumeContext();
    }
  };
  ['click', 'touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown'].forEach(ev => {
    window.addEventListener(ev, unlockAudio, { passive: true });
    document.addEventListener(ev, unlockAudio, { passive: true });
  });
})();
