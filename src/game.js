import * as THREE from 'three';
import { t } from './i18n.js';
import { Nav } from './nav.js';
import { Fx } from './fx.js';
import { Audio } from './audio.js';
import { Hud, formatMoney } from './hud.js';
import { Input } from './input.js';
import { World } from './world.js';
import { Character } from './character.js';
import { Shelf, Checkout, UnlockPad } from './stations.js';
import { Customer, Cashier, Stocker, Cleaner, Manager, Guard, Advertiser, Valet } from './actors.js';
import { MANAGER, zoneOf, SALE_DAY, CAMPAIGN_PROMO, PREMIUM } from './config.js';
import { Rating, DirtSystem } from './upkeep.js';
import { Traffic } from './traffic.js';
import { Supply, Producer } from './production.js';
import { Office } from './office.js';
import { Bank } from './bank.js';
import { Campaign } from './campaign.js';
import { MarketAccountant } from './accountant.js';
import { Holding } from './holding.js';
import { Energy } from './energy.js';
import { Rent } from './rent.js';
import { Housing } from './housing.js';
import { Ads } from './ads.js';
import { Online } from './online.js';
import { Goals } from './goals.js';
import { Decor } from './decor.js';
import { Celebration } from './celebrate.js';
import { Politics } from './politics.js';
import { Finance } from './finance.js';
import { Music } from './music.js';
import { City } from './city.js';
import { Life } from './life.js';
import { Achievements } from './achievements.js';
import { platform, LEADERBOARDS } from './platform.js';
import { Depot } from './depot.js';
import { DayCycle } from './daycycle.js';
import { CHARACTER_NAMES, HAIR_CSS } from './assets.js';
import {
  PRODUCTS, SHELVES, CHECKOUTS, UNLOCKS, LEVELS, START_MONEY, START_CAPACITY, PLAYER_SPEED, ROOM2,
  DAY, DOOR_X, DOOR2_X, DOOR3_X, ROOM3, WORKER_CAPACITY, START_LOAN, START_DEPOT_STOCK, RATING, DIRT, WALK_IN_CAP, ADS, THEFT, GUARD_SPOTS, PRODUCERS, VALET_SPOT, OVERTIME_PAY, STAFF_ROLE, WAGES, ROLE_NAMES, BANK, RENT,
} from './config.js';

const SAVE_KEY = 'marketgame-save-v2';
const OLD_SAVE_KEY = 'marketgame-save-v1';

