// Arka plan müziği: dosya gerektirmeyen, WebAudio ile çalınan polifonik müzik.
// "Duruma göre" modunda müzik oyunun anına göre değişir (ölçü başlarında yumuşak geçiş):
//   sabah (sakin, davulsuz) · gündüz (neşeli) · yoğun saat / kampanya (hızlı, davullu)
//   akşam (caz: 7'li akorlar, swing) · gece (lo-fi, yavaş) · kutlama (disko)
// "Klasik" modunda eski tek döngü çalar.

// MIDI → frekans
const f = (n) => 440 * 2 ** ((n - 69) / 12);

// Akorlar (kök + üçlü + beşli [+ yedili]) — her biri 1 ölçü (16 adım)
const C = [60, 64, 67, 71];
const G = [55, 59, 62, 65];
const Am = [57, 60, 64, 67];
const F = [53, 57, 60, 64];
const Dm = [50, 53, 57, 60];
const Em = [52, 55, 59, 62];
const PROGS = {
  A: [C, G, Am, F],
  B: [F, G, Em, Am],
  C: [Dm, G, C, C],
  J: [Dm, G, C, Am],     // caz: ii–V–I–vi
  L: [F, Em, Dm, C],     // lo-fi: inen
};

// Melodi kalıpları (akor notası derecesi; null = sus). 16 adım.
const MEL = [
  [2, null, 1, null, 0, null, 1, 2, null, 2, null, 1, 0, null, null, null],
  [1, null, 2, null, 3, null, 2, null, 1, null, 0, null, 1, null, null, null],
  [2, null, 2, 1, 0, null, null, 1, 2, null, 3, null, 2, null, null, null],
  [0, null, 1, null, 2, null, 1, null, 0, null, null, null, -1, null, null, null],
  [0, null, 2, null, 3, null, 2, null, 4, null, 3, null, 2, null, null, null],
  [4, null, 3, null, 2, null, 1, null, 2, null, 0, null, 0, null, null, null],
  [2, null, null, 3, null, null, 4, null, 3, null, null, 2, null, null, null, null],
  [0, null, null, null, 2, null, null, null, 1, null, null, null, null, null, null, null],
];

// Ruh halleri: tempo, bölüm sırası, katmanlar ve ses rengi
const MOODS = {
  classic: { bpm: 104, order: ['A', 'A', 'B', 'C'], kick: [0, 8], hat: 'off', arp: 'square', arpRate: 2, lead: 'triangle', bass: 'root', cutoff: 2400, mel: 1, swing: 0 },
  morning: { bpm: 96, order: ['A', 'B'], kick: [], hat: 'none', arp: 'triangle', arpRate: 2, lead: 'sine', bass: 'root', cutoff: 1800, mel: 0.8, swing: 0, pad: 0.5 },
  day: { bpm: 106, order: ['A', 'A', 'B', 'C'], kick: [0, 8], hat: 'off', arp: 'square', arpRate: 2, lead: 'triangle', bass: 'root', cutoff: 2600, mel: 1, swing: 0 },
  rush: { bpm: 118, order: ['A', 'B', 'A', 'C'], kick: [0, 4, 8, 12], hat: 'busy', arp: 'square', arpRate: 1, lead: 'square', bass: 'octave', cutoff: 3600, mel: 1, swing: 0, clap: true },
  evening: { bpm: 90, order: ['J', 'J', 'B'], kick: [0, 10], hat: 'soft', arp: 'epiano', arpRate: 4, lead: 'sine', bass: 'walk', cutoff: 2000, mel: 0.7, swing: 0.18, seventh: true },
  night: { bpm: 78, order: ['L', 'J'], kick: [0], hat: 'soft', arp: 'epiano', arpRate: 4, lead: 'sine', bass: 'root', cutoff: 1200, mel: 0.45, swing: 0.12, seventh: true, pad: 0.6 },
  party: { bpm: 124, order: ['A', 'C'], kick: [0, 4, 8, 12], hat: 'disco', arp: 'square', arpRate: 1, lead: 'square', bass: 'octave', cutoff: 4200, mel: 1, swing: 0, clap: true },
};

export const MUSIC_MOOD_NAMES = { morning: 'Sabah', day: 'Gündüz', rush: 'Yoğun saat', evening: 'Akşam', night: 'Gece', party: 'Kutlama', classic: 'Klasik' };

export class Music {
  constructor(audio) {
    this.audio = audio;
    this.enabled = true;
    this.adaptive = true;
    this.playing = false;
    this.bar = 0;
    this.step = 0;
    this.next = 0;
    this.volume = 0.6;
    this.target = 'day';
    this.mood = MOODS.day;
    this.moodName = 'day';
    this.mel = 0;
  }

  get ctx() {
    return this.audio.ctx;
  }

  get stepLen() {
    return 60 / this.mood.bpm / 4; // 16'lık nota süresi
  }

  start() {
    if (this.playing || !this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    this.playing = true;
    const ctx = this.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0.0001;
    this.out.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.09 * this.volume), ctx.currentTime + 2);
    // Ses rengi (alçak geçiren filtre) + hafif yankı
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = this.mood.cutoff;
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.43;
    const fb = ctx.createGain();
    fb.gain.value = 0.25;
    this.out.connect(this.lp);
    this.lp.connect(ctx.destination);
    this.lp.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(ctx.destination);
    this.delay = delay;
    this.next = ctx.currentTime + 0.1;
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

