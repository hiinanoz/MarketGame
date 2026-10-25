import * as THREE from 'three';
import { Character, makeCrate } from './character.js';
import { textTexture } from './fx.js';
import { PRODUCTS, BUSINESSES, STAFF, VALLEY_FRONT_Z, MODULE_DEPTH, XP_PER_PROFIT, XP_PER_PURCHASE } from './config.js';

// Holding işletmeleri (tedarik vadisi). Yönetim odaklı: satın al → modül ekle → kadro ata.
// Üretim kendiliğinden yürür; müdür yokken oyuncu işletmedeyse tam hız, değilse yavaş.
// Ürün önce markete (depo paletleri) gider; fazlası işletme deposunda birikir, muhasebeci satar.

export class Business {
  constructor(game, id) {
    this.game = game;
    this.id = id;
    this.def = BUSINESSES[id];
    this.owned = false;
    this.modules = 0;          // satın alınınca 1
    this.workers = 0;
    this.manager = false;
    this.accountant = false;
    this.storage = {};         // ürün → kasa
    this.timer = 0;
    this.turn = 0;
    this.shipTimer = 0;
    this.today = blank();
    this.yesterday = null;
    this.staffChars = [];
    this.autoGrow = true;      // müdür + muhasebeci varken işletme kendini büyütür
    this.manualT = 0;
    this.pickT = 0;
    this.indepT = 3;

    const { x, w } = this.def.plot;
    this.x = x;
    this.w = w;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.moduleGroup = new THREE.Group();
    this.root.add(this.moduleGroup);
    this.buildFront();
    this.buildSign();
  }

  // ---- Durum ----

  get name() { return this.def.name; }
  get maxModules() { return this.def.modules.length; }
  get stored() { return Object.values(this.storage).reduce((a, b) => a + b, 0); }
  get workerSlots() { return this.modules * STAFF.workersPerModule; }

  /** Satın alma/modül için seviye ve para durumu. */
  nextModule() {
    if (!this.owned || this.modules >= this.maxModules) return null;
    return this.def.modules[this.modules];
  }

  get playerHere() {
    const p = this.game.player.position;
    return Math.abs(p.x - this.x) < this.w / 2 + 1 && p.z < VALLEY_FRONT_Z + 3 && p.z > this.backZ - 2;
  }

  /** Oyuncu modüllerin içinde mi (elle hasat/üretim). */
  get playerWorking() {
    const p = this.game.player.position;
    return this.owned && Math.abs(p.x - this.x) < this.w / 2 - 0.5 && p.z < VALLEY_FRONT_Z - 6 && p.z > this.backZ;
  }

  /** İşletme deposundan kasa alma alanı (ön tarafta). */
  get pickupSpot() {
    return [this.x + Math.min(this.w / 2 - 2, 5.5), VALLEY_FRONT_Z + 1.6];
  }

  /** Bağımsız: müdür + muhasebeci varsa işletme kendi kendini yönetir. */
  get independent() {
    return this.manager && this.accountant;
  }

  /** İşletmenin toplam değeri (kredi limiti için). */
  get value() {
    if (!this.owned) return 0;
    let v = this.def.price;
    for (let i = 1; i < this.modules; i++) v += this.def.modules[i].cost ?? 0;
    return v;
  }

  get backZ() {
    return VALLEY_FRONT_Z - 4 - Math.max(1, this.modules) * MODULE_DEPTH;
  }

  /** Üretim hızı çarpanı (0..1). */
  get efficiency() {
    if (!this.owned || !this.workerSlots) return 0;
    const staff = Math.min(1, this.workers / this.workerSlots);
    const boss = this.manager || this.playerHere ? 1 : STAFF.noManagerRate;
    return staff * boss;
  }

  get dailyWages() {
    const w = STAFF.wage;
    return this.workers * w.worker + (this.manager ? w.manager : 0) + (this.accountant ? w.accountant : 0);
  }

  // ---- İşlemler ----

