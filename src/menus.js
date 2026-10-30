import { platform } from './platform.js';
import { GOALS, DECOR, PREMIUM } from './config.js';
import { formatMoney } from './hud.js';
import { questText, questEmoji } from './goals.js';
import { AVATAR_MODELS, HAIR_CSS, OUTFIT_CSS, PANTS_CSS } from './assets.js';
import { confettiBurst } from './celebrate.js';
import { t } from './i18n.js';

// Ana menü ve ona bağlı sayfalar: günlük ödül, görevler, karakter, dekorasyon, başarımlar,
// yardım, yeni oyun; ayrıca oyun içinden açılan görev listesi ve "sen yokken" ekranı.

const HELP = [
  ['🕹️', t('Ekrana dokunup sürükleyerek yürü. Depodaki paletten kasa al, aynı ürünün reyonuna bırak.')],
  ['💳', t('Müşteriler kasada bekler: kasiyer alana kadar kasanın arkasında dur, parayı topla.')],
  ['💵', t('Kasabanın parası <b>Kasaba Doları</b> ($). Elmas 💎 ise süsleme için ayrı bir ödüldür.')],
  ['🟩', t('Yerdeki alanların üstünde kısa bir an durarak para öde: reyon, çalışan, genişleme açılır.')],
  ['🧾', t('Muhasebe odası: sipariş, banka, kampanya ve reklam. Sv.21\'den sonra 💼 tabletle işletmeleri yönet.')],
  ['🎯', t('Her sabah 3 yeni görev gelir; tamamlayınca para ve 💎 elmas kazanırsın. Elmasla marketini süsle.')],
  ['🌙', t('Gün 22:00\'de biter. Çalışanların maaşı, kira ve faiz gün sonunda ödenir.')],
  ['👑', t('Hedef: şehrin her şeyini almak ve Kasabanın Hakimi olmak. Derecen oyun gününe göre verilir.')],
];

const ACCESSORIES = [
  ['none', t('Yok')], ['cap', t('🧢 Şapka')], ['crown', t('👑 Taç')], ['glasses', t('🕶️ Gözlük')], ['headphones', t('🎧 Kulaklık')], ['own', t('🎩 Kendi başlığı')],
];
const CAP_COLORS = { red: '#e03a2f', yellow: '#ffc928', blue: '#2f7be0', green: '#3faa55', black: '#262626', pink: '#e06aa8' };
// Cinsiyete göre karakter tipleri ve varsayılan saç modeli
const GENDER_MODELS = {
  f: [['Rogue', t('Gezgin'), 'short'], ['Knight', t('Şövalye'), 'long'], ['Mage', t('Büyücü'), 'long'], ['Rogue_Hooded', t('Kapüşonlu'), 'short']],
  m: [['Barbarian', t('Kaptan'), 'short'], ['Knight', t('Şövalye'), 'short'], ['Mage', t('Büyücü'), 'short'], ['Rogue_Hooded', t('Kapüşonlu'), 'short']],
};
const HAIR_STYLES = [['short', t('Kısa')], ['long', t('Uzun')], ['ponytail', t('At kuyruğu')], ['bun', t('Topuz')], ['braids', t('Örgü')]];

