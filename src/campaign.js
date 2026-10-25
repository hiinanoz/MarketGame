import { Shelf } from './stations.js';
import { Customer } from './actors.js';
import { CHARACTER_NAMES } from './assets.js';
import { PRODUCTS, CAMPAIGN, DOOR_X } from './config.js';

// Kampanya: bir gün önceden hazırlanır (ürün + stok seçilir, ücret ödenir).
// Kampanya günü: sabah kapıda kuyruk, 50–250 ek müşteri, yüksek yoğunluk.
// Stok yetmezse bekleyenler mutsuz gider; gün sonunda kalan stok zarar yazılır.

export class Campaign {
  constructor(game) {
    this.game = game;
    this.scheduled = null; // { product, qty } — yarın
    this.active = null;    // { product, qty, extra, spawned, sold, timer }
    this.stand = null;
    this.doorQueue = [];
  }

  get unlocked() {
    return this.game.level >= CAMPAIGN.fromLevel;
  }

  fee() {
    return CAMPAIGN.feeBase + this.game.level * CAMPAIGN.feePerLevel;
  }

  costFor(product, qty) {
    return this.fee() + qty * PRODUCTS[product].cost;
  }

  /** Yarın için kampanya hazırla. */
  prepare(product, qty) {
    if (this.scheduled || !this.unlocked) return false;
    const total = this.costFor(product, qty);
    if (this.game.money < total) return false;
    this.game.spend(total);
    this.scheduled = { product, qty };
    this.game.hud.toast(`📢 Yarın ${PRODUCTS[product].emoji} kampanyası!`);
    this.game.audio.play('unlock');
    this.game.save();
    return true;
  }

  get rushBoost() {
    return this.active ? CAMPAIGN.rushBoost : 1;
  }

  // ---- Gün akışı ----------------------------------------------------------------------

  /** Gece bitmeden birkaç saniye önce: kampanya varsa kapıda kuyruk oluşur. */
  beforeOpening() {
    if (!this.scheduled || this.doorQueue.length) return;
    const shelfLike = this.ensureStand(this.scheduled.product);
    const models = CHARACTER_NAMES.filter((n) => n !== 'Barbarian');
    for (let i = 0; i < CAMPAIGN.doorQueue; i++) {
      const qty = 1 + Math.floor(Math.random() * 3);
      const c = new Customer(this.game, models[i % models.length], shelfLike, qty, [DOOR_X, 4], null, {
        waitAt: [DOOR_X + (i % 2 ? 0.5 : -0.5), 6.4 + i * 0.8],
      });
      c.campaign = true;
      c.patience = CAMPAIGN.patience;
      this.game.customers.push(c);
      this.doorQueue.push(c);
    }
  }

  /** Sabah açılış: planlanan kampanya başlar. */
  startDay() {
    if (!this.scheduled) return;
    if (!this.doorQueue.length) this.beforeOpening(); // gece atlandıysa kuyruk şimdi oluşur
    const { product, qty } = this.scheduled;
    this.scheduled = null;
    // Dün hazırlanan stoğun ilk kısmı standda hazır, kalanı kamyonla depoya gelir
    const stand = this.ensureStand(product);
    const onStand = Math.min(stand.capacity, qty);
    stand.fillStock(onStand);
    const pallet = this.game.depot.addPallet(product, Math.max(1, qty - onStand));
    pallet.stock = 0;
    if (qty > onStand) this.game.depot.order({ [product]: qty - onStand }, { free: true });
    const extra = CAMPAIGN.extraMin + Math.floor(Math.random() * (CAMPAIGN.extraMax - CAMPAIGN.extraMin + 1));
    this.active = { product, qty, extra, spawned: 0, sold: 0, timer: 0 };
    this.game.hud.toast(`📢 ${PRODUCTS[product].emoji} Kampanya günü! Kapıda kuyruk var`);
    // Kapıdaki kuyruğu sırayla içeri al
    this.doorQueue.forEach((c, i) => setTimeoutSafe(this.game, i * 0.35, () => c.release()));
    this.doorQueue = [];
  }

  ensureStand(product) {
    if (this.stand && this.stand.product === product) return this.stand;
    if (this.stand) this.removeStand();
    const [x, z] = CAMPAIGN.standPos;
    this.stand = new Shelf(this.game, { id: 'campaign', product, pos: [x, z] });
    this.stand.setStage(2);
    this.game.shelves.push(this.stand);
    return this.stand;
  }

  removeStand() {
    const s = this.stand;
    if (!s) return;
    this.game.scene.remove(s.root);
    this.game.nav.setBox(`shelf-${s.id}`, null);
    const i = this.game.shelves.indexOf(s);
    if (i >= 0) this.game.shelves.splice(i, 1);
    this.stand = null;
  }

  update(dt) {
    const a = this.active;
    if (!a || !this.game.day.isOpen) return;
    // Gün boyunca ek kampanya müşterileri (yoğun saatlerde daha sık)
    const remainingTime = Math.max(5, this.game.day.remaining);
    const left = a.extra - a.spawned;
    if (left <= 0) return;
    a.timer -= dt;
    if (a.timer <= 0) {
      a.timer = (remainingTime / left) * (0.5 + Math.random());
      if (this.game.customers.length < CAMPAIGN.maxActive) this.spawnShopper();
      a.spawned++;
    }
  }

  spawnShopper() {
    const models = CHARACTER_NAMES.filter((n) => n !== 'Barbarian');
    const qty = 1 + Math.floor(Math.random() * 3);
    const c = new Customer(this.game, models[Math.floor(Math.random() * models.length)], this.stand, qty, [DOOR_X, 4]);
    c.campaign = true;
    c.patience = CAMPAIGN.patience;
    this.game.customers.push(c);
  }

  /** Gün sonu: kalan kampanya stoğu zarar. Özet için sonuç döner. */
  endOfDay(today) {
    const a = this.active;
    if (!a) return;
    const product = a.product;
    let left = 0;
    const pallet = this.game.depot.pallets.get(product);
    if (pallet) left += pallet.stock + this.game.depot.incoming(product);
    if (this.stand) left += this.stand.count;
    for (const ch of [this.game.player, ...this.game.workers]) {
      for (const e of [...ch.stack]) {
        if (e.product !== product) continue;
        ch.stack.splice(ch.stack.indexOf(e), 1);
        e.mesh.removeFromParent();
        left++;
      }
      ch.layoutStack?.();
    }
    const loss = left * PRODUCTS[product].cost;
    today.campaign = { product, qty: a.qty, sold: a.sold, left, loss, extra: a.spawned };
    this.game.depot.removePallet(product);
    for (const t of this.game.depot.trucks) t.cargo = t.cargo.filter((c) => c !== product);
    this.removeStand();
    this.active = null;
  }

  onSold(product) {
    if (this.active?.product === product) this.active.sold++;
  }

  serialize() {
    return { scheduled: this.scheduled };
  }

  restore(d) {
    // Aktif kampanya gün ortasında kaydedildiyse sabah yeniden başlamaz (gün kaydı sabaha döner)
    this.scheduled = d?.scheduled ?? null;
  }
}

/** Simülasyon hızlandırılsa da çalışan gecikmeli çağrı (oyun zamanıyla). */
function setTimeoutSafe(game, sec, fn) {
  game.later.push({ t: sec, fn });
}

