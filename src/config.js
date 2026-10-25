// Oyun dengesi ve yerleşim — oynanışı ayarlamak için çoğu zaman sadece bu dosyayı değiştirmek yeterli.

// Ürünler: cost = toptancıdan alış fiyatı (kasa başına), price = müşteriye satış fiyatı.
export const PRODUCTS = {
  tomato:  { name: 'Domates', emoji: '🍅', crate: 'crate_tomatoes', cost: 2,  price: 6 },
  carrot:  { name: 'Havuç',   emoji: '🥕', crate: 'crate_carrots',  cost: 3,  price: 9 },
  cheese:  { name: 'Peynir',  emoji: '🧀', crate: 'crate_cheese',   cost: 5,  price: 14 },
  lettuce: { name: 'Marul',   emoji: '🥬', crate: 'crate_lettuce',  cost: 7,  price: 18 },
  onion:   { name: 'Soğan',   emoji: '🧅', crate: 'crate_onions',   cost: 9,  price: 23 },
  potato:  { name: 'Patates', emoji: '🥔', crate: 'crate_potatoes', cost: 11, price: 28 },
  bun:     { name: 'Ekmek',   emoji: '🍞', crate: 'crate_buns',     cost: 13, price: 33 },
  ham:     { name: 'But',     emoji: '🍖', crate: 'crate_ham',      cost: 16, price: 40 },
  steak:   { name: 'Biftek',  emoji: '🥩', crate: 'crate_steak',    cost: 20, price: 50 },
  // Özel ürünler: yalnızca kampanya günlerinde, kampanya standında satılır
  burger:  { name: 'Burger',      emoji: '🍔', crate: 'crate', item: 'food_burger', cost: 6, price: 18, special: true },
  jam:     { name: 'Reçel',       emoji: '🍯', crate: 'crate', item: 'jar_A_large', cost: 4, price: 13, special: true },
  sauce:   { name: 'Sos seti',    emoji: '🥫', crate: 'crate', item: 'ketchup',     cost: 3, price: 10, special: true },
  soup:    { name: 'Hazır çorba', emoji: '🍲', crate: 'crate', item: 'stew_bowl',   cost: 5, price: 15, special: true },
  vegburger: { name: 'Sebze burger', emoji: '🥗', crate: 'crate', item: 'food_vegetableburger', cost: 7, price: 20, special: true },
  dinner:  { name: 'Akşam menüsü', emoji: '🍽️', crate: 'crate', item: 'food_dinner',  cost: 9, price: 26, special: true },
  pickle:  { name: 'Turşu',       emoji: '🥒', crate: 'crate', item: 'jar_C_large', cost: 3, price: 11, special: true },
  olive:   { name: 'Zeytin',      emoji: '🫒', crate: 'crate', item: 'jar_D_large', cost: 4, price: 14, special: true },
  mustard: { name: 'Hardal',      emoji: '🌭', crate: 'crate', item: 'mustard',     cost: 2, price: 8,  special: true },
  pan:     { name: 'Tava seti',   emoji: '🍳', crate: 'crate', item: 'pan_A',       cost: 12, price: 34, special: true },
};
export const SPECIALS = Object.keys(PRODUCTS).filter((k) => PRODUCTS[k].special);

// ---- Seviyeler ----------------------------------------------------------------
// Ödeme yapıp çıkan her müşteri 1 XP. LEVELS[i] = (i+1). seviyeye ulaşmak için gereken toplam XP.
export const LEVELS = [0, 15, 40, 80, 130, 200, 280, 380, 500, 650, 800, 1000, 1250, 1500, 1800, 2200, 2600, 3000, 3500, 4000];
// Sv.21–100: her seviye %7,5 daha fazla XP (ayrıntı: docs/LEVELS.md)
for (let l = 21; l <= 100; l++) LEVELS.push(Math.round((4000 * 1.075 ** (l - 20)) / 50) * 50);
export const MAX_LEVEL = 100;
// Sv.20 sonrası XP kaynakları: market müşterisi 1 XP + diğer işletmelerin kârı + satın alımlar
export const XP_PER_PROFIT = 100;   // diğer işletmelerin günlük kârında her $100 = 1 XP
export const XP_PER_PURCHASE = 100; // işletme/arsa alımında her $100 = 1 XP

