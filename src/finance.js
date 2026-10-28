import * as THREE from 'three';
import { FINANCE } from './config.js';
import { prop } from './assets.js';
import { textTexture } from './fx.js';
import { formatMoney } from './hud.js';

// Finans (Sv.66–80): yatırım şirketi (borsa: rakip şirket hisseleri, %51 = kontrol),
// kendi bankan (sermaye faizi, şubeler, kredi kartı, sigorta, finans merkezi), halka arz.

export class Finance {
  constructor(game) {
    this.game = game;
    this.invest = false;    // yatırım şirketi kuruldu mu
    this.stocks = Object.fromEntries(Object.entries(FINANCE.companies).map(([k, c]) => [k, { price: c.value / 100, owned: 0, history: [c.value / 100] }]));
    this.bank = null;       // { capital, branches, card, insurance, center }
    this.ipo = false;
    this.last = null;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.buildSea();
    this.buildBankHq();
  }

  get unlocked() {
    return this.game.level >= FINANCE.fromLevel;
  }

  // ---- Borsa ----

  /** %51 ve üstü hissesi olan şirketler. */
  controls(id) {
    return this.stocks[id].owned >= FINANCE.control;
  }

  effect(type) {
    let f = 1;
    for (const [k, c] of Object.entries(FINANCE.companies)) if (c.effect === type && this.controls(k)) f *= c.amount;
    return f;
  }

  /** Müşteri çarpanı (Ucuzcu zinciri sende). */
  get customerFactor() {
    return this.effect('customers');
  }

  /** Elektrik faturası çarpanı (Kuzey Enerji sende). */
  get electricityFactor() {
    return this.effect('electricity');
  }

  /** Kredi faizi çarpanı: Şehir Bankası sende → yarı; finans merkezi → faizsiz. */
  get interestFactor() {
    if (this.bank?.center) return 0;
    return this.effect('interest');
  }

  get limitFactor() {
    return this.bank?.center ? 2 : 1;
  }

  get portfolio() {
    let v = 0;
    for (const s of Object.values(this.stocks)) v += s.owned * s.price;
    return Math.round(v);
  }

  buyLicense() {
    const g = this.game;
    const L = FINANCE.investLicense;
    if (this.invest || g.level < L.level || g.money < L.price) return false;
    g.spend(L.price);
    this.invest = true;
    g.hud.toast('📈 Yatırım şirketin kuruldu: borsada hisse alabilirsin');
    g.save();
    return true;
  }

  buy(id, pct) {
    const g = this.game;
    const c = FINANCE.companies[id];
    const s = this.stocks[id];
    const n = Math.min(pct, 100 - s.owned);
    const cost = Math.round(n * s.price);
    if (!this.invest || g.level < c.level || n <= 0 || g.money < cost) return false;
    const had = this.controls(id);
    g.spend(cost);
    s.owned += n;
    if (!had && this.controls(id)) {
      g.hud.toast(`🏆 ${c.emoji} ${c.name} artık senin kontrolünde: ${c.effectText}`);
      g.gainXp(Math.floor(c.value / 200));
      g.audio.play('unlock');
    }
    g.save();
    return true;
  }

  sell(id, pct) {
    const g = this.game;
    const s = this.stocks[id];
    const n = Math.min(pct, s.owned);
    if (n <= 0) return false;
    s.owned -= n;
    g.money += Math.round(n * s.price);
    g.hud.setMoney(g.money);
    g.save();
    return true;
  }

  // ---- Kendi bankan ----

  get bankIncome() {
    const B = FINANCE.bank;
    const b = this.bank;
    if (!b) return 0;
    let n = b.capital * B.rate + b.branches * B.branch.income;
    let boost = 1;
    if (b.card) boost += B.card.boost;
    if (b.insurance) boost += B.insurance.boost;
    return Math.round(n * boost);
  }

  openBank() {
    const g = this.game;
    const L = FINANCE.bank.license;
    if (this.bank || g.level < L.level || g.money < L.price) return false;
    g.spend(L.price);
    this.bank = { capital: 0, branches: 0, card: false, insurance: false, center: false };
    g.gainXp(Math.floor(L.price / 100));
    g.hud.toast(`🏦 ${g.marketName} Bankası kuruldu! Sermaye koyup kredi vererek faiz kazan`);
    g.audio.play('unlock');
    this.buildBankHq();
    g.save();
    return true;
  }

