import * as THREE from 'three';
import { t } from './i18n.js';
import { prop } from './assets.js';
import { ROAD_SPAN } from './config.js';
import { VENUES } from './venues.js';

// Makam aracı (1.2-b, 1.3 serbest sürüş): şehir modunda plazadan "Şehre çık" → joystick ile haritanın her yerinde
// sürüş (binalara çarpar, araç yöne döner, yürümekten ~4 kat hızlı). Mekân kapısına yaklaşınca "İçeri gir",
// "Arabadan in" ile yürüyerek devam, "Plazaya dön".
// Ajandadaki etkinliğe "Şoförle git" de mümkün (oyun saatinden ~20 dk).

const LANE = 19.6;
const SPEED = 16;
const STOP_RADIUS = 6;   // kapıya bu kadar yaklaşınca "İçeri gir"
const DRIVE_ZOOM = 1.5;  // sürerken kamera uzaklaşır
// Araca kapalı alanlar: market salonları + arka depo + bahçe (x −57…31, z −32…5.5)
const NO_DRIVE = [{ minX: -57, maxX: 31, minZ: -32, maxZ: 5.5 }];
const CHAUFFEUR_HOURS = 1 / 3;

export class Drive {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.car = null;
    this.speed = 0;
    this.btn = document.createElement('div');
    this.btn.id = 'drive-bar';
    this.btn.className = 'drive-bar hidden';
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.btn);
    this.stop = null;
    this.tick = 0;
  }

  makeCar() {
    if (this.car) return;
    const g = new THREE.Group();
    const lux = this.game.level >= 66;
    const m = prop(lux ? 'car_sedan' : 'car_sedan');
    m.scale.setScalar(3.4);
    m.rotation.y = Math.PI / 2;
    m.position.y = 0.2;
    m.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.material = o.material.clone();
        o.material.color?.multiplyScalar(0.35); // siyah makam aracı
      }
    });
    g.add(m);
    this.car = g;
    this.game.scene.add(g);
  }

  /** Mekânın kapı önü (sürüşte durak noktası). */
  stopPoint(id, vars = {}) {
    const g = this.game;
    const v = VENUES[id];
    if (!v) return null;
    if (v.dynamic) {
      const b = g.holding.get(vars.id);
      return b ? [b.x, b.frontZ + (b.def.building?.facing === -1 ? -1.6 : 1.6)] : null;
    }
    if (v.existing) return [v.x, LANE];
    return [v.x, v.north ? 13.2 : 25.8];
  }

  /** Şehre çık: araç plazanın (ya da verilen yerin) önünde. */
  start(x = VENUES.hq.x, z = null) {
    const g = this.game;
    this.makeCar();
    this.active = true;
    g.plaza.hide();
    g.player.root.visible = false;
    g.playerRing.visible = false;
    const pz = z ?? (x === VENUES.hq.x ? this.stopPoint('hq')[1] : LANE);
    g.player.position.set(x, 0, pz);
    this.car.position.set(x, 0, pz);
    this.vel = new THREE.Vector3();
    if (this.prevZoom === undefined) {
      this.prevZoom = g.zoomTarget ?? 1;
      g.setZoom(Math.max(this.prevZoom, DRIVE_ZOOM));
    }
    this.car.visible = true;
    g.cameraTarget.copy(g.player.position);
    this.btn.classList.remove('hidden');
    document.body.classList.add('in-drive');
    this.stop = undefined;
    this.renderBar();
  }

  /** Arabadan in (yürüyerek, arabanın olduğu yerde; yürüyüş sınırları uygulanır). */
  exitAt(x, z) {
    const g = this.game;
    this.end();
    if (x !== undefined) {
      g.player.position.set(x, 0, z ?? 14.5);
      g.cameraTarget.copy(g.player.position);
    }
  }

  end() {
    const g = this.game;
    this.active = false;
    if (this.car) this.car.visible = false;
    g.player.root.visible = true;
    g.playerRing.visible = true;
    this.btn.classList.add('hidden');
    document.body.classList.remove('in-drive');
    g.venues.leave();
    if (this.prevZoom !== undefined) {
      g.setZoom(this.prevZoom);
      this.prevZoom = undefined;
    }
  }

  toPlaza() {
    this.end();
    this.game.ceoDesk.show();
  }

  /** Ajandadan "Şoförle git": zaman ilerler, mekâna girilir. */
  chauffeur(venue, vars = {}) {
    const g = this.game;
    const pt = this.stopPoint(venue, vars);
    if (!pt) return;
    g.fastForward(CHAUFFEUR_HOURS, `🚗 ${t('Şoför yolda')}`, () => {
      this.start(pt[0], pt[1]);
      g.venues.enter(venue, vars);
    });
  }

  update(dt) {
    if (!this.active) return false;
    const g = this.game;
    const p = g.player;
    if (g.venues.open) return true;
    // Serbest sürüş: joystick yönü → hız (yumuşak ivme), binalara çarpma, harita sınırları
    const m = g.input.move;
    this.vel ??= new THREE.Vector3();
    const k = Math.min(1, dt * 3);
    this.vel.x += (m.x * SPEED - this.vel.x) * k;
    this.vel.z += (m.z * SPEED - this.vel.z) * k;
    p.position.x += this.vel.x * dt;
    p.position.z += this.vel.z * dt;
    g.nav.collide(p.position, 1.3);
    // Market, depo ve bahçe araca kapalı (kapılardan içeri girmesin)
    for (const zn of NO_DRIVE) {
      const q = p.position;
      if (q.x > zn.minX && q.x < zn.maxX && q.z > zn.minZ && q.z < zn.maxZ) {
        const out = [[q.x - zn.minX, 'x', zn.minX], [zn.maxX - q.x, 'x', zn.maxX], [q.z - zn.minZ, 'z', zn.minZ], [zn.maxZ - q.z, 'z', zn.maxZ]].sort((a, b) => a[0] - b[0])[0];
        q[out[1]] = out[2];
      }
    }
    p.position.x = THREE.MathUtils.clamp(p.position.x, ROAD_SPAN.west + 3, ROAD_SPAN.east - 3);
    p.position.z = THREE.MathUtils.clamp(p.position.z, g.level >= 31 ? -158 : -96, Math.max(40, g.level >= 66 ? 54 : 40));
    p.velocity.copy(this.vel);
    this.speed = this.vel.length();
    this.car.position.copy(p.position);
    if (this.speed > 0.6) {
      const want = Math.atan2(this.vel.x, this.vel.z) - Math.PI / 2; // model +x'e bakıyor
      let diff = want - this.car.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.car.rotation.y += diff * Math.min(1, dt * 8);
    }
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.25;
      const s = this.nearStops();
      const key = s.map((x) => `${x.id}:${x.vars?.id ?? ''}`).join(',');
      if (key !== this.stopKey || this.stop === undefined) {
        this.stopKey = key;
        this.stops = s;
        this.stop = s[0] ?? null;
        this.renderBar();
      }
    }
    return true;
  }

  /** Yakındaki duraklar (aynı yerde birden fazla mekân olabilir: stadyum / havalimanı). */
  nearStops() {
    const g = this.game;
    const { x, z } = g.player.position;
    const out = [];
    const cand = Object.keys(VENUES).filter((id) => !VENUES[id].dynamic && (!VENUES[id].level || g.level >= VENUES[id].level)).map((id) => ({ id, vars: {} }));
    for (const a of g.events.active) {
      const c = g.events.card(a.id);
      if (g.events.placeOf(c, a) === 'biz' && a.vars?.id) cand.push({ id: 'biz', vars: a.vars });
    }
    for (const c of cand) {
      const pt = this.stopPoint(c.id, c.vars);
      if (!pt) continue;
      const d = Math.hypot(pt[0] - x, pt[1] - z);
      if (d < STOP_RADIUS) out.push({ ...c, x: pt[0], d });
    }
    // Bugün maddesi olan durak önce
    const has = (s) => g.events.active.some((a) => g.events.placeOf(g.events.card(a.id), a) === s.id);
    return out.sort((a, b) => (has(b) - has(a)) || a.d - b.d).slice(0, 3);
  }

  renderBar() {
    const g = this.game;
    const stops = this.stops ?? [];
    const btn = (s, i) => {
      const waiting = g.events.active.filter((a) => g.events.placeOf(g.events.card(a.id), a) === s.id && (s.id !== 'biz' || a.vars?.id === s.vars.id)).length;
      const name = g.venues.nameOf(s.id, s.vars);
      return `<button class="${i === 0 ? 'primary' : ''}" data-enter="${i}">${VENUES[s.id].emoji} ${s.id === 'market' ? t('Markete gir') : s.id === 'hq' ? t('Plazaya gir') : t('İçeri gir: {name}', { name })}${waiting ? ` <i class="badge">${waiting}</i>` : ''}</button>`;
    };
    this.btn.innerHTML = `${stops.length ? stops.map(btn).join('') : `<span class="drive-hint">🚗 ${t('İstediğin yere sür: mekân kapısına yaklaşınca içeri girebilirsin')}</span>`}
      <div class="drive-row"><button data-walk>🚶 ${t('Arabadan in')}</button><button data-plaza>🏢 ${t('Plazaya dön')}</button></div>`;
  }

  onClick(e) {
    const g = this.game;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.enter !== undefined && this.stops?.[Number(b.dataset.enter)]) {
      const s = this.stops[Number(b.dataset.enter)];
      this.speed = 0;
      g.venues.enter(s.id, s.vars);
    } else if (b.dataset.walk !== undefined) this.exitAt(g.player.position.x, g.player.position.z);
    else if (b.dataset.plaza !== undefined) this.toPlaza();
  }
}
