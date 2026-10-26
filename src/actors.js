import * as THREE from 'three';
import { Character } from './character.js';
import { CUSTOMER_LOOKS } from './assets.js';
import { bubbleTexture } from './fx.js';
import { PRODUCTS, CUSTOMER_SPEED, WORKER_SPEED, WORKER_CAPACITY, STREET_Z, RATING, THEFT } from './config.js';

/** İşçilerin başının üstündeki küçük rozet (müşterilerden ayırt etmek için). */
export function workerBadge(emoji) {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(48, 48, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();
  ctx.font = '54px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 48, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.renderOrder = 5;
  s.scale.setScalar(0.5);
  s.position.y = 2.05;
  return s;
}

// ---- Müşteri ------------------------------------------------------------------
// Durumlar: toShelf → atShelf (ürün bekler) → toQueue → inQueue → leaving

export class Customer extends Character {
  constructor(game, modelName, shelf, qty, entry, slot = null, { waitAt = null } = {}) {
    super(game, modelName, {
      speed: CUSTOMER_SPEED * (0.9 + Math.random() * 0.25),
      capacity: qty,
      look: Math.floor(Math.random() * CUSTOMER_LOOKS),
    });
    this.shelf = shelf;
    this.want = qty;
    this.state = 'toShelf';
    this.patience = 45;
    this.waitTimer = 0;
    this.takeTimer = 0;
    this.readyToPay = false;
    this.checkout = null;
    this.removed = false;
    this.entry = entry; // [x, z] mağaza kapısı

    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture(PRODUCTS[shelf.product].emoji, { count: qty }), depthTest: false }));
    this.bubble.renderOrder = 5;
    this.bubble.scale.setScalar(0.75);
    this.bubble.position.y = 2.2;
    this.root.add(this.bubble);

    this.slot = slot; // arabayla geldiyse otopark yeri
    if (waitAt) {
      this.position.set(waitAt[0], 0, waitAt[1]);
    } else if (slot) {
      this.position.set(slot.x + 1.2, 0, slot.z);
    } else {
      const sx = entry[0] + (Math.random() - 0.5) * 30;
      this.position.set(sx, 0, STREET_Z + 1 + Math.random() * 1.5);
    }
    game.scene.add(this.root);

    this.spotIndex = shelf.waiting.length;
    shelf.waiting.push(this);
    if (waitAt) {
      // Sabah kapı kuyruğu: mağaza açılınca release() ile içeri girer
      this.state = 'atDoor';
      this.heading = Math.PI;
      this.setBubble(PRODUCTS[shelf.product].emoji, qty);
    } else {
      this.release();
    }
  }

  release() {
    const shelf = this.shelf;
    this.spotIndex = Math.max(0, shelf.waiting.indexOf(this));
    const [x, z] = shelf.customerSpot(this.spotIndex);
    this.state = 'toShelf';
    const viaDoor = shelf.z < 4; // içerideki reyonlar için önce kapıdan geç
    this.goVia(viaDoor ? [[this.entry[0], this.entry[1] + 2.5]] : [], x, z, () => this.arriveAtSpot());
  }

  arriveAtSpot() {
    const [x, z] = this.shelf.customerSpot(this.spotIndex);
    if (Math.hypot(this.position.x - x, this.position.z - z) > 0.4) {
      this.goTo(x, z, () => this.arriveAtSpot()); // yoldayken sıra ilerlemiş
      return;
    }
    this.state = 'atShelf';
    this.faceTowards(this.shelf.x, this.shelf.z);
  }

  /** Sıra ilerledi: yeni yerine yürü. */
  moveToSpot(i) {
    if (this.spotIndex === i) return;
    this.spotIndex = i;
    if (this.state !== 'atShelf' && this.state !== 'toShelf') return; // kapıdaki kuyruk vb.
    if (this.state === 'toShelf' && this.path && this.path.length > 3) return; // hâlâ yolda; varınca düzelir
    const [x, z] = this.shelf.customerSpot(i);
    this.state = 'toShelf';
    this.goTo(x, z, () => this.arriveAtSpot());
  }

  /** Önce verilen ara noktalardan geçip sonra hedefe yürür. */
  goVia(points, x, z, cb) {
    const path = [];
    let from = [this.position.x, this.position.z];
    for (const p of points) {
      path.push(...this.game.nav.findPath(from[0], from[1], p[0], p[1]));
      from = p;
    }
    path.push(...this.game.nav.findPath(from[0], from[1], x, z));
    this.path = path;
    this.onArrive = cb;
  }

  setBubble(emoji, count = 0) {
    this.bubble.material.map.dispose();
    this.bubble.material.map = bubbleTexture(emoji, { count });
    this.bubble.visible = true;
  }

  update(dt) {
    if (this.state === 'atShelf') {
      // Sabır yalnızca rafta ürün yokken azalır (sırada beklemek sorun değil)
      if (this.shelf.count === 0) this.waitTimer += dt;
      this.takeTimer += dt;
      if (this.takeTimer > 0.35 && this.carrying < this.want && this.shelf.count > 0 && this.isFirstWaiting()) {
        this.takeTimer = 0;
        this.shelf.giveTo(this);
        const left = this.want - this.carrying;
        if (left > 0) this.setBubble(PRODUCTS[this.shelf.product].emoji, left);
      }
      if (this.carrying >= this.want) {
        this.leaveShelf();
      } else if (this.waitTimer > this.patience) {
        if (this.carrying > 0) this.leaveShelf();
        else this.leaveAngry();
      }
    }
    if (this.state === 'cheering') {
      this.cheerT -= dt;
      if (this.cheerT <= 0) {
        this.busyAnim = false;
        this.walkOut();
      }
    }
    if (this.state === 'inQueue' || this.state === 'toQueue') {
      this.queueT = (this.queueT ?? 0) + dt;
      if (this.queueT > 25 && !this.complainedQueue) {
        this.complainedQueue = true;
        this.game.rating.add(RATING.slowQueue, 'uzun kuyruk');
        this.setBubble('⏳');
      }
    }
    this.followPath(dt);
    if (this.path) this.game.dirt.maybeSpawn(this.position.x, this.position.z, dt);
    super.update(dt);
    if (this.state === 'leaving' && !this.path) this.despawn();
  }

  isFirstWaiting() {
    // Sadece sıranın başındaki (masanın önündeki) kişi alır
    return this.spotIndex === 0 && this.shelf.waiting[0] === this;
  }

  releaseShelfSpot() {
    const i = this.shelf.waiting.indexOf(this);
    if (i >= 0) {
      this.shelf.waiting.splice(i, 1);
      this.shelf.reflow();
    }
  }

  leaveShelf() {
    this.releaseShelfSpot();
    this.bubble.visible = false;
    // Kampanya müşterilerinin bir kısmı başka bir reyondan da alışveriş yapar
    if (this.wantsExtra && !this.extraDone && this.state === 'atShelf' && this.game.day.isOpen) {
      this.extraDone = true;
      const options = this.game.shelves.filter((s) => !s.id.startsWith('campaign') && s.count > 0);
      if (options.length) {
        const shelf = options[Math.floor(Math.random() * options.length)];
        const more = 1 + Math.floor(Math.random() * 2);
        this.shelf = shelf;
        this.want = this.carrying + more;
        this.capacity = this.want;
        this.waitTimer = 0;
        shelf.waiting.push(this);
        this.setBubble(PRODUCTS[shelf.product].emoji, more);
        this.release();
        return;
      }
    }
    if (this.thief) {
      this.escape();
      return;
    }
    const co = this.game.pickCheckout(this);
    this.checkout = co;
    this.state = 'toQueue';
    const idx = co.join(this);
    const [qx, qz] = co.queueSpot(idx);
    this.goTo(qx, qz, () => this.arrivedInQueue());
  }

  arrivedInQueue() {
    this.state = 'inQueue';
    this.faceTowards(this.checkout.x, this.position.z - 0.001);
    this.heading = -Math.PI / 2; // tezgaha (−x) bak
    this.readyToPay = this.checkout.queue[0] === this;
    if (this.readyToPay && !this.checkout.cashiers.length) this.setBubble('💳');
  }

  moveInQueue(i) {
    const [qx, qz] = this.checkout.queueSpot(i);
    this.readyToPay = false;
    if (this.state === 'inQueue' || this.state === 'toQueue') {
      this.state = 'toQueue';
      this.goTo(qx, qz, () => this.arrivedInQueue());
    }
  }

  paid() {
    this.readyToPay = false;
    this.state = 'cheering'; // kısa bir sevinçten sonra çıkışa yürür
    this.cheerT = 0.7;
    this.setBubble('😊');
    this.play('Cheer');
    this.busyAnim = true;
  }

  /** Hırsız: ödemeden kapıya koşar. */
  escape() {
    this.state = 'escaping';
    this.speed *= 1.45;
    this.setBubble('🏃');
    const door = this.game.nearestDoor(this.position.x);
    const tx = door[0] + (Math.random() < 0.5 ? -18 : 18);
    this.goVia([[door[0], door[1] - 1], [door[0], door[1] + 2.5]], tx, STREET_Z + 2, () => this.escaped());
  }

  /** Güvenlik ya da oyuncu yakaladı: kasalar rafa döner. */
  caught() {
    if (this.state !== 'escaping') return;
    for (const e of this.stack.splice(0)) {
      const shelf = this.game.shelves.find((s) => s.product === e.product);
      if (shelf && shelf.space > 0) {
        shelf.incoming++;
        this.game.fx.fly(e.mesh, shelf.top, shelf.slot(shelf.stock.length + shelf.incoming - 1), {
          duration: 0.5, arc: 2,
          onDone: (m) => { shelf.incoming--; shelf.stock.push(m); shelf.relayout(); },
        });
      } else {
        e.mesh.removeFromParent();
        const pal = this.game.depot.pallets.get(e.product);
        if (pal && pal.space > 0) { pal.stock++; pal.syncVisual(); }
      }
    }
    this.thief = false;
    this.speed /= 1.45;
    this.setBubble('😳');
    this.game.rating.add(THEFT.caught);
    this.game.hud.toast('👮 Hırsız yakalandı!');
    this.game.audio.play('unlock', 0.6);
    this.walkOut();
  }

  escaped() {
    const n = this.stack.length;
    for (const e of this.stack.splice(0)) e.mesh.removeFromParent();
    this.game.day.today.stolen = (this.game.day.today.stolen ?? 0) + n;
    this.game.rating.add(THEFT.escaped, 'hırsızlık');
    this.game.hud.toast(`🦹 Hırsız ${n} kasa çaldı!`);
    this.state = 'leaving';
  }

  /** Kapanışta: ürünleri bırakıp sessizce çıkar. */
  leaveQuietly() {
    this.releaseShelfSpot();
    if (this.checkout) {
      const i = this.checkout.queue.indexOf(this);
      if (i >= 0) {
        this.checkout.queue.splice(i, 1);
        this.checkout.queue.forEach((c, k) => c.moveInQueue(k));
      }
    }
    for (const e of this.stack.splice(0)) e.mesh.removeFromParent();
    this.readyToPay = false;
    this.bubble.visible = false;
    this.walkOut();
  }

  leaveAngry() {
    this.game.day.today.angry++;
    if (this.campaign) {
      const t = this.game.day.today;
      t.campaignUnhappy = (t.campaignUnhappy ?? 0) + 1;
      t.campaignUnhappyBy ??= {};
      t.campaignUnhappyBy[this.shelf.product] = (t.campaignUnhappyBy[this.shelf.product] ?? 0) + 1;
      this.game.rating.add(RATING.angry / 6, 'kampanya stoğu yetmedi');
    } else {
      this.game.rating.add(RATING.angry, 'ürün bulamayan müşteri');
    }
    this.releaseShelfSpot();
    this.setBubble('😠');
    this.state = 'leaving';
    this.walkOut();
  }

  walkOut() {
    this.state = 'leaving';
    const door = this.game.nearestDoor(this.position.x);
    if (this.slot) {
      const slot = this.slot;
      this.goVia([[door[0], door[1] - 1], [door[0], door[1] + 2.5]], slot.x + 1.2, slot.z, () => {
        this.game.traffic.lot.depart(slot);
      });
      return;
    }
    const tx = door[0] + (Math.random() - 0.5) * 30;
    this.goVia([[door[0], door[1] - 1], [door[0], door[1] + 2.5]], tx, STREET_Z + 2, null);
  }

  despawn() {
    if (this.removed) return;
    this.removed = true;
    this.game.scene.remove(this.root);
    this.bubble.material.map.dispose();
    this.game.removeCustomer(this);
  }
}

