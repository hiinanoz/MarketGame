import * as THREE from 'three';
import { Shelf, QUEUE_COLS, QUEUE_ROWS, QUEUE_DX, QUEUE_DZ } from './stations.js';
import { Customer } from './actors.js';
import { CHARACTER_NAMES } from './assets.js';
import { PRODUCTS, CAMPAIGN, DOOR_X } from './config.js';

// Kampanyalar: bir gün önceden hazırlanır (ürün + stok seçilir, ücret ödenir). Aynı anda en fazla 3.
// Kampanya günü: her kampanyanın mağaza önünde kendi standı ve yanında stok paleti olur,
// sabah kapıda kuyruk, gün boyu 50–500 ek müşteri. Stok yetmezse bekleyenler mutsuz gider;
// gün sonunda kalan stok zarar yazılır. Kampanya müşterilerinin %20'si başka ürün de alır.

const models = () => CHARACTER_NAMES.filter((n) => n !== 'Barbarian');

export class Campaign {
  constructor(game) {
    this.game = game;
    this.scheduled = [];   // [{ product, qty, paid, by }] — yarın
    this.active = [];      // [Slot] — bugün
    this.doorQueue = [];
    this.lastResults = {}; // ürün → son kampanya sonucu
  }

  get unlocked() {
    return this.game.level >= CAMPAIGN.fromLevel;
  }

  get slotsFree() {
    return CAMPAIGN.maxCampaigns - this.scheduled.length;
  }

  fee() {
    return CAMPAIGN.feeBase + this.game.level * CAMPAIGN.feePerLevel;
  }

  costFor(product, qty) {
    return this.fee() + qty * PRODUCTS[product].cost;
  }

  isScheduled(product) {
    return this.scheduled.some((s) => s.product === product);
  }

  /** Yarın için kampanya hazırla. */
  prepare(product, qty, { by = 'player' } = {}) {
    if (!this.unlocked || this.slotsFree <= 0 || this.isScheduled(product)) return false;
    qty = Math.max(CAMPAIGN.minStock, Math.min(CAMPAIGN.maxStock, qty));
    const total = this.costFor(product, qty);
    if (this.game.money < total) return false;
    this.game.spend(total);
    this.scheduled.push({ product, qty, paid: total, by });
    const who = by === 'accountant' ? '🧾 Muhasebeci: ' : '';
    this.game.hud.toast(`${who}📢 Yarın ${PRODUCTS[product].emoji} ${PRODUCTS[product].name} kampanyası!`);
    this.game.audio.play('unlock');
    this.game.save();
    return true;
  }

  /** Planlanan kampanyayı iptal et: ödenen para iade edilir. */
  cancel(product) {
    const i = this.scheduled.findIndex((s) => s.product === product);
    if (i < 0) return false;
    const [s] = this.scheduled.splice(i, 1);
    this.game.money += s.paid ?? 0;
    this.game.hud.setMoney(this.game.money);
    this.game.hud.toast(`❌ ${PRODUCTS[product].name} kampanyası iptal (+$${s.paid ?? 0} iade)`);
    for (const c of this.doorQueue.filter((c) => c.shelf.product === product)) c.leaveQuietly();
    this.doorQueue = this.doorQueue.filter((c) => c.shelf.product !== product);
    this.game.save();
    return true;
  }

  get rushBoost() {
    const n = this.active.length;
    return n ? CAMPAIGN.rushBoost + (n - 1) * 0.15 : 1;
  }

  /** Bugünkü kampanya standları (taşıyıcılar için). */
  get stands() {
    return this.active.map((s) => s.stand);
  }

  // ---- Gün akışı ----------------------------------------------------------------------

  /** Gece bitmeden birkaç saniye önce: kapıda kuyruk oluşur, standlar kurulur. */
  beforeOpening() {
    if (!this.scheduled.length || this.doorQueue.length) return;
    const total = CAMPAIGN.doorQueue + (this.scheduled.length - 1) * 6;
    const ms = models();
    this.scheduled.forEach((s, i) => this.ensureStand(i, s.product));
    for (let i = 0; i < total; i++) {
      const slot = i % this.scheduled.length;
      const stand = this.standAt(slot);
      const c = new Customer(this.game, ms[i % ms.length], stand, 1 + Math.floor(Math.random() * 3), [DOOR_X, 4], null, {
        waitAt: [DOOR_X + (i % 2 ? 0.5 : -0.5), 6.4 + Math.floor(i / 2) * 0.8 + (i % 2) * 0.4],
      });
      c.campaign = true;
      c.patience = CAMPAIGN.patience;
      this.game.customers.push(c);
      this.doorQueue.push(c);
    }
  }

  /** Sabah açılış: planlanan kampanyalar başlar. */
  startDay() {
    if (!this.scheduled.length) return;
    if (!this.doorQueue.length) this.beforeOpening(); // gece atlandıysa kuyruk şimdi oluşur
    this.scheduled.forEach((s, i) => {
      const stand = this.ensureStand(i, s.product);
      // Dün hazırlanan stok: ilk kısmı standda, kalanı standın yanındaki palette
      const onStand = Math.min(stand.capacity, s.qty);
      stand.fillStock(onStand - stand.count);
      const rest = s.qty - onStand;
      const [px, pz] = this.palletPos(i);
      const pallet = this.game.depot.addPallet(s.product, Math.max(1, rest), [px, pz]);
      pallet.stock = rest;
      pallet.syncVisual();
      const extra = CAMPAIGN.extraMin + Math.floor(Math.random() * (CAMPAIGN.extraMax - CAMPAIGN.extraMin + 1));
      this.active.push({ index: i, product: s.product, qty: s.qty, extra, spawned: 0, sold: 0, timer: Math.random() * 2, stand });
    });
    this.scheduled = [];
    const names = this.active.map((a) => PRODUCTS[a.product].emoji).join(' ');
    this.game.hud.toast(`📢 Kampanya günü ${names} — kapıda kuyruk var!`);
    this.doorQueue.forEach((c, i) => this.game.later.push({ t: i * 0.3, fn: () => c.release() }));
    this.doorQueue = [];
  }

