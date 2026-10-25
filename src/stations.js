import * as THREE from 'three';
import { prop } from './assets.js';
import { makeCrate, CRATE_HEIGHT } from './character.js';
import { PRODUCTS, SHELF_CAPACITY } from './config.js';
import { makeBill, textTexture } from './fx.js';

// ---- Zemin işaretleri --------------------------------------------------------

function padCanvas(w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function drawZone(ctx, w, h, { color = '#ffffff', fill = 'rgba(255,255,255,0.18)', dash = true }) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = fill;
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  if (dash) ctx.setLineDash([26, 16]);
  ctx.beginPath();
  ctx.roundRect(10, 10, w - 20, h - 20, 34);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
}

function flatPlane(size, tex) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  m.renderOrder = 1;
  return m;
}

function emojiSign(emoji, size = 0.9) {
  const c = padCanvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.stroke();
  ctx.font = '70px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  s.scale.setScalar(size);
  return s;
}

const inZone = (p, x, z, hw, hd) => Math.abs(p.x - x) < hw && Math.abs(p.z - z) < hd;

// ---- Reyon (ürün masası) --------------------------------------------------------

export class Shelf {
  constructor(game, def) {
    this.game = game;
    this.id = def.id;
    this.product = def.product;
    this.x = def.pos[0];
    this.z = def.pos[1];
    this.capacity = SHELF_CAPACITY;
    this.stock = []; // kasa mesh'leri
    this.incoming = 0;
    this.reservedBy = null; // bir taşıyıcı işçi bu rafa çalışıyorsa

    this.root = new THREE.Group();
    this.root.position.set(this.x, 0, this.z);
    const table = prop('kitchentable_B');
    this.root.add(table);
    this.top = new THREE.Group();
    this.top.position.y = 1.0;
    this.root.add(this.top);
    const sign = emojiSign(PRODUCTS[this.product].emoji, 0.85);
    sign.position.set(0, 2.55, 0);
    this.root.add(sign);
    this.sign = sign;

    // Oyuncunun bırakma alanı (masanın çevresi)
    const c = padCanvas(256, 256);
    drawZone(c.getContext('2d'), 256, 256, { color: 'rgba(255,255,255,0.75)', fill: 'rgba(255,255,255,0.12)' });
    const tex = new THREE.CanvasTexture(c);
    const zone = flatPlane([3.4, 3.4], tex);
    this.root.add(zone);

    game.scene.add(this.root);
    game.nav.setBox(`shelf-${this.id}`, { minX: this.x - 1, maxX: this.x + 1, minZ: this.z - 1, maxZ: this.z + 1 });
    this.waiting = []; // önünde bekleyen müşteriler
  }

  get count() {
    return this.stock.length;
  }

  get space() {
    return this.capacity - this.stock.length - this.incoming;
  }

  slot(i) {
    const layer = Math.floor(i / 4);
    const k = i % 4;
    return new THREE.Vector3((k % 2 ? 0.45 : -0.45), layer * CRATE_HEIGHT, (k < 2 ? -0.45 : 0.45));
  }

  playerInRange(p) {
    return inZone(p, this.x, this.z, 1.75, 1.75);
  }

  /** Bir karakterin yığınından kasa alır (oyuncu ya da işçi). */
  receiveFrom(char) {
    if (this.space <= 0) return false;
    const e = char.take(this.product);
    if (!e) return false;
    this.incoming++;
    const index = this.stock.length + this.incoming - 1;
    this.game.fx.fly(e.mesh, this.top, this.slot(index), {
      duration: 0.22,
      arc: 1,
      onDone: (mesh) => {
        this.incoming--;
        this.stock.push(mesh);
        this.relayout();
      },
    });
    this.game.audio.play('drop');
    return true;
  }

  /** Müşteri bir kasa alır. */
  giveTo(char) {
    const mesh = this.stock.pop();
    if (!mesh) return false;
    char.receive(mesh, this.product);
    this.game.audio.play('pick', 0.5);
    return true;
  }

