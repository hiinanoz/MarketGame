import * as THREE from 'three';
import { DECOR } from './config.js';
import { prop } from './assets.js';

// Dekorasyon (💎 elmasla): zemin deseni, tabela rengi, mağaza önüne süsler ve ışık zinciri.
// Her süs müşteriyi biraz artırır (en fazla %10). Satın alınan desen/renkler sonra serbestçe seçilir.

export class Decor {
  constructor(game) {
    this.game = game;
    this.floor = 'classic';
    this.sign = 'green';
    this.owned = new Set(['floor:classic', 'sign:green']);
    this.items = [];      // yerleştirilen süs kimlikleri (slot sırasıyla)
    this.lights = false;
    this.meshes = [];
    this.lightGroup = null;
  }

  get customerFactor() {
    return 1 + Math.min(DECOR.bonusMax, this.items.length * DECOR.bonusPerItem + (this.lights ? DECOR.bonusPerItem : 0));
  }

  get freeSlots() {
    return DECOR.slots.length - this.items.length;
  }

  /** Zemin ya da tabela: sahipsen seç, değilsen elmasla al. */
  choose(kind, id) {
    const g = this.game;
    const list = kind === 'floor' ? DECOR.floors : DECOR.signs;
    const d = list.find((x) => x.id === id);
    if (!d) return false;
    const key = `${kind}:${id}`;
    if (!this.owned.has(key)) {
      if (!g.goals.spendGems(d.gems)) return false;
      this.owned.add(key);
    }
    this[kind] = id;
    this.apply();
    g.audio.play('unlock');
    g.save();
    return true;
  }

  buyItem(id) {
    const g = this.game;
    const d = DECOR.items.find((x) => x.id === id);
    if (!d || this.freeSlots <= 0 || !g.goals.spendGems(d.gems)) return false;
    this.items.push(id);
    this.placeItems();
    g.audio.play('unlock');
    g.hud.toast(`${d.emoji} ${d.name} yerleştirildi · müşteri +%${Math.round((this.customerFactor - 1) * 100)}`);
    g.save();
    return true;
  }

  removeItem(index) {
    this.items.splice(index, 1);
    this.placeItems();
    this.game.save();
  }

  buyLights() {
    const g = this.game;
    if (this.lights || !g.goals.spendGems(DECOR.lights.gems)) return false;
    this.lights = true;
    this.buildLights();
    g.audio.play('unlock');
    g.save();
    return true;
  }

  apply() {
    const w = this.game.world;
    w.setFloorTheme(DECOR.floors.find((f) => f.id === this.floor)?.colors ?? DECOR.floors[0].colors);
    w.setMarketTitle(this.game.marketTitle, DECOR.signs.find((s) => s.id === this.sign)?.color);
  }

  placeItems() {
    const g = this.game;
    for (const m of this.meshes) g.scene.remove(m);
    this.meshes = [];
    this.items.forEach((id, i) => {
      const d = DECOR.items.find((x) => x.id === id);
      const [x, z] = DECOR.slots[i];
      const m = prop(d.model);
      m.scale.setScalar(d.scale);
      m.position.set(x, 0, z);
      if (id === 'bench') m.rotation.y = Math.PI;
      m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      g.scene.add(m);
      this.meshes.push(m);
      g.nav.boxes.set(`decor-${i}`, { minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.4, maxZ: z + 0.4 });
    });
    for (let i = this.items.length; i < DECOR.slots.length; i++) g.nav.boxes.delete(`decor-${i}`);
    g.nav.rebuild();
  }

  /** Ön duvar boyunca renkli ampuller (gece parlar). */
  buildLights() {
    if (this.lightGroup || !this.lights) return;
    const g = this.game;
    const group = new THREE.Group();
    const colors = [0xffd23f, 0xff6b6b, 0x4dabf7, 0x7cff5b, 0xf783ac];
    const geo = new THREE.SphereGeometry(0.13, 8, 6);
    this.bulbMats = colors.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4 }));
    const wire = new THREE.MeshBasicMaterial({ color: 0x333333 });
    const xs = [];
    for (let x = -11.5; x <= 11.5; x += 0.8) xs.push(x);
    xs.forEach((x, i) => {
      const y = 3.15 - Math.abs(Math.sin((x / 2.4) * Math.PI)) * 0.25;
      const b = new THREE.Mesh(geo, this.bulbMats[i % colors.length]);
      b.position.set(x, y, 4.35);
      group.add(b);
    });
    const line = new THREE.Mesh(new THREE.BoxGeometry(23.4, 0.03, 0.03), wire);
    line.position.set(0, 3.25, 4.35);
    group.add(line);
    g.scene.add(group);
    this.lightGroup = group;
  }

  /** Gece ampuller daha parlak (gün döngüsünden çağrılır). */
  update() {
    if (!this.bulbMats) return;
    const h = this.game.day.hour % 24;
    const night = h >= 19 || h < 7;
    const blink = 0.6 + Math.sin(performance.now() / 300) * 0.4;
    for (const [i, m] of this.bulbMats.entries()) m.emissiveIntensity = night ? 1.2 + blink * ((i % 2) ? 1 : 0.5) : 0.35;
  }

  serialize() {
    return { floor: this.floor, sign: this.sign, owned: [...this.owned], items: this.items, lights: this.lights };
  }

  restore(d) {
    if (!d) return;
    this.floor = d.floor ?? 'classic';
    this.sign = d.sign ?? 'green';
    this.owned = new Set(d.owned ?? ['floor:classic', 'sign:green']);
    this.items = (d.items ?? []).filter((id) => DECOR.items.some((x) => x.id === id)).slice(0, DECOR.slots.length);
    this.lights = !!d.lights;
  }

  /** Kayıt yüklendikten sonra görünümü kur. */
  afterLoad() {
    this.apply();
    this.placeItems();
    this.buildLights();
  }
}
