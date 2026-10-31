import * as THREE from 'three';
import { t } from './i18n.js';
import { Character, makeCrate, CRATE_HEIGHT } from './character.js';
import { workerBadge } from './actors.js';
import { prop } from './assets.js';
import { ONLINE, PRODUCTS, WORKER_SPEED, PREMIUM } from './config.js';
import { formatMoney } from './hud.js';

// Online sipariş bölümü (Sv.25+): salon 2'nin arkasındaki alan.
// Müdür yardımcısı masasında siparişleri takip eder; toplayıcılar depodaki paletlerden ürün alıp
// online raflarına bırakır; kuryeler raftan siparişi alıp arka kapıdaki arabayla dağıtır.
// Personel sayısı arttıkça günlük hedef market cirosuna yaklaşır (10 kişide eşit).

const A = ONLINE.area;

export class Online {
  constructor(game) {
    this.game = game;
    this.built = false;
    this.enabled = true;   // oyuncu kapatabilir
    this.guard = 0.25;     // mağaza için palette bırakılan stok oranı
    this.refCrates = 150;  // marketin son günlerdeki ortalama günlük satışı (kasa)
    this.history = [];
    this.rack = null;
    this.cars = [];
    this.today = blank();
    this.yesterday = null;
    this.panelOpen = false;
    this.dismissed = false;
  }

  // ---- Kadro ----

  get deputy() {
    return this.game.workers.find((w) => w.role === 'deputy') ?? null;
  }

  get pickers() {
    return this.game.workers.filter((w) => w.role === 'picker');
  }

  get couriers() {
    return this.game.workers.filter((w) => w.role === 'courier');
  }

  get staffCount() {
    return (this.deputy ? 1 : 0) + this.pickers.length + this.couriers.length;
  }

  /** Çalışabilir mi? En az müdür yardımcısı + 1 toplayıcı + 1 kurye. */
  get operating() {
    return this.built && this.enabled && !!this.deputy && this.pickers.length > 0 && this.couriers.length > 0;
  }

  /** Market cirosunun ne kadarı (0..1): 3 kişide %12, 10 kişide %100. */
  get share() {
    if (!this.operating) return 0;
    return Math.max(0, Math.min(1, (this.staffCount - 2) / (ONLINE.fullStaff - 2)));
  }

  /** Bugünkü hedef (kasa). */
  get target() {
    return Math.round(Math.max(40, this.refCrates) * this.share);
  }

  /** Toplayıcı tek seferde kaç kasa taşır (hedefe göre). */
  get pickerLoad() {
    const n = Math.max(1, this.pickers.length);
    return Math.max(2, Math.min(12, Math.ceil(this.target / (n * 18))));
  }

  /** Kurye bir teslimatta kaç kasalık sipariş götürür. */
  get bagSize() {
    const n = Math.max(1, this.couriers.length);
    return Math.max(1, Math.min(40, Math.ceil(this.target / (n * 10))));
  }

  // ---- Kurulum ----