  buy() {
    const g = this.game;
    if (this.owned || g.level < this.def.level || g.money < this.def.price) return false;
    g.spend(this.def.price);
    this.owned = true;
    this.modules = 1;
    this.workers = STAFF.workersPerModule; // eski sahibin işçileri kalır
    this.rebuild();
    g.gainXp(Math.floor(this.def.price / XP_PER_PURCHASE));
    g.hud.toast(`🤝 ${this.def.emoji} ${this.name} artık senin!`);
    g.audio.play('unlock');
    g.save();
    return true;
  }

  expand() {
    const g = this.game;
    const m = this.nextModule();
    if (!m || g.level < m.level || g.money < m.cost) return false;
    g.spend(m.cost);
    this.modules++;
    this.rebuild();
    g.gainXp(Math.floor(m.cost / XP_PER_PURCHASE));
    g.hud.toast(`🏗️ ${this.name}: ${this.modules}. modül eklendi`);
    g.audio.play('unlock');
    g.save();
    return true;
  }

  hire(role) {
    const g = this.game;
    const cost = STAFF.hire[role];
    if (!this.owned || g.money < cost) return false;
    if (role === 'worker' && this.workers >= this.workerSlots) return false;
    if (role !== 'worker' && (this[role] || g.level < STAFF.levels[role])) return false;
    g.spend(cost);
    if (role === 'worker') this.workers++;
    else this[role] = true;
    this.rebuildStaff();
    g.audio.play('cash');
    g.save();
    return true;
  }

  /** Depodaki fazlayı toptan sat. */
  sellSurplus(keep = 0) {
    let n = 0;
    let income = 0;
    for (const [p, q] of Object.entries(this.storage)) {
      const sell = Math.max(0, q - keep);
      if (!sell) continue;
      this.storage[p] -= sell;
      n += sell;
      income += Math.round(sell * PRODUCTS[p].cost * STAFF.surplusPrice);
    }
    if (income) {
      this.game.money += income;
      this.game.hud.setMoney(this.game.money);
      this.today.sales += income;
    }
    return { n, income };
  }

  // ---- Zaman ----

  update(dt) {
    for (const c of this.staffChars) c.update(dt);
    if (!this.owned) return;
    this.updateManual(dt);
    this.updateIndependent(dt);
    // Üretim
    const eff = this.efficiency;
    if (eff > 0 && this.stored < STAFF.storage) {
      this.timer += dt * eff * this.modules;
      while (this.timer >= this.def.interval) {
        this.timer -= this.def.interval;
        const p = this.def.products[this.turn++ % this.def.products.length];
        this.storage[p] = (this.storage[p] ?? 0) + 1;
        this.today.produced++;
      }
    }
    // Markete sevkiyat: marketin depo paletlerinde yer varsa kamyonla gönder
    this.shipTimer -= dt;
    if (this.shipTimer <= 0) {
      this.shipTimer = 6;
      const depot = this.game.depot;
      const items = {};
      let n = 0;
      for (const [p, q] of Object.entries(this.storage)) {
        if (!q || !depot.pallets.has(p)) continue;
        const room = depot.room(p);
        const send = Math.min(q, room);
        if (send > 0) {
          items[p] = send;
          this.storage[p] -= send;
          n += send;
          this.today.supplied += send * this.game.supply.costOf(p);
        }
      }
      if (n) depot.order(items, { free: true });
      // Muhasebeci fazlayı satar (depoda biraz bırakır)
      if (this.accountant && this.stored > STAFF.storage * 0.5) this.sellSurplus(5);
    }
    this.updateLabel();
  }