// ---- Memnuniyet ve temizlik --------------------------------------------------------
export const RATING = {
  start: 75,
  paid: 0.35,         // ödeyip memnun ayrılan müşteri
  angry: -6,          // ürün bulamayıp kızgın giden
  slowQueue: -2,      // kasada 25 sn'den uzun bekleyen
  cleaned: 0.5,       // leke temizlendi
  perDirtPerSec: 0.12, // izin verilenin üstündeki her leke için saniyede
};
export const DIRT = {
  fromLevel: 4,
  chancePerSec: 0.06, // içeride yürüyen müşteri başına saniyede leke olasılığı
  max: 18,
  tolerated: 2,
  cleanTime: 1.2,     // oyuncu için sn (temizlikçi biraz daha yavaş)
};

// ---- Reklam ve güvenlik -----------------------------------------------------------
export const ADS = { advertiser: 0.35, billboard: 0.25 }; // müşteri artışı
export const THEFT = {
  fromLevel: 10,
  chanceRush: 0.09,   // yoğun saatte (yoğunluk ≥ 1.2) gelen müşterinin hırsız olma olasılığı
  chanceNormal: 0.025,
  catchRadius: 4.2,   // güvenlik görevlisinin yakalama mesafesi
  playerRadius: 1.5,  // oyuncu hırsıza bu kadar yaklaşırsa yakalar
  escaped: -5,        // memnuniyet etkisi
  caught: 1,
};
export const GUARD_SPOTS = { door1: [3.4, 2.6], door2: [23.4, 2.6] };

// ---- Muhasebe odası, banka, kampanya --------------------------------------------------
export const OFFICE = { minX: 7.5, maxX: 12, minZ: -16, maxZ: -10.5, door: [8.4, -11.8] };
export const BANK = {
  loanRate: 0.04,       // günlük kredi faizi
  depositRate: 0.02,    // günlük mevduat faizi
  limitBase: 500,       // kredi limiti = limitBase + seviye × limitPerLevel
  limitPerLevel: 800,
  assetRatio: 0.5,      // + sahip olunan işletmelerin değerinin yarısı
  incomeDays: 3,        // + son 3 günün ortalama kazancının 3 katı
};
export const CAMPAIGN = {
  fromLevel: 4,
  feeBase: 200,         // hazırlık ücreti = feeBase + seviye × feePerLevel
  feePerLevel: 40,
  maxCampaigns: 3,      // aynı gün en fazla kampanya
  minStock: 20,
  maxStock: 1000,
  extraMin: 50,         // kampanya başına gelen ek müşteri
  extraMax: 500,
  extraShopping: 0.2,   // kampanya müşterilerinin başka ürün de alma olasılığı
  rushBoost: 1.4,       // genel yoğunluk artışı (her ek kampanya +0.15)
  doorQueue: 14,        // sabah kapıda bekleyen kişi (her ek kampanya +6)
  patience: 25,         // kampanya müşterisi stok beklerken sabır (sn)
  stands: [[-6, 7.6], [8, 7.6], [25.5, 7.6]],  // mağazanın önündeki kampanya standları
  palletOffset: [-4.6, 4.6, 4.3],             // stok paleti standın yanında
  maxActive: 70,        // aynı anda en fazla müşteri (performans)
};

// ---- Gün döngüsü ----------------------------------------------------------------
export const DAY = {
  length: 240,       // açık kalma süresi (sn) = 08:00 → 22:00
  openHour: 8,
  closeHour: 22,
  night: 25,         // gece molası (sn); "Sabahı bekleme" ile atlanabilir
};

// Saate göre müşteri yoğunluğu çarpanı (öğle ve akşam tepe).
export function rushFactor(hour) {
  if (hour < 10) return 0.55;
  if (hour < 12) return 0.85;
  if (hour < 14) return 1.35;
  if (hour < 17) return 0.9;
  if (hour < 20) return 1.45;
  return 0.6;
}

