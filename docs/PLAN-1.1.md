# Sürüm 1.1 planı — Market Krallığı

Kullanıcı geri bildirimlerinden gelen büyük güncelleme.

**Kararlar (1 Kasım 2026):** Reklam = geçiş reklamı + sıklık sınırı (Sv.5 öncesi yok, en az 3 dk ara).
Genişleme = Öneri A (Salon 4 + otopark derine + yeni ürünler). Isınma = mevcut kodda optimizasyon (Swift yok).
Onaylanan aşamalar: 0, 1, 2, 3, 4, 5 — bu sırayla.
 Aşamalara bölündü; her aşama ayrı dalda yapılır,
test edilir, TestFlight'a gider. Kararı beklenen yerler **[KARAR]** ile işaretli.

---

## Aşama 0 — Hızlı düzeltmeler ve ısınma ✅

| # | İş | Not |
|---|---|---|
| 0.1 | Muhasebeci seçimindeki okunmayan alt satır | Görsel bu sohbete gelmedi. 1.0 (33)'te düğmeyi değiştirmiştim; görüntüyü tekrar gönderirsen hangi satır olduğunu kesinleştiririm. Muhtemelen dar ekranda küçük yazı/kontrast: yazı boyutu 13px, kontrast koyulaştırılır, gerekirse iki satıra bölünür. |
| 0.2 | "Oyunu sıfırla" menüden kalkar | ☰ menüdeki kırmızı düğme kaldırılır. Ana menü → Ayarlar sayfasının en altına, iki adımlı onayla (yazarak "SİL" ya da 3 sn basılı tut) taşınır. Zaten ana menüde "Yeni oyun" var; ikisi tek yerde birleşir. |
| 0.3 | Telefonun ısınması (aşağıda ayrıntı) | Kare hızı sınırı, menüde çizimi durdurma, gölge/çözünürlük ayarı, "Pil tasarrufu" seçeneği. |
| 0.4 | Konut yıkımı | Yapılmış binayı yık → arsa boş kalır, yeni tip seçilir. Ücret = binanın inşaat maliyetinin **1/8**'i, belediye başkanıysan **1/32**'si (4 kat ucuz). Kiracılar çıkar, biriken kira o an ödenir, emlakçı arsada kalır. Onay penceresi ücreti gösterir. |
| 0.5 | Otopark derine büyür | Bkz. Aşama 2 — yön kararı market genişlemesiyle birlikte verilmeli. |

### Telefon neden ısınıyor?

Kodu inceledim; ısınmanın ana sebebi dil değil, **GPU'nun hiç durmadan tam güçte çizim yapması**:

- Oyun her karede (iPhone'da 60, ProMotion'da 120 kare/sn) baştan çiziyor; menü, ana menü ve gün sonu ekranı açıkken bile.
- Çözünürlük 2× (Retina) + kenar yumuşatma (antialias) + 2048×2048 yumuşak gölge haritası.
- Onlarca animasyonlu karakter (müşteri, çalışan, kasabalılar, arabalar) aynı anda.
- `powerPreference: 'high-performance'` GPU'yu yüksek güçte tutuyor.

**Swift'e geçmek bunu çözmez mi?** Kısmen. Oyun mantığı (JavaScript) yükün küçük kısmı; asıl yük 3D çizim ve
bu yerelde de aynı GPU'yu kullanır. Swift + SceneKit/RealityKit ile yeniden yazmak aylar sürer (15.000 satır,
tüm modeller, arayüz, çeviri), ısınmayı belki %20–30 azaltır. Aynı kazancı (ve fazlasını) mevcut kodda birkaç
günde alabiliriz:

1. Kare hızını 30'a sabitle (bu tür oyunda fark edilmez) → GPU yükü ~yarıya iner.
2. Menü, gün sonu, tablet, CEO modu açıkken 3D çizimi tamamen durdur.
3. Telefonda çözünürlük 2× yerine 1.5×, gölge haritası 1024, `powerPreference: 'default'`.
4. Uzaktaki/ekran dışındaki karakterlerin animasyonunu güncelleme; kalabalıkta kasabalı sayısını sınırla.
5. Ayarlara "Grafik: Yüksek / Dengeli / Pil tasarrufu" seçeneği (varsayılan Dengeli).
6. Genel müdür (Aşama 3) ve CEO modu (Aşama 4) market sahnesini sadeleştirir → geç oyunda yük ayrıca düşer.

Önce 1–5'i yapıp TestFlight'ta ölçmeyi öneriyorum. Yetmezse bir sonraki adım, sahneyi tek parça
geometriye birleştirme (draw call azaltma) olur; yerel yeniden yazım ancak en son seçenek.

---

## Aşama 1 — Seviye atlamada reklam (standart sürüm) ⏸️ AdMob kimlikleri bekleniyor

İstenen: standart kullanıcıya her seviye geçişinde bir reklam; Premium reklamsız.

