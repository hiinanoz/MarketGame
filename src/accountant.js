import { Character } from './character.js';
import { PRODUCTS, SPECIALS } from './config.js';

// Market muhasebecisi (mavi şapka): siparişleri, kampanyaları ve birikimi yönetir.
// Oyuncu her alanı muhasebe odasındaki "Muhasebeci" sekmesinden açıp kapatabilir.

export class MarketAccountant extends Character {
  constructor(game) {
    super(game, 'Mage', { speed: 3, look: 'uniform', cap: 'blue' });
    this.position.set(11.0, 0, -12.2);
    this.heading = Math.PI; // masaya bak
    this.root.rotation.y = this.heading;
    game.scene.add(this.root);
    this.settings = { order: true, campaign: true, savings: true };
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

  // ---- Kampanya: akşam yarının kampanyasına karar ver ----

  manageCampaign() {
    const g = this.game;
    const c = g.campaign;
    if (!c.unlocked || c.scheduled || !g.day.isOpen || g.day.hour < 19 || this.decidedDay === g.day.day) return;
    this.decidedDay = g.day.day;
    // En kârlı özel ürün; son kampanyayla aynıysa çeşitlilik için bir sonrakine geç
    const ranked = [...SPECIALS].sort((a, b) => (PRODUCTS[b].price - PRODUCTS[b].cost) - (PRODUCTS[a].price - PRODUCTS[a].cost));
    let product = ranked[0];
    if (c.lastResult?.product === product && ranked[1]) product = ranked[1];
    // Stok tahmini: son kampanyada satılan + ürün bulamayanların talebi
    let qty = 60;
    if (c.lastResult) {
      const r = c.lastResult;
      qty = Math.round(r.left > 0 ? r.sold * 1.05 : (r.sold + (r.unhappy ?? 0) * 2) * 1.1);
    }
    qty = Math.max(20, Math.min(300, Math.round(qty / 10) * 10));
    // Bütçeye sığdır (paranın en fazla yarısı)
    const budget = (g.money - this.reserve) * 0.5;
    while (qty > 20 && c.costFor(product, qty) > budget) qty -= 10;
    if (c.costFor(product, qty) > budget) {
      this.note('📢 Kampanya için bütçe yetmedi');
      return;
    }
    if (c.prepare(product, qty, { by: 'accountant' })) this.note(`📢 Yarın ${PRODUCTS[product].emoji} ${PRODUCTS[product].name} kampanyası (${qty} kasa)`);
  }

  // ---- Birikim: gün sonunda pahalı borcu öde, fazlayı mevduata yatır ----

  endOfDay() {
    if (!this.settings.savings) return;
    const g = this.game;
    const bank = g.bank;
    const spare = g.money - this.reserve * 2;
    if (spare > 0 && bank.totalDebt > 0) {
      const paid = bank.repay(spare);
      if (paid) this.note(`🏦 $${paid} borç ödedi`);
    }
    const extra = g.money - this.reserve * 3;
    if (extra > 200) {
      const put = bank.put(Math.floor(extra * 0.5));
      if (put) this.note(`🏦 $${put} mevduata yatırdı`);
    }
  }

  serialize() {
    return { settings: this.settings, log: this.log, lastCampaign: this.game.campaign.lastResult ?? null };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this.settings, d.settings ?? {});
    this.log = d.log ?? [];
  }
}