// ---- Mağaza yerleşimi ------------------------------------------------------------
// Salon 1: x -12..12, Salon 2: x 12..28, z -16 (arka duvar) .. 4 (ön duvar). Depo: z -28..-16.
export const ROOM1 = { minX: -12, maxX: 12, minZ: -16, maxZ: 4 };
export const ROOM2 = { minX: 12, maxX: 28, minZ: -16, maxZ: 4 };
export const DEPOT = { minX: -12, maxX: 12, minZ: -28, maxZ: -16 };
export const ROOM3 = { minX: -28, maxX: -12, minZ: -16, maxZ: 4 };   // sol salon (Sv.14)
export const YARD = { minX: -30, maxX: -12, minZ: -30, maxZ: -16 };   // üretimhane bahçesi
export const DOOR_X = 0;          // ön kapının ortası
export const DOOR2_X = 20;        // ikinci kapı (satın alınınca)
export const DOOR3_X = -20;       // üçüncü salonun kapısı
export const STREET_Z = 16;       // müşterilerin geldiği/gittiği yer

// Otopark (mağazanın sol önü). Her yer = bir arabalı müşteri. Yaya müşteri sayısı sınırlı.
export const PARKING = {
  minX: -31, maxX: -12.5, minZ: 4.8, maxZ: 12.8,
  rowA: 6.6, rowB: 11.0, aisle: 8.8, perRow: 6, spacing: 2.6, entryX: -14,
  extMinX: -47,          // 3. ve 4. aşamada otopark sola doğru büyür
  jamFromSlots: 12,      // bu kadar yerden sonra görevli yoksa girişte tıkanma olur
  jamChance: 0.35,
  jamTime: 5,
  jamRating: -1.5,
};
export const VALET_SPOT = [-12.9, 14.0];
export const WALK_IN_CAP = 12;   // aynı anda en fazla yaya müşteri
export const BACK_ROAD_Z = -32;   // toptancı kamyonlarının yolu

// Reyonlar: masa konumu. Müşteri masanın önünde (+z) durur, yükseltme alanı arkasında (−z).
export const SHELVES = [
  { id: 'tomato',  product: 'tomato',  pos: [-7, -6.5] },
  { id: 'carrot',  product: 'carrot',  pos: [-2, -6.5] },
  { id: 'cheese',  product: 'cheese',  pos: [3, -6.5] },
  { id: 'lettuce', product: 'lettuce', pos: [-7, -1.0] },
  { id: 'onion',   product: 'onion',   pos: [-2, -1.0] },
  { id: 'potato',  product: 'potato',  pos: [3, -1.0] },
  // Genişleme sonrası ikinci salon
  { id: 'bun',     product: 'bun',     pos: [15.5, -6.5] },
  { id: 'ham',     product: 'ham',     pos: [20, -6.5] },
  { id: 'steak',   product: 'steak',   pos: [15.5, -1.0] },
  // Üçüncü salon: çok satan ürünler için ikinci reyonlar
  { id: 'tomato2',  product: 'tomato',  pos: [-25.5, -6.5] },
  { id: 'cheese2',  product: 'cheese',  pos: [-21, -6.5] },
  { id: 'lettuce2', product: 'lettuce', pos: [-25.5, -1.0] },
  { id: 'bun2',     product: 'bun',     pos: [-21, -1.0] },
];

// Reyon kapasite aşamaları: 1. aşama küçük masa, sonra geniş masa.
export const SHELF_STAGES = [8, 16, 24];