// ---- Kasiyer ----------------------------------------------------------------------

export class Cashier extends Character {
  constructor(game, checkout) {
    // Boş olan yeri al (ilk kasiyer ayrılırsa yeni gelen onun yerine geçer)
    const second = checkout.cashiers.some((c) => !c.second);
    super(game, second ? 'Rogue' : 'Mage', { speed: WORKER_SPEED, look: 'uniform' });
    // İkinci kasiyer tezgahın diğer ucunda durur, ödemeler iki kat hızlı alınır
    this.position.set(checkout.cashierSpot[0], 0, checkout.cashierSpot[1] + (second ? -1.5 : 0));
    this.heading = -Math.PI / 2;
    this.root.rotation.y = this.heading;
    this.root.add(workerBadge('💳'));
    game.scene.add(this.root);
    this.second = second;
    checkout.cashiers.push(this);
    checkout.zone.visible = false;
  }
}

// ---- Taşıyıcı işçi -----------------------------------------------------------------
// Depodan ürün alıp en boş rafa taşır. Ürün parası oyuncunun kasasından ödenir.

export class Stocker extends Character {
  constructor(game, x, z) {
    super(game, 'Knight', { speed: WORKER_SPEED, capacity: WORKER_CAPACITY, look: 'uniform' });
    this.position.set(x, 0, z);
    this.home = [x, z];
    this.root.add(workerBadge('📦'));
    game.scene.add(this.root);
    this.state = 'idle';
    this.target = null;
    this.timer = 0;
  }

