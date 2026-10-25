import * as THREE from 'three';
import { prop } from './assets.js';
import { ROOM1, ROOM2, ROOM3, DEPOT, YARD, DOOR_X, DOOR2_X, DOOR3_X, BACK_ROAD_Z } from './config.js';

// Statik çevre: çimen, yol, mağaza zemini, duvarlar, dekor. Çarpışma kutularını nav'a kaydeder.

const LOW = 0.28; // alçak duvar: kamera içeriyi görebilsin

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.room2 = new THREE.Group();
    this.room2.visible = false;
    this.scene.add(this.room2);
    this.room3 = new THREE.Group();
    this.room3.visible = false;
    this.scene.add(this.room3);
    this.room3Walls = [];
    this.room3Openings = [];
    this.dividerWalls = []; // salonlar arasındaki, genişlemede kaldırılacak duvarlar
    this.build();
  }

  build() {
    const s = this.scene;
    const nav = this.game.nav;

    // Çimen
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x86c96b, roughness: 1 }),
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.02;
    grass.receiveShadow = true;
    s.add(grass);

    // Ön cadde + kaldırım, arkada toptancı yolu
    this.addStrip(0xd9cfb8, 3, 15.5, -0.01);
    this.addRoad(20, 6);
    this.addRoad(BACK_ROAD_Z, 5);

    // Kapıdan kaldırıma toprak yollar
    this.addPath(DOOR_X, s);
    this.door2Path = this.addPath(DOOR2_X, s);
    this.door2Path.visible = false;

    // Zeminler
    this.addFloor(ROOM1, s, ['#f4efe4', '#e9e2d3']);
    this.addFloor(ROOM2, this.room2, ['#f4efe4', '#e9e2d3']);
    this.addFloor(DEPOT, s, ['#c9ccd1', '#bfc3c9']);
    this.addFloor(ROOM3, this.room3, ['#eef3ea', '#e1e9dc']);
    // Üretimhane bahçesi (toprak zemin)
    const yard = new THREE.Mesh(
      new THREE.PlaneGeometry(YARD.maxX - YARD.minX, YARD.maxZ - YARD.minZ),
      new THREE.MeshStandardMaterial({ color: 0xc9a77a, roughness: 1 }),
    );
    yard.rotation.x = -Math.PI / 2;
    yard.position.set((YARD.minX + YARD.maxX) / 2, -0.009, (YARD.minZ + YARD.maxZ) / 2);
    yard.receiveShadow = true;
    s.add(yard);
    this.addPath(DOOR3_X, this.room3);

    // Mağaza ile depo arası: alçak duvar, ortada geçiş
    for (let x = ROOM1.minX + 2; x < ROOM1.maxX; x += 4) {
      if (Math.abs(x) < 2.1) continue;
      this.addWall('wall', x, ROOM1.minZ, 0, s, `wb${x}`, LOW);
    }
    for (let x = ROOM2.minX + 2; x < ROOM2.maxX; x += 4) this.addWall('wall_window_closed', x, ROOM2.minZ, 0, this.room2, null);

    // Depo duvarları: yanlar yüksek, arka alçak (kamyon görünsün)
    for (let z = DEPOT.minZ + 2; z < DEPOT.maxZ; z += 4) {
      if (z !== -22) this.addWall('wall', DEPOT.minX, z, Math.PI / 2, s, `dl${z}`); // ortada bahçeye geçiş
      this.addWall('wall', DEPOT.maxX, z, Math.PI / 2, s, `dr${z}`);
    }
    for (let x = DEPOT.minX + 2; x < DEPOT.maxX; x += 4) this.addWall('wall', x, DEPOT.minZ, 0, s, `db${x}`, LOW);

    // Sol duvar (3. salon açılınca ortadaki iki parça kalkar)
    for (let z = ROOM1.minZ + 2; z < ROOM1.maxZ; z += 4) {
      const w = this.addWall('wall', ROOM1.minX, z, Math.PI / 2, s, `wl${z}`);
      if (z === -10 || z === -6) this.room3Openings.push({ mesh: w, id: `wl${z}` });
    }
    // 3. salon duvarları (açılınca devreye girer)
    for (let z = ROOM3.minZ + 2; z < ROOM3.maxZ; z += 4) {
      this.addWall('wall', ROOM3.minX, z, Math.PI / 2, this.room3, null);
      this.room3Walls.push({ id: `w3l${z}`, box: wallBox(ROOM3.minX, z, Math.PI / 2) });
    }
    for (let x = ROOM3.minX + 2; x < ROOM3.maxX; x += 4) {
      this.addWall('wall_window_closed', x, ROOM3.minZ, 0, this.room3, null);
      this.room3Walls.push({ id: `w3b${x}`, box: wallBox(x, ROOM3.minZ, 0) });
      if (Math.abs(x - DOOR3_X) < 2.1) continue;
      this.addWall('wall', x, ROOM3.maxZ, 0, this.room3, null, LOW);
      this.room3Walls.push({ id: `w3f${x}`, box: wallBox(x, ROOM3.maxZ, 0) });
    }
    nav.setBox('room3-block', { minX: ROOM3.minX - 1, maxX: ROOM3.maxX - 0.3, minZ: ROOM3.minZ, maxZ: ROOM3.maxZ + 0.3 });

    // Salonlar arası duvar (genişlemede ortadaki iki parça kalkar)
    for (let z = ROOM1.minZ + 2; z < ROOM1.maxZ; z += 4) {
      const opening = z === -10 || z === -6;
      const w = this.addWall('wall', ROOM1.maxX, z, Math.PI / 2, s, `wm${z}`);
      if (opening) this.dividerWalls.push({ mesh: w, id: `wm${z}` });
    }
    // İkinci salonun sağ ve arka duvarı (açılınca devreye girer)
    this.room2Walls = [];
    for (let z = ROOM2.minZ + 2; z < ROOM2.maxZ; z += 4) {
      this.addWall('wall', ROOM2.maxX, z, Math.PI / 2, this.room2, null);
      this.room2Walls.push({ id: `wr${z}`, box: wallBox(ROOM2.maxX, z, Math.PI / 2) });
    }
    for (let x = ROOM2.minX + 2; x < ROOM2.maxX; x += 4) {
      this.room2Walls.push({ id: `wb2_${x}`, box: wallBox(x, ROOM2.minZ, 0) });
    }

    // Ön duvar: alçak, kapı boşluklu
    for (let x = ROOM1.minX + 2; x < ROOM1.maxX; x += 4) {
      if (Math.abs(x - DOOR_X) < 2.1) continue;
      this.addWall('wall', x, ROOM1.maxZ, 0, s, `wf${x}`, LOW);
    }
    // Salon 2 açılmadan önce o bölge kapalı: sağdan dolaşılmasın
    nav.setBox('room2-block', { minX: ROOM2.minX, maxX: ROOM2.maxX + 1, minZ: ROOM2.minZ - 1, maxZ: ROOM2.maxZ + 0.3 });
    // Salon 2 ön duvarı; kapı boşluğundaki iki parça ikinci kapı alınana kadar kapalı
    this.door2Walls = [];
    for (let x = ROOM2.minX + 2; x < ROOM2.maxX; x += 4) {
      const w = this.addWall('wall', x, ROOM2.maxZ, 0, this.room2, null, LOW);
      const id = `wf2_${x}`;
      this.room2Walls.push({ id, box: wallBox(x, ROOM2.maxZ, 0) });
      if (Math.abs(x - DOOR2_X) < 2.1) this.door2Walls.push({ mesh: w, id });
    }

    // Dekor (salon 1)
    this.addDecor('fridge_A', -10.6, -14.6, 0, s, true);
    this.addDecor('fridge_B', 10.6, -14.6, 0, s, true);
    this.addDecor('shelf_papertowel_decorated', -11.6, -13.2, Math.PI / 2, s, false, 1.6);
    this.addDecor('cactus_medium_A', -11.2, 3.2, 0, s, true);
    this.addDecor('cactus_medium_A', 11, 3, 0, s, true);
    this.addDecor('rug_rectangle_stripes_A', DOOR_X, 2.4, 0, s, false);
    // Dekor (salon 2)
    this.addDecor('fridge_A', 26.6, -14.6, 0, this.room2, false);
    this.addDecor('cactus_medium_A', 27, 3, 0, this.room2, false);
    this.door2Rug = this.addDecor('rug_rectangle_stripes_A', DOOR2_X, 2.4, 0, this.room2, false);
    this.door2Rug.visible = false;
    // Depo: boş kasa yığınları
    this.addDecor('crate', -10.6, -17.4, 0.3, s, true);
    this.addDecor('crate', 10.6, -17.2, -0.2, s, true);

    // Ağaçlar ve çalılar
    const rng = mulberry(7);
    for (let i = 0; i < 70; i++) {
      const x = -60 + rng() * 120;
      const z = -55 + rng() * 67;
      if (x > -17 && x < 32 && z > -30 && z < 8) continue; // mağaza ve depo
      if (x > -34 && x < -11 && z > -32 && z < 14) continue; // otopark, 3. salon, üretimhaneler
      if (z > 12 || (z > BACK_ROAD_Z - 4 && z < BACK_ROAD_Z + 4)) continue; // yollar
      this.addTree(x, z, 0.8 + rng() * 0.7, rng);
    }
    // 3. salonun yeri: açılana kadar çalılık ve ağaçlar
    this.room3Trees = new THREE.Group();
    s.add(this.room3Trees);
    for (let i = 0; i < 8; i++) this.addTree(-15.5 - rng() * 2, -15 + i * 2.6, 0.55, rng, true, this.room3Trees);
    for (let i = 0; i < 12; i++) this.addTree(-27 + rng() * 10, -14 + rng() * 16, 0.7 + rng() * 0.4, rng, false, this.room3Trees);
    // Mağazanın sağı, salon 2 açılana kadar ağaçlık
    this.room2Trees = new THREE.Group();
    s.add(this.room2Trees);
    for (let i = 0; i < 14; i++) {
      this.addTree(15 + rng() * 12, -14 + rng() * 16, 0.7 + rng() * 0.4, rng, false, this.room2Trees);
    }
  }

  /** Caddeye bakan reklam panosu. */
  addBillboard(x, z) {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 0.9 });
    for (const dx of [-1.8, 1.8]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.2, 0.25), wood);
      post.position.set(dx, 1.6, 0);
      post.castShadow = true;
      g.add(post);
    }
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, '#3fae4a');
    grad.addColorStop(1, '#2b8a35');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 72px "Trebuchet MS", sans-serif';
    ctx.fillText('MARKET', 256, 90);
    ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.fillText('Her gün taze! 🍅🥕🧀', 256, 180);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.3, 0.2), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex }), wood]);
    board.position.y = 3.6;
    board.castShadow = true;
    g.add(board);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.game.nav.setBox('billboard', { minX: x - 2, maxX: x + 2, minZ: z - 0.2, maxZ: z + 0.2 });
  }

  addStrip(color, depth, z, y) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(200, depth), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, y, z);
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  addRoad(z, depth) {
    this.addStrip(0x5b6470, depth, z, -0.012);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    const lineGeo = new THREE.PlaneGeometry(2.6, 0.25);
    for (let x = -90; x <= 90; x += 6) {
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, -0.005, z);
      this.scene.add(line);
    }
  }

  addFloor(room, parent, colors) {
    const w = room.maxX - room.minX;
    const d = room.maxZ - room.minZ;
    const tex = floorTexture(colors);
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
    for (const w of this.room2Walls) {
      if (this.door2Open && this.door2Walls.some((d) => d.id === w.id)) continue;
      nav.boxes.set(w.id, w.box);
    }
    nav.rebuild();
  }

  /** Üçüncü salon: sol tarafa genişleme, kendi kapısı ile. */
  openRoom3() {
    this.room3.visible = true;
    this.room3Trees.visible = false;
    const nav = this.game.nav;
    nav.boxes.delete('room3-block');
    for (const w of this.room3Openings) {
      w.mesh.visible = false;
      nav.boxes.delete(w.id);
    }
    for (const w of this.room3Walls) nav.boxes.set(w.id, w.box);
    nav.rebuild();
  }

  /** İkinci giriş kapısı: salon 2'nin ön duvarında boşluk aç. */
  openDoor2() {
    this.door2Open = true;
    this.door2Path.visible = true;
    this.door2Rug.visible = true;
    for (const d of this.door2Walls) {
      d.mesh.visible = false;
      this.game.nav.boxes.delete(d.id);
    }
    this.game.nav.rebuild();
  }
}

const floorTex = new Map();
/** Karo zemin dokusu (2x2 birimlik tekrar eden doku). */
function floorTexture(colors) {
  const key = colors.join();
  if (!floorTex.has(key)) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
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
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    floorTex.set(key, tex);
  }
  return floorTex.get(key).clone();
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
