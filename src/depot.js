import * as THREE from 'three';
import { Pallet, OrderKiosk } from './stations.js';
import { PRODUCTS, PALLETS, ORDER_KIOSK, DEPOT_CAPACITY, TRUCK_CAPACITY, BACK_ROAD_Z } from './config.js';

// Arka depo: ürün paletleri, sipariş noktası, sipariş paneli ve toptancı kamyonları.

const TRUCK_SPEED = 16;
const DOCK_X = 0;
const LANE_Z = BACK_ROAD_Z + 1.2;

export class Depot {
  constructor(game) {
    this.game = game;
    this.pallets = new Map();
    this.level = 0;            // 0: palet 20 kasa, 1: 40 kasa + otomatik sipariş
    this.autoOrder = false;
    this.trucks = [];
    this.kiosk = new OrderKiosk(game, ORDER_KIOSK[0], ORDER_KIOSK[1]);
    this.panel = new OrderPanel(this);
    this.autoTimer = 0;
  }

  get palletCapacity() {
    return DEPOT_CAPACITY[this.level];
  }

  upgrade() {
    this.level = 1;
    for (const p of this.pallets.values()) p.redraw();
  }

  addPallet(product) {
    if (this.pallets.has(product)) return this.pallets.get(product);
    const [x, z] = PALLETS[product];
    const p = new Pallet(this.game, product, x, z);
    this.pallets.set(product, p);
    return p;
  }

  /** Yolda olan (henüz indirilmemiş) kasa sayısı. */
  incoming(product) {
    let n = 0;
    for (const t of this.trucks) for (const c of t.cargo) if (c === product) n++;
    return n;
  }

  /** Paletin alabileceği en fazla sipariş. */
  room(product) {
    const p = this.pallets.get(product);
    return p ? Math.max(0, Math.min(p.space - this.incoming(product), this.game.supply.orderLimit(product))) : 0;
  }

  /**
   * Sipariş ver: parası hemen ödenir, kamyon gelip kasaları indirir.
   * @param {Record<string, number>} items ürün → adet
   */
  order(items, { free = false } = {}) {
    let total = 0;
    const cargo = [];
    for (const [product, n] of Object.entries(items)) {
      const qty = Math.max(0, Math.min(n, this.room(product)));
      for (let i = 0; i < qty; i++) cargo.push(product);
      total += qty * this.game.supply.costOf(product);
    }
    if (!cargo.length) return 0;
    if (!free) {
      if (this.game.money < total) return 0;
      this.game.spend(total, new THREE.Vector3(this.kiosk.x, 0, this.kiosk.z));
      for (const p of new Set(cargo)) this.game.supply.ordered(p, cargo.filter((c) => c === p).length);
    }
    // Yolda gelen kamyon varsa ona yükle, yoksa yeni kamyon
    let truck = this.trucks.find((t) => t.state === 'arriving' && t.cargo.length < TRUCK_CAPACITY);
    while (cargo.length) {
      if (!truck || truck.cargo.length >= TRUCK_CAPACITY) {
        truck = new Truck(this.game, this, this.trucks.length * -14);
        this.trucks.push(truck);
      }
      truck.cargo.push(cargo.shift());
    }
    this.game.audio.play('cash');
    return total;
  }

