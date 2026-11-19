/**
 * SoundManager - Module âm thanh độc lập sử dụng 100% Web Audio API
 * Tổng hợp thời gian thực: động cơ Diesel, còi hơi, phanh khí nén, va đập ổ gà,
 * bơm xăng/sửa xe, Victory/Game Over và nhạc nền hành trình ngũ cung Việt Nam.
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;

    // Bộ tổng hợp động cơ Diesel
    this.engineNodes = null;
    this.isEngineRunning = false;

    // Bộ phát nhạc nền chiptune/ambient (Lookahead Scheduler)
    this.musicTimerId = null;
    this.isMusicPlaying = false;
    this.musicStep = 0;
    this.nextNoteTime = 0;

    // Khử dội tiếng lặp khi giữ phím E tại trạm xăng / sửa chữa
    this.lastStationTickTime = 0;
  }

  _ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(flag) {
    this.enabled = Boolean(flag);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.enabled ? 0.85 : 0.0, this.ctx.currentTime, 0.04);
    }
    if (!this.enabled) {
      this.stopEngine();
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  // ==================== 1. ĐỘNG CƠ XE ĐẦU KÉO DIESEL ====================

  startEngine() {
    const ctx = this._ensureContext();
    if (!ctx || this.isEngineRunning) return;
    try {
      const subOsc = ctx.createOscillator();
      const rumbleOsc = ctx.createOscillator();
      const chugLfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const engineGain = ctx.createGain();

      subOsc.type = "triangle";
      subOsc.frequency.value = 34;

      rumbleOsc.type = "sawtooth";
      rumbleOsc.frequency.value = 68;

      chugLfo.type = "sine";
      chugLfo.frequency.value = 7;
      lfoGain.gain.value = 0.015;

      filter.type = "lowpass";
      filter.frequency.value = 175;
      filter.Q.value = 2.2;

      engineGain.gain.value = 0.045;

      chugLfo.connect(lfoGain);
      lfoGain.connect(engineGain.gain);

      subOsc.connect(filter);
      rumbleOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(this.masterGain);

      subOsc.start();
      rumbleOsc.start();
      chugLfo.start();

      this.engineNodes = { subOsc, rumbleOsc, chugLfo, lfoGain, filter, engineGain };
      this.isEngineRunning = true;
    } catch {
      this.isEngineRunning = false;
    }
  }

  updateEngine(speedKmh, isThrottling) {
    if (!this.enabled || !this.isEngineRunning || !this.engineNodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    const speedRatio = Math.min(1, Math.abs(speedKmh) / 85);

    const baseFreq = 30 + speedRatio * 42 + (isThrottling ? 8 : 0);
    const filterFreq = 140 + speedRatio * 240 + (isThrottling ? 85 : 0);
    const chugRate = 6 + speedRatio * 14;
    const gainVal = 0.032 + speedRatio * 0.025 + (isThrottling ? 0.018 : 0);

    this.engineNodes.subOsc.frequency.setTargetAtTime(baseFreq, now, 0.07);
    this.engineNodes.rumbleOsc.frequency.setTargetAtTime(baseFreq * 2.02, now, 0.07);
    this.engineNodes.filter.frequency.setTargetAtTime(filterFreq, now, 0.08);
    this.engineNodes.chugLfo.frequency.setTargetAtTime(chugRate, now, 0.08);
    this.engineNodes.engineGain.gain.setTargetAtTime(gainVal, now, 0.09);
  }

  stopEngine() {
    if (this.engineNodes) {
      try {
        this.engineNodes.subOsc.stop();
        this.engineNodes.rumbleOsc.stop();
        this.engineNodes.chugLfo.stop();
        this.engineNodes.engineGain.disconnect();
      } catch {}
    }
    this.engineNodes = null;
    this.isEngineRunning = false;
  }

  // ==================== 2. CÒI HƠI (H) & PHANH KHÍ NÉN (SPACE) ====================

  playHorn() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Hòa âm 3 nốt còi hơi xe tải vang dội
    const freqs = [185, 233.08, 277.18];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq * 0.94, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.04);

      filter.type = "bandpass";
      filter.frequency.value = freq * 2.4;
      filter.Q.value = 1.4;

      const peak = idx === 0 ? 0.13 : 0.09;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.035);
      gain.gain.setValueAtTime(peak, now + 0.34);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.58);
    });
  }

  playBrakeHiss() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Tiếng van xả cơ khí ngắn
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "triangle";
    clickOsc.frequency.setValueAtTime(140, now);
    clickOsc.frequency.exponentialRampToValueAtTime(55, now + 0.05);
    clickGain.gain.setValueAtTime(0.12, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    clickOsc.connect(clickGain);
    clickGain.connect(this.masterGain);
    clickOsc.start(now);
    clickOsc.stop(now + 0.07);

    // 2. Luồng khí nén xì hơi kéo dài
    const duration = 0.34;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 1.4);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
  }

  // ==================== 3. VA ĐẬP THÙNG HÀNG / CẠ GẦM QUA Ổ GÀ ====================

  playImpact(severity = 1) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = Math.min(1.5, Math.max(0.5, severity));

    // A. Xung lực gầm xe & giảm xóc (Sub-thud)
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = "triangle";
    thudOsc.frequency.setValueAtTime(135, now);
    thudOsc.frequency.exponentialRampToValueAtTime(30, now + 0.22);
    thudGain.gain.setValueAtTime(0.24 * vol, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    thudOsc.connect(thudGain);
    thudGain.connect(this.masterGain);
    thudOsc.start(now);
    thudOsc.stop(now + 0.26);

    // B. Tiếng kim loại thùng container va đập & cạ gầm
    [290, 445].forEach((freq, idx) => {
      const clank = ctx.createOscillator();
      const cGain = ctx.createGain();
      clank.type = "square";
      clank.frequency.setValueAtTime(freq, now + 0.015);
      clank.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.14);
      cGain.gain.setValueAtTime((idx === 0 ? 0.065 : 0.04) * vol, now + 0.015);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      clank.connect(cGain);
      cGain.connect(this.masterGain);
      clank.start(now + 0.015);
      clank.stop(now + 0.17);
    });

    // C. Tiếng cạ gầm / đá văng
    const scrapeLen = Math.floor(ctx.sampleRate * 0.16);
    const buf = ctx.createBuffer(1, scrapeLen, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < scrapeLen; i++) {
      ch[i] = (Math.random() * 2 - 1) * (1 - i / scrapeLen);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 920;
    const nGain = ctx.createGain();
    nGain.gain.value = 0.1 * vol;
    src.connect(bp);
    bp.connect(nGain);
    nGain.connect(this.masterGain);
    src.start(now);
  }

  // ==================== 4. ĐỔ XĂNG / SỬA XE / NHẶT VẬT PHẨM ====================

  playRefuelTick() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastStationTickTime < 190) return;
    this.lastStationTickTime = now;
    this._playLiquidGlug(1);
  }

  playRepairTick() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = performance.now();
    if (now - this.lastStationTickTime < 240) return;
    this.lastStationTickTime = now;
    this._playRatchetWrench();
  }

  playPickupFuel() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    this._playLiquidGlug(2);
    this._playChime([523.25, 659.25]);
  }

  playPickupRepair() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    this._playRatchetWrench();
    this._playChime([587.33, 783.99]);
  }

  playPickupStrap() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    this._playChime([523.25, 659.25, 783.99, 1046.5]);
  }

  playPickup() {
    this._playChime([523.25, 659.25, 783.99]);
  }

  _playLiquidGlug(count = 1) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < count; i++) {
      const start = t0 + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(220 + i * 60, start);
      osc.frequency.exponentialRampToValueAtTime(540 + i * 70, start + 0.08);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.095);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.1);
    }
  }

  _playRatchetWrench() {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [0, 0.065].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(idx === 0 ? 880 : 1240, t0 + offset);
      osc.frequency.exponentialRampToValueAtTime(420, t0 + offset + 0.045);
      gain.gain.setValueAtTime(0.11, t0 + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + offset + 0.055);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.06);
    });
  }

  _playChime(freqs) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      gain.gain.setValueAtTime(0.09, now + i * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.17);
    });
  }

  // ==================== 5. VICTORY & GAME OVER / PENALTY ====================

  playVictory() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Nhạc hiệu thông quan rộn ràng (Đô trưởng ngũ cung đi lên + nốt ngân)
    const melody = [
      { f: 523.25, t: 0, d: 0.12 },
      { f: 659.25, t: 0.1, d: 0.12 },
      { f: 783.99, t: 0.2, d: 0.12 },
      { f: 880.0, t: 0.3, d: 0.14 },
      { f: 1046.5, t: 0.44, d: 0.45 },
    ];
    melody.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.14, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    });
  }

  playGameOver() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Motif trầm lắng khi gặp sự cố giao hàng
    const notes = [
      { f: 392.0, t: 0, d: 0.2 },
      { f: 349.23, t: 0.2, d: 0.2 },
      { f: 311.13, t: 0.4, d: 0.22 },
      { f: 261.63, t: 0.62, d: 0.55 },
    ];
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 650;

      osc.frequency.setValueAtTime(n.f, now + n.t);
      gain.gain.setValueAtTime(0.095, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    });
  }

  playPenalty() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [240, 175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.075, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.15);
    });
  }

  // ==================== 6. NHẠC NỀN HÀNH TRÌNH VIỆT NAM (NGŨ CUNG VUI TƯƠI) ====================

  startMusic() {
    if (!this.enabled || this.isMusicPlaying) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    this.isMusicPlaying = true;
    this.nextNoteTime = ctx.currentTime + 0.05;

    // Thang âm ngũ cung Đô trưởng (C - D - E - G - A) vui tươi, phóng khoáng (~112 BPM, mỗi bước = móc đơn)
    const leadPattern = [
      523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33,
      523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 0,
      783.99, 880.0, 1046.5, 880.0, 783.99, 659.25, 587.33, 659.25,
      783.99, 659.25, 587.33, 523.25, 587.33, 659.25, 523.25, 0,
    ];
    const bassPattern = [
      130.81, 0, 196.0, 0, 146.83, 0, 196.0, 0,
      164.81, 0, 196.0, 0, 130.81, 196.0, 130.81, 0,
      196.0, 0, 220.0, 0, 174.61, 0, 196.0, 0,
      146.83, 0, 196.0, 0, 130.81, 0, 130.81, 0,
    ];

    const stepDuration = 0.24; // ~125 BPM nhẹ nhàng, hứng khởi

    this.musicTimerId = setInterval(() => {
      if (!this.enabled || !this.isMusicPlaying || !this.ctx) return;
      if (this.ctx.state === "suspended") return;

      while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
        const step = this.musicStep % leadPattern.length;
        const leadFreq = leadPattern[step];
        const bassFreq = bassPattern[step];
        const t = this.nextNoteTime;

        if (leadFreq > 0) {
          this._scheduleMusicTone(leadFreq, t, stepDuration * 0.85, "triangle", 0.036);
        }
        if (bassFreq > 0) {
          this._scheduleMusicTone(bassFreq, t, stepDuration * 0.9, "sine", 0.042);
        }
        if (step % 2 === 1) {
          this._scheduleLightShaker(t);
        }

        this.nextNoteTime += stepDuration;
        this.musicStep += 1;
      }
    }, 80);
  }

  _scheduleMusicTone(freq, startTime, duration, type, volume) {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0005, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  _scheduleLightShaker(startTime) {
    if (!this.ctx || !this.masterGain) return;
    const len = Math.floor(this.ctx.sampleRate * 0.035);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5200;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.016;
    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain);
    src.start(startTime);
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicTimerId) {
      clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
  }
}
