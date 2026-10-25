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

/** İskeletli karakter kopyası + animasyon klipleri. */
export function character(name) {
  const tpl = characters.get(name);
  if (!tpl) throw new Error(`Karakter bulunamadı: ${name}`);
  return SkeletonUtils.clone(tpl);
}

export function animationClips() {
  return clips;
}

export const CHARACTER_NAMES = Object.keys(CHARACTER_URLS);