export class Menus {
  constructor(game) {
    this.game = game;
    this.home = document.getElementById('home');
    this.sheet = document.getElementById('sheet');
    this.avatarEl = document.getElementById('avatar');
    try { this.supporter = Number(localStorage.getItem('marketgame-supporter') || 0); } catch { this.supporter = 0; }
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
    document.getElementById('home-meta').textContent = isNew ? t('Kasabanın küçük marketi seni bekliyor') : `${g.marketTitle} · ${t('Gün {n}', { n: g.day.day })} · ${t('Sv.{n}', { n: g.level })} · $${formatMoney(Math.round(g.money))}`;
    document.getElementById('home-continue').textContent = isNew ? t('▶️ Oyuna başla') : t('▶️ Devam et');
    document.getElementById('home-new').classList.toggle('hidden', isNew);
    document.getElementById('home-gems').textContent = g.goals.gems;
    // Rozetler: Premium ve Destekçi
    const badges = `${g.premium ? `<span class="hb prem">👑 ${t('Premium')}</span>` : ''}${this.supporter ? `<span class="hb sup">☕ ${t('Destekçi')}</span>` : ''}`;
    document.getElementById('home-badges').innerHTML = badges;
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
    on('home-premium', () => this.showPremium());
    on('home-help', () => this.openSheet(t('Nasıl oynanır'), HELP.map(([e, txt]) => `<p class="help-row"><span>${e}</span>${txt}</p>`).join('')));
    on('home-settings', () => {
      this.home.classList.add('hidden');
      document.body.classList.remove('in-home');
      g.viewMode = null;
      this.returnHome = true;
      document.getElementById('menu-btn').click();
    });
    on('home-new', () => {
      this.openSheet(t('Yeni oyun?'), `<p>${platform.native ? t('Mevcut oyunun ({market}, Gün {day}) silinir — iCloud kopyası dahil. Bu geri alınamaz.', { market: g.marketTitle, day: g.day.day }) : t('Mevcut oyunun ({market}, Gün {day}) silinir. Bu geri alınamaz.', { market: g.marketTitle, day: g.day.day })}</p><button data-reset class="danger">${t('Sil ve yeni oyuna başla')}</button>`, { close: t('Vazgeç'), onClick: (e) => { if (e.target.closest('[data-reset]')) g.reset(); } });
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
      const gender = this.av?.gender ?? 'm';
      const opts = GENDER_MODELS[gender];
      const [model, , style] = opts[r(opts.length)];
      const styles = HAIR_STYLES.map((h) => h[0]);
      this.av = { gender, model, hair: r(HAIR_CSS.length), outfit: r(OUTFIT_CSS.length), pants: r(PANTS_CSS.length), acc: accs[r(accs.length)], accColor: Object.keys(CAP_COLORS)[r(6)], hairStyle: gender === 'f' && Math.random() < 0.7 ? styles[r(styles.length)] : style };
      this.applyAvatar();
    });
    on('avatar-done', () => this.closeAvatar());
  }

  // ---- Genel alt sayfa ----

  openSheet(title, body, { close = t('Tamam'), onClick = null } = {}) {
    this.sheetWasPaused ??= this.game.paused;
    this.game.paused = true;
    document.getElementById('sheet-title').innerHTML = title;
    document.getElementById('sheet-body').innerHTML = body;
    document.getElementById('sheet-body').scrollTop = 0;
    document.getElementById('sheet-close').textContent = close;
    this.sheetClick = onClick;
    if (this.sheet.classList.contains('hidden')) this.game.audio.play('open', 0.6);
    this.sheet.classList.remove('hidden');
  }

  closeSheet() {
    this.game.audio.play('close', 0.6);
    this.sheet.classList.add('hidden');
    this.sheetClick = null;
    // Ana menü açık değilse oyun kaldığı gibi devam etsin
    if (this.home.classList.contains('hidden') && this.avatarEl.classList.contains('hidden')) this.game.paused = this.sheetWasPaused ?? false;
    this.sheetWasPaused = undefined;
    this.refreshHome();
    this.afterSheet?.();
    this.afterSheet = null;
  }

  // ---- Premium ----