  update(dt) {
    this.timer += dt;
    switch (this.state) {
      case 'idle':
        if (this.timer > 0.8) {
          this.timer = 0;
          this.pickJob();
        }
        break;
      case 'buying': {
        if (this.timer < 0.22) break;
        const need = Math.min(this.capacity, this.target.shelf.space);
        if (this.carrying < need && this.target.supply.giveTo(this)) {
          this.timer = 0;
        } else if (this.carrying > 0) {
          this.state = 'delivering';
          const [x, z] = this.deliverSpot(this.target.shelf);
          this.goTo(x, z, () => {
            this.state = 'unloading';
            this.timer = 0;
            this.faceTowards(this.target.shelf.x, this.target.shelf.z);
          });
        } else if (this.timer > 3) {
          this.finishJob(); // depoda kalmadı ya da raf doldu
        }
        break;
      }
      case 'unloading':
        if (this.timer > 0.2) {
          this.timer = 0;
          if (!this.target.shelf.receiveFrom(this)) this.finishJob();
        }
        break;
    }
    this.followPath(dt);
    super.update(dt);
  }

  deliverSpot(shelf) {
    // Rafın arka tarafı (müşterilerle çakışmasın)
    return [shelf.x, shelf.z - 1.6];
  }

  /**
   * İş seçimi: en acil (en boş) reyon. Kampanya standları biraz öncelikli ama aynı standa
   * çalışan her taşıyıcı onu daha az çekici yapar; böylece işçiler normal reyonları da doldurur.
   */
  pickJob() {
    const g = this.game;
    let best = null;
    let bestScore = Infinity;
    // Kampanya standlarına en fazla taşıyıcıların yarısı gider; diğerleri normal reyonlara bakar
    const stockers = g.workers.filter((w) => w instanceof Stocker);
    const onStands = stockers.filter((w) => w !== this && w.target?.shelf.id.startsWith('campaign')).length;
    const standCap = Math.max(1, Math.ceil(stockers.length / 2));
    // Normal reyonlarda iş yoksa (hepsi yeterince dolu) sınır kalkar: kimse boşta durmasın
    const regularNeed = g.shelves.some((s) => !s.id.startsWith('campaign') && !s.reservedBy && s.space > 0
      && s.count / s.capacity <= 0.6 && g.depot.pallets.get(s.product)?.stock > 0);
    for (const s of g.shelves) {
      if (s.space <= 0) continue;
      if (!(g.depot.pallets.get(s.product)?.stock > 0)) continue;
      const fill = s.count / s.capacity;
      const isStand = s.id.startsWith('campaign');
      let score;
      if (isStand) {
        if (onStands >= standCap && regularNeed) continue;
        const crew = g.workers.filter((w) => w !== this && w.target?.shelf === s).length;
        score = fill - 0.05 + crew * 0.45;
      } else {
        if (s.reservedBy) continue;
        if (fill > 0.6) continue; // yeterince dolu
        score = fill;
      }
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    }
    if (!best || bestScore > 0.85) {
      this.wanderHome();
      return;
    }
    if (!best.id.startsWith('campaign')) best.reservedBy = this;
    this.startJob(best);
  }

