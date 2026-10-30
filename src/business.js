import * as THREE from 'three';
import { t, num } from './i18n.js';
import { Character, makeCrate } from './character.js';
import { textTexture } from './fx.js';
import { PRODUCTS, BUSINESSES, STAFF, VALLEY_FRONT_Z, MODULE_DEPTH, XP_PER_PROFIT, XP_PER_PURCHASE, LOGISTICS, DAY, MEDIA } from './config.js';
import { prop } from './assets.js';

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
    this.storage = {};         // ürün → kasa
    this.timer = 0;
    this.turn = 0;
    this.shipTimer = 0;
    this.today = blank();
    this.yesterday = null;
    this.staffChars = [];
    this.autoGrow = true;      // müdür varken işletme kendini büyütür
    this.manualT = 0;
    this.pickT = 0;
    this.indepT = 3;
    this.seized = false;       // banka el koydu (borç ödenince geri alınabilir)
    this.seizedPrice = 0;

    const { x, w } = this.def.plot;
    this.x = x;
    this.w = w;
    const B = this.def.building;
    // Hazır bina: ön cephe caddeye bakar (facing -1: binanın kuzeyi = caddenin güneyindeki binalar)
    this.bHalf = B ? (B.size ? B.size[1] / 2 : B.scale / 2) : 0;
    this.frontZ = B ? B.z + (B.facing === -1 ? -1 : 1) * (this.bHalf + 0.2) : this.def.frontZ ?? VALLEY_FRONT_Z;
    this.leased = false;       // kiralık (haftalık kira öder, ileride satın alınabilir)
    this.customName = '';      // oyuncunun verdiği isim
    this.battery = false;      // güneş tarlası: batarya deposu
    this.energyToday = 0;      // bugün üretilen elektrik (birim)
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.moduleGroup = new THREE.Group();
    this.root.add(this.moduleGroup);
    this.buildFront();
    this.buildSign();
  }

  // ---- Durum ----

  get name() { return this.customName || this.def.name; }
  get isEnergy() { return !!this.def.energy; }
  get perModule() { return this.def.workersPerModule ?? STAFF.workersPerModule; }
  staffLevel(role) { return this.def.staffLevels?.[role] ?? STAFF.levels[role]; }
  /** Tam kadroyla günlük elektrik üretimi (birim = $1'lık elektrik). */
  get energyCapacity() { return this.isEnergy ? Math.round(this.def.energyPerModule * this.modules * this.efficiency) : 0; }
  get isLogistics() { return this.def.kind === 'garage'; }
  /** Hazır binada çalışan işletme (market şubesi, medya): arsa/modül şeridi yok. */
  get isBuilding() { return !!this.def.building; }
  /** Hizmet geliri (şube cirosu, medya reklam geliri): tam kadroyla günlük. */
  get serviceIncome() {
    if (!this.def.revenuePerModule) return 0;
    const boost = ['shop', 'mall', 'restaurant', 'hotel'].includes(this.def.kind) && this.game.holding?.mediaOwned ? MEDIA.salesBoost : 1;
    return Math.round(this.def.revenuePerModule * this.modules * this.efficiency * boost);
  }
  /** Kiralıksa haftalık kira (büyüdükçe artar). */
  get weeklyRent() {
    const l = this.def.lease;
    return this.owned && this.leased && l ? l.weekly + l.perModule * Math.max(0, this.modules - 1) : 0;
  }
  get canBuyOut() {
    return this.owned && this.leased && this.game.level >= this.def.lease.buyLevel;
  }
  get trucks() { return this.modules * (this.def.trucksPerModule ?? 0); }
  /** Lojistik: tam kadroyla beklenen günlük taşıma geliri. */
  get contractIncome() { return Math.round(LOGISTICS.contractPerTruck * this.trucks * this.efficiency); }
  /** Satın almak için önce alınması gereken işletmeler. */
  get missingReq() {
    return (this.def.requiresAll ?? []).filter((id) => !this.game.holding?.get(id)?.owned);
  }
  get maxModules() { return this.def.modules.length; }
  get stored() { return Object.values(this.storage).reduce((a, b) => a + b, 0); }
  get workerSlots() { return this.modules * this.perModule; }

  /** Satın alma/modül için seviye ve para durumu. */
  nextModule() {
    if (!this.owned || this.modules >= this.maxModules) return null;
    return this.def.modules[this.modules];
  }

  get playerHere() {
    const p = this.game.player.position;
    if (this.isBuilding) return Math.hypot(p.x - this.x, p.z - this.frontZ) < 5;
    return Math.abs(p.x - this.x) < this.w / 2 + 1 && p.z < this.frontZ + 3 && p.z > this.backZ - 2;
  }

  /** Oyuncu modüllerin içinde mi (elle hasat/üretim). */
  get playerWorking() {
    const p = this.game.player.position;
    return this.owned && Math.abs(p.x - this.x) < this.w / 2 - 0.5 && p.z < this.frontZ - 6 && p.z > this.backZ;
  }

  /** İşletme deposundan kasa alma alanı (ön tarafta). */
  get pickupSpot() {
    return [this.x + Math.min(this.w / 2 - 2, 5.5), this.frontZ + 1.6];
  }

  /** Bağımsız: müdür varsa işletme kendi kendini yönetir (işçi alır, isterse büyür). */
  get independent() {
    return this.manager;
  }

  /** Eski kayıtlardaki muhasebecinin işini artık müdür yapar (fazla satış, şebeke satışı). */
  get accountant() {
    return this.manager;
  }

  /** İşletmenin toplam değeri (kredi limiti için). */
  get value() {
    return this.owned ? this.fullValue : 0;
  }

  /** Arsa + modüllerin değeri (sahibi kim olursa olsun). */
  get fullValue() {
    let v = this.leased ? 0 : this.def.price; // kiralıkta arsa/bina senin değil
    for (let i = 1; i < this.modules; i++) v += this.def.modules[i].cost ?? 0;
    return v;
  }

  get backZ() {
    return this.frontZ - 4 - Math.max(1, this.modules) * MODULE_DEPTH;
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
    return this.workers * w.worker + (this.manager ? w.manager : 0);
  }

  // ---- İşlemler ----

  buy() {
    const g = this.game;
    if (this.owned || this.seized || g.level < this.def.level || g.money < this.def.price || this.missingReq.length) return false;
    g.spend(this.def.price);
    this.owned = true;
    this.modules = 1;
    this.workers = this.def.startWorkers ?? this.perModule; // tedarikçide eski işçiler kalır, şubede kadroyu sen kurarsın
    this.leased = !!this.def.lease;
    this.rebuild();
    this.rebuildStaff();
    if (this.isLogistics) g.depot.refreshFleet?.();
    g.gainXp(Math.floor(this.def.price / XP_PER_PURCHASE));
    g.hud.toast(this.leased ? `🔑 ${this.def.emoji} ${t('{name} kiralandı (haftalık ${n})', { name: this.name, n: this.weeklyRent })}` : `🤝 ${this.def.emoji} ${t('{name} artık senin!', { name: this.name })}`);
    if (this.isBuilding && !this.workers) g.later.push({ t: 1.8, fn: () => g.hud.toast(t('👥 Şimdi müdür ve çalışan ata (💼 tablet)')) });
    g.audio.play('unlock');
    g.save();
    return true;
  }

  /** Banka işletmeye el koyar: kadro dağılır, modüller kalır. */
  seize(price) {
    this.owned = false;
    this.seized = true;
    this.seizedPrice = price;
    this.workers = 0;
    this.manager = false;
    this.storage = {};
    this.rebuild();
    this.rebuildStaff();
    this.updateLabel(true);
  }

  /** Borçlar kapandıysa bankadan geri satın al. */
  buyBack() {
    const g = this.game;
    if (!this.seized || g.bank.totalDebt > 0 || g.money < this.seizedPrice) return false;
    g.spend(this.seizedPrice);
    this.seized = false;
    this.owned = true;
    this.workers = Math.min(this.perModule, this.workerSlots);
    this.rebuild();
    this.rebuildStaff();
    g.hud.toast(`🤝 ${this.def.emoji} ${t('{name} bankadan geri alındı', { name: this.name })}`);
    g.audio.play('unlock');
    g.save();
    return true;
  }

  /** Bordro listesi (pahalıdan ucuza değil, kıdem sırasıyla: müdür, işçiler). */
  payrollEntries() {
    if (!this.owned) return [];
    const W = STAFF.wage;
    const out = [];
    const self = this;
    const lbl = `${this.def.emoji} ${this.name}`;
    const wn = this.def.workerName ?? t('işçi');
    if (this.manager) out.push({ wage: W.manager, label: t('{name} müdürü', { name: lbl }), biz: this, fire() { self.manager = false; self.rebuildStaff(); } });
    for (let i = 0; i < this.workers; i++) out.push({ wage: W.worker, label: `${lbl} ${wn}`, biz: this, fire() { self.workers = Math.max(0, self.workers - 1); self.rebuildStaff(); } });
    return out;
  }

  /** Güneş tarlasına batarya: gündüz fazlası gece kullanılır. */
  buyBattery() {
    const g = this.game;
    const b = this.def.battery;
    if (!this.owned || this.battery || !b || g.level < b.level || g.money < b.cost) return false;
    g.spend(b.cost);
    this.battery = true;
    this.rebuild();
    g.gainXp(Math.floor(b.cost / XP_PER_PURCHASE));
    g.hud.toast(`🔋 ${t('{name}: batarya deposu kuruldu', { name: this.name })}`);
    g.audio.play('unlock');
    g.save();
    return true;
  }

  /** Kiralık işletmeyi satın al (kira biter). */
  buyOut() {
    const g = this.game;
    const price = this.def.lease?.buyPrice;
    if (!this.canBuyOut || g.money < price) return false;
    g.spend(price);
    this.leased = false;
    g.gainXp(Math.floor(price / XP_PER_PURCHASE));
    g.hud.toast(`🤝 ${this.def.emoji} ${t('{name} satın alındı, kira bitti', { name: this.name })}`);
    g.audio.play('unlock');
    this.updateLabel(true);
    g.save();
    return true;
  }

  rename(name) {
    this.customName = String(name ?? '').trim().slice(0, 24);
    this.updateLabel(true);
    this.game.save();
  }

  expand() {
    const g = this.game;
    const m = this.nextModule();
    if (!m || g.level < m.level || g.money < m.cost) return false;
    g.spend(m.cost);
    this.modules++;
    this.rebuild();
    g.gainXp(Math.floor(m.cost / XP_PER_PURCHASE));
    g.hud.toast(`🏗️ ${t('{name}: {n}. modül eklendi', { name: this.name, n: this.modules })}`);
    g.audio.play('unlock');
    g.save();
    return true;
  }

  hire(role) {
    const g = this.game;
    const cost = STAFF.hire[role];
    if (!this.owned || g.money < cost) return false;
    if (role === 'worker' && this.workers >= this.workerSlots) return false;
    if (role !== 'worker' && (this[role] || g.level < this.staffLevel(role))) return false;
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
      // Lojistik firması varsa fazla, sözleşmeyle rakip marketlere daha iyi fiyata gider
      const price = this.game.holding?.logisticsOwned ? LOGISTICS.rivalPrice : STAFF.surplusPrice;
      income += Math.round(sell * PRODUCTS[p].cost * price);
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
    this.updateIndependent(dt);
    if (this.isLogistics) {
      this.updateLogistics(dt);
      return;
    }
    if (this.def.revenuePerModule) {
      this.accrue(this.serviceIncome, dt);
      this.updateLabel();
      return;
    }
    if (this.isEnergy) {
      // Elektrik üretimi (güneş sadece gündüz, rüzgâr günün rüzgârına göre)
      const f = this.game.energy.factor(this.def.energy);
      this.energyToday += this.def.energyPerModule * this.modules * this.efficiency * f * dt / DAY.length;
      this.updateLabel();
      return;
    }
    this.updateManual(dt);
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
      if (n) {
        depot.order(items, { free: true });
        // Kendi lojistik firman yoksa dış nakliye ücreti
        if (!this.game.holding.logisticsOwned) {
          const fee = n * LOGISTICS.freightPerCrate;
          this.game.money -= fee;
          this.today.freight += fee;
        }
      }
      // Muhasebeci fazlayı satar (depoda biraz bırakır)
      if (this.accountant && this.stored > STAFF.storage * 0.5) this.sellSurplus(5);
    }
    this.updateLabel();
  }

  /** Lojistik: boştaki kamyonlar başka firmalara taşıma yapar, gelir gün boyu kasaya akar. */
  updateLogistics(dt) {
    this.accrue(LOGISTICS.contractPerTruck * this.trucks * this.efficiency, dt);
    this.updateLabel();
  }

  /** Günlük geliri gün boyunca (mağaza açıkken) kasaya akıt. */
  accrue(perDay, dt) {
    if (this.game.day.phase !== 'open') return;
    this.cashT = (this.cashT ?? 0) + perDay * dt / DAY.length;
    if (this.cashT >= 1) {
      const n = Math.floor(this.cashT);
      this.cashT -= n;
      this.game.money += n;
      this.today.sales += n;
      this.game.hud.setMoney(this.game.money);
    }
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
          p.receive(mesh, prod, { ext: true });
          g.audio.play('pick');
        }
      }
    }
  }

  /** Müdür: eksik işçiyi alır, para yetince yeni modül ekler. */
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
    const wages = this.today.wages; // bordroda ödendi (game.payroll)
    const profit = this.today.sales + this.today.supplied - wages - (this.today.freight ?? 0);
    this.today.profit = profit;
    if (profit > 0) this.game.gainXp(Math.floor(profit / XP_PER_PROFIT));
    this.yesterday = this.today;
    this.today = blank();
    this.energyToday = 0;
    return this.yesterday;
  }

  // ---- Görsel ----

  buildFront() {
    if (this.isBuilding) {
      // Hazır bina (Kenney City Builder, MIT)
      const b = this.def.building;
      let m;
      if (b.procedural) m = proceduralBuilding(b.procedural, b.size);
      else {
        m = prop(b.model);
        m.scale.setScalar(b.scale);
      }
      m.position.set(this.x, 0, b.z);
      if (b.facing === -1) m.rotation.y = Math.PI;
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.root.add(m);
      this.front = m;
      this.fence = new THREE.Group();
      const hw = b.size ? b.size[0] / 2 : b.scale / 2;
      this.game.nav.setBox(`biz-${this.id}`, { minX: this.x - hw, maxX: this.x + hw, minZ: b.z - this.bHalf, maxZ: b.z + this.bHalf });
      this.rebuild();
      return;
    }
    const g = new THREE.Group();
    const kind = this.def.kind;
    const color = { field: 0xb5523b, barn: 0xc0392b, hall: 0xd9c7a5, garage: 0x4f7cac, solar: 0xf2c14e, wind: 0xe8eef2, hydro: 0xb0bec5 }[kind];
    const roofColor = { field: 0x5d4037, barn: 0x5d4037, hall: 0x546e7a, garage: 0x37474f, solar: 0x3b5b8c, wind: 0x4a7a9a, hydro: 0x37627e }[kind];
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
    if (kind === 'garage') {
      // Lojistik deposu (Kenney City Kit Industrial, CC0)
      const wh = prop('ki-building-i');
      wh.scale.setScalar(5);
      wh.position.set(2.15, 0, -4.15);
      wh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(wh);
    } else {
      for (const m of [body, roof, door]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
    }
    // Çit (arsa sınırı)
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.9 });
    this.fence = new THREE.Group();
    g.add(this.fence);
    this.fenceMat = fenceMat;
    g.position.set(this.x, 0, this.frontZ);
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
    if (this.isBuilding) this.label.position.set(this.x, this.def.building.labelY ?? 8.2, this.def.building.z + (this.def.building.facing === -1 ? 0 : 2));
    else this.label.position.set(this.x, 6.4, this.frontZ - 2);
    this.root.add(this.label);
    this.updateLabel(true);
  }

  updateLabel(force = false) {
    const g = this.game;
    let text;
    if (this.owned) text = `${this.def.emoji} ${this.name}${this.leased ? ' 🔑' : ''} · ${this.modules}/${this.maxModules}`;
    else if (this.seized) text = `${this.def.emoji} 🏦 ${t('Bankaya ait')}`;
    else if (g.level < this.def.level) text = `${this.def.emoji} ${this.def.owner} · 🔒 ${t('Sv.{n}', { n: this.def.level })}`;
    else if (this.missingReq.length) text = `${this.def.emoji} ${this.def.owner} · 🔒 ${t('önce tedarikçiler')}`;
    else if (this.def.lease) text = `${this.def.emoji} ${t('KİRALIK · devir ${n}', { n: num(this.def.price) })}`;
    else text = `${this.def.emoji} ${t('SATILIK ${n}', { n: num(this.def.price) })}`;
    if (!force && text === this.labelText) return;
    this.labelText = text;
    this.label.material.map?.dispose();
    const tex = textTexture(text, { color: this.owned ? '#1e5d2b' : '#5a3a10', size: 44, stroke: '#ffffff' });
    this.label.material.map = tex;
    this.label.material.needsUpdate = true;
    const aspect = tex.image.width / tex.image.height;
    const k = this.isBuilding ? 0.75 : 0.9;
    this.label.scale.set(k * aspect, k, 1);
  }

  rebuild() {
    if (this.isBuilding) {
      this.rebuildStaff();
      if (this.label) this.updateLabel(true);
      return;
    }
    if (this.pickupPad) this.pickupPad.visible = this.owned && !this.isLogistics && !this.isEnergy;
    // Modüller: arkaya doğru eklenen tarla/ahır/hat şeritleri
    this.moduleGroup.clear();
    const count = Math.max(1, this.modules);
    for (let i = 0; i < count; i++) {
      const z = this.frontZ - 6 - i * MODULE_DEPTH - MODULE_DEPTH / 2;
      this.moduleGroup.add(moduleMesh(this.def.kind, this.w - 2, MODULE_DEPTH - 1.2, this.x, z, this.owned ? 1 : 0.55, i, this.def.moduleModel));
    }
    // Batarya deposu (güneş tarlasının önünde, sağda)
    if (this.battery) {
      const bat = new THREE.Group();
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.6 });
      for (let i = 0; i < 3; i++) {
        const cell = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 2.2), boxMat);
        cell.position.set(i * 1.3, 0.8, 0);
        cell.castShadow = true;
        bat.add(cell);
      }
      bat.position.set(this.x + this.w / 2 - 4.5, 0, this.frontZ - 1.5);
      this.moduleGroup.add(bat);
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
    if (this.isBuilding) {
      // Çalışanlar içeride; müdür binanın önünde gidip gelir (kapı, vitrin, müşteri)
      const dz = this.def.building.facing === -1 ? -0.9 : 0.9;
      if (this.manager) this.staffChars.push(new BizManager(this.game, this, [[this.x - 2.5, this.frontZ + dz], [this.x + 2.5, this.frontZ + dz], [this.x, this.frontZ + dz * 1.6]]));
      return;
    }
    const shown = Math.min(this.workers, 6);
    for (let i = 0; i < shown; i++) {
      const mod = i % Math.max(1, this.modules);
      const z = this.frontZ - 6 - mod * MODULE_DEPTH - 2 - (i % 3) * 2.5;
      this.staffChars.push(new FieldWorker(this.game, this.x - this.w / 2 + 2 + ((i * 3.1) % (this.w - 4)), z, this));
    }
    // Müdür modüller arasında dolaşır, işçilerin yanında durup kontrol eder
    if (this.manager) {
      const stops = [[this.x - 2.6, this.frontZ + 1.2]];
      for (let m = 0; m < Math.max(1, this.modules); m++) {
        const z = this.frontZ - 6 - m * MODULE_DEPTH - 2;
        stops.push([this.x - this.w / 4, z], [this.x + this.w / 4, z - 2]);
      }
      this.staffChars.push(new BizManager(this.game, this, stops));
    }
  }

  serialize() {
    return {
      owned: this.owned, modules: this.modules, workers: this.workers, manager: this.manager,
      storage: this.storage, yesterday: this.yesterday, autoGrow: this.autoGrow,
      seized: this.seized, seizedPrice: this.seizedPrice, customName: this.customName, battery: this.battery,
      energyToday: this.energyToday, leased: this.leased,
    };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this, {
      owned: !!d.owned, modules: d.modules ?? 0, workers: d.workers ?? 0, manager: !!d.manager || !!d.accountant,
      storage: d.storage ?? {}, yesterday: d.yesterday ?? null,
      autoGrow: d.autoGrow ?? true, seized: !!d.seized, seizedPrice: d.seizedPrice ?? 0,
      customName: d.customName ?? '', battery: !!d.battery, energyToday: d.energyToday ?? 0,
      leased: !!d.leased,
    });
    this.rebuild();
  }
}