  /** Oyuncu tarlada/üretim hattında çalışırsa ekstra üretim; ön taraftaki alandan kasa alabilir. */
  updateManual(dt) {
    const g = this.game;
    const p = g.player;
    if (this.playerWorking && this.stored < STAFF.storage) {
      this.manualT += dt;
      if (this.manualT >= 1.1) {
        this.manualT = 0;
        const prod = this.def.products[this.turn++ % this.def.products.length];
        this.storage[prod] = (this.storage[prod] ?? 0) + 1;
        this.today.produced++;
        g.fx.floatText(p.position.clone(), `+1 ${PRODUCTS[prod].emoji}`, '#2f7a2f');
        g.audio.play('pick', 0.3);
      }
    }
    // Depodan kasa al (markete ya da reyona kendin taşı)
    const [px, pz] = this.pickupSpot;
    if (Math.abs(p.position.x - px) < 1.2 && Math.abs(p.position.z - pz) < 1.2 && !p.full) {
      this.pickT -= dt;
      if (this.pickT <= 0) {
        const prod = Object.keys(this.storage).find((k) => this.storage[k] > 0);
        if (prod) {
          this.pickT = 0.15;
          this.storage[prod]--;
          const mesh = makeCrate(prod);
          mesh.position.set(px, 1, pz);
          g.scene.add(mesh);
          p.receive(mesh, prod);
          g.audio.play('pick');
        }
      }
    }
  }

  /** Müdür + muhasebeci: eksik işçiyi alır, para yetince yeni modül ekler. */
  updateIndependent(dt) {
    if (!this.independent) return;
    this.indepT -= dt;
    if (this.indepT > 0) return;
    this.indepT = 5;
    const g = this.game;
    const reserve = 1500 + g.level * 100;
    if (this.workers < this.workerSlots && g.money - STAFF.hire.worker > reserve) {
      this.hire('worker');
      return;
    }
    const m = this.nextModule();
    if (this.autoGrow && m && g.level >= m.level && g.money - m.cost > reserve * 2) this.expand();
  }

  /** Gün sonu: maaşlar ödenir, kâr hesaplanır, XP. */
  endOfDay() {
    if (!this.owned) return null;
    const wages = this.dailyWages;
    this.game.money -= wages;
    this.today.wages = wages;
    const profit = this.today.sales + this.today.supplied - wages;
    this.today.profit = profit;
    if (profit > 0) this.game.gainXp(Math.floor(profit / XP_PER_PROFIT));
    this.yesterday = this.today;
    this.today = blank();
    return this.yesterday;
  }

  // ---- Görsel ----

