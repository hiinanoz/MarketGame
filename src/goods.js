import * as THREE from 'three';

// Salon 4 ve sonraki kampanya ürünleri: hazır model olmadığı için basit low-poly şekiller kodla çizilir.
// Ölçü: kasa içindeki bir ürün yaklaşık 0.6 × 0.6 tabana sığar (makeCrate 4'ünü yerleştirir).
// Geometri ve malzemeler paylaşılır (her kasada yeniden üretilmez).

const mats = new Map();
const mat = (color, rough = 0.7) => {
  const k = `${color}|${rough}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough }));
  return mats.get(k);
};
const geos = new Map();
const geo = (key, make) => {
  if (!geos.has(key)) geos.set(key, make());
  return geos.get(key);
};
const mesh = (g, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
};

const SHAPES = {
  // 🥛 süt kutusu: beyaz kutu, mavi bant, üçgen çatı
  carton() {
    const g = new THREE.Group();
    g.add(mesh(geo('cartonBody', () => new THREE.BoxGeometry(0.34, 0.5, 0.34)), mat(0xf7f7f2), 0, 0.25, 0));
    g.add(mesh(geo('cartonBand', () => new THREE.BoxGeometry(0.35, 0.14, 0.35)), mat(0x3d7fd6), 0, 0.3, 0));
    const roof = mesh(geo('cartonRoof', () => new THREE.CylinderGeometry(0.01, 0.25, 0.16, 4, 1)), mat(0xf7f7f2), 0, 0.58, 0);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    return g;
  },
  // 🥚 yumurta viyolü: karton taban + 6 yumurta
  eggs() {
    const g = new THREE.Group();
    g.add(mesh(geo('eggTray', () => new THREE.BoxGeometry(0.56, 0.1, 0.38)), mat(0xc9b28a, 0.95), 0, 0.05, 0));
    const egg = geo('egg', () => {
      const s = new THREE.SphereGeometry(0.08, 8, 6);
      s.scale(1, 1.3, 1);
      return s;
    });
    for (let i = 0; i < 6; i++) g.add(mesh(egg, mat(0xf3e6cf, 0.5), -0.18 + (i % 3) * 0.18, 0.17, i < 3 ? -0.09 : 0.09));
    return g;
  },
  // 🍎 elma: kırmızı küre + sap + yaprak
  apple() {
    const g = new THREE.Group();
    g.add(mesh(geo('apple', () => new THREE.SphereGeometry(0.2, 10, 8)), mat(0xd8342c, 0.45), 0, 0.2, 0));
    g.add(mesh(geo('stem', () => new THREE.CylinderGeometry(0.015, 0.015, 0.1, 5)), mat(0x5a3a1c), 0, 0.42, 0));
    const leaf = mesh(geo('leaf', () => new THREE.BoxGeometry(0.1, 0.02, 0.05)), mat(0x3f9a3a), 0.05, 0.43, 0);
    leaf.rotation.z = 0.5;
    g.add(leaf);
    return g;
  },
  // 🧃 meyve suyu şişesi: turuncu şişe, beyaz kapak, etiket
  bottle() {
    const g = new THREE.Group();
    g.add(mesh(geo('bottleBody', () => new THREE.CylinderGeometry(0.13, 0.14, 0.42, 10)), mat(0xf29a24, 0.35), 0, 0.21, 0));
    g.add(mesh(geo('bottleNeck', () => new THREE.CylinderGeometry(0.06, 0.12, 0.12, 10)), mat(0xf29a24, 0.35), 0, 0.48, 0));
    g.add(mesh(geo('bottleCap', () => new THREE.CylinderGeometry(0.065, 0.065, 0.06, 10)), mat(0xffffff), 0, 0.57, 0));
    g.add(mesh(geo('bottleLabel', () => new THREE.CylinderGeometry(0.142, 0.142, 0.14, 10)), mat(0x46a34a), 0, 0.22, 0));
    return g;
  },
  // 🍫 çikolata: kahverengi tablet, yarısı mor ambalajlı
  bar() {
    const g = new THREE.Group();
    g.add(mesh(geo('barChoco', () => new THREE.BoxGeometry(0.5, 0.07, 0.24)), mat(0x5b3418, 0.6), 0, 0.04, 0));
    g.add(mesh(geo('barWrap', () => new THREE.BoxGeometry(0.28, 0.08, 0.25)), mat(0x7b3cc2, 0.5), 0.12, 0.045, 0));
    g.add(mesh(geo('barChoco2', () => new THREE.BoxGeometry(0.5, 0.07, 0.24)), mat(0x5b3418, 0.6), 0, 0.12, 0));
    g.add(mesh(geo('barWrap', () => new THREE.BoxGeometry(0.28, 0.08, 0.25)), mat(0xd94b8a, 0.5), -0.12, 0.125, 0));
    return g;
  },
  // 🧴 deterjan bidonu: mavi gövde, kulp, kırmızı kapak
  jug() {
    const g = new THREE.Group();
    g.add(mesh(geo('jugBody', () => new THREE.BoxGeometry(0.34, 0.46, 0.24)), mat(0x2fa0d8, 0.4), 0, 0.23, 0));
    g.add(mesh(geo('jugHandle', () => new THREE.TorusGeometry(0.07, 0.025, 6, 10, Math.PI)), mat(0x2fa0d8, 0.4), 0.08, 0.46, 0));
    g.add(mesh(geo('jugCap', () => new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8)), mat(0xe03a2f), -0.1, 0.5, 0));
    g.add(mesh(geo('jugLabel', () => new THREE.BoxGeometry(0.35, 0.16, 0.245)), mat(0xffffff), 0, 0.22, 0));
    return g;
  },
  // 🍕 pizza: hamur disk, sos, peynir, pepperoni
  pizza() {
    const g = new THREE.Group();
    g.add(mesh(geo('pizzaBox', () => new THREE.BoxGeometry(0.56, 0.05, 0.56)), mat(0xd8b885, 0.95), 0, 0.025, 0));
    g.add(mesh(geo('pizzaDough', () => new THREE.CylinderGeometry(0.25, 0.25, 0.04, 14)), mat(0xe7b765), 0, 0.07, 0));
    g.add(mesh(geo('pizzaCheese', () => new THREE.CylinderGeometry(0.22, 0.22, 0.02, 14)), mat(0xffd34d, 0.5), 0, 0.095, 0));
    const pep = geo('pep', () => new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8));
    for (const [x, z] of [[0.1, 0.05], [-0.1, 0.08], [0, -0.12], [-0.08, -0.06], [0.12, -0.08]]) g.add(mesh(pep, mat(0xb4291f), x, 0.11, z));
    return g;
  },
  // 🍦 dondurma: külah + iki top
  icecream() {
    const g = new THREE.Group();
    const cone = mesh(geo('cone', () => new THREE.ConeGeometry(0.11, 0.32, 8)), mat(0xd9a05b, 0.8), 0, 0.16, 0);
    cone.rotation.x = Math.PI;
    g.add(cone);
    g.add(mesh(geo('scoop', () => new THREE.SphereGeometry(0.13, 10, 8)), mat(0xf6c5d8, 0.6), 0, 0.36, 0));
    g.add(mesh(geo('scoop', () => new THREE.SphereGeometry(0.13, 10, 8)), mat(0x7b4a2a, 0.6), 0, 0.5, 0));
    return g;
  },
  // 🎂 pasta: iki kat, krema, mum
  cake() {
    const g = new THREE.Group();
    g.add(mesh(geo('cake1', () => new THREE.CylinderGeometry(0.25, 0.25, 0.16, 14)), mat(0xf4d7b0), 0, 0.08, 0));
    g.add(mesh(geo('cakeCream', () => new THREE.CylinderGeometry(0.26, 0.26, 0.04, 14)), mat(0xf28db2, 0.5), 0, 0.17, 0));
    g.add(mesh(geo('cake2', () => new THREE.CylinderGeometry(0.17, 0.17, 0.12, 14)), mat(0xf4d7b0), 0, 0.25, 0));
    g.add(mesh(geo('candle', () => new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6)), mat(0x4aa3e0), 0, 0.36, 0));
    g.add(mesh(geo('flame', () => new THREE.SphereGeometry(0.025, 6, 4)), mat(0xffb300, 0.2), 0, 0.42, 0));
    return g;
  },
  // 🍣 suşi seti: tahta tabla, 4 parça
  sushi() {
    const g = new THREE.Group();
    g.add(mesh(geo('sushiBoard', () => new THREE.BoxGeometry(0.56, 0.06, 0.32)), mat(0x9c6b3c, 0.9), 0, 0.03, 0));
    const rice = geo('rice', () => new THREE.BoxGeometry(0.11, 0.07, 0.17));
    const fish = geo('fish', () => new THREE.BoxGeometry(0.12, 0.03, 0.19));
    for (let i = 0; i < 4; i++) {
      const x = -0.19 + i * 0.125;
      g.add(mesh(rice, mat(0xf5f3ec), x, 0.095, 0));
      g.add(mesh(fish, mat(i % 2 ? 0xf27a54 : 0xe2584b, 0.4), x, 0.145, 0));
    }
    return g;
  },
};

/** Kod ile çizilen ürün (yoksa null). */
export function makeGood(shape) {
  const f = SHAPES[shape];
  return f ? f() : null;
}
