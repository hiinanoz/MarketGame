import { Character } from './character.js';
import { PRODUCTS, SPECIALS } from './config.js';

// Market muhasebecisi (mavi şapka): marketin tüm işlerini takip eder (banka işleri hariç):
// siparişler, kampanyalar (3'e kadar) ve yatırımlar (açılmış market alanlarını satın alma).
// Oyuncu her alanı muhasebe odasındaki "Muhasebeci" sekmesinden açıp kapatabilir.

// Muhasebecinin satın alabileceği market alanları (oyuncunun kendi taşıma kapasitesi ve holding hariç)
const INVEST_TYPES = new Set(['shelf', 'shelfStage', 'cashier', 'stocker', 'stockerCap', 'cleaner', 'checkout', 'door',
  'depot', 'parking', 'valet', 'security', 'ads', 'manager', 'expansion', 'room3', 'wholesaler', 'producer']);

export class MarketAccountant extends Character {
  constructor(game) {
    super(game, 'Mage', { speed: 3, look: 'uniform', cap: 'blue' });
    this.position.set(11.0, 0, -12.2);
    this.heading = Math.PI; // masaya bak
    this.root.rotation.y = this.heading;
    game.scene.add(this.root);
    this.settings = { order: true, campaign: true, invest: true };
    this.log = [];
    this.timer = 2;
    this.decidedDay = 0;
  }

  /** Kasada tutulacak en az para (maaş, acil sipariş için). */
  get reserve() {
    return 300 + this.game.level * 60;
  }

  note(text) {
    const d = this.game.day;
    this.log.unshift(`Gün ${d.day} ${d.clockText} · ${text}`);
    this.log.length = Math.min(this.log.length, 8);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 4;
      if (this.settings.order) this.manageOrders();
      if (this.settings.campaign) this.manageCampaign();
      if (this.settings.invest) this.manageInvestments();
    }
    super.update(dt);
  }

  // ---- Sipariş: paletleri %85'e tamamla ----

  manageOrders() {
    const g = this.game;
    const depot = g.depot;
    let budget = g.money - this.reserve;
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

  // ---- Kampanya: akşam yarının kampanyalarına karar ver (bütçe yettikçe 3'e kadar) ----

  manageCampaign() {
    const g = this.game;
    const c = g.campaign;
    if (!c.unlocked || !g.day.isOpen || g.day.hour < 19 || this.decidedDay === g.day.day) return;
    this.decidedDay = g.day.day;
    // Kâr marjına ve son sonuca göre sırala; satılamayan (çok stok kalan) ürünler geride
    const score = (k) => {
      const p = PRODUCTS[k];
      const r = c.lastResults[k];
      const sellRate = r ? r.sold / Math.max(1, r.qty) : 0.8;
      return (p.price - p.cost) * (0.5 + sellRate);
    };
    const ranked = SPECIALS.filter((k) => !c.isScheduled(k)).sort((a, b) => score(b) - score(a));
    let budget = (g.money - this.reserve) * 0.6;
    let made = 0;
    for (const product of ranked) {
      if (c.slotsFree <= 0) break;
      let qty = this.estimate(product);
      while (qty > 20 && c.costFor(product, qty) > budget) qty -= 20;
      const cost = c.costFor(product, qty);
      if (cost > budget) break;
      if (c.prepare(product, qty, { by: 'accountant' })) {
        budget -= cost;
        made++;
        this.note(`📢 Yarın ${PRODUCTS[product].emoji} ${PRODUCTS[product].name} kampanyası (${qty} kasa)`);
      }
      // Bütçe ilk kampanyadan sonra zayıfsa durdur
      if (budget < c.fee() * 3) break;
    }
    if (!made && !c.scheduled.length) this.note('📢 Kampanya için bütçe yetmedi');
  }

  /** Stok tahmini: son kampanyada satılan + ürün bulamayanların talebi. */
  estimate(product) {
    const r = this.game.campaign.lastResults[product];
    let qty = 120;
    if (r) qty = r.left > 0 ? r.sold * 1.05 : (r.sold + (r.unhappy ?? 0) * 2) * 1.1;
    return Math.max(20, Math.min(1000, Math.round(qty / 10) * 10));
  }

  // ---- Yatırım: açılmış market alanlarını satın al (kasada yedek bırakarak) ----

  manageInvestments() {
    const g = this.game;
    const spare = g.money - this.reserve * 2;
    if (spare <= 0) return;
    const pads = [...g.pads.values()]
      .filter((p) => !p.locked && INVEST_TYPES.has(p.def.type) && p.remaining <= spare * 0.5)
      .sort((a, b) => a.remaining - b.remaining);
    const pad = pads[0];
    if (!pad) return;
    const label = g.padLabel(pad.def);
    const cost = Math.ceil(pad.remaining);
    g.completePad(pad.def.id);
    this.note(`🏗️ ${label.emoji} ${label.title} satın aldı ($${cost})`);
  }

  /** Banka işleri oyuncuya ait; gün sonunda muhasebeci bankaya dokunmaz. */
  endOfDay() {}

  serialize() {
    return { settings: this.settings, log: this.log, lastCampaign: this.game.campaign.lastResult ?? null };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this.settings, d.settings ?? {});
    this.log = d.log ?? [];
  }
}
