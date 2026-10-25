# Market Tycoon

Township tarzı, joystick ile oynanan 3D market işletme oyunu. Tarayıcıda (telefon ve bilgisayar) çalışır; Three.js ile yazıldı.

**Oynanış:** Toptancıdan sipariş ver, kamyon arka depoya indirsin → depodan kasaları al → reyonlara diz → müşteriler alışveriş yapıp kasaya gelsin → kasada ödemeyi al → paraları topla → parayla yeni reyonlar, kasiyer, taşıyıcı işçi, taşıma kapasitesi ve mağaza genişlemesi satın al.

## Çalıştırma

```bash
npm install
npm run dev          # http://localhost:5173 (aynı ağdaki telefondan da açılır)
npm run build        # dist/  → normal web sitesi (GitHub Pages)
npm run build:single # dist-single/index.html → modeller dahil tek dosya (~2.5 MB)
```

Kontroller: ekrana dokunup sürükle (yüzen joystick) ya da WASD / ok tuşları. Satın almak için yeşil kutuların üzerinde dur; para kendiliğinden akar. İlerleme tarayıcıya kaydedilir (menü → *Oyunu sıfırla*).

## Proje yapısı

| Dosya | Ne yapar |
|---|---|
| `src/config.js` | **Oyun dengesi**: ürünler, seviyeler, gün süresi, reyon/kasa/depo konumları, açılabilirler ve fiyatları |
| `src/daycycle.js` | Gün/saat, yoğunluk, kapanış, gün özeti, ışık |
| `src/depot.js` | Arka depo, paletler, sipariş paneli, toptancı kamyonu |
| `src/upkeep.js` | Kir lekeleri ve memnuniyet puanı |
| `src/traffic.js` | Cadde trafiği ve otopark |
| `src/production.js` | Toptancı indirimi, tedarik krizleri, üretimhaneler |
| `src/game.js` | Ana oyun sınıfı: döngü, ekonomi, müşteri üretimi, kamera, rehber ok, kayıt |
| `src/stations.js` | Reyon (`Shelf`), depo (`SupplyPoint`), kasa (`Checkout`), para yığını, satın alma alanı (`UnlockPad`) |
| `src/actors.js` | Müşteri (ve hırsız), kasiyer, taşıyıcı, temizlikçi, müdür, güvenlik, reklamcı |
| `src/character.js` | Animasyonlu karakter + taşınan kasa yığını |
| `src/world.js` | Zemin, duvarlar, dekor, ağaçlar, mağaza genişlemesi |
| `src/nav.js` | Izgara tabanlı A* yol bulma ve çarpışma |
| `src/input.js`, `src/hud.js`, `src/audio.js`, `src/fx.js` | Joystick, arayüz, ses efektleri, uçuş animasyonları |
| `tools/build-assets.mjs` | KayKit paketlerinden hafif GLB dosyaları üretir |

Yeni ürün eklemek: `PRODUCTS`, `SHELVES` ve `UNLOCKS` listelerine birer satır eklemek yeterli (model adları için `tools/build-assets.mjs` içindeki `PROPS` listesine bakın).

## Modeller

Tüm 3D modeller [KayKit — Kay Lousberg](https://kaylousberg.com) paketlerinden (CC0, ticari kullanım serbest):
Character Pack: Adventurers, Restaurant Bits, Furniture Bits. `src/assets/` altındaki dosyalar `tools/build-assets.mjs` ile üretildi: kullanılmayan animasyonlar ve silahlar atıldı, tüm karakterler tek bir animasyon dosyasını paylaşıyor (18 MB → 1.9 MB).

## Yol haritası

Ayrıntılı seviye tablosu ve aşamalar: [docs/PLAN.md](docs/PLAN.md)

- [x] Joystick/klavye kontrol, kasa taşıma, reyon doldurma, müşteriler, kasa, para toplama
- [x] Seviye sistemi, gün/saat döngüsü (4 dk), saate göre yoğunluk, gün sonu özeti, gece molası
- [x] Arka depo, toptancı siparişi, kamyonla teslimat, otomatik sipariş
- [x] Reyon kapasitesi 8/16/24, taşıyıcı kapasitesi, 2. salon ve 2. giriş kapısı
- [x] Kirlenme + temizlikçi, müdür, memnuniyet puanı
- [x] Araç trafiği + otopark
- [x] Reklam görevlisi, hırsızlık + güvenlik
- [x] Toptancı satın alma, tedarik krizleri, üretimhaneler, 3. salon
- [ ] Sonraki fikirler: [docs/PLAN.md](docs/PLAN.md#sonraki-fikirler)