  relayout() {
    this.stock.forEach((m, i) => m.position.copy(this.slot(i)));
  }

  customerSpot(index) {
    const offsets = [[0, 1.7], [-0.75, 1.7], [0.75, 1.7], [0, 2.6], [-0.9, 2.6], [0.9, 2.6]];
    const o = offsets[Math.min(index, offsets.length - 1)];
    return [this.x + o[0], this.z + o[1]];
  }

  fillStock(n) {
    for (let i = 0; i < n && this.stock.length < this.capacity; i++) {
      const m = makeCrate(this.product);
      m.position.copy(this.slot(this.stock.length));
      this.top.add(m);
      this.stock.push(m);
    }
  }
}

// ---- Depo / toptancı noktası ----------------------------------------------------

export class SupplyPoint {
  constructor(game, def) {
    this.game = game;
    this.product = def.product;
    this.x = def.supply[0];
    this.z = def.supply[1];
    const p = PRODUCTS[this.product];

    this.root = new THREE.Group();
    this.root.position.set(this.x, 0, this.z);
    // Kasa yığını (dekor)
    for (let i = 0; i < 3; i++) {
      const c = prop(p.crate);
      c.scale.setScalar(0.6);
      c.position.set(i === 2 ? 0 : (i ? 0.62 : -0.62), i === 2 ? 0.55 : 0, i === 2 ? 0 : -0.1);
      c.rotation.y = (i - 1) * 0.12;
      this.root.add(c);
    }
    // Alma alanı + fiyat yazısı
    const cv = padCanvas(256, 256);
    const ctx = cv.getContext('2d');
    drawZone(ctx, 256, 256, { color: '#ffb703', fill: 'rgba(255,183,3,0.42)' });
    ctx.font = '84px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.emoji, 128, 108);
    ctx.font = 'bold 52px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 8;
    ctx.strokeText(`$${p.cost}`, 128, 190);
    ctx.fillText(`$${p.cost}`, 128, 190);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const zone = flatPlane([2.4, 2.4], tex);
    zone.position.z = 1.9;
    this.root.add(zone);
    this.zoneZ = this.z + 1.9;

    game.scene.add(this.root);
    game.nav.setBox(`supply-${this.product}`, { minX: this.x - 1.25, maxX: this.x + 1.25, minZ: this.z - 0.8, maxZ: this.z + 0.75 });
    this.timer = 0;
  }

  inRange(p) {
    return inZone(p, this.x, this.zoneZ, 1.25, 1.25);
  }

  get standSpot() {
    return [this.x, this.zoneZ];
  }

  /** Karakterin yığınına bir kasa satın alıp gönderir. Ücret game.money'den düşer. */
  sellTo(char, { free = false } = {}) {
    const p = PRODUCTS[this.product];
    if (char.full) return false;
    if (!free && this.game.money < p.cost) return false;
    if (!free) this.game.spend(p.cost, new THREE.Vector3(this.x, 0, this.zoneZ));
    const mesh = makeCrate(this.product);
    mesh.position.set(0, 1.0, 0);
    this.root.add(mesh);
    char.receive(mesh, this.product);
    this.game.audio.play('pick');
    return true;
  }
}

// ---- Para yığını -------------------------------------------------------------------

export class CashPile {
  constructor(game, x, z) {
    this.game = game;
    this.x = x;
    this.z = z;
    this.value = 0;
    this.bills = [];
    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    game.scene.add(this.root);
  }

  slot(i) {
    const layer = Math.floor(i / 6);
    const k = i % 6;
    return new THREE.Vector3(((k % 2) - 0.5) * 0.66, 0.06 + layer * 0.11, (Math.floor(k / 2) - 1) * 0.38);
  }

  add(amount, fromWorld) {
    this.value += amount;
    const n = Math.min(Math.max(1, Math.round(amount / 5)), 4);
    for (let i = 0; i < n && this.bills.length < 60; i++) {
      const b = makeBill();
      b.position.copy(fromWorld);
      this.game.scene.add(b);
      const entry = { mesh: b };
      this.bills.push(entry);
      const idx = this.bills.length - 1;
      this.game.fx.fly(b, this.root, this.slot(idx), { duration: 0.35, arc: 1.2 });
    }
  }

