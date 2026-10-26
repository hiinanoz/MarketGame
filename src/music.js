// Arka plan müziği: dosya gerektirmeyen, WebAudio ile çalınan 16-bit tarzı polifonik döngü.
// Rahatlatıcı ama enerjik: 104 BPM, majör akorlar, yumuşak üçgen/kare dalga, hafif ritim.
// Dört bölüm (A A B C) dönüşümlü çalar; ses düşük tutulur, efektleri bastırmaz.

const BPM = 104;
const STEP = 60 / BPM / 4; // 16'lık nota süresi

// MIDI → frekans
const f = (n) => 440 * 2 ** ((n - 69) / 12);

// Akorlar (kök nota, majör/minör üçlü) — her biri 1 ölçü (16 adım)
const C = [60, 64, 67];
const G = [55, 59, 62];
const Am = [57, 60, 64];
const F = [53, 57, 60];
const Dm = [50, 53, 57];
const Em = [52, 55, 59];
const SECTIONS = {
  A: [C, G, Am, F],
  B: [F, G, Em, Am],
  C: [Dm, G, C, C],
};
const ORDER = ['A', 'A', 'B', 'C'];

// Melodi kalıpları (akordaki notalara göre derece; null = sus). 16 adım.
const MELODY = {
  A: [
    [2, null, 1, null, 0, null, 1, 2, null, 2, null, 1, 0, null, null, null],
    [1, null, 2, null, 3, null, 2, null, 1, null, 0, null, 1, null, null, null],
    [2, null, 2, 1, 0, null, null, 1, 2, null, 3, null, 2, null, null, null],
    [0, null, 1, null, 2, null, 1, null, 0, null, null, null, -1, null, null, null],
  ],
  B: [
    [0, null, 2, null, 3, null, 2, null, 4, null, 3, null, 2, null, null, null],
    [1, null, 2, null, 3, null, 4, null, 3, null, 2, null, 1, null, null, null],
    [2, null, 1, null, 2, null, 3, null, 2, null, 1, null, 0, null, null, null],
    [0, null, 1, null, 2, 2, null, 1, 0, null, null, null, null, null, null, null],
  ],
  C: [
    [2, null, 3, null, 4, null, 3, 2, null, 2, null, 1, 0, null, null, null],
    [1, null, 2, null, 3, null, 2, null, 1, null, 2, null, 3, null, null, null],
    [4, null, 3, null, 2, null, 1, null, 2, null, 0, null, 0, null, null, null],
    [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  ],
};

export class Music {
  constructor(audio) {
    this.audio = audio;
    this.enabled = true;
    this.playing = false;
    this.bar = 0;
    this.step = 0;
    this.next = 0;
    this.volume = 0.5;
  }

  get ctx() {
    return this.audio.ctx;
  }

  start() {
    if (this.playing || !this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    this.playing = true;
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.gain.exponentialRampToValueAtTime(0.09 * this.volume, this.ctx.currentTime + 2);
    // Hafif yankı (delay) — sıcak ve yumuşak bir ses
    const delay = this.ctx.createDelay();
    delay.delayTime.value = STEP * 3;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.25;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    this.out.connect(lp);
    lp.connect(this.ctx.destination);
    lp.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(this.ctx.destination);
    this.delayOut = delay;
    this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 50);
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    const out = this.out;
    setTimeout(() => out.disconnect(), 700);
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.start();
    else this.stop();
  }

  /** Önümüzdeki ~150 ms'deki notaları zamanla. */
  schedule() {
    if (!this.playing) return;
    const ctx = this.ctx;
    while (this.next < ctx.currentTime + 0.15) {
      this.playStep(this.next);
      this.next += STEP;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.bar = (this.bar + 1) % (ORDER.length * 4);
      }
    }
  }

  playStep(t) {
    const sec = ORDER[Math.floor(this.bar / 4)];
    const i = this.bar % 4;
    const chord = SECTIONS[sec][i];
    const s = this.step;
    // Bas: 1 ve 3. vuruşta kök, aralarda beşli
    if (s % 4 === 0) this.note('triangle', f(chord[0] - 24 + (s === 8 ? 7 : 0)), t, STEP * 3.5, 0.9);
    // Arpej (yumuşak kare dalga): 8'lik notalarla akor
    if (s % 2 === 0) this.note('square', f(chord[(s / 2) % 3] + 12), t, STEP * 1.2, 0.18);
    // Melodi (üçgen, bir oktav yukarı)
    const deg = MELODY[sec][i][s];
    if (deg !== null && deg !== undefined) {
      const tones = [chord[0], chord[1], chord[2], chord[0] + 12, chord[1] + 12];
      const n = 12 + (deg < 0 ? chord[0] - 2 : tones[deg]);
      this.note('triangle', f(n), t, STEP * 2.6, 0.55);
    }
    // Ritim: hafif hi-hat (gürültü) ve yumuşak davul
    if (s % 2 === 1 || s % 4 === 2) this.hat(t, s % 4 === 2 ? 0.35 : 0.18);
    if (s === 0 || s === 8) this.kick(t);
  }

  note(type, freq, t, dur, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vol * 0.5, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hat(t, vol) {
    const ctx = this.ctx;
    this.noise ??= (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + 0.06);
  }

  kick(t) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.2);
  }
}
