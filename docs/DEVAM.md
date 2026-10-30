# Devam notu (Claude Code için) — 30 Ekim 2026

Bu dosya, Claude uygulamasındaki uzun geliştirme sohbetinin kaldığı yeri özetler.
Genel kurallar ve sistemler için önce `CLAUDE.md`, App Store adımları için `apple/TESTFLIGHT.md` ve `docs/APPLE.md`.

## Durum

- Oyun oynanabilir durumda; web sürümü tek dosya (`npm run build:single` → `dist-single/index.html`, ~6,5 MB; hedef ~5 MB).
- iOS: Capacitor 8 projesi `apple/` altında. GitHub Actions `iOS` iş akışı her push'ta simülatör derlemesi yapıyor (başarılı).
- App Store Connect kaydı açıldı (30 Ekim): Bundle ID **com.othinks.cornershopempire**, SKU `cornershopempire`,
  Apple ID 6828744803, ana dil English (U.S.). iOS, macOS, tvOS platformları eklendi.
  - Adlar: EN "Corner Shop Empire", TR "Market Krallığı" (TR yerelleştirmesi App Store Connect'te eklenecek).
  - macOS: iPad sürümü Apple Silicon Mac'lerde çalışabilir; ayrı Mac derlemesi şimdilik yok.
  - tvOS: WKWebView olmadığı için web oyunu çalışmaz; ayrı yerel sürüm gerekir (bkz. `docs/APPLE.md`).
- Kullanıcı GitHub gizli değişkenlerini ekliyor: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` (.p8 içeriği), `APPLE_TEAM_ID`.
  .p8 anahtarı asla depoya yazılmaz ve sohbete yapıştırılmaz.

## Sıradaki işler

1. İlk TestFlight yüklemesi: Actions → iOS → Run workflow → "TestFlight'a yükle". Hata olursa günlüğü oku, düzelt.
2. App Store sayfası: ekran görüntüleri (iPhone 6,9" / 6,5", iPad 13"), TR + EN açıklama, anahtar kelimeler,
   gizlilik bilgileri (veri toplanmıyor), yaş derecelendirmesi, kategori (Games → Simulation / Casual).
   Kullanıcının daha önce Claude Code ile yazdığı App Store Connect yükleme aracı varsa onu kullan.
3. Uygulama içi satın alma (StoreKit 2): Premium tek seferlik 9,99 $ (`PREMIUM`), "Geliştiriciye teşekkür et" 2,99 $
   (`PREMIUM.tips`), satın alımları geri yükle. Şu an `game.premium` localStorage test anahtarıyla açılıyor.
4. Game Center: başarımlar + skor tablosu kimlikleri App Store Connect'te tanımlanacak (`achievements.js`).
5. Boyut: kullanılmayan model parçalarını ayıkla; yerel sürümde meshopt/Draco serbest.

## Son yapılanlar

- Oyun içi yazılar kullanıcıyla gözden geçirildi (Claude belge: "Market Krallığı – Oyun Yazıları").
- Müşteri kutlamaları sonsuz (`GOALS.milestoneBands`, `goals.js → milestoneAt`).
- Giriş takvimi 7. günden sonra her gün +$100 / +💎1 (`GOALS.loginAfter`).
