// Ses dosyası gerektirmeyen küçük efektler (WebAudio ile üretilir).

const SOUNDS = {
  pick: [[520, 0.05], [780, 0.06]],
  drop: [[440, 0.05], [330, 0.06]],
  cash: [[988, 0.05], [1319, 0.09]],
  pay: [[660, 0.03]],
  unlock: [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.16]],
  coin: [[1200, 0.05], [1600, 0.08]],
  beat: [[98, 0.09], [196, 0.05]],
  // Seviye kutlaması: yükselen arpej + parlak bitiş
  levelup: [[523, 0.09], [659, 0.09], [784, 0.09], [1047, 0.12], [784, 0.07], [1047, 0.1], [1319, 0.1], [1568, 0.32]],
};

// Gerçek ses efektleri (Kenney ses paketleri, CC0): src/assets/sfx/*.mp3 — adın sonundaki rakam
// aynı sesin çeşitleri (rastgele seçilir). Yüklenemezse yukarıdaki sentez sesleri çalar.
const SFX_URLS = import.meta.glob('./assets/sfx/*.mp3', { eager: true, query: '?url', import: 'default' });
const SFX_ALIAS = { levelup: 'j_levelup', quest: 'j_quest', reward: 'j_reward', party: 'j_party' };
const NO_PITCH = new Set(['j_levelup', 'j_quest', 'j_reward', 'j_party', 'click', 'open', 'close']);

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.8;   // efekt ses seviyesi (ayarlar)
    this.last = {};
    this.buffers = {};   // ad → [AudioBuffer]
    const unlock = () => {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch {
          this.ctx = null;
        }
      }
      if (this.ctx && !this.loading) this.loadSamples();
      const p = this.ctx?.resume?.();
      if (p?.then) p.then(() => this.onUnlock?.());
      else this.onUnlock?.();
    };
    // Yakalama aşamasında dinle: paneller pointerdown'ı durdursa da ses açılsın (iOS: touchend/click)
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock, { capture: true });
  }

  /** Ses dosyalarını bir kez çöz (ilk dokunuşta). */
  async loadSamples() {
    this.loading = true;
    await Promise.all(Object.entries(SFX_URLS).map(async ([path, url]) => {
      const file = path.split('/').pop().replace('.mp3', '');
      const key = file.startsWith('j_') ? file : file.replace(/\d+$/, '');
      try {
        const buf = await this.ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
        (this.buffers[key] ??= []).push(buf);
      } catch { /* bu ses yoksa sentez çalar */ }
    }));
  }

  play(name, volume = 1) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.045) return; // aynı sesi üst üste bindirme
    this.last[name] = now;
    const key = SFX_ALIAS[name] ?? name;
    const list = this.buffers[key];
    if (list?.length) {
      const src = this.ctx.createBufferSource();
      src.buffer = list[Math.floor(Math.random() * list.length)];
      if (!NO_PITCH.has(key)) src.playbackRate.value = 0.94 + Math.random() * 0.12; // her seferinde biraz farklı
      const g = this.ctx.createGain();
      g.gain.value = Math.min(1.5, volume) * this.volume * 0.9;
      src.connect(g).connect(this.ctx.destination);
      src.start(now);
      return;
    }
    if (!SOUNDS[name]) return;
    let t = now;
    for (const [freq, dur] of SOUNDS[name] ?? []) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.18 * volume * this.volume), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
      t += dur * 0.8;
    }
  }
}
