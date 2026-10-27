import { platform } from './platform.js';
import { GOALS, DECOR } from './config.js';
import { formatMoney } from './hud.js';
import { questText, questEmoji } from './goals.js';
import { AVATAR_MODELS, HAIR_CSS, OUTFIT_CSS, PANTS_CSS } from './assets.js';
import { confettiBurst } from './celebrate.js';

// Ana menü ve ona bağlı sayfalar: günlük ödül, görevler, karakter, dekorasyon, başarımlar,
// yardım, yeni oyun; ayrıca oyun içinden açılan görev listesi ve "sen yokken" ekranı.

const HELP = [
  ['🕹️', 'Ekrana dokunup sürükleyerek yürü. Depodaki paletten kasa al, aynı ürünün reyonuna bırak.'],
  ['💳', 'Müşteriler kasada bekler: kasiyer alana kadar kasanın arkasında dur, parayı topla.'],
  ['🟩', 'Yerdeki alanların üstünde kısa bir an durarak para öde: reyon, çalışan, genişleme açılır.'],
  ['🧾', 'Muhasebe odası: sipariş, banka, kampanya ve reklam. Sv.21\'den sonra 💼 tabletle işletmeleri yönet.'],
  ['🎯', 'Her sabah 3 yeni görev gelir; tamamlayınca para ve 💎 elmas kazanırsın. Elmasla marketini süsle.'],
  ['🌙', 'Gün 22:00\'de biter. Çalışanların maaşı, kira ve faiz gün sonunda ödenir.'],
  ['👑', 'Hedef: şehrin her şeyini almak ve Kasabanın Hakimi olmak. Derecen oyun gününe göre verilir.'],
];

const ACCESSORIES = [
  ['none', 'Yok'], ['cap', '🧢 Şapka'], ['crown', '👑 Taç'], ['glasses', '🕶️ Gözlük'], ['headphones', '🎧 Kulaklık'], ['own', '🎩 Kendi başlığı'],
];
const CAP_COLORS = { red: '#e03a2f', yellow: '#ffc928', blue: '#2f7be0', green: '#3faa55', black: '#262626', pink: '#e06aa8' };
const MODEL_NAMES = { Barbarian: 'Kaptan', Knight: 'Şövalye', Mage: 'Büyücü', Rogue: 'Gezgin', Rogue_Hooded: 'Kapüşonlu' };

export class Menus {
  constructor(game) {
    this.game = game;
    this.home = document.getElementById('home');
    this.sheet = document.getElementById('sheet');
    this.avatarEl = document.getElementById('avatar');
    for (const el of [this.home, this.sheet, this.avatarEl]) el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.bind();
  }

  // ---- Ana menü ----

  showHome() {
    const g = this.game;
    g.paused = true;
    document.body.classList.add('in-home');
    g.viewMode = 'home';
    this.home.classList.remove('hidden');
    this.refreshHome();
    setTimeout(() => {
      document.getElementById('home-gc').classList.toggle('hidden', !platform.gameCenter);
      platform.accessPoint(!this.home.classList.contains('hidden'));
    }, 1200);
  }

  refreshHome() {
    const g = this.game;
    const isNew = g.isNewGame && !g.started;
    document.getElementById('home-meta').textContent = isNew ? 'Kasabanın küçük marketi seni bekliyor' : `${g.marketTitle} · Gün ${g.day.day} · Sv.${g.level} · $${formatMoney(Math.round(g.money))}`;
    document.getElementById('home-continue').textContent = isNew ? '▶️ Oyuna başla' : '▶️ Devam et';
    document.getElementById('home-new').classList.toggle('hidden', isNew);
    document.getElementById('home-gems').textContent = g.goals.gems;
    document.getElementById('home-daily-dot').classList.toggle('hidden', !g.goals.loginPending);
  }

  closeHome() {
    const g = this.game;
    this.home.classList.add('hidden');
    document.body.classList.remove('in-home');
    platform.accessPoint(false);
    g.viewMode = null;
    if (g.isNewGame && !g.started) return this.startIntro();
    g.paused = false;
  }

