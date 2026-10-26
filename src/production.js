import * as THREE from 'three';
import { PRODUCTS, PRODUCERS, CRISIS, WHOLESALER_DISCOUNT } from './config.js';

// İleri seviye ekonomi: üretimhaneler, toptancı indirimi ve tedarik krizleri.

// ---- Fiyatlar ve krizler -------------------------------------------------------------------

export class Supply {
  constructor(game) {
    this.game = game;
    this.discount = 1;     // toptancı satın alınınca 0.7
    this.crisis = null;    // { product, type: 'price' | 'shortage', left }
  }

  /** Bir kasanın bugünkü alış fiyatı. */
  costOf(product) {
    let c = PRODUCTS[product].cost * this.discount;
    if (this.crisis?.product === product && this.crisis.type === 'price') c *= CRISIS.priceMult;
    return Math.max(1, Math.round(c));
  }

  /** Kıtlıkta bugün bu üründen en fazla kaç kasa sipariş edilebilir. */
  orderLimit(product) {
    if (this.crisis?.product === product && this.crisis.type === 'shortage') return this.crisis.left;
    return Infinity;
  }

  ordered(product, n) {
    if (this.crisis?.product === product && this.crisis.type === 'shortage') this.crisis.left = Math.max(0, this.crisis.left - n);
  }

  buyWholesaler() {
    this.discount = WHOLESALER_DISCOUNT;
  }

  /** Her sabah: belli bir olasılıkla bir üründe zam ya da kıtlık. Kendi üretimin bu açığı kapatır. */
  rollCrisis() {
    this.crisis = null;
    const g = this.game;
    if (g.level < CRISIS.fromLevel || Math.random() > CRISIS.chance) {
      g.hud.setCrisis(null);
      return;
    }
    const candidates = g.depot.regularPallets().map(([k]) => k);
    if (!candidates.length) return;
    const product = candidates[Math.floor(Math.random() * candidates.length)];
    const type = Math.random() < 0.5 ? 'price' : 'shortage';
    this.crisis = { product, type, left: CRISIS.shortageLimit };
    const info = PRODUCTS[product];
    const text = type === 'price'
      ? `${info.emoji} ${info.name} zamlandı (+%${Math.round((CRISIS.priceMult - 1) * 100)})`
      : `${info.emoji} ${info.name} kıtlığı: bugün en fazla ${CRISIS.shortageLimit} kasa`;
    g.hud.setCrisis(`⚠️ ${text}`);
    g.later.push({ t: 1.9, fn: () => g.hud.toast(`⚠️ Tedarik sorunu: ${info.name}`) });
  }

  serialize() {
    return { discount: this.discount, crisis: this.crisis };
  }

  restore(d) {
    if (!d) return;
    this.crisis = d.crisis ?? null;
    if (this.crisis) {
      const info = PRODUCTS[this.crisis.product];
      this.game.hud.setCrisis(this.crisis.type === 'price'
        ? `⚠️ ${info.emoji} ${info.name} zamlandı (+%${Math.round((CRISIS.priceMult - 1) * 100)})`
        : `⚠️ ${info.emoji} ${info.name} kıtlığı: kalan ${this.crisis.left} kasa`);
    }
  }
}

// ---- Üretimhaneler -------------------------------------------------------------------------

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function roof(w, d, h, color, y) {
  // Üçgen prizma çatı
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.position.y = y;
  m.castShadow = true;
  return m;
}

function buildingMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'greenhouse') {
    g.add(box(5, 0.3, 4, 0xe8e2d4, 0, 0.15, 0));
    const glass = box(4.8, 2.4, 3.8, 0xbfe9ff, 0, 1.5, 0, { transparent: true, opacity: 0.45, roughness: 0.1 });
    glass.castShadow = false;
    g.add(glass);
    for (let i = -1; i <= 1; i++) {
      g.add(box(4.2, 0.35, 0.7, 0x7a5233, 0, 0.45, i * 1.1));
      for (let k = -3; k <= 3; k++) {
        const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: k % 2 ? 0x4fa34a : 0x6cc25f, flatShading: true }));
        plant.position.set(k * 0.6, 0.85, i * 1.1);
        g.add(plant);
      }
    }
    const r = roof(5, 4, 1.1, 0xd9f2ff, 2.7);
    r.material.transparent = true;
    r.material.opacity = 0.55;
    g.add(r);
  } else if (kind === 'dairy') {
    g.add(box(4.6, 2.6, 3.8, 0xc0392b, 0, 1.3, 0));
    g.add(box(1.4, 1.8, 0.1, 0xf5f0e6, 0, 0.9, 1.95));
    g.add(roof(5, 4.2, 1.4, 0x5d4037, 2.6));
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3.6, 12), new THREE.MeshStandardMaterial({ color: 0xd0d6dc, roughness: 0.5 }));
    silo.position.set(2.9, 1.8, -0.8);
    silo.castShadow = true;
    g.add(silo);
  } else if (kind === 'bakery') {
    g.add(box(4.6, 2.5, 3.8, 0xe7b583, 0, 1.25, 0));
    g.add(box(4.8, 0.4, 0.9, 0xd6372b, 0, 2.1, 2.2));
    g.add(roof(5, 4.2, 1.2, 0x8d4b2a, 2.5));
    g.add(box(0.6, 1.6, 0.6, 0x8d6e63, 1.4, 3.4, -0.6));
  } else {
    g.add(box(4.6, 2.5, 3.8, 0xf2f2f2, 0, 1.25, 0));
    for (let i = 0; i < 6; i++) g.add(box(0.8, 0.12, 0.9, i % 2 ? 0xffffff : 0xd6372b, -2 + i * 0.8, 2.1, 2.25));
    g.add(roof(5, 4.2, 1, 0x455a64, 2.5));
  }
  return g;
}

export class Producer {
  constructor(game, kind, x, z) {
    this.game = game;
    this.kind = kind;
    this.def = PRODUCERS[kind];
    this.x = x;
    this.z = z;
    this.timer = this.def.interval;
    this.turn = 0;
    const mesh = buildingMesh(kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.PI / 2; // kapısı depoya (+x) baksın
    game.scene.add(mesh);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '70px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.def.emoji, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sign.scale.setScalar(1.2);
    sign.position.set(x, 5, z);
    game.scene.add(sign);
    game.nav.setBox(`producer-${kind}`, { minX: x - 2.2, maxX: x + 2.2, minZ: z - 2.6, maxZ: z + 2.6 });
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.def.interval;
    // Sırayla, paletinde yer olan ve mağazada satılan ürünü üret
    const list = this.def.products.filter((p) => this.game.depot.pallets.get(p)?.space > 0);
    if (!list.length) return;
    const product = list[this.turn++ % list.length];
    const from = new THREE.Vector3(this.x + 1.5, 2.5, this.z);
    this.game.depot.pallets.get(product).deliver(from);
  }
}
