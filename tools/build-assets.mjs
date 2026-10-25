// KayKit (CC0) paketlerinden oyunun kullandığı hafif GLB dosyalarını üretir.
//
// Kullanım:
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
//   node tools/build-assets.mjs <bu klasörlerin bulunduğu dizin>
//
// Çıktı: src/assets/characters/*.glb, src/assets/characters/anims.glb ve src/assets/props.glb

import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, mergeDocuments, unpartition, resample, quantize } from '@gltf-transform/functions';

// Animation.dispose() kanal ve örnekleyicileri geride bırakır; prune() verilerini temizlesin diye onları da sil.
function dropAnimation(anim) {
  for (const s of anim.listSamplers()) s.dispose();
  for (const c of anim.listChannels()) c.dispose();
  anim.dispose();
}

import path from 'node:path';
import fs from 'node:fs';

const SRC = path.resolve(process.argv[2] ?? '../assets-src');
const OUT = path.resolve('src/assets');
fs.mkdirSync(path.join(OUT, 'characters'), { recursive: true });

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// ---- Karakterler ----------------------------------------------------------
const CHAR_DIR = path.join(SRC, 'KayKit-Character-Pack-Adventures-1.0/addons/kaykit_character_pack_adventures/Characters/gltf');
const CHARACTERS = ['Barbarian', 'Knight', 'Mage', 'Rogue', 'Rogue_Hooded'];
const KEEP_ANIMS = new Set(['Idle', 'Walking_A', 'Running_A', 'Cheer', 'PickUp', 'Interact']);
// Silah, kalkan ve pelerinleri kaldır — markette dolaşan sıradan insanlar olsunlar.
const DROP_MESH = /(Sword|Shield|Axe|Mug|Spellbook|Wand|Staff|Knife|Crossbow|Throwable|Cape)/;

for (const name of CHARACTERS) {
  const doc = await io.read(path.join(CHAR_DIR, `${name}.glb`));
  const root = doc.getRoot();
  // Tüm KayKit karakterleri aynı iskeleti kullanır: animasyonları yalnızca ilk karakterden
  // ayrı bir dosyaya (anims.glb) yaz, diğer dosyalarda sadece model + iskelet kalsın.
  const isAnimSource = name === CHARACTERS[0];
  for (const anim of root.listAnimations()) {
    if (!isAnimSource || !KEEP_ANIMS.has(anim.getName())) dropAnimation(anim);
  }
  for (const node of root.listNodes()) {
    if (node.getMesh() && DROP_MESH.test(node.getName())) {
      node.getMesh().dispose();
      node.dispose();
    }
  }
  await doc.transform(resample({ tolerance: 1e-3 }), dedup(), prune(), quantize());
  if (isAnimSource) {
    const animOut = path.join(OUT, 'characters', 'anims.glb');
    await io.write(animOut, doc);
    console.log('animasyonlar', (fs.statSync(animOut).size / 1024).toFixed(0) + ' KB');
    for (const anim of root.listAnimations()) dropAnimation(anim);
    await doc.transform(prune());
  }
  const out = path.join(OUT, 'characters', `${name}.glb`);
  await io.write(out, doc);
  console.log('karakter', name, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}

// ---- Dekor / ürünler: tek dosyada, her model adıyla bir kök düğüm --------
const REST = path.join(SRC, 'KayKit-Restaurant-Bits-1.0/addons/kaykit_restaurant_bits/Assets/gltf');
const FURN = path.join(SRC, 'KayKit-Furniture-Bits-1.0/addons/kaykit_furniture_bits/Assets/gltf');
const PROPS = {
  [REST]: [
    'crate', 'crate_tomatoes', 'crate_carrots', 'crate_cheese', 'crate_lettuce', 'crate_onions',
    'crate_potatoes', 'crate_ham', 'crate_steak', 'crate_buns',
    'food_ingredient_tomato', 'food_ingredient_carrot', 'food_ingredient_cheese', 'food_ingredient_lettuce',
    'food_ingredient_onion', 'food_ingredient_potato', 'food_ingredient_ham', 'food_ingredient_steak',
    'food_ingredient_bun',
    'kitchentable_A', 'kitchentable_A_large', 'kitchentable_B', 'kitchentable_B_large',
    'kitchencounter_straight_A', 'kitchencounter_straight_B',
    'fridge_A', 'fridge_B', 'floor_kitchen', 'wall', 'wall_window_closed', 'wall_doorway',
    'jar_A_large', 'jar_B_large', 'ketchup', 'mustard', 'menu', 'papertowel', 'shelf_papertowel_decorated',
  ],
  [FURN]: [
    'shelf_A_big', 'shelf_B_large', 'shelf_B_large_decorated', 'cactus_medium_A', 'cactus_small_B',
    'lamp_standing', 'rug_rectangle_stripes_A', 'table_medium_long',
  ],
};

const merged = new Document();
for (const [dir, names] of Object.entries(PROPS)) {
  for (const name of names) {
    const doc = await io.read(path.join(dir, `${name}.gltf`));
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    // Tüm kök düğümleri modelin adını taşıyan tek bir kök altında topla.
    const wrapper = doc.createNode(name);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      wrapper.addChild(child);
    }
    scene.addChild(wrapper);
    mergeDocuments(merged, doc);
  }
}
// Birleştirme her dosya için ayrı sahne yaratır; hepsini ilk sahneye taşı.
const scenes = merged.getRoot().listScenes();
const main = scenes[0];
for (const s of scenes.slice(1)) {
  for (const child of s.listChildren()) main.addChild(child);
  s.dispose();
}
merged.getRoot().setDefaultScene(main);
await merged.transform(dedup(), unpartition(), prune(), quantize());
const propsOut = path.join(OUT, 'props.glb');
await io.write(propsOut, merged);
console.log('props.glb', (fs.statSync(propsOut).size / 1024).toFixed(0) + ' KB');