  buildFront() {
    const g = new THREE.Group();
    const kind = this.def.kind;
    const color = { field: 0xb5523b, barn: 0xc0392b, hall: 0xd9c7a5 }[kind];
    const roofColor = { field: 0x5d4037, barn: 0x5d4037, hall: 0x546e7a }[kind];
    const w = Math.min(this.w - 4, 9);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 3.4, 5), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    body.position.set(0, 1.7, -2.8);
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-w / 2 - 0.3, 0);
    roofShape.lineTo(w / 2 + 0.3, 0);
    roofShape.lineTo(0, 1.8);
    roofShape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 5.4, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.8 }));
    roof.position.set(0, 3.4, -5.5);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.1), new THREE.MeshStandardMaterial({ color: 0xf5f0e6 }));
    door.position.set(0, 1.2, -0.25);
    for (const m of [body, roof, door]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    // Çit (arsa sınırı)
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.9 });
    this.fence = new THREE.Group();
    g.add(this.fence);
    this.fenceMat = fenceMat;
    g.position.set(this.x, 0, VALLEY_FRONT_Z);
    this.root.add(g);
    this.front = g;
    // Kasa alma alanı
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(255,183,3,0.45)';
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 8;
    ctx.setLineDash([14, 9]);
    ctx.beginPath();
    ctx.roundRect(6, 6, 116, 116, 18);
    ctx.fill();
    ctx.stroke();
    ctx.font = '54px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📦', 64, 66);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.pickupPad = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    this.pickupPad.rotation.x = -Math.PI / 2;
    const [ppx, ppz] = this.pickupSpot;
    this.pickupPad.position.set(ppx, 0.03, ppz);
    this.pickupPad.visible = false;
    this.root.add(this.pickupPad);
    this.rebuild();
  }

  buildSign() {
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    this.label.renderOrder = 6;
    this.label.position.set(this.x, 6.4, VALLEY_FRONT_Z - 2);
    this.root.add(this.label);
    this.updateLabel(true);
  }

  updateLabel(force = false) {
    const g = this.game;
    let text;
    if (this.owned) text = `${this.def.emoji} ${this.name} · ${this.modules}/${this.maxModules}`;
    else if (g.level < this.def.level) text = `${this.def.emoji} ${this.def.owner} · 🔒 Sv.${this.def.level}`;
    else text = `${this.def.emoji} SATILIK $${this.def.price.toLocaleString('tr-TR')}`;
    if (!force && text === this.labelText) return;
    this.labelText = text;
    this.label.material.map?.dispose();
    const tex = textTexture(text, { color: this.owned ? '#1e5d2b' : '#5a3a10', size: 44, stroke: '#ffffff' });
    this.label.material.map = tex;
    this.label.material.needsUpdate = true;
    const aspect = tex.image.width / tex.image.height;
    this.label.scale.set(0.9 * aspect, 0.9, 1);
  }

  rebuild() {
    if (this.pickupPad) this.pickupPad.visible = this.owned;
    // Modüller: arkaya doğru eklenen tarla/ahır/hat şeritleri
    this.moduleGroup.clear();
    const count = Math.max(1, this.modules);
    for (let i = 0; i < count; i++) {
      const z = VALLEY_FRONT_Z - 6 - i * MODULE_DEPTH - MODULE_DEPTH / 2;
      this.moduleGroup.add(moduleMesh(this.def.kind, this.w - 2, MODULE_DEPTH - 1.2, this.x, z, this.owned ? 1 : 0.55, i));
    }
    // Çit
    this.fence.clear();
    const depth = 6 + count * MODULE_DEPTH;
    const postGeo = new THREE.BoxGeometry(0.2, 1, 0.2);
    for (const side of [-1, 1]) {
      for (let d = 0; d <= depth; d += 2.5) {
        const post = new THREE.Mesh(postGeo, this.fenceMat);
        post.position.set(side * (this.w / 2), 0.5, -d);
        this.fence.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, depth), this.fenceMat);
      rail.position.set(side * (this.w / 2), 0.75, -depth / 2);
      this.fence.add(rail);
    }
    this.rebuildStaff();
    if (this.label) this.updateLabel(true);
  }

  rebuildStaff() {
    for (const c of this.staffChars) this.game.scene.remove(c.root);
    this.staffChars = [];
    if (!this.owned) return;
    const shown = Math.min(this.workers, 6);
    for (let i = 0; i < shown; i++) {
      const mod = i % Math.max(1, this.modules);
      const z = VALLEY_FRONT_Z - 6 - mod * MODULE_DEPTH - 2 - (i % 3) * 2.5;
      this.staffChars.push(new FieldWorker(this.game, this.x - this.w / 2 + 2 + ((i * 3.1) % (this.w - 4)), z, this));
    }
    if (this.manager) this.staffChars.push(new Standing(this.game, 'Knight', 'red', this.x - 2.6, VALLEY_FRONT_Z + 1.2));
    if (this.accountant) this.staffChars.push(new Standing(this.game, 'Mage', 'blue', this.x + 2.6, VALLEY_FRONT_Z + 1.2));
  }

  serialize() {
    return {
      owned: this.owned, modules: this.modules, workers: this.workers, manager: this.manager,
      accountant: this.accountant, storage: this.storage, yesterday: this.yesterday, autoGrow: this.autoGrow,
    };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this, {
      owned: !!d.owned, modules: d.modules ?? 0, workers: d.workers ?? 0, manager: !!d.manager,
      accountant: !!d.accountant, storage: d.storage ?? {}, yesterday: d.yesterday ?? null,
      autoGrow: d.autoGrow ?? true,
    });
    this.rebuild();
  }
}

function blank() {
  return { produced: 0, supplied: 0, sales: 0, wages: 0, profit: 0 };
}

// ---- Modül görselleri --------------------------------------------------------------------

const cropColors = [0x4fa34a, 0x6cc25f, 0x8bc34a, 0x3e8e41];
let cropGeo;

