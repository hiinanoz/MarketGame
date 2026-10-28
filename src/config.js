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
export const XP_PER_PROFIT = 100;   // diğer işletmelerin günlük kârında her Đ100 = 1 XP
export const XP_PER_PURCHASE = 100; // işletme/arsa alımında her Đ100 = 1 XP

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
export const ADS = { advertiser: 0.35, billboard: 0.25, roadboard: 0.05, roadboardBase: 600 }; // müşteri artışı
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
  missLimit: 3,         // faiz üst üste bu kadar gün ödenmezse banka bir işletmeye el koyar
  seizeRatio: 0.7,      // el konan işletmenin değerinin bu kadarı borçtan düşülür (geri alım fiyatı)
  limitPerLevel: 800,
  assetRatio: 0.5,      // + sahip olunan işletmelerin değerinin yarısı
  incomeDays: 3,        // + son 3 günün ortalama kazancının 3 katı
};
export const CAMPAIGN = {
  staffCost: 80,         // kampanya personeli (günlük): standda satış + ödeme, hızlı dolum
  staffMaxActive: 40,    // personelli her kampanya için mağazaya aynı anda girebilecek ek müşteri
  staffTake: 0.12,       // personelli standda kasa alma süresi (normal 0.35 sn)
  staffRefill: 0.25,     // personel paletten standa her bu kadar saniyede bir kasa koyar
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
  // Yol kenarı reklam panoları: her biri +%5 müşteri; kalan pano azaldıkça fiyat artar
  { id: 'roadboard0',    type: 'roadboard', target: 0, cost: 600, pos: [31, 12.2], level: 13, requires: ['billboard'] },
  { id: 'roadboard1',    type: 'roadboard', target: 1, cost: 600, pos: [-49.5, 12.2], level: 13, requires: ['billboard'] },
  { id: 'roadboard2',    type: 'roadboard', target: 2, cost: 600, pos: [56, 12.4], level: 13, requires: ['billboard'] },
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

// ---- Hedefler, ödüller, dekorasyon -------------------------------------------------------------
export const GOALS = {
  allQuestsGems: 5,
  // Giriş takvimi (gerçek gün): 7. gün büyük ödül
  login: [
    { money: 150, gems: 2 }, { money: 250, gems: 3 }, { money: 0, gems: 5 }, { money: 450, gems: 4 },
    { money: 0, gems: 8 }, { money: 800, gems: 6 }, { money: 1500, gems: 20 },
  ],
  // [müşteri sayısı, elmas]
  milestones: [[100, 5], [500, 10], [1000, 15], [2500, 20], [5000, 30], [10000, 40], [25000, 60], [50000, 80], [100000, 120]],
  partySeconds: 8,
  offlineMinMinutes: 3,
  offlineHours: 8,
  offlineMaxDays: 0.5, // çevrimdışı: oyun zamanı en fazla yarım gün ilerlemiş sayılır
};
export const DECOR = {
  floors: [
    { id: 'classic', name: 'Klasik', colors: ['#f4efe4', '#e9e2d3'], gems: 0 },
    { id: 'mint', name: 'Nane', colors: ['#e3f4ea', '#cfe9da'], gems: 10 },
    { id: 'sky', name: 'Gökyüzü', colors: ['#e6eefb', '#d2e0f5'], gems: 12 },
    { id: 'peach', name: 'Şeftali', colors: ['#fbe7da', '#f3d3bf'], gems: 15 },
    { id: 'checker', name: 'Dama', colors: ['#f5f5f5', '#4a4a4a'], gems: 25 },
    { id: 'wood', name: 'Ahşap', colors: ['#d9b48a', '#c79c6c'], gems: 30 },
  ],
  signs: [
    { id: 'green', name: 'Yeşil', color: '#2b8a35', gems: 0 },
    { id: 'blue', name: 'Mavi', color: '#2a62c9', gems: 6 },
    { id: 'red', name: 'Kırmızı', color: '#c9302a', gems: 6 },
    { id: 'purple', name: 'Mor', color: '#7a3cc2', gems: 8 },
    { id: 'gold', name: 'Altın', color: '#c99a12', gems: 15 },
    { id: 'black', name: 'Gece', color: '#1e1e28', gems: 12 },
  ],
  // Mağaza önüne konan süsler: her biri +%1 müşteri (en fazla +%10)
  items: [
    { id: 'plant', name: 'Saksı kaktüs', emoji: '🌵', model: 'cactus_medium_A', scale: 2.4, gems: 3 },
    { id: 'bush', name: 'Çalı', emoji: '🌳', model: 'bush', scale: 2.6, gems: 3 },
    { id: 'barrel', name: 'Çiçekli fıçı', emoji: '🛢️', model: 'barrel', scale: 2.4, gems: 4 },
    { id: 'bench', name: 'Bank', emoji: '🪑', model: 'bench', scale: 2.6, gems: 5 },
    { id: 'lamp', name: 'Sokak lambası', emoji: '💡', model: 'streetlight', scale: 2.2, gems: 6 },
    { id: 'tree', name: 'Ağaç', emoji: '🌲', model: 'trees_B_medium', scale: 1.4, gems: 8 },
  ],
  slots: [[-10.4, 5.1], [-3.6, 5.1], [3.6, 5.1], [10.4, 5.1], [-7, 5.1], [7, 5.1], [13.8, 5.1], [16.8, 5.1], [23.2, 5.1], [26.4, 5.1]],
  lights: { name: 'Işık zinciri', emoji: '✨', gems: 20 },
  bonusPerItem: 0.01,
  bonusMax: 0.1,
};

// ---- Online sipariş (Sv.25+) ------------------------------------------------------------------
// Salon 2'nin arkasındaki boş alan: müdür yardımcısının ofisi, toplayıcılar depodan ürün getirir,
// kuryeler arka kapıdan arabayla dağıtır. Personel arttıkça online ciro market cirosuna yaklaşır.
export const ONLINE = {
  level: 25,
  cost: 6000,
  area: { minX: 12, maxX: 28, minZ: -28, maxZ: -16 },
  desk: [14.5, -18.9],
  deputySpot: [14.5, -17.5],
  panel: [14.5, -21.2],          // müdür yardımcısının masası önü: online ayarları
  rack: [20.5, -24],
  pickerSpot: [18.9, -24],
  courierSpot: [22.1, -24],
  gateX: 26,                      // arka duvardaki kapı (kuryeler buradan çıkar)
  carZ: -30.1,
  carXs: [24.5, 19.5, 14.5, 29.5, 9.5],
  padSpots: [[18.2, -18.6], [21.2, -18.6], [24.2, -18.6]],
  rackCap: 60,
  away: 13,                       // kuryenin teslimatta geçirdiği süre (sn)
  fullStaff: 10,                  // bu kadar personelle online ciro ≈ market cirosu
  minStaff: 3,
  guards: [0.1, 0.25, 0.5],       // mağaza için palette bırakılan en az stok oranı
  extras: ['onlinePicker', 'onlineCourier', 'onlinePicker', 'onlineCourier', 'onlinePicker', 'onlineCourier', 'onlineCourier'],
};
UNLOCKS.push(
  { id: 'online', type: 'online', cost: ONLINE.cost, pos: [25.4, -13.4], level: ONLINE.level, requires: ['expansion'] },
  { id: 'onlineDeputy', type: 'onlineDeputy', cost: 400, pos: ONLINE.padSpots[0], level: ONLINE.level, requires: ['online'] },
  { id: 'onlinePicker1', type: 'onlinePicker', cost: 250, pos: ONLINE.padSpots[1], level: ONLINE.level, requires: ['online'] },
  { id: 'onlineCourier1', type: 'onlineCourier', cost: 300, pos: ONLINE.padSpots[2], level: ONLINE.level, requires: ['online'] },
);
// Sv.26'dan itibaren her seviyede bir yeni online personel alanı (sırayla açılır)
{
  const n = { onlinePicker: 1, onlineCourier: 1 };
  let prev = 'onlineCourier1';
  ONLINE.extras.forEach((type, i) => {
    n[type]++;
    const id = `${type}${n[type]}`;
    UNLOCKS.push({ id, type, cost: 0, pos: ONLINE.padSpots[i % 3], level: ONLINE.level + 1 + i, requires: [prev, 'onlineDeputy', 'onlinePicker1'] });
    prev = id;
  });
}

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
    moduleModel: { main: 'building_C_withoutBase', alt: 'building_C_withoutBase' },
    plot: { x: 23, w: 14 }, price: 8000, level: 26,
    lease: { weekly: 600, perModule: 250, buyLevel: 38, buyPrice: 30000 }, // kiralık: price = devir bedeli
    products: ['bun'],
    modules: [{ level: 26 }, { level: 27, cost: 12000 }, { level: 29, cost: 18000 }, { level: 30, cost: 28000 }, { level: 48, cost: 50000 }],
    interval: 3,
  },
  meat: {
    name: 'Kasaba Et Tesisi', emoji: '🥩', owner: 'Kemal Bey', kind: 'hall',
    moduleModel: { main: 'building_F_withoutBase', alt: 'building_F_withoutBase' },
    plot: { x: -34, w: 14 }, price: 10000, level: 28,
    lease: { weekly: 800, perModule: 300, buyLevel: 42, buyPrice: 40000 },
    products: ['ham', 'steak'],
    modules: [{ level: 28 }, { level: 29, cost: 16000 }, { level: 30, cost: 24000 }, { level: 30, cost: 34000 }, { level: 48, cost: 60000 }],
    interval: 3.5,
  },
  // ---- Enerji tepeleri (Sv.31+) ----
  solar: {
    name: 'Güneşli Tepe Güneş Tarlası', emoji: '☀️', owner: 'Elif Hanım', kind: 'solar', workerName: 'teknisyen',
    plot: { x: -12, w: 22 }, frontZ: -100, price: 45000, level: 31,
    products: [], energy: 'solar', energyPerModule: 200, workersPerModule: 1,
    staffLevels: { manager: 32, accountant: 35 },
    battery: { level: 34, cost: 18000 },
    modules: [{ level: 31 }, { level: 32, cost: 20000 }, { level: 33, cost: 28000 }, { level: 35, cost: 36000 }, { level: 48, cost: 60000 }],
  },
  wind: {
    name: 'Rüzgârlı Sırt Rüzgâr Santrali', emoji: '🌬️', owner: 'Kaptan Nuri', kind: 'wind', workerName: 'teknisyen',
    plot: { x: 18, w: 22 }, frontZ: -100, price: 20000, level: 33,
    lease: { weekly: 1500, perModule: 500, buyLevel: 46, buyPrice: 70000 },
    products: [], energy: 'wind', energyPerModule: 320, workersPerModule: 1,
    staffLevels: { manager: 32, accountant: 35 },
    modules: [{ level: 33 }, { level: 34, cost: 30000 }, { level: 35, cost: 40000 }, { level: 40, cost: 55000 }, { level: 46, cost: 80000 }],
  },
  // ---- Market şubeleri (Sv.50+): rakip marketi satın al ya da kiralık dükkân tut ----
  // Satın alınınca boş gelir: müdürü ve çalışanları sen atarsın.
  branch1: {
    name: 'Köşe Bakkal', emoji: '🏪', owner: 'Bakkal Cemil', kind: 'shop', workerName: 'çalışan',
    plot: { x: 43.5, w: 6 }, building: { model: 'kc-building-c', z: 7.5, scale: 6.4, labelY: 8.4 },
    price: 50000, level: 50, products: [], revenuePerModule: 900, workersPerModule: 3, startWorkers: 0,
    modules: [{ level: 50 }, { level: 52, cost: 25000 }, { level: 56, cost: 40000 }],
  },
  branch2: {
    name: 'Kiralık Dükkân', emoji: '🔑', owner: 'Emlak ofisi', kind: 'shop', workerName: 'çalışan',
    plot: { x: 50, w: 6 }, building: { model: 'kc-building-f', z: 7.5, scale: 6.4, labelY: 13 },
    price: 15000, level: 52, products: [], revenuePerModule: 1000, workersPerModule: 3, startWorkers: 0,
    lease: { weekly: 1500, perModule: 600, buyLevel: 60, buyPrice: 70000 },
    modules: [{ level: 52 }, { level: 54, cost: 25000 }, { level: 58, cost: 40000 }],
  },
  branch3: {
    name: 'Ucuz Market', emoji: '🛍️', owner: 'Ucuzcu A.Ş.', kind: 'shop', workerName: 'çalışan',
    plot: { x: 36.5, w: 6 }, building: { model: 'kc-building-c', z: 7.5, scale: 6.4, labelY: 8.4 },
    price: 110000, level: 56, products: [], revenuePerModule: 1400, workersPerModule: 3, startWorkers: 0,
    modules: [{ level: 56 }, { level: 58, cost: 45000 }, { level: 62, cost: 70000 }],
  },
  // ---- Medya (Sv.52): reklam harcaması düşer, ciro artar ----
  media: {
    name: 'Kasaba Gazetesi & Radyo', emoji: '📰', owner: 'Basın A.Ş.', kind: 'media', workerName: 'muhabir',
    plot: { x: -58, w: 6 }, building: { model: 'kc-building-skyscraper-a', z: 7.5, scale: 4.2, labelY: 14.5 },
    price: 80000, level: 52, products: [], revenuePerModule: 700, workersPerModule: 2,
    modules: [{ level: 52 }, { level: 55, cost: 30000 }, { level: 60, cost: 50000 }],
  },
  dam: {
    name: 'Akçay Barajı', emoji: '💧', owner: 'DSİ', kind: 'hydro', workerName: 'teknisyen',
    plot: { x: -42, w: 22 }, frontZ: -100, price: 90000, level: 41,
    products: [], energy: 'hydro', energyPerModule: 500, workersPerModule: 1,
    staffLevels: { manager: 41, accountant: 41 },
    modules: [{ level: 41 }, { level: 43, cost: 45000 }, { level: 46, cost: 60000 }, { level: 52, cost: 80000 }, { level: 60, cost: 110000 }],
  },
  // ---- Liman ve sanayi bölgesi (Sv.68+, ön caddenin güneyi) ----
  hotel: {
    name: 'Anadolu Otel', emoji: '🏨', owner: 'Anadolu Otelcilik', kind: 'hotel', workerName: 'personel',
    plot: { x: -34, w: 10 }, building: { model: 'building_H_withoutBase', z: 31, scale: 5, facing: -1, labelY: 17 },
    price: 120000, level: 68, products: [], revenuePerModule: 2500, workersPerModule: 3, startWorkers: 0,
    modules: [{ level: 68 }, { level: 70, cost: 60000 }, { level: 74, cost: 90000 }],
  },
  restaurant: {
    name: 'Lezzet Restoran Zinciri', emoji: '🍽️', owner: 'Lezzet A.Ş.', kind: 'restaurant', workerName: 'garson',
    plot: { x: -20, w: 10 }, building: { model: 'building_B_withoutBase', z: 31, scale: 5, facing: -1, labelY: 11 },
    price: 70000, level: 68, products: [], revenuePerModule: 1600, workersPerModule: 3, startWorkers: 0,
    modules: [{ level: 68 }, { level: 71, cost: 35000 }, { level: 75, cost: 55000 }],
  },
  port: {
    name: 'Kasaba Limanı', emoji: '⚓', owner: 'Liman İşletmesi', kind: 'port', workerName: 'liman işçisi',
    plot: { x: 26, w: 26 }, building: { procedural: 'port', z: 48, size: [26, 10], facing: -1, labelY: 9 },
    price: 200000, level: 69, products: [], revenuePerModule: 3000, workersPerModule: 4, startWorkers: 0,
    importDiscount: 0.08, // modül başı mal alımında indirim (ithalat)
    modules: [{ level: 69 }, { level: 72, cost: 100000 }, { level: 78, cost: 150000 }],
  },
  factory: {
    name: 'Sanayi Fabrikası', emoji: '🏭', owner: 'Sanayi Bölgesi', kind: 'factory', workerName: 'işçi',
    plot: { x: -30, w: 16 }, building: { procedural: 'factory', z: 46, size: [16, 9], facing: -1, labelY: 9 },
    price: 150000, level: 73, products: [], revenuePerModule: 3500, workersPerModule: 5, startWorkers: 0,
    modules: [{ level: 73 }, { level: 75, cost: 80000 }, { level: 79, cost: 120000 }],
  },
  mall: {
    name: 'Kasaba AVM', emoji: '🏬', owner: 'AVM Yatırım', kind: 'mall', workerName: 'çalışan',
    plot: { x: -2, w: 12 }, building: { model: 'building_E_withoutBase', z: 31, scale: 6, facing: -1, labelY: 16 },
    price: 300000, level: 75, products: [], revenuePerModule: 6000, workersPerModule: 6, startWorkers: 0, customers: 1.05,
    modules: [{ level: 75 }, { level: 78, cost: 150000 }, { level: 82, cost: 220000 }],
  },
  airport: {
    name: 'Kasaba Havalimanı', emoji: '✈️', owner: 'Ulaştırma Bakanlığı (ihale)', kind: 'airport', workerName: 'personel',
    plot: { x: -78, w: 26 }, building: { procedural: 'airport', z: 40, size: [26, 18], facing: -1, labelY: 9 },
    price: 500000, level: 76, products: [], revenuePerModule: 9000, workersPerModule: 8, startWorkers: 0, customers: 1.1,
    modules: [{ level: 76 }, { level: 80, cost: 250000 }, { level: 85, cost: 400000 }],
  },
  // Lojistik firması: tüm tedarikçiler alındıktan sonra satılığa çıkar, kamyon filosunu yönetir.
  logistics: {
    name: 'Hızlı Nakliyat', emoji: '🚛', owner: 'Rıza Bey', kind: 'garage', workerName: 'şoför',
    plot: { x: 38, w: 12 }, price: 40000, level: 29, requiresAll: ['farm', 'dairy', 'bakery', 'meat'],
    products: [],
    modules: [{ level: 29 }, { level: 30, cost: 15000 }, { level: 32, cost: 22000 }, { level: 35, cost: 30000 }, { level: 48, cost: 50000 }],
    trucksPerModule: 2,
  },
};
// Lojistik firması yokken tedarikçi sevkiyatları dış nakliyeyle (kasa başı ücret) gider.
// Firma alınınca: sevkiyat bedava, market siparişleri indirimli ve daha hızlı, boş kamyonlar
// başka firmalara taşıma yapıp gelir getirir, fazla ürün rakip marketlere daha iyi fiyata satılır.
export const LOGISTICS = {
  freightPerCrate: 1,     // dış nakliye ücreti (kasa başı)
  orderDiscount: 0.1,     // market siparişlerinde indirim
  speedPerModule: 0.15,   // modül başına kamyon hız artışı
  contractPerTruck: 220,  // tam kadroyla kamyon başı günlük taşıma geliri
  rivalPrice: 1.15,       // fazlanın rakip marketlere satış fiyatı (alış fiyatına oranla)
};
export const STAFF = {
  workersPerModule: 2,
  wage: { worker: 50, manager: 95 },  // günlük maaş (gün sonunda); müdür eski muhasebecinin işini de yapar
  hire: { worker: 50, manager: 200 }, // işe alım ücreti (ucuz)
  levels: { manager: 25 },               // tedarikçilere müdür
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
  { id: 'logistics', name: 'Lojistik', emoji: '🚛', pos: [38, -35.8], level: 29 },
  { id: 'energy', name: 'Enerji tepeleri', emoji: '⚡', pos: [3, -97], level: 31 },
  { id: 'east', name: 'Doğu mahallesi', emoji: '🏘️', pos: [78, 14], level: 36 },
  { id: 'branches', name: 'Rakip marketler', emoji: '🏪', pos: [43, 12.5], level: 50 },
  { id: 'center', name: 'Şehir merkezi', emoji: '🏛️', pos: [-66, 12.5], level: 51 },
  { id: 'port', name: 'Liman ve sanayi', emoji: '⚓', pos: [0, 26], level: 66 },
  { id: 'bazaar', name: 'Eski Çarşı', emoji: '🏛️', pos: [-86, -40], level: 81 },
  { id: 'coast', name: 'Sahil Şeridi', emoji: '🏖️', pos: [86, 28], level: 83 },
  { id: 'campus', name: 'Üniversite', emoji: '🎓', pos: [110, -6], level: 87 },
  { id: 'villages', name: 'Kuzey Köyleri', emoji: '🌄', pos: [55, -108], level: 89 },
];