  build(silent = false) {
    if (this.built) return;
    this.built = true;
    const g = this.game;
    const s = g.scene;
    const world = g.world;
    // Zemin
    world.addFloor(A, s, ['#e8eef4', '#dde5ee']);
    // Duvarlar: sağ ve arka (arkada kurye kapısı), depo ile arası kapı, salon 2 ile arası geçiş
    for (let z = A.minZ + 2; z < A.maxZ; z += 4) world.addWall('wall', A.maxX, z, Math.PI / 2, s, `on-r${z}`);
    for (let x = A.minX + 2; x < A.maxX; x += 4) {
      if (Math.abs(x - ONLINE.gateX) < 0.1) continue;
      world.addWall('wall', x, A.minZ, 0, s, `on-b${x}`, 0.35);
    }
    world.openWallAt(A.minX, -22, 'dr-22');        // depo → online (toplayıcılar)
    world.openWallAt(ONLINE.gateX, A.maxZ, 'wb2_26'); // salon 2 → online (oyuncu)
    g.nav.boxes.delete('room2-block');
    // Müdür yardımcısının ofisi: halı, masa, sandalye, dolap, bilgisayar
    const add = (name, x, z, rotY = 0, y = 0, scale = 1) => {
      const m = prop(name);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      m.scale.setScalar(scale);
      s.add(m);
      return m;
    };
    const [dx, dz] = ONLINE.desk;
    add('rug_rectangle_stripes_A', dx, dz + 0.4, 0);
    add('table_medium', dx, dz, Math.PI / 2);
    add('chair_A', dx, dz + 1.0, Math.PI);
    add('cabinet_medium_decorated', A.minX + 0.6, -17.0, Math.PI / 2);
    add('shelf_B_large_decorated', dx + 2.4, A.maxZ + 0.5, 0);
    const pc = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.08), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x2a6f84 }));
    pc.position.set(dx, 1.3, dz - 0.15);
    s.add(pc);
    g.nav.setBox('online-desk', { minX: dx - 1.1, maxX: dx + 1.1, minZ: dz - 0.6, maxZ: A.maxZ });
    // Ayarlar alanı (masanın önü)
    this.zone = zoneMesh('🌐', 'Online');
    this.zone.position.set(ONLINE.panel[0], 0.03, ONLINE.panel[1]);
    s.add(this.zone);
    // Online sipariş rafı
    this.rack = new OrderRack(g, ...ONLINE.rack);
    // Kurye arabaları kapının dışında
    world.addFloor({ minX: A.minX, maxX: A.maxX + 3, minZ: A.minZ - 3.2, maxZ: A.minZ }, s, ['#9aa0a6', '#9aa0a6']);
    g.nav.rebuild();
    this.syncCars();
    if (!silent) g.hud.toast(t('🌐 Online sipariş bölümü açıldı — müdür yardımcısı, toplayıcı ve kurye al'));
  }

  /** Kurye sayısı kadar araba. */
  syncCars() {
    if (!this.built) return;
    const n = Math.min(ONLINE.carXs.length, Math.max(1, this.couriers.length));
    while (this.cars.length < n) {
      const i = this.cars.length;
      // Trafikteki arabalarla aynı ölçek; burnu +x (yolun doğusu) yönünde
      const car = new THREE.Group();
      const m = prop(i % 2 ? 'car_stationwagon' : 'car_hatchback');
      m.scale.setScalar(3.4);
      m.rotation.y = Math.PI / 2;
      m.position.y = 0.2;
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      car.add(m);
      car.position.set(ONLINE.carXs[i], 0, ONLINE.carZ);
      this.game.scene.add(car);
      this.cars.push({ mesh: car, home: ONLINE.carXs[i], busy: null });
    }
  }

  freeCar() {
    return this.cars.find((c) => !c.busy) ?? null;
  }

  addDeputy() {
    return new Deputy(this.game, this);
  }

  addPicker() {
    return new Picker(this.game, this);
  }

  addCourier() {
    const c = new Courier(this.game, this);
    this.game.later.push({ t: 0, fn: () => this.syncCars() });
    return c;
  }

  /** Çalışan ayrıldı (maaş ödenemedi): elindekileri rafa bırak. */
  remove(w) {
    if (w.car) {
      w.car.busy = null;
      w.car.mesh.position.x = w.car.home;
    }
    for (const e of w.stack.splice(0)) e.mesh.removeFromParent();
  }

  // ---- Akış ----

  update(dt) {
    if (!this.built) return;
    for (const car of this.cars) car.busy?.update?.(dt);
    this.rack.update();
    // Ofis alanı: üstündeyken ayarlar paneli
    const p = this.game.player.position;
    const inZone = Math.abs(p.x - ONLINE.panel[0]) < 1 && Math.abs(p.z - ONLINE.panel[1]) < 1;
    if (inZone && !this.panelOpen && !this.dismissed) this.openPanel();
    if (!inZone) {
      this.dismissed = false;
      if (this.panelOpen) this.closePanel();
    }
    if (this.panelOpen) {
      this.panelT = (this.panelT ?? 0) - dt;
      if (this.panelT <= 0) {
        this.panelT = 1;
        this.renderPanel();
      }
    }
  }

  /** Teslimat tamamlandı: ciro kasaya girer. */
  delivered(products, pos) {
    const g = this.game;
    let value = 0;
    for (const p of products) value += g.priceOf(p);
    if (!value) return;
    g.money += value;
    this.today.orders++;
    g.goals?.event('online');
    this.today.crates += products.length;
    this.today.revenue += value;
    g.day.today.online = { ...this.today };
    g.hud.setMoney(g.money);
    g.fx.floatText(pos, `🌐 +$${value}`, '#2a7fd4');
    g.gainXp(Math.max(1, Math.round(products.length / 3)));
  }

  /** Gün sonu: market satışını referans al (online hedefi buna göre). */
  endOfDay(today) {
    if (!this.built) return;
    this.history.push(Math.max(40, today.crates ?? 0));
    if (this.history.length > 3) this.history.shift();
    this.refCrates = Math.round(this.history.reduce((a, b) => a + b, 0) / this.history.length);
    this.yesterday = { ...this.today };
    this.today = blank();
  }

  // ---- Panel (müdür yardımcısının masası) ----

  ensurePanel() {
    if (this.el) return;
    const el = document.createElement('div');
    el.className = 'overlay sheet-overlay hidden';
    el.id = 'online-panel';
    el.innerHTML = `<div class="panel holding"><div class="sheet-head"><b>${t('🌐 Online sipariş')}</b><button class="x" data-close aria-label="${t('Kapat')}">✕</button></div><div class="online-body"></div></div>`;
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(el);
    this.el = el;
  }

  openPanel() {
    this.ensurePanel();
    this.panelOpen = true;
    this.el.classList.remove('hidden');
    this.renderPanel();
  }

  closePanel(byUser = false) {
    this.panelOpen = false;
    this.dismissed = byUser;
    this.el?.classList.add('hidden');
  }

  onClick(e) {
    const g = this.game;
    if (e.target.closest('[data-close]')) return this.closePanel(true);
    if (e.target.closest('[data-premium]')) {
      this.closePanel(true);
      g.menus?.showPremium();
      return;
    }
    if (e.target.closest('[data-toggle]')) {
      this.enabled = !this.enabled;
      g.hud.toast(this.enabled ? t('🌐 Online siparişler açıldı') : t('🌐 Online siparişler durduruldu'));
    }
    const gd = e.target.closest('[data-guard]');
    if (gd) this.guard = Number(gd.dataset.guard);
    const hire = e.target.closest('[data-hire]');
    if (hire && !hire.disabled) g.completePad(hire.dataset.hire);
    this.renderPanel();
  }

  renderPanel() {
    if (!this.el) return;
    const g = this.game;
    const body = this.el.querySelector('.online-body');
    const pct = Math.round(this.share * 100);
    const need = [];
    if (!this.deputy) need.push(`🧑‍💻 ${t('müdür yardımcısı')}`);
    if (!this.pickers.length) need.push(`🧺 ${t('toplayıcı')}`);
    if (!this.couriers.length) need.push(`🛵 ${t('kurye')}`);
    const pads = [...g.pads.values()].filter((p) => p.def.type.startsWith('online') && p.def.type !== 'online');
    const padRows = pads.map((p) => {
      const l = g.padLabel(p.def);
      return `<div class="biz-row"><span>${l.emoji} ${l.title}</span>${p.premiumLock ? `<button data-premium class="prem-cta">👑 ${t('Premium gerekli')}</button>` : p.locked ? `<span class="lock">${t('Sv.{n}', { n: p.def.level })}</span>` : `<button data-hire="${p.def.id}" ${g.money < p.remaining ? 'disabled' : ''}>${t('Al ${n}', { n: formatMoney(Math.ceil(p.remaining)) })}</button>`}</div>`;
    }).join('');
    const y = this.yesterday;
    const td = this.today;
    body.innerHTML = `
      <div class="biz-row"><span>${t('Durum')}</span><b>${this.operating ? t('🟢 Sipariş alıyor') : this.enabled ? t('🔴 Personel eksik') : t('⏸️ Durduruldu')}</b><button data-toggle>${this.enabled ? t('Durdur') : t('Başlat')}</button></div>
      ${need.length ? `<p class="note">${t('Çalışması için en az: {list}', { list: need.join(', ') })}</p>` : ''}
      <div class="biz-row"><span>👥 ${t('Personel')}</span><b>${this.staffCount}/${g.premium ? ONLINE.fullStaff : PREMIUM.onlineStaff}</b><small>🧑‍💻 ${this.deputy ? 1 : 0} · 🧺 ${this.pickers.length} · 🛵 ${this.couriers.length}</small></div>
      <div class="biz-row"><span>📈 ${t('Kapasite')}</span><b>${t('marketin %{n}\'i', { n: pct })}</b><small>${t('günlük hedef ~{n} kasa (market ~{ref})', { n: this.target, ref: this.refCrates })}</small></div>
      <div class="online-bar"><i style="width:${pct}%"></i></div>
      <div class="biz-row"><span>📦 ${t('Bugün')}</span><b>${t('{n} sipariş', { n: td.orders })} · $${formatMoney(td.revenue)}</b><small>${t('{n} kasa', { n: td.crates })} · ${t('rafta {n}', { n: this.rack?.count ?? 0 })}</small></div>
      ${y ? `<div class="biz-row"><span>💵 ${t('Dün')}</span><b>$${formatMoney(y.revenue)}</b><small>${t('{n} sipariş', { n: y.orders })}</small></div>` : ''}
      <div class="biz-row"><span>🛡️ ${t('Mağazaya bırak')}</span><span class="seg">${ONLINE.guards.map((v) => `<button data-guard="${v}" class="${v === this.guard ? 'on' : ''}">%${Math.round(v * 100)}</button>`).join('')}</span></div>
      <p class="note">${t('Toplayıcılar paletlerde bu orandan az stok kalınca o ürünü almaz; market rafları boş kalmaz. Online satılan ürünler depodan düşer.')}</p>
      <p class="note">${t('<b>Personel</b> — alanlar bu odanın yanında, Sv.26\'dan itibaren her seviyede bir yeni kişi. 10 kişide online ciro marketle aynı.')}</p>
      ${g.premium ? '' : `<p class="note prem-note">👑 ${t('Standart sürümde online bölümünde en fazla {n} kişi çalışır (ciro marketin ~%{pct}\'i). {n2}–{max}. kişiler için Premium gerekir; 10 kişide online ciro marketle aynı olur.', { n: PREMIUM.onlineStaff, pct: Math.round(((PREMIUM.onlineStaff - 2) / (ONLINE.fullStaff - 2)) * 100), n2: PREMIUM.onlineStaff + 1, max: ONLINE.fullStaff })} <button data-premium class="prem-cta">👑 ${t('Premium\'u gör')}</button></p>`}
      ${padRows || `<p class="note">${t('Şu an alınabilecek personel yok.')}</p>`}`;
  }

  serialize() {
    return { enabled: this.enabled, guard: this.guard, refCrates: this.refCrates, history: this.history, today: this.today, yesterday: this.yesterday, rack: this.rack?.serialize() ?? null };
  }

  restore(d) {
    if (!d) return;
    this.enabled = d.enabled ?? true;
    this.guard = d.guard ?? 0.25;
    this.refCrates = d.refCrates ?? 150;
    this.history = d.history ?? [];
    this.yesterday = d.yesterday ?? null;
    this.savedRack = d.rack;
  }

  /** Yükleme sonrası (bölüm kurulduktan sonra) rafı geri doldur. */
  afterLoad() {
    if (this.rack && this.savedRack) this.rack.restore(this.savedRack);
    this.savedRack = null;
  }
}

