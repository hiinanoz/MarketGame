// KayKit (CC0) paketlerinden oyunun kullandığı hafif GLB dosyalarını üretir.
//
// Kullanım:
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Restaurant-Bits-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-City-Builder-Bits-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Space-Base-Bits-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0
//   git clone --depth 1 https://github.com/KenneyNL/Starter-Kit-Racing
//   git clone --depth 1 https://github.com/KenneyNL/Starter-Kit-City-Builder
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
const CITY = path.join(SRC, 'KayKit-City-Builder-Bits-1.0/addons/kaykit_city_builder_bits/Assets/gltf');
const SPACE = path.join(SRC, 'KayKit-Space-Base-Bits-1.0/addons/kaykit_space_base_bits/Assets/gltf');
const MED = path.join(SRC, 'KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf');
const KENNEY_RACING = path.join(SRC, 'Starter-Kit-Racing/models');
const KENNEY_CITY = path.join(SRC, 'Starter-Kit-City-Builder/models');
const PROPS = {
  [REST]: [
    'crate', 'crate_lid', 'crate_tomatoes', 'crate_carrots', 'crate_cheese', 'crate_lettuce', 'crate_onions',
    'crate_potatoes', 'crate_ham', 'crate_steak', 'crate_buns',
    'kitchentable_B', 'kitchentable_B_large', 'kitchentable_A_large', 'kitchencounter_straight_B',
    'fridge_A', 'fridge_B', 'wall', 'wall_window_closed', 'wall_half',
    'jar_A_large', 'jar_B_large', 'jar_C_large', 'jar_D_large', 'ketchup', 'mustard', 'food_burger', 'stew_bowl',
    'food_vegetableburger', 'food_dinner', 'pan_A', 'shelf_papertowel_decorated',
  ],
  [FURN]: [
    'cactus_medium_A', 'rug_rectangle_stripes_A', 'rug_rectangle_A', 'table_medium', 'chair_A',
    'cabinet_medium_decorated', 'lamp_table', 'book_set', 'pictureframe_large_A', 'shelf_B_large_decorated',
  ],
  [CITY]: [
    'car_sedan', 'car_hatchback', 'car_stationwagon', 'car_taxi', 'car_police', 'streetlight', 'bench', 'bush',
    // Sv.66+ liman bölgesi: otel, restoran, AVM, banka genel merkezi
    'building_B_withoutBase', 'building_E_withoutBase', 'building_G_withoutBase', 'building_H_withoutBase',
  ],
  // Enerji (güneş, rüzgâr) ve lojistik konteynerleri — KayKit Space Base Bits (CC0)
  [SPACE]: ['solarpanel', 'windturbine_tall', 'windturbine_low'],
  // Çiftlik ve kasaba — KayKit Medieval Hexagon (CC0)
  [path.join(MED, 'buildings/green')]: ['building_windmill_green'],
  [path.join(MED, 'buildings/neutral')]: ['building_grain'],
  [path.join(MED, 'decoration/nature')]: ['trees_A_large', 'trees_B_medium'],
  [path.join(MED, 'decoration/props')]: ['sack', 'wheelbarrow', 'barrel'],
  // Kamyonlar ve kasaba binaları — Kenney Starter Kits (MIT)
  [KENNEY_RACING]: ['vehicle-truck-red', 'vehicle-truck-green'],
  [KENNEY_CITY]: ['building-garage', 'building-small-a', 'building-small-b', 'building-small-c'],
};

const merged = new Document();
for (const [dir, names] of Object.entries(PROPS)) {
  for (const name of names) {
    const file = fs.existsSync(path.join(dir, `${name}.gltf`)) ? `${name}.gltf` : `${name}.glb`;
    const doc = await io.read(path.join(dir, file));
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
