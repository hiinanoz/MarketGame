import * as THREE from 'three';
import { Shelf, QUEUE_COLS, QUEUE_ROWS, QUEUE_DX, QUEUE_DZ } from './stations.js';
import { Customer, workerBadge } from './actors.js';
import { Character } from './character.js';
import { CHARACTER_NAMES } from './assets.js';
import { PRODUCTS, CAMPAIGN, DOOR_X, DAY, CAMPAIGN_PROMO } from './config.js';

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

  costFor(product, qty, staff = false) {
    return this.fee() + qty * PRODUCTS[product].cost + (staff ? CAMPAIGN.staffCost : 0);
  }

  /** Personelli kampanyalar: mağazaya aynı anda daha çok müşteri alınabilir. */
  get maxActive() {
    return CAMPAIGN.maxActive + this.active.filter((a) => a.staff).length * CAMPAIGN.staffMaxActive;
  }

  isScheduled(product) {
    return this.scheduled.some((s) => s.product === product);
  }

  /** Yarın için kampanya hazırla. */
  /** Bir kampanyanın getireceği ek müşteri (hazırlıkta belirlenir; tecrübeli muhasebeci önceden bilir). */
  rollExtra() {
    return CAMPAIGN.extraMin + Math.floor(Math.random() * (CAMPAIGN.extraMax - CAMPAIGN.extraMin + 1));
  }

  prepare(product, qty, { by = 'player', extra = null, staff = false } = {}) {
    if (!this.unlocked || this.slotsFree <= 0 || this.isScheduled(product)) return false;
    qty = Math.max(CAMPAIGN.minStock, Math.min(CAMPAIGN.maxStock, qty));
    const total = this.costFor(product, qty, staff);
    if (this.game.money < total) return false;
    this.game.spend(total);
    this.scheduled.push({ product, qty, paid: total, by, extra: extra ?? this.rollExtra(), staff });
    if (by === 'player') this.game.goals?.event('campaign');
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
      const extra = s.extra ?? this.rollExtra();
      const slot = { index: i, product: s.product, qty: s.qty, extra, spawned: 0, sold: 0, timer: Math.random() * 2, stand, staff: !!s.staff, pallet };
      stand.staffed = slot.staff;
      if (slot.staff) slot.worker = this.spawnStaff(stand);
      this.active.push(slot);
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

  /** Kampanya personeli: standın yanında durur, satış yapar, ödemeyi alır. */
  spawnStaff(stand) {
    const w = new Character(this.game, 'Rogue', { speed: 3, look: 'uniform' });
    w.position.set(stand.x + 1.9, 0, stand.z - 0.3);
    w.heading = Math.PI / 2 + Math.PI; // standa (−x) bak
    w.root.rotation.y = -Math.PI / 2;
    w.root.add(workerBadge('📢'));
    this.game.scene.add(w.root);
    return w;
  }

  /** Bu kampanyanın ürünü tamamen bitti mi (stand + palet + taşınan)? */
  soldOut(a) {
    if (a.stand.count > 0 || (a.pallet?.stock ?? 0) > 0) return false;
    return !this.game.workers.some((w) => w.stack?.some((e) => e.product === a.product)) && !this.game.player.stack.some((e) => e.product === a.product);
  }

  update(dt) {
    if (!this.active.length || !this.game.day.isOpen) return;
    for (const a of this.active) {
      if (a.worker) {
        a.worker.update(dt);
        // Personel paletten standa hızlıca kasa koyar
        a.refillT = (a.refillT ?? 0) - dt;
        if (a.refillT <= 0 && a.pallet?.stock > 0 && a.stand.space > 0) {
          a.refillT = CAMPAIGN.staffRefill;
          a.pallet.stock--;
          a.pallet.syncVisual();
          a.stand.fillStock(1);
        }
      }
      // Ürün bittiyse sıradakiler beklemesin, yeni müşteri de gelmesin
      if (!a.ended && this.soldOut(a)) {
        a.ended = true;
        a.spawned = Math.max(a.spawned, a.extra);
        for (const c of [...a.stand.waiting]) {
          if (c.state !== 'atShelf' && c.state !== 'toShelf') continue;
          if (c.carrying > 0) c.leaveShelf();
          else c.leaveSoldOut(a.staff);
        }
        this.game.hud.toast(`📢 ${PRODUCTS[a.product].emoji} kampanya ürünü bitti${a.staff ? ' — personel sıradakilerden özür diledi' : ''}`);
      }
    }
    const remaining = Math.max(5, this.game.day.remaining);
    for (const a of this.active) {
      const left = a.extra - a.spawned;
      if (left <= 0) continue;
      a.timer -= dt;
      if (a.timer > 0) continue;
      // Personelsiz kampanya normal sınırla, personelli olan ek kapasiteyle müşteri alır
      if (this.game.customers.length >= (a.staff ? this.maxActive : CAMPAIGN.maxActive)) {
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
      const r = { product, qty: a.qty, sold: a.sold, left, loss: left * PRODUCTS[product].cost, extra: a.spawned, planned: a.extra, unhappy, together: this.active.length };
      today.campaigns.push(r);
      this.lastResults[product] = r;
      this.lastResult = r;
      this.game.depot.removePallet(product);
      this.removeStand(a.stand);
      if (a.worker) this.game.scene.remove(a.worker.root);
      r.staff = a.staff;
    }
    this.active = [];
  }

  /** Bu ürünün kampanyasında ek promosyon (%25 indirim) var mı? */
  promoActive(product) {
    return this.active.some((a) => a.product === product && a.promo);
  }

  /** Kalan kampanya stoğu (palet + stand). */
  leftOf(a) {
    return (a.pallet?.stock ?? 0) + a.stand.count;
  }

  /** Satış hızı: gün sonuna kadar bu tempoyla kaç kasa kalır? */
  projectedLeft(a) {
    const d = this.game.day;
    const frac = Math.max(0.05, d.t / DAY.length);
    const pace = a.sold / frac; // tüm günde satılacak tahmini kasa
    return Math.max(0, a.qty - pace);
  }

  canPromo(a) {
    return !!a && !a.promo && !a.ended && this.game.day.isOpen && this.game.day.hour >= CAMPAIGN_PROMO.fromHour && this.leftOf(a) > 0;
  }

  /** 12:00 sonrası: satılmayan kampanya ürününe %25 ek indirim; kalan stok kadar ek müşteri gelir. */
  startPromo(product, by = 'player') {
    const a = this.active.find((x) => x.product === product);
    if (!this.canPromo(a)) return false;
    a.promo = true;
    const left = this.leftOf(a);
    // Gelmesi beklenen müşteriler (~2 kasa/kişi) stoğu eritmiyorsa fark kadar ek müşteri
    const pending = Math.max(0, a.extra - a.spawned) * 2;
    a.extra += Math.max(0, Math.ceil((left - pending) / 2));
    a.timer = 0;
    a.stand.setPromo?.(true);
    const p = PRODUCTS[product];
    this.game.hud.toast(`🏷️ ${by === 'accountant' ? 'Muhasebeci: ' : ''}${p.emoji} ${p.name} %${Math.round((1 - CAMPAIGN_PROMO.price) * 100)} ek indirimde — ${left} kasa kaldı`);
    return true;
  }

  onSold(product) {
    this.game.goals?.event('sell', 1, product);
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
