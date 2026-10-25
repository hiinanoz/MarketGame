import * as THREE from 'three';
import { character, animationClips, prop } from './assets.js';
import { PRODUCTS } from './config.js';

let capParts = null;
const CAP_Y = 0.95; // baş kemiği uzayında şapka yüksekliği
const CRATE_SCALE = 0.42;          // 2x2 birimlik kasa → ~0.84 birim
export const CRATE_HEIGHT = 0.36;  // yığında bir katın yüksekliği

/** Taşınan/rafta duran tek bir ürün kasası. */
export function makeCrate(productId) {
  const info = PRODUCTS[productId];
  const mesh = prop(info.crate);
  if (info.item) {
    // Özel ürün: boş kasanın içinde ürün modelleri
    const n = info.item === 'food_burger' || info.item === 'stew_bowl' ? 2 : 4;
    for (let i = 0; i < n; i++) {
      const it = prop(info.item);
      const sc = n === 2 ? 1.15 : 1.5;
      it.scale.setScalar(sc);
      it.position.set(n === 2 ? (i ? 0.45 : -0.45) : (i % 2 ? 0.45 : -0.45), 0.25, n === 2 ? 0 : (i < 2 ? -0.45 : 0.45));
      mesh.add(it);
    }
  }
  mesh.scale.setScalar(CRATE_SCALE);
  mesh.userData.product = productId;
  return mesh;
}

/**
 * Animasyonlu karakter: model + mixer + önünde taşıdığı kasa yığını.
 * Oyuncu, müşteri ve işçiler bundan türetilir.
 */
export class Character {
  constructor(game, modelName, { speed = 4, capacity = 4, look = null } = {}) {
    this.game = game;
    this.root = new THREE.Group();
    this.model = character(modelName, look);
    this.model.scale.setScalar(0.62);
    this.root.add(this.model);
    this.speed = speed;
    this.capacity = capacity;
    this.velocity = new THREE.Vector3();
    this.heading = 0;

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of animationClips()) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }
    this.current = null;
    this.play('Idle');

    this.bones = {};
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
    });
    if (look === 'uniform') this.addCap();

    // Yığın, karakterin önünde (yerel +z) durur.
    this.stackAnchor = new THREE.Group();
    this.stackAnchor.position.set(0, 0.78, 0.5);
    this.root.add(this.stackAnchor);
    this.stack = []; // { mesh, product }
    this.sway = 0;

    this.path = null;
    this.onArrive = null;
  }

  /** Market üniformasının şapkası (baş kemiğine bağlı). */
  addCap() {
    const head = this.bones.head;
    if (!head) return;
    if (!capParts) {
      capParts = {
        mat: new THREE.MeshStandardMaterial({ color: 0xffc928, roughness: 0.6 }),
        dome: new THREE.CylinderGeometry(0.42, 0.46, 0.22, 16),
        brim: new THREE.BoxGeometry(0.5, 0.05, 0.36),
      };
    }
    const cap = new THREE.Group();
    const dome = new THREE.Mesh(capParts.dome, capParts.mat);
    const brim = new THREE.Mesh(capParts.brim, capParts.mat);
    brim.position.set(0, -0.08, 0.42);
    cap.add(dome, brim);
    cap.position.set(0, CAP_Y, 0.02);
    cap.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    head.add(cap);
    this.cap = cap;
  }

  get position() {
    return this.root.position;
  }

  play(name, fade = 0.18) {
    const next = this.actions[name];
    if (!next || this.current === next) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }

  // ---- Yığın ----------------------------------------------------------------

  get carrying() {
    return this.stack.length;
  }

  get full() {
    return this.stack.length >= this.capacity;
  }

  slotPosition(i) {
    return new THREE.Vector3(0, i * CRATE_HEIGHT, 0);
  }

  /** Kasayı dünyadaki yerinden yığının üstüne uçurur. */
  receive(mesh, productId) {
    const index = this.stack.length;
    const entry = { mesh, product: productId, landing: true };
    this.stack.push(entry);
    this.game.fx.fly(mesh, this.stackAnchor, () => this.slotPosition(this.stack.indexOf(entry)), {
      duration: 0.22,
      arc: 1.2,
      onDone: () => { entry.landing = false; this.layoutStack(); },
    });
    return index;
  }

  /** Belirli üründen (veya herhangi birinden) en üstteki kasayı yığından çıkarır. */
  take(productId = null) {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const e = this.stack[i];
      if (e.landing) continue;
      if (productId && e.product !== productId) continue;
      this.stack.splice(i, 1);
      this.layoutStack();
      return e;
    }
    return null;
  }

  has(productId) {
    return this.stack.some((e) => !e.landing && e.product === productId);
  }

  layoutStack() {
    this.stack.forEach((e, i) => {
      if (!e.landing && e.mesh.parent === this.stackAnchor) e.mesh.position.copy(this.slotPosition(i));
    });
  }

  // ---- Hareket ---------------------------------------------------------------

  goTo(x, z, onArrive) {
    this.path = this.game.nav.findPath(this.position.x, this.position.z, x, z);
    this.onArrive = onArrive ?? null;
  }

  stop() {
    this.path = null;
    this.onArrive = null;
  }

  /** Yol takibi; her karede çağrılır. */
  followPath(dt) {
    if (!this.path || this.path.length === 0) {
      this.velocity.set(0, 0, 0);
      return;
    }
    const [tx, tz] = this.path[0];
    const dx = tx - this.position.x;
    const dz = tz - this.position.z;
    const dist = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (dist <= Math.max(step, 0.05)) {
      this.position.x = tx;
      this.position.z = tz;
      this.path.shift();
      if (this.path.length === 0) {
        this.path = null;
        this.velocity.set(0, 0, 0);
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      }
      return;
    }
    this.velocity.set((dx / dist) * this.speed, 0, (dz / dist) * this.speed);
    this.position.x += (dx / dist) * step;
    this.position.z += (dz / dist) * step;
  }

  faceTowards(x, z) {
    this.heading = Math.atan2(x - this.position.x, z - this.position.z);
  }

  update(dt) {
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > 0.1) {
      this.heading = Math.atan2(this.velocity.x, this.velocity.z);
      this.play(speed > 5.5 ? 'Running_A' : 'Walking_A');
    } else if (!this.busyAnim) {
      this.play('Idle');
    }
    // Yöne yumuşak dönüş
    let diff = this.heading - this.root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.root.rotation.y += diff * Math.min(1, dt * 14);

    this.mixer.update(dt);
    if (this.stack.length) this.poseCarry(speed, dt);
    else this.sway *= 0.9;
  }

  /** Kollar öne uzanmış "kasa taşıma" pozu: animasyonun üstüne kemik dönüşü yazar. */
  poseCarry(speed, dt) {
    const ua = this.bones['upperarm.l'];
    const ub = this.bones['upperarm.r'];
    const la = this.bones['lowerarm.l'];
    const lb = this.bones['lowerarm.r'];
    if (ua && ub) {
      ua.rotation.set(-1.2, 0, 0.25);
      ub.rotation.set(-1.2, 0, -0.25);
    }
    if (la && lb) {
      la.rotation.set(-0.2, 0, 0);
      lb.rotation.set(-0.2, 0, 0);
    }
    // Yürürken yığın hafifçe sallanır
    const target = Math.min(speed / this.speed, 1) * 0.06;
    this.sway += (target - this.sway) * Math.min(1, dt * 6);
    this.stack.forEach((e, i) => {
      if (e.landing || e.mesh.parent !== this.stackAnchor) return;
      e.mesh.position.z = -this.sway * i * 0.35;
    });
  }
}