  capital(amount) {
    const g = this.game;
    const b = this.bank;
    if (!b) return false;
    if (amount > 0) {
      const n = Math.min(amount, Math.floor(g.money));
      if (n <= 0) return false;
      g.money -= n;
      b.capital += n;
    } else {
      const n = Math.min(-amount, b.capital);
      if (n <= 0) return false;
      b.capital -= n;
      g.money += n;
    }
    g.hud.setMoney(g.money);
    g.save();
    return true;
  }

  bankUpgrade(k) {
    const g = this.game;
    const b = this.bank;
    const u = FINANCE.bank[k];
    if (!b || !u || g.level < u.level || g.money < u.price) return false;
    if (k === 'branch') {
      if (b.branches >= u.max) return false;
      b.branches++;
    } else {
      if (b[k]) return false;
      b[k] = true;
    }
    g.spend(u.price);
    g.gainXp(Math.floor(u.price / 100));
    g.hud.toast({ branch: '🏦 Yeni banka şubesi açıldı', card: '💳 Kredi kartı işi başladı', insurance: '🛡️ Sigorta işi başladı', center: '🏙️ Finans merkezi: şehrin tüm kredileri senin bankanda — kredilerin faizsiz!' }[k]);
    g.audio.play('unlock');
    this.buildBankHq();
    g.save();
    return true;
  }

  // ---- Şirket değeri ve halka arz ----

  /** Holdingin toplam değeri. */
  get companyValue() {
    const g = this.game;
    let v = g.holding.businesses.reduce((a, b) => a + b.value, 0) + g.housing.value + this.portfolio;
    if (g.rent.marketOwned) v += g.rent.boughtPrice || g.rent.marketPrice;
    if (this.bank) v += FINANCE.bank.license.price + this.bank.capital;
    return Math.round(v);
  }

  doIpo() {
    const g = this.game;
    if (this.ipo || g.level < FINANCE.ipo.level) return false;
    const cash = Math.round(this.companyValue * FINANCE.ipo.share);
    this.ipo = true;
    g.money += cash;
    g.gainXp(Math.floor(cash / 200));
    g.hud.setMoney(g.money);
    g.hud.toast(`🔔 Halka arz: hisselerin %${Math.round(FINANCE.ipo.share * 100)}'si satıldı, +Đ${formatMoney(cash)}`);
    g.audio.play('unlock');
    g.save();
    return true;
  }

  // ---- Gün sonu ----

  endOfDay(today) {
    const g = this.game;
    const info = {};
    // Hisse fiyatları rastgele yürür, temettü
    let div = 0;
    for (const [k, s] of Object.entries(this.stocks)) {
      const change = FINANCE.drift + (Math.random() - 0.5) * 2 * FINANCE.vol;
      s.price = Math.max(100, Math.round(s.price * (1 + change)));
      s.history.push(s.price);
      if (s.history.length > 14) s.history.shift();
      if (s.owned) {
        const c = FINANCE.companies[k];
        div += s.owned * s.price * FINANCE.dividend * (c.effect === 'dividend' && this.controls(k) ? c.amount : 1);
      }
    }
    if (div) {
      g.money += Math.round(div);
      info.dividend = Math.round(div);
    }
    if (this.bank) {
      const inc = this.bankIncome;
      if (inc) {
        g.money += inc;
        info.bank = inc;
        g.gainXp(Math.floor(inc / 100));
      }
    }
    if (Object.keys(info).length) today.finance = info;
    this.last = info;
    g.hud.setMoney(g.money);
  }

  // ---- Görsel: deniz, kumsal, banka genel merkezi ----

