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
    // Seviye, saat, gün sonu
    this.levelValue = document.getElementById('level-value');
    this.levelFill = document.getElementById('level-fill');
    this.clockEl = document.getElementById('clock');
    this.clockDay = document.getElementById('clock-day');
    this.clockTime = document.getElementById('clock-time');
    this.summary = document.getElementById('summary');
    this.skipBtn = document.getElementById('skip-night');
    this.levelupEl = document.getElementById('levelup');
    this.summaryOpen = false;
    document.getElementById('sum-night').addEventListener('click', () => this.closeSummary());
    document.getElementById('sum-skip').addEventListener('click', () => {
      this.closeSummary();
      game.day.skipNight();
    });
    this.skipBtn.addEventListener('click', () => game.day.skipNight());

    // Menü düğmelerine basmak joystick başlatmasın
    for (const el of [document.getElementById('menu-btn'), this.menu, this.summary, this.skipBtn]) {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
  }

  setCrisis(text) {
    const el = document.getElementById('crisis');
    el.textContent = text ?? '';
    el.classList.toggle('hidden', !text);
  }

  setRating(stars) {
    const v = stars.toFixed(1);
    if (this.ratingShown === v) return;
    this.ratingShown = v;
    document.getElementById('rating-value').textContent = v;
    document.getElementById('rating-fill').style.width = `${(stars / 5) * 100}%`;
    document.getElementById('rating').classList.toggle('low', stars < 2.5);
  }

  setLevel(level, frac) {
    if (this.levelValue.textContent !== String(level)) this.levelValue.textContent = level;
    this.levelFill.style.width = `${Math.round(frac * 100)}%`;
  }

  setClock(day, time, phase) {
    const d = `Gün ${day}`;
    if (this.clockDay.textContent !== d) this.clockDay.textContent = d;
    const t = phase === 'open' ? time : phase === 'closing' ? 'Kapanıyor' : `🌙 ${time}`;
    if (this.clockTime.textContent !== t) this.clockTime.textContent = t;
    this.clockEl.classList.toggle('closed', phase !== 'open');
    this.skipBtn.classList.toggle('hidden', phase !== 'night' || this.summaryOpen);
  }

  showSummary(day, st) {
    document.getElementById('summary-title').textContent = `Gün ${day} bitti`;
    document.getElementById('sum-revenue').textContent = `$${formatMoney(st.revenue)}`;
    document.getElementById('sum-customers').textContent = st.customers;
    document.getElementById('sum-crates').textContent = st.crates;
    document.getElementById('sum-spent').textContent = `$${formatMoney(st.spent)}`;
    document.getElementById('sum-angry').textContent = st.angry;
    document.getElementById('sum-stolen').textContent = st.stolen ?? 0;
    const extra = [];
    if (st.interestPaid) extra.push(`<div class="bad"><span>🏦 Kredi faizi</span><b>−$${formatMoney(st.interestPaid)}</b></div>`);
    if (st.interestEarned) extra.push(`<div class="good"><span>🏦 Mevduat faizi</span><b>+$${formatMoney(st.interestEarned)}</b></div>`);
    if (st.campaign) {
      const c = st.campaign;
      extra.push(`<div><span>📢 Kampanya: satılan / stok</span><b>${c.sold} / ${c.qty}</b></div>`);
      if (st.campaignUnhappy) extra.push(`<div class="bad"><span>😠 Ürün bulamayan kampanya müşterisi</span><b>${st.campaignUnhappy}</b></div>`);
      extra.push(`<div class="${c.left ? 'bad' : 'good'}"><span>📦 Kalan stok zararı (${c.left} kasa)</span><b>${c.left ? `−$${formatMoney(c.loss)}` : '$0'}</b></div>`);
    }
    document.getElementById('sum-extra').innerHTML = extra.join('');
    this.summary.classList.remove('hidden');
    this.summaryOpen = true;
  }

  closeSummary() {
    this.summary.classList.add('hidden');
    this.summaryOpen = false;
  }

  levelUp(level, features) {
    this.levelupEl.innerHTML = `⭐ Seviye ${level}!${features.length ? `<small>Yeni: ${features.join(', ')}</small>` : ''}`;
    this.levelupEl.classList.remove('hidden');
    this.levelupEl.style.animation = 'none';
    void this.levelupEl.offsetWidth;
    this.levelupEl.style.animation = '';
    clearTimeout(this.levelupTimer);
    this.levelupTimer = setTimeout(() => this.levelupEl.classList.add('hidden'), 3200);
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
