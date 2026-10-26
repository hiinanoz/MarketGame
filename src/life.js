import * as THREE from 'three';
import { Character } from './character.js';
import { prop } from './assets.js';
import { textTexture } from './fx.js';
import { LIFE } from './config.js';

// Yaşayan şehir (Sv.20+): kasabalılar evlerinden çıkar, kaldırımlarda yürür, senin dükkânlarından
// alışveriş yapar (işletmeye küçük gelir), parka, sahile, işe gider; akşam evlerine döner.
// Şehir zamanla değişir: her gün yeni ağaçlar, banklar, lambalar eklenir.

const LANES = { north: 14.7, south: 24.6, back: -28.8 };
const CONNECT = { back: [31, -49] }; // kuzey kaldırımı ↔ arka yol bağlantı sütunları (x)

export class Life {
  constructor(game) {
    this.game = game;
    this.people = [];
    this.growth = 0;     // eklenen süs sayısı
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.spots = growthSpots();
  }

  get active() {
    return this.game.level >= LIFE.fromLevel;
  }

  get target() {
    const g = this.game;
    return Math.min(LIFE.max, LIFE.base + Math.floor((g.level - LIFE.fromLevel) / 3) + Math.floor(g.housing.plots.filter((p) => p.built).length / 2));
  }

  /** Gidilecek yerler (her seferinde güncel). */
  places() {
    const g = this.game;
    const list = [];
    // Senin dükkânların / işletmelerin (alışveriş = küçük gelir)
    for (const b of g.holding.owned) {
      if (!b.isBuilding) continue;
      const out = b.def.building.facing === -1 ? -1.4 : 1.4;
      list.push({ x: b.x, z: b.frontZ + out, kind: 'shop', biz: b, emoji: b.def.emoji, w: 3 });
    }
    // Market önü
    list.push({ x: 0, z: 11.5, kind: 'market', emoji: '🛒', w: 3 });
    // Parklar, sahil, kamu binaları
    if (g.politics.buildings.park) list.push({ x: -60, z: -1.5, lane: 'north', kind: 'park', emoji: '🌳', w: 2 });
    if (g.level >= 66) for (let i = 0; i < 3; i++) list.push({ x: -10 + Math.random() * 60, z: 54, kind: 'beach', emoji: '🏖️', w: 1 });
    // Tedarik vadisi (işe gidenler)
    if (g.level >= 22) for (const b of g.holding.owned.filter((x) => !x.isBuilding && x.frontZ > -60)) list.push({ x: b.x, z: b.frontZ + 1.6, kind: 'work', emoji: '👷', w: 1 });
    return list;
  }

  homes() {
    const g = this.game;
    const built = g.housing.plots.filter((p) => p.built);
    if (built.length) return built.map((p) => ({ x: p.x, z: p.z + 5.6, via: [[p.x + 6, LANES.north], [p.x + 6, p.z + 5.6]] }));
    // Henüz ev yoksa şehrin dışından gelir
    return [{ x: 104, z: LANES.north, edge: true }, { x: -100, z: LANES.north, edge: true }];
  }

  spawn() {
    const homes = this.homes();
    const home = homes[Math.floor(Math.random() * homes.length)];
    const models = ['Knight', 'Rogue', 'Mage', 'Rogue_Hooded', 'Barbarian'];
    const c = new Citizen(this.game, models[Math.floor(Math.random() * models.length)], home, this);
    this.people.push(c);
  }

  update(dt) {
    const g = this.game;
    if (!this.active) return;
    const day = g.day.phase === 'open';
    // Gündüz şehir dolar, gece herkes evine
    if (day && this.people.length < this.target) {
      this.spawnT = (this.spawnT ?? 0) - dt;
      if (this.spawnT <= 0) {
        this.spawnT = 2.5;
        this.spawn();
      }
    }
    const p = g.player.position;
    for (let i = this.people.length - 1; i >= 0; i--) {
      const c = this.people[i];
      if (!day && !c.goingHome) c.goHome();
      // Uzaktaki karakterlerin animasyonu atlanır (performans)
      const far = Math.abs(c.position.x - p.x) > 70 || Math.abs(c.position.z - p.z) > 70;
      c.tick(dt, far);
      if (c.done) {
        g.scene.remove(c.root);
        this.people.splice(i, 1);
      }
    }
  }

  /** Gün sonu: şehir büyür (yeni ağaç, bank, lamba, çiçeklik). */
  endOfDay() {
    if (!this.active) return;
    const n = Math.min(this.spots.length, this.growth + LIFE.growthPerDay);
    for (let i = this.growth; i < n; i++) this.addGrowth(i);
    this.growth = n;
  }

  addGrowth(i) {
    const s = this.spots[i];
    if (!s) return;
    let m;
    if (s.type === 'bed') {
      m = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
      box.position.y = 0.2;
      m.add(box);
      const colors = [0xe91e63, 0xffeb3b, 0xff7043, 0xba68c8];
      for (let k = 0; k < 5; k++) {
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: colors[(i + k) % colors.length] }));
        f.position.set(-0.6 + k * 0.3, 0.5, (k % 2) * 0.2 - 0.1);
        m.add(f);
      }
    } else {
      m = prop(s.type);
      m.scale.setScalar(s.scale ?? 1);
    }
    m.position.set(s.x, 0, s.z);
    m.rotation.y = s.rot ?? 0;
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.add(m);
  }

  serialize() {
    return { growth: this.growth };
  }

  restore(d) {
    this.growth = Math.min(d?.growth ?? 0, this.spots.length);
    for (let i = 0; i < this.growth; i++) this.addGrowth(i);
  }
}

