import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
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
  loader.setMeshoptDecoder(MeshoptDecoder);

  const jobs = [
    ['props', propsUrl],
    ['anims', animsUrl],
    ...Object.entries(CHARACTER_URLS),
  ];
  let done = 0;
  await Promise.all(
    jobs.map(async ([name, url]) => {
      const gltf = await loader.loadAsync(url);
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