// Depo paletleri (ürün başına bir palet). Oyuncu/işçi paletin önündeki alandan kasa alır.
export const PALLETS = {
  tomato:  [-9, -25.5], carrot: [-5, -25.5], cheese: [-1, -25.5], lettuce: [3, -25.5], onion: [7, -25.5],
  potato:  [-9, -20.5], bun:    [-5, -20.5], ham:    [-1, -20.5], steak:   [3, -20.5],
};
export const SPECIAL_PALLET = [8.5, -20.5]; // kampanya ürününün depo yeri
export const DEPOT_CAPACITY = [20, 40];  // palet başına kasa (depo yükseltmesiyle 40)
export const TRUCK_CAPACITY = 40;        // bir kamyonun taşıdığı kasa sayısı
export const START_DEPOT_STOCK = { tomato: 12 };

// Kasalar: müşteri kuyruğu +z yönünde uzar, kasiyer masanın arkasında (+x) durur.
export const CHECKOUTS = [
  { id: 'checkout1', pos: [8, -3], cashierSpot: [10.1, -4], queueStart: [6.0, -3], cashPile: [8, -0.6] },
  { id: 'checkout2', pos: [25, -4], cashierSpot: [27.0, -5], queueStart: [23.0, -4], cashPile: [25, -1.6] },
  { id: 'checkout3', pos: [-16, -4], cashierSpot: [-13.9, -5], queueStart: [-18.0, -4], cashPile: [-16, -0.6] },
];