  setVolume(v) {
    this.volume = v;
    if (this.playing) this.out.gain.setTargetAtTime(Math.max(0.0002, 0.09 * v), this.ctx.currentTime, 0.2);
  }

  /** Oyunun durumuna göre hedef ruh hali (game.update içinden saniyede bir). */
  react(game) {
    if (!this.adaptive) {
      this.target = 'classic';
      return;
    }
    let m;
    if (game.party?.active) m = 'party';
    else if (game.viewMode === 'home') m = 'morning';
    else {
      const d = game.day;
      const h = d.hour % 24;
      const busy = game.customers.length >= 22 || (game.campaign.active.length > 0 && d.isOpen && h < 16);
      if (d.phase !== 'open') m = 'night';
      else if (busy) m = 'rush';
      else if (h < 11) m = 'morning';
      else if (h < 17.5) m = 'day';
      else m = 'evening';
    }
    this.target = m;
  }

  /** Önümüzdeki ~150 ms'deki notaları zamanla. */
  schedule() {
    if (!this.playing) return;
    const ctx = this.ctx;
    while (this.next < ctx.currentTime + 0.15) {
      if (this.step === 0) this.atBar();
      this.playStep(this.next);
      // Swing: tek 16'lıklar biraz geç
      const sw = this.mood.swing ?? 0;
      this.next += this.stepLen * (this.step % 2 === 0 ? 1 + sw : 1 - sw);
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.bar++;
      }
    }
  }

  /** Ölçü başı: ruh hali değiştiyse geçiş, her bölümde yeni melodi. */
  atBar() {
    const target = this.target ?? 'day';
    // Kutlamaya hemen geç; diğerlerine 2 ölçüde bir (ani değişim olmasın)
    if (target !== this.moodName && (target === 'party' || this.moodName === 'party' || this.bar % 2 === 0)) {
      this.moodName = target;
      this.mood = MOODS[target] ?? MOODS.day;
      this.bar = 0;
      if (this.lp) this.lp.frequency.setTargetAtTime(this.mood.cutoff, this.ctx.currentTime, 0.6);
    }
    if (this.bar % 4 === 0) this.mel = Math.floor(Math.random() * MEL.length);
  }

  playStep(t) {
    const M = this.mood;
    const sec = M.order[Math.floor(this.bar / 4) % M.order.length];
    const i = this.bar % 4;
    const chord = PROGS[sec][i];
    const s = this.step;
    const L = this.stepLen;
    // Bas
    if (M.bass === 'root' && s % 4 === 0) this.note('triangle', f(chord[0] - 24 + (s === 8 ? 7 : 0)), t, L * 3.5, 0.9);
    if (M.bass === 'octave' && s % 2 === 0) this.note('triangle', f(chord[0] - (s % 4 === 0 ? 24 : 12)), t, L * 1.6, 0.85);
    if (M.bass === 'walk' && s % 4 === 0) this.note('sine', f([chord[0], chord[2], chord[1], chord[0] + 2][s / 4] - 24), t, L * 3.6, 1);
    // Ped (uzun akor, yumuşak)
    if (M.pad && s === 0) for (const n of chord.slice(0, 3)) this.note('sine', f(n), t, L * 15, 0.12 * M.pad);
    // Arpej / elektrikli piyano
    if (s % M.arpRate === 0) {
      const tones = M.seventh ? chord : chord.slice(0, 3);
      const n = tones[(s / M.arpRate) % tones.length] + 12;
      if (M.arp === 'epiano') this.epiano(f(n), t, L * 3, 0.16);
      else this.note(M.arp, f(n), t, L * 1.2, M.arp === 'square' ? 0.16 : 0.22);
    }
    // Melodi
    const deg = MEL[this.mel][s];
    if (deg !== null && deg !== undefined && Math.random() < M.mel) {
      const tones = [chord[0], chord[1], chord[2], chord[0] + 12, chord[1] + 12];
      const n = 12 + (deg < 0 ? chord[0] - 2 : tones[deg]);
      this.note(M.lead, f(n), t, L * 2.6, M.lead === 'square' ? 0.3 : 0.55);
    }
    // Ritim
    if (M.hat === 'off' && (s % 2 === 1 || s % 4 === 2)) this.hat(t, s % 4 === 2 ? 0.35 : 0.18);
    if (M.hat === 'busy' && s % 1 === 0) this.hat(t, s % 2 ? 0.16 : 0.3);
    if (M.hat === 'soft' && s % 4 === 2) this.hat(t, 0.12);
    if (M.hat === 'disco' && s % 4 === 2) this.hat(t, 0.5, 0.12);
    if (M.kick.includes(s)) this.kick(t);
    if (M.clap && (s === 4 || s === 12)) this.hat(t, 0.45, 0.09, 1800);
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

  /** Elektrikli piyano benzeri ses (basit FM). */
  epiano(freq, t, dur, vol) {
    const ctx = this.ctx;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    car.type = 'sine';
    mod.type = 'sine';
    car.frequency.value = freq;
    mod.frequency.value = freq * 2;
    mg.gain.setValueAtTime(freq * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur * 0.6);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g).connect(this.out);
    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.02);
    mod.stop(t + dur + 0.02);
  }

  hat(t, vol, len = 0.05, freq = 7000) {
    const ctx = this.ctx;
    this.noise ??= (() => {
      const b = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    })();
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = freq < 3000 ? 'bandpass' : 'highpass';
    hp.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(hp).connect(g).connect(this.out);
    src.start(t);
    src.stop(t + len + 0.01);
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
