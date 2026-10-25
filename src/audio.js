// Ses dosyası gerektirmeyen küçük efektler (WebAudio ile üretilir).

const SOUNDS = {
  pick: [[520, 0.05], [780, 0.06]],
  drop: [[440, 0.05], [330, 0.06]],
  cash: [[988, 0.05], [1319, 0.09]],
  pay: [[660, 0.03]],
  unlock: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.16]],
  coin: [[1200, 0.05], [1600, 0.08]],
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.last = {};
    const unlock = () => {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
          this.ctx = null;
        }
      }
      this.ctx?.resume?.();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  play(name, volume = 1) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.045) return; // aynı sesi üst üste bindirme
    this.last[name] = now;
    let t = now;
    for (const [freq, dur] of SOUNDS[name] ?? []) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18 * volume, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
      t += dur * 0.8;
    }
  }
}
