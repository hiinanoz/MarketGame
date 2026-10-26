import * as THREE from 'three';
import { HOUSING, DAY, RENT, XP_PER_PURCHASE } from './config.js';
import { textTexture } from './fx.js';
import { formatMoney } from './hud.js';

// Konut (Sv.36+, doğu mahallesi): arsa al → ev tipini seç ve öde → birkaç günde aşama aşama
// inşa edilir → kiraya ver. Kiracılar belli sürelerde çıkar, daire tadilat ister.
// Her binaya ayrı emlakçı alınabilir: kiracı bulma ve tadilatı kendisi yapar, kiradan %10 alır.
// Kira gelirleri günlük birikir, her 7. günün sonunda kasaya geçer.

const STAGES = [
  [0, '🧱 Temel'],
  [0.25, '🏗️ Kaba inşaat'],
  [0.8, '🏠 Çatı ve boya'],
  [1, '✅ Bitti'],
];
const COLORS = [0xf4d6a0, 0xd9e8f5, 0xf5c6c6, 0xd6efc7, 0xe8dcf5, 0xfbe3b0];

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class Housing {
  constructor(game) {
    this.game = game;
    this.company = false; // kendi inşaat şirketin
    this.plots = HOUSING.plots.map(([x, z], i) => ({
      i, x, z, owned: false, type: null, progress: 0, built: false, agent: false,
      units: [], accrued: 0, name: '', color: COLORS[i % COLORS.length],
    }));
    this.root = new THREE.Group();
    game.scene.add(this.root);
    for (const p of this.plots) {
      p.group = new THREE.Group();
      p.group.position.set(p.x, 0, p.z);
      this.root.add(p.group);
      p.label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      p.label.renderOrder = 6;
      p.label.position.set(p.x, 7, p.z + 2);
      this.root.add(p.label);
      this.rebuild(p);
    }
    this.root.visible = false;
  }

  get unlocked() {
    return this.game.level >= HOUSING.fromLevel;
  }

  type(p) {
    return HOUSING.types[p.type];
  }

  costOf(typeId) {
    return Math.round(HOUSING.types[typeId].cost * (this.company ? HOUSING.company.costFactor : 1));
  }

  buildDays(typeId) {
    return HOUSING.types[typeId].days * (this.company ? HOUSING.company.timeFactor : 1);
  }

  /** Toplam değer (kredi limiti için). */
  get value() {
    let v = 0;
    for (const p of this.plots) {
      if (!p.owned) continue;
      v += HOUSING.plotPrice;
      if (p.type) v += HOUSING.types[p.type].cost * p.progress;
    }
    return Math.round(v);
  }

  get agents() {
    return this.plots.filter((p) => p.agent).length;
  }

  get ownedCount() {
    return this.plots.filter((p) => p.owned).length;
  }

  /** Kiradaki dairelerin haftalık toplam kirası. */
  get weeklyIncome() {
    let n = 0;
    for (const p of this.plots) {
      if (!p.built) continue;
      const t = this.type(p);
      n += p.units.filter((u) => u.state === 'rented').length * t.rent;
    }
    return n;
  }

  // ---- İşlemler ----

  buyPlot(i) {
    const g = this.game;
    const p = this.plots[i];
    if (!this.unlocked || p.owned || g.money < HOUSING.plotPrice) return false;
    g.spend(HOUSING.plotPrice);
    p.owned = true;
    g.gainXp(Math.floor(HOUSING.plotPrice / XP_PER_PURCHASE));
    g.hud.toast(`📜 Arsa ${i + 1} senin — ev tipini seç`);
    g.audio.play('unlock');
    this.rebuild(p);
    g.save();
    return true;
  }

  build(i, typeId) {
    const g = this.game;
    const p = this.plots[i];
    const t = HOUSING.types[typeId];
    const cost = this.costOf(typeId);
    if (!p.owned || p.type || !t || g.level < t.level || g.money < cost) return false;
    g.spend(cost);
    p.type = typeId;
    p.progress = 0;
    p.units = Array.from({ length: t.units }, () => ({ state: 'empty', t: 0 }));
    g.gainXp(Math.floor(cost / XP_PER_PURCHASE));
    g.hud.toast(`🏗️ ${t.name} inşaatı başladı (~${Math.ceil(this.buildDays(typeId))} gün)`);
    g.audio.play('unlock');
    this.rebuild(p);
    g.save();
    return true;
  }

  buyCompany() {
    const g = this.game;
    const c = HOUSING.company;
    if (this.company || g.level < c.level || g.money < c.price) return false;
    g.spend(c.price);
    this.company = true;
    g.gainXp(Math.floor(c.price / XP_PER_PURCHASE));
    g.hud.toast('🏗️ İnşaat şirketin kuruldu: inşaatlar daha hızlı ve ucuz');
    g.audio.play('unlock');
    g.save();
    return true;
  }

  hireAgent(i) {
    const g = this.game;
    const p = this.plots[i];
    const a = HOUSING.agent;
    if (!p.built || p.agent || g.level < a.level || g.money < a.hire) return false;
    g.spend(a.hire);
    p.agent = true;
    g.hud.toast('🧑‍💼 Emlakçı işe başladı: kiracı ve tadilatla o ilgilenir (%10 komisyon)');
    this.agentWork(p);
    this.rebuild(p);
    g.save();
    return true;
  }

  fireAgent(i) {
    const p = this.plots[i];
    if (!p.agent) return false;
    p.agent = false;
    this.rebuild(p);
    this.game.save();
    return true;
  }

  /** Boş daireleri ilana ver (emlakçısız: elle). */
  list(i) {
    const p = this.plots[i];
    let n = 0;
    for (const u of p.units) {
      if (u.state !== 'empty') continue;
      u.state = 'listed';
      u.t = rand(...(p.agent ? HOUSING.agentSearchDays : HOUSING.searchDays));
      n++;
    }
    if (n) this.game.hud.toast(`📋 ${n} daire kiraya verildi — kiracı aranıyor`);
    this.settleInstant(p);
    this.game.save();
    return n;
  }

  /** Kiracısı çıkan daireleri tadilat et (ücretli, 1 gün). */
  renovate(i) {
    const g = this.game;
    const p = this.plots[i];
    const t = this.type(p);
    let n = 0;
    for (const u of p.units) {
      if (u.state !== 'dirty') continue;
      if (g.money < t.renovation) break;
      g.spend(t.renovation);
      u.state = 'renovating';
      u.t = 1;
      n++;
    }
    if (n) g.hud.toast(`🔧 ${n} dairede tadilat başladı`);
    g.save();
    return n;
  }

  /** Arama süresi 0 olan ilanlar hemen kiralanır. */
  settleInstant(p) {
    for (const u of p.units) {
      if (u.state === 'listed' && u.t <= 0) {
        u.state = 'rented';
        u.t = rand(...HOUSING.tenancyDays);
      }
    }
  }

  /** Emlakçı: boş daireyi ilana verir, çıkan kiracının dairesini tadilat ettirir. */
  agentWork(p) {
    if (!p.agent || !p.built) return;
    const g = this.game;
    const t = this.type(p);
    for (const u of p.units) {
      if (u.state === 'dirty' && g.money >= t.renovation) {
        g.money -= t.renovation;
        this.today.renovation = (this.today.renovation ?? 0) + t.renovation;
        u.state = 'renovating';
        u.t = 1;
      }
      if (u.state === 'empty') {
        u.state = 'listed';
        u.t = rand(...HOUSING.agentSearchDays);
      }
    }
    this.settleInstant(p);
  }

  // ---- Zaman ----

  get today() {
    this._today ??= {};
    return this._today;
  }

  update(dt) {
    this.root.visible = this.game.level >= HOUSING.fromLevel - 1;
    if (!this.root.visible) return;
    this.labelT = (this.labelT ?? 0) - dt;
    if (this.labelT <= 0) {
      this.labelT = 1;
      for (const p of this.plots) this.updateLabel(p);
    }
    // İnşaat sadece gündüz ilerler
    if (this.game.day.phase !== 'open') return;
    for (const p of this.plots) {
      if (!p.type || p.built) continue;
      const before = stageIndex(p.progress);
      const step = Math.floor(p.progress * 10);
      p.progress = Math.min(1, p.progress + dt / (this.buildDays(p.type) * DAY.length));
      if (p.progress >= 1) {
        p.built = true;
        this.game.hud.toast(`🎉 ${this.type(p).emoji} ${this.type(p).name} bitti — kiraya verebilirsin`);
        this.game.audio.play('unlock');
        this.game.gainXp(20);
        this.agentWork(p);
        this.rebuild(p);
        this.game.save();
      } else if (Math.floor(p.progress * 10) !== step || stageIndex(p.progress) !== before) {
        this.rebuild(p);
      }
    }
  }

  /** Gün sonu: kiracı süreleri, tadilat, günlük kira birikimi; haftanın son günü ödeme. */
  endOfDay(today) {
    const g = this.game;
    let left = 0;
    for (const p of this.plots) {
      if (!p.built) continue;
      const t = this.type(p);
      for (const u of p.units) {
        if (u.state === 'rented') {
          p.accrued += t.rent / RENT.week;
          u.t--;
          if (u.t <= 0) {
            u.state = 'dirty'; // kiracı çıktı, tadilat gerekli
            left++;
          }
        } else if (u.state === 'listed') {
          u.t--;
          if (u.t <= 0) {
            u.state = 'rented';
            u.t = rand(...HOUSING.tenancyDays);
          }
        } else if (u.state === 'renovating') {
          u.t--;
          if (u.t <= 0) u.state = 'empty';
        }
      }
      this.agentWork(p);
      this.rebuild(p);
    }
    const info = {};
    if (left) info.left = left;
    if (this._today?.renovation) info.renovation = this._today.renovation;
    // Haftalık kira ödemesi
    if (g.day.day % RENT.week === 0) {
      let gross = 0;
      let commission = 0;
      for (const p of this.plots) {
        if (!p.accrued) continue;
        const a = Math.round(p.accrued);
        const c = p.agent ? Math.round(a * HOUSING.agent.commission) : 0;
        gross += a;
        commission += c;
        p.accrued = 0;
      }
      if (gross) {
        g.money += gross - commission;
        info.rent = gross;
        info.commission = commission;
        if (gross - commission > 0) g.gainXp(Math.floor((gross - commission) / 100));
      }
    }
    this._today = {};
    if (Object.keys(info).length) today.housing = info;
    if (left) g.hud.toast(`🚪 ${left} kiracı çıktı — daire tadilat bekliyor`);
  }

  // ---- Görsel ----

  rebuild(p) {
    const grp = p.group;
    for (const c of [...grp.children]) grp.remove(c);
    const S = HOUSING.plotSize;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(S, S),
      new THREE.MeshStandardMaterial({ color: p.owned ? (p.type ? 0xbfae92 : 0xc9a77a) : 0x9fd27f, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.012;
    ground.receiveShadow = true;
    grp.add(ground);
    if (!p.owned) {
      // Satılık tabelası
      grp.add(signPost('SATILIK ARSA'));
    } else if (p.type) {
      grp.add(houseMesh(p.type, p.progress, p.color));
      if (!p.built) grp.add(scaffold(p.type, p.progress));
    }
    this.updateLabel(p);
  }

  updateLabel(p) {
    const text = this.labelText(p);
    if (text !== p.labelText) {
      p.labelText = text;
      p.label.material.map?.dispose();
      const tex = textTexture(text, { color: p.owned ? '#1e5d2b' : '#5a3a10', size: 40, stroke: '#ffffff' });
      p.label.material.map = tex;
      p.label.material.needsUpdate = true;
      p.label.scale.set(1.1 * (tex.image.width / tex.image.height), 1.1, 1);
    }
  }

  labelText(p) {
    if (!p.owned) return this.game.level < HOUSING.fromLevel ? `🔒 Sv.${HOUSING.fromLevel}` : `📜 $${formatMoney(HOUSING.plotPrice)}`;
    if (!p.type) return `📜 Arsa ${p.i + 1}`;
    const t = this.type(p);
    if (!p.built) return `${t.emoji} 🏗️ %${Math.floor(p.progress * 100)}`;
    const rented = p.units.filter((u) => u.state === 'rented').length;
    return `${t.emoji} ${rented}/${p.units.length} kirada${p.agent ? ' 🧑‍💼' : ''}`;
  }

  serialize() {
    return {
      company: this.company,
      plots: this.plots.map((p) => ({ owned: p.owned, type: p.type, progress: p.progress, built: p.built, agent: p.agent, units: p.units, accrued: p.accrued, name: p.name })),
    };
  }

  restore(d) {
    if (!d) return;
    this.company = !!d.company;
    (d.plots ?? []).forEach((s, i) => {
      const p = this.plots[i];
      if (!p || !s) return;
      Object.assign(p, { owned: !!s.owned, type: s.type ?? null, progress: s.progress ?? 0, built: !!s.built, agent: !!s.agent, units: s.units ?? [], accrued: s.accrued ?? 0, name: s.name ?? '' });
      this.rebuild(p);
    });
  }
}

export function stageIndex(progress) {
  let k = 0;
  for (let i = 0; i < STAGES.length; i++) if (progress >= STAGES[i][0]) k = i;
  return k;
}

export function stageName(progress) {
  return STAGES[stageIndex(progress)][1];
}

// ---- Basit (prosedürel) binalar ----

const mats = new Map();
function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  return mats.get(color);
}

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function gable(w, d, h, color) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 - 0.3, 0);
  s.lineTo(w / 2 + 0.3, 0);
  s.lineTo(0, h);
  s.closePath();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: d + 0.4, bevelEnabled: false }), mat(color));
  m.position.z = -d / 2 - 0.2;
  m.castShadow = true;
  return m;
}