  showPremium() {
    const g = this.game;
    const row = (e, label, std, prem) => `<div class="prem-row"><span class="pe">${e}</span><b>${label}</b><span class="std">${std}</span><span class="pr">${prem}</span></div>`;
    this.openSheet(`👑 ${t('Premium')}`, `
      <p class="note">${t('Oyun reklamsız. Her şeyi ücretsiz oynayabilirsin; Premium tek seferlik satın alma ile ilerlemeyi hızlandırır ve geliştirmeyi destekler.')}</p>
      <div class="prem-head"><span></span><b></b><span class="std">${t('Standart')}</span><span class="pr">${t('Premium')}</span></div>
      ${row('🏦', t('Banka kredi limiti'), '¼', t('Tam'))}
      ${row('⏩', t('Oyun hızı (Sv.{n}+)', { n: PREMIUM.fastLevel }), '1.5×', '2×')}
      ${row('📢', t('Aynı gün kampanya'), String(PREMIUM.campaigns.standard), String(PREMIUM.campaigns.premium))}
      ${row('🌐', t('Online personel'), t('{n} kişi', { n: PREMIUM.onlineStaff }), t('{n} kişi', { n: 10 }))}
      ${row('🎓', t('Tecrübeli muhasebeci'), '—', '✓')}
      ${row('🏗️', t('Aynı anda inşaat'), String(PREMIUM.builds), t('Sınırsız, %25 hızlı'))}
      ${row('🎨', t('Süs yeri + özel desen'), `${PREMIUM.decorSlots}`, t('10 + 👑 set'))}
      ${row('💎', t('Görev/giriş elması'), '1×', `${PREMIUM.gemFactor}×`)}
      <p class="note">${t('Durum: <b>{status}</b> · Premium tek seferlik <b>{price}</b>. Satın alma App Store sürümüyle gelecek.', { status: g.premium ? `👑 ${t('Premium')}` : t('Standart'), price: PREMIUM.price })}</p>
      <button data-ptoggle class="${g.premium ? '' : 'primary'}">${g.premium ? t('Standarda dön (test)') : t('Premium\'u dene (test)')}</button>
      <h4 class="tip-h">💚 ${t('Geliştiriciye teşekkür et')}</h4>
      <p class="note">${t('Oyunu sevdiysen küçük bir teşekkür gönderebilirsin. Hiçbir şey kilitlemez; karşılığında <b>☕ Destekçi</b> rozeti alırsın.')}${this.supporter ? ` ${t('Teşekkürlerin: <b>{n}</b> 💚', { n: this.supporter })}` : ''}</p>
      <div class="tip-row one">${PREMIUM.tips.map((tp) => `<button data-tip="${tp.id}"><span class="ic">${tp.emoji}</span>${tp.name}<small>${tp.price}</small></button>`).join('')}</div>`,
    { onClick: (e) => {
      const tip = e.target.closest('[data-tip]');
      if (tip) {
        // App Store'da: tekrar alınabilen bahşiş ürünü (StoreKit). Şimdilik test: rozet verilir.
        this.supporter = (this.supporter ?? 0) + 1;
        try { localStorage.setItem('marketgame-supporter', String(this.supporter)); } catch { /* yok */ }
        g.hud.toast(t('💚 Teşekkürler! ☕ Destekçi rozeti senin'));
        g.audio.play('levelup');
        confettiBurst(70);
        this.showPremium();
        return;
      }
      if (!e.target.closest('[data-ptoggle]')) return;
      g.setPremium(!g.premium);
      this.showPremium();
    } });
  }

  // ---- Görevler ----

  showQuests() {
    const g = this.game;
    const qs = g.goals.quests;
    const rows = qs.map((q) => `<div class="quest ${q.done ? 'done' : ''}"><span class="qe">${q.done ? '✅' : questEmoji(q)}</span>
      <div class="qt">${questText(q)}<small>${q.done ? t('tamamlandı') : `${q.type === 'revenue' ? `$${formatMoney(q.progress)}` : q.type === 'rating' ? (q.progress / 10).toFixed(1) : q.progress} / ${q.type === 'revenue' ? `$${formatMoney(q.target)}` : q.type === 'rating' ? '4.5' : q.target}`} · ${t('ödül')} $${formatMoney(q.money)} + 💎${q.gems}</small>
      <div class="qbar"><i style="width:${Math.round((q.progress / q.target) * 100)}%"></i></div></div></div>`).join('');
    const all = qs.length && qs.every((q) => q.done);
    this.openSheet(`🎯 ${t('Gün {n} görevleri', { n: g.day.day })}`, `${rows}<p class="note">${t('Üçünü de bitirirsen ek 💎{n}.', { n: GOALS.allQuestsGems })} ${all ? `<b>${t('Bugünün tüm görevleri tamam!')}</b> ` : ''}${t('Yeni görevler her sabah gelir.')}</p>
      <p class="note">${t('💎 <b>{n}</b> elmasın var — 🎨 Dekorasyon\'da harca.', { n: g.goals.gems })}</p>`);
  }

  // ---- Giriş takvimi ----

