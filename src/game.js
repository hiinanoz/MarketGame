import * as THREE from 'three';
import { Nav } from './nav.js';
import { Fx } from './fx.js';
import { Audio } from './audio.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Character } from './character.js';
import { Shelf, Checkout, UnlockPad } from './stations.js';
import { Customer, Cashier, Stocker, Cleaner, Manager, Guard, Advertiser } from './actors.js';
import { Rating, DirtSystem } from './upkeep.js';
import { Traffic } from './traffic.js';
import { Depot } from './depot.js';
import { DayCycle } from './daycycle.js';
import { CHARACTER_NAMES } from './assets.js';
import {
  PRODUCTS, SHELVES, CHECKOUTS, UNLOCKS, LEVELS, START_MONEY, START_CAPACITY, PLAYER_SPEED, ROOM2,
  DOOR_X, DOOR2_X, WORKER_CAPACITY, START_DEPOT_STOCK, RATING, DIRT, WALK_IN_CAP, ADS, THEFT, GUARD_SPOTS,
} from './config.js';

const SAVE_KEY = 'marketgame-save-v2';
const OLD_SAVE_KEY = 'marketgame-save-v1';

export class Game {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ad3f0);
    this.scene.fog = new THREE.Fog(0x9ad3f0, 45, 90);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 200);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x7a8f6a, 1.7);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3dd, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 1; sc.far = 70;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.nav = new Nav({ minX: -34, maxX: 31, minZ: -30, maxZ: 21 });
    this.fx = new Fx(this.scene);
    this.audio = new Audio();
    this.input = new Input(this.renderer.domElement);
    this.day = new DayCycle(this);
    this.hud = new Hud(this);
    this.rating = new Rating(this);
    this.dirt = new DirtSystem(this);
    this.stats = { sold: 0 };
    this.xp = 0;
    this.level = 1;
    this.stockerCapacity = WORKER_CAPACITY;
    this.door2Open = false;
    this.adBoost = 1;

    this.shelves = [];
    this.checkouts = [];
    this.customers = [];
    this.workers = [];
    this.pads = new Map();
    this.unlocked = new Set();
    this.room2Open = false;
    this.money = START_MONEY;

    this.world = new World(this);
    this.depot = new Depot(this);
    this.traffic = new Traffic(this);

    // Oyuncu
    this.player = new Character(this, 'Barbarian', { speed: PLAYER_SPEED, capacity: START_CAPACITY });
    this.player.position.set(DOOR_X, 0, 0);
    this.player.heading = Math.PI;
    this.scene.add(this.player.root);
    this.playerRing = makeRing();
    this.scene.add(this.playerRing);

    // Başlangıçta açık olanlar: domates reyonu + ilk kasa
    this.addShelf('tomato');
    this.addCheckout('checkout1');

    this.loadSave();
    this.refreshPads();
    this.hud.setMoney(this.money);
    this.hud.displayed = this.money - 1;

    this.guide = makeGuideArrow();
    this.scene.add(this.guide);
    this.pointer = makeGroundPointer();
    this.scene.add(this.pointer);

    this.spawnTimer = 1.5;
    this.timers = { supply: 0, shelf: 0, save: 0, gift: 3 };
    this.hud.setLevel(this.level, this.levelProgress());

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.cameraTarget = this.player.position.clone();
    this.updateCamera(1);
  }

  // ---- Kurulum ---------------------------------------------------------------

  addShelf(id) {
    const def = SHELVES.find((s) => s.id === id);
    const shelf = new Shelf(this, def);
    this.shelves.push(shelf);
    this.depot.addPallet(def.product);
    return shelf;
  }

  addCheckout(id) {
    const def = CHECKOUTS.find((c) => c.id === id);
    const co = new Checkout(this, def);
    this.checkouts.push(co);
    return co;
  }

  padPosition(def) {
    switch (def.type) {
      case 'shelf':
        return SHELVES.find((s) => s.id === def.target).pos;
      case 'shelfStage':
        return this.shelves.find((s) => s.id === def.target).stagePadPos;
      case 'cashier': {
        const co = CHECKOUTS.find((c) => c.id === def.target);
        return [co.cashierSpot[0] + 0.3, co.cashierSpot[1] + 5.4];
      }
      case 'checkout':
        return CHECKOUTS.find((c) => c.id === def.target).pos;
      default:
        return def.pos;
    }
  }

  padLabel(def) {
    switch (def.type) {
      case 'shelf': return { title: PRODUCTS[def.target].name, emoji: PRODUCTS[def.target].emoji };
      case 'shelfStage': return { title: `Raf ${[8, 16, 24][def.value]}`, emoji: '📶', size: 2.0 };
      case 'stockerCap': return { title: `Taşıyıcı ${def.value}`, emoji: '🛒' };
      case 'door': return { title: '2. kapı', emoji: '🚪' };
      case 'depot': return { title: 'Depo 40', emoji: '🏭' };
      case 'cleaner': return { title: 'Temizlikçi', emoji: '🧹' };
      case 'manager': return { title: 'Müdür', emoji: '💼' };
      case 'ads': return def.target === 'billboard' ? { title: 'Reklam panosu', emoji: '🪧' } : { title: 'Reklamcı', emoji: '📣' };
      case 'security': return { title: 'Güvenlik', emoji: '👮' };
      case 'parking': return { title: def.value === 1 ? 'Otopark' : 'Otopark +6', emoji: '🅿️' };
      case 'cashier': return { title: 'Kasiyer', emoji: '🧑‍💼' };
      case 'stocker': return { title: 'Taşıyıcı', emoji: '📦' };
      case 'capacity': return { title: `Taşıma ${def.value}`, emoji: '💪' };
      case 'expansion': return { title: 'Genişlet', emoji: '🏗️' };
      case 'checkout': return { title: 'Yeni kasa', emoji: '🛒' };
      default: return { title: def.id, emoji: '⭐' };
    }
  }

  /** Sıradaki seviyenin alanları da kilitli (gri) olarak görünür; ulaşınca açılır. */
  refreshPads() {
    for (const [id, pad] of this.pads) pad.setLocked(pad.def.level > this.level);
    for (const def of UNLOCKS) {
      if (this.unlocked.has(def.id) || this.pads.has(def.id)) continue;
      if (!def.requires.every((r) => this.unlocked.has(r))) continue;
      if (def.level > this.level + 1) continue;
      if (def.type === 'shelfStage' && !this.shelves.some((s) => s.id === def.target)) continue;
      const [x, z] = this.padPosition(def);
      const pad = new UnlockPad(this, def, x, z, this.padLabel(def));
      pad.setLocked(def.level > this.level);
      if (this.savedPads?.[def.id]) {
        pad.paid = Math.min(this.savedPads[def.id], def.cost - 1);
        pad.redraw();
      }
      this.pads.set(def.id, pad);
    }
  }

  applyUnlock(def, silent = false) {
    this.unlocked.add(def.id);
    switch (def.type) {
      case 'shelf': {
        const shelf = this.addShelf(def.target);
        if (!silent) shelf.fillStock(2);
        break;
      }
      case 'cashier': {
        const co = this.checkouts.find((c) => c.id === def.target);
        this.workers.push(new Cashier(this, co));
        break;
      }
      case 'stocker': {
        const [x, z] = def.pos;
        const st = new Stocker(this, x, z);
        st.capacity = this.stockerCapacity;
        this.workers.push(st);
        break;
      }
      case 'stockerCap':
        this.stockerCapacity = Math.max(this.stockerCapacity, def.value);
        for (const w of this.workers) if (w instanceof Stocker) w.capacity = this.stockerCapacity;
        break;
      case 'shelfStage':
        this.shelves.find((s) => s.id === def.target)?.setStage(def.value);
        break;
      case 'door':
        this.door2Open = true;
        this.world.openDoor2();
        break;
      case 'cleaner':
        this.workers.push(new Cleaner(this, def.pos[0], def.pos[1]));
        break;
      case 'manager':
        this.workers.push(new Manager(this, def.pos[0], def.pos[1]));
        break;
      case 'parking':
        this.traffic.lot.setStage(def.value);
        break;
      case 'ads':
        this.adBoost += ADS[def.target];
        if (def.target === 'advertiser') this.workers.push(new Advertiser(this, 6.5, 15.4));
        else this.world.addBillboard(12.5, 11.6);
        break;
      case 'security': {
        const [x, z] = GUARD_SPOTS[def.target];
        this.workers.push(new Guard(this, x, z));
        break;
      }
      case 'depot':
        this.depot.upgrade();
        if (!silent) this.depot.autoOrder = true;
        break;
      case 'capacity':
        this.player.capacity = Math.max(this.player.capacity, def.value);
        break;
      case 'expansion':
        this.room2Open = true;
        this.world.openRoom2();
        break;
      case 'checkout':
        this.addCheckout(def.target);
        break;
    }
    if (!silent) {
      const l = this.padLabel(def);
      this.hud.toast(`${l.emoji} ${l.title} açıldı!`);
      this.audio.play('unlock');
      this.save();
    }
  }

  // ---- Ekonomi ---------------------------------------------------------------

  earn(amount, pos) {
    this.money += amount;
    this.day.today.revenue += amount;
    this.hud.setMoney(this.money);
    this.hud.bump();
    this.fx.floatText(pos, `+$${amount}`);
    this.audio.play('coin');
  }

  spend(amount, pos) {
    this.money -= amount;
    this.day.today.spent += amount;
    this.hud.setMoney(this.money);
    if (pos) this.fx.floatText(pos, `-$${amount}`, '#e04b3a');
  }

  /** Hiç para ve stok kalmadıysa oyuncu takılı kalmasın: depodan bedava ürün verilir. */
  isBroke() {
    return (
      this.player.carrying === 0 &&
      this.depot.totalStock() === 0 &&
      this.depot.trucks.length === 0 &&
      this.shelves.every((s) => s.count === 0 && s.incoming === 0) &&
      this.checkouts.every((c) => c.cash.value === 0 && c.queue.length === 0) &&
      !this.customers.some((c) => c.carrying > 0)
    );
  }

  // ---- Müşteriler ------------------------------------------------------------

  // ---- Seviye ----------------------------------------------------------------

  levelProgress() {
    const cur = LEVELS[this.level - 1];
    const next = LEVELS[this.level];
    if (next === undefined) return 1;
    return (this.xp - cur) / (next - cur);
  }

  /** Ödeme yapıp çıkan her müşteri. */
  onCustomerPaid() {
    this.xp++;
    this.rating.add(RATING.paid);
    this.day.today.customers++;
    let leveled = false;
    while (LEVELS[this.level] !== undefined && this.xp >= LEVELS[this.level]) {
      this.level++;
      leveled = true;
    }
    if (leveled) {
      const names = [...new Set(UNLOCKS.filter((u) => u.level === this.level).map((u) =>
        u.type === 'shelfStage' ? 'Raf kapasitesi' : this.padLabel(u).title))];
      this.hud.levelUp(this.level, names);
      this.audio.play('unlock');
      this.refreshPads();
      this.save();
    }
    this.hud.setLevel(this.level, this.levelProgress());
  }

  doors() {
    return this.door2Open ? [[DOOR_X, 4], [DOOR2_X, 4]] : [[DOOR_X, 4]];
  }

  nearestDoor(x) {
    return this.doors().reduce((best, d) => (Math.abs(d[0] - x) < Math.abs(best[0] - x) ? d : best));
  }

  pickCheckout(customer) {
    let best = null;
    let bestScore = Infinity;
    for (const co of this.checkouts) {
      const d = Math.hypot(co.x - customer.position.x, co.z - customer.position.z);
      const score = co.queue.length * 4 + d * 0.3;
      if (score < bestScore) {
        bestScore = score;
        best = co;
      }
    }
    return best;
  }

  /** Yaya ya da arabalı müşteri. Yaya kapasitesi dolarsa otopark gerekir. */
  trySpawn() {
    const lot = this.traffic.lot;
    const walkers = this.customers.filter((c) => !c.slot).length;
    const useCar = lot.free > 0 && (walkers >= WALK_IN_CAP || Math.random() < 0.55);
    if (useCar) {
      lot.reserve((slot) => {
        if (!this.day.isOpen) { lot.depart(slot); return; }
        slot.customer = this.spawnCustomer(slot);
      });
    } else if (walkers < WALK_IN_CAP) {
      this.spawnCustomer();
    } else {
      this.turnaways = (this.turnaways ?? 0) + 1;
      const now = performance.now();
      if (!this.lastTurnawayToast || now - this.lastTurnawayToast > 45000) {
        this.lastTurnawayToast = now;
        this.hud.toast(lot.capacity ? '🚗 Otopark dolu — müşteriler geri döndü' : '🚗 Park yeri yok — müşteriler geri döndü');
      }
    }
  }

  spawnCustomer(slot = null) {
    if (!this.shelves.length) return null;
    // Biraz da stoklu raflara yönelsinler
    const stocked = this.shelves.filter((s) => s.count > 0);
    const pool = stocked.length && Math.random() < 0.7 ? stocked : this.shelves;
    const shelf = pool[Math.floor(Math.random() * pool.length)];
    const qty = 1 + Math.floor(Math.random() * Math.min(3, 1 + this.shelves.length / 2));
    const model = CHARACTER_NAMES.filter((n) => n !== 'Barbarian')[Math.floor(Math.random() * 4)];
    const door = shelf.x > ROOM2.minX && this.door2Open ? [DOOR2_X, 4] : [DOOR_X, 4];
    const c = new Customer(this, model, shelf, qty, door, slot);
    // Yoğun saatlerde bazı yaya müşteriler hırsız
    if (!slot && this.level >= THEFT.fromLevel) {
      const chance = this.day.rush >= 1.2 ? THEFT.chanceRush : THEFT.chanceNormal;
      if (Math.random() < chance) c.thief = true;
    }
    this.customers.push(c);
    return c;
  }

  removeCustomer(c) {
    const i = this.customers.indexOf(c);
    if (i >= 0) this.customers.splice(i, 1);
  }

  // ---- Döngü -----------------------------------------------------------------

  update(dt) {
    this.input.update();
    this.updatePlayer(dt);

    this.day.update(dt);
    this.hud.setClock(this.day.day, this.day.clockText, this.day.phase);

    // Müşteri üretimi: günün saatine göre yoğunluk, kapalıyken yok
    this.dirt.enabled = this.level >= DIRT.fromLevel;
    this.rating.update(dt);
    const rush = this.day.rush * this.rating.spawnFactor * this.adBoost;
    const maxCustomers = Math.round((3 + this.shelves.length * 2) * Math.max(0.6, rush));
    const interval = Math.max(1.2, 5.5 - this.shelves.length * 0.55) / Math.max(rush, 0.01);
    this.spawnTimer -= dt;
    if (rush > 0 && this.spawnTimer <= 0) {
      this.spawnTimer = interval * (0.7 + Math.random() * 0.6);
      if (this.customers.length < maxCustomers) this.trySpawn();
    }
    this.spawnTimer = Math.min(this.spawnTimer, interval * 1.3);

    for (const c of [...this.customers]) c.update(dt);
    for (const w of this.workers) w.update(dt);
    for (const co of this.checkouts) co.update(dt);
    this.depot.update(dt);
    this.traffic.update(dt);

    // Para ve mal tamamen bittiyse toptancı hediye gönderir (oyun kilitlenmesin)
    this.timers.gift -= dt;
    if (this.timers.gift <= 0) {
      this.timers.gift = 3;
      const cheapest = Math.min(...[...this.depot.pallets.keys()].map((k) => PRODUCTS[k].cost));
      if (this.money < cheapest * 3 && this.isBroke()) {
        this.depot.order({ tomato: 6 }, { free: true });
        this.hud.toast('🎁 Toptancıdan hediye domates!');
      }
    }

    // Satın alma alanları
    for (const [id, pad] of this.pads) {
      if (pad.update(dt, this.player)) {
        pad.dispose();
        this.pads.delete(id);
        this.applyUnlock(pad.def);
        this.refreshPads();
      }
    }

    this.fx.update(dt);
    this.hud.update(dt);
    this.updateGuide(dt);
    this.updateCamera(dt);

    this.timers.save += dt;
    if (this.timers.save > 4) {
      this.timers.save = 0;
      this.save();
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    const m = this.input.move;
    p.velocity.set(m.x * p.speed, 0, m.z * p.speed);
    p.position.x += p.velocity.x * dt;
    p.position.z += p.velocity.z * dt;
    this.nav.collide(p.position, 0.45);
    p.position.x = THREE.MathUtils.clamp(p.position.x, -33, 45);
    p.position.z = THREE.MathUtils.clamp(p.position.z, -27.4, 17.5);
    p.update(dt);
    this.playerRing.position.set(p.position.x, 0.04, p.position.z);

    // Depo paletinden al
    this.timers.supply -= dt;
    if (this.timers.supply <= 0 && !p.full) {
      for (const pal of this.depot.pallets.values()) {
        if (!pal.inRange(p.position)) continue;
        if (pal.giveTo(p)) this.timers.supply = 0.12;
        else if (pal.stock === 0 && !this.warnedEmpty) {
          this.warnedEmpty = true;
          this.hud.toast(`${PRODUCTS[pal.product].emoji} stokta yok — sipariş ver 🚚`);
          setTimeout(() => (this.warnedEmpty = false), 3000);
        }
        break;
      }
    }

    // Rafa bırak
    this.timers.shelf -= dt;
    if (this.timers.shelf <= 0) {
      for (const s of this.shelves) {
        if (s.playerInRange(p.position) && s.receiveFrom(p)) {
          this.timers.shelf = 0.1;
          break;
        }
      }
    }

    // Kaçan hırsıza yetiş
    for (const c of this.customers) {
      if (c.state === 'escaping' && Math.hypot(c.position.x - p.position.x, c.position.z - p.position.z) < THEFT.playerRadius) c.caught();
    }

    // Kir lekesinin üstünde durarak temizle
    const spot = this.dirt.nearest(p.position.x, p.position.z, 0.85);
    if (spot) this.dirt.scrub(spot, dt, 1);

    // Para topla
    for (const co of this.checkouts) {
      if (co.cash.value > 0 && co.cash.playerInRange(p.position)) co.cash.collect(p);
    }
  }

  /** Oyuncuya sıradaki hedefi gösteren ok + ipucu metni. */
  updateGuide(dt) {
    const p = this.player;
    let target = null;
    let hint = '';
    const carried = p.stack.find((e) => !e.landing);
    const unserved = this.checkouts.find((c) => !c.cashier && c.queue.length > 0 && c.queue[0].readyToPay);
    const cash = this.checkouts.find((c) => c.cash.value > 0);
    const affordable = [...this.pads.values()]
      .filter((pad) => !pad.locked && this.money >= pad.remaining)
      .sort((a, b) => a.remaining - b.remaining)[0];
    const emptyShelf = [...this.shelves].sort((a, b) => a.count - b.count)[0];

    if (carried) {
      const shelf = this.shelves.find((s) => s.product === carried.product);
      if (shelf && shelf.space > 0) {
        target = [shelf.x, shelf.z];
        hint = `Kasaları ${PRODUCTS[carried.product].emoji} reyonuna bırak`;
      }
    }
    if (!target && unserved && this.stats.sold < 400) {
      target = unserved.cashierSpot;
      hint = 'Kasaya geç, müşterilerden ödeme al 💳';
    }
    if (!target && cash) {
      target = [cash.cash.x, cash.cash.z];
      hint = 'Paraları topla 💵';
    }
    const hasCleaner = this.workers.some((w) => w instanceof Cleaner);
    if (!target && !hasCleaner && this.dirt.spots.length > DIRT.tolerated) {
      const sp = this.dirt.nearest(p.position.x, p.position.z);
      target = [sp.x, sp.z];
      hint = 'Kirli zemin müşterileri kaçırıyor — lekenin üstünde dur 🧽';
    }
    if (!target && affordable) {
      target = [affordable.x, affordable.z];
      hint = `${affordable.emoji} ${affordable.title} — üzerinde durarak satın al`;
    }
    if (!target && emptyShelf && emptyShelf.count < emptyShelf.capacity / 2 && !p.full) {
      const pal = this.depot.pallets.get(emptyShelf.product);
      if (pal.stock > 0) {
        target = [pal.x, pal.zoneZ];
        hint = `Arka depodan ${PRODUCTS[emptyShelf.product].emoji} al`;
      } else if (!this.depot.incoming(emptyShelf.product)) {
        target = [this.depot.kiosk.x, this.depot.kiosk.z];
        hint = `${PRODUCTS[emptyShelf.product].emoji} bitti — depodaki noktadan sipariş ver 🚚`;
      }
    }

    if (!hint && this.stats.sold < 3) hint = 'Ekrana dokunup sürükleyerek yürü 👆';
    // Oyuncu ilerledikçe ipuçlarını kapat
    this.hud.hint(this.xp < 25 || hint.includes('🧽') ? hint : '');

    const near = !target || Math.hypot(target[0] - p.position.x, target[1] - p.position.z) < 1.6;
    this.guide.visible = !near;
    this.pointer.visible = !near;
    if (target && !near) {
      const t = performance.now() / 1000;
      this.guide.position.set(target[0], 2.9 + Math.sin(t * 5) * 0.25, target[1]);
      this.guide.rotation.y += dt * 2;
      const ang = Math.atan2(target[0] - p.position.x, target[1] - p.position.z);
      this.pointer.position.set(p.position.x + Math.sin(ang) * 1.4, 0.06, p.position.z + Math.cos(ang) * 1.4);
      this.pointer.rotation.y = ang;
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Dikey ekranda dar yatay açı yüzünden daha geniş FOV + uzaklık gerekir.
    this.camera.fov = aspect < 1 ? 50 : 40;
    const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camDistance = Math.max(8.5 / (t * aspect), 9.5 / t);
    this.camera.updateProjectionMatrix();
  }

  updateCamera(dt) {
    const p = this.player.position;
    this.cameraTarget.lerp(p, Math.min(1, dt * 6));
    const off = new THREE.Vector3(0, 0.8, 0.6).multiplyScalar(this.camDistance);
    this.camera.position.copy(this.cameraTarget).add(off);
    this.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z - 1);
    this.sun.position.set(p.x + 9, 24, p.z + 12);
    this.sun.target.position.set(p.x, 0, p.z);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ---- Kayıt -----------------------------------------------------------------

  save() {
    const data = {
      v: 2,
      money: this.money,
      xp: this.xp,
      unlocked: [...this.unlocked],
      shelves: Object.fromEntries(this.shelves.map((s) => [s.id, s.count])),
      pads: Object.fromEntries([...this.pads].filter(([, p]) => p.paid > 0).map(([id, p]) => [id, p.paid])),
      sold: this.stats.sold,
      day: this.day.serialize(),
      rating: Math.round(this.rating.value),
      dirt: this.dirt.serialize(),
      depot: this.depot.serialize(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* gizli mod vb. — kayıt olmadan devam */
    }
  }

  loadSave() {
    let data = null;
    try {
      data = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!data) {
        // Eski (v1) kayıt: para ve açılanlar korunur, XP satışlardan tahmin edilir
        const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY) || 'null');
        if (old) data = { ...old, xp: Math.floor((old.sold ?? 0) / 2), v: 2 };
      }
    } catch {
      data = null;
    }
    if (!data || data.v !== 2) {
      this.shelves[0].fillStock(4);
      for (const [k, n] of Object.entries(START_DEPOT_STOCK)) {
        const pal = this.depot.pallets.get(k);
        pal.stock = n;
        pal.syncVisual();
      }
      return;
    }
    this.money = data.money ?? START_MONEY;
    this.xp = data.xp ?? 0;
    while (LEVELS[this.level] !== undefined && this.xp >= LEVELS[this.level]) this.level++;
    this.stats.sold = data.sold ?? 0;
    this.savedPads = data.pads ?? {};
    // Bağımlılık sırasıyla uygula
    const ids = new Set(data.unlocked ?? []);
    for (const def of UNLOCKS) {
      if (ids.has(def.id)) this.applyUnlock(def, true);
    }
    for (const s of this.shelves) s.fillStock(data.shelves?.[s.id] ?? 0);
    this.day.restore(data.day);
    if (data.rating !== undefined) this.rating.value = data.rating;
    this.dirt.restore(data.dirt);
    if (data.depot) this.depot.restore(data.depot);
    else {
      // v1'den geçiş: her ürüne biraz stok
      for (const pal of this.depot.pallets.values()) { pal.stock = 10; pal.syncVisual(); }
    }
  }

  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(OLD_SAVE_KEY);
    } catch {
      /* yok say */
    }
    this.resetting = true;
    location.reload();
  }
}

// ---- Küçük görsel yardımcılar -----------------------------------------------------

function makeRing() {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 32),
    new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}

function makeGuideArrow() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x35b8ff, emissive: 0x0d4f7a, roughness: 0.4 });
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.8, 4), mat);
  head.rotation.x = Math.PI;
  g.add(head);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.42), mat);
  shaft.position.y = 0.7;
  g.add(shaft);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function makeGroundPointer() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.45);
  shape.lineTo(0.38, -0.2);
  shape.lineTo(0, -0.05);
  shape.lineTo(-0.38, -0.2);
  shape.closePath();
  const m = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({ color: 0x35b8ff, transparent: true, opacity: 0.9, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  const g = new THREE.Group();
  // Şekil +y yönünü gösteriyor → yere yatırınca -z; grubun +z'ye bakması için çevir
  m.rotation.z = Math.PI;
  g.add(m);
  m.renderOrder = 3;
  return g;
}