// Kamera eğimi (yatayla açı, radyan). Normal ≈ 53°.
const CAM_ANGLES = { steep: THREE.MathUtils.degToRad(66), normal: Math.atan2(0.8, 0.6), low: THREE.MathUtils.degToRad(40) };

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

    this.nav = new Nav({ minX: -50, maxX: 31, minZ: -30, maxZ: 21 });
    this.fx = new Fx(this.scene);
    this.audio = new Audio();
    // Ayarlar (cihazda saklanır): ses, müzik, 2× hız, menüde arka planda devam
    this.options = { sound: true, music: true, speed: 1, cam: 'normal', background: false, sfxVol: 0.8, musicVol: 0.6, musicAdaptive: true };
    try { Object.assign(this.options, JSON.parse(localStorage.getItem('marketgame-options') || '{}')); } catch { /* yok */ }
    if (this.options.fast) this.options.speed = 2; // eski ayar (aç/kapa 2×)
    // Premium: şimdilik test anahtarı (App Store satın alımı gelince platform.entitlement)
    try { this.premium = localStorage.getItem('marketgame-premium') === '1'; } catch { this.premium = false; }
    delete this.options.fast;
    this.audio.enabled = this.options.sound;
    this.music = new Music(this.audio);
    this.music.enabled = this.options.music;
    this.music.volume = this.options.musicVol;
    this.music.adaptive = this.options.musicAdaptive;
    this.audio.volume = this.options.sfxVol;
    this.audio.onUnlock = () => this.music.start();
    this.menuOpen = false;
    this.input = new Input(this.renderer.domElement);
    this.day = new DayCycle(this);
    this.hud = new Hud(this);
    this.rating = new Rating(this);
    this.dirt = new DirtSystem(this);
    this.stats = { sold: 0, customers: 0, playTime: 0 };
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
    this.supply = new Supply(this);
    this.producers = [];
    this.room3Open = false;
    this.later = []; // oyun zamanıyla gecikmeli çağrılar
    this.depot = new Depot(this);
    this.office = new Office(this);
    this.online = new Online(this);
    this.bank = new Bank(this);
    this.campaign = new Campaign(this);
    this.traffic = new Traffic(this);
    this.holding = new Holding(this);
    this.energy = new Energy(this);
    this.rent = new Rent(this);
    this.housing = new Housing(this);
    this.ads = new Ads(this);
    this.politics = new Politics(this);
    this.finance = new Finance(this);
    this.city = new City(this);
    this.life = new Life(this);
    this.achievements = new Achievements(this);
    this.goals = new Goals(this);
    this.decor = new Decor(this);
    this.party = new Celebration(this);
    this.platform = platform;
    this.isMayor = false; // Sv.60: belediye başkanı (ceza kesilmez)
    this.marketName = 'Kasaba';

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
    this.goals.rollQuests();
    this.hud.setGems?.(this.goals.gems);
    this.hud.syncQuests?.();
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
        const [x, z] = def.value === 2
          ? [co.cashierSpot[0] + 0.4, co.cashierSpot[1] + 3.0]   // 2. kasiyer alanı
          : [co.cashierSpot[0] + 0.3, co.cashierSpot[1] + 5.4];
        // Kasa duvara yakınsa (sağ salon) alan duvarın altında kalmasın: salonun içine çek
        const room = [ROOM3, ROOM2].find((r) => x > r.minX && x < r.maxX) ?? { minX: -12, maxX: 12 };
        return [THREE.MathUtils.clamp(x, room.minX + 1.6, room.maxX - 1.6), z];
      }
      case 'checkout':
        return CHECKOUTS.find((c) => c.id === def.target).pos;
      default:
        return def.pos;
    }
  }

  padLabel(def) {
    // İkinci reyonun ürün çeşidi adı
    const SECOND_SHELF = { tomato: 'ithal', cheese: 'Gurme', lettuce: 'Yerli', bun: 'Ekşi Maya' };
    switch (def.type) {
      case 'shelf': {
        const sh = SHELVES.find((x) => x.id === def.target);
        const info = PRODUCTS[sh.product];
        return { title: sh.id === sh.product ? info.name : `${info.name} (${SECOND_SHELF[sh.product] ?? '2'})`, emoji: info.emoji };
      }
      // Alan rafın arkasında kalıyor: üstünde yüzen tabela ile görünür olsun
      case 'shelfStage': return { title: `Raf ${[8, 16, 24][def.value]}`, emoji: '📶', size: 2.0, marker: `📶 Raf ${[8, 16, 24][def.value]}` };
      case 'stockerCap': return { title: `Reyon Görevlisi - ${def.value}`, emoji: '🛒' };
      case 'door': return { title: '2. kapı', emoji: '🚪' };
      case 'depot': return { title: 'Depo Rafı Büyüt', emoji: '🏭' };
      case 'cleaner': return { title: 'Temizlik Görevlisi', emoji: '🧹' };
      case 'manager': return { title: 'Müdür', emoji: '💼' };
      case 'ads': return def.target === 'billboard' ? { title: 'Reklam panosu', emoji: '🪧' } : { title: 'Reklam Personeli', emoji: '📣' };
      case 'security': return { title: 'Güvenlik Görevlisi', emoji: '👮' };
      case 'roadboard': return { title: 'Reklam panosu +%5', emoji: '🪧' };
      case 'wholesaler': return { title: 'Toptancıyla Sözleşme Yap', emoji: '🏢' };
      case 'room3': return { title: '3. salon', emoji: '🏗️' };
      case 'producer': return { title: PRODUCERS[def.target].name, emoji: PRODUCERS[def.target].emoji };
      case 'parking': return { title: def.value === 1 ? 'Otopark' : 'Otopark +6', emoji: '🅿️' };
      case 'valet': return { title: 'Otopark Görevlisi', emoji: '🦺' };
      case 'online': return { title: 'Online sipariş', emoji: '🌐', size: 3.0 };
      case 'onlineDeputy': return { title: 'Müdür yardımcısı', emoji: '🧑‍💻' };
      case 'onlinePicker': return { title: 'Paket Hazırlama Görevlisi', emoji: '🧺' };
      case 'onlineCourier': return { title: 'Kurye', emoji: '🛵' };
      case 'accountant': return { title: 'Muhasebeci', emoji: '🧑‍💼' };
      case 'cashier': return { title: def.value === 2 ? '2. kasiyer' : 'Kasiyer', emoji: '🧑‍💼', size: def.value === 2 ? 2.0 : 2.6 };
      case 'stocker': return { title: 'Reyon Görevlisi', emoji: '📦' };
      case 'capacity': return { title: `Taşıma Kapasitesi ${def.value}`, emoji: '💪' };
      case 'expansion': return { title: 'Genişlet', emoji: '🏗️' };
      case 'checkout': return { title: 'Yeni kasa', emoji: '🛒' };
      default: return { title: def.id, emoji: '⭐' };
    }
  }

  /** Bir satın alma alanını uzaktan tamamla (muhasebeci yatırımı). Kalan tutar kasadan düşer. */
  completePad(id) {
    const pad = this.pads.get(id);
    if (!pad || pad.locked) return false;
    const cost = Math.ceil(pad.remaining);
    if (this.money < cost) return false;
    this.money -= cost;
    this.hud.setMoney(this.money);
    pad.dispose();
    this.pads.delete(id);
    this.applyUnlock(pad.def);
    this.refreshPads();
    return true;
  }

  /** Sıradaki seviyenin alanları da kilitli (gri) olarak görünür; ulaşınca açılır. */
  refreshPads() {
    for (const [id, pad] of this.pads) pad.setLocked(pad.def.level > this.level, this.premiumLocked(pad.def));
    for (const def of UNLOCKS) {
      if (this.unlocked.has(def.id) || this.pads.has(def.id)) continue;
      if (!def.requires.every((r) => this.unlocked.has(r))) continue;
      if (def.level > this.level + 1) continue;
      if (def.type === 'shelfStage' && !this.shelves.some((s) => s.id === def.target)) continue;
      const [x, z] = this.padPosition(def);
      const label = this.padLabel(def);
      // Personel alanında günlük maaş da yazsın (işe alım ucuz ama her gün maaş ödenir)
      const role = def.type === 'ads' ? (def.target === 'advertiser' ? 'advertiser' : null) : STAFF_ROLE[def.type];
      if (role && WAGES[role]) label.title = `${label.title} · $${WAGES[role]}/gün`;
      if (def.type === 'roadboard') def.cost = this.roadboardCost();
      const pad = new UnlockPad(this, def, x, z, label);
      pad.setLocked(def.level > this.level, this.premiumLocked(def));
      if (this.savedPads?.[def.id]) {
        pad.paid = Math.min(this.savedPads[def.id], def.cost - 1);
        pad.redraw();
      }
      this.pads.set(def.id, pad);
    }
  }

  applyUnlock(def, silent = false) {
    this.unlocked.add(def.id);
    const staffBefore = this.workers.length;
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
      case 'accountant':
        this.accountant = new MarketAccountant(this);
        this.workers.push(this.accountant);
        if (this.savedAccountant) this.accountant.restore(this.savedAccountant);
        if (!silent) this.hud.toast('🧑‍💼 Muhasebeci işe başladı — muhasebe odasından ayarla');
        break;
      case 'online':
        this.online.build(silent);
        break;
      case 'onlineDeputy':
        this.workers.push(this.online.addDeputy());
        break;
      case 'onlinePicker':
        this.workers.push(this.online.addPicker());
        break;
      case 'onlineCourier':
        this.workers.push(this.online.addCourier());
        break;
      case 'valet':
        this.traffic.lot.valet = true;
        this.workers.push(new Valet(this, VALET_SPOT[0], VALET_SPOT[1]));
        break;
      case 'roadboard': {
        this.adBoost += ADS.roadboard;
        this.world.addBillboard(def.pos[0], def.pos[1] - 0.6);
        // Kalan panoların fiyatı artar
        for (const p of this.pads.values()) {
          if (p.def.type !== 'roadboard') continue;
          p.cost = this.roadboardCost();
          p.paid = Math.min(p.paid, p.cost - 1);
          p.rate = Math.max(p.cost / 1.6, 25);
          p.redraw();
        }
        break;
      }
      case 'ads':
        this.adBoost += ADS[def.target];
        if (def.target === 'advertiser') this.workers.push(new Advertiser(this, 12.5, 15.4));
        else this.world.addBillboard(16.5, 11.6);
        break;
      case 'wholesaler':
        this.supply.buyWholesaler();
        break;
      case 'room3':
        this.room3Open = true;
        this.world.openRoom3();
        break;
      case 'producer':
        this.producers.push(new Producer(this, def.target, def.pos[0], def.pos[1]));
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
    // Yeni çalışanı satın alma alanıyla eşle (maaş ödenemezse ayrılınca alan geri gelir)
    for (let i = staffBefore; i < this.workers.length; i++) {
      this.workers[i].unlockId = def.id;
      this.workers[i].role = STAFF_ROLE[def.type];
    }
    if (!silent) {
      this.goals.event('buy');
      platform.haptic('LIGHT');
      const l = this.padLabel(def);
      this.hud.toast(`${l.emoji} ${l.title} açıldı!`);
      this.audio.play('unlock');
      this.save();
    }
  }

  // ---- Ekonomi ---------------------------------------------------------------

  /** Satış fiyatı: indirim günü ve kampanya ek promosyonu düşülür. */
  priceOf(product) {
    let f = this.ads.saleToday ? SALE_DAY.price : 1;
    if (this.campaign.promoActive(product)) f *= CAMPAIGN_PROMO.price;
    const base = PRODUCTS[product].price;
    return f === 1 ? base : Math.max(1, Math.round(base * f));
  }

  earn(amount, pos) {
    this.money += amount;
    this.goals.event('revenue', amount);
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

  /**
   * Günü tamamla: günün kalanı arka arkaya simüle edilir (çalışanlar çalışır, sen beklersin),
   * kapanış ve gün sonu özeti normal akıştaki gibi gelir. Ekran donmasın diye kare başına parça parça.
   */
  finishDay() {
    if (this.simulating || this.day.phase === 'night') return;
    const el = document.getElementById('sim-day');
    const bar = document.getElementById('sim-bar');
    const hasCashier = this.workers.some((w) => w.role === 'cashier');
    document.getElementById('sim-note').textContent = hasCashier
      ? 'Çalışanların gün boyu çalışıyor…'
      : 'Kasiyerin yok: sen kasada olmadığın için bazı müşteriler ödeme yapamadan çıkabilir.';
    el.classList.remove('hidden');
    el.addEventListener('pointerdown', (e) => e.stopPropagation(), { once: true });
    this.simulating = true;
    const sound = this.audio.enabled;
    this.audio.enabled = false;
    const startT = this.day.t;
    const step = 0.05;
    const tick = () => {
      const t0 = performance.now();
      // Kare başına ~25 ms hesap: telefonda da akıcı kalsın
      while (performance.now() - t0 < 25 && this.day.phase !== 'night') this.update(step);
      const frac = this.day.phase === 'open' ? (this.day.t - startT) / Math.max(1, DAY.length - startT) : 1;
      bar.style.width = `${Math.round(Math.min(1, frac) * 100)}%`;
      if (this.day.phase !== 'night') return requestAnimationFrame(tick);
      this.simulating = false;
      this.audio.enabled = sound;
      el.classList.add('hidden');
      this.updateCamera(1);
      const pp = this.goals.pendingParty;
      if (pp) {
        this.goals.pendingParty = null;
        this.party.start(`🎉 ${pp[0].toLocaleString('tr-TR')}. müşteri!`, `Herkes kutluyor · 💎 +${pp[1]}`, 8);
      }
      // Simülasyonda seviye atladıysa kutlama özetten sonra
      const lv = this.hud.pendingLevel;
      if (lv) {
        this.hud.pendingLevel = null;
        this.hud.showLevelPop(lv.level, lv.features);
      }
    };
    requestAnimationFrame(tick);
  }

  /** Standart sürümde kilitli alan mı? (online bölümünde 6 kişiden fazlası Premium) */
  premiumLocked(def) {
    if (this.premium) return false;
    if (/^online(Deputy|Picker|Courier)$/.test(def.type)) return (this.online?.staffCount ?? 0) >= PREMIUM.onlineStaff;
    return false;
  }

  /** Bu hız şu an kullanılabilir mi? (Sv.20 sonrası 2× Premium) */
  speedAllowed(sp) {
    return sp < 2 || this.premium || this.level < PREMIUM.fastLevel;
  }

  setPremium(on) {
    this.premium = !!on;
    try { localStorage.setItem('marketgame-premium', on ? '1' : '0'); } catch { /* yok */ }
    if (!this.speedAllowed(this.options.speed)) this.options.speed = 1.5;
    this.refreshPads();
    this.decor?.placeItems();
    this.hud.syncSpeed();
    this.hud.syncSpeedSeg?.();
    this.hud.toast(on ? '👑 Premium açık' : 'Standart sürüm');
  }

  saveOptions() {
    try { localStorage.setItem('marketgame-options', JSON.stringify(this.options)); } catch { /* gizli mod */ }
  }

  /** Bu karede oyun ilerlesin mi (menü açıkken duraklatma)? */
  get running() {
    return !this.paused && !(this.menuOpen && !this.options.background);
  }

  /** Tabelalarda görünen ad: "<isim> Market" (isimde zaten market/bakkal geçiyorsa eklenmez). */
  get marketTitle() {
    const n = this.marketName || 'Kasaba';
    if (n === 'Kasaba') return t('Kasaba Market'); // varsayılan ad kayıtta Türkçe kalır, gösterimde çevrilir
    return /market|bakkal|mağaza|süpermarket|shop|store|laden|tienda|magasin|negozio|マート|마트/i.test(n) ? n : t('{name} Market', { name: n });
  }

  setMarketName(name, silent = false) {
    const n = String(name ?? '').trim().slice(0, 20);
    this.marketName = n || 'Kasaba';
    this.world.setMarketTitle(this.marketTitle);
    if (!silent) {
      this.hud.toast(`🏪 ${this.marketTitle}`);
      this.save();
    }
  }

  /** Gün sonunda ödenecekler (maaş, faiz, fatura, kira günü ise kira). */
  get dueTonight() {
    const b = this.bank;
    let n = this.dailyPayroll + Math.round(b.debt * BANK.loanRate + b.startDebt * START_LOAN.rate) + this.energy.estimatedBill;
    if (this.day.day % RENT.week === 0) n += this.rent.weeklyTotal;
    return n;
  }

  /**
   * Tıkanma koruması: rafta da depoda da mal yoksa, yolda kamyon yoksa ve sipariş verecek para
   * kalmadıysa oyuncuya bankadan kredi çekmesini söyle (kredi her zaman açık).
   */
  checkStuck(dt) {
    this.stuckT = (this.stuckT ?? 0) + dt;
    if (this.stuckT < 5) return;
    this.stuckT = 0;
    const shelvesEmpty = this.shelves.every((s) => s.count === 0);
    const depotEmpty = [...this.depot.pallets.values()].every((p) => p.stock === 0) && this.depot.trucks.length === 0;
    const carrying = this.player.stack.length > 0 || this.workers.some((w) => w.stack?.length);
    const cash = this.money + this.checkouts.reduce((a, c) => a + c.cash.value, 0);
    const cheapest = Math.min(...[...this.depot.pallets.keys()].map((k) => this.supply.costOf(k)));
    if (!shelvesEmpty || !depotEmpty || carrying || cash >= cheapest * 3) return;
    if (this.stuckWarnedDay === this.day.day) return;
    this.stuckWarnedDay = this.day.day;
    this.hud.toast(`🏦 Mal kalmadı, para da yetmiyor: muhasebe odası → Banka'dan kredi çekip sipariş ver (limit $${formatMoney(this.bank.available)})`);
  }

  /** Akşam 19:00: kasa gün sonu ödemelerine yetmiyorsa uyar. */
  checkDueWarning() {
    const d = this.day;
    if (d.phase !== 'open' || d.hour < 19 || this.dueWarnedDay === d.day) return;
    this.dueWarnedDay = d.day;
    const due = this.dueTonight;
    const have = this.money + this.bank.deposit + this.checkouts.reduce((a, c) => a + c.cash.value, 0);
    if (due > 0 && have < due) this.hud.toast(`⚠️ Gün sonu ödemeler $${Math.round(due)}, kasada $${Math.round(have)} — yetmezse çalışanlar ayrılır`);
  }

  /** Yol kenarı panosu fiyatı: alınan pano sayısı arttıkça (kalan azaldıkça) iki katına çıkar. */
  roadboardCost() {
    const owned = [...this.unlocked].filter((id) => id.startsWith('roadboard')).length;
    return ADS.roadboardBase * 2 ** owned;
  }

  /** Toplam çalışan: market + işletmeler + emlakçılar. */
  get totalStaff() {
    let n = this.workers.filter((w) => w.role).length;
    for (const b of this.holding.owned) n += b.workers + (b.manager ? 1 : 0);
    return n + this.housing.agents + (this.housing.accountant ? 1 : 0);
  }

  /** Bugünkü toplam maaş yükü (market + işletmeler). */
  get dailyPayroll() {
    let n = 0;
    for (const w of this.workers) n += w.wage ?? WAGES[w.role] ?? 0;
    for (const b of this.holding.owned) n += b.dailyWages;
    if (this.housing.accountant) n += WAGES.accountant;
    return n;
  }

  /**
   * Gün sonu bordro: önce nakitten, yetmezse mevduattan. İşe alınma sırasına göre ödenir;
   * maaşı ödenemeyen çalışan işten ayrılır (alanı yeniden belirir, sonra tekrar işe alınabilir).
   */
  payroll(today) {
    const entries = [];
    for (const w of this.workers) {
      if (WAGES[w.role]) entries.push({ wage: w.wage ?? WAGES[w.role], label: ROLE_NAMES[w.role], fire: () => this.fireWorker(w) });
    }
    for (const b of this.holding.owned) entries.push(...b.payrollEntries());
    if (this.housing.accountant) entries.push({ wage: WAGES.accountant, label: '🏘️ Emlak muhasebecisi', fire: () => { this.housing.accountant = false; } });
    let paid = 0;
    let market = 0;
    const quit = [];
    for (const e of entries) {
      if (this.money < e.wage && this.bank.deposit > 0) {
        const take = Math.min(this.bank.deposit, Math.ceil(e.wage - this.money));
        this.bank.deposit -= take;
        this.money += take;
      }
      if (this.money >= e.wage) {
        this.money -= e.wage;
        paid += e.wage;
        if (e.biz) e.biz.today.wages += e.wage;
        else market += e.wage;
      } else quit.push(e);
    }
    for (const e of quit) e.fire();
    today.wages = paid;
    today.marketWages = market;
    today.quit = quit.map((e) => e.label);
    if (quit.length) {
      this.refreshPads();
      this.hud.toast(`😞 Maaşı ödenemeyen ${quit.length} çalışan işten ayrıldı`);
    }
    this.hud.setMoney(this.money);
  }

  /** Çalışan işten ayrılır: karakter kalkar, satın alma alanı yeniden belirir. */
  fireWorker(w) {
    const i = this.workers.indexOf(w);
    if (i < 0) return;
    this.workers.splice(i, 1);
    this.scene.remove(w.root);
    if (w.unlockId) this.unlocked.delete(w.unlockId);
    switch (w.role) {
      case 'cashier':
        for (const co of this.checkouts) {
          const k = co.cashiers.indexOf(w);
          if (k >= 0) co.cashiers.splice(k, 1);
          if (!co.cashiers.length) co.zone.visible = true;
        }
        break;
      case 'stocker':
        w.finishJob?.();
        break;
      case 'accountant':
        if (this.accountant === w) {
          this.savedAccountant = w.serialize?.();
          this.accountant = null;
        }
        break;
      case 'valet':
        this.traffic.lot.valet = this.workers.some((x) => x.role === 'valet');
        break;
      case 'advertiser':
        this.adBoost -= ADS.advertiser;
        break;
      case 'deputy':
      case 'picker':
      case 'courier':
        this.online.remove(w);
        break;
    }
  }

  // ---- Ek mesai ----------------------------------------------------------------

  /** Gün sonu özetinde: gece çalışacak her çalışana 30–60 arası ek mesai ücreti belirlenir. */
  planOvertime() {
    const [min, max] = OVERTIME_PAY;
    const people = this.workers.length;
    let cost = 0;
    for (let i = 0; i < people; i++) cost += min + Math.floor(Math.random() * (max - min + 1));
    this.overtime = { people, cost };
    return this.overtime;
  }

  payOvertime() {
    const ot = this.overtime ?? { people: 0, cost: 0 };
    if (ot.cost > this.money) return false;
    if (ot.cost > 0) {
      this.spend(ot.cost);
      this.day.today.overtime = ot.cost;
      this.hud.toast(`💼 Ek mesai: ${ot.people} çalışana $${ot.cost} ödendi`);
    }
    this.overtime = null;
    return true;
  }

  // ---- Seviye ----------------------------------------------------------------

  levelProgress() {
    const cur = LEVELS[this.level - 1];
    const next = LEVELS[this.level];
    if (next === undefined) return 1;
    return (this.xp - cur) / (next - cur);
  }

  /** Ödeme yapıp çıkan her müşteri. */
  onCustomerPaid() {
    this.rating.add(RATING.paid);
    this.day.today.customers++;
    this.stats.customers = (this.stats.customers ?? 0) + 1;
    this.gainXp(1);
    this.goals.event('customers');
    this.goals.checkMilestone();
  }

  /** XP ekle (müşteri, işletme kârı, satın alım). Seviye atlarsa yeni alanları göster. */
  gainXp(n) {
    if (n <= 0 || this.city?.finished) return; // oyun bitti: seviye artık ilerlemez
    this.xp += n;
    let leveled = false;
    // Sv.100 ancak şehrin tamamı alınınca (Kasabanın Hakimi)
    while (LEVELS[this.level] !== undefined && this.level < 99 && this.xp >= LEVELS[this.level]) {
      this.level++;
      leveled = true;
    }
    if (leveled) {
      const names = [...new Set(UNLOCKS.filter((u) => u.level === this.level).map((u) =>
        u.type === 'shelfStage' ? 'Raf kapasitesi' : this.padLabel(u).title))];
      this.hud.levelUp(this.level, names);
      this.hud.syncSpeed();
      this.hud.syncSpeedSeg?.();
      this.audio.play('unlock');
      this.refreshPads();
      this.save();
    }
    this.hud.setLevel(this.level, this.levelProgress());
  }

  doors() {
    const d = [[DOOR_X, 4]];
    if (this.door2Open) d.push([DOOR2_X, 4]);
    if (this.room3Open) d.push([DOOR3_X, 4]);
    return d;
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
    const regular = this.shelves.filter((s) => !s.id.startsWith('campaign'));
    const stocked = regular.filter((s) => s.count > 0);
    const pool = stocked.length && Math.random() < 0.7 ? stocked : regular;
    const shelf = pool[Math.floor(Math.random() * pool.length)];
    const qty = 1 + Math.floor(Math.random() * Math.min(3, 1 + this.shelves.length / 2));
    const model = CHARACTER_NAMES.filter((n) => n !== 'Barbarian')[Math.floor(Math.random() * 4)];
    let door = [DOOR_X, 4];
    if (shelf.x > ROOM2.minX && this.door2Open) door = [DOOR2_X, 4];
    if (shelf.x < ROOM3.maxX) door = [DOOR3_X, 4];
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
    // Büyük kutlama: birkaç saniye herkes sevinir, oyun saati durur
    if (this.party.update(dt)) {
      this.fx.update(dt);
      this.hud.update(dt);
      this.updateCamera(dt);
      return;
    }
    this.updatePlayer(dt);
    this.decor.update();
    this.timers.goals = (this.timers.goals ?? 0) - dt;
    if (this.timers.goals <= 0) {
      this.timers.goals = 1;
      this.goals.update();
      this.music.react(this);
    }

    this.day.update(dt);
    this.hud.setClock(this.day.day, this.day.clockText, this.day.phase);

    // Müşteri üretimi: günün saatine göre yoğunluk, kapalıyken yok
    this.dirt.enabled = this.level >= DIRT.fromLevel;
    this.rating.update(dt);
    const rush = this.day.rush * this.rating.spawnFactor * this.adBoost * this.campaign.rushBoost * this.ads.factor * this.politics.customerFactor * this.holding.customerFactor * this.finance.customerFactor * this.decor.customerFactor;
    const maxCustomers = Math.round((3 + this.shelves.length * 2) * Math.max(0.6, rush));
    const interval = Math.max(1.2, 5.5 - this.shelves.length * 0.55) / Math.max(rush, 0.01);
    this.spawnTimer -= dt;
    if (rush > 0 && this.spawnTimer <= 0) {
      this.spawnTimer = interval * (0.7 + Math.random() * 0.6);
      if (this.customers.length < maxCustomers) this.trySpawn();
    }
    this.spawnTimer = Math.min(this.spawnTimer, interval * 1.3);

    for (const c of [...this.customers]) c.update(dt);
    // Müdürün olduğu bölümdeki çalışanlar daha hızlı çalışır (hareket + iş süreleri)
    this.managerZones = new Set(this.workers.filter((w) => w instanceof Manager && w.state !== 'going').map((w) => w.zone));
    for (const w of this.workers) {
      const boosted = !(w instanceof Manager) && this.managerZones.size > 0 && this.managerZones.has(zoneOf(w.position.x, w.position.z));
      w.setBoost?.(boosted);
      w.update(boosted ? dt * MANAGER.boost : dt);
    }
    for (const co of this.checkouts) co.update(dt);
    this.depot.update(dt);
    this.office.update();
    this.campaign.update(dt);
    this.traffic.update(dt);
    this.holding.update(dt);
    this.online.update(dt);
    this.housing.update(dt);
    this.politics.update(dt);
    this.city.update(dt);
    this.life.update(dt);
    this.achievements.update(dt);
    this.stats.playTime = (this.stats.playTime ?? 0) + dt;
    this.checkDueWarning();
    this.checkStuck(dt);
    this.hud.setStaff?.(this.level >= 21 ? this.totalStaff : null);
    for (let i = this.later.length - 1; i >= 0; i--) {
      const l = this.later[i];
      l.t -= dt;
      if (l.t <= 0) {
        this.later.splice(i, 1);
        l.fn();
      }
    }
    for (const pr of this.producers) pr.update(dt);

    // Para ve mal tamamen bittiyse toptancı hediye gönderir (oyun kilitlenmesin)
    this.timers.gift -= dt;
    if (this.timers.gift <= 0) {
      this.timers.gift = 3;
      const cheapest = Math.min(...this.depot.regularPallets().map(([k]) => this.supply.costOf(k)));
      if (this.money < cheapest * 3 && this.isBroke()) {
        this.depot.order({ tomato: 6 }, { free: true });
        this.hud.toast('🎁 Toptancıdan hediye domates!');
      }
    }

    // Satın alma alanları (gün simülasyonunda oyuncu bir şey satın almaz)
    if (!this.simulating) for (const [id, pad] of this.pads) {
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
    p.position.x = THREE.MathUtils.clamp(p.position.x, this.level >= 81 ? -100 : this.level >= 51 ? -90 : -49, this.level >= 81 ? 128 : this.level >= 36 ? 104 : this.level >= 13 ? 58 : 45);
    p.position.z = THREE.MathUtils.clamp(p.position.z, this.level >= 31 ? -158 : this.level >= 22 ? -96 : -31, this.level >= 66 ? 54 : 17.5);
    p.update(dt);
    this.playerRing.position.set(p.position.x, 0.04, p.position.z);
    // Ayak sesleri (hafif)
    if (Math.hypot(p.velocity.x, p.velocity.z) > 1) {
      this.stepT = (this.stepT ?? 0) - dt;
      if (this.stepT <= 0) {
        this.stepT = 0.3;
        this.audio.play('step', 0.35);
      }
    }

    // Depo paletinden al
    this.timers.supply -= dt;
    if (this.timers.supply <= 0) {
      if (this.droppedAt && !this.droppedAt.inRange(p.position)) this.droppedAt = null;
      for (const pal of this.depot.pallets.values()) {
        if (!pal.inRange(p.position)) continue;
        // Tedarikçiden getirdiğin bu üründen kasa varsa palete bırak, yoksa paletten al
        if (p.hasExt(pal.product) && pal.space > 0) {
          const e = p.take(pal.product, { ext: true });
          e.mesh.removeFromParent();
          pal.stock++;
          pal.syncVisual();
          this.audio.play('drop');
          this.timers.supply = 0.12;
          this.droppedAt = pal; // bıraktığın paletten, alandan çıkana kadar geri alma
          break;
        }
        if (this.droppedAt === pal) break;
        if (pal.giveTo(p)) this.timers.supply = 0.12;
        else if (pal.stock === 0 && !this.warnedEmpty) {
          this.warnedEmpty = true;
          this.hud.toast(`${PRODUCTS[pal.product].emoji} stokta yok — sipariş ver 🚚`);
          this.later.push({ t: 3, fn: () => (this.warnedEmpty = false) });
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
    const unserved = this.checkouts.find((c) => !c.cashiers.length && c.queue.length > 0 && c.queue[0].readyToPay);
    const cash = this.checkouts.find((c) => c.cash.value > 0);
    const affordable = [...this.pads.values()]
      .filter((pad) => !pad.locked && this.money >= pad.remaining)
      .sort((a, b) => a.remaining - b.remaining)[0];
    const emptyShelf = [...this.shelves].sort((a, b) => a.count / a.capacity - b.count / b.capacity)[0];

    if (carried) {
      const shelf = this.shelves.find((s) => s.product === carried.product && s.space > 0);
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
      if (!pal) {
        // kampanya standı kuruldu ama stoğu henüz gelmedi
      } else if (pal.stock > 0) {
        target = [pal.x, pal.zoneZ];
        hint = `Arka depodan ${PRODUCTS[emptyShelf.product].emoji} al`;
      } else if (!this.depot.incoming(emptyShelf.product)) {
        target = [this.depot.kiosk.x, this.depot.kiosk.z];
        hint = `${PRODUCTS[emptyShelf.product].emoji} bitti — muhasebe odasından sipariş ver 🧾`;
      }
    }

    if (!hint && this.stats.sold < 3) hint = 'Ekrana dokunup sürükleyerek yürü 👆';
    // Oyuncu ilerledikçe ipuçlarını kapat
    this.hud.hint(this.xp < 25 || hint.includes('🧽') ? hint : '');

    const near = !target || Math.hypot(target[0] - p.position.x, target[1] - p.position.z) < 1.6;
    this.guide.visible = !near;
    this.pointer.visible = !near;
    if (target && !near) {
      const now = performance.now() / 1000;
      this.guide.position.set(target[0], 2.9 + Math.sin(now * 5) * 0.25, target[1]);
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
    const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.camDistance = Math.max(8.5 / (tanH * aspect), 9.5 / tanH);
    this.camera.updateProjectionMatrix();
  }

  /** Büyüteç: yakın → normal → uzak → çok uzak. */
  cycleZoom() {
    const levels = [1, 1.7, 2.6, 0.7];
    const i = levels.indexOf(this.zoomTarget ?? 1);
    this.setZoom(levels[(i + 1) % levels.length]);
  }

  setZoom(z) {
    this.zoomTarget = THREE.MathUtils.clamp(z, 0.6, 3);
    const label = this.zoomTarget > 1.2 ? '🔍−' : this.zoomTarget < 0.9 ? '🔍+' : '🔍';
    document.getElementById('zoom-btn').textContent = label;
  }

  updateCamera(dt) {
    const p = this.player.position;
    // Ana menü: kamera marketin üstünde yavaşça döner; karakter editörü: oyuncuya yakın
    if (this.viewMode === 'home') {
      if (this.viewOffsetOn) {
        this.viewOffsetOn = false;
        this.camera.clearViewOffset();
      }
      this.orbitT = (this.orbitT ?? 0) + dt * 0.12;
      const c = new THREE.Vector3(2, 0, -4);
      this.cameraTarget.lerp(c, Math.min(1, dt * 2));
      const r = this.camDistance * 1.25;
      this.camera.position.set(this.cameraTarget.x + Math.sin(this.orbitT) * r * 0.6, r * 0.75, this.cameraTarget.z + Math.cos(this.orbitT) * r * 0.6);
      this.camera.lookAt(this.cameraTarget);
      return;
    }
    if (this.viewMode === 'avatar') {
      // Karakter, alttaki seçenek panelinin üstünde kalan alanın ortasında ve tamamen görünsün:
      // görüntü panelin yarısı kadar yukarı kaydırılır (setViewOffset), uzaklık boş alana göre
      const W = window.innerWidth;
      const H = window.innerHeight;
      const panel = document.querySelector('.avatar-panel')?.getBoundingClientRect().height ?? H * 0.5;
      const free = Math.max(0.25, (H - panel - 10) / H);
      const tanH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const dist = Math.max(2.6, 2.7 / (2 * tanH * free), 1.6 / (2 * tanH * this.camera.aspect));
      this.camera.setViewOffset(W, H, 0, Math.round(panel / 2 + 5), W, H);
      this.cameraTarget.set(p.x, 1.05, p.z);
      this.camera.position.set(p.x, 1.55, p.z + dist);
      this.camera.lookAt(this.cameraTarget);
      this.viewOffsetOn = true;
      this.guide.visible = false;
      this.pointer.visible = false;
      this.playerRing.visible = false;
      this.avatarHid = true;
      this.player.heading = 0;
      this.player.update(dt);
      return;
    }
    if (this.avatarHid) {
      this.avatarHid = false;
      this.playerRing.visible = true;
    }
    if (this.viewOffsetOn) {
      this.viewOffsetOn = false;
      this.camera.clearViewOffset();
    }
    this.cameraTarget.lerp(p, Math.min(1, dt * 6));
    // Zum: yumuşak geçiş; uzaklaşınca sis ve gölge alanı da büyür
    const zt = this.zoomTarget ?? 1;
    this.zoomNow = (this.zoomNow ?? 1) + (zt - (this.zoomNow ?? 1)) * Math.min(1, dt * 6);
    const zm = this.zoomNow;
    if (Math.abs(zm - (this.appliedZoom ?? 1)) > 0.01) {
      this.appliedZoom = zm;
      this.scene.fog.near = 45 * zm;
      this.scene.fog.far = 90 * zm;
      this.camera.far = 200 * zm;
      this.camera.updateProjectionMatrix();
      const sc = this.sun.shadow.camera;
      const e = 22 * Math.max(1, zm);
      sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.far = 70 * Math.max(1, zm);
      sc.updateProjectionMatrix();
    }
    // Görüş açısı ayarı: dik (yukarıdan) / normal / yatay (karakterlerin arkasından daha çok)
    const ang = CAM_ANGLES[this.options.cam] ?? CAM_ANGLES.normal;
    this.camPitch = (this.camPitch ?? ang) + (ang - (this.camPitch ?? ang)) * Math.min(1, dt * 5);
    const off = new THREE.Vector3(0, Math.sin(this.camPitch), Math.cos(this.camPitch)).multiplyScalar(this.camDistance * zm);
    this.camera.position.copy(this.cameraTarget).add(off);
    this.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z - 1);
    this.sun.position.set(p.x + 9, 24 * Math.max(1, zm), p.z + 12);
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
      supply: this.supply.serialize(),
      bank: this.bank.serialize(),
      campaign: this.campaign.serialize(),
      accountant: this.accountant?.serialize() ?? null,
      holding: this.holding.serialize(),
      online: this.online.serialize(),
      energy: this.energy.serialize(),
      rent: this.rent.serialize(),
      housing: this.housing.serialize(),
      ads: this.ads.serialize(),
      politics: this.politics.serialize(),
      finance: this.finance.serialize(),
      city: this.city.serialize(),
      life: this.life.serialize(),
      achievements: this.achievements.serialize(),
      goals: this.goals.serialize(),
      decor: this.decor.serialize(),
      avatar: this.avatar ?? null,
      savedAt: Date.now(),
      levelCache: this.level,
      stats: this.stats,
      marketName: this.marketName,
    };
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(SAVE_KEY, json);
      platform.persist(json); // iOS: cihaz yedeği + iCloud
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
      // Yeni oyun: kuruluş kredisiyle market alındı
      this.bank.startDebt = START_LOAN.amount;
      this.isNewGame = true;
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
    while (LEVELS[this.level] !== undefined && this.level < 99 && this.xp >= LEVELS[this.level]) this.level++;
    this.stats.sold = data.sold ?? 0;
    this.savedPads = data.pads ?? {};
    this.savedAccountant = data.accountant ?? null;
    // Bağımlılık sırasıyla uygula
    const ids = new Set(data.unlocked ?? []);
    this.online.restore(data.online);
    for (const def of UNLOCKS) {
      if (ids.has(def.id)) this.applyUnlock(def, true);
    }
    this.online.afterLoad();
    for (const s of this.shelves) s.fillStock(data.shelves?.[s.id] ?? 0);
    this.day.restore(data.day);
    this.supply.restore(data.supply);
    this.bank.restore(data.bank);
    this.campaign.restore(data.campaign);
    if (data.rating !== undefined) this.rating.value = data.rating;
    this.dirt.restore(data.dirt);
    this.holding.restore(data.holding);
    this.energy.restore(data.energy);
    this.rent.restore(data.rent);
    this.housing.restore(data.housing);
    this.ads.restore(data.ads);
    this.politics.restore(data.politics);
    this.finance.restore(data.finance);
    this.city.restore(data.city);
    this.life.restore(data.life);
    this.achievements.restore(data.achievements);
    if (data.stats) Object.assign(this.stats, data.stats);
    this.goals.restore(data.goals);
    this.decor.restore(data.decor);
    this.lastSavedAt = data.savedAt ?? 0;
    if (data.avatar) this.setAvatar(data.avatar, true);
    if (data.marketName) this.setMarketName(data.marketName, true);
    this.decor.afterLoad();
    if (data.depot) this.depot.restore(data.depot);
    else {
      // v1'den geçiş: her ürüne biraz stok
      for (const pal of this.depot.pallets.values()) { pal.stock = 10; pal.syncVisual(); }
    }
  }

  /** Oyuncu görünümü: { model, hair, outfit, pants, acc, accColor }. */
  setAvatar(av, silent = false) {
    this.avatar = { ...av };
    this.player.rebuildModel(av.model ?? 'Barbarian', { hair: av.hair ?? 0, outfit: av.outfit ?? 0, pants: av.pants ?? 0, acc: av.acc ?? 'none', accColor: av.accColor ?? 'red', hairStyle: av.hairStyle ?? 'short', hairCss: HAIR_CSS[av.hair ?? 0] });
    if (!silent) this.save();
  }

  async reset() {
    this.resetting = true;
    clearTimeout(platform.cloudT);
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(OLD_SAVE_KEY);
    } catch {
      /* yok say */
    }
    await platform.clearSave(); // iOS: cihaz yedeği ve iCloud kopyası da silinir
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