  showLogin() {
    const go = this.game.goals;
    const pending = go.loginPending;
    const cur = go.loginDay;
    // 7 günlük pencere; seri 7'yi geçince bugün ortada kalacak şekilde kayar
    const start = cur > GOALS.login.length ? cur - 3 : 1;
    const cells = GOALS.login.map((_, i) => {
      const d = start + i;
      const r = go.loginReward(d);
      const got = pending ? d < cur : d <= cur;
      const today = pending && d === cur;
      return `<div class="${got ? 'got' : ''} ${today ? 'today' : ''} ${d === 7 ? 'big' : ''}"><span>${t('{n}. gün', { n: d })}</span><b>${got ? '✅' : d === 7 ? '🎁' : '💎'}</b>${r.money ? `$${formatMoney(r.money)}` : ''}<span>💎${r.gems}</span></div>`;
    }).join('');
    const r = go.loginReward(cur);
    this.openSheet(`📅 ${t('Günlük ödül')}`, `<p class="note">${t('Her gün oyuna gir, ödülünü al. 7 gün üst üste gelirsen büyük ödül! Sonra seri sürdükçe her gün +$100 ve +💎1 artar. Bir gün kaçırırsan seri baştan başlar.')}</p>
      <div class="cal">${cells}</div>
      ${pending ? `<div class="big-reward">${t('Bugün ({n}. gün)', { n: cur })}<b>${r.money ? `$${formatMoney(r.money)} + ` : ''}💎${r.gems}</b><button data-claim class="primary">${t('Ödülü al')}</button></div>` : `<p class="big-reward">${t('Bugünün ödülünü aldın. Yarın tekrar gel! 👋')}</p>`}`,
    { onClick: (e) => {
      if (!e.target.closest('[data-claim]')) return;
      const got = go.claimLogin();
      if (got) {
        this.game.hud.toast(`📅 ${t('Günlük ödül')}: ${got.money ? `$${formatMoney(got.money)} + ` : ''}💎${got.gems}`);
        this.showLogin();
      }
    } });
  }

  // ---- Çevrimdışı kazanç ----

  showOffline(res, then) {
    const g = this.game;
    const h = Math.floor(res.minutes / 60);
    const m = res.minutes % 60;
    const time = h ? t('{h} saat {m} dk', { h, m }) : t('{m} dk', { m });
    this.afterSheet = then;
    this.openSheet(`🌙 ${t('Sen yokken')}`, `<div class="big-reward">${t('{time} uzaktaydın.', { time })}<br>${t('Çalışanların çalışmaya devam etti:')}<b>+$${formatMoney(res.amount)}</b></div>
      <p class="note">${res.manager ? t('💼 Müdürün dükkânı yönetti.') : t('Müdürün olsaydı iki kat kazanırdın (Sv.7).')} ${t('Sen yokken oyunda yaklaşık {days} gün geçti (uygulama kapalıyken zaman yavaş akar: 1 gün = en fazla {max} oyun günü).', { days: res.gameDays.toFixed(1), max: GOALS.offlineDaysPerRealDay })}</p>`,
    { close: t('Topla 💰') });
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
    this.openSheet(`🏆 ${t('Başarımlar')} <small>${earned.size}/${ACHIEVEMENTS.length}</small>`,
      `<div class="ach-progress"><i style="width:${pct}%"></i></div><div class="ach-list">${list.map((a) => `<div class="${earned.has(a.id) ? 'on' : ''}"><span>${earned.has(a.id) ? a.emoji : '🔒'}</span>${a.name}</div>`).join('')}</div>`);
  }

  // ---- Dekorasyon ----