  playerInRange(p) {
    return Math.hypot(p.x - this.x, p.z - this.z) < 1.7;
  }

  collect(player) {
    if (this.value <= 0) return;
    const amount = this.value;
    this.value = 0;
    const bills = this.bills.splice(0);
    bills.forEach((b, i) => {
      setTimeout(() => {
        this.game.fx.fly(b.mesh, player.root, new THREE.Vector3(0, 1.4, 0), {
          duration: 0.25,
          arc: 1.0,
          scaleTo: new THREE.Vector3(0.3, 0.3, 0.3),
          onDone: (m) => m.removeFromParent(),
        });
      }, i * 25);
    });
    this.game.earn(amount, new THREE.Vector3(this.x, 0, this.z));
  }
}

// ---- Kasa (ödeme noktası) ---------------------------------------------------------

export class Checkout {
  constructor(game, def) {
    this.game = game;
    this.id = def.id;
    this.x = def.pos[0];
    this.z = def.pos[1];
    this.cashierSpot = def.cashierSpot;
    this.queueStart = def.queueStart;
    this.queue = [];
    this.cashier = null; // işe alınmış kasiyer
    this.timer = 0;

    this.root = new THREE.Group();
    this.root.position.set(this.x, 0, this.z);
    const counter = prop('kitchencounter_straight_B');
    counter.rotation.y = Math.PI / 2;
    this.root.add(counter);
    const counter2 = prop('kitchencounter_straight_B');
    counter2.rotation.y = Math.PI / 2;
    counter2.position.z = -2;
    this.root.add(counter2);
    // Yazar kasa (basit model)
    const reg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.7), new THREE.MeshStandardMaterial({ color: 0x3c4552 }));
    body.position.y = 0.18;
    reg.add(body);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x245a6a }));
    screen.position.set(0.3, 0.55, 0);
    screen.rotation.z = -0.3;
    reg.add(screen);
    reg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    reg.position.set(0.1, 1.0, -0.4);
    this.root.add(reg);
    this.counterTop = new THREE.Group();
    this.counterTop.position.set(-0.3, 1.0, 0.45);
    this.root.add(this.counterTop);

    // Kasiyer alanı
    const cv = padCanvas(256, 256);
    const ctx = cv.getContext('2d');
    drawZone(ctx, 256, 256, { color: '#9fe3ff', fill: 'rgba(80,190,255,0.22)' });
    ctx.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💳', 128, 132);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.zone = flatPlane([1.9, 2.4], tex);
    this.zone.position.set(this.cashierSpot[0], 0.03, this.cashierSpot[1]);
    game.scene.add(this.zone);

    game.scene.add(this.root);
    game.nav.setBox(`checkout-${this.id}`, { minX: this.x - 1, maxX: this.x + 1, minZ: this.z - 3, maxZ: this.z + 1 });
    this.cash = new CashPile(game, def.cashPile[0], def.cashPile[1]);
  }

  queueSpot(i) {
    return [this.queueStart[0], this.queueStart[1] + i * 1.35];
  }

  join(customer) {
    this.queue.push(customer);
    return this.queue.length - 1;
  }

  playerServing(p) {
    return inZone(p, this.cashierSpot[0], this.cashierSpot[1], 1.0, 1.25);
  }

  update(dt) {
    const serving = this.cashier || this.game.player && this.playerServing(this.game.player.position);
    const front = this.queue[0];
    if (!front || !front.readyToPay || !serving) {
      this.timer = 0;
      return;
    }
    this.timer += dt;
    const interval = this.cashier ? 0.45 : 0.3;
    if (this.timer < interval) return;
    this.timer = 0;
    // Müşterinin kasalarını tek tek tezgaha al
    const e = front.take();
    if (e) {
      const price = PRODUCTS[e.product].price;
      this.game.fx.fly(e.mesh, this.counterTop, new THREE.Vector3(0, 0, 0), {
        duration: 0.2,
        arc: 0.6,
        onDone: (m) => {
          this.game.fx.fly(m, null, new THREE.Vector3(this.x, -1, this.z), {
            duration: 0.25, arc: 0, scaleTo: new THREE.Vector3(0.01, 0.01, 0.01),
          });
          const from = new THREE.Vector3(this.x - 0.2, 1.2, this.z);
          this.cash.add(price, from);
          this.game.audio.play('cash', 0.6);
        },
      });
      this.game.stats.sold++;
      return;
    }
    // Ödeme bitti
    this.queue.shift();
    front.paid();
    this.queue.forEach((c, i) => c.moveInQueue(i));
  }
}

