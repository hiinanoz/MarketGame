import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import propsUrl from './assets/props.glb?url';
import animsUrl from './assets/characters/anims.glb?url';
import barbarianUrl from './assets/characters/Barbarian.glb?url';
import knightUrl from './assets/characters/Knight.glb?url';
import mageUrl from './assets/characters/Mage.glb?url';
import rogueUrl from './assets/characters/Rogue.glb?url';
import rogueHoodedUrl from './assets/characters/Rogue_Hooded.glb?url';

const CHARACTER_URLS = {
  Barbarian: barbarianUrl,
  Knight: knightUrl,
  Mage: mageUrl,
  Rogue: rogueUrl,
  Rogue_Hooded: rogueHoodedUrl,
};

const props = new Map();       // ad → Object3D şablonu
const characters = new Map();  // ad → gltf.scene şablonu
let clips = [];

export async function loadAssets(onProgress = () => {}) {
  const loader = new GLTFLoader();

  const jobs = [
    ['props', propsUrl],
    ['anims', animsUrl],
    ...Object.entries(CHARACTER_URLS),
  ];
  let done = 0;
  // GLTFLoader, createImageBitmap varsa dokuları blob: URL'ye fetch ile okur; katı içerik
  // güvenliği (CSP) olan sayfalarda bu engellenir. Yükleme süresince <img> yoluna zorla.
  const cib = window.createImageBitmap;
  window.createImageBitmap = undefined;
  try {
    await loadAll();
  } finally {
    window.createImageBitmap = cib;
  }

  async function loadAll() {
  await Promise.all(
    jobs.map(async ([name, url]) => {
      const gltf = await loadGltf(loader, url);
      if (name === 'props') {
        for (const child of [...gltf.scene.children]) {
          child.position.set(0, 0, 0);
          prepareMeshes(child);
          props.set(child.name, child);
        }
      } else if (name === 'anims') {
        clips = gltf.animations;
      } else {
        prepareMeshes(gltf.scene);
        characters.set(name, gltf.scene);
      }
      onProgress(++done / jobs.length);
    }),
  );
  }
}

/**
 * Tek dosyalık sürümde modeller data: URL olarak gömülüdür. Bazı ortamlar (ör. Claude
 * artifact sayfaları) data: URL'lere fetch isteğini engellediği için onları burada çözüyoruz.
 */
async function loadGltf(loader, url) {
  if (!url.startsWith('data:')) return loader.loadAsync(url);
  const base64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return loader.parseAsync(bytes.buffer, '');
}