  update(dt) {
    for (const t of [...this.trucks]) t.update(dt);
    this.panel.update();

    // Otomatik sipariş (depo yükseltmesi): stoğu %30'un altına düşen paletleri doldur
    if (this.autoOrder && this.level > 0) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) {
        this.autoTimer = 4;
        const items = {};
        let cost = 0;
        for (const [product, p] of this.pallets) {
          if (p.stock + this.incoming(product) < p.capacity * 0.3) {
            const n = this.room(product);
            const price = this.game.supply.costOf(product);
            const afford = Math.floor((this.game.money - cost) * 0.6 / price);
            const qty = Math.min(n, afford);
            if (qty > 0) {
              items[product] = qty;
              cost += qty * price;
            }
          }
        }
        if (Object.keys(items).length) this.order(items);
      }
    }
  }

  removeTruck(t) {
    this.trucks.splice(this.trucks.indexOf(t), 1);
  }

  totalStock() {
    let n = 0;
    for (const p of this.pallets.values()) n += p.stock;
    return n;
  }

  serialize() {
    const stock = {};
    for (const [k, p] of this.pallets) stock[k] = p.stock + this.incoming(k); // yoldaki mal teslim edilmiş sayılır
    return { level: this.level, autoOrder: this.autoOrder, stock };
  }

  restore(data) {
    if (!data) return;
    if (data.level) this.upgrade();
    this.autoOrder = !!data.autoOrder;
    for (const [k, n] of Object.entries(data.stock ?? {})) {
      const p = this.pallets.get(k);
      if (!p) continue;
      p.stock = Math.min(n, p.capacity);
      p.syncVisual();
    }
  }
}

// ---- Kamyon ---------------------------------------------------------------------------

let truckParts;
function truckMesh() {
  if (!truckParts) {
    truckParts = {
      cab: new THREE.MeshStandardMaterial({ color: 0xe2483d, roughness: 0.6 }),
      box: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.7 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x9ad0ec, roughness: 0.2 }),
      stripe: new THREE.MeshStandardMaterial({ color: 0x3fae4a, roughness: 0.6 }),
    };
  }
  const m = truckParts;
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  // Araç +x yönüne bakar
  add(new THREE.BoxGeometry(5.2, 2.6, 2.4), m.box, -1.2, 1.9, 0);
  add(new THREE.BoxGeometry(5.22, 0.35, 2.42), m.stripe, -1.2, 1.3, 0);
  add(new THREE.BoxGeometry(1.8, 1.9, 2.3), m.cab, 2.4, 1.45, 0);
  add(new THREE.BoxGeometry(0.1, 0.8, 1.9), m.glass, 3.31, 1.8, 0);
  add(new THREE.BoxGeometry(7, 0.35, 2.2), m.dark, 0, 0.6, 0);
  const wheel = new THREE.CylinderGeometry(0.48, 0.48, 0.35, 12);
  for (const x of [-2.8, -1.4, 2.4]) {
    for (const z of [-1.1, 1.1]) {
      const w = add(wheel, m.dark, x, 0.48, z);
      w.rotation.x = Math.PI / 2;
    }
  }
  return g;
}

class Truck {
  constructor(game, depot, offset) {
    this.game = game;
    this.depot = depot;
    this.cargo = [];
    this.state = 'arriving';
    this.mesh = truckMesh();
    this.mesh.position.set(-80 + offset, 0, LANE_Z);
    game.scene.add(this.mesh);
    this.timer = 0;
  }

  update(dt) {
    const p = this.mesh.position;
    if (this.state === 'arriving') {
      // Rampaya yaklaşınca yavaşla
      const d = DOCK_X - p.x;
      const v = Math.min(TRUCK_SPEED, Math.max(3, d * 1.5));
      p.x = Math.min(DOCK_X, p.x + v * dt);
      if (p.x >= DOCK_X - 0.01) {
        this.state = 'unloading';
        this.timer = 0.3;
      }
    } else if (this.state === 'unloading') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0.07;
        const product = this.cargo.shift();
        if (product) {
          const pallet = this.depot.pallets.get(product);
          const from = new THREE.Vector3(p.x - 1.2, 3.1, p.z);
          if (!pallet?.deliver(from)) {
            // palete sığmadı (kapasite düştü vb.) — parası iade
            this.game.money += this.game.supply.costOf(product);
            this.game.hud.setMoney(this.game.money);
          }
          this.game.audio.play('drop', 0.3);
        } else {
          this.state = 'leaving';
        }
      }
    } else {
      p.x += TRUCK_SPEED * dt;
      if (p.x > 90) {
        this.game.scene.remove(this.mesh);
        this.depot.removeTruck(this);
      }
    }
  }
}

// ---- Sipariş paneli (DOM) ------------------------------------------------------------------

