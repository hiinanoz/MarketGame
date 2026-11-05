import * as THREE from 'three';
import { t } from './i18n.js';
import { Character } from './character.js';
import { CHARACTER_NAMES } from './assets.js';

// Mekânlar (1.2-b): ajandadaki etkinlik ve toplantılar bir mekânda yapılır. Haritada batıdaki "Şehir Bulvarı"
// (ana caddenin güneyi, x −100…−145) yeni binalar; stadyum, market ve lojistik deposu mevcut yerleri. Makam
// aracı caddede durağa gelince "İçeri gir" (ya da ajandadan "Şoförle git"). İçeride küçük bir 3D oda (masa,
// oturan karakterler) ve o mekândaki maddeler; seçimler orada yapılır.

export const VENUES = {
  hq: { name: t('Plaza (genel merkez)'), emoji: '🏢', x: -100, kind: 'hq', color: 0x6f8fb0, h: 14 },
  culture: { name: t('Kasaba Kültür Merkezi'), emoji: '🏛️', x: -107.5, kind: 'hall', color: 0xd9c49a, h: 6 },
  bank: { name: t('Şehir Bankası'), emoji: '🏦', x: -115, kind: 'bank', color: 0xb8c4cc, h: 7 },
  townhall: { name: t('Belediye'), emoji: '🏢', x: -122.5, kind: 'townhall', color: 0xe8d8c0, h: 8, label: '🏛️' },
  school: { name: t('Kasaba İlkokulu'), emoji: '🏫', x: -130, kind: 'school', color: 0xf0b37a, h: 5 },
  court: { name: t('Adliye'), emoji: '⚖️', x: -137.5, kind: 'court', color: 0xcfc6b4, h: 7 },
  inn: { name: t('Tarihi Han'), emoji: '🕯️', x: -145, kind: 'inn', color: 0x9c6b48, h: 5 },
  tv: { name: t('Manşet TV'), emoji: '📺', x: -110, kind: 'studio', color: 0x2c3e66, h: 9, north: true },
  gazette: { name: t('Kasaba Gazetesi'), emoji: '📰', x: -58, kind: 'newsroom', existing: true },
  stadium: { name: t('Stadyum'), emoji: '🏟️', x: -78, kind: 'box', existing: true },
  airport: { name: t('Havalimanı VIP salonu'), emoji: '✈️', x: -78, kind: 'vip', existing: true, level: 66 },
  hotel: { name: t('Grand Anadolu Otel balo salonu'), emoji: '🏨', x: -34, kind: 'ballroom', existing: true, level: 66 },
  restaurant: { name: t('Tombik Restoran'), emoji: '🍽️', x: -20, kind: 'restaurant', existing: true, level: 66 },
  factory: { name: t('Sanayi Üretim Fabrikası'), emoji: '🏭', x: -30, kind: 'factory', existing: true, level: 66 },
  port: { name: t('Kasaba Limanı'), emoji: '⚓', x: 26, kind: 'depot', existing: true, level: 66 },
  mall: { name: t('Kasaba Forum AVM'), emoji: '🛍️', x: -2, kind: 'hall', existing: true, level: 66 },
  exchange: { name: t('Borsa salonu'), emoji: '📈', x: -125, kind: 'exchange', color: 0x445566, h: 11, north: true, level: 66 },
  fair: { name: t('Şehir Zirvesi fuar alanı'), emoji: '🌆', x: -140, kind: 'summit', color: 0x8a9aa8, h: 6, north: true, level: 81 },
  market: { name: t('Market'), emoji: '🛒', x: 0, kind: 'market', existing: true },
  depot: { name: t('Lojistik deposu'), emoji: '🚚', x: 38, kind: 'depot', existing: true },
  biz: { name: '{biz}', emoji: '🏭', kind: 'factory', existing: true, dynamic: true },
};

const BLVD_Z = 30.5; // bina merkezi (cadde güney kaldırımı 25.3)

