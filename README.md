# Market Tycoon

Township tarzı, joystick ile oynanan 3D market işletme oyunu. Tarayıcıda (telefon ve bilgisayar) çalışır; Three.js ile yazıldı.

**Oynanış:** Depodan (toptancı) ürün kasalarını al → reyonlara diz → müşteriler alışveriş yapıp kasaya gelsin → kasada ödemeyi al → paraları topla → parayla yeni reyonlar, kasiyer, taşıyıcı işçi, taşıma kapasitesi ve mağaza genişlemesi satın al.

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
| `src/config.js` | **Oyun dengesi**: ürün fiyatları, reyon/kasa konumları, açılabilirler ve fiyatları, hızlar |
| `src/game.js` | Ana oyun sınıfı: döngü, ekonomi, müşteri üretimi, kamera, rehber ok, kayıt |
| `src/stations.js` | Reyon (`Shelf`), depo (`SupplyPoint`), kasa (`Checkout`), para yığını, satın alma alanı (`UnlockPad`) |
| `src/actors.js` | Müşteri, kasiyer ve taşıyıcı işçi yapay zekâsı |
| `src/character.js` | Animasyonlu karakter + taşınan kasa yığını |
| `src/world.js` | Zemin, duvarlar, dekor, ağaçlar, mağaza genişlemesi |
| `src/nav.js` | Izgara tabanlı A* yol bulma ve çarpışma |
| `src/input.js`, `src/hud.js`, `src/audio.js`, `src/fx.js` | Joystick, arayüz, ses efektleri, uçuş animasyonları |
| `tools/build-assets.mjs` | KayKit paketlerinden hafif GLB dosyaları üretir |

Yeni ürün eklemek: `PRODUCTS`, `SHELVES` ve `UNLOCKS` listelerine birer satır eklemek yeterli (model adları için `tools/build-assets.mjs` içindeki `PROPS` listesine bakın).

## Modeller

Tüm 3D modeller [KayKit — Kay Lousberg](https://kaylousberg.com) paketlerinden (CC0, ticari kullanım serbest):
Character Pack: Adventurers, Restaurant Bits, Furniture Bits. `src/assets/` altındaki dosyalar `tools/build-assets.mjs` ile üretildi: kullanılmayan animasyonlar ve silahlar atıldı, tüm karakterler tek bir animasyon dosyasını paylaşıyor, meshopt ile sıkıştırıldı (18 MB → 1.4 MB).

## Yol haritası

- [x] Joystick/klavye kontrol, kasa taşıma, reyon doldurma
- [x] Müşteriler: reyon seçer, bekler, kuyruğa girer, öder (sabrı tükenirse kızıp gider)
- [x] Kasa: oyuncu ya da kasiyer ödeme alır, para yığını toplanır
- [x] Satın alınabilirler: 9 ürün, kasiyer, taşıyıcı işçiler, taşıma kapasitesi, ikinci salon, ikinci kasa
- [x] Kayıt (localStorage), ses efektleri, rehber ok ve ipuçları
- [ ] Ürün fiyatlarını/kâr marjını yükseltme (reyon seviyeleri)
- [ ] Müşterilerin birden fazla ürün istemesi (alışveriş listesi)
- [ ] Para toplayan "müdür" işçisi, işçi hız yükseltmeleri
- [ ] Günlük görevler / seviye sistemi
- [ ] Gerçek ses ve müzik, parçacık efektleri
- [ ] Mobil mağaza sürümü (Capacitor ile paketleme ya da Unity/Godot'a taşıma)