function prepareMeshes(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/** Bir dekor/ürün modelinin kopyası (geometri ve malzemeler paylaşılır). */
export function prop(name) {
  const tpl = props.get(name);
  if (!tpl) throw new Error(`Model bulunamadı: ${name}`);
  return tpl.clone(true);
}

/**
 * İskeletli karakter kopyası.
 * @param {string} name model adı
 * @param {null|'uniform'|number} look null: orijinal, 'uniform': market üniforması, sayı: kıyafet renk çeşidi
 */
export function character(name, look = null) {
  const tpl = characters.get(name);
  if (!tpl) throw new Error(`Karakter bulunamadı: ${name}`);
  const model = SkeletonUtils.clone(tpl);
  // Çalışanlar şapka/miğfer yerine market şapkası takar; şövalye müşterilerin yarısı miğfersiz
  const isAvatar = look && typeof look === 'object';
  const hideHat = look === 'uniform' || (name === 'Knight' && typeof look === 'number' && look % 2 === 1) || (isAvatar && look.acc !== 'own');
  if (hideHat) model.traverse((o) => { if (o.isMesh && /Hat|Helmet/.test(o.name)) o.visible = false; });
  if (look !== null && look !== undefined) {
    model.traverse((o) => {
      if (o.isMesh && o.material?.map) o.material = variantMaterial(name, o.material, look);
    });
  }
  return model;
}

// ---- Kıyafet renkleri ------------------------------------------------------------------
// KayKit karakterleri küçük bir renk paleti dokusu kullanır. Ten rengini koruyup kıyafet
// renklerini döndürerek aynı modelden farklı görünümler üretiyoruz.

const variantCache = new Map();
export const CUSTOMER_LOOKS = 6;

// Oyuncu karakteri renkleri: [ton, doygunluk, parlaklık çarpanı] — swatch için css rengi ayrıca
export const HAIR_COLORS = [[0.07, 0.55, 1], [0.1, 0.25, 0.45], [0.12, 0.75, 1.6], [0.03, 0.75, 1.15], [0, 0, 1.9], [0.75, 0.55, 1.2], [0.55, 0.6, 1.2], [0.92, 0.55, 1.4]];
export const HAIR_CSS = ['#7a4a26', '#2b2522', '#e3b33c', '#b4442a', '#e8e8e8', '#8e4fc9', '#3a9ad9', '#e06aa8'];
export const OUTFIT_COLORS = [[0.36, 0.55, 1], [0.6, 0.6, 1], [0.0, 0.65, 1], [0.13, 0.85, 1.1], [0.8, 0.5, 1], [0.08, 0.8, 1], [0.48, 0.55, 1], [0, 0, 1.25]];
export const OUTFIT_CSS = ['#3faa55', '#3d6fd6', '#d9443a', '#f2c230', '#a25ad1', '#ef8a2a', '#2ab5a8', '#e9e9e9'];
export const PANTS_COLORS = [[0.6, 0.45, 1], [0, 0, 0.7], [0.08, 0.45, 1.1], [0.36, 0.4, 1], [0.0, 0.5, 1], [0.6, 0.15, 1.5]];
export const PANTS_CSS = ['#24345e', '#222', '#6b4a2e', '#2f5a35', '#6b2222', '#7d8796'];
export const AVATAR_MODELS = ['Barbarian', 'Knight', 'Mage', 'Rogue', 'Rogue_Hooded'];

function variantMaterial(name, base, look) {
  const key = `${name}|${base.uuid}|${typeof look === 'object' ? `${look.hair}-${look.outfit}-${look.pants}` : look}`;
  if (variantCache.has(key)) return variantCache.get(key);
  const img = base.map.image;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  const hsl = { h: 0, s: 0, l: 0 };
  const col = new THREE.Color();
  for (let i = 0; i < d.length; i += 4) {
    col.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    col.getHSL(hsl);
    const hueDeg = hsl.h * 360;
    const skin = hueDeg > 8 && hueDeg < 40 && hsl.s > 0.25 && hsl.l > 0.55;
    if (skin) continue;
    if (typeof look === 'object') {
      // Oyuncu karakteri: saç (kahverengi tonlar), kıyafet (açık tonlar), pantolon (koyu tonlar)
      if (hsl.s < 0.12 && (hsl.l > 0.85 || hsl.l < 0.15)) continue;
      const hairy = hueDeg > 5 && hueDeg < 50 && hsl.s > 0.2;
      if (hairy) {
        const h = HAIR_COLORS[look.hair] ?? HAIR_COLORS[0];
        col.setHSL(h[0], h[1], THREE.MathUtils.clamp(hsl.l * h[2], 0.06, 0.92));
      } else if (hsl.s < 0.12) continue;
      else if (hsl.l < 0.32) {
        const p = PANTS_COLORS[look.pants] ?? PANTS_COLORS[0];
        col.setHSL(p[0], p[1], Math.max(0.12, hsl.l * p[2]));
      } else {
        const o = OUTFIT_COLORS[look.outfit] ?? OUTFIT_COLORS[0];
        col.setHSL(o[0], o[1], THREE.MathUtils.clamp(hsl.l * o[2], 0.25, 0.85));
      }
    } else if (look === 'thief') {
      // Hırsız: baştan aşağı siyah (deri hariç), ayrıntılar hafifçe seçilsin
      col.setHSL(hsl.h, 0.06, THREE.MathUtils.clamp(hsl.l * 0.22, 0.03, 0.14));
    } else if (look === 'uniform') {
      if (hsl.s < 0.12 && (hsl.l > 0.85 || hsl.l < 0.15)) continue; // beyaz/siyah ayrıntılar
      if (hueDeg > 5 && hueDeg < 50 && hsl.s > 0.2) continue;        // saç ve deri tonları
      // Koyu tonlar lacivert pantolon, açık tonlar yeşil üniforma
      if (hsl.l < 0.32) col.setHSL(0.6, 0.45, Math.max(0.16, hsl.l));
      else col.setHSL(0.36, 0.55, THREE.MathUtils.clamp(hsl.l, 0.38, 0.62));
    } else {
      if (hsl.s < 0.12) continue; // gri/metal kısımlar aynı kalsın
      col.setHSL((hsl.h + look / CUSTOMER_LOOKS + 0.07) % 1, Math.min(1, hsl.s * 1.05), hsl.l);
    }
    d[i] = Math.round(col.r * 255);
    d[i + 1] = Math.round(col.g * 255);
    d[i + 2] = Math.round(col.b * 255);
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = base.map.flipY;
  tex.colorSpace = base.map.colorSpace;
  tex.magFilter = base.map.magFilter;
  tex.minFilter = base.map.minFilter;
  tex.wrapS = base.map.wrapS;
  tex.wrapT = base.map.wrapT;
  const mat = base.clone();
  mat.map = tex;
  variantCache.set(key, mat);
  return mat;
}

export function animationClips() {
  return clips;
}

export const CHARACTER_NAMES = Object.keys(CHARACTER_URLS);