// Başlangıç: banka kuruluş kredisiyle market alınır (yeni oyunlarda)
export const START_LOAN = { amount: 1500, rate: 0.01 };

export const OVERTIME_PAY = [30, 60]; // gece ek mesaisinde çalışan başına ödeme aralığı

export const START_MONEY = 20;
export const START_CAPACITY = 4;      // oyuncunun aynı anda taşıyabildiği kasa sayısı
export const WORKER_CAPACITY = 4;

// Market müdürü: bulunduğu bölümdeki (salon/depo) çalışanlar bu kadar hızlı çalışır
export const MANAGER = { boost: 1.22, stay: 7, cashMin: 15 };
/** Haritadaki bölüm: market salonları ve depo (müdür hız bonusu için). */
export function zoneOf(x, z) {
  if (z < -16) return x > 12 ? 'online' : 'depot';
  if (x > 12) return 'room2';
  if (x < -12) return 'room3';
  return 'room1';
}


export const PLAYER_SPEED = 7.5;
export const WORKER_SPEED = 5;
export const CUSTOMER_SPEED = 3.6;

// ---- Maaşlar ------------------------------------------------------------------------------
// İşe alım ucuzdur; her çalışana gün sonunda maaş ödenir. Ödenemeyen çalışan işten ayrılır,
// alanı yeniden belirir ve para kazanınca tekrar işe alınabilir.
export const ROLE_NAMES = {
  cashier: '💳 Kasiyer', stocker: '📦 Taşıyıcı', cleaner: '🧹 Temizlikçi', manager: '🟥 Müdür', accountant: '🟦 Muhasebeci',
  guard: '🛡️ Güvenlik', advertiser: '📣 Reklamcı', valet: '🅿️ Otopark görevlisi',
  deputy: '🧑‍💻 Müdür yardımcısı', picker: '🧺 Online toplayıcı', courier: '🛵 Kurye',
};
export const WAGES = {
  cashier: 50, stocker: 50, cleaner: 45, manager: 65, accountant: 70,
  guard: 50, advertiser: 50, valet: 50, worker: 50, deputy: 90, picker: 50, courier: 55,
};
export const HIRE_COST = {
  cashier: 60, stocker: 80, cleaner: 60, manager: 150, accountant: 150, valet: 100, security: 100, advertiser: 100,
  onlineDeputy: 400, onlinePicker: 250, onlineCourier: 300,
};
for (const u of UNLOCKS) {
  if (u.type in HIRE_COST) u.cost = HIRE_COST[u.type];
  if (u.type === 'ads' && u.target === 'advertiser') u.cost = HIRE_COST.advertiser;
}
/** Satın alma tipinden çalışan rolüne. */
export const STAFF_ROLE = {
  cashier: 'cashier', stocker: 'stocker', cleaner: 'cleaner', manager: 'manager', accountant: 'accountant',
  valet: 'valet', security: 'guard', ads: 'advertiser',
  onlineDeputy: 'deputy', onlinePicker: 'picker', onlineCourier: 'courier',
};
// ---- Elektrik (Sv.30+) -----------------------------------------------------------------------
// Günlük tüketim birim cinsinden (1 birim = şebeke fiyatıyla Đ1). Kendi santrallerin üretirse
// fatura düşer; fazla üretim, santralde müdür varsa şebekeye satılır.
export const ELECTRICITY = {
  fromLevel: 30,
  market: 60,        // market (1. salon + depo)
  perRoom: 40,       // açılan her ek salon
  perModule: 25,     // işletmelerin her modülü (lojistikte kamyon bakım/şarj)
  nightShare: 0.3,   // tüketimin gece payı: güneş bunu ancak bataryayla karşılar
  gridPrice: 0.8,    // şebekeye satış fiyatı (birim başı $)
  wind: [0.5, 1.4],  // günlük rüzgâr gücü aralığı
};