function blank() {
  return { produced: 0, supplied: 0, sales: 0, wages: 0, freight: 0, profit: 0 };
}

// ---- Modül görselleri --------------------------------------------------------------------

const cropColors = [0x4fa34a, 0x6cc25f, 0x8bc34a, 0x3e8e41];
let cropGeo;

function moduleMesh(kind, w, d, x, z, alpha, index, model = null) {
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
    // Ahır: kırmızı gövde, beşik çatı, beyaz kapı
    const sw = w * 0.42;
    const sd = d * 0.6;
    const shed = new THREE.Mesh(new THREE.BoxGeometry(sw, 2.4, sd), new THREE.MeshStandardMaterial({ color: 0xb3412f, transparent: alpha < 1, opacity: alpha }));
    shed.position.set(-w * 0.24, 1.2, 0);
    shed.castShadow = true;
    g.add(shed);
    // Beşik çatı: üçgen kesit, ahır boyunca uzar
    const tri = new THREE.Shape();
    tri.moveTo(-sd / 2 - 0.3, 0);
    tri.lineTo(sd / 2 + 0.3, 0);
    tri.lineTo(0, 1.6);
    tri.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: sw + 0.4, bevelEnabled: false });
    roofGeo.translate(0, 0, -(sw + 0.4) / 2);
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x5d4037, flatShading: true, transparent: alpha < 1, opacity: alpha }));
    roof.rotation.y = Math.PI / 2;
    roof.position.set(-w * 0.24, 2.4, 0);
    roof.castShadow = true;
    g.add(roof);
    if (alpha >= 1) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), new THREE.MeshStandardMaterial({ color: 0xf5f5f5 }));
      door.position.set(-w * 0.24, 0.9, sd / 2 + 0.01);
      g.add(door);
      // Çit (KayKit Medieval, CC0) ve saman balyaları
      const fz = [-d / 2 + 0.3, d / 2 - 0.3];
      for (const z of fz) {
        for (let x = 0; x < w / 2 - 0.5; x += 2.2) {
          const f = prop('fence_wood_straight');
          f.scale.setScalar(2.2);
          f.position.set(x + 1.1, 0, z);
          g.add(f);
        }
      }
      const hay = prop('building_grain');
      hay.scale.setScalar(1.6);
      hay.position.set(w * 0.42, 0, -d * 0.3);
      g.add(hay);
    }
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
  } else if (kind === 'solar') {
    // Güneş paneli sırası (KayKit Space Base Bits, CC0)
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x9ccc65, roughness: 1, transparent: alpha < 1, opacity: alpha }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.01;
    g.add(pad);
    if (alpha >= 1) {
      const cols = Math.floor(w / 3.3);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < cols; c++) {
          const p = prop('solarpanel');
          p.scale.setScalar(3);
          p.position.set(-w / 2 + 1.8 + c * 3.3, 0, -d / 4 + r * (d / 2));
          g.add(p);
        }
      }
    }
  } else if (kind === 'hydro') {
    // Baraj gölü + beton set + türbin binası
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(w, d * 0.7), new THREE.MeshStandardMaterial({ color: 0x4f9fd8, roughness: 0.3, transparent: true, opacity: alpha < 1 ? 0.45 : 0.9 }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(0, 0.03, -d * 0.15);
    g.add(lake);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 0.8), new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 0.9, transparent: alpha < 1, opacity: alpha }));
    wall.position.set(0, 0.8, d * 0.22);
    wall.castShadow = true;
    g.add(wall);
    if (alpha >= 1) {
      // Türbin binası: su değirmeni (KayKit Medieval, CC0)
      const house = prop('building_watermill_green');
      house.scale.setScalar(3.2);
      house.position.set(w / 4, 0, d * 0.36);
      house.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.add(house);
    }
  } else if (kind === 'wind') {
    // Rüzgâr türbinleri (KayKit Space Base Bits, CC0)
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x8fbf5a, roughness: 1, transparent: alpha < 1, opacity: alpha }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.01;
    g.add(pad);
    if (alpha >= 1) {
      for (const side of [-1, 1]) {
        const ty = prop(index % 2 ? 'windturbine_low' : 'windturbine_tall');
        ty.scale.setScalar(4.2);
        ty.position.set(side * w / 4, 0, 0);
        ty.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        g.add(ty);
      }
    }
  } else if (kind === 'garage') {
    // Kamyon park yeri: asfalt, park çizgileri, iki kamyon (Kenney Starter Kit Racing, MIT)
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0x5b6067, roughness: 1, transparent: alpha < 1, opacity: alpha }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.01;
    pad.receiveShadow = true;
    g.add(pad);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    for (const lx of [-w / 2 + 0.4, 0, w / 2 - 0.4]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, d * 0.8), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(lx, 0.02, 0);
      g.add(line);
    }
    if (alpha >= 1) {
      for (const [i, side] of [[0, -1], [1, 1]]) {
        const ty = prop(i % 2 ? 'vehicle-truck-red' : 'vehicle-truck-green');
        ty.scale.setScalar(2.2);
        ty.position.set(side * w / 4, 0, 0);
        ty.rotation.y = (index + i) % 2 ? Math.PI : 0;
        ty.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        g.add(ty);
      }
    }
  } else {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xb0b6bd, roughness: 1, transparent: alpha < 1, opacity: alpha }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    g.add(floor);
    if (alpha >= 1 && model) {
      // Atölye binası (KayKit City Builder, CC0) + çöp konteyneri ve koliler
      const b = prop(index % 2 && model.alt ? model.alt : model.main);
      const sc = Math.min(w * 0.38, d * 0.55);
      b.scale.setScalar(sc);
      b.position.set(-w * 0.12, 0, 0);
      b.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(b);
      const dump = prop('dumpster');
      dump.scale.setScalar(3);
      dump.position.set(w * 0.36, 0, -d * 0.2);
      dump.rotation.y = -Math.PI / 2;
      g.add(dump);
      for (let i = 0; i < 3; i++) {
        const box = prop('box_A');
        box.scale.setScalar(2.6);
        box.position.set(w * 0.33 + (i % 2) * 0.7, (i === 2 ? 0.55 : 0), d * 0.22 + (i % 2) * 0.3);
        box.rotation.y = i * 0.5;
        g.add(box);
      }
    } else {
      const hall = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 3, d * 0.85), new THREE.MeshStandardMaterial({ color: 0xe0d6c2, transparent: alpha < 1, opacity: alpha }));
      hall.position.y = 1.5;
      hall.castShadow = true;
      g.add(hall);
    }
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