function blank() {
  return { orders: 0, crates: 0, revenue: 0 };
}

// ---- Sipariş rafı: toplayıcılar bırakır, kuryeler alır ----

class OrderRack {
  constructor(game, x, z) {
    this.game = game;
    this.x = x;
    this.z = z;
    this.items = []; // ürün kimlikleri
    this.root = new THREE.Group();
    this.root.position.set(x, 0, z);
    const table = prop('kitchentable_B_large');
    table.rotation.y = Math.PI / 2;
    this.root.add(table);
    this.top = new THREE.Group();
    this.top.position.y = 1.0;
    this.root.add(this.top);
    this.meshes = [];
    // Etiket
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 96;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, depthTest: false }));
    this.label.scale.set(2.2, 0.82, 1);
    this.label.position.y = 3.2;
    this.label.renderOrder = 5;
    this.root.add(this.label);
    game.scene.add(this.root);
    game.nav.setBox('online-rack', { minX: x - 0.7, maxX: x + 0.7, minZ: z - 1.2, maxZ: z + 1.2 });
    this.drawn = -1;
  }

  get count() {
    return this.items.length;
  }

  get space() {
    return ONLINE.rackCap - this.items.length;
  }

  add(product, mesh) {
    this.items.push(product);
    if (this.meshes.length < 12 && mesh) {
      const i = this.meshes.length;
      this.meshes.push(mesh);
      this.game.fx.fly(mesh, this.top, new THREE.Vector3(-0.45 + (i % 2) * 0.9, Math.floor(i / 4) * CRATE_HEIGHT, -0.7 + (Math.floor(i / 2) % 2) * 1.4), { duration: 0.2, arc: 0.8 });
    } else mesh?.removeFromParent();
  }

  takeOrder(n) {
    const out = this.items.splice(0, Math.min(n, this.items.length));
    while (this.meshes.length > Math.min(12, this.items.length)) this.meshes.pop().removeFromParent();
    return out;
  }

  update() {
    if (this.drawn === this.items.length) return;
    this.drawn = this.items.length;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 96);
    ctx.fillStyle = '#2a7fd4';
    ctx.beginPath();
    ctx.roundRect(6, 6, 244, 84, 30);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Online · ${this.items.length}`, 128, 50);
    this.tex.needsUpdate = true;
  }

  serialize() {
    return this.items;
  }

  restore(items) {
    for (const p of items ?? []) if (PRODUCTS[p]) this.add(p, this.meshes.length < 12 ? makeCrate(p) : null);
  }
}

// ---- Çalışanlar ----

class Deputy extends Character {
  constructor(game, online) {
    super(game, 'Mage', { speed: WORKER_SPEED, look: 'uniform', cap: 'red' });
    this.online = online;
    const [x, z] = ONLINE.deputySpot;
    this.position.set(x, 0, z);
    this.heading = 0; // kameraya (masaya) bak
    this.root.rotation.y = 0;
    this.root.add(workerBadge('🧑‍💻'));
    game.scene.add(this.root);
    this.t = 2;
  }

  update(dt) {
    this.t -= dt;
    if (this.t <= 0) {
      this.t = 3 + Math.random() * 3;
      if (this.online.operating) this.play('Interact');
    }
    super.update(dt);
  }
}

class Picker extends Character {
  constructor(game, online) {
    super(game, 'Rogue', { speed: WORKER_SPEED, capacity: 12, look: 'uniform' });
    this.online = online;
    this.position.set(ONLINE.pickerSpot[0] - 1, 0, ONLINE.pickerSpot[1] + 2);
    this.root.add(workerBadge('🧺'));
    game.scene.add(this.root);
    this.state = 'idle';
    this.timer = 0;
  }

  update(dt) {
    const o = this.online;
    const g = this.game;
    this.timer += dt;
    switch (this.state) {
      case 'idle': {
        if (this.timer < 0.8) break;
        this.timer = 0;
        if (this.carrying) {
          this.deliver();
          break;
        }
        if (!o.operating || !g.day.isOpen || o.rack.space < 4) break;
        if (o.today.crates + o.rack.count >= o.target) break; // bugünkü hedef doldu
        // Stoğu en dolu palet (mağaza için koruma oranının üstünde)
        let best = null;
        let bestFill = o.guard;
        for (const [k, p] of g.depot.regularPallets()) {
          const fill = p.stock / p.capacity;
          if (fill > bestFill && p.stock > 2) {
            best = p;
            bestFill = fill;
          }
        }
        if (!best) break;
        this.pallet = best;
        this.state = 'going';
        const [x, z] = best.standSpot;
        this.goTo(x, z, () => {
          this.state = 'loading';
          this.timer = 0;
        });
        break;
      }
      case 'loading': {
        if (this.timer < 0.18) break;
        this.timer = 0;
        const p = this.pallet;
        const want = Math.min(o.pickerLoad, o.rack.space);
        if (this.carrying < want && p.stock / p.capacity > o.guard && p.giveTo(this)) break;
        if (this.carrying) this.deliver();
        else this.state = 'idle';
        break;
      }
      case 'unloading': {
        if (this.timer < 0.12) break;
        this.timer = 0;
        const e = this.take();
        if (!e) {
          this.state = 'idle';
          break;
        }
        if (o.rack.space <= 0) {
          this.receive(e.mesh, e.product);
          this.state = 'idle';
          break;
        }
        o.rack.add(e.product, e.mesh);
        break;
      }
    }
    this.followPath(dt);
    super.update(dt);
  }

  deliver() {
    this.state = 'delivering';
    const [x, z] = ONLINE.pickerSpot;
    this.goTo(x, z, () => {
      this.state = 'unloading';
      this.timer = 0;
      this.faceTowards(ONLINE.rack[0], ONLINE.rack[1]);
    });
  }
}

class Courier extends Character {
  constructor(game, online) {
    super(game, 'Barbarian', { speed: WORKER_SPEED * 1.05, capacity: 4, look: 'uniform' });
    this.online = online;
    this.position.set(ONLINE.courierSpot[0] + 1, 0, ONLINE.courierSpot[1] + 1.5);
    this.root.add(workerBadge('🛵'));
    game.scene.add(this.root);
    this.state = 'idle';
    this.timer = 0;
    this.order = [];
    this.car = null;
  }

  update(dt) {
    const o = this.online;
    const g = this.game;
    this.timer += dt;
    switch (this.state) {
      case 'idle': {
        if (this.timer < 0.6) break;
        this.timer = 0;
        const [sx, sz] = ONLINE.courierSpot;
        if (Math.hypot(this.position.x - sx, this.position.z - sz) > 0.6) {
          this.state = 'walking';
          this.goTo(sx, sz, () => { this.state = 'idle'; this.faceTowards(ONLINE.rack[0], ONLINE.rack[1]); });
          break;
        }
        if (!o.operating && !o.rack.count) break;
        // Sipariş hazır mı? Tam paket ya da biraz bekledikten sonra eldeki kadar
        this.wait = (this.wait ?? 0) + 0.6;
        const bag = o.bagSize;
        const car = o.freeCar();
        if (!car || !o.rack.count) break;
        if (o.rack.count < bag && this.wait < 5 && g.day.isOpen) break;
        this.wait = 0;
        this.order = o.rack.takeOrder(bag);
        for (const p of this.order.slice(0, 3)) {
          const m = makeCrate(p);
          m.position.set(ONLINE.rack[0], 1, ONLINE.rack[1]);
          g.scene.add(m);
          this.receive(m, p);
        }
        this.car = car;
        car.busy = this;
        this.state = 'toCar';
        this.goTo(ONLINE.gateX, A.minZ - 0.4, () => this.goTo(car.home - 1.4, ONLINE.carZ + 1.2, () => this.drive()));
        break;
      }
      case 'away': {
        // Araba yolda: kapıdan uzaklaşır, bir süre sonra döner
        const car = this.car;
        const half = ONLINE.away / 2;
        const ty = this.timer;
        const dist = ty < 3 ? ty / 3 : ty > ONLINE.away - 3 ? Math.max(0, (ONLINE.away - ty) / 3) : 1;
        car.mesh.position.x = car.home + dist * 40;
        car.mesh.visible = dist < 0.98;
        if (ty >= half && !this.paid) {
          this.paid = true;
          o.delivered(this.order, new THREE.Vector3(ONLINE.gateX, 2.5, A.minZ));
          this.order = [];
        }
        if (ty >= ONLINE.away) {
          car.mesh.position.x = car.home;
          car.mesh.visible = true;
          car.busy = null;
          this.car = null;
          this.root.visible = true;
          this.position.set(car.home - 1.4, 0, ONLINE.carZ + 1.2);
          this.state = 'idle';
          this.timer = 0;
        }
        break;
      }
    }
    if (this.state !== 'away') this.followPath(dt);
    super.update(dt);
  }

  drive() {
    for (const e of this.stack.splice(0)) e.mesh.removeFromParent();
    this.root.visible = false;
    this.state = 'away';
    this.timer = 0;
    this.paid = false;
  }
}

/** Yerdeki etkileşim alanı (muhasebe odasındakiyle aynı görünüm). */
function zoneMesh(emoji, text) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(42,127,212,0.35)';
  ctx.strokeStyle = '#cfe1ff';
  ctx.lineWidth = 12;
  ctx.setLineDash([26, 16]);
  ctx.beginPath();
  ctx.roundRect(10, 10, 236, 236, 34);
  ctx.fill();
  ctx.stroke();
  ctx.font = '80px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 128, 100);
  ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 128, 190);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