// ---- Kiralar (haftalık, her 7. günün sonunda) ----------------------------------------------
// Market Sv.20'ye kadar kiralıktır; Sv.20'den sonra muhasebe odasındaki banka sekmesinden alınır.
// Kira, market büyüdükçe artar.
export const RENT = {
  week: 7,
  market: { base: 120, room: 140, shelf: 8, parking: 40, depot: 40, buyLevel: 20, buyWeeks: 30 },
};

// ---- Konut (Sv.36+, doğu mahallesi) -------------------------------------------------------
export const HOUSING = {
  fromLevel: 36,
  plotPrice: 3000,
  plotSize: 10,
  plots: [[61, 4], [73, 4], [85, 4], [97, 4], [61, -10], [73, -10], [85, -10], [97, -10], [61, -24], [73, -24], [85, -24], [97, -24]],
  types: {
    house: { name: 'Müstakil ev', emoji: '🏠', level: 37, cost: 8000, days: 2, units: 1, rent: 2000, renovation: 800 },
    apartment: { name: 'Apartman (4 daire)', emoji: '🏢', level: 39, cost: 28000, days: 4, units: 4, rent: 1500, renovation: 600 },
    site: { name: 'Site (8 daire, havuzlu)', emoji: '🏘️', level: 42, cost: 65000, days: 6, units: 8, rent: 1800, renovation: 700 },
    villa: { name: 'Lüks villa', emoji: '🏡', level: 47, cost: 45000, days: 4, units: 1, rent: 9000, renovation: 3000 },
  },
  agent: { level: 37, hire: 200, commission: 0.1 },  // emlakçı: her binaya bir tane, kiradan %10
  tenancyDays: [14, 42],   // kiracının kalma süresi (gün)
  searchDays: [1, 2],      // elle ilana verince kiracı bulma süresi
  agentSearchDays: [0, 1], // emlakçıyla
  company: { level: 38, price: 25000, timeFactor: 0.6, costFactor: 0.85 }, // kendi inşaat şirketin
  accountant: { level: 44, hire: 150 }, // emlak muhasebecisi: emlakçısız binaları yönetir, kirayı her gün tahsil eder
  amenities: {
    school: { name: 'Okul', emoji: '🏫', level: 45, price: 40000, rentBoost: 0.1, pos: [67, -40] },
    clinic: { name: 'Sağlık ocağı', emoji: '🏥', level: 45, price: 35000, rentBoost: 0.1, pos: [91, -40] },
  },
  deed: { level: 50, rentBoost: 0.1, xp: 500 },
  zonedPlots: [[61, -54], [73, -54], [85, -54], [97, -54]], // başkanken imar izniyle açılır // tüm arsalar dolunca Doğu Mahallesi tapusu
};