// ---- Satın alınabilenler ------------------------------------------------------------
// level: zeminde belirmesi için gereken seviye. requires: önce açılması gerekenler.
// type: shelf | shelfStage | cashier | stocker | capacity | stockerCap | expansion | door | checkout | depot | cleaner | manager | parking | ads | security | wholesaler | room3 | producer | valet | accountant
export const UNLOCKS = [
  { id: 'shelf_carrot',  type: 'shelf',     target: 'carrot',    cost: 30,   level: 1, requires: [] },
  { id: 'cashier1',      type: 'cashier',   target: 'checkout1', cost: 60,   level: 2, requires: [] },
  { id: 'shelf_cheese',  type: 'shelf',     target: 'cheese',    cost: 120,  level: 2, requires: ['shelf_carrot'] },
  { id: 'stocker1',      type: 'stocker',   cost: 200,  pos: [-10.3, -7.4], level: 3, requires: [] },
  { id: 'capacity1',     type: 'capacity',  value: 7,  cost: 90,  pos: [-9, 2.0], level: 3, requires: [] },
  { id: 'shelf_lettuce', type: 'shelf',     target: 'lettuce',   cost: 260,  level: 4, requires: ['shelf_cheese'] },
  { id: 'cleaner1',      type: 'cleaner',   cost: 250,  pos: [-10.3, -3.9], level: 4, requires: [] },
  { id: 'shelf_onion',   type: 'shelf',     target: 'onion',     cost: 420,  level: 5, requires: ['shelf_lettuce'] },
  { id: 'stockerCap1',   type: 'stockerCap', value: 6,  cost: 300, pos: [-10.3, -10.6], level: 5, requires: ['stocker1'] },
  { id: 'capacity2',     type: 'capacity',  value: 10, cost: 350, pos: [-9, 2.0], level: 5, requires: ['capacity1'] },
  { id: 'depot2',        type: 'depot',     cost: 600,  pos: [10, -25.5], level: 6, requires: [] },
  { id: 'stocker2',      type: 'stocker',   cost: 500,  pos: [-10.3, -7.4], level: 6, requires: ['stocker1'] },
  { id: 'shelf_potato',  type: 'shelf',     target: 'potato',    cost: 650,  level: 7, requires: ['shelf_onion'] },
  { id: 'manager',       type: 'manager',   cost: 900,  pos: [10.4, 1.4], level: 7, requires: ['cashier1'] },
  { id: 'expansion',     type: 'expansion', cost: 1200, pos: [10.2, -7.6], level: 8, requires: [] },
  { id: 'door2',         type: 'door',      cost: 500,  pos: [DOOR2_X, 6.2], level: 8, requires: ['expansion'] },
  { id: 'stockerCap2',   type: 'stockerCap', value: 8, cost: 700, pos: [-10.3, -10.6], level: 8, requires: ['stockerCap1'] },
  { id: 'shelf_bun',     type: 'shelf',     target: 'bun',       cost: 900,  level: 9, requires: ['expansion'] },
  { id: 'checkout2',     type: 'checkout',  target: 'checkout2', cost: 800,  level: 9, requires: ['expansion'] },
  { id: 'cashier2',      type: 'cashier',   target: 'checkout2', cost: 600,  level: 9, requires: ['checkout2'] },
  { id: 'parking1',      type: 'parking',   value: 1, cost: 1500, pos: [-22, 8.8], level: 9, requires: [] },
  { id: 'cleaner2',      type: 'cleaner',   cost: 700,  pos: [-10.3, -3.9], level: 9, requires: ['cleaner1'] },
  { id: 'stocker3',      type: 'stocker',   cost: 1000, pos: [25.5, -9.5], level: 10, requires: ['stocker2', 'expansion'] },
  { id: 'advertiser',    type: 'ads',       target: 'advertiser', cost: 1500, pos: [13, 6.8], level: 10, requires: [] },
  { id: 'security1',     type: 'security',  target: 'door1', cost: 1200, pos: [3.4, 6.6], level: 10, requires: [] },
  { id: 'security2',     type: 'security',  target: 'door2', cost: 1200, pos: [22.4, 6.2], level: 10, requires: ['door2'] },
  { id: 'billboard',     type: 'ads',       target: 'billboard', cost: 3000, pos: [16.5, 9.4], level: 13, requires: ['advertiser'] },
  { id: 'wholesaler',    type: 'wholesaler', cost: 5000, pos: [10, -22.6], level: 12, requires: [] },
  { id: 'room3',         type: 'room3',     cost: 4500, pos: [-7, -13.4], level: 14, requires: ['expansion'] },
  { id: 'checkout3',     type: 'checkout',  target: 'checkout3', cost: 2500, level: 14, requires: ['room3'] },
  { id: 'cashier3',      type: 'cashier',   target: 'checkout3', cost: 1500, level: 14, requires: ['checkout3'] },
  { id: 'shelf_tomato2', type: 'shelf',     target: 'tomato2',   cost: 1800, level: 14, requires: ['room3'] },
  { id: 'shelf_cheese2', type: 'shelf',     target: 'cheese2',   cost: 2400, level: 15, requires: ['room3'] },
  { id: 'shelf_lettuce2', type: 'shelf',    target: 'lettuce2',  cost: 3000, level: 16, requires: ['room3', 'shelf_lettuce'] },
  { id: 'shelf_bun2',    type: 'shelf',     target: 'bun2',      cost: 3600, level: 17, requires: ['room3', 'shelf_bun'] },
  { id: 'greenhouse',    type: 'producer',  target: 'greenhouse', cost: 6000,  pos: [-17.5, -19.5], level: 18, requires: [] },
  { id: 'dairy',         type: 'producer',  target: 'dairy',      cost: 7000,  pos: [-25, -19.5],   level: 18, requires: ['shelf_cheese'] },
  { id: 'bakery',        type: 'producer',  target: 'bakery',     cost: 8000,  pos: [-17.5, -26],   level: 19, requires: ['shelf_bun'] },
  { id: 'butcher',       type: 'producer',  target: 'butcher',    cost: 10000, pos: [-25, -26],     level: 20, requires: ['shelf_ham'] },
  { id: 'cashier1b',     type: 'cashier',   target: 'checkout1', value: 2, cost: 900,  level: 6,  requires: ['cashier1'] },
  { id: 'cashier2b',     type: 'cashier',   target: 'checkout2', value: 2, cost: 1400, level: 11, requires: ['cashier2'] },
  { id: 'cashier3b',     type: 'cashier',   target: 'checkout3', value: 2, cost: 2000, level: 15, requires: ['cashier3'] },
  { id: 'accountant',    type: 'accountant', cost: 3000, pos: [6, -13.2], level: 21, requires: [] },
  { id: 'stocker4',      type: 'stocker',   cost: 1800, pos: [25.5, -9.5], level: 13, requires: ['stocker3'] },
  { id: 'stocker5',      type: 'stocker',   cost: 2600, pos: [-26, -12.4], level: 16, requires: ['stocker4', 'room3'] },
  { id: 'stocker6',      type: 'stocker',   cost: 3500, pos: [-26, -12.4], level: 19, requires: ['stocker5'] },
  { id: 'shelf_ham',     type: 'shelf',     target: 'ham',       cost: 1500, level: 11, requires: ['shelf_bun'] },
  { id: 'capacity3',     type: 'capacity',  value: 14, cost: 1500, pos: [26.3, 2.3], level: 11, requires: ['capacity2', 'expansion'] },
  { id: 'shelf_steak',   type: 'shelf',     target: 'steak',     cost: 2200, level: 12, requires: ['shelf_ham'] },
  { id: 'parking2',      type: 'parking',   value: 2, cost: 3500, pos: [-22, 8.8], level: 14, requires: ['parking1'] },
  { id: 'valet',         type: 'valet',     cost: 1500, pos: [-17, 14.6], level: 12, requires: ['parking1'] },
  { id: 'parking3',      type: 'parking',   value: 3, cost: 6000, pos: [-38, 8.8], level: 15, requires: ['parking2'] },
  { id: 'parking4',      type: 'parking',   value: 4, cost: 9000, pos: [-38, 8.8], level: 18, requires: ['parking3'] },
  { id: 'stockerCap3',   type: 'stockerCap', value: 10, cost: 1400, pos: [-10.3, -10.6], level: 12, requires: ['stockerCap2'] },
];