function moduleMesh(kind, w, d, x, z, alpha, index) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  if (kind === 'field') {
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x8d6e4a, roughness: 1, transparent: alpha < 1, opacity: alpha }));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.01;
    soil.receiveShadow = true;
    g.add(soil);
    cropGeo ??= new THREE.IcosahedronGeometry(0.32, 0);
    const rows = Math.floor(d / 1.6);
    const cols = Math.floor(w / 1.1);
    const mat = new THREE.MeshStandardMaterial({ color: cropColors[index % cropColors.length], flatShading: true, transparent: alpha < 1, opacity: alpha });
    const inst = new THREE.InstancedMesh(cropGeo, mat, rows * cols);
    const m = new THREE.Matrix4();
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const s = 0.8 + ((r * 7 + c * 3) % 5) * 0.08;
        m.makeScale(s, s, s);
        m.setPosition(-w / 2 + 0.6 + c * 1.1, 0.25, -d / 2 + 0.8 + r * 1.6);
        inst.setMatrixAt(k++, m);
      }
    }
    inst.castShadow = true;
    g.add(inst);
  } else if (kind === 'barn') {
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x9ccc65, roughness: 1, transparent: alpha < 1, opacity: alpha }));
    pen.rotation.x = -Math.PI / 2;
    pen.position.y = 0.01;
    g.add(pen);
    const shed = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, 2.2, d * 0.6), new THREE.MeshStandardMaterial({ color: 0xa1887f, transparent: alpha < 1, opacity: alpha }));
    shed.position.set(-w * 0.22, 1.1, 0);
    shed.castShadow = true;
    g.add(shed);
    // İnekler (basit)
    const cowMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    for (let i = 0; i < 3; i++) {
      const cow = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.6), cowMat);
      body.position.y = 0.7;
      const spot = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.62), spotMat);
      spot.position.set(0.2, 0.7, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), cowMat);
      head.position.set(0.75, 0.9, 0);
      for (const m of [body, spot, head]) { m.castShadow = true; cow.add(m); }
      cow.position.set(w * 0.2, 0, -d / 3 + i * (d / 3));
      cow.rotation.y = i * 1.3;
      g.add(cow);
    }
  } else {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 1, transparent: alpha < 1, opacity: alpha }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    g.add(floor);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 3, d * 0.85), new THREE.MeshStandardMaterial({ color: 0xe0d6c2, transparent: alpha < 1, opacity: alpha }));
    hall.position.y = 1.5;
    hall.castShadow = true;
    g.add(hall);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.3, d * 0.87), new THREE.MeshStandardMaterial({ color: 0x607d8b }));
    roof.position.y = 3.1;
    g.add(roof);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 2), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
    chimney.position.set(w * 0.3, 4, 0);
    g.add(chimney);
  }
  return g;
}

// ---- İşletme karakterleri -------------------------------------------------------------------

class FieldWorker extends Character {
  constructor(game, x, z, biz) {
    super(game, 'Rogue', { speed: 1.8, look: 'uniform' });
    this.position.set(x, 0, z);
    this.home = [x, z];
    this.biz = biz;
    this.t = Math.random() * 5;
    game.scene.add(this.root);
  }

  update(dt) {
    this.t -= dt;
    if (this.t <= 0 && !this.path) {
      this.t = 3 + Math.random() * 4;
      // Modül içinde kısa yürüyüş ya da çalışma (nav kullanmadan düz yol)
      if (Math.random() < 0.5) {
        this.path = [[this.home[0] + (Math.random() - 0.5) * 3, this.home[1] + (Math.random() - 0.5) * 3]];
        this.busyAnim = false;
      } else {
        this.busyAnim = true;
        this.play('Interact');
      }
    }
    this.followPath(dt);
    super.update(dt);
  }
}

class Standing extends Character {
  constructor(game, model, cap, x, z) {
    super(game, model, { speed: 2, look: 'uniform', cap });
    this.position.set(x, 0, z);
    this.heading = 0;
    this.root.rotation.y = 0;
    game.scene.add(this.root);
  }
}