// ---- Belediye ve reklam ---------------------------------------------------------------------
export const MUNICIPALITY = {
  minBusinesses: 4,   // işletme sayısı 3'ü geçince denetim başlar
  chance: 0.25,       // her sabah ceza olasılığı
  base: 150, perBusiness: 60,
  reasons: ['Ruhsat denetimi', 'Kaldırım işgali', 'Gürültü şikâyeti', 'Çevre denetimi', 'Tabela izni', 'Hijyen denetimi', 'İskân eksikliği'],
};
export const AD_TYPES = {
  flyer: { name: 'El ilanı', emoji: '📄', cost: 80, boost: 0.12, level: 2 },
  newspaper: { name: 'Gazete ilanı', emoji: '📰', cost: 200, boost: 0.25, level: 6 },
  radio: { name: 'Radyo reklamı', emoji: '📻', cost: 500, boost: 0.45, level: 12 },
  tv: { name: 'TV reklamı', emoji: '📺', cost: 1500, boost: 0.8, level: 25 },
};
// İndirim günü: ilan edilince ertesi gün fiyatlar %10 düşer, müşteri %30 artar
export const SALE_DAY = { price: 0.9, boost: 0.3, level: 2 };
// Kampanya ek promosyonu: 12:00'den sonra satılmayan kampanya ürününe %25 indirim
export const CAMPAIGN_PROMO = { fromHour: 12, price: 0.75, autoHour: 14 };
export const MEDIA = { adDiscount: 0.6, salesBoost: 1.15 }; // medya sende: reklam %60 ucuz, müşteri +%15