/** Şehrin zamanla dolacağı boş yerler (sıralı). */
function growthSpots() {
  const out = [];
  // Kaldırımlara sokak lambası ve bank, aralara ağaç ve çiçeklik
  for (let x = -90; x <= 100; x += 10) {
    if (Math.abs(x) < 30) continue;
    out.push({ type: 'bed', x: x + 3, z: 26.2 });
    out.push({ type: 'bush', x: x, z: 26.5, scale: 1.6 });
  }
  for (let x = -96; x <= 104; x += 16) out.push({ type: 'streetlight', x, z: 25.4, rot: Math.PI / 2 });
  for (let x = -90; x <= 100; x += 24) out.push({ type: 'bench', x: x + 6, z: 25.8, rot: Math.PI });
  for (let x = 40; x <= 100; x += 12) out.push({ type: 'trees_B_medium', x, z: -42, scale: 3 });
  // Karıştır (sabit tohumla, her oyunda aynı sıra)
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- Kasabalı ----

class Citizen extends Character {
  constructor(game, model, home, life) {
    super(game, model, { speed: 2 + Math.random() * 0.8, look: Math.floor(Math.random() * 6) });
    this.life = life;
    this.home = home;
    this.position.set(home.x, 0, home.z);
    this.queue = [];
    this.waitT = 0;
    this.visits = 0;
    this.goingHome = false;
    this.done = false;
    this.bubble = null;
    game.scene.add(this.root);
    this.plan();
  }

  laneOf(z) {
    if (z < -20) return 'back';
    return z > 20 ? 'south' : 'north';
  }

  /** Bulunduğu yerden hedefe kaldırımlar üzerinden yol. */
  route(dest) {
    const pts = [];
    const from = this.laneOf(this.position.z);
    const to = this.laneOf(dest.z);
    pts.push([this.position.x, LANES[from]]);
    if (from !== to) {
      if (from === 'back' || to === 'back') {
        // Arka yola bağlantı sütunu (en yakın)
        const cx = CONNECT.back.reduce((a, b) => (Math.abs(b - this.position.x) < Math.abs(a - this.position.x) ? b : a));
        pts.push([cx, LANES[from]]);
        const mid = from === 'back' || to === 'back' ? (from === 'back' ? to : from) : 'north';
        if (mid === 'south') {
          pts.push([cx, LANES.back]);
          pts.push([cx, LANES.north]);
          pts.push([cx, LANES.south]);
        } else pts.push([cx, LANES[to]]);
      } else {
        // Caddeden karşıya geç
        pts.push([this.position.x, LANES[to]]);
      }
    }
    if (dest.via) for (const v of dest.via) pts.push(v);
    else pts.push([dest.x, LANES[to]]);
    pts.push([dest.x, dest.z]);
    return pts;
  }

  plan() {
    const places = this.life.places();
    if (this.visits >= 3 || !places.length) {
      this.goHome();
      return;
    }
    // Ağırlıklı rastgele seçim
    const total = places.reduce((a, p) => a + p.w, 0);
    let r = Math.random() * total;
    const dest = places.find((p) => (r -= p.w) <= 0) ?? places[0];
    this.dest = dest;
    this.queue = this.route(dest);
  }

  goHome() {
    this.goingHome = true;
    this.dest = this.home;
    this.queue = this.route(this.home);
  }

  arrive() {
    const g = this.game;
    const d = this.dest;
    if (this.goingHome) {
      this.done = true; // eve girdi
      return;
    }
    this.visits++;
    this.waitT = 3 + Math.random() * 5;
    this.say(d.emoji ?? '🙂');
    // Senin dükkânından alışveriş: işletmeye küçük gelir
    if (d.kind === 'shop' && d.biz?.owned && d.biz.def.revenuePerModule) {
      const amount = Math.round(LIFE.spendBase + g.level * LIFE.spendPerLevel);
      g.money += amount;
      d.biz.today.sales += amount;
      g.hud.setMoney(g.money);
      g.fx.floatText(this.position.clone().add(new THREE.Vector3(0, 2.2, 0)), `+$${amount}`, '#2f7a2f');
    }
  }

  say(emoji) {
    if (this.bubble) this.root.remove(this.bubble);
    const tex = textTexture(emoji, { size: 64 });
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    this.bubble.scale.set(0.7, 0.7, 1);
    this.bubble.position.y = 2.5;
    this.root.add(this.bubble);
  }

  tick(dt, far) {
    if (this.waitT > 0) {
      this.waitT -= dt;
      this.velocity.set(0, 0, 0);
      if (this.waitT <= 0) {
        if (this.bubble) this.root.remove(this.bubble);
        this.bubble = null;
        this.plan();
      }
    } else if (this.queue.length) {
      const [tx, tz] = this.queue[0];
      const dx = tx - this.position.x;
      const dz = tz - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.2) {
        this.queue.shift();
        if (!this.queue.length) this.arrive();
      } else {
        const v = Math.min(this.speed, d / dt);
        this.velocity.set((dx / d) * v, 0, (dz / d) * v);
        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.z * dt;
        this.heading = Math.atan2(dx, dz);
      }
    } else if (!this.done) this.arrive();
    if (!far) this.update(dt);
    else this.root.position.copy(this.position);
  }
}
