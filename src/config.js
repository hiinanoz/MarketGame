// Oyun dengesi ve yerleşim — oynanışı ayarlamak için çoğu zaman sadece bu dosyayı değiştirmek yeterli.

// Ürünler: cost = toptancıdan alış fiyatı (kasa başına), price = müşteriye satış fiyatı.
export const PRODUCTS = {
  tomato:  { name: 'Domates', emoji: '🍅', crate: 'crate_tomatoes', food: 'food_ingredient_tomato',  cost: 2,  price: 6 },
  carrot:  { name: 'Havuç',   emoji: '🥕', crate: 'crate_carrots',  food: 'food_ingredient_carrot',  cost: 3,  price: 9 },
  cheese:  { name: 'Peynir',  emoji: '🧀', crate: 'crate_cheese',   food: 'food_ingredient_cheese',  cost: 5,  price: 14 },
  lettuce: { name: 'Marul',   emoji: '🥬', crate: 'crate_lettuce',  food: 'food_ingredient_lettuce', cost: 7,  price: 18 },
  onion:   { name: 'Soğan',   emoji: '🧅', crate: 'crate_onions',   food: 'food_ingredient_onion',   cost: 9,  price: 23 },
  potato:  { name: 'Patates', emoji: '🥔', crate: 'crate_potatoes', food: 'food_ingredient_potato',  cost: 11, price: 28 },
  bun:     { name: 'Ekmek',   emoji: '🍞', crate: 'crate_buns',     food: 'food_ingredient_bun',     cost: 13, price: 33 },
  ham:     { name: 'But',     emoji: '🍖', crate: 'crate_ham',      food: 'food_ingredient_ham',     cost: 16, price: 40 },
  steak:   { name: 'Biftek',  emoji: '🥩', crate: 'crate_steak',    food: 'food_ingredient_steak',   cost: 20, price: 50 },
};

// Her reyon bir masa: ürün, masa konumu ve depodaki tedarik noktası.
// Reyon masası 2x2 birim; müşteri masanın önünde (+z) durur.
export const SHELVES = [
  { id: 'tomato',  product: 'tomato',  pos: [-7, -6.5], supply: [-9.5, -12.8] },
  { id: 'carrot',  product: 'carrot',  pos: [-2, -6.5], supply: [-6.0, -12.8] },
  { id: 'cheese',  product: 'cheese',  pos: [3, -6.5],  supply: [-2.5, -12.8] },
  { id: 'lettuce', product: 'lettuce', pos: [-7, -1.0], supply: [1.0, -12.8] },
  { id: 'onion',   product: 'onion',   pos: [-2, -1.0], supply: [4.5, -12.8] },
  { id: 'potato',  product: 'potato',  pos: [3, -1.0],  supply: [8.0, -12.8] },
  // Genişleme sonrası ikinci salon
  { id: 'bun',     product: 'bun',     pos: [15.5, -6.5], supply: [15, -12.8] },
  { id: 'ham',     product: 'ham',     pos: [19.5, -6.5], supply: [18.5, -12.8] },
  { id: 'steak',   product: 'steak',   pos: [15.5, -1.0], supply: [22, -12.8] },
];

export const SHELF_CAPACITY = 8; // masada en fazla kaç kasa durur (2x2, iki kat)

// Kasalar: müşteri kuyruğu +z yönünde uzar, kasiyer masanın arkasında (+x) durur.
export const CHECKOUTS = [
  { id: 'checkout1', pos: [8, -3], cashierSpot: [10.1, -4], queueStart: [6.0, -3], cashPile: [8, -0.6] },
  { id: 'checkout2', pos: [25, -4], cashierSpot: [27.0, -5], queueStart: [23.0, -4], cashPile: [25, -1.6] },
];

// Satın alınabilen her şey. `requires` listesindekiler açılmadan zemin üzerinde görünmez.
// type: shelf | cashier | stocker | capacity | expansion | checkout
export const UNLOCKS = [
  { id: 'shelf_carrot',  type: 'shelf',    target: 'carrot',  cost: 30,   requires: [] },
  { id: 'cashier1',      type: 'cashier',  target: 'checkout1', cost: 60, requires: ['shelf_carrot'] },
  { id: 'shelf_cheese',  type: 'shelf',    target: 'cheese',  cost: 120,  requires: ['shelf_carrot'] },
  { id: 'capacity1',     type: 'capacity', value: 7,  cost: 90,  pos: [-9, 2.0], requires: ['shelf_cheese'] },
  { id: 'stocker1',      type: 'stocker',  cost: 200, pos: [-10.3, -7.4], requires: ['shelf_cheese'] },
  { id: 'shelf_lettuce', type: 'shelf',    target: 'lettuce', cost: 260,  requires: ['cashier1', 'shelf_cheese'] },
  { id: 'shelf_onion',   type: 'shelf',    target: 'onion',   cost: 420,  requires: ['shelf_lettuce'] },
  { id: 'capacity2',     type: 'capacity', value: 10, cost: 350, pos: [-9, 2.0], requires: ['capacity1', 'shelf_onion'] },
  { id: 'stocker2',      type: 'stocker',  cost: 500, pos: [-10.3, -7.4], requires: ['stocker1', 'shelf_onion'] },
  { id: 'shelf_potato',  type: 'shelf',    target: 'potato',  cost: 650,  requires: ['shelf_onion'] },
  { id: 'expansion',     type: 'expansion', cost: 1200, pos: [10.2, -7.6], requires: ['shelf_potato'] },
  { id: 'shelf_bun',     type: 'shelf',    target: 'bun',     cost: 900,  requires: ['expansion'] },
  { id: 'checkout2',     type: 'checkout', target: 'checkout2', cost: 800, requires: ['expansion'] },
  { id: 'cashier2',      type: 'cashier',  target: 'checkout2', cost: 600, requires: ['checkout2'] },
  { id: 'shelf_ham',     type: 'shelf',    target: 'ham',     cost: 1500, requires: ['shelf_bun'] },
  { id: 'stocker3',      type: 'stocker',  cost: 1000, pos: [25.5, -9.5], requires: ['shelf_bun', 'stocker2'] },
  { id: 'shelf_steak',   type: 'shelf',    target: 'steak',   cost: 2200, requires: ['shelf_ham'] },
  { id: 'capacity3',     type: 'capacity', value: 14, cost: 1500, pos: [26.3, 2.3], requires: ['capacity2', 'shelf_ham'] },
];

export const START_MONEY = 20;
export const START_CAPACITY = 4;      // oyuncunun aynı anda taşıyabildiği kasa sayısı
export const WORKER_CAPACITY = 4;

export const PLAYER_SPEED = 7.5;
export const WORKER_SPEED = 5;
export const CUSTOMER_SPEED = 3.6;

// Mağaza alanı (dünya birimleri). Salon 1: x -12..12, Salon 2: x 12..28. z -16 (arka duvar) .. 4 (ön duvar)
export const ROOM1 = { minX: -12, maxX: 12, minZ: -16, maxZ: 4 };
export const ROOM2 = { minX: 12, maxX: 28, minZ: -16, maxZ: 4 };
export const DOOR_X = 0;          // ön duvardaki kapının ortası
export const STREET_Z = 16;       // müşterilerin geldiği/gittiği yer