// Üretimhaneler: ürettikleri ürünler ve bir kasa üretme süresi (sn). Üretilen mal bedavadır.
export const PRODUCERS = {
  greenhouse: { name: 'Sera',   emoji: '🌱', products: ['tomato', 'lettuce', 'carrot', 'potato', 'onion'], interval: 3.5 },
  dairy:      { name: 'Mandıra', emoji: '🐄', products: ['cheese'], interval: 4 },
  bakery:     { name: 'Fırın',  emoji: '🥖', products: ['bun'], interval: 4 },
  butcher:    { name: 'Kasap',  emoji: '🔪', products: ['ham', 'steak'], interval: 5 },
};

// Toptancı satın alınınca alış fiyatları düşer. Tedarik krizleri Sv.16'dan itibaren.
export const WHOLESALER_DISCOUNT = 0.7;
export const CRISIS = { fromLevel: 16, chance: 0.4, priceMult: 1.8, shortageLimit: 10 };

// Reyon kapasite yükseltmeleri her reyon için otomatik eklenir (2. aşama Sv.2, 3. aşama Sv.5).
SHELVES.forEach((s, i) => {
  const shelfUnlock = i === 0 ? [] : [UNLOCKS.find((u) => u.type === 'shelf' && u.target === s.id).id];
  const mult = 1 + i * 0.6;
  UNLOCKS.push(
    { id: `stage2_${s.id}`, type: 'shelfStage', target: s.id, value: 1, cost: Math.round(80 * mult / 10) * 10, level: 2, requires: shelfUnlock },
    { id: `stage3_${s.id}`, type: 'shelfStage', target: s.id, value: 2, cost: Math.round(260 * mult / 10) * 10, level: 5, requires: [`stage2_${s.id}`] },
  );
});

