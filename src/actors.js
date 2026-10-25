import * as THREE from 'three';
import { Character } from './character.js';
import { bubbleTexture } from './fx.js';
import { PRODUCTS, CUSTOMER_SPEED, WORKER_SPEED, WORKER_CAPACITY, STREET_Z, RATING } from './config.js';

/** İşçilerin başının üstündeki küçük rozet (müşterilerden ayırt etmek için). */
function workerBadge(emoji) {
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
  constructor(game, modelName, shelf, qty, entry) {
    super(game, modelName, { speed: CUSTOMER_SPEED * (0.9 + Math.random() * 0.25), capacity: qty });
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

    const sx = entry[0] + (Math.random() - 0.5) * 30;
    this.position.set(sx, 0, STREET_Z + 1 + Math.random() * 1.5);
    game.scene.add(this.root);

    this.spotIndex = shelf.waiting.length;
    shelf.waiting.push(this);
    const [x, z] = shelf.customerSpot(this.spotIndex);
    this.goVia([[entry[0], entry[1] + 2.5]], x, z, () => {
      this.state = 'atShelf';
      this.faceTowards(shelf.x, shelf.z);
    });
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
      this.waitTimer += dt;
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
    // Raftaki sırada önde olan alır (aynı anda iki kişi aynı kasaya uzanmasın)
    return this.shelf.waiting.find((c) => c.state === 'atShelf' && c.carrying < c.want) === this;
  }

  releaseShelfSpot() {
    const i = this.shelf.waiting.indexOf(this);
    if (i >= 0) this.shelf.waiting.splice(i, 1);
  }

  leaveShelf() {
    this.releaseShelfSpot();
    this.bubble.visible = false;
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
    if (this.readyToPay && !this.checkout.cashier) this.setBubble('💳');
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
    this.state = 'leaving';
    this.setBubble('😊');
    this.play('Cheer');
    this.busyAnim = true;
    setTimeout(() => {
      this.busyAnim = false;
      this.walkOut();
    }, 700);
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
    this.game.rating.add(RATING.angry, 'ürün bulamayan müşteri');
    this.releaseShelfSpot();
    this.setBubble('😠');
    this.state = 'leaving';
    this.walkOut();
  }

  walkOut() {
    this.state = 'leaving';
    const door = this.game.nearestDoor(this.position.x);
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
    super(game, 'Mage', { speed: WORKER_SPEED });
    this.position.set(checkout.cashierSpot[0], 0, checkout.cashierSpot[1]);
    this.heading = -Math.PI / 2;
    this.root.rotation.y = this.heading;
    this.root.add(workerBadge('💳'));
    game.scene.add(this.root);
    checkout.cashier = this;
    checkout.zone.visible = false;
  }
}

// ---- Taşıyıcı işçi -----------------------------------------------------------------
// Depodan ürün alıp en boş rafa taşır. Ürün parası oyuncunun kasasından ödenir.

export class Stocker extends Character {
  constructor(game, x, z) {
    super(game, 'Knight', { speed: WORKER_SPEED, capacity: WORKER_CAPACITY });
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

  pickJob() {
    // Depoda stoğu olan, boşalmakta olan bir reyon seç
    const shelves = this.game.shelves.filter((s) => !s.reservedBy && s.space > 0 && this.game.depot.pallets.get(s.product)?.stock > 0);
    if (!shelves.length) {
      this.wanderHome();
      return;
    }
    shelves.sort((a, b) => a.count / a.capacity - b.count / b.capacity);
    const shelf = shelves[0];
    if (shelf.count / shelf.capacity > 0.6) {
      this.wanderHome();
      return;
    }
    const supply = this.game.depot.pallets.get(shelf.product);
    shelf.reservedBy = this;
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
    if (this.target) this.target.shelf.reservedBy = null;
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
    super(game, 'Rogue_Hooded', { speed: WORKER_SPEED * 0.9 });
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
    super(game, 'Knight', { speed: WORKER_SPEED * 1.1 });
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
