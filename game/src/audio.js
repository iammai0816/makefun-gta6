// Synthesized sound: every effect and the music loop are built with
// WebAudio oscillators and noise — no audio files, no network.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.sfxOn = true;
    this.musicTimer = null;
    this.step = 0;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || !this.sfxOn || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || !this.sfxOn || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.15;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  shoot() { this.noise(0.12, 0.25, 3200); this.tone(180, 0.09, 'square', 0.10, 60); }
  punch() { this.noise(0.08, 0.2, 900); }
  pickup() { this.tone(660, 0.09, 'sine', 0.14); setTimeout(() => this.tone(990, 0.12, 'sine', 0.14), 80); }
  cash() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.14, 'triangle', 0.14), i * 90)); }
  sirenBlip() { this.tone(880, 0.16, 'sine', 0.06, 660); }
  crash() { this.noise(0.25, 0.3, 500); this.tone(90, 0.2, 'sawtooth', 0.12, 40); }
  carStart() { this.tone(70, 0.35, 'sawtooth', 0.10, 160); }
  door() { this.tone(220, 0.08, 'square', 0.08, 140); }
  missionDone() { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'triangle', 0.16), i * 110)); }
  hurt() { this.tone(140, 0.18, 'sawtooth', 0.14, 70); }
  busted() { [440, 415, 392, 370].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.12), i * 160)); }
  engineHum(speedRatio) {
    if (!this.ctx || !this.sfxOn || this.muted) return;
    this.tone(55 + speedRatio * 90, 0.09, 'sawtooth', 0.03);
  }

  // A laid-back synthwave loop: bass line + sparse lead, scheduled in 8th notes.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0];
    const lead = [220, 0, 261.6, 0, 329.6, 0, 392, 329.6, 293.7, 0, 261.6, 0, 220, 0, 196, 0];
    this.musicTimer = setInterval(() => {
      if (!this.musicOn || this.muted || !this.ctx) return;
      const b = bass[this.step % bass.length];
      const l = lead[this.step % lead.length];
      if (b) this.tone(b, 0.22, 'triangle', 0.10);
      if (l && this.step % 2 === 0) this.tone(l, 0.2, 'sine', 0.05);
      if (this.step % 16 === 8) this.noise(0.05, 0.04, 6000);
      this.step++;
    }, 210);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
