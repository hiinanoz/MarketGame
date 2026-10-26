# Market Tycoon — geliştirici notları

- Three.js + Vite, saf JavaScript (ES modülleri), derleme adımı dışında framework yok.
- Kullanıcıyla Türkçe konuşulur; oyun içi metinler ve kod yorumları Türkçe.
- Oyun dengesi ve yerleşim `src/config.js` içinde; konum değiştirirken `UnlockPad`, raf alanı (1.75 yarıçap) ve depo alanlarının üst üste binmemesine dikkat et.
- Dünya: y yukarı, kamera güneyden (+z) bakar; ekranda yukarı = −z. Salon 1: x −12..12, salon 2: x 12..28, z −16..4.
- Modeller `src/assets/` altında; yeniden üretmek için KayKit repolarını klonlayıp `node tools/build-assets.mjs <klasör>` çalıştır. GLB'ler bilerek sıkıştırmasız: tek dosyalık sürüm WebAssembly'ye izin vermeyen sayfalarda da açılmalı (meshopt/draco kullanma).
- Test: `npm run dev`, tarayıcı konsolunda `window.game` erişilebilir (ör. `game.money = 5000`). `game.update(dt)` elle çağrılarak simülasyon hızlandırılabilir.
- `npm run build:single` çıktısı 5 MB'ın altında kalmalı (reklam ağları sınırı).
- Çalışanlar `look: 'uniform'` ile, müşteriler `look: 0..5` renk çeşidiyle oluşturulur (`assets.js` → `character()`); yeni işçi eklerken üniforma kullan.
- Oyun zamanıyla gecikmeli iş için `setTimeout` değil `game.later.push({ t, fn })` kullan (testlerde `game.update` ile hızlandırılan simülasyonda da çalışsın).
- Sv.21+ holding: `src/business.js` (tedarikçi işletmesi), `src/holding.js` (tablet + hızlı geçiş), `src/accountant.js` (market muhasebecisi). İşletme tanımları `config.js` → `BUSINESSES`, kadro → `STAFF`, bölgeler → `REGIONS`. Tasarım: `docs/LEVELS.md`, sıra: `docs/ROADMAP.md`.
- Maaşlar: `config.js` → `WAGES` (market rolleri), `STAFF.wage` (işletmeler). Çalışan nesnelerinde `role` ve `unlockId` var; `game.payroll()` gün sonunda öder, ödenemeyeni `game.fireWorker()` ile çıkarır (pad geri gelir). Yeni personel tipi eklerken `STAFF_ROLE`, `WAGES`, `ROLE_NAMES` ve `fireWorker` içindeki rol temizliğini güncelle.
- Banka: `bank.payInterest()` (gün sonu faiz, 3 gün → `seizeOne()`), işletmede `seize()/buyBack()`. Lojistik firması `BUSINESSES.logistics` (`kind: 'garage'`), etkileri `LOGISTICS` ve `holding.logisticsOwned`.
- Enerji: `src/energy.js` (gün sonu `settle()`), santraller `BUSINESSES.solar/wind` (`energy`, `frontZ: -100`, `staffLevels`, `workersPerModule`). İşletmeler `frontZ` ile farklı bölgelere konabilir. Market adı `game.marketName` / `game.marketTitle`, `world.setMarketTitle()`; işletme adı `business.customName`.
- Şapka renkleri: işçi `cap: 'yellow'`, müdür `'red'`, muhasebeci `'blue'`.
