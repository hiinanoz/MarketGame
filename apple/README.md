# Market Krallığı / Corner Shop Empire — Apple sürümü (iPhone, iPhone Duo, iPad, Mac)

Bu klasör oyunu Capacitor 8 ile yerel iOS uygulamasına paketler. **Oyun kodu kopyalanmaz**: `../src` tek kaynaktır,
`npm run web` onu `www/` klasörüne derler. Plan ve kararlar: `../docs/APPLE.md`.

## Gerekenler
- macOS + Xcode 26 veya üstü (iPhone Duo'da tüm ekran için Xcode 27.1), Node 22+
- Apple Developer hesabı (Game Center, iCloud, TestFlight, App Store)

## Kullanım
```bash
cd apple
npm install
npm run sync      # oyunu derler (../src → www) ve iOS projesine kopyalar
npm run open      # Xcode'da açar → cihaz/simülatör seç → Çalıştır
```

## Durum
- [x] Capacitor 8 iOS projesi (Swift Package Manager), `ios/App`
- [x] Info.plist: dikey iPhone, her yönde iPad, gizli durum çubuğu, oyun kumandası, Oyunlar kategorisi, şifreleme beyanı
- [x] Gizlilik manifestosu (`ios/App/App/PrivacyInfo.xcprivacy`) — Xcode'da App hedefine bir kez eklenmeli (sürükle-bırak)
- [ ] Game Center eklentisi (Swift, uygulama içinde)
- [ ] iCloud kayıt eklentisi (NSUbiquitousKeyValueStore)
- [ ] Ana menü / ayarlar / ilk açılış akışı (bkz. plan, bölüm 4)
- [ ] Simge, açılış ekranı, App Store görselleri
- [ ] Apple TV: ayrı yerel sürüm (WebKit tvOS'ta yok)

Linux'ta `npm run sync` çalışır; derleme ve imzalama yalnızca Xcode'da yapılır.