export class Venues {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.current = null;     // { id, x, vars } — içinde bulunulan mekân
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.built = false;
    this.scenes = {};
    // DOM
    this.el = document.createElement('div');
    this.el.id = 'venue';
    this.el.className = 'plaza hidden';
    this.el.innerHTML = `<div class="plz-top"><div class="plz-title"><b></b><span></span></div></div>
      <div class="plz-sheet vn-sheet"><div class="plz-sheet-in"><div class="plz-sheet-head"><b></b><button class="x" data-leave aria-label="✕">🚪</button></div><div class="plz-sheet-body"></div></div></div>`;
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.el);
    this.title = this.el.querySelector('.plz-title b');
    this.clock = this.el.querySelector('.plz-title span');
    this.sheetTitle = this.el.querySelector('.plz-sheet-head b');
    this.body = this.el.querySelector('.plz-sheet-body');
    this.tick = 0;
  }

  /** Mekânın adı (dinamik: işletme). */
  nameOf(id, vars = {}) {
    const v = VENUES[id];
    if (!v) return t(id, vars);
    return v.dynamic ? (vars.biz ?? '') : v.name;
  }

  /** Caddedeki durak x'i. */
  stopX(id, vars = {}) {
    const v = VENUES[id];
    if (!v) return null;
    if (v.dynamic) return this.game.holding.get(vars.id)?.x ?? null;
    return v.x;
  }

  // ---- Harita: Şehir Bulvarı binaları ----

  buildMap() {
    if (this.built) return;
    this.built = true;
    for (const [id, v] of Object.entries(VENUES)) {
      if (v.existing || this.mapBuilt?.[id]) continue;
      if (v.level && this.game.level < v.level) continue; // ileri seviye binalar seviyesi gelince
      (this.mapBuilt ??= {})[id] = true;
      const g = new THREE.Group();
      g.position.set(v.x, 0, v.north ? 9.5 : BLVD_Z);
      if (v.north) g.rotation.y = Math.PI; // caddenin kuzeyinde: kapı güneye (caddeye) bakar
      const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
      const body = new THREE.Mesh(new THREE.BoxGeometry(6.4, v.h, 6), mat(v.color, v.kind === 'hq' ? 0.25 : 0.8));
      body.position.y = v.h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      // Pencere bantları
      for (let y = 1.6; y < v.h - 0.8; y += 1.6) {
        const band = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.55, 6.1), mat(v.kind === 'hq' ? 0x9fd0f0 : 0x5a7088, 0.3));
        band.position.y = y;
        g.add(band);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.35, 6.5), mat(0x3a3f47));
      roof.position.y = v.h + 0.17;
      g.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.1), mat(0x4a3424));
      door.position.set(0, 1.1, -3.05);
      g.add(door);
      if (v.kind === 'hall' || v.kind === 'court' || v.kind === 'townhall') {
        for (const x of [-2.2, -0.8, 0.8, 2.2]) {
          const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.2, 8), mat(0xf4efe4));
          col.position.set(x, 1.6, -3.4);
          g.add(col);
        }
      }
      // Tabela (caddeye bakar)
      const sign = signSprite(`${v.label ?? v.emoji} ${v.name}`);
      sign.position.set(0, Math.min(v.h, 6) + 1.1, -3.3);
      g.add(sign);
      this.root.add(g);
    }
  }

  // ---- İç sahneler ----

  sceneFor(kind) {
    if (this.scenes[kind]) return this.scenes[kind];
    const scene = new THREE.Scene();
    const palette = { ballroom: [0x3a1f2c, 0xf3e6cf], vip: [0x1f2a33, 0xdfe7ee], exchange: [0x101826, 0x2b3c56], restaurant: [0x3c2418, 0xead6b8], summit: [0x22303c, 0xe6ebef], studio: [0x151a2a, 0x2c3e66], newsroom: [0x2e3a2e, 0xe8e2d0], hall: [0x5a2e2e, 0xf1e3c8], bank: [0x2f3e4c, 0xe9eef2], townhall: [0x3c4a3a, 0xefe6d2], school: [0x4d6e8a, 0xfff3d6], court: [0x3e342c, 0xe7dcc8], inn: [0x2a1c14, 0xc89a68], box: [0x1d2a3a, 0xd7e3ee], depot: [0x3a3a32, 0xd8d2c0], factory: [0x34383c, 0xd2d6da], hq: [0x2b3a48, 0xe9e2d4], market: [0x2b3a48, 0xe9e2d4] }[kind] ?? [0x333333, 0xeeeeee];
    scene.background = new THREE.Color(palette[0]);
    scene.add(new THREE.HemisphereLight(0xfff6e6, 0x40342a, 1.7));
    const lamp = new THREE.PointLight(0xffd9a0, 8, 12);
    lamp.position.set(0, 3.2, 0.5);
    scene.add(lamp);
    const mat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
    const box = (w, h, d, c, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 14), mat(kind === 'box' ? 0x8f9aa6 : kind === 'inn' ? 0x5c3b25 : 0x9a7452));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 2;
    scene.add(floor);
    box(12, 3.6, 0.2, palette[1], 0, 1.8, -3.6);
    box(0.2, 3.6, 14, palette[1], -6, 1.8, 2);
    box(0.2, 3.6, 14, palette[1], 6, 1.8, 2);
    const seats = [];
    const table = (x, z, round = true) => {
      if (round) {
        const top = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.08, 20), mat(0xf6f1e6));
        top.position.set(x, 0.78, z);
        scene.add(top);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.78, 8), mat(0x6b4a33));
        leg.position.set(x, 0.39, z);
        scene.add(leg);
      } else box(2.4, 0.1, 1.2, 0x6b4a33, x, 0.78, z);
      seats.push([x - 0.9, z + 0.6], [x + 0.9, z + 0.6], [x, z - 0.95]);
    };
    if (kind === 'hall') {
      box(5, 0.5, 1.6, 0x7a2e2e, 0, 0.25, -2.6); // sahne
      table(-2.5, 0.6);
      table(2.5, 0.6);
      table(0, 2.8);
    } else if (kind === 'box') {
      // Loca: önde cam, arkasında saha
      box(12, 1.0, 0.3, 0xdfe6ee, 0, 0.5, -1.2);
      const pitch = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), mat(0x3e9a48));
      pitch.rotation.x = -Math.PI / 2;
      pitch.position.set(0, -2, -14);
      scene.add(pitch);
      scene.children.find((c) => c.geometry?.parameters?.height === 3.6 && c.position.z === -3.6).visible = false;
      for (let i = -4; i <= 4; i += 2) box(1.2, 0.5, 0.9, 0xc62828, i, 0.25, 0.4);
      seats.push([-2, 0.6], [0, 0.6], [2, 0.6]);
    } else if (kind === 'bank') {
      box(6, 1.1, 0.8, 0x6e7b86, 0, 0.55, -2.2); // gişe
      table(0, 1.2, false);
    } else if (kind === 'townhall' || kind === 'court') {
      box(4.5, 1.2, 1.2, 0x5a3b28, 0, 0.6, -2.4); // kürsü
      for (const x of [-3.4, 3.4]) box(0.06, 2.2, 0.06, 0x999999, x, 1.1, -3.2);
      table(0, 1.4, false);
    } else if (kind === 'school') {
      box(5, 1.6, 0.06, 0x24423a, 0, 1.8, -3.45); // kara tahta
      for (const [x, z] of [[-2.5, 0.5], [0, 0.5], [2.5, 0.5], [-2.5, 2.3], [0, 2.3], [2.5, 2.3]]) box(1.2, 0.08, 0.7, 0xc89a68, x, 0.6, z);
      seats.push([-2.5, 1.1], [2.5, 1.1], [0, 2.9]);
    } else if (kind === 'ballroom' || kind === 'restaurant') {
      if (kind === 'ballroom') {
        box(5, 0.5, 1.6, 0x6a2a3a, 0, 0.25, -2.6);
        for (const x of [-3, 3]) {
          const ch = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
          ch.position.set(x, 3.1, 0.5);
          scene.add(ch);
        }
      }
      table(-2.6, 0.4);
      table(2.6, 0.4);
      table(0, 2.6);
    } else if (kind === 'vip') {
      box(12, 2.6, 0.06, 0x9fc6e6, 0, 1.9, -3.45); // pist manzaralı cam
      for (const [x, z] of [[-2.4, 0], [2.4, 0]]) {
        box(2.2, 0.45, 0.9, 0x5a4a3a, x, 0.25, z);
        box(2.2, 0.6, 0.25, 0x5a4a3a, x, 0.6, z - 0.4);
      }
      box(1.2, 0.4, 0.8, 0xd8c8a8, 0, 0.35, 0.6);
      seats.push([-2.4, 0.1], [2.4, 0.1], [0, 1.6]);
    } else if (kind === 'exchange') {
      box(10, 1.6, 0.06, 0x1f3d2a, 0, 2.6, -3.45); // kayan fiyat panosu
      box(10, 0.3, 0.07, 0x5bd38a, 0, 2.2, -3.42);
      box(2.2, 1.1, 0.9, 0x5a4636, 0, 0.55, -2.0); // kürsü + gong
      const gong = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 20), mat(0xd4a83a, 0.3));
      gong.rotation.x = Math.PI / 2;
      gong.position.set(1.6, 1.6, -2.2);
      scene.add(gong);
      seats.push([-2.5, 1.2], [0, 1.6], [2.5, 1.2]);
    } else if (kind === 'summit') {
      box(7, 0.5, 1.8, 0x34495e, 0, 0.25, -2.5);
      box(6, 1.8, 0.06, 0x3a7bd5, 0, 2.1, -3.45);
      for (let r = 0; r < 2; r++) for (let i = -2; i <= 2; i++) box(0.8, 0.45, 0.6, 0x7f8c8d, i * 1.6, 0.22, 0.6 + r * 1.4);
      seats.push([-1.6, 0.9], [1.6, 0.9], [0, 2.3], [-3.2, 2.3], [3.2, 2.3]);
    } else if (kind === 'studio') {
      box(6, 0.4, 2.2, 0x23283a, 0, 0.2, -1.8); // stüdyo masası zemini
      box(3.6, 0.9, 0.9, 0xd8dde8, 0, 0.75, -1.6);
      box(8, 2.4, 0.06, 0x3f6fd8, 0, 2.2, -3.45); // dev ekran
      seats.push([-1.1, -1.0], [1.1, -1.0]);
    } else if (kind === 'newsroom') {
      for (const [x, z] of [[-2.6, -1.4], [0, -1.4], [2.6, -1.4], [-2.6, 1.2], [2.6, 1.2]]) {
        box(1.6, 0.08, 0.9, 0xc8b08a, x, 0.75, z);
        box(0.6, 0.4, 0.05, 0x20242a, x, 1.0, z - 0.3);
      }
      table(0, 1.6, false);
    } else if (kind === 'inn') {
      table(0, 0.8, false);
      for (const x of [-0.6, 0.6]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c0 }));
        c.position.set(x, 0.95, 0.8);
        scene.add(c);
      }
    } else {
      // depo / fabrika / genel
      for (const [x, z] of [[-3.5, -2.2], [-2.2, -2.2], [3.5, -2.2], [3.5, -0.9]]) box(1.1, 1.1, 1.1, 0xb98a4f, x, 0.55, z);
      table(0, 1.0, false);
    }
    // Oturan karakterler (oturma animasyonu yok: masanın arkasında alçak)
    const models = CHARACTER_NAMES.filter((n) => n !== 'Barbarian');
    const people = [];
    seats.slice(0, kind === 'school' ? 3 : 6).forEach(([x, z], i) => {
      const c = new Character(this.game, models[i % models.length], { look: (i * 2) % 6 });
      c.root.position.set(x, kind === 'box' ? 0 : -0.32, z);
      c.root.rotation.y = Math.atan2(-x, -z + 0.8) || 0;
      if (kind === 'box') c.root.rotation.y = Math.PI;
      scene.add(c.root);
      people.push(c);
    });
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
    const s = { scene, camera, people };
    this.scenes[kind] = s;
    return s;
  }

  // ---- Açma / kapama ----

  /** Mekâna gir (araçtan ya da şoförle). */
  enter(id, vars = {}) {
    const g = this.game;
    const v = VENUES[id];
    if (!v) return;
    if (id === 'hq') return g.drive.toPlaza();
    if (id === 'market') return g.drive.exitAt(0);
    this.current = { id, vars };
    this.s = this.sceneFor(v.kind);
    this.open = true;
    this.el.classList.remove('hidden');
    document.body.classList.add('in-plaza');
    this.resize();
    this.render();
    g.audio.play('pick');
  }

  leave() {
    this.open = false;
    this.current = null;
    this.el.classList.add('hidden');
    if (!this.game.plaza.open) document.body.classList.remove('in-plaza');
  }

  resize() {
    const cam = this.s.camera;
    const a = window.innerWidth / window.innerHeight;
    cam.aspect = a;
    cam.fov = a < 0.8 ? 64 : 52;
    // Dikey ekranda yukarıdan, alt yarıyı panel kapladığı için oda ekranın üst yarısında kalsın
    if (a < 0.8) {
      cam.position.set(0, 8.6, 9.5);
      cam.lookAt(0, 0, 2.6);
    } else {
      cam.position.set(0, 4.2, 8.2);
      cam.lookAt(0, 0.8, 0);
    }
    cam.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.open) return;
    for (const c of this.s.people) c.mixer.update(dt);
    this.tick += dt;
    if (this.tick > 0.5) {
      this.tick = 0;
      this.clock.textContent = `${t('Gün {n}', { n: this.game.day.day })} · ${this.game.day.clockText}`;
    }
  }

  draw(renderer) {
    if (this.s.camera.aspect !== window.innerWidth / window.innerHeight) this.resize();
    renderer.render(this.s.scene, this.s.camera);
  }

  /** Bu mekândaki ajanda maddeleri + mekâna özel işler. */
  render() {
    if (!this.open) return;
    const g = this.game;
    const { id, vars } = this.current;
    const v = VENUES[id];
    const name = this.nameOf(id, vars);
    this.title.textContent = `${v.emoji} ${name}`;
    this.clock.textContent = `${t('Gün {n}', { n: g.day.day })} · ${g.day.clockText}`;
    this.sheetTitle.textContent = `${v.emoji} ${name}`;
    const items = g.events.agendaHtml('ceo', { venue: id, vars });
    const extra = [];
    if (id === 'bank') extra.push(`<button data-go="safe">🏦 ${t('Banka işlemleri')}</button>`);
    if (id === 'townhall' && g.politics?.unlocked) extra.push(`<button data-go="politics">🏛️ ${t('Siyaset')}</button>`);
    if (id === 'stadium' && g.club?.unlocked) extra.push(`<button data-go="club">⚽ ${t('Kulüp')}</button>`);
    if ((id === 'gazette' || id === 'tv') && g.news) {
      const ok = g.news.canPositive && g.day.phase === 'open';
      const charity = g.day.day - g.news.lastCharity <= 5;
      extra.push(`<p class="note">🗞️ ${t('Olumlu haber yaptır (günde bir):')}</p>`,
        `<button data-pos="press" ${ok ? '' : 'disabled'}>🎤 ${t('Basın toplantısı')}</button>`,
        `<button data-pos="interview" ${ok ? '' : 'disabled'}>🗣️ ${t('Röportaj ver')}</button>`,
        `<button data-pos="sponsored" ${ok ? '' : 'disabled'}>🧾 ${t('Sponsorlu haber')}</button>`,
        `<button data-pos="charity" ${ok && charity ? '' : 'disabled'} title="${t('Son 5 günde bir hayır işi yaptıysan')}">❤️ ${t('Hayır işi haberi')}</button>`);
    }
    this.body.innerHTML = `${items || `<p class="note">${t('Şu an burada seni bekleyen bir etkinlik yok.')}</p>`}
      <div class="biz-btns">${extra.join('')}<button class="primary" data-leave>🚗 ${t('Araca dön')}</button><button data-plaza>🏢 ${t('Plazaya dön')}</button></div>`;
  }

  onClick(e) {
    const g = this.game;
    if (g.events.handleAgendaClick(e)) return;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.leave !== undefined) return this.leave();
    if (b.dataset.plaza !== undefined) {
      this.leave();
      return g.drive.toPlaza();
    }
    if (b.dataset.go === 'safe') {
      this.leave();
      g.drive.toPlaza();
      return g.plaza.openSheet('safe');
    }
    if (b.dataset.pos) {
      const fx = g.events.effects({});
      const r = g.news.positive(b.dataset.pos, fx);
      const text = `🗞️ ${r}${fx.summary.length ? ` · ${fx.summary.join(' · ')}` : ''}`;
      g.events.addLog(text);
      g.hud.toast(text);
      g.hud.setMoney(g.money);
      return this.render();
    }
    if (b.dataset.go === 'politics') return g.politics.open();
    if (b.dataset.go === 'club') return g.club.open();
  }
}

function signSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255,250,240,0.95)';
  x.beginPath();
  x.roundRect(4, 4, 504, 88, 26);
  x.fill();
  x.fillStyle = '#23302a';
  x.font = 'bold 44px "Trebuchet MS", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 50, 490);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(6, 1.1, 1);
  return s;
}
