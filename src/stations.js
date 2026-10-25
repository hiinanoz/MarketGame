import * as THREE from 'three';
import { prop } from './assets.js';
import { makeCrate, CRATE_HEIGHT } from './character.js';
import { PRODUCTS, SHELF_STAGES } from './config.js';
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

export const QUEUE_COLS = 5;
export const QUEUE_ROWS = 5;
export const QUEUE_DX = 1.25;
export const QUEUE_DZ = 1.1;

// ---- Reyon (ürün masası) --------------------------------------------------------
// Aşama 0: 2x2 masa (8 kasa). Aşama 1-2: 3x2 geniş masa (16 / 24 kasa).

export class Shelf {
  constructor(game, def) {
    this.game = game;
    this.id = def.id;
    this.product = def.product;
    this.x = def.pos[0];
    this.z = def.pos[1];
    this.stage = 0;
    this.stock = []; // kasa mesh'leri
    this.incoming = 0;
    this.reservedBy = null; // bir taşıyıcı işçi bu rafa çalışıyorsa

    this.root = new THREE.Group();
    this.root.position.set(this.x, 0, this.z);
    this.top = new THREE.Group();
    this.top.position.y = 1.0;
    this.root.add(this.top);
    this.sign = emojiSign(PRODUCTS[this.product].emoji, 0.85);
    this.root.add(this.sign);
    game.scene.add(this.root);
    this.waiting = []; // önünde bekleyen müşteriler
    this.buildTable();
  }

  get capacity() {
    return SHELF_STAGES[this.stage];
  }

  get wide() {
    return this.stage > 0;
  }

  buildTable() {
    if (this.table) this.root.remove(this.table);
    if (this.zone) this.root.remove(this.zone);
    this.table = prop(this.wide ? 'kitchentable_B_large' : 'kitchentable_B');
    this.root.add(this.table);
    const w = this.wide ? 4.4 : 3.4;
    const c = padCanvas(this.wide ? 330 : 256, 256);
    drawZone(c.getContext('2d'), c.width, 256, { color: 'rgba(255,255,255,0.75)', fill: 'rgba(255,255,255,0.12)' });
    this.zone = flatPlane([w, 3.4], new THREE.CanvasTexture(c));
    this.root.add(this.zone);
    const layers = Math.ceil(this.capacity / this.perLayer);
    this.sign.position.set(0, 1.9 + layers * CRATE_HEIGHT * 0.9, 0);
    const hw = this.wide ? 1.5 : 1;
    this.game.nav.setBox(`shelf-${this.id}`, { minX: this.x - hw, maxX: this.x + hw, minZ: this.z - 1, maxZ: this.z + 1 });
    this.relayout();
  }

  /** Kapasite yükseltmesi. */
  setStage(stage) {
    this.stage = Math.min(stage, SHELF_STAGES.length - 1);
    this.buildTable();
  }

  get perLayer() {
    return this.wide ? 6 : 4;
  }

  get count() {
    return this.stock.length;
  }

  get space() {
    return this.capacity - this.stock.length - this.incoming;
  }

  slot(i) {
    const per = this.perLayer;
    const layer = Math.floor(i / per);
    const k = i % per;
    if (this.wide) {
      return new THREE.Vector3(((k % 3) - 1) * 0.9, layer * CRATE_HEIGHT, (k < 3 ? -0.45 : 0.45));
    }
    return new THREE.Vector3((k % 2 ? 0.45 : -0.45), layer * CRATE_HEIGHT, (k < 2 ? -0.45 : 0.45));
  }