  startJob(shelf) {
    const supply = this.game.depot.pallets.get(shelf.product);
    this.target = { shelf, supply };
    this.state = 'toSupply';
    const [x, z] = supply.standSpot;
    this.goTo(x, z, () => {
      this.state = 'buying';
      this.timer = 0;
      this.faceTowards(supply.x, supply.z);
    });
  }

  finishJob() {
    if (this.target && this.target.shelf.reservedBy === this) this.target.shelf.reservedBy = null;
    // Elde kalan olursa (raf dolduysa) depodaki paletine geri sayılır
    for (const e of this.stack.splice(0)) {
      e.mesh.removeFromParent();
      const pal = this.game.depot.pallets.get(e.product);
      if (pal && pal.stock < pal.capacity) {
        pal.stock++;
        pal.syncVisual();
      }
    }
    this.target = null;
    this.state = 'idle';
    this.timer = 0;
  }

  wanderHome() {
    const d = Math.hypot(this.position.x - this.home[0], this.position.z - this.home[1]);
    if (d > 0.5 && !this.path) this.goTo(this.home[0], this.home[1]);
  }
}

// ---- Temizlikçi ----------------------------------------------------------------------

export class Cleaner extends Character {
  constructor(game, x, z) {
    super(game, 'Rogue_Hooded', { speed: WORKER_SPEED * 0.9, look: 'uniform' });
    this.position.set(x, 0, z);
    this.home = [x, z];
    this.root.add(workerBadge('🧹'));
    game.scene.add(this.root);
    this.state = 'idle';
    this.spot = null;
    this.timer = 0;
  }

