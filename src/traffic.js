import * as THREE from 'three';
import { t } from './i18n.js';
import { PARKING } from './config.js';
import { prop } from './assets.js';
import { bubbleTexture } from './fx.js';

// Ön caddede araç trafiği + otopark. Otoparktaki her yer bir arabalı müşteri demek.

const LANE_EAST = 18.6;  // +x yönüne giden şerit
const LANE_WEST = 21.4;  // −x yönüne giden şerit
const ROAD_END = 95;

const MODELS = ['car_sedan', 'car_hatchback', 'car_stationwagon', 'car_taxi', 'car_sedan', 'car_hatchback'];

/** KayKit City Builder araba modeli (+x yönüne bakacak şekilde sarılı). */
function carMesh(kind) {
  const name = kind ?? (Math.random() < 0.04 ? 'car_police' : MODELS[Math.floor(Math.random() * MODELS.length)]);
  const g = new THREE.Group();
  const m = prop(name);
  m.scale.setScalar(3.4);
  m.rotation.y = Math.PI / 2;
  m.position.y = 0.2;
  m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.add(m);
  return g;
}

/** Ara noktalar boyunca giden araç. */
class Car {
  constructor(scene, kind, points, speed) {
    this.mesh = carMesh(kind);
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
    const ty = this.points[0];
    if (!ty) return;
    const dx = ty.x - this.mesh.position.x;
    const dz = ty.y - this.mesh.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.01) this.targetRot = Math.atan2(-dz, dx);
  }

  setRoute(points) {
    this.points = points.map((p) => new THREE.Vector2(p[0], p[1]));
    this.done = false;
    this.face();
  }

  update(dt) {
    const ty = this.points[0];
    if (!ty) { this.done = true; return; }
    const p = this.mesh.position;
    const dx = ty.x - p.x;
    const dz = ty.y - p.z;
    const d = Math.hypot(dx, dz);
    const step = this.speed * dt;
    if (d <= step) {
      p.x = ty.x;
      p.z = ty.y;
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
        const speed = 10 + Math.random() * 5;
        const route = lane === 0
          ? [[-ROAD_END, LANE_EAST], [ROAD_END, LANE_EAST]]
          : [[ROAD_END, LANE_WEST], [-ROAD_END, LANE_WEST]];
        this.cars.push(new Car(this.game.scene, null, route, speed));
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
    this.stage = 0; // 0: yok, her aşama 6 yer (en fazla 4 aşama = 24 yer)
    this.valet = false; // otopark görevlisi
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
    if (stage === 1 || stage === 3) {
      const x0 = stage === 1 ? L.minX : L.extMinX;
      const x1 = stage === 1 ? L.maxX : L.minX;
      this.asphaltMat ??= new THREE.MeshStandardMaterial({ color: 0x6a717c, roughness: 1 });
      const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, L.maxZ - L.minZ), this.asphaltMat);
      asphalt.rotation.x = -Math.PI / 2;
      asphalt.position.set((x0 + x1) / 2, -0.006, (L.minZ + L.maxZ) / 2);
      asphalt.receiveShadow = true;
      this.group.add(asphalt);
    }
    if (stage === 1) {
      // Girişten yola bağlantı
      const link = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 5), this.asphaltMat);
      link.rotation.x = -Math.PI / 2;
      link.position.set(L.entryX, -0.007, L.maxZ + 2.4);
      this.group.add(link);
    }
    const rowZ = stage % 2 === 1 ? L.rowA : L.rowB;
    const startX = stage <= 2 ? L.minX + 1.6 : L.extMinX + 1.6;
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
    for (let i = 0; i < L.perRow; i++) {
      const x = startX + i * L.spacing;
      this.slots.push({ x, z: rowZ, car: null, customer: null });
    }
    for (let i = 0; i <= L.perRow; i++) {
      const x = startX - L.spacing / 2 + i * L.spacing;
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
    const car = new Car(this.game.scene, null, [
      [-ROAD_END, LANE_EAST], [L.entryX - 3, LANE_EAST], [L.entryX, L.maxZ + 1], [L.entryX, L.aisle],
      [slot.x, L.aisle], [slot.x, slot.z],
    ], 11);
    slot.car = car;
    car.onPark = () => cb(slot);
    // Büyük otoparkta görevli yoksa girişte karışıklık: araba bekler, müşteri memnuniyeti düşer
    if (!this.valet && this.capacity >= L.jamFromSlots && Math.random() < L.jamChance) car.jam = L.jamTime;
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
      // Tıkanma: giriş kapısına gelince (kalan 3 nokta) bekle
      if (c.jam > 0 && !c.leaving && c.points.length === 3) {
        if (!c.bubble) {
          c.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture('😤'), depthTest: false }));
          c.bubble.renderOrder = 5;
          c.bubble.scale.setScalar(1.1);
          c.bubble.position.y = 2.6;
          c.mesh.add(c.bubble);
          this.game.rating.add(PARKING.jamRating, t('otopark karmaşası'));
          this.game.day.today.jams = (this.game.day.today.jams ?? 0) + 1;
        }
        c.jam -= dt;
        if (c.jam <= 0) {
          c.mesh.remove(c.bubble);
          c.bubble.material.map.dispose();
        }
        continue;
      }
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