// ---- Satın alma alanı ---------------------------------------------------------------

export class UnlockPad {
  constructor(game, def, x, z, { title, emoji }) {
    this.game = game;
    this.def = def;
    this.x = x;
    this.z = z;
    this.cost = def.cost;
    this.paid = 0;
    this.title = title;
    this.emoji = emoji;
    this.rate = Math.max(def.cost / 1.6, 25); // $/sn
    this.acc = 0;
    this.billTimer = 0;

    this.canvas = padCanvas(256, 256);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = flatPlane([2.6, 2.6], this.tex);
    this.mesh.position.set(x, 0.04, z);
    game.scene.add(this.mesh);
    this.label = null;
    this.redraw();
  }

  get remaining() {
    return this.cost - this.paid;
  }

  redraw() {
    const ctx = this.canvas.getContext('2d');
    const w = 256;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = 'rgba(30,60,40,0.55)';
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, w - 16, 36);
    ctx.fill();
    // ilerleme
    const frac = this.paid / this.cost;
    if (frac > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(8, 8, w - 16, w - 16, 36);
      ctx.clip();
      ctx.fillStyle = 'rgba(90,220,110,0.75)';
      ctx.fillRect(8, 8 + (w - 16) * (1 - frac), w - 16, (w - 16) * frac);
      ctx.restore();
    }
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, w - 16, 36);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '78px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText(this.emoji, w / 2, 82);
    ctx.font = 'bold 30px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(this.title, w / 2, 150, w - 30);
    ctx.font = 'bold 46px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.fillText(`$${Math.ceil(this.remaining)}`, w / 2, 202);
    this.tex.needsUpdate = true;
  }

  playerInRange(p) {
    return inZone(p, this.x, this.z, 1.3, 1.3);
  }

  /** Oyuncu üzerindeyken para akıtır. Tamamlanınca true döner. */
  update(dt, player) {
    const pulse = 1 + Math.sin(performance.now() / 260) * 0.03;
    this.mesh.scale.set(pulse, pulse, 1);
    if (!this.playerInRange(player.position) || this.game.money <= 0) {
      this.acc = 0;
      return false;
    }
    this.acc += dt * this.rate;
    const amount = Math.min(Math.floor(this.acc), this.remaining, this.game.money);
    if (amount <= 0) return false;
    this.acc -= amount;
    this.paid += amount;
    this.game.money -= amount;
    this.game.hud.setMoney(this.game.money);
    this.billTimer -= dt;
    if (this.billTimer <= 0) {
      this.billTimer = 0.06;
      const b = makeBill();
      player.root.getWorldPosition(b.position);
      b.position.y += 1.3;
      this.game.scene.add(b);
      this.game.fx.fly(b, null, new THREE.Vector3(this.x, 0.1, this.z), {
        duration: 0.25, arc: 0.8, scaleTo: new THREE.Vector3(0.4, 0.4, 0.4),
      });
      this.game.audio.play('pay', 0.25);
    }
    this.redraw();
    return this.remaining <= 0;
  }

  dispose() {
    this.game.scene.remove(this.mesh);
    this.tex.dispose();
  }
}

export { textTexture };