  update(dt) {
    this.timer += dt;
    if (this.state === 'idle' && this.timer > 0.5) {
      this.timer = 0;
      const spot = this.game.dirt.nearest(this.position.x, this.position.z, Infinity, (s) => !s.claimedBy);
      if (spot) {
        spot.claimedBy = this;
        this.spot = spot;
        this.state = 'going';
        this.goTo(spot.x, spot.z, () => { this.state = 'cleaning'; });
      } else {
        const d = Math.hypot(this.position.x - this.home[0], this.position.z - this.home[1]);
        if (d > 0.5 && !this.path) this.goTo(this.home[0], this.home[1]);
      }
    } else if (this.state === 'cleaning') {
      this.busyAnim = true;
      this.play('Interact');
      if (!this.game.dirt.spots.includes(this.spot) || this.game.dirt.scrub(this.spot, dt, 0.75)) {
        this.busyAnim = false;
        this.spot = null;
        this.state = 'idle';
      }
    } else if (this.state === 'going' && !this.game.dirt.spots.includes(this.spot)) {
      // oyuncu önce temizledi
      this.stop();
      this.spot = null;
      this.state = 'idle';
    }
    this.followPath(dt);
    super.update(dt);
  }
}

// ---- Müdür: kasalarda biriken paraları toplar ----------------------------------------------

export class Manager extends Character {
  constructor(game, x, z) {
    super(game, 'Knight', { speed: WORKER_SPEED * 1.1, look: 'uniform', cap: 'red' });
    this.position.set(x, 0, z);
    this.home = [x, z];
    this.root.add(workerBadge('💼'));
    game.scene.add(this.root);
    this.state = 'idle';
    this.timer = 0;
  }

