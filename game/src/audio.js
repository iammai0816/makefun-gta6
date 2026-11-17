// Neon Bay — all sound is synthesized with WebAudio. No audio files, no network.
// SFX: gunshot, punch, pickup, siren blip, car steal, mission jingle, bust sting.
// Music: a laid-back synthwave bassline + hats sequenced on a lookahead timer.
export function createAudio() {
  const audio = { ctx: null, muted: false, musicOn: false, _musicTimer: null, _step: 0 };

  audio.ensure = function () {
    if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    } catch { /* audio unavailable: game stays silent */ }
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(audio.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource(); src.buffer = buf;
    const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = audio.ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(f); f.connect(g); g.connect(audio.master);
    src.start(t);
  }

  audio.shoot = () => { noise(0.12, 0.3, 2500); tone(180, 0.1, 'square', 0.12, 60); };
  audio.punch = () => { noise(0.08, 0.25, 700); };
  audio.pickup = () => { tone(660, 0.08, 'sine', 0.18); setTimeout(() => tone(990, 0.12, 'sine', 0.18), 70); };
  audio.steal = () => { tone(220, 0.15, 'sawtooth', 0.12, 440); };
  audio.crash = () => { noise(0.25, 0.3, 500); };
  audio.siren = () => { tone(750, 0.35, 'sine', 0.07, 950); setTimeout(() => tone(950, 0.35, 'sine', 0.07, 750), 350); };
  audio.busted = () => { tone(392, 0.25, 'triangle', 0.2); setTimeout(() => tone(311, 0.25, 'triangle', 0.2), 250); setTimeout(() => tone(233, 0.6, 'triangle', 0.2), 500); };
  audio.missionDone = () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.18), i * 110)); };
  audio.click = () => tone(800, 0.05, 'sine', 0.1);
  audio.engine = function (speed01) {
    if (!audio.ctx || audio.muted) return;
    if (!audio._engineOsc) {
      audio._engineOsc = audio.ctx.createOscillator();
      audio._engineGain = audio.ctx.createGain();
      audio._engineOsc.type = 'sawtooth'; audio._engineOsc.frequency.value = 60;
      audio._engineGain.gain.value = 0;
      const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      audio._engineOsc.connect(f); f.connect(audio._engineGain); audio._engineGain.connect(audio.master);
      audio._engineOsc.start();
    }
    audio._engineOsc.frequency.value = 55 + speed01 * 140;
    audio._engineGain.gain.value = speed01 > 0.02 ? 0.045 : 0;
  };

  // Simple 8-step synthwave loop: bass notes + hat ticks.
  const BASS = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4];
  audio.startMusic = function () {
    if (!audio.ctx || audio.musicOn) return;
    audio.musicOn = true; audio._step = 0;
    audio._musicTimer = setInterval(() => {
      if (audio.muted || !audio.ctx) return;
      const n = BASS[audio._step % 8];
      if (n) tone(n, 0.22, 'triangle', 0.12);
      if (audio._step % 2 === 0) noise(0.03, 0.04, 6000);
      audio._step++;
    }, 240);
  };
  audio.stopMusic = function () {
    audio.musicOn = false;
    if (audio._musicTimer) { clearInterval(audio._musicTimer); audio._musicTimer = null; }
  };
  audio.toggleMute = function () {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };
  return audio;
}