/** Ön cephe pencereleri (koyu kareler). */
function windows(g, w, floors, floorH, z, cols) {
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      g.add(box(0.8, 0.9, 0.06, 0x5a7d9a, -w / 2 + (w / cols) * (c + 0.5), f * floorH + floorH * 0.55, z));
    }
  }
}

function houseMesh(type, progress, color) {
  const g = new THREE.Group();
  g.add(box(type === 'site' ? 9.4 : 7.4, 0.3, type === 'site' ? 9.4 : 7.4, 0x9e9e9e, 0, 0.15, 0)); // temel
  if (progress < 0.25) return g;
  const wallK = Math.min(1, (progress - 0.25) / 0.55); // duvarlar 0.25 → 0.8 arası yükselir
  const roofOn = progress >= 0.8;
  if (type === 'house' || type === 'villa') {
    const w = type === 'villa' ? 7 : 5.6;
    const d = type === 'villa' ? 6 : 5;
    const h = (type === 'villa' ? 5.6 : 3.2) * wallK;
    const body = box(w, h, d, color, 0, 0.3 + h / 2, -0.4);
    g.add(body);
    if (roofOn) {
      if (type === 'house') {
        const r = gable(w, d, 2, 0xb5523b);
        r.position.set(0, 0.3 + h, -0.4 - d / 2 - 0.2);
        g.add(r);
      } else {
        g.add(box(w + 0.6, 0.35, d + 0.6, 0x546e7a, 0, 0.3 + h + 0.17, -0.4));
        const pool = box(3.4, 0.08, 2, 0x4fc3f7, -1.4, 0.36, 3.4);
        g.add(pool);
      }
      g.add(box(1.1, 2, 0.1, 0x6d4c41, 0, 1.3, -0.4 + d / 2 + 0.03));
      windows(g, w, type === 'villa' ? 2 : 1, 2.8, -0.4 + d / 2 + 0.04, 3);
    }
    return g;
  }
  // Apartman / site: kat kat yükselir
  const floors = type === 'apartment' ? 4 : 3;
  const floorH = 2.4;
  const shown = Math.max(1, Math.ceil(floors * wallK));
  const blocks = type === 'apartment' ? [[0, 6, 6]] : [[-2.4, 4, 6], [2.4, 4, 6]];
  for (const [bx, w, d] of blocks) {
    for (let f = 0; f < shown; f++) {
      const top = f === shown - 1 && !roofOn ? wallK * floors - f : 1;
      const h = floorH * Math.max(0.3, Math.min(1, top));
      g.add(box(w, h, d, f % 2 ? color : shade(color), bx, 0.3 + f * floorH + h / 2, -0.6));
    }
    if (roofOn) {
      g.add(box(w + 0.4, 0.3, d + 0.4, 0x607d8b, bx, 0.3 + floors * floorH + 0.15, -0.6));
      const wg = new THREE.Group();
      windows(wg, w, floors, floorH, 0, 3);
      wg.position.set(bx, 0.3, -0.6 + d / 2 + 0.04);
      g.add(wg);
    }
  }
  if (type === 'site' && roofOn) g.add(box(5, 0.08, 1.6, 0x4fc3f7, 0, 0.36, 3.6)); // havuz
  return g;
}

function shade(color) {
  const c = new THREE.Color(color);
  c.multiplyScalar(0.92);
  return c.getHex();
}

function scaffold(type, progress) {
  const g = new THREE.Group();
  const h = 0.6 + progress * (type === 'apartment' ? 10 : type === 'site' ? 7.5 : 4);
  const s = type === 'site' ? 4.8 : 3.8;
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) g.add(box(0.15, h, 0.15, 0xf2b705, x, h / 2, z));
  g.add(box(0.6, 0.6, 0.6, 0xe67e22, s + 0.8, 0.3, s)); // malzeme yığını
  return g;
}

function signPost(text) {
  const g = new THREE.Group();
  g.add(box(0.15, 1.6, 0.15, 0x6b4a33, 0, 0.8, 3.8));
  const tex = textTexture(text, { color: '#5a3a10', size: 36, stroke: '#ffffff' });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6 * tex.image.height / tex.image.width), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  board.position.set(0, 1.7, 3.9);
  g.add(board);
  return g;
}