  update(dt) {
    this.timer += dt;
    if (this.state === 'idle' && this.timer > 1) {
      this.timer = 0;
      const piles = this.game.checkouts.map((c) => c.cash).filter((c) => c.value >= 15);
      piles.sort((a, b) => b.value - a.value);
      const pile = piles[0];
      if (pile) {
        this.state = 'going';
        this.goTo(pile.x + 1.1, pile.z + 0.4, () => {
          pile.collect(this);
          this.state = 'idle';
        });
      } else {
        const d = Math.hypot(this.position.x - this.home[0], this.position.z - this.home[1]);
        if (d > 0.5 && !this.path) this.goTo(this.home[0], this.home[1]);
      }
    }
    this.followPath(dt);
    super.update(dt);
  }
}

// ---- Güvenlik görevlisi: kapıdan kaçan hırsızı yakalar --------------------------------------

export class Guard extends Character {
  constructor(game, x, z) {
    super(game, 'Knight', { speed: WORKER_SPEED, look: 'uniform' });
    this.position.set(x, 0, z);
    this.home = [x, z];
    this.heading = -Math.PI / 2;
    this.root.rotation.y = this.heading;
    this.root.add(workerBadge('👮'));
    game.scene.add(this.root);
    this.catchT = 0;
  }

  update(dt) {
    for (const c of this.game.customers) {
      if (c.state !== 'escaping') continue;
      const d = Math.hypot(c.position.x - this.position.x, c.position.z - this.position.z);
      if (d < THEFT.catchRadius) {
        this.faceTowards(c.position.x, c.position.z);
        c.caught();
        this.catchT = 0.8;
        this.play('Interact');
        this.busyAnim = true;
      }
    }
    if (this.catchT > 0) {
      this.catchT -= dt;
      if (this.catchT <= 0) this.busyAnim = false;
    }
    super.update(dt);
  }
}

// ---- Reklam görevlisi: kaldırımda tabela sallar, daha çok müşteri gelir ------------------------

export class Advertiser extends Character {
  constructor(game, x, z) {
    super(game, 'Rogue', { speed: 2, look: 'uniform' });
    this.position.set(x, 0, z);
    this.heading = 0;
    this.root.add(workerBadge('📣'));
    // Tabela
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#d6372b';
    ctx.font = 'bold 54px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('İNDİRİM', 128, 48);
    ctx.font = 'bold 34px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#23302a';
    ctx.fillText('taze ürünler →', 128, 100);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.06), [
      new THREE.MeshStandardMaterial({ color: 0xc89b62 }), new THREE.MeshStandardMaterial({ color: 0xc89b62 }),
      new THREE.MeshStandardMaterial({ color: 0xc89b62 }), new THREE.MeshStandardMaterial({ color: 0xc89b62 }),
      new THREE.MeshStandardMaterial({ map: tex }), new THREE.MeshStandardMaterial({ map: tex }),
    ]);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6), new THREE.MeshStandardMaterial({ color: 0x8a5a3b }));
    this.sign = new THREE.Group();
    pole.position.y = 0.8;
    board.position.y = 1.75;
    board.castShadow = true;
    this.sign.add(pole, board);
    this.sign.position.set(0.55, 0.6, 0.15);
    this.root.add(this.sign);
    game.scene.add(this.root);
    this.t = Math.random() * 10;
  }

  update(dt) {
    this.t += dt;
    // Tabelayı salla, ara sıra sevin
    this.sign.rotation.z = Math.sin(this.t * 3) * 0.25;
    const cheer = this.t % 6 < 1.6;
    this.busyAnim = cheer;
    if (cheer) this.play('Cheer');
    super.update(dt);
  }
}

// ---- Otopark görevlisi: girişte arabaları yönlendirir, karışıklığı önler -------------------------

export class Valet extends Character {
  constructor(game, x, z) {
    super(game, 'Rogue', { speed: 2, look: 'uniform' });
    this.position.set(x, 0, z);
    this.heading = Math.PI / 2;
    this.root.rotation.y = this.heading;
    this.root.add(workerBadge('🦺'));
    // Turuncu yön çubuğu
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0x662200 }));
    stick.position.set(0.45, 1.3, 0.2);
    stick.rotation.z = 0.6;
    this.stick = stick;
    this.root.add(stick);
    game.scene.add(this.root);
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    this.stick.rotation.z = 0.6 + Math.sin(this.t * 4) * 0.5;
    super.update(dt);
  }
}