  buildSea() {
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(420, 6), new THREE.MeshStandardMaterial({ color: 0xe8d9a8, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, -0.005, 56);
    this.root.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 160), new THREE.MeshStandardMaterial({ color: 0x3d9bd6, roughness: 0.25, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.0, 139);
    this.root.add(sea);
  }

  buildBankHq() {
    this.hq?.removeFromParent();
    this.hqLabel?.removeFromParent();
    if (!this.bank) return;
    const m = prop('building_G_withoutBase');
    m.scale.setScalar(5);
    m.rotation.y = Math.PI;
    m.position.set(52, 0, 31);
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.add(m);
    this.hq = m;
    const tex = textTexture(`🏦 ${this.game.marketName} Bankası${this.bank.center ? ' · Finans merkezi' : ''}`, { color: '#1e3d5d', size: 40, stroke: '#ffffff' });
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    label.renderOrder = 6;
    label.scale.set(0.8 * tex.image.width / tex.image.height, 0.8, 1);
    label.position.set(52, 13, 31);
    this.root.add(label);
    this.hqLabel = label;
    this.game.nav.setBox('bank-hq', { minX: 47, maxX: 57, minZ: 27.5, maxZ: 34.5 });
  }

  // ---- Tablet sekmesi ----

  render() {
    const g = this.game;
    const m = g.money;
    if (!this.unlocked) return `<p class="note">📈 Finans Seviye ${FINANCE.fromLevel}'da açılır: yatırım şirketi, borsa, kendi bankan, liman ve sanayi.</p>`;
    const parts = [`<div class="stats">
      <div><span>🏢 Şirket değeri</span><b>Đ${formatMoney(this.companyValue)}</b></div>
      <div><span>📈 Portföy</span><b>Đ${formatMoney(this.portfolio)}</b></div>
    </div>`];
    // Yatırım şirketi / borsa
    const L = FINANCE.investLicense;
    if (!this.invest) {
      parts.push(`<div class="biz"><div class="biz-head"><span class="biz-e">📈</span><div><b>Yatırım şirketi</b><small>Rakip şirketlerin hisselerini al; %${FINANCE.control} ile kontrol sende</small></div></div>
        <div class="biz-btns"><button class="primary" data-fin="license" ${m < L.price ? 'disabled' : ''}>Kur Đ${formatMoney(L.price)}</button></div></div>`);
    } else {
      for (const [k, c] of Object.entries(FINANCE.companies)) {
        const s = this.stocks[k];
        const h = s.history;
        const ch = h.length > 1 ? (s.price / h[h.length - 2] - 1) * 100 : 0;
        const locked = g.level < c.level;
        const ctrl = this.controls(k);
        parts.push(`<div class="biz ${ctrl ? 'owned' : locked ? 'locked' : ''}">
          <div class="biz-head"><span class="biz-e">${c.emoji}</span><div><b>${c.name}</b><small>%1 = Đ${formatMoney(s.price)} <span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '▲' : '▼'}%${Math.abs(ch).toFixed(1)}</span> · ${sparkline(h)}</small></div></div>
          <div class="biz-row"><span>Hissen</span><b>%${s.owned}${ctrl ? ' · 🏆 kontrol' : ''}</b><small>%${FINANCE.control}: ${c.effectText}</small></div>
          <div class="biz-btns">${locked ? `<span class="lock">🔒 Sv.${c.level}'de borsaya açılır</span>` : `
            <button data-sbuy="${k}:1" ${m < s.price || s.owned >= 100 ? 'disabled' : ''}>+%1</button>
            <button data-sbuy="${k}:10" ${m < s.price * 10 || s.owned >= 100 ? 'disabled' : ''}>+%10 (Đ${formatMoney(s.price * 10)})</button>
            <button data-ssell="${k}:1" ${!s.owned ? 'disabled' : ''}>Sat %1</button>
            <button data-ssell="${k}:10" ${s.owned < 10 ? 'disabled' : ''}>Sat %10</button>`}</div></div>`);
      }
    }
    // Kendi bankan
    const B = FINANCE.bank;
    if (!this.bank) {
      parts.push(`<div class="biz ${g.level < B.license.level ? 'locked' : ''}"><div class="biz-head"><span class="biz-e">🏦</span><div><b>Kendi bankan</b><small>Lisans al, sermaye koy: halka kredi verip faiz kazan</small></div></div>
        <div class="biz-btns">${g.level < B.license.level ? `<span class="lock">🔒 Sv.${B.license.level}</span>` : `<button class="primary" data-fin="bank" ${m < B.license.price ? 'disabled' : ''}>Lisans Đ${formatMoney(B.license.price)}</button>`}</div></div>`);
    } else {
      const b = this.bank;
      const up = (k, label) => {
        const u = B[k];
        if (k === 'branch' ? b.branches >= u.max : b[k]) return '';
        return g.level < u.level ? `<span class="lock">${label} Sv.${u.level}</span>` : `<button data-up="${k}" ${m < u.price ? 'disabled' : ''}>${label} Đ${formatMoney(u.price)}</button>`;
      };
      parts.push(`<div class="biz owned"><div class="biz-head"><span class="biz-e">🏦</span><div><b>${g.marketName} Bankası${b.center ? ' · 🏙️ Finans merkezi' : ''}</b><small>Günlük gelir ~Đ${formatMoney(this.bankIncome)} · şube ${b.branches}/${B.branch.max}${b.card ? ' · 💳' : ''}${b.insurance ? ' · 🛡️' : ''}</small></div></div>
        <div class="biz-row"><span>💰 Sermaye</span><b>Đ${formatMoney(b.capital)}</b><small>günlük %${(B.rate * 100).toFixed(0)} faiz geliri</small></div>
        <div class="bank-group"><span>Sermaye</span><button data-cap="10000" ${m < 10000 ? 'disabled' : ''}>+Đ10K</button><button data-cap="100000" ${m < 100000 ? 'disabled' : ''}>+Đ100K</button><button data-cap="-10000" ${b.capital < 10000 ? 'disabled' : ''}>−Đ10K</button></div>
        <div class="biz-btns">${up('branch', '🏦 Şube')}${up('card', '💳 Kredi kartı')}${up('insurance', '🛡️ Sigorta')}${up('center', '🏙️ Finans merkezi')}</div></div>`);
    }
    // Halka arz
    const I = FINANCE.ipo;
    parts.push(`<div class="biz ${this.ipo ? 'owned' : g.level < I.level ? 'locked' : ''}"><div class="biz-head"><span class="biz-e">🔔</span><div><b>Halka arz</b><small>${this.ipo ? 'Holding borsada' : `Şirketin %${Math.round(I.share * 100)}'ini sat: ~Đ${formatMoney(this.companyValue * I.share)} nakit`}</small></div></div>
      ${this.ipo ? '' : `<div class="biz-btns">${g.level < I.level ? `<span class="lock">🔒 Sv.${I.level}</span>` : '<button class="primary" data-fin="ipo">Halka arz et</button>'}</div>`}</div>`);
    const fx = [];
    if (this.customerFactor > 1) fx.push(`müşteri ×${this.customerFactor}`);
    if (this.electricityFactor < 1) fx.push('elektrik −%50');
    if (this.interestFactor < 1) fx.push(this.interestFactor === 0 ? 'kredi faizi yok' : 'kredi faizi −%50');
    if (fx.length) parts.push(`<p class="note">🏆 Etkiler: ${fx.join(' · ')}</p>`);
    return parts.join('');
  }

  onClick(d) {
    if (d.fin === 'license') this.buyLicense();
    if (d.fin === 'bank') this.openBank();
    if (d.fin === 'ipo') this.doIpo();
    if (d.sbuy) { const [k, n] = d.sbuy.split(':'); this.buy(k, Number(n)); }
    if (d.ssell) { const [k, n] = d.ssell.split(':'); this.sell(k, Number(n)); }
    if (d.cap) this.capital(Number(d.cap));
    if (d.up) this.bankUpgrade(d.up);
  }

  serialize() {
    return { invest: this.invest, stocks: this.stocks, bank: this.bank, ipo: this.ipo };
  }

  restore(d) {
    if (!d) return;
    this.invest = !!d.invest;
    for (const [k, s] of Object.entries(d.stocks ?? {})) if (this.stocks[k]) Object.assign(this.stocks[k], s);
    this.bank = d.bank ?? null;
    this.ipo = !!d.ipo;
    this.buildBankHq();
  }
}

/** Mini fiyat grafiği (metin). */
function sparkline(h) {
  const bars = '▁▂▃▄▅▆▇█';
  const min = Math.min(...h);
  const max = Math.max(...h);
  return h.slice(-10).map((v) => bars[Math.round(((v - min) / (max - min || 1)) * 7)]).join('');
}