class OrderPanel {
  constructor(depot) {
    this.depot = depot;
    this.game = depot.game;
    this.el = document.getElementById('order-panel');
    this.list = document.getElementById('order-list');
    this.totalEl = document.getElementById('order-total');
    this.buyBtn = document.getElementById('order-buy');
    this.fillBtn = document.getElementById('order-fill');
    this.autoRow = document.getElementById('order-auto-row');
    this.autoBox = document.getElementById('order-auto');
    this.qty = {};
    this.open = false;
    this.dismissed = false;

    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.getElementById('order-close').addEventListener('click', () => this.hide(true));
    this.buyBtn.addEventListener('click', () => this.buy());
    this.fillBtn.addEventListener('click', () => this.fill());
    this.autoBox.addEventListener('change', () => { depot.autoOrder = this.autoBox.checked; });
    this.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-p]');
      if (!b) return;
      const p = b.dataset.p;
      const step = Number(b.dataset.d);
      this.qty[p] = Math.max(0, Math.min(this.depot.room(p), (this.qty[p] ?? 0) + step));
      this.render();
    });
  }

  show() {
    this.open = true;
    this.qty = {};
    this.el.classList.remove('hidden');
    this.render();
  }

  hide(byUser = false) {
    this.open = false;
    this.dismissed = byUser;
    this.el.classList.add('hidden');
  }

  update() {
    const inZone = this.depot.kiosk.inRange(this.game.player.position);
    if (inZone && !this.open && !this.dismissed) this.show();
    if (!inZone) {
      this.dismissed = false;
      if (this.open) this.hide();
    }
    if (this.open) {
      this.renderTimer = (this.renderTimer ?? 0) + 1;
      if (this.renderTimer % 20 === 0) this.render(); // stok değişimlerini göster
    }
  }

  total() {
    let t = 0;
    for (const [p, n] of Object.entries(this.qty)) t += n * this.game.supply.costOf(p);
    return t;
  }

  render() {
    const rows = [];
    const crisis = this.game.supply.crisis?.product;
    for (const [product, pallet] of this.depot.pallets) {
      const info = PRODUCTS[product];
      const q = this.qty[product] ?? 0;
      const inc = this.depot.incoming(product);
      rows.push(`
        <div class="order-row">
          <span class="o-emoji">${info.emoji}</span>
          <span class="o-name">${info.name}<small>${pallet.stock}${inc ? ` +${inc}` : ''} / ${pallet.capacity} · <span class="${crisis === product ? 'o-crisis' : ''}">$${this.game.supply.costOf(product)}${crisis === product ? ' ⚠️' : ''}</span></small></span>
          <button data-p="${product}" data-d="-5" aria-label="${info.name} azalt">−</button>
          <span class="o-qty">${q}</span>
          <button data-p="${product}" data-d="5" aria-label="${info.name} artır">+</button>
        </div>`);
    }
    this.list.innerHTML = rows.join('');
    const total = this.total();
    this.totalEl.textContent = `$${total}`;
    this.buyBtn.disabled = total === 0 || total > this.game.money;
    this.autoRow.classList.toggle('hidden', this.depot.level === 0);
    this.autoBox.checked = this.depot.autoOrder;
  }

  buy() {
    const spent = this.depot.order(this.qty);
    if (spent) {
      this.game.hud.toast('🚚 Sipariş verildi');
      this.qty = {};
      this.render();
    }
  }

  /** Tüm paletleri paranın yettiği kadar doldur. */
  fill() {
    let budget = this.game.money;
    const items = {};
    const products = [...this.depot.pallets.keys()].sort((a, b) => this.depot.pallets.get(a).stock - this.depot.pallets.get(b).stock);
    for (const p of products) {
      const n = Math.min(this.depot.room(p), Math.floor(budget / this.game.supply.costOf(p)));
      if (n > 0) {
        items[p] = n;
        budget -= n * this.game.supply.costOf(p);
      }
    }
    this.qty = items;
    this.render();
  }
}