  showDecor() {
    const g = this.game;
    const d = g.decor;
    const gems = g.goals.gems;
    const owned = (k, id) => d.owned.has(`${k}:${id}`);
    const price = (k, x) => (owned(k, x.id) ? (d[k] === x.id ? t('seçili') : t('sende')) : `💎${x.gems}`);
    const prem = (x) => x.premium && !g.premium;
    const floors = DECOR.floors.map((f) => `<button data-floor="${f.id}" class="${d.floor === f.id ? 'on' : ''}" ${(!owned('floor', f.id) && gems < f.gems) || prem(f) ? 'disabled' : ''}>${f.premium ? '👑 ' : ''}<span class="swatch" style="background:linear-gradient(135deg,${f.colors[0]} 50%,${f.colors[1]} 50%)"></span>${f.name}<small>${price('floor', f)}</small></button>`).join('');
    const signs = DECOR.signs.map((s) => `<button data-sign="${s.id}" class="${d.sign === s.id ? 'on' : ''}" ${(!owned('sign', s.id) && gems < s.gems) || prem(s) ? 'disabled' : ''}>${s.premium ? '👑 ' : ''}<span class="swatch" style="background:${s.color}"></span>${s.name}<small>${price('sign', s)}</small></button>`).join('');
    const items = DECOR.items.map((it) => `<button data-item="${it.id}" ${gems < it.gems || d.freeSlots <= 0 ? 'disabled' : ''}><span class="ic">${it.emoji}</span>${it.name}<small>💎${it.gems}</small></button>`).join('');
    const placed = d.items.map((id, i) => `<span>${DECOR.items.find((x) => x.id === id).emoji}<button data-remove="${i}" class="x-mini" aria-label="${t('Kaldır')}">✕</button></span>`).join('');
    const L = DECOR.lights;
    this.openSheet(`🎨 ${t('Dekorasyon')} · 💎${gems}`, `
      <div class="decor-sec"><h4>${t('Zemin deseni')}</h4><div class="decor-row">${floors}</div></div>
      <div class="decor-sec"><h4>${t('Tabela rengi')}</h4><div class="decor-row">${signs}</div></div>
      <div class="decor-sec"><h4>${t('Mağaza önü süsleri')} <small>(${d.items.length}/${d.slotCount}${g.premium ? '' : ` · 👑 ${t('Premium')}: 10`} · ${t('müşteri +%{n}', { n: Math.round((d.customerFactor - 1) * 100) })})</small></h4><div class="decor-row">${items}</div>
        ${placed ? `<div class="decor-placed">${placed}</div>` : ''}</div>
      <div class="decor-sec"><h4>${t('Işıklar')}</h4><div class="decor-row"><button data-lights ${d.lights || gems < L.gems ? 'disabled' : ''}><span class="ic">${L.emoji}</span>${L.name}<small>${d.lights ? t('takılı') : `💎${L.gems}`}</small></button></div></div>
      <p class="note">${t('💎 elmas: günlük görevler, günlük ödül ve müşteri kutlamalarından gelir. Her süs ve ışık zinciri müşteriyi %1 artırır (en fazla %10).')}</p>`,
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
    this.av = { gender: 'm', model: 'Barbarian', hair: 0, outfit: 0, pants: 0, acc: 'none', accColor: 'red', hairStyle: 'short', ...(g.avatar ?? {}) };
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
      <div class="av-row"><span>${t('Cinsiyet')}</span><div class="av-opts"><button data-gender="f" class="${a.gender === 'f' ? 'on' : ''}">👩 ${t('Kadın')}</button><button data-gender="m" class="${a.gender !== 'f' ? 'on' : ''}">👨 ${t('Erkek')}</button></div></div>
      <div class="av-row"><span>${t('Karakter')}</span><div class="av-opts">${GENDER_MODELS[a.gender === 'f' ? 'f' : 'm'].map(([m, n, st]) => `<button data-model="${m}" data-style="${st}" class="${a.model === m ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="av-row"><span>${t('Saç modeli')}</span><div class="av-opts">${HAIR_STYLES.map(([k, n]) => `<button data-hstyle="${k}" class="${(a.hairStyle ?? 'short') === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="av-row"><span>${t('Saç rengi')}</span><div class="av-opts">${sw('hair', HAIR_CSS)}</div></div>
      <div class="av-row"><span>${t('Kıyafet')}</span><div class="av-opts">${sw('outfit', OUTFIT_CSS)}</div></div>
      <div class="av-row"><span>${t('Pantolon')}</span><div class="av-opts">${sw('pants', PANTS_CSS)}</div></div>
      <div class="av-row"><span>${t('Aksesuar')}</span><div class="av-opts">${ACCESSORIES.map(([k, n]) => `<button data-acc="${k}" class="${a.acc === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      ${a.acc === 'cap' ? `<div class="av-row"><span>${t('Şapka rengi')}</span><div class="av-opts">${Object.entries(CAP_COLORS).map(([k, c]) => `<button class="sw ${a.accColor === k ? 'on' : ''}" data-capc="${k}" style="background:${c}"></button>`).join('')}</div></div>` : ''}`;
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
    if (d.gender) {
      this.av.gender = d.gender;
      const [model, , style] = GENDER_MODELS[d.gender][0];
      this.av.model = model;
      this.av.hairStyle = style;
    } else if (d.model) {
      this.av.model = d.model;
      this.av.hairStyle = d.style ?? this.av.hairStyle;
    } else if (d.hstyle) this.av.hairStyle = d.hstyle;
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
      g.hud.toast(t('👋 Hoş geldin! Depodan domates al, reyona koy'));
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
      preview.innerHTML = `${t('Tabelada:')} <b>${g.marketTitle.replace(/</g, '&lt;')}</b>`;
    });
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('intro-start').click(); });
    document.getElementById('intro-start').addEventListener('click', () => {
      intro.classList.add('hidden');
      g.setMarketName(nameInput.value, true); // tabela değişir; bildirim karakterin önünü kapatmasın
      this.showAvatar(true);
    });
  }
}