  bind() {
    const g = this.game;
    const on = (id, fn) => document.getElementById(id).addEventListener('click', fn);
    on('home-continue', () => this.closeHome());
    on('home-gc', () => platform.showGameCenter());
    on('home-daily', () => this.showLogin());
    on('home-quests', () => this.showQuests());
    on('home-avatar', () => this.showAvatar());
    on('home-decor', () => this.showDecor());
    on('home-ach', () => this.showAchievements());
    on('home-help', () => this.openSheet('Nasıl oynanır', HELP.map(([e, t]) => `<p class="help-row"><span>${e}</span>${t}</p>`).join('')));
    on('home-settings', () => {
      this.home.classList.add('hidden');
      document.body.classList.remove('in-home');
      g.viewMode = null;
      this.returnHome = true;
      document.getElementById('menu-btn').click();
    });
    on('home-new', () => {
      this.openSheet('Yeni oyun?', `<p>Mevcut oyunun (${g.marketTitle}, Gün ${g.day.day}) silinir${platform.native ? ' — iCloud kopyası dahil' : ''}. Bu geri alınamaz.</p><button data-reset class="danger">Sil ve yeni oyuna başla</button>`, { close: 'Vazgeç', onClick: (e) => { if (e.target.closest('[data-reset]')) g.reset(); } });
    });
    // Oyun içi: ☰ menüden ana menüye, 🎯 görevler
    on('to-home', () => {
      document.getElementById('menu').classList.add('hidden');
      g.menuOpen = false;
      g.save();
      this.showHome();
    });
    on('close-menu', () => {
      if (this.returnHome) {
        this.returnHome = false;
        this.showHome();
      }
    });
    const qb = document.getElementById('quest-btn');
    qb.addEventListener('pointerdown', (e) => e.stopPropagation());
    qb.addEventListener('click', () => this.showQuests());
    // Alt sayfa
    this.sheet.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return this.closeSheet();
      this.sheetClick?.(e);
    });
    // Karakter editörü
    this.avatarEl.addEventListener('click', (e) => this.onAvatarClick(e));
    on('avatar-random', () => {
      const r = (n) => Math.floor(Math.random() * n);
      const accs = ACCESSORIES.map((a) => a[0]);
      this.av = { model: AVATAR_MODELS[r(AVATAR_MODELS.length)], hair: r(HAIR_CSS.length), outfit: r(OUTFIT_CSS.length), pants: r(PANTS_CSS.length), acc: accs[r(accs.length)], accColor: Object.keys(CAP_COLORS)[r(6)] };
      this.applyAvatar();
    });
    on('avatar-done', () => this.closeAvatar());
  }

  // ---- Genel alt sayfa ----

  openSheet(title, body, { close = 'Tamam', onClick = null } = {}) {
    this.sheetWasPaused ??= this.game.paused;
    this.game.paused = true;
    document.getElementById('sheet-title').innerHTML = title;
    document.getElementById('sheet-body').innerHTML = body;
    document.getElementById('sheet-body').scrollTop = 0;
    document.getElementById('sheet-close').textContent = close;
    this.sheetClick = onClick;
    this.sheet.classList.remove('hidden');
  }

  closeSheet() {
    this.sheet.classList.add('hidden');
    this.sheetClick = null;
    // Ana menü açık değilse oyun kaldığı gibi devam etsin
    if (this.home.classList.contains('hidden') && this.avatarEl.classList.contains('hidden')) this.game.paused = this.sheetWasPaused ?? false;
    this.sheetWasPaused = undefined;
    this.refreshHome();
    this.afterSheet?.();
    this.afterSheet = null;
  }

  // ---- Görevler ----

  showQuests() {
    const g = this.game;
    const qs = g.goals.quests;
    const rows = qs.map((q) => `<div class="quest ${q.done ? 'done' : ''}"><span class="qe">${q.done ? '✅' : questEmoji(q)}</span>
      <div class="qt">${questText(q)}<small>${q.done ? 'tamamlandı' : `${q.type === 'revenue' ? `$${formatMoney(q.progress)}` : q.type === 'rating' ? (q.progress / 10).toFixed(1) : q.progress} / ${q.type === 'revenue' ? `$${formatMoney(q.target)}` : q.type === 'rating' ? '4.5' : q.target}`} · ödül $${formatMoney(q.money)} + 💎${q.gems}</small>
      <div class="qbar"><i style="width:${Math.round((q.progress / q.target) * 100)}%"></i></div></div></div>`).join('');
    const all = qs.length && qs.every((q) => q.done);
    this.openSheet(`🎯 Gün ${g.day.day} görevleri`, `${rows}<p class="note">Üçünü de bitirirsen ek 💎${GOALS.allQuestsGems}. ${all ? '<b>Bugünün tüm görevleri tamam!</b> ' : ''}Yeni görevler her sabah gelir.</p>
      <p class="note">💎 <b>${g.goals.gems}</b> elmasın var — 🎨 Dekorasyon'da harca.</p>`);
  }

  // ---- Giriş takvimi ----

  showLogin() {
    const go = this.game.goals;
    const pending = go.loginPending;
    const cur = go.loginDay;
    const cells = GOALS.login.map((_, i) => {
      const d = i + 1;
      const r = go.loginReward(d);
      const got = pending ? d < cur : d <= cur;
      const today = pending && d === cur;
      return `<div class="${got ? 'got' : ''} ${today ? 'today' : ''} ${d === 7 ? 'big' : ''}"><span>${d}. gün</span><b>${got ? '✅' : d === 7 ? '🎁' : '💎'}</b>${r.money ? `$${formatMoney(r.money)}` : ''}<span>💎${r.gems}</span></div>`;
    }).join('');
    const r = go.loginReward(cur);
    this.openSheet('📅 Günlük ödül', `<p class="note">Her gün oyuna gir, ödülünü al. 7 gün üst üste gelirsen büyük ödül! Bir gün kaçırırsan seri baştan başlar.</p>
      <div class="cal">${cells}</div>
      ${pending ? `<div class="big-reward">Bugün (${cur}. gün)<b>${r.money ? `$${formatMoney(r.money)} + ` : ''}💎${r.gems}</b><button data-claim class="primary">Ödülü al</button></div>` : '<p class="big-reward">Bugünün ödülünü aldın. Yarın tekrar gel! 👋</p>'}`,
    { onClick: (e) => {
      if (!e.target.closest('[data-claim]')) return;
      const got = go.claimLogin();
      if (got) {
        this.game.hud.toast(`📅 Günlük ödül: ${got.money ? `$${formatMoney(got.money)} + ` : ''}💎${got.gems}`);
        this.showLogin();
      }
    } });
  }

  // ---- Çevrimdışı kazanç ----

  showOffline(res, then) {
    const g = this.game;
    const h = Math.floor(res.minutes / 60);
    const m = res.minutes % 60;
    const time = h ? `${h} saat ${m} dk` : `${m} dk`;
    this.afterSheet = then;
    this.openSheet('🌙 Sen yokken', `<div class="big-reward">${time} uzaktaydın.<br>Çalışanların çalışmaya devam etti:<b>+$${formatMoney(res.amount)}</b></div>
      <p class="note">${res.manager ? '💼 Müdürün dükkânı yönetti.' : 'Müdürün olsaydı iki kat kazanırdın (Sv.7).'}${res.capped ? ` En fazla ${GOALS.offlineHours} saatlik kazanç birikir.` : ''}</p>`,
    { close: 'Topla 💰' });
    g.money += res.amount;
    g.hud.setMoney(g.money);
    g.day.today.offline = res.amount;
    g.save();
    confettiBurst(30);
  }

  // ---- Başarımlar ----

  async showAchievements() {
    const { ACHIEVEMENTS } = await import('./achievements.js');
    const earned = this.game.achievements.earned;
    const list = [...ACHIEVEMENTS].sort((x, y) => earned.has(y.id) - earned.has(x.id));
    const pct = Math.round((earned.size / ACHIEVEMENTS.length) * 100);
    this.openSheet(`🏆 Başarımlar <small>${earned.size}/${ACHIEVEMENTS.length}</small>`,
      `<div class="ach-progress"><i style="width:${pct}%"></i></div><div class="ach-list">${list.map((a) => `<div class="${earned.has(a.id) ? 'on' : ''}"><span>${earned.has(a.id) ? a.emoji : '🔒'}</span>${a.name}</div>`).join('')}</div>`);
  }

  // ---- Dekorasyon ----

  showDecor() {
    const g = this.game;
    const d = g.decor;
    const gems = g.goals.gems;
    const owned = (k, id) => d.owned.has(`${k}:${id}`);
    const price = (k, x) => (owned(k, x.id) ? (d[k] === x.id ? 'seçili' : 'sende') : `💎${x.gems}`);
    const floors = DECOR.floors.map((f) => `<button data-floor="${f.id}" class="${d.floor === f.id ? 'on' : ''}" ${!owned('floor', f.id) && gems < f.gems ? 'disabled' : ''}><span class="swatch" style="background:linear-gradient(135deg,${f.colors[0]} 50%,${f.colors[1]} 50%)"></span>${f.name}<small>${price('floor', f)}</small></button>`).join('');
    const signs = DECOR.signs.map((s) => `<button data-sign="${s.id}" class="${d.sign === s.id ? 'on' : ''}" ${!owned('sign', s.id) && gems < s.gems ? 'disabled' : ''}><span class="swatch" style="background:${s.color}"></span>${s.name}<small>${price('sign', s)}</small></button>`).join('');
    const items = DECOR.items.map((it) => `<button data-item="${it.id}" ${gems < it.gems || d.freeSlots <= 0 ? 'disabled' : ''}><span class="ic">${it.emoji}</span>${it.name}<small>💎${it.gems}</small></button>`).join('');
    const placed = d.items.map((id, i) => `<span>${DECOR.items.find((x) => x.id === id).emoji}<button data-remove="${i}" class="x-mini" aria-label="Kaldır">✕</button></span>`).join('');
    const L = DECOR.lights;
    this.openSheet(`🎨 Dekorasyon · 💎${gems}`, `
      <div class="decor-sec"><h4>Zemin deseni</h4><div class="decor-row">${floors}</div></div>
      <div class="decor-sec"><h4>Tabela rengi</h4><div class="decor-row">${signs}</div></div>
      <div class="decor-sec"><h4>Mağaza önü süsleri <small>(${d.items.length}/${DECOR.slots.length} · müşteri +%${Math.round((d.customerFactor - 1) * 100)})</small></h4><div class="decor-row">${items}</div>
        ${placed ? `<div class="decor-placed">${placed}</div>` : ''}</div>
      <div class="decor-sec"><h4>Işıklar</h4><div class="decor-row"><button data-lights ${d.lights || gems < L.gems ? 'disabled' : ''}><span class="ic">${L.emoji}</span>${L.name}<small>${d.lights ? 'takılı' : `💎${L.gems}`}</small></button></div></div>
      <p class="note">💎 elmas: günlük görevler, günlük ödül ve müşteri kutlamalarından gelir. Her süs ve ışık zinciri müşteriyi %1 artırır (en fazla %10).</p>`,
    { onClick: (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.floor) d.choose('floor', b.dataset.floor);
      else if (b.dataset.sign) d.choose('sign', b.dataset.sign);
      else if (b.dataset.item) d.buyItem(b.dataset.item);
      else if (b.dataset.remove !== undefined) d.removeItem(Number(b.dataset.remove));
      else if (b.dataset.lights !== undefined) d.buyLights();
      else return;
      this.showDecor();
    } });
  }

  // ---- Karakter ----

  showAvatar(isNew = false) {
    const g = this.game;
    this.avatarNew = isNew;
    this.av = { model: 'Barbarian', hair: 0, outfit: 0, pants: 0, acc: 'none', accColor: 'red', ...(g.avatar ?? {}) };
    this.home.classList.add('hidden');
    g.paused = true;
    g.viewMode = 'avatar';
    this.avatarEl.classList.remove('hidden');
    document.body.classList.add('in-home');
    this.applyAvatar();
  }

  renderAvatar() {
    const a = this.av;
    const sw = (key, list) => list.map((c, i) => `<button class="sw ${a[key] === i ? 'on' : ''}" data-${key}="${i}" style="background:${c}" aria-label="${key} ${i + 1}"></button>`).join('');
    document.getElementById('avatar-body').innerHTML = `
      <div class="av-row"><span>Karakter</span><div class="av-opts">${AVATAR_MODELS.map((m) => `<button data-model="${m}" class="${a.model === m ? 'on' : ''}">${MODEL_NAMES[m]}</button>`).join('')}</div></div>
      <div class="av-row"><span>Saç rengi</span><div class="av-opts">${sw('hair', HAIR_CSS)}</div></div>
      <div class="av-row"><span>Kıyafet</span><div class="av-opts">${sw('outfit', OUTFIT_CSS)}</div></div>
      <div class="av-row"><span>Pantolon</span><div class="av-opts">${sw('pants', PANTS_CSS)}</div></div>
      <div class="av-row"><span>Aksesuar</span><div class="av-opts">${ACCESSORIES.map(([k, n]) => `<button data-acc="${k}" class="${a.acc === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${a.acc === 'cap' ? `<div class="av-row"><span>Şapka rengi</span><div class="av-opts">${Object.entries(CAP_COLORS).map(([k, c]) => `<button class="sw ${a.accColor === k ? 'on' : ''}" data-capc="${k}" style="background:${c}"></button>`).join('')}</div></div>` : ''}`;
  }

  applyAvatar() {
    this.game.setAvatar(this.av, true);
    this.game.player.heading = 0;
    this.renderAvatar();
  }

  onAvatarClick(e) {
    const b = e.target.closest('button');
    if (!b || !b.dataset) return;
    const d = b.dataset;
    if (d.model) this.av.model = d.model;
    else if (d.hair !== undefined) this.av.hair = Number(d.hair);
    else if (d.outfit !== undefined) this.av.outfit = Number(d.outfit);
    else if (d.pants !== undefined) this.av.pants = Number(d.pants);
    else if (d.acc) this.av.acc = d.acc;
    else if (d.capc) this.av.accColor = d.capc;
    else return;
    this.applyAvatar();
  }

  closeAvatar() {
    const g = this.game;
    this.avatarEl.classList.add('hidden');
    g.setAvatar(this.av);
    g.viewMode = null;
    document.body.classList.remove('in-home');
    if (this.avatarNew) {
      // Yeni oyun: karakter seçildi, oyun başlar
      g.started = true;
      g.paused = false;
      g.player.heading = Math.PI;
      g.hud.toast('👋 Hoş geldin! Depodan domates al, reyona koy');
      return;
    }
    this.showHome();
  }

  // ---- Yeni oyun girişi (isim → karakter) ----

  startIntro() {
    const g = this.game;
    const intro = document.getElementById('intro');
    intro.classList.remove('hidden');
    g.paused = true;
    if (this.introBound) return;
    this.introBound = true;
    intro.addEventListener('pointerdown', (e) => e.stopPropagation());
    const nameInput = document.getElementById('intro-name');
    const preview = document.getElementById('intro-preview');
    nameInput.addEventListener('input', () => {
      g.marketName = nameInput.value.trim() || 'Kasaba';
      preview.innerHTML = `Tabelada: <b>${g.marketTitle.replace(/</g, '&lt;')}</b>`;
    });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('intro-start').click(); });
    document.getElementById('intro-start').addEventListener('click', () => {
      intro.classList.add('hidden');
      g.setMarketName(nameInput.value, true); // tabela değişir; bildirim karakterin önünü kapatmasın
      this.showAvatar(true);
    });
  }
}