Gerekenler:
- **Google AdMob** iOS SDK'sı (Capacitor eklentisi `@capacitor-community/admob`). AdMob hesabın var (app-ads.txt hazır);
  bu uygulama için AdMob'da yeni bir uygulama + reklam birimi kimliği gerekir (sen oluşturup bana kimliği verirsin).
- **İzin ekranları:** iOS'ta ATT ("izlemeye izin ver") ve AB/Birleşik Krallık için Google UMP onay formu zorunlu.
- **Gizlilik değişiklikleri:** gizlilik sayfası ("reklam ortağı Google cihaz kimliği toplar"), App Store'daki
  App Privacy bölümü artık "Data Not Collected" olamaz (Identifiers / Usage Data → Third-Party Advertising).
- Oyundaki "Oyun reklamsız" yazısı → "Premium reklamsız".

Seçenekler:
- **A) Geçiş reklamı (interstitial)** — seviye kartı kapanınca, istediğin gibi. Seviyeler başta çok hızlı geldiği için
  sıklık sınırı öneriyorum: Sv.5'ten önce yok, iki reklam arası en az 3 dk.
- **B) Ödüllü reklam** — kart üstünde "Reklam izle, ödülü 2 katına çıkar". Kullanıcılar daha az rahatsız olur,
  gelir daha düşük ama puanlar daha iyi.
- **C) İkisi** — A + isteğe bağlı B.

---

## Aşama 2 — Market büyümesi, yeni ürünler, otopark ✅ (Öneri A + Depo 2 uygulandı)