  playerInRange(p) {
    return inZone(p, this.x, this.z, this.wide ? 2.2 : 1.75, 1.75);
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

  /**
   * Sıradaki yer. 0 = ürünü alan kişi (masanın önü), diğerleri arkasında sıra bekler.
   * Kampanya standının önünde zikzak kuyruk alanı var; normal reyonlarda kısa sıra.
   */
  customerSpot(index) {
    const front = [this.x, this.z + 1.7];
    if (index === 0) return front;
    if (this.id.startsWith('campaign')) {
      // Zikzak kuyruk: 5 sıra × 5 kişi, sıralar arasında bariyer ipi
      const k = Math.min(index - 1, QUEUE_COLS * QUEUE_ROWS - 1);
      const row = Math.floor(k / QUEUE_COLS);
      const col = k % QUEUE_COLS;
      const half = ((QUEUE_COLS - 1) * QUEUE_DX) / 2;
      const x = row % 2 === 0 ? this.x - half + col * QUEUE_DX : this.x + half - col * QUEUE_DX;
      return [x, this.z + 2.9 + row * QUEUE_DZ];
    }
    const line = [[0, 2.55], [0, 3.4], [-0.95, 1.9], [0.95, 1.9], [-0.95, 2.8], [0.95, 2.8]];
    const o = line[Math.min(index - 1, line.length - 1)];
    return [this.x + o[0], this.z + o[1]];
  }

  /** Biri sıradan çıkınca arkadakiler bir adım ilerler. */
  reflow() {
    this.waiting.forEach((c, i) => c.moveToSpot(i));
  }

  /** Kapasite yükseltme alanının konumu (masanın arkası). */
  get stagePadPos() {
    return [this.x, this.z - 2.6];
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

// ---- Depo paleti ---------------------------------------------------------------------
// Siparişle gelen kasalar burada durur. Oyuncu/işçi paletin önündeki alandan alır (ödenmiş mal).

let palletGeo, palletMat;
const VISIBLE_PER_PALLET = 20;

export class Pallet {
  constructor(game, product, x, z) {
    this.game = game;
    this.product = product;
    this.x = x;
    this.z = z;
    this.stock = 0;
    this.crates = [];

    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    if (!palletGeo) {
      palletGeo = new THREE.BoxGeometry(2.1, 0.18, 2.1);
      palletMat = new THREE.MeshStandardMaterial({ color: 0xc89b62, roughness: 0.9 });
    }
    const base = new THREE.Mesh(palletGeo, palletMat);
    base.position.y = 0.09;
    base.receiveShadow = true;
    base.castShadow = true;
    this.root.add(base);
    this.stackRoot = new THREE.Group();
    this.stackRoot.position.y = 0.18;
    this.root.add(this.stackRoot);

    this.canvas = padCanvas(256, 256);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const zone = flatPlane([2.4, 2.4], this.tex);
    zone.position.z = 1.9;
    this.root.add(zone);
    this.zoneZ = z + 1.9;

    game.scene.add(this.root);
    game.nav.setBox(`pallet-${product}`, { minX: x - 1.1, maxX: x + 1.1, minZ: z - 1.1, maxZ: z + 1.1 });
    this.redraw();
  }

  get capacity() {
    return this.customCapacity ?? this.game.depot.palletCapacity;
  }

  get space() {
    return this.capacity - this.stock;
  }

  slot(i) {
    const layer = Math.floor(i / 4);
    const k = i % 4;
    return new THREE.Vector3((k % 2 ? 0.46 : -0.46), layer * CRATE_HEIGHT, (k < 2 ? -0.46 : 0.46));
  }

  redraw() {
    const ctx = this.canvas.getContext('2d');
    const empty = this.stock === 0;
    drawZone(ctx, 256, 256, empty
      ? { color: '#ff8a7a', fill: 'rgba(255,90,70,0.35)' }
      : { color: '#ffb703', fill: 'rgba(255,183,3,0.42)' });
    ctx.font = '76px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PRODUCTS[this.product].emoji, 128, 100);
    ctx.font = 'bold 48px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 8;
    const txt = `${this.stock}/${this.capacity}`;
    ctx.strokeText(txt, 128, 186);
    ctx.fillText(txt, 128, 186);
    this.tex.needsUpdate = true;
  }

  /** Görünen kasa sayısını stokla eşitle. */
  syncVisual() {
    const want = Math.min(this.stock, VISIBLE_PER_PALLET);
    while (this.crates.length < want) {
      const m = makeCrate(this.product);
      m.position.copy(this.slot(this.crates.length));
      this.stackRoot.add(m);
      this.crates.push(m);
    }
    while (this.crates.length > want) this.stackRoot.remove(this.crates.pop());
    this.redraw();
  }

  /** Kamyondan gelen kasa (uçarak gelir). */
  deliver(fromWorld) {
    if (this.stock >= this.capacity) return false;
    this.stock++;
    if (this.crates.length < VISIBLE_PER_PALLET) {
      const m = makeCrate(this.product);
      m.position.copy(fromWorld);
      this.game.scene.add(m);
      const idx = this.crates.length;
      this.crates.push(m);
      this.game.fx.fly(m, this.stackRoot, this.slot(idx), { duration: 0.45, arc: 3 });
    }
    this.redraw();
    return true;
  }

  inRange(p) {
    return inZone(p, this.x, this.zoneZ, 1.25, 1.25);
  }

  get standSpot() {
    return [this.x, this.zoneZ];
  }

  /** Karakterin yığınına bir kasa verir. */
  giveTo(char) {
    if (char.full || this.stock <= 0) return false;
    this.stock--;
    let mesh;
    if (this.crates.length > this.stock && this.crates.length) {
      mesh = this.crates.pop();
    } else {
      mesh = makeCrate(this.product);
      mesh.position.set(0, 1, 0);
      this.stackRoot.add(mesh);
    }
    char.receive(mesh, this.product);
    // Görünmeyen stok varsa yığını yeniden doldur
    if (this.stock >= VISIBLE_PER_PALLET && this.crates.length < VISIBLE_PER_PALLET) this.syncVisual();
    this.redraw();
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
    this.cashiers = []; // işe alınmış kasiyerler (en fazla 2)
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
    const playerHere = this.game.player && this.playerServing(this.game.player.position);
    const serving = this.cashiers.length > 0 || playerHere;
    const front = this.queue[0];
    if (!front || !front.readyToPay || !serving) {
      this.timer = 0;
      return;
    }
    this.timer += dt;
    // Kasiyer başına 0.45 sn; iki kasiyer iki kat hızlı, oyuncu da yardım ederse daha da hızlı
    let rate = this.cashiers.length / 0.45 + (playerHere ? 1 / 0.3 : 0);
    const interval = 1 / rate;
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
      this.game.campaign.onSold(e.product);
      this.game.day.today.crates++;
      return;
    }
    // Ödeme bitti
    this.queue.shift();
    front.paid();
    this.game.onCustomerPaid();
    this.queue.forEach((c, i) => c.moveInQueue(i));
  }
}

// ---- Satın alma alanı ---------------------------------------------------------------

export class UnlockPad {
  constructor(game, def, x, z, { title, emoji, size = 2.6 }) {
    this.game = game;
    this.def = def;
    this.locked = false; // seviye yetmiyorsa gri görünür, ödeme alınmaz
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
    this.mesh = flatPlane([size, size], this.tex);
    this.half = size / 2;
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
    ctx.fillStyle = this.locked ? 'rgba(40,40,40,0.35)' : 'rgba(30,60,40,0.55)';
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
    ctx.strokeStyle = this.locked ? 'rgba(255,255,255,0.45)' : '#ffffff';
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
    ctx.fillStyle = this.locked ? '#e6e6e6' : '#ffe066';
    ctx.fillText(this.locked ? `🔒 Sv.${this.def.level}` : `$${Math.ceil(this.remaining)}`, w / 2, 202);
    this.tex.needsUpdate = true;
  }

  playerInRange(p) {
    return inZone(p, this.x, this.z, this.half, this.half);
  }

  setLocked(locked) {
    if (this.locked === locked) return;
    this.locked = locked;
    this.mesh.material.opacity = locked ? 0.7 : 1;
    this.redraw();
  }

  /** Oyuncu üzerindeyken para akıtır. Tamamlanınca true döner. */
  update(dt, player) {
    const pulse = this.locked ? 1 : 1 + Math.sin(performance.now() / 260) * 0.03;
    this.mesh.scale.set(pulse, pulse, 1);
    if (this.locked || !this.playerInRange(player.position) || this.game.money <= 0) {
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
