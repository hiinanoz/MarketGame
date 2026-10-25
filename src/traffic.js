import * as THREE from 'three';
import { PARKING } from './config.js';

// Ön caddede araç trafiği + otopark. Otoparktaki her yer bir arabalı müşteri demek.

const LANE_EAST = 18.6;  // +x yönüne giden şerit
const LANE_WEST = 21.4;  // −x yönüne giden şerit
const ROAD_END = 95;

const COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xecf0f1, 0x9b59b6, 0xe67e22, 0x34495e, 0x1abc9c];
let parts;

function carMesh(color) {
  if (!parts) {
    parts = {
      body: new THREE.BoxGeometry(3.4, 0.75, 1.65),
      cabin: new THREE.BoxGeometry(1.9, 0.7, 1.45),
      glass: new THREE.BoxGeometry(1.95, 0.45, 1.5),
      wheel: new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10),
      dark: new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.7 }),
      glassMat: new THREE.MeshStandardMaterial({ color: 0x9ad0ec, roughness: 0.2 }),
      lights: new THREE.MeshStandardMaterial({ color: 0xfff2b3, emissive: 0x665500 }),
      lightGeo: new THREE.BoxGeometry(0.06, 0.18, 0.35),
      mats: new Map(),
    };
  }
  if (!parts.mats.has(color)) parts.mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 }));
  const mat = parts.mats.get(color);
  const g = new THREE.Group();
  const add = (geo, m, x, y, z) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  add(parts.body, mat, 0, 0.62, 0);
  add(parts.cabin, mat, -0.25, 1.32, 0);
  add(parts.glass, parts.glassMat, -0.25, 1.3, 0);
  for (const z of [-0.5, 0.5]) add(parts.lightGeo, parts.lights, 1.71, 0.7, z);
  for (const x of [-1.1, 1.1]) for (const z of [-0.82, 0.82]) {
    const w = add(parts.wheel, parts.dark, x, 0.36, z);
    w.rotation.x = Math.PI / 2;
  }
  g.scale.setScalar(0.85);
  return g; // +x yönüne bakar
}

/** Ara noktalar boyunca giden araç. */
class Car {
  constructor(scene, color, points, speed) {
    this.mesh = carMesh(color);
    this.scene = scene;
    this.points = points.map((p) => new THREE.Vector2(p[0], p[1]));
    this.speed = speed;
    this.mesh.position.set(points[0][0], 0, points[0][1]);
    this.points.shift();
    this.face();
    scene.add(this.mesh);
    this.done = false;
  }

  face() {
    const t = this.points[0];
    if (!t) return;
    const dx = t.x - this.mesh.position.x;
    const dz = t.y - this.mesh.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) this.targetRot = Math.atan2(-dz, dx);
  }

  setRoute(points) {
    this.points = points.map((p) => new THREE.Vector2(p[0], p[1]));
    this.done = false;
    this.face();
  }

  update(dt) {
    const t = this.points[0];
    if (!t) { this.done = true; return; }
    const p = this.mesh.position;
    const dx = t.x - p.x;
    const dz = t.y - p.z;
    const d = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (d <= step) {
      p.x = t.x;
      p.z = t.y;
      this.points.shift();
      this.face();
    } else {
      p.x += (dx / d) * step;
      p.z += (dz / d) * step;
    }
    if (this.targetRot !== undefined) {
      let diff = this.targetRot - this.mesh.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.mesh.rotation.y += diff * Math.min(1, dt * 8);
    }
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}

export class Traffic {
  constructor(game) {
    this.game = game;
    this.cars = [];
    this.timers = [1, 2.5];
    this.lot = new ParkingLot(game);
  }