  standPos(i) {
    return CAMPAIGN.stands[i];
  }

  palletPos(i) {
    const [x, z] = CAMPAIGN.stands[i];
    return [x + CAMPAIGN.palletOffset[i], z - 0.4];
  }

  standAt(i) {
    return this.game.shelves.find((s) => s.id === `campaign${i}`);
  }

  ensureStand(i, product) {
    const existing = this.standAt(i);
    if (existing && existing.product === product) return existing;
    if (existing) this.removeStand(existing);
    const [x, z] = this.standPos(i);
    const stand = new Shelf(this.game, { id: `campaign${i}`, product, pos: [x, z] });
    stand.setStage(2);
    stand.ropes = buildQueueRopes(x, z);
    this.game.scene.add(stand.ropes);
    this.game.shelves.push(stand);
    return stand;
  }

  removeStand(s) {
    this.game.scene.remove(s.root);
    if (s.ropes) this.game.scene.remove(s.ropes);
    this.game.nav.setBox(`shelf-${s.id}`, null);
    const i = this.game.shelves.indexOf(s);
    if (i >= 0) this.game.shelves.splice(i, 1);
  }

  update(dt) {
    if (!this.active.length || !this.game.day.isOpen) return;
    const remaining = Math.max(5, this.game.day.remaining);
    for (const a of this.active) {
      const left = a.extra - a.spawned;
      if (left <= 0) continue;
      a.timer -= dt;
      if (a.timer > 0) continue;
      if (this.game.customers.length >= CAMPAIGN.maxActive) {
        a.timer = 0.5; // mağaza dolu: biraz sonra tekrar dene
        continue;
      }
      a.timer = (remaining / left) * (0.5 + Math.random());
      this.spawnShopper(a);
      a.spawned++;
    }
  }

  spawnShopper(a) {
    const ms = models();
    const qty = 1 + Math.floor(Math.random() * 3);
    const c = new Customer(this.game, ms[Math.floor(Math.random() * ms.length)], a.stand, qty, [DOOR_X, 4]);
    c.campaign = true;
    c.patience = CAMPAIGN.patience;
    c.wantsExtra = Math.random() < CAMPAIGN.extraShopping; // %20'si başka ürün de alır
    this.game.customers.push(c);
  }

  /** Gün sonu: kalan kampanya stoğu zarar. */
  endOfDay(today) {
    if (!this.active.length) return;
    today.campaigns = [];
    for (const a of this.active) {
      const product = a.product;
      let left = 0;
      const pallet = this.game.depot.pallets.get(product);
      if (pallet) left += pallet.stock;
      left += a.stand.count;
      for (const ch of [this.game.player, ...this.game.workers]) {
        for (const e of [...ch.stack]) {
          if (e.product !== product) continue;
          ch.stack.splice(ch.stack.indexOf(e), 1);
          e.mesh.removeFromParent();
          left++;
        }
        ch.layoutStack?.();
      }
      const unhappy = today.campaignUnhappyBy?.[product] ?? 0;
      const r = { product, qty: a.qty, sold: a.sold, left, loss: left * PRODUCTS[product].cost, extra: a.spawned, unhappy };
      today.campaigns.push(r);
      this.lastResults[product] = r;
      this.lastResult = r;
      this.game.depot.removePallet(product);
      this.removeStand(a.stand);
    }
    this.active = [];
  }

  onSold(product) {
    const a = this.active.find((x) => x.product === product);
    if (a) a.sold++;
  }

  serialize() {
    return { scheduled: this.scheduled, lastResults: this.lastResults };
  }

  restore(d) {
    // Aktif kampanya gün ortasında kaydedildiyse sabah yeniden başlamaz (gün kaydı sabaha döner)
    const s = d?.scheduled;
    this.scheduled = Array.isArray(s) ? s : s ? [s] : [];
    this.lastResults = d?.lastResults ?? (d?.lastResult ? { [d.lastResult.product]: d.lastResult } : {});
  }
}

/** Kuyruk koridoru: sıraların arasında direkler ve kırmızı ip (sıra sonları açık, zikzak). */
function buildQueueRopes(x, z) {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.6, roughness: 0.4 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.6 });
  const postGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.95, 8);
  const half = ((QUEUE_COLS - 1) * QUEUE_DX) / 2;
  for (let r = 0; r < QUEUE_ROWS - 1; r++) {
    const rz = z + 2.9 + (r + 0.5) * QUEUE_DZ;
    const open = r % 2 === 0 ? 1 : -1; // zikzak: ip bir uçtan açık
    const x0 = x - half - 0.3 + (open < 0 ? 1.2 : 0);
    const x1 = x + half + 0.3 - (open > 0 ? 1.2 : 0);
    for (const px of [x0, x1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(px, 0.47, rz);
      post.castShadow = true;
      g.add(post);
    }
    const rope = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.06, 0.06), ropeMat);
    rope.position.set((x0 + x1) / 2, 0.82, rz);
    g.add(rope);
  }
  return g;
}