Mevcut yerleşim: Salon 1 (orta), Salon 2 (sağ), Salon 3 (sol, Sv.14). Otopark binanın önünde solda,
4. aşamada yola paralel sola uzanıyor. Binanın solunda (x −28'in solu) boş alan var.

**Öneri A (önerdiğim): Sol tarafa 4. salon + otopark derine**
- Salon 4 (Sv.38–40 arası): Salon 3'ün soluna, aynı derinlikte. Kapısı ön yüzde.
- Otopark: mevcut otoparkın arkasından binaya paralel, derine (−z yönüne, salon 4'ün önüne kadar) 2 sıra daha.
  Yola cephesi olmaz; giriş mevcut otoparktan.
- Yeni ürünler: Sv.30–60 arası her ~5 seviyede bir **raf ürünü** (ör. 🥛 süt, 🍎 elma, 🧃 meyve suyu, 🍫 çikolata,
  🧴 temizlik, 🥚 yumurta — 6 yeni raf) ve her ~8 seviyede bir **kampanya ürünü** (ör. 🍕 pizza, 🍦 dondurma,
  🍣 suşi seti, 🎂 pasta — 4 yeni). Salon 4 bu rafların yeri olur.
- Modeller KayKit/Kenney paketlerinden alınır (yalnızca kullanılan parçalar; boyut hedefi korunur).

**Öneri B: Sadece otopark büyür, ürünler mevcut salonlara sığar**
- Daha az iş; ama mevcut salonlar dolu, yeni raflar sıkışır.

**Öneri C: Salon 4 + otopark sola (eskisi gibi) uzar**
- Otopark ile salon 4 aynı boşluğu paylaşır; otopark küçük kalır.

---

## Aşama 3 — Genel müdür (Sv.35+) — market otomatik pilot ✅ (iki seviye: %90 / Premium %105; izle-karışma)

- Muhasebe → "Genel müdür işe al" (Sv.35, işe alım + günlük maaş). Açılınca market **diğer işletmeler gibi**
  çalışır: sipariş, kampanya, reklam, personel, kasa hepsi otomatik.
- Sahne sadeleşir: müşteri trafiği simüle edilir ama ekranda az sayıda müşteri gösterilir (performans da artar);
  bildirimler ve "ürün bitti" ipuçları susar.
- Market kartı holding tabletinde: günlük ciro, kâr, memnuniyet, tek tuşla "Genel müdürü çıkar / markete dön".
- Muhasebeci ayarları genel müdürün altına geçer (yetkiler aynı mantık).
- Genel müdürün verimi: tecrübeli muhasebeci gibi iki seviye (Premium'da üst seviye) — **[KARAR]** istenirse.

---

## Aşama 4 — Holding ve CEO modu ✅ (36 olay kartı, 8 dil)

**Uygulanan:** `src/ceo.js` (masa), `src/events.js` (motor), `src/eventcards.js` (kartlar + takip kartları), ayarlar
`config.js → CEO`. Kart sayısı `2 + floor((işletme−4)/3)` (+0/1 rastgele), en fazla 6; kart süresi gün uzunluğunun %15'i.

**Kararlar:** zaman akar (hız ayarı geçerli; cevapsız kart süre dolunca varsayılan seçenekle kapanır) ·
günde 2–3 kartla başlar, holding büyüdükçe 4–6'ya çıkar · ton hafif mizahi · holding ücretli + isimli
(~$50.000, tüm işletmelere +%5 verim).

**Teknik tasarım:**
- `src/ceo.js`: CEO masası (DOM, 3D çizim durur → `game.viewMode = 'ceo'`, `GFX.idleFps`), gösterge tablosu, işletme tablosu, gündem.
- `src/events.js`: olay kartı motoru — her kartın koşulu (sahip olunan işletme, seviye, siyaset durumu, borç…), 2–3 seçeneği,
  anlık etkisi (para, nüfuz, memnuniyet, işletme verimi, hisse fiyatı) ve gecikmeli sonuçları (n gün sonra gelen takip kartı).
  Kart verisi `config.js` → `EVENTS` (metinler `t()` ile, 8 dil).
- Kart sayısı: `2 + floor(işletme sayısı / 4)`, en fazla 6; aynı kart 10 gün içinde tekrar gelmez.
- Varsayılan seçenek: süre dolunca (oyun saatiyle ~2 saat) en "temkinli" seçenek uygulanır.
- Haritaya dön / CEO masası düğmesi HUD'da; holding olunca tablette de.

- **Holding ol:** 4 işletme sahibi olunca tablette "Holding kur" (kuruluş ücreti, holding adı). Holding olunca
  **CEO modu** açılır; istediğin an "🗺️ Haritaya dön" / "💼 CEO masası" arasında geçiş.
- **CEO masası** (3D sahne çizilmez → ısınma yok):
  - Üstte gösterge tablosu: nakit, şirket değeri, günlük kâr, popülerlik, risk.
  - Ortada **günün gündemi**: her oyun günü 2–3 olay kartı. Her kartta 2–3 seçenek, sonuçları gecikmeli
    ve bazen gizli. Örnek kartlar:
    - 📰 *Gazete:* "Mandıranda hijyen skandalı iddiası" → basın açıklaması / müfettiş çağır / gazeteyi satın al
    - 🤝 *Gizli görüşme:* "Rakip zincirin sahibi birleşme teklif ediyor" → kabul / pazarlık / ifşa et
    - 🏛️ *Belediye:* "İmar planında değişiklik, arsaların değer kazanabilir" → lobi yap / bekle
    - 👷 *Sendika:* "Fabrikada zam talebi" → kabul / yarısı / reddet (grev riski)
    - 🕵️ *Muhbir:* "Muhasebecin kayıtları değiştiriyor olabilir" → denetim / görmezden gel
  - Altta işletme tablosu (gelir, gider, personel, müdür, büyüt/sat düğmeleri) — haritaya gitmeden yönetim.
- Olaylar şehirdeki durumdan beslenir (sahip olunan işletmeler, siyaset, borç). ~60–80 olay kartı, 8 dil.
- Gün CEO modunda "Günü bitir" ile ilerler (Premium kısıtı burada geçerli mi? **[KARAR]**).

---

## Aşama 5 — Siyaset 2.0 ve spor kulübü **[KARAR]**

**Spor kulübü (siyaset öncesi, Sv.40+):**
1. Kampanyalarda "⚽ Kulübe sponsor ol" (günlük ücret, müşteri + nüfuz).
2. Kulübe bağış → yönetim kuruluna davet (nüfuz +, siyasette güven).
3. Kulüp başkanlığı seçimi (taraftar desteği, maç sonuçları) → başkanken siyasette büyük artı, ama kötü sezon
   eksi yazar. Maç günü kartları CEO masasında da gelir.

**Siyaset 2.0:**
- Rakip adaylar **iftira/karalama** kampanyası açar (olay kartı): yalanla / dava aç / karşı kampanya / sessiz kal.
- Her kararın görünen etkisi (anket) ve gizli bir **hukuki risk** puanı var (rüşvet, yasa dışı bağış, basına baskı).
- Risk yükselirse: soruşturma → dava → **hapis**. Hapisteyken oyun "hapis ekranı"na geçer:
  - Yüklü kefalet öde, ya da
  - İşletme(ler)ini kayyuma devret (sonra parayla geri al), ya da
  - Cezanı çek (birkaç oyun günü, işletmeler müdürlerle döner, popülerlik düşer).
- Doğru/temiz kararlar → güven puanı → art arda seçim → otokrasi yolu (mevcut sistemle bağlanır).
- Seçim dönemleri daha rekabetçi: rakiplerin kendi kampanyaları, tartışma programı kartı, miting yarışı.

---

## Önerilen sıra ve takvim

1. Aşama 0 (düzeltmeler + ısınma) → TestFlight 1.0.x
2. Aşama 1 (reklam) — AdMob kimlikleri gelince
3. Aşama 2 (salon 4, ürünler, otopark)
4. Aşama 3 (genel müdür)
5. Aşama 4 (holding + CEO modu) — en büyük iş
6. Aşama 5 (siyaset 2.0 + spor kulübü) — CEO masasının olay kartı altyapısını kullanır

Her aşamada: yeni metinler 8 dile çevrilir, kayıt uyumu korunur (eski oyunlar bozulmaz), denge değerleri
`config.js`'te toplanır, tarayıcı testleri + iOS derlemesi + TestFlight.