  update(dt) {
    // Seviye ve saat ilerledikçe trafik yoğunlaşır
    const rush = Math.max(0.4, this.game.day.isOpen ? this.game.day.rush : 0.3);
    const interval = Math.max(1.1, 4.5 - this.game.level * 0.18) / rush;
    for (let lane = 0; lane < 2; lane++) {
      this.timers[lane] -= dt;
      if (this.timers[lane] <= 0) {
        this.timers[lane] = interval * (0.6 + Math.random() * 0.9);
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const speed = 10 + Math.random() * 5;
        const route = lane === 0
          ? [[-ROAD_END, LANE_EAST], [ROAD_END, LANE_EAST]]
          : [[ROAD_END, LANE_WEST], [-ROAD_END, LANE_WEST]];
        this.cars.push(new Car(this.game.scene, color, route, speed));
      }
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      c.update(dt);
      if (c.done) {
        c.remove();
        this.cars.splice(i, 1);
      }
    }
    this.lot.update(dt);
  }
}

// ---- Otopark ----------------------------------------------------------------------------

export class ParkingLot {
  constructor(game) {
    this.game = game;
    this.stage = 0; // 0: yok, 1: 6 yer, 2: 12 yer
    this.slots = []; // { x, z, rowZ, car, customer }
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.cars = [];
  }

  get capacity() {
    return this.slots.length;
  }

  get free() {
    return this.slots.filter((s) => !s.car).length;
  }

  setStage(stage) {
    while (this.stage < stage) {
      this.stage++;
      this.buildRow(this.stage);
    }
  }

  buildRow(stage) {
    const L = PARKING;
    if (stage === 1) {
      const asphalt = new THREE.Mesh(
        new THREE.PlaneGeometry(L.maxX - L.minX, L.maxZ - L.minZ),
        new THREE.MeshStandardMaterial({ color: 0x6a717c, roughness: 1 }),
      );
      asphalt.rotation.x = -Math.PI / 2;
      asphalt.position.set((L.minX + L.maxX) / 2, -0.006, (L.minZ + L.maxZ) / 2);
      asphalt.receiveShadow = true;
      this.group.add(asphalt);
      // Girişten yola bağlantı
      const link = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5), asphalt.material);
      link.rotation.x = -Math.PI / 2;
      link.position.set(L.entryX, -0.007, L.maxZ + 2.4);
      this.group.add(link);
    }
    const rowZ = stage === 1 ? L.rowA : L.rowB;
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
    for (let i = 0; i < L.perRow; i++) {
      const x = L.minX + 1.6 + i * L.spacing;
      this.slots.push({ x, z: rowZ, car: null, customer: null });
    }
    for (let i = 0; i <= L.perRow; i++) {
      const x = L.minX + 1.6 - L.spacing / 2 + i * L.spacing;
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 3.2), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.0, rowZ);
      this.group.add(line);
    }
  }

  /** Boş bir yere araba gönderir; araba park edince cb(slot) çağrılır. */
  reserve(cb) {
    const slot = this.slots.find((s) => !s.car);
    if (!slot) return false;
    const L = PARKING;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const car = new Car(this.game.scene, color, [
      [-ROAD_END, LANE_EAST], [L.entryX - 3, LANE_EAST], [L.entryX, L.maxZ + 1], [L.entryX, L.aisle],
      [slot.x, L.aisle], [slot.x, slot.z],
    ], 11);
    slot.car = car;
    car.onPark = () => cb(slot);
    this.cars.push(car);
    return true;
  }

  /** Müşteri arabasına bindi: arabayı yola çıkar. */
  depart(slot) {
    const L = PARKING;
    const car = slot.car;
    if (!car) return;
    car.parked = false;
    car.speed = 9;
    car.setRoute([[slot.x, L.aisle], [L.entryX, L.aisle], [L.entryX, L.maxZ + 1], [L.entryX + 3, LANE_EAST], [ROAD_END, LANE_EAST]]);
    car.leaving = true;
    slot.car = null;
    slot.customer = null;
  }

  update(dt) {
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.parked) continue;
      c.update(dt);
      if (c.done) {
        if (c.leaving) {
          c.remove();
          this.cars.splice(i, 1);
        } else {
          c.parked = true;
          c.onPark?.();
        }
      }
    }
  }

  serialize() {
    return this.stage;
  }
}