// ---- Siyaset (Sv.51+) ------------------------------------------------------------------------
// 1 oyun ayı = 2 gün, 1 yıl = 24 gün. Seçim 2 yılda bir; rakipler seçime 6 ay kala sahaya iner.
export const POLITICS = {
  fromLevel: 51,
  daysPerMonth: 2,
  termYears: 2,
  campaignMonths: 6,
  mainMin: 25,          // ana rakip her zaman en az %25
  minorMax: 8,          // diğer adaylar en fazla %8
  voteFactor: 0.8,      // popülerlik → oy oranı
  maxPopularity: 95,
  decay: 0.03,          // geçici nüfuz günlük azalma
  donationPerPoint: 900, // + seviye × 20: 1 nüfuz puanı için bağış
  donations: [2000, 10000, 50000],
  sponsorCost: 300, sponsorPoints: 0.8,   // günlük (+ seviye × 20)
  rallyCost: 1000, rallyPoints: 3,        // seçim döneminde günde bir (+ seviye × 60)
  amenityInfluence: 4,  // okul / sağlık ocağı
  jobs: { min: 100, base: 8, per: 25, max: 20 }, // 100+ çalışan: +8, her 25 çalışanda +1 (en fazla 20)
  buildings: {
    park: { name: 'Şehir parkı', emoji: '🌳', cost: 40000, influence: 8, pos: [-60, -6], size: [10, 8] },
    library: { name: 'Kütüphane', emoji: '📚', cost: 80000, influence: 12, pos: [-60, -18], size: [9, 6] },
    gym: { name: 'Spor salonu', emoji: '🏟️', cost: 150000, influence: 18, pos: [-76, -6], size: [11, 7] },
  },
  autocracyWins: 4,
  revoltYears: 2,       // otokraside memnuniyet bu kadar yıl %50 altında kalırsa seçim gelir
  winXp: 1000,
  taxMax: 30,
  taxBase: 15000,       // + seviye × 100 + arsa başı 300 → vergi oranıyla çarpılır (günlük)
  zoningCost: 20000,    // imar izni: doğu mahallesinde 4 yeni arsa
  projects: {
    bus: { name: 'Otogar', emoji: '🚌', cost: 80000, income: 1200, customers: 1.05, desc: '+günlük gelir, +%5 müşteri', pos: [-77, 8], size: [12, 8] },
    stadium: { name: 'Stadyum', emoji: '🏟️', cost: 150000, income: 2000, customers: 1.4, everyDays: 7, desc: 'haftada bir maç günü +%40 müşteri', pos: [-78, -20], size: [20, 14] },
  },
  names: ['Ahmet Kaya', 'Selin Demir', 'Murat Aksoy', 'Zeynep Yıldız', 'Kemal Şahin', 'Elif Arslan', 'Hasan Çelik', 'Ayşe Koç', 'Burak Öztürk'],
};

