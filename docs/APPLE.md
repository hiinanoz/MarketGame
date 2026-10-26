# Apple ekosistemi (oyun bittikten sonra)

> Güncel ve ayrıntılı plan (26 Ekim 2026): https://claude.ai/artifact/7KQLGhgyw8NFhxXCUSCViy
> Özet: Capacitor 8 ile `apple/` klasöründe tek kod tabanından iPhone, iPhone Duo, iPad ve Mac; Game Center ve iCloud için
> uygulama içi Swift eklentileri; Apple TV (tvOS'ta WebKit yok) ayrı yerel sürüm olarak sonra.

Hedef: iPhone, iPad (ve katlanabilir/büyük ekranlı modeller), Apple TV. App Store'a yükleme oyun tamamlandıktan sonra ayrı bir çalışma olarak yapılacak.

## Yaklaşım

- **iPhone + iPad (+ Mac):** oyun bir web oyunu (Three.js). Capacitor ile tek dosyalık sürüm (`npm run build:single`) WKWebView içinde yerel uygulama olarak paketlenir. Dokunmatik joystick zaten var; iPad için arayüz ölçeği ve yatay ekran düzeni gözden geçirilecek. Kayıt `localStorage` yerine Capacitor Preferences / iCloud'a taşınabilir.
- **Apple TV (tvOS):** tvOS'ta WKWebView yoktur; web oyunu doğrudan çalışmaz. Seçenekler: (1) oyunu yerel bir motora taşımak (ör. Swift + SceneKit/RealityKit; GLB modeller USDZ'ye çevrilir), (2) Apple TV'yi kapsam dışı bırakıp iPhone/iPad'e odaklanmak. Karar, oyun bitince verilecek. Bunu kolaylaştırmak için oyun mantığı (`config.js`, ekonomi, işletmeler) çizimden ayrı tutulmaya devam edilecek.
- **Kontroller:** Apple TV ve iPad için oyun kumandası (MFi / PS / Xbox) desteği: Gamepad API ile joystick + düğmeler.

## Boyut

- Özellikler boyut için kısılmaz, ama küçük olması iyi: modeller sıkıştırmasız GLB (WebAssembly gerektirmesin diye); yalnızca kullanılan modeller paketlenir (`tools/build-assets.mjs`).
- Yerel uygulamada WebAssembly serbest olduğu için App Store sürümünde meshopt/Draco sıkıştırması ve KTX2 dokular açılabilir (tahmini %50–70 küçülme).
