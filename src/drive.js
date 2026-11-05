import * as THREE from 'three';
import { t } from './i18n.js';
import { prop } from './assets.js';
import { ROAD_SPAN } from './config.js';
import { VENUES } from './venues.js';

// Makam aracı (1.2-b): şehir modunda plazadan "Şehre çık" → oyuncu ana caddede arabayla gezer (joystick sağ/sol).
// Durağa gelince "İçeri gir" (mekân iç sahnesi), "Arabadan in" ile yürüyerek devam, "Plazaya dön".
// Ajandadaki etkinliğe "Şoförle git" de mümkün (oyun saatinden ~20 dk).

const LANE = 19.6;
const SPEED = 16;
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

  /** Şehre çık: araç plazanın önünde. */
  start(x = VENUES.hq.x) {
    const g = this.game;
    this.makeCar();
    this.active = true;
    g.plaza.hide();
    g.player.root.visible = false;
    g.playerRing.visible = false;
    g.player.position.set(x, 0, LANE);
    this.car.position.set(x, 0, LANE);
    this.car.visible = true;
    g.cameraTarget.copy(g.player.position);
    this.btn.classList.remove('hidden');
    document.body.classList.add('in-drive');
    this.stop = undefined;
    this.renderBar();
  }

  /** Arabadan in (yürüyerek). */
  exitAt(x) {
    const g = this.game;
    this.end();
    if (x !== undefined) {
      g.player.position.set(x, 0, 14.5);
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
  }

  toPlaza() {
    this.end();
    this.game.ceoDesk.show();
  }

  /** Ajandadan "Şoförle git": zaman ilerler, mekâna girilir. */
  chauffeur(venue, vars = {}) {
    const g = this.game;
    const x = g.venues.stopX(venue, vars);
    if (x === null) return;
    g.fastForward(CHAUFFEUR_HOURS, `🚗 ${t('Şoför yolda')}`, () => {
      this.start(x);
      g.venues.enter(venue, vars);
    });
  }

  update(dt) {
    if (!this.active) return false;
    const g = this.game;
    const p = g.player;
    if (g.venues.open) return true;
    const mx = g.input.move.x;
    const target = mx * SPEED;
    this.speed += (target - this.speed) * Math.min(1, dt * 3);
    p.position.x = THREE.MathUtils.clamp(p.position.x + this.speed * dt, ROAD_SPAN.west + 3, ROAD_SPAN.east - 3);
    p.position.z = LANE;
    p.velocity.set(this.speed, 0, 0);
    this.car.position.copy(p.position);
    if (Math.abs(this.speed) > 0.3) this.car.rotation.y = this.speed > 0 ? 0 : Math.PI;
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
    const x = g.player.position.x;
    const out = [];
    const cand = Object.keys(VENUES).filter((id) => !VENUES[id].dynamic && (!VENUES[id].level || g.level >= VENUES[id].level)).map((id) => ({ id, x: VENUES[id].x, vars: {} }));
    for (const a of g.events.active) {
      const c = g.events.card(a.id);
      if (g.events.placeOf(c, a) === 'biz' && a.vars?.id) cand.push({ id: 'biz', x: g.venues.stopX('biz', a.vars), vars: a.vars });
    }
    for (const c of cand) {
      if (c.x === null) continue;
      const d = Math.abs(c.x - x);
      if (d < 4) out.push({ ...c, d });
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
    this.btn.innerHTML = `${stops.length ? stops.map(btn).join('') : `<span class="drive-hint">🚗 ${t('Sağa sola sür: duraklarda içeri girebilirsin')}</span>`}
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
    } else if (b.dataset.walk !== undefined) this.exitAt(g.player.position.x);
    else if (b.dataset.plaza !== undefined) this.toPlaza();
  }
}
