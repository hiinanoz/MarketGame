import * as THREE from 'three';
import { prop } from './assets.js';
import { ROOM1, ROOM2, DOOR_X } from './config.js';

// Statik çevre: çimen, yol, mağaza zemini, duvarlar, dekor. Çarpışma kutularını nav'a kaydeder.

const WALL_H_SCALE_FRONT = 0.28; // ön duvar alçak: kamera içeriyi görebilsin

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.room2 = new THREE.Group();
    this.room2.visible = false;
    this.scene.add(this.room2);
    this.dividerWalls = []; // salonlar arasındaki, genişlemede kaldırılacak duvarlar
    this.build();
  }

  build() {
    const s = this.scene;
    const nav = this.game.nav;

    // Çimen
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({ color: 0x86c96b, roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    grass.receiveShadow = true;
    s.add(grass);

    // Kaldırım + yol
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 3),
      new THREE.MeshStandardMaterial({ color: 0xd9cfb8, roughness: 1 }),
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, -0.01, 15.5);
    walk.receiveShadow = true;
    s.add(walk);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 6),
      new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 1 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, -0.012, 20);
    road.receiveShadow = true;
    s.add(road);
    for (let x = -60; x <= 60; x += 6) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.25), new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, -0.005, 20);
      s.add(line);
    }

    // Kapıdan kaldırıma toprak yollar
    this.addPath(DOOR_X, s);
    const path2 = this.addPath(20, this.room2);
    path2.visible = true;

    // Zeminler
    this.addFloor(ROOM1, s);
    this.addFloor(ROOM2, this.room2);

    // Arka duvar
    for (let x = ROOM1.minX + 2; x < ROOM1.maxX; x += 4) this.addWall('wall_window_closed', x, ROOM1.minZ, 0, s, `wb${x}`);
    for (let x = ROOM2.minX + 2; x < ROOM2.maxX; x += 4) this.addWall('wall', x, ROOM2.minZ, 0, this.room2, null);

    // Sol duvar
    for (let z = ROOM1.minZ + 2; z < ROOM1.maxZ; z += 4) this.addWall('wall', ROOM1.minX, z, Math.PI / 2, s, `wl${z}`);

    // Salonlar arası duvar (genişlemede ortadaki iki parça kalkar)
    for (let z = ROOM1.minZ + 2; z < ROOM1.maxZ; z += 4) {
      const opening = z === -10 || z === -6;
      const w = this.addWall('wall', ROOM1.maxX, z, Math.PI / 2, s, `wm${z}`);
      if (opening) this.dividerWalls.push({ mesh: w, id: `wm${z}` });
    }
    // İkinci salonun sağ duvarı (açılınca devreye girer)
    this.room2Walls = [];
    for (let z = ROOM2.minZ + 2; z < ROOM2.maxZ; z += 4) {
      this.addWall('wall', ROOM2.maxX, z, Math.PI / 2, this.room2, null);
      this.room2Walls.push({ id: `wr${z}`, box: wallBox(ROOM2.maxX, z, Math.PI / 2) });
    }
    // Salon 2 arka duvar kutuları
    for (let x = ROOM2.minX + 2; x < ROOM2.maxX; x += 4) {
      this.room2Walls.push({ id: `wb2_${x}`, box: wallBox(x, ROOM2.minZ, 0) });
    }

    // Ön duvar: alçak, kapı boşluklu
    for (let x = ROOM1.minX + 2; x < ROOM1.maxX; x += 4) {
      if (Math.abs(x - DOOR_X) < 2.1) continue;
      this.addWall('wall', x, ROOM1.maxZ, 0, s, `wf${x}`, WALL_H_SCALE_FRONT);
    }
    // Salon 1 açılmadan önce, salon 2'nin bulunduğu yer kapalı: sağdan dolaşılmasın
    nav.setBox('room2-block', { minX: ROOM2.minX, maxX: ROOM2.maxX + 1, minZ: ROOM2.minZ - 1, maxZ: ROOM2.maxZ + 0.3 });
    for (let x = ROOM2.minX + 2; x < ROOM2.maxX; x += 4) {
      if (Math.abs(x - 20) < 2.1) continue;
      this.addWall('wall', x, ROOM2.maxZ, 0, this.room2, null, WALL_H_SCALE_FRONT);
      this.room2Walls.push({ id: `wf2_${x}`, box: wallBox(x, ROOM2.maxZ, 0) });
    }

    // Dekor (salon 1)
    this.addDecor('fridge_A', -10.6, -15, 0, s, true);
    this.addDecor('fridge_B', 10.6, -15, 0, s, true);
    this.addDecor('shelf_papertowel_decorated', -11.6, -4, Math.PI / 2, s, false, 1.6);
    this.addDecor('cactus_medium_A', -11.2, 3.2, 0, s, true);
    this.addDecor('cactus_medium_A', 11, 3, 0, s, true);
    this.addDecor('rug_rectangle_stripes_A', DOOR_X, 2.4, 0, s, false);
    // Dekor (salon 2)
    this.addDecor('fridge_A', 26.6, -15, 0, this.room2, false);
    this.addDecor('cactus_medium_A', 27, 3, 0, this.room2, false);
    this.addDecor('rug_rectangle_stripes_A', 20, 2.4, 0, this.room2, false);

    // Ağaçlar ve çalılar
    const rng = mulberry(7);
    for (let i = 0; i < 46; i++) {
      const x = -50 + rng() * 100;
      const z = -40 + rng() * 52;
      if (x > -16 && x < 32 && z > -20 && z < 8) continue; // mağazanın etrafını boş bırak
      if (z > 12) continue;
      this.addTree(x, z, 0.8 + rng() * 0.7, rng);
    }
    for (let i = 0; i < 10; i++) {
      this.addTree(-16 - rng() * 3, -14 + i * 2.6, 0.55, rng, true);
    }
    // Mağazanın sağı, salon 2 açılana kadar ağaçlık
    this.room2Trees = new THREE.Group();
    s.add(this.room2Trees);
    for (let i = 0; i < 14; i++) {
      this.addTree(15 + rng() * 12, -14 + rng() * 16, 0.7 + rng() * 0.4, rng, false, this.room2Trees);
    }
  }

  addFloor(room, parent) {
    const w = room.maxX - room.minX;
    const d = room.maxZ - room.minZ;
    const tex = floorTexture();
    tex.repeat.set(w / 2, d / 2);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set((room.minX + room.maxX) / 2, 0, (room.minZ + room.maxZ) / 2);
    m.receiveShadow = true;
    parent.add(m);
  }

  addPath(x, parent) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 10.5),
      new THREE.MeshStandardMaterial({ color: 0xe0b07a, roughness: 1 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, -0.008, 9.2);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  addWall(name, x, z, rotY, parent, navId, yScale = 1) {
    const w = prop(name);
    w.position.set(x, 0, z);
    w.rotation.y = rotY;
    w.scale.y = yScale;
    parent.add(w);
    if (navId) this.game.nav.setBox(navId, wallBox(x, z, rotY));
    return w;
  }

  addDecor(name, x, z, rotY, parent, collide, yOffset = 0) {
    const d = prop(name);
    d.position.set(x, yOffset, z);
    d.rotation.y = rotY;
    parent.add(d);
    if (collide) {
      const box = new THREE.Box3().setFromObject(d);
      this.game.nav.setBox(`decor${x},${z}`, { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
    }
    return d;
  }

  addTree(x, z, scale, rng, bush = false, parent = this.scene) {
    const g = new THREE.Group();
    const leafColor = [0x4fa34a, 0x5bb352, 0x3f8f3f][Math.floor(rng() * 3)];
    const leaf = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.9, flatShading: true });
    if (!bush) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.3, 1.4, 6),
        new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 1 }),
      );
      trunk.position.y = 0.7;
      trunk.castShadow = true;
      g.add(trunk);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 0), leaf);
      top.position.y = 2.3;
      top.castShadow = true;
      g.add(top);
      const top2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), leaf);
      top2.position.set(0.5, 3.1, 0.2);
      top2.castShadow = true;
      g.add(top2);
    } else {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), leaf);
      b.position.y = 0.5;
      b.castShadow = true;
      g.add(b);
    }
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    g.rotation.y = rng() * Math.PI * 2;
    parent.add(g);
  }

  /** Mağaza genişlemesi: ikinci salonu göster, ara duvarı aç. */
  openRoom2() {
    this.room2.visible = true;
    this.room2Trees.visible = false;
    const nav = this.game.nav;
    nav.boxes.delete('room2-block');
    for (const w of this.dividerWalls) {
      w.mesh.visible = false;
      nav.boxes.delete(w.id);
    }
    for (const w of this.room2Walls) nav.boxes.set(w.id, w.box);
    nav.rebuild();
  }
}

let floorTex = null;
/** Açık renkli market karoları (2x2 birimlik tekrar eden doku). */
function floorTexture() {
  if (!floorTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const colors = ['#f4efe4', '#e9e2d3'];
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        ctx.fillStyle = colors[(x + y) % 2];
        ctx.fillRect(x * 128, y * 128, 128, 128);
      }
    ctx.strokeStyle = 'rgba(150,135,110,0.35)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 256; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    floorTex = new THREE.CanvasTexture(c);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.colorSpace = THREE.SRGBColorSpace;
    floorTex.anisotropy = 4;
  }
  return floorTex.clone();
}

export function wallBox(x, z, rotY) {
  const along = 2;
  const thick = 0.3;
  if (Math.abs(Math.sin(rotY)) > 0.5) return { minX: x - thick, maxX: x + thick, minZ: z - along, maxZ: z + along };
  return { minX: x - along, maxX: x + along, minZ: z - thick, maxZ: z + thick };
}

function mulberry(a) {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
