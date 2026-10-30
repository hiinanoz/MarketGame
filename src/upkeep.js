import * as THREE from 'three';
import { t } from './i18n.js';
import { ROOM1, ROOM2, RATING, DIRT } from './config.js';

// Mağaza bakımı: kir lekeleri ve memnuniyet puanı.

// ---- Memnuniyet puanı (0-100, ekranda 1-5 yıldız) -------------------------------------

export class Rating {
  constructor(game) {
    this.game = game;
    this.value = RATING.start;
  }

  get stars() {
    return 1 + (this.value / 100) * 4;
  }

  /** Müşteri üretim çarpanı: düşük puan → daha az müşteri. */
  get spawnFactor() {
    return 0.5 + this.value / 100;
  }

  add(delta, reason) {
    const before = this.value;
    this.value = THREE.MathUtils.clamp(this.value + delta, 0, 100);
    if (reason && delta < 0 && Math.floor(before / 10) !== Math.floor(this.value / 10)) {
      this.game.hud.toast(`⭐ ${t('Memnuniyet düştü: {reason}', { reason })}`);
    }
  }

  update(dt) {
    const dirt = this.game.dirt.spots.length;
    if (dirt > DIRT.tolerated) this.add(-(dirt - DIRT.tolerated) * RATING.perDirtPerSec * dt);
    this.game.hud.setRating(this.stars);
  }
}

// ---- Kir lekeleri ----------------------------------------------------------------------

let dirtTextures;
function dirtTexture(i) {
  if (!dirtTextures) {
    dirtTextures = [0, 1, 2].map((seed) => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d');
      const rnd = mulberry(seed + 3);
      ctx.fillStyle = 'rgba(120, 84, 50, 0.75)';
      for (let k = 0; k < 7; k++) {
        ctx.beginPath();
        ctx.ellipse(64 + (rnd() - 0.5) * 50, 64 + (rnd() - 0.5) * 50, 12 + rnd() * 22, 10 + rnd() * 16, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(90, 60, 35, 0.6)';
      for (let k = 0; k < 10; k++) {
        ctx.beginPath();
        ctx.arc(64 + (rnd() - 0.5) * 100, 64 + (rnd() - 0.5) * 100, 3 + rnd() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      const ty = new THREE.CanvasTexture(c);
      ty.colorSpace = THREE.SRGBColorSpace;
      return ty;
    });
  }
  return dirtTextures[i % dirtTextures.length];
}

const dirtGeo = new THREE.PlaneGeometry(1.3, 1.3);

export class DirtSystem {
  constructor(game) {
    this.game = game;
    this.spots = []; // { mesh, x, z, progress, claimedBy }
    this.enabled = false;
  }

  /** Müşteri adımları: içerideyse küçük bir olasılıkla leke bırakır. */
  maybeSpawn(x, z, dt) {
    if (!this.enabled || this.spots.length >= DIRT.max) return;
    const inside = inRoom(x, z, ROOM1) || (this.game.room2Open && inRoom(x, z, ROOM2));
    if (!inside) return;
    if (Math.random() < DIRT.chancePerSec * dt) this.add(x, z);
  }

  add(x, z) {
    // Aynı yere üst üste leke koyma
    if (this.spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.2)) return;
    const mat = new THREE.MeshBasicMaterial({ map: dirtTexture(this.spots.length), transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(dirtGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.random() * Math.PI * 2;
    mesh.position.set(x, 0.025, z);
    mesh.renderOrder = 1;
    this.game.scene.add(mesh);
    this.spots.push({ mesh, x, z, progress: 0, claimedBy: null });
  }

  /** Oyuncu ya da temizlikçi lekenin üstündeyken temizler. true → leke bitti. */
  scrub(spot, dt, speed = 1) {
    spot.progress += dt * speed / DIRT.cleanTime;
    spot.mesh.material.opacity = Math.max(0, 1 - spot.progress);
    if (spot.progress >= 1) {
      this.remove(spot);
      this.game.rating.add(RATING.cleaned);
      this.game.audio.play('pick', 0.4);
      return true;
    }
    return false;
  }

  remove(spot) {
    const i = this.spots.indexOf(spot);
    if (i >= 0) this.spots.splice(i, 1);
    this.game.scene.remove(spot.mesh);
    spot.mesh.material.dispose();
  }

  nearest(x, z, maxDist = Infinity, filter = () => true) {
    let best = null;
    let bd = maxDist;
    for (const s of this.spots) {
      if (!filter(s)) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  serialize() {
    return this.spots.map((s) => [Math.round(s.x * 10) / 10, Math.round(s.z * 10) / 10]);
  }

  restore(list) {
    for (const [x, z] of list ?? []) this.add(x, z);
  }
}

function inRoom(x, z, r) {
  return x > r.minX + 0.5 && x < r.maxX - 0.5 && z > r.minZ + 0.5 && z < r.maxZ - 0.5;
}

function mulberry(a) {
  return () => {
    let ty = (a += 0x6d2b79f5);
    ty = Math.imul(ty ^ (ty >>> 15), ty | 1);
    ty ^= ty + Math.imul(ty ^ (ty >>> 7), ty | 61);
    return ((ty ^ (ty >>> 14)) >>> 0) / 4294967296;
  };
}
