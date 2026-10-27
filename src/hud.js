import { platform } from './platform.js';
import { PRODUCTS } from './config.js';
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

    document.getElementById('menu-btn').addEventListener('click', () => {
      this.menu.classList.remove('hidden');
      game.menuOpen = true;
      this.syncPaused();
    });
    document.getElementById('close-menu').addEventListener('click', () => {
      this.menu.classList.add('hidden');
      game.menuOpen = false;
    });
    document.getElementById('reset-btn').addEventListener('click', () => game.reset());
    // Ayarlar (bu cihazda saklanır)
    const opts = game.options;
    const bind = (id, key, apply) => {
      const el = document.getElementById(id);
      el.checked = !!opts[key];
      el.addEventListener('change', () => {
        opts[key] = el.checked;
        game.saveOptions();
        apply?.(el.checked);
        this.syncPaused();
      });
    };
    bind('opt-sound', 'sound', (on) => { game.audio.enabled = on; });
    bind('opt-music', 'music', (on) => game.music.setEnabled(on));
    bind('opt-bg', 'background');
    // Çoklu seçim düğmeleri (hız, görüş açısı)
    const seg = (id, key, parse = (v) => v, apply) => {
      const el = document.getElementById(id);
      const sync = () => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', parse(b.dataset.v) === opts[key]));
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        opts[key] = parse(b.dataset.v);
        game.saveOptions();
        sync();
        apply?.();
      });
      sync();
      return sync;
    };
    this.syncSpeedSeg = seg('opt-speed', 'speed', Number, () => this.syncSpeed());
    seg('opt-cam', 'cam');
    this.speedBtn = document.getElementById('speed-btn');
    this.speedBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.speedBtn.addEventListener('click', () => {
      const steps = [1, 1.5, 2];
      opts.speed = steps[(steps.indexOf(opts.speed) + 1) % steps.length];
      game.saveOptions();
      this.syncSpeed();
      this.syncSpeedSeg();
    });
    this.syncSpeed();
    // Günü tamamla: kalan gün hızlıca simüle edilir, gün sonu özeti gelir
    document.getElementById('finish-day').addEventListener('click', () => {
      this.menu.classList.add('hidden');
      game.menuOpen = false;
      game.finishDay();
    });
    // Seviye kutlaması
    this.lvlPop = document.getElementById('lvl-pop');
    this.lvlPop.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.getElementById('lvl-ok').addEventListener('click', () => this.closeLevelPop());
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
    document.getElementById('sum-night').addEventListener('click', () => {
      if (game.payOvertime()) this.closeSummary();
    });
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

  setGems(n) {
    const el = document.getElementById('gems-count');
    if (el) el.textContent = n;
  }

  /** Görev düğmesindeki rozet: kalan görev sayısı. */
  syncQuests() {
    const left = (this.game.goals?.quests ?? []).filter((q) => !q.done).length;
    const b = document.getElementById('quest-badge');
    if (!b) return;
    b.textContent = left;
    b.classList.toggle('hidden', !left);
  }

  setCrisis(text) {
    const el = document.getElementById('crisis');
    el.textContent = text ?? '';
    el.classList.toggle('hidden', !text);
  }

  syncSpeed() {
    const sp = this.game.options.speed ?? 1;
    this.speedBtn.classList.toggle('on', sp > 1);
    this.speedBtn.textContent = `${sp}×`;
    this.speedBtn.title = `Oyun hızı ${sp}× (dokun: değiştir)`;
  }

  syncPaused() {
    document.getElementById('menu-paused').textContent = this.game.options.background ? '▶️ Oyun arka planda devam ediyor' : '⏸️ Oyun duraklatıldı';
  }

  /** Sv.21+: toplam çalışan sayısı (null: gizle). */
  setStaff(n) {
    if (n === this.staffShown) return;
    this.staffShown = n;
    document.getElementById('staff-pill').classList.toggle('hidden', n === null);
    if (n !== null) document.getElementById('staff-count').textContent = n;
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
    if (st.interestPaid) extra.push(`<div class="bad"><span>🏦 Kredi faizi (ödendi)</span><b>−$${formatMoney(st.interestPaid)}</b></div>`);
    if (st.interestUnpaid) extra.push(`<div class="bad"><span>⚠️ Ödenemeyen faiz borca eklendi (${st.missed}/3)</span><b>$${formatMoney(st.interestUnpaid)}</b></div>`);
    if (st.seized) extra.push(`<div class="bad"><span>🏦 Banka el koydu: ${st.seized.emoji} ${st.seized.name} (borç kapanınca 💼 tabletten geri al)</span><b>−$${formatMoney(st.seized.price)} borç</b></div>`);
    if (st.seizeNone) extra.push(`<div class="bad"><span>⚠️ Faiz 3 gündür ödenmiyor — borcunu azalt!</span><b></b></div>`);
    if (st.online) extra.push(`<div><span>🌐 Online: ${st.online.orders} sipariş · ${st.online.crates} kasa</span><b>+$${formatMoney(st.online.revenue)}</b></div>`);
    if (st.fine) extra.push(`<div class="bad"><span>🏛️ Belediye cezası: ${st.fine.reason}</span><b>−$${formatMoney(st.fine.amount)}</b></div>`);
    if (st.rent) {
      if (st.rent.market) extra.push(`<div class="bad"><span>🔑 Market kirası (haftalık)</span><b>−$${formatMoney(st.rent.market)}</b></div>`);
      if (st.rent.biz) extra.push(`<div class="bad"><span>🔑 Kiralık işletmelerin kirası (haftalık)</span><b>−$${formatMoney(st.rent.biz)}</b></div>`);
      if (st.rent.unpaid) extra.push(`<div class="bad"><span>⚠️ Ödenemeyen kira krediye yazıldı</span><b>$${formatMoney(st.rent.unpaid)}</b></div>`);
    }
    if (st.housing) {
      const h = st.housing;
      if (h.rent) extra.push(`<div class="good"><span>🏘️ ${h.daily ? 'Kira geliri (muhasebeci günlük tahsil eder)' : 'Haftalık kira geliri'}${h.commission ? ` (emlakçı %10: −$${formatMoney(h.commission)})` : ''}</span><b>+$${formatMoney(h.rent - (h.commission ?? 0))}</b></div>`);
      if (h.left) extra.push(`<div class="bad"><span>🚪 Kiracısı çıkan daire (tadilat gerekli)</span><b>${h.left}</b></div>`);
      if (h.renovation) extra.push(`<div class="bad"><span>🔧 Emlakçının yaptırdığı tadilat</span><b>−$${formatMoney(h.renovation)}</b></div>`);
    }
    if (st.finance) {
      if (st.finance.dividend) extra.push(`<div class="good"><span>📈 Hisse temettüsü</span><b>+$${formatMoney(st.finance.dividend)}</b></div>`);
      if (st.finance.bank) extra.push(`<div class="good"><span>🏦 Bankanın faiz geliri</span><b>+$${formatMoney(st.finance.bank)}</b></div>`);
    }
    if (st.politics) {
      const p = st.politics;
      if (p.sponsor) extra.push(`<div class="bad"><span>⚽ Sponsorluk</span><b>−$${formatMoney(p.sponsor)}</b></div>`);
      if (p.tax) extra.push(`<div class="good"><span>💰 Belediye vergi geliri</span><b>+$${formatMoney(p.tax)}</b></div>`);
      if (p.projects) extra.push(`<div class="good"><span>🚌 Şehir projeleri geliri</span><b>+$${formatMoney(p.projects)}</b></div>`);
      if (p.election) extra.push(`<div class="${p.election.won ? 'good' : 'bad'}"><span>🗳️ Seçim: ${p.election.won ? 'KAZANDIN, belediye başkanısın' : `${p.election.mainName} kazandı`}</span><b>%${p.election.me} – %${p.election.main}</b></div>`);
      if (p.revolt) extra.push(`<div class="bad"><span>📢 Halk memnun değil: seçimler geri geldi</span><b></b></div>`);
    }
    if (st.marketWages) extra.push(`<div class="bad"><span>👥 Market çalışanlarının maaşı</span><b>−$${formatMoney(st.marketWages)}</b></div>`);
    if (st.quit?.length) extra.push(`<div class="bad"><span>😞 Maaşı ödenemeyip ayrılan: ${summarize(st.quit)}</span><b>${st.quit.length}</b></div>`);
    if (st.interestEarned) extra.push(`<div class="good"><span>🏦 Mevduat faizi</span><b>+$${formatMoney(st.interestEarned)}</b></div>`);
    for (const c of st.campaigns ?? []) {
      const info = PRODUCTS[c.product];
      extra.push(`<div><span>📢 ${info.emoji} ${info.name}: satılan / stok</span><b>${c.sold} / ${c.qty}</b></div>`);
      if (c.unhappy) extra.push(`<div class="bad"><span>😠 ${info.emoji} ürün bulamayan</span><b>${c.unhappy}</b></div>`);
      if (c.left) extra.push(`<div class="bad"><span>📦 ${info.emoji} kalan stok zararı (${c.left} kasa)</span><b>−$${formatMoney(c.loss)}</b></div>`);
    }
    if (st.electricity) {
      const e = st.electricity;
      extra.push(`<div class="${e.bill ? 'bad' : 'good'}"><span>⚡ Elektrik: tüketim ${formatMoney(e.consumption)}, kendi üretimin ${formatMoney(e.own)}</span><b>${e.bill ? `−$${formatMoney(e.bill)}` : 'bedava'}</b></div>`);
      if (e.unpaid) extra.push(`<div class="bad"><span>⚠️ Ödenemeyen fatura krediye yazıldı</span><b>$${formatMoney(e.unpaid)}</b></div>`);
      if (e.gridIncome) extra.push(`<div class="good"><span>🔌 Şebekeye satış (${formatMoney(e.surplus)} birim)</span><b>+$${formatMoney(e.gridIncome)}</b></div>`);
      else if (e.surplus > 0) extra.push(`<div><span>🔌 ${formatMoney(e.surplus)} birim fazla elektrik boşa gitti (santrale muhasebeci al, Sv.35)</span><b></b></div>`);
    }
    if (st.holding) {
      const h = st.holding;
      if (h.freight) extra.push(`<div class="bad"><span>🚚 Dış nakliye (lojistik firman yok)</span><b>−$${formatMoney(h.freight)}</b></div>`);
      extra.push(`<div class="${h.profit >= 0 ? 'good' : 'bad'}"><span>💼 ${h.count} işletme kârı (maaş $${formatMoney(h.wages)}${h.freight ? ', nakliye' : ''} dahil)</span><b>${h.profit >= 0 ? '+' : '−'}$${formatMoney(Math.abs(h.profit))}</b></div>`);
    }
    document.getElementById('sum-extra').innerHTML = extra.join('');
    // Gece çalışmak isteyen çalışanlara ek mesai ödenir
    const ot = this.game.planOvertime();
    const btn = document.getElementById('sum-night');
    btn.textContent = ot.people ? `🌙 Ek mesai: ${ot.people} çalışan gece çalışsın ($${formatMoney(ot.cost)})` : '🌙 Gece kendin çalış (raf doldur)';
    btn.disabled = ot.cost > this.game.money;
    if (btn.disabled) btn.textContent = `🌙 Ek mesai için para yetmiyor ($${formatMoney(ot.cost)})`;
    this.summary.classList.remove('hidden');
    this.summaryOpen = true;
  }

  closeSummary() {
    this.summary.classList.add('hidden');
    this.summaryOpen = false;
  }

  /** Seviye atlama: kutlama kartı (oyun durur). Gün sonu özeti açıksa kapanınca gösterilir. */
  levelUp(level, features) {
    platform.haptic('MEDIUM');
    if (this.game.simulating) {
      this.pendingLevel = { level, features: [...new Set([...(this.pendingLevel?.features ?? []), ...features])] };
      return;
    }
    this.showLevelPop(level, features);
  }

  showLevelPop(level, features) {
    const pop = this.lvlPop;
    document.getElementById('lvl-num').textContent = level;
    document.getElementById('lvl-sub').textContent = level >= 99 ? 'Kasabanın en güçlü ismi oldun!' : `Seviye ${level}'e ulaştın`;
    document.getElementById('lvl-list').innerHTML = features.length
      ? `<b>Yeni açılanlar</b>${features.slice(0, 8).map((f) => `<span>✨ ${f}</span>`).join('')}`
      : '';
    pop.classList.remove('hidden');
    this.game.audio.play('levelup', 1.2);
    if (!pop.dataset.paused) {
      pop.dataset.paused = this.game.paused ? 'was' : 'yes';
      this.game.paused = true;
    }
    // Konfeti: hafif DOM parçacıkları (CSS animasyonu)
    const box = document.getElementById('confetti');
    box.innerHTML = '';
    const colors = ['#ffd23f', '#3fae49', '#ff6b6b', '#4dabf7', '#f783ac', '#ffffff'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = `${Math.random() * 0.6}s`;
      c.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
      c.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`);
      c.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
      box.appendChild(c);
    }
  }

  closeLevelPop() {
    const pop = this.lvlPop;
    pop.classList.add('hidden');
    if (pop.dataset.paused === 'yes' && !this.summaryOpen) this.game.paused = false;
    delete pop.dataset.paused;
    document.getElementById('confetti').innerHTML = '';
  }

  /** Eski küçük bildirim (artık kullanılmıyor ama başka yerler çağırabilir). */
  levelToast(level, features) {
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

/** ['A','A','B'] → 'A ×2, B' */
function summarize(list) {
  const m = new Map();
  for (const x of list) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(', ');
}