// ---- Finans (Sv.66–80) ----------------------------------------------------------------------
export const FINANCE = {
  fromLevel: 66,
  investLicense: { level: 66, price: 60000 },  // yatırım şirketi: hisse alım satımı
  // Borsadaki rakip şirketler. %51 ve üstü hisse = kontrol (etki açılır).
  companies: {
    ucuzcu: { name: 'Ucuzcu Market Zinciri', emoji: '🛍️', value: 400000, level: 66, effect: 'customers', amount: 1.1, effectText: 'rakip zincir senin: +%10 müşteri' },
    otel: { name: 'Anadolu Otelcilik', emoji: '🏨', value: 600000, level: 66, effect: 'dividend', amount: 2, effectText: 'temettü ×2' },
    tekstil: { name: 'Kasaba Tekstil', emoji: '🧵', value: 500000, level: 66, effect: 'dividend', amount: 2, effectText: 'temettü ×2' },
    enerji: { name: 'Kuzey Enerji A.Ş.', emoji: '⚡', value: 900000, level: 74, effect: 'electricity', amount: 0.5, effectText: 'elektrik faturası yarıya iner' },
    banka: { name: 'Şehir Bankası', emoji: '🏦', value: 1500000, level: 79, effect: 'interest', amount: 0.5, effectText: 'kredi faizin yarıya iner' },
  },
  control: 51,
  dividend: 0.004,        // günlük temettü (hisse değerinin)
  drift: 0.004, vol: 0.04, // günlük fiyat değişimi
  // Kendi bankan
  bank: {
    license: { level: 70, price: 250000 },
    rate: 0.01,             // sermayenin günlük faiz geliri (halka verilen krediler)
    branch: { level: 71, price: 50000, income: 1500, max: 4 },
    card: { level: 72, price: 80000, boost: 0.3 },
    insurance: { level: 72, price: 80000, boost: 0.2 },
    center: { level: 80, price: 500000 }, // finans merkezi: kendi kredilerin faizsiz, limit ×2
  },
  ipo: { level: 77, share: 0.2 },           // halka arz: şirket değerinin %20'si nakit
};