/** İşletme müdürü: sırayla duraklara yürür, durakta işçileri kontrol eder (pano animasyonu). */
class BizManager extends Character {
  constructor(game, biz, stops) {
    super(game, 'Knight', { speed: 2.4, look: 'uniform', cap: 'red' });
    this.stops = stops;
    this.i = 0;
    this.position.set(stops[0][0], 0, stops[0][1]);
    this.t = 1 + Math.random() * 2;
    this.root.add(managerTag());
    game.scene.add(this.root);
  }

  update(dt) {
    if (!this.path) {
      this.t -= dt;
      if (this.t <= 0) {
        this.i = (this.i + 1) % this.stops.length;
        const [x, z] = this.stops[this.i];
        this.path = [[x + (Math.random() - 0.5), z + (Math.random() - 0.5)]];
        this.busyAnim = false;
        this.t = 3 + Math.random() * 3;
        this.onArrive = () => {
          this.busyAnim = true;
          this.play('Interact');
        };
      }
    }
    this.followPath(dt);
    super.update(dt);
  }
}

/** Müdür rozeti (kırmızı daire, beyaz pano) — emoji yazı tipine bağlı değil. */
function managerTag() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e03131';
  ctx.beginPath();
  ctx.arc(32, 32, 29, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillRect(20, 16, 24, 32);
  ctx.fillStyle = '#e03131';
  ctx.fillRect(25, 24, 14, 3);
  ctx.fillRect(25, 31, 14, 3);
  ctx.fillRect(25, 38, 10, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.renderOrder = 5;
  s.scale.setScalar(0.5);
  s.position.y = 2.1;
  return s;
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

// ---- Liman bölgesi yapıları (basit) ----

function pbox(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.position.set(x, y, z);
  return m;
}

/** Ön cephesi +z'ye bakan basit yapılar (facing -1 ile döndürülür). */
function proceduralBuilding(type, [w, d]) {
  const g = new THREE.Group();
  if (type === 'port') {
    // Rıhtım, iki vinç, konteyner yığınları
    g.add(pbox(w, 0.6, d, 0x9e9e9e, 0, 0.3, 0));
    // Konteyner yığınları (Kenney City Kit Industrial, CC0): iki kat, renkli
    const kinds = ['ki-shipping-container-a', 'ki-shipping-container-b', 'ki-shipping-container-c'];
    for (let i = 0; i < 12; i++) {
      const c = prop(kinds[(i * 7) % 3]);
      c.scale.setScalar(4);
      c.rotation.y = Math.PI / 2;
      const col = i % 6;
      c.position.set(-w / 2 + 3 + col * 3.6, 0.6 + Math.floor(i / 6) * 1.4, 1.8 + (Math.floor(i / 6) ? 0 : 0));
      g.add(c);
    }
    const stack = prop('cargo_A_stacked');
    stack.scale.setScalar(2.6);
    stack.position.set(w / 2 - 2.5, 0.6, -1);
    g.add(stack);
    for (const x of [-w / 4, w / 4]) {
      for (const dx of [-1, 1]) for (const dz of [0, 2.4]) g.add(pbox(0.35, 9, 0.35, 0xf9a825, x + dx, 4.8, -d / 2 + 1 + dz));
      g.add(pbox(0.9, 0.6, 13, 0xf9a825, x, 9.5, -d / 2 + 4)); // kol denize uzanır
      g.add(pbox(1.6, 1.2, 1.6, 0x455a64, x, 8.6, -d / 2 + 2.2)); // kabin
    }
  } else if (type === 'factory') {
    // Fabrika binası, depo tankı ve konteynerler (Kenney City Kit Industrial, CC0)
    const fab = prop('ki-building-m');
    fab.scale.setScalar(Math.min(w / 1.32 * 0.62, d / 1.7));
    fab.position.set(-w * 0.12, 0, 0);
    g.add(fab);
    const tank = prop('ki-detail-tank-large');
    tank.scale.setScalar(3.2);
    tank.position.set(w * 0.33, 0, -d * 0.12);
    g.add(tank);
    for (let i = 0; i < 3; i++) {
      const c = prop(['ki-shipping-container-a', 'ki-shipping-container-b', 'ki-shipping-container-c'][i]);
      c.scale.setScalar(4);
      c.rotation.y = Math.PI / 2;
      c.position.set(-w / 2 + 2 + i * 1.7, i === 2 ? 1.4 : 0, d / 2 + 1);
      g.add(c);
    }
  } else if (type === 'airport') {
    // Pist + terminal + kule
    const runway = pbox(w, 0.06, 5, 0x424242, 0, 0.03, -d / 2 + 4);
    g.add(runway);
    for (let i = -w / 2 + 2; i < w / 2; i += 3) g.add(pbox(1.4, 0.07, 0.25, 0xffffff, i, 0.05, -d / 2 + 4));
    g.add(pbox(w * 0.6, 3.6, 5, 0xeceff1, -2, 1.8, d / 2 - 4));
    g.add(pbox(w * 0.6 + 0.4, 0.3, 5.4, 0x4fc3f7, -2, 3.75, d / 2 - 4));
    g.add(pbox(1.6, 8, 1.6, 0xcfd8dc, w / 2 - 3, 4, d / 2 - 4));
    g.add(pbox(2.6, 1.4, 2.6, 0x4fc3f7, w / 2 - 3, 8.6, d / 2 - 4));
    // Uçak
    const plane = new THREE.Group();
    plane.add(pbox(6, 0.9, 0.9, 0xffffff, 0, 1.2, 0));
    plane.add(pbox(1.2, 0.15, 6, 0xffffff, 0.3, 1.2, 0));
    plane.add(pbox(0.8, 1.4, 0.15, 0xe53935, -2.7, 1.9, 0));
    plane.position.set(-w / 4, 0, -d / 2 + 4);
    g.add(plane);
  }
  return g;
}