// ---- Holding (Sv.21+) ----------------------------------------------------------------
// Tedarik vadisi: arka yolun kuzeyi. Her işletmenin bir arsa şeridi var; ön cephe yola bakar,
// modüller arkaya (−z) doğru eklenir. Başta başkalarına aittir, seviye gelince satın alınır.
export const VALLEY_FRONT_Z = -37;  // arsaların ön kenarı
export const MODULE_DEPTH = 10;     // her modülün derinliği
export const BUSINESSES = {
  farm: {
    name: 'Yeşil Vadi Çiftliği', emoji: '🌾', owner: 'Hüseyin Bey', kind: 'field',
    plot: { x: -15, w: 18 }, price: 12000, level: 22,
    products: ['tomato', 'carrot', 'lettuce', 'potato', 'onion'],
    modules: [{ level: 22 }, { level: 23, cost: 6000 }, { level: 28, cost: 12000 }, { level: 30, cost: 20000 }, { level: 48, cost: 40000 }],
    interval: 2.5, // tam kadroyla bir modülün bir kasa üretme süresi (sn)
  },
  dairy: {
    name: 'Ak Süt Mandırası', emoji: '🐄', owner: 'Ayşe Hanım', kind: 'barn',
    plot: { x: 5, w: 16 }, price: 18000, level: 24,
    products: ['cheese'],
    modules: [{ level: 24 }, { level: 26, cost: 9000 }, { level: 29, cost: 15000 }, { level: 30, cost: 24000 }, { level: 48, cost: 45000 }],
    interval: 3,
  },
  bakery: {
    name: 'Altın Başak Fırını', emoji: '🥖', owner: 'Mehmet Usta', kind: 'hall',
    plot: { x: 23, w: 14 }, price: 24000, level: 26,
    products: ['bun'],
    modules: [{ level: 26 }, { level: 27, cost: 12000 }, { level: 29, cost: 18000 }, { level: 30, cost: 28000 }, { level: 48, cost: 50000 }],
    interval: 3,
  },
  meat: {
    name: 'Kasaba Et Tesisi', emoji: '🥩', owner: 'Kemal Bey', kind: 'hall',
    plot: { x: -34, w: 14 }, price: 32000, level: 28,
    products: ['ham', 'steak'],
    modules: [{ level: 28 }, { level: 29, cost: 16000 }, { level: 30, cost: 24000 }, { level: 30, cost: 34000 }, { level: 48, cost: 60000 }],
    interval: 3.5,
  },
};
export const STAFF = {
  workersPerModule: 2,
  wage: { worker: 40, manager: 120, accountant: 100 }, // günlük maaş
  hire: { worker: 150, manager: 1200, accountant: 1000 }, // işe alım ücreti
  levels: { manager: 25, accountant: 25 },               // tedarikçilere müdür/muhasebeci
  noManagerRate: 0.4,  // müdür yok ve oyuncu da orada değilken üretim hızı
  storage: 60,         // işletme deposu (kasa)
  surplusPrice: 0.9,   // fazlanın satış fiyatı (alış fiyatına oranla)
};

// Harita bölgeleri (hızlı geçiş). level: açıldığı seviye.
export const REGIONS = [
  { id: 'market', name: 'Market', emoji: '🛒', pos: [0, 1], level: 1 },
  { id: 'depot', name: 'Arka depo', emoji: '📦', pos: [0, -18.5], level: 1 },
  { id: 'office', name: 'Muhasebe odası', emoji: '🧾', pos: [8.4, -10.6], level: 1 },
  { id: 'valley', name: 'Tedarik vadisi', emoji: '🌾', pos: [0, -36.2], level: 22 },
  { id: 'energy', name: 'Enerji tepeleri', emoji: '⚡', pos: [0, -110], level: 31, soon: true },
  { id: 'east', name: 'Doğu mahalleleri', emoji: '🏘️', pos: [60, 0], level: 36, soon: true },
  { id: 'center', name: 'Şehir merkezi', emoji: '🏛️', pos: [-80, 0], level: 51, soon: true },
  { id: 'port', name: 'Liman', emoji: '⚓', pos: [0, 40], level: 69, soon: true },
];

// Başlangıç: banka kuruluş kredisiyle market alınır (yeni oyunlarda)
export const START_LOAN = { amount: 1500, rate: 0.01 };

export const OVERTIME_PAY = [30, 60]; // gece ek mesaisinde çalışan başına ödeme aralığı

export const START_MONEY = 20;
export const START_CAPACITY = 4;      // oyuncunun aynı anda taşıyabildiği kasa sayısı
export const WORKER_CAPACITY = 4;

export const PLAYER_SPEED = 7.5;
export const WORKER_SPEED = 5;
export const CUSTOMER_SPEED = 3.6;