// ---- Şehri satın almak (Sv.81–100) ---------------------------------------------------------
// Her bölgede mülk sahipleri var. Teklif verirsin: "esnek" sahip 2–3 tekliften sonra %25'e kadar
// iner; "inatçı" sahip sordukça kızar, fiyatı artırır, asla indirmez. Şehirdeki her şey
// (bütün mülkler + bütün işletmeler) senin olunca Sv.100: "Kasabanın Hakimi".
export const CITY = {
  fromLevel: 81,
  // Esnek sahip: n. teklifte kabul ettiği en düşük oran (asıl fiyata göre)
  flexSteps: [0.95, 0.85, 0.75],
  angryRaise: 0.08,         // inatçı sahip: reddedilen her teklifte fiyat artışı
  offers: [0.75, 0.85, 0.95, 1],
  regions: [
    { id: 'bazaar', name: 'Eski Çarşı', emoji: '🏛️', level: 81, props: [
      { name: 'Bakırcılar Hanı', owner: 'Hacı Rıza', price: 400000, mood: 'flex', pos: [-92, -47], model: 'building_B_withoutBase' },
      { name: 'Kapalı Çarşı', owner: 'Esnaf Odası', price: 650000, mood: 'angry', pos: [-80, -47], model: 'building_E_withoutBase' },
      { name: 'Eski Kahvehane', owner: 'Nuri Usta', price: 250000, mood: 'flex', pos: [-92, -60], model: 'building-small-a' },
      { name: 'Saat Kulesi Meydanı', owner: 'Vakıf', price: 500000, mood: 'angry', pos: [-80, -60], model: 'building_H_withoutBase' },
    ] },
    { id: 'coast', name: 'Sahil Şeridi', emoji: '🏖️', level: 83, props: [
      { name: 'Martı Pansiyon', owner: 'Gül Hanım', price: 450000, mood: 'flex', pos: [66, 34], model: 'building-small-c', facing: -1 },
      { name: 'Deniz Kafe', owner: 'Kaptan Ali', price: 350000, mood: 'angry', pos: [78, 34], model: 'building_B_withoutBase', facing: -1 },
      { name: 'Yat Kulübü', owner: 'Sahil A.Ş.', price: 900000, mood: 'flex', pos: [92, 36], model: 'building_E_withoutBase', facing: -1 },
      { name: 'Balıkçı Barınağı', owner: 'Kooperatif', price: 300000, mood: 'flex', pos: [106, 34], model: 'building-small-a', facing: -1 },
    ] },
    { id: 'industry', name: 'Sanayi Bölgesi', emoji: '🏗️', level: 85, props: [
      { name: 'Çimento Fabrikası', owner: 'Demir Holding', price: 1200000, mood: 'angry', pos: [-56, 34], procedural: 'factory', facing: -1 },
      { name: 'Un Değirmeni', owner: 'Değirmenci Halil', price: 600000, mood: 'flex', pos: [-56, 47], model: 'building-garage', facing: -1 },
      { name: 'Oto Sanayi Sitesi', owner: 'Esnaf Birliği', price: 800000, mood: 'flex', pos: [-46, 47], model: 'building-garage', facing: -1 },
    ] },
    { id: 'campus', name: 'Üniversite Yerleşkesi', emoji: '🎓', level: 87, props: [
      { name: 'Rektörlük', owner: 'Mütevelli Heyeti', price: 1500000, mood: 'angry', pos: [118, -4], model: 'building_H_withoutBase' },
      { name: 'Fakülte Binası', owner: 'Vakıf Üniversitesi', price: 1100000, mood: 'flex', pos: [118, -18], model: 'building_E_withoutBase' },
      { name: 'Öğrenci Yurdu', owner: 'Yurt A.Ş.', price: 700000, mood: 'flex', pos: [118, 8], model: 'building_G_withoutBase' },
    ] },
    { id: 'villages', name: 'Kuzey Köyleri', emoji: '🌄', level: 89, props: [
      { name: 'Çamlıca Köyü', owner: 'Muhtar Osman', price: 500000, mood: 'flex', pos: [48, -116], model: 'building_windmill_green' },
      { name: 'Yayla Mandırası', owner: 'Yaylacı Fatma', price: 450000, mood: 'angry', pos: [62, -116], model: 'building_grain' },
      { name: 'Göl Kenarı Arazisi', owner: 'Orman İşletmesi', price: 800000, mood: 'flex', pos: [55, -132], model: 'trees_A_large' },
    ] },
    { id: 'hall', name: 'Belediye Meydanı', emoji: '🏙️', level: 95, props: [
      { name: 'Eski Belediye Sarayı', owner: 'Hazine', price: 3000000, mood: 'angry', pos: [-86, -74], model: 'building_G_withoutBase' },
    ] },
  ],
  grades: [[200, 'S'], [300, 'A'], [420, 'B'], [600, 'C'], [Infinity, 'D']], // oyun gününe göre
};

// ---- Yaşayan şehir (Sv.20+) ------------------------------------------------------------------
export const LIFE = {
  fromLevel: 20,
  base: 4,            // başlangıçta sokaktaki kasabalı sayısı (seviye ve evlerle artar)
  max: 16,
  spendBase: 6, spendPerLevel: 0.3, // senin dükkânına uğrayanın bıraktığı para
  growthPerDay: 2,    // her gün şehre eklenen süs (ağaç, bank, lamba, çiçeklik)
};

// ---- Market muhasebecisi: tecrübe ----
// Stajyer ucuzdur ama kampanya stoğunu geçmişe bakarak tahmin eder (sık hata yapar).
// Tecrübeli muhasebeci pazar araştırması yapar: kampanya talebini doğru bilir, personeli
// ancak maaşı karşılanabilirse alır, gün sonu ödemelerine göre yedek tutar.
export const ACCOUNTANT_TIERS = {
  junior: { name: 'Stajyer muhasebeci', emoji: '🧑‍💼', wage: 70 },
  expert: { name: 'Tecrübeli muhasebeci', emoji: '🎓', wage: 140, hire: 600 },
};
