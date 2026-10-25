// DOM tabanlı arayüz: para göstergesi, ipucu, bildirim, menü.

export class Hud {
  constructor(game) {
    this.game = game;
    this.moneyEl = document.getElementById('money');
    this.moneyValue = document.getElementById('money-value');
    this.hintEl = document.getElementById('hint');
    this.toastEl = document.getElementById('toast');
    this.menu = document.getElementById('menu');
    this.shown = 0;
    this.displayed = 0;
    this.toastTimer = null;

    document.getElementById('menu-btn').addEventListener('click', () => this.menu.classList.remove('hidden'));
    document.getElementById('close-menu').addEventListener('click', () => this.menu.classList.add('hidden'));
    document.getElementById('reset-btn').addEventListener('click', () => game.reset());
    const sound = document.getElementById('opt-sound');
    sound.checked = game.audio.enabled;
    sound.addEventListener('change', () => { game.audio.enabled = sound.checked; });
    // Menü düğmelerine basmak joystick başlatmasın
    for (const el of [document.getElementById('menu-btn'), this.menu]) {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
  }

  setMoney(v) {
    this.target = v;
  }

  bump() {
    this.moneyEl.classList.add('bump');
    clearTimeout(this.bumpT);
    this.bumpT = setTimeout(() => this.moneyEl.classList.remove('bump'), 120);
  }

  hint(text) {
    if (text === this.lastHint) return;
    this.lastHint = text;
    if (!text) this.hintEl.classList.add('hidden');
    else {
      this.hintEl.textContent = text;
      this.hintEl.classList.remove('hidden');
    }
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    // animasyonu yeniden başlat
    this.toastEl.style.animation = 'none';
    void this.toastEl.offsetWidth;
    this.toastEl.style.animation = '';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), 1800);
  }

  update(dt) {
    const target = this.target ?? 0;
    if (this.displayed !== target) {
      const diff = target - this.displayed;
      const step = Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt * 10));
      this.displayed = Math.abs(step) >= Math.abs(diff) ? target : this.displayed + step;
      this.moneyValue.textContent = formatMoney(Math.round(this.displayed));
    }
  }
}

export function formatMoney(v) {
  if (v >= 100000) return `${(v / 1000).toFixed(0)}K`;
  if (v >= 10000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
}
