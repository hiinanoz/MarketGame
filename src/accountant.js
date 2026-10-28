import { Character } from './character.js';
import { workerBadge } from './actors.js';
import { PRODUCTS, SPECIALS, STAFF_ROLE, WAGES, ACCOUNTANT_TIERS, CAMPAIGN, AD_TYPES, CAMPAIGN_PROMO } from './config.js';

// Market muhasebecisi (mavi şapka): marketin işlerini takip eder. Her yetki muhasebe odasındaki
// 🧑‍💼 sekmesinden açılıp kapatılır:
//   sipariş · kampanya (akşam yarın için) · alan yatırımı · personel alımı · kredi ile ödemeler
// Tecrübe: stajyer (ucuz, geçmişe bakarak tahmin eder) / tecrübeli (pahalı, pazar araştırmasıyla
// kampanya talebini bilir, maaşı karşılanamayacak personeli almaz, ödemelere göre yedek tutar).

// Yatırım (personel dışı) alanları
const INVEST_TYPES = new Set(['shelf', 'shelfStage', 'stockerCap', 'checkout', 'door',
  'depot', 'parking', 'expansion', 'room3', 'wholesaler', 'producer']);

/** Bu alan bir çalışan mı işe alıyor? */
function isStaffPad(def) {
  if (def.type === 'ads') return def.target === 'advertiser';
  // Online bölümünün personeli ayrı yetkiyle (online) alınır
  return def.type in STAFF_ROLE && def.type !== 'accountant' && !def.type.startsWith('online');
}

export class MarketAccountant extends Character {
  constructor(game) {
    super(game, 'Mage', { speed: 3, look: 'uniform', cap: 'blue' });
    this.position.set(11.0, 0, -12.2);
    this.heading = Math.PI; // masaya bak
    this.root.rotation.y = this.heading;
    game.scene.add(this.root);
    this.settings = { order: true, campaign: true, invest: true, hire: false, credit: true, ads: false, adChannel: 'auto', online: false };
    this.tier = 'junior';
    this.log = [];
    this.timer = 2;
    this.decidedDay = 0;
    this.badge = null;
    this.applyTier();
  }

  get expert() {
    return this.tier === 'expert';
  }

  /** Günlük maaş (bordro bunu kullanır). */
  get wage() {
    return ACCOUNTANT_TIERS[this.tier].wage;
  }

  applyTier() {
    if (this.badge) this.root.remove(this.badge);
    this.badge = null;
    if (this.expert) {
      this.badge = workerBadge('🎓');
      this.root.add(this.badge);
    }
  }

  /** Stajyer ↔ tecrübeli muhasebeci. */
  setTier(tier) {
    const g = this.game;
    if (tier === this.tier) return false;
    if (tier === 'expert') {
      if (!g.premium) {
        g.hud.toast('👑 Tecrübeli muhasebeci Premium\'a özel');
        g.audio.play('error');
        return false;
      }
      const cost = ACCOUNTANT_TIERS.expert.hire;
      if (g.money < cost) return false;
      g.spend(cost);
    }
    this.tier = tier;
    this.applyTier();
    g.hud.toast(`${ACCOUNTANT_TIERS[tier].emoji} ${ACCOUNTANT_TIERS[tier].name} işe başladı (günlük $${this.wage})`);
    g.save();
    return true;
  }

  /** Kasada tutulacak en az para. Tecrübeli: bu akşamın tüm ödemeleri + pay; stajyer: kabaca maaşlar. */
  get reserve() {
    const g = this.game;
    if (this.expert) return Math.round(g.dueTonight * 1.15 + 150 + g.level * 30);
    return 200 + g.level * 40 + g.dailyPayroll;
  }

  /** Son günlerin ortalama kazancı (maaşı karşılayabilir miyiz?). */
  get avgIncome() {
    const h = this.game.bank.history ?? [];
    return h.length ? h.reduce((a, b) => a + b, 0) / h.length : 0;
  }

  note(text) {
    const d = this.game.day;
    this.log.unshift(`Gün ${d.day} ${d.clockText} · ${text}`);
    this.log.length = Math.min(this.log.length, 10);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 4;
      if (this.settings.order) this.manageOrders();
      if (this.settings.campaign) this.manageCampaign();
      if (this.settings.campaign) this.managePromo();
      if (this.settings.ads) this.manageAds();
      if (this.settings.online) this.manageOnline();
      if (this.settings.invest) this.manageInvestments();
      if (this.settings.hire) this.manageHiring();
    }
    super.update(dt);
  }

  // ---- Sipariş: paletleri %85'e tamamla ----

  manageOrders() {
    const g = this.game;
    const depot = g.depot;
    let budget = g.money - (this.expert ? g.dueTonight : this.reserve * 0.5);
    if (budget <= 0) return;
    const items = {};
    let total = 0;
    let count = 0;
    const pallets = depot.regularPallets().sort(([, a], [, b]) => a.stock / a.capacity - b.stock / b.capacity);
    for (const [product, p] of pallets) {
      const have = p.stock + depot.incoming(product);
      if (have >= p.capacity * 0.45) continue;
      const price = g.supply.costOf(product);
      const want = Math.min(depot.room(product), Math.ceil(p.capacity * 0.85) - have);
      const qty = Math.min(want, Math.floor(budget / price));
      if (qty <= 0) continue;
      items[product] = qty;
      budget -= qty * price;
      total += qty * price;
      count += qty;
    }
    if (count && depot.order(items)) this.note(`🚚 ${count} kasa sipariş ($${total})`);
  }

  // ---- Reklam: akşam yarın için, seçilen kanaldan bütçe yettikçe ----

  manageAds() {
    const g = this.game;
    const a = g.ads;
    if (g.day.hour < 19 || this.adsDay === g.day.day) return;
    this.adsDay = g.day.day;
    const spare = g.money - this.reserve;
    const open = Object.keys(AD_TYPES).filter((k) => g.level >= AD_TYPES[k].level && !a.has(k));
    let pick = null;
    if (this.settings.adChannel === 'auto') {
      // Bütçenin dörtte birine sığan en güçlü kanal
      pick = open.filter((k) => a.cost(k) <= spare * 0.25).sort((x, y) => a.cost(y) - a.cost(x))[0];
    } else if (open.includes(this.settings.adChannel) && a.cost(this.settings.adChannel) <= spare * 0.5) {
      pick = this.settings.adChannel;
    }
    if (!pick) {
      this.note(`📣 Reklam verilmedi: bütçe yetmedi (yedek $${this.reserve})`);
      return;
    }
    if (a.buy(pick)) this.note(`📣 Yarın için ${AD_TYPES[pick].emoji} ${AD_TYPES[pick].name} ($${a.cost(pick)})`);
  }

  // ---- Online sipariş: bölümü açar, bütçe yettikçe personel alır ----

  manageOnline() {
    const g = this.game;
    const spare = g.money - this.reserve * 1.5;
    if (spare <= 0) return;
    const open = g.pads.get('online');
    if (open && !open.locked) {
      if (open.remaining <= spare * 0.6) this.buyPad(open, '🌐');
      return;
    }
    if (!g.online.built) return;
    // Önce çalışması için gereken üç kişi, sonra sıradaki toplayıcı/kurye
    const order = ['onlineDeputy', 'onlinePicker', 'onlineCourier'];
    const pads = [...g.pads.values()].filter((p) => !p.locked && p.def.type.startsWith('online') && p.def.type !== 'online' && p.remaining <= spare * 0.5);
    pads.sort((a, b) => order.indexOf(a.def.type) - order.indexOf(b.def.type) || a.def.level - b.def.level);
    const pad = pads[0];
    if (!pad) return;
    const wage = WAGES[STAFF_ROLE[pad.def.type]] ?? 50;
    // Tecrübeli: online çalışıyorsa yeni maaşı kazanç karşılamıyorsa almaz
    if (this.expert && g.online.operating && this.avgIncome < (g.dailyPayroll + wage) * 1.5) return;
    this.buyPad(pad, '🌐');
  }

  // ---- Kampanya ek promosyonu: öğleden sonra satış yavaşsa %25 indirim ----

  managePromo() {
    const g = this.game;
    const c = g.campaign;
    if (!c.active.length || g.day.hour < CAMPAIGN_PROMO.autoHour) return;
    for (const a of c.active) {
      // Tecrübeli daha erken ve isabetli karar verir; stajyer ancak çok yavaşsa
      const limit = this.expert ? 0.2 : 0.35;
      if (c.canPromo(a) && c.projectedLeft(a) > a.qty * limit && c.startPromo(a.product, 'accountant')) {
        this.note(`🏷️ ${PRODUCTS[a.product].emoji} kampanyası yavaştı: %25 ek indirim (${c.leftOf(a)} kasa kalmıştı)`);
      }
    }
  }

  // ---- Kampanya: akşam yarının kampanyalarına karar ver ----

  manageCampaign() {
    const g = this.game;
    const c = g.campaign;
    if (!c.unlocked || !g.day.isOpen || g.day.hour < 19 || this.decidedDay === g.day.day) return;
    if (c.slotsFree <= 0) {
      this.decidedDay = g.day.day;
      return;
    }
    // 19:00'dan sonra yarım saatte bir dener; para gün içinde gelebilir. 21:00'de son karar.
    if (this.campaignTryT && g.day.t < this.campaignTryT) return;
    this.campaignTryT = g.day.t + 7.5;
    const score = (k) => {
      const p = PRODUCTS[k];
      const r = c.lastResults[k];
      const sellRate = r ? r.sold / Math.max(1, r.qty) : 0.8;
      return (p.price - p.cost) * (0.5 + sellRate);
    };
    const ranked = SPECIALS.filter((k) => !c.isScheduled(k)).sort((a, b) => score(b) - score(a));
    let budget = (g.money - this.reserve) * (this.expert ? 0.7 : 0.6);
    let made = 0;
    for (const product of ranked) {
      if (c.slotsFree <= 0) break;
      // Tecrübeli: pazar araştırmasıyla gelecek müşteriyi bilir, stoğu talebe göre ayarlar
      const extra = c.rollExtra();
      // Kampanya personeli: tecrübeli, talep normal standın kaldırabileceğinden fazlaysa tutar;
      // stajyer bütçe yettikçe rastgele karar verir
      const staff = this.expert ? extra > this.campaignCapacity(this.game.campaign.maxCampaigns, false) * 1.1 : Math.random() < 0.4;
      let qty = this.expert ? this.expertEstimate(extra, this.game.campaign.maxCampaigns, staff) : this.estimate(product);
      while (qty > CAMPAIGN.minStock && c.costFor(product, qty, staff) > budget) qty -= 10;
      const cost = c.costFor(product, qty, staff);
      if (cost > budget) break;
      // Tecrübeli: bütçe talebin çok altında kalıyorsa (stok talebin %40'ından azsa) bu ürünü atlar,
      // daha ucuz bir ürünle dener; personel tutuyorsa ürün bitince müşteri az üzülür
      if (this.expert && qty < this.expertEstimate(extra, this.game.campaign.maxCampaigns, staff) * 0.4) continue;
      if (c.prepare(product, qty, { by: 'accountant', extra, staff })) {
        budget -= cost;
        made++;
        this.note(`📢 Yarın ${PRODUCTS[product].emoji} ${PRODUCTS[product].name} kampanyası (${qty} kasa${staff ? ', 👥 personelli' : ''}${this.expert ? `, ~${extra} müşteri bekleniyor` : ''})`);
      }
      if (budget < c.fee() * 3) break;
    }
    if (made || g.day.hour >= 21) {
      this.decidedDay = g.day.day;
      this.campaignTryT = 0;
      if (!made && !c.scheduled.length) {
        this.note(`📢 Kampanya yapılamadı: bütçe yetmedi (kasa $${Math.round(g.money)}, yedek $${this.reserve})`);
        g.hud.toast('🧑‍💼 Muhasebeci: yarın için kampanya bütçesi yetmedi');
      }
    }
  }

  /**
   * Tecrübeli: gelecek müşteri (pazar araştırması) ile mağazanın bir günde kaldırabileceği kampanya
   * müşterisinin küçüğü × müşteri başı 2 kasa + %5 pay (mağduriyet ve kalan stok az).
   */
  expertEstimate(extra, together = 1, staff = false) {
    const come = Math.min(extra, this.campaignCapacity(together, staff));
    return Math.max(CAMPAIGN.minStock, Math.min(CAMPAIGN.maxStock, Math.ceil((come * 2 * 1.05) / 10) * 10));
  }

  /** Geçmiş kampanyalardan: aynı anda N kampanya varken bir kampanyaya en fazla kaç kişi gelebildi. */
  campaignCapacity(together, staff = false) {
    const seen = Object.values(this.game.campaign.lastResults).filter((r) => r.planned && r.extra < r.planned && !!r.staff === staff);
    if (!seen.length) return staff ? 250 : Math.round(420 / Math.max(1, together)); // ilk tahmin
    const perDay = Math.max(...seen.map((r) => r.extra * (r.together ?? 1)));
    return Math.round(perDay / Math.max(1, together));
  }

  /** Stajyer: son kampanyaya bakarak tahmin eder (talep her seferinde değiştiği için sık yanılır). */
  estimate(product) {
    const r = this.game.campaign.lastResults[product];
    let qty = 120;
    if (r) qty = r.left > 0 ? r.sold * 1.05 : (r.sold + (r.unhappy ?? 0) * 2) * 1.1;
    return Math.max(CAMPAIGN.minStock, Math.min(CAMPAIGN.maxStock, Math.round(qty / 10) * 10));
  }

  // ---- Yatırım: personel dışı alanlar ----

  manageInvestments() {
    const g = this.game;
    const spare = g.money - this.reserve * 2;
    if (spare <= 0) return;
    const pad = [...g.pads.values()]
      .filter((p) => !p.locked && INVEST_TYPES.has(p.def.type) && p.remaining <= spare * 0.5)
      .sort((a, b) => a.remaining - b.remaining)[0];
    if (!pad) return;
    this.buyPad(pad, '🏗️');
  }

  // ---- Personel alımı ----

  manageHiring() {
    const g = this.game;
    const spare = g.money - this.reserve * 1.5;
    if (spare <= 0) return;
    const pads = [...g.pads.values()].filter((p) => !p.locked && isStaffPad(p.def) && p.remaining <= spare * 0.5);
    for (const pad of pads.sort((a, b) => a.remaining - b.remaining)) {
      const role = pad.def.type === 'ads' ? 'advertiser' : STAFF_ROLE[pad.def.type];
      const wage = WAGES[role] ?? 50;
      // Tecrübeli: ortalama günlük kazanç yeni maaşı rahat karşılamıyorsa almaz
      if (this.expert && this.avgIncome < (g.dailyPayroll + wage) * 1.6) continue;
      this.buyPad(pad, '👥');
      return;
    }
  }

  buyPad(pad, emoji) {
    const g = this.game;
    const label = g.padLabel(pad.def);
    const cost = Math.ceil(pad.remaining);
    g.completePad(pad.def.id);
    this.note(`${emoji} ${label.emoji} ${label.title} satın aldı ($${cost})`);
  }

  // ---- Gün sonu: ödemeler için kredi ----

  /**
   * Gün sonu ödemelerinden hemen önce (faiz, maaş, fatura, kira): kasa + mevduat yetmiyorsa
   * eksik kadar kredi çeker. Öncelik çalışanların maaşını tam ödemek.
   */
  beforeSettlement() {
    if (!this.settings.credit) return;
    const g = this.game;
    const due = g.dueTonight;
    const have = g.money + g.bank.deposit;
    const short = Math.ceil(due - have);
    if (short <= 0) return;
    // Stajyer biraz fazla çeker (gereksiz faiz), tecrübeli tam ihtiyaç kadar
    const amount = this.expert ? short : Math.ceil(short * 1.2 + 50);
    const got = g.bank.borrow(amount);
    if (got) this.note(`🏦 Ödemeler için $${got} kredi çekildi${got < amount ? ' (limit yetmedi)' : ''}`);
    else this.note('🏦 Kredi limiti dolu: ödemeler eksik kalabilir');
  }

  endOfDay() {}

  serialize() {
    return { settings: this.settings, log: this.log, tier: this.tier };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this.settings, d.settings ?? {});
    this.log = d.log ?? [];
    this.tier = d.tier ?? 'junior';
    this.applyTier();
  }
}
