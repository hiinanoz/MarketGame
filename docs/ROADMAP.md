# Yol haritası: Sv.21–100 (marketten şehre)

Seviye seviye içerik: [LEVELS.md](LEVELS.md). Bu belge **nasıl yapılacağını** ve **hangi sırayla** yapılacağını anlatır. Her sürümden sonra oynanabilir hâle getirilir, kritik kararlar sorulur.

## Verilen kararlar

- **Ulaşım:** şehir haritasından hızlı geçiş + bölge içinde joystick ile yürüme.
- **Oynanış:** tedarikçi, santral ve konutlar yönetim odaklı. Üretim kendiliğinden yürür; müdür yokken oyuncu işletmedeyse üretim hızlanır. Market elle oynanan kısım olarak kalır.
- **XP (Sv.20 sonrası):** market müşterisi 1 XP + diğer işletmelerin günlük kârı + satın alımlar.
- **Derece:** şehrin tamamının kaçıncı oyun gününde alındığına göre.

## Temel fikir: işletmeyi kur → büyüt → devret

Market elle oynanan kısım olarak kalır. Diğer her şey (tedarikçiler, santraller, konutlar, banka) **işletme** olarak çalışır:

1. **Satın al**: haritada zaten var olan, başkasına ait bir işletmeyi (ya da boş arsayı) alırsın. Bazıları için banka kredisi gerekir.
2. **Büyüt**: işletme kendi arsasında **arkaya doğru modül modül** büyür (çiftlikte yeni tarla sırası, mandırada yeni ahır, güneş tarlasında yeni panel sırası, rüzgârda yeni türbin). Her modül üretimi, çalışan ihtiyacını ve gideri artırır.
3. **Çalışan ata**: üretim için işçiler (sarı şapka).
4. **Müdür ata** (kırmızı şapka): işletme sen yokken de tam verimle çalışır. Müdürsüz işletme ancak sen oradayken tam çalışır.
5. **Muhasebeci ata** (mavi şapka): maaşları öder, ürünü kime satacağına, stoğa, kampanyaya karar verir. Sen istediğin zaman kararı değiştirebilirsin (*Muhasebeci karar versin* anahtarı).

Şapka renkleri: **işçi sarı · müdür kırmızı · muhasebeci mavi** (marketteki mevcut müdür de kırmızıya geçer).

## Gerekli sistemler

| Sistem | Ne yapar | İlk gerektiği sürüm |
|---|---|---|
| **Holding tableti** | Tüm işletmeler tek ekranda: gelir/gider, çalışan, müdür, muhasebeci, büyütme. Uzaktan yönetim. | S1 |
| **İşletme çekirdeği** | Her işletme için ortak model: sahip, modül sayısı, kadro, üretim/gün, maaş, enerji, gelir. Gün sonunda hesap. | S1 |
| **Roller** | Müdür ve muhasebeci karakterleri (kırmızı/mavi şapka), işe alma alanları | S1 |
| **Market muhasebecisi** | Otomatik sipariş (akıllı), kampanya kararı (geçmiş satışa göre ürün ve stok), fazla parayı mevduata yatırma | S1 |
| **Büyük harita + bölgeler** | Kuzey: tedarik vadisi → en kuzey: enerji tepeleri. Doğu: mahalleler. Batı: şehir merkezi. Güney: liman. Kilitli bölgeler seviyeyle açılır. Uzak bölgeler performans için sadeleştirilir. | S1 |
| **Ulaşım** | Büyük haritada dolaşma (bkz. açık sorular) | S1 |
| **Başlangıç hikâyesi** | Yeni oyun: kasabaya varış, banka kredisiyle market alımı (başlangıç borcu, düşük faiz) | S1 |
| **Tedarik zinciri** | Kendi tedarikçinden gelen mal ucuz/bedava, fazlası rakip marketlere satılır (sözleşme + kamyon) | S2 |
| **Giderler** | Günlük maaş, elektrik faturası; başkan olunca vergi | S2 |
| **Enerji** | Üretim/tüketim dengesi, şebekeye satış, gece için batarya | S3 |
| **Arazi + inşaat** | Arsa al, inşaat süresi, kiracı, kira, mahalle memnuniyeti | S4 |
| **Şubeler** | 2. ve 3. market (müdür + muhasebeciyle otomatik çalışır) | S4 |
| **Siyaset** | Nüfuz puanı, bağış/sponsorluk, seçimler (anket, fon, miting), başkanlık kararları | S5 |
| **Banka kurma** | Mevduat toplama, kredi verme, faiz geliri, hisse alımı | S6 |
| **Şehri satın alma** | Parsel haritası, sahiplik yüzdesi, son pazarlıklar, final ekranı ve derece | S7 |

## Harita planı

```
                 [ Enerji tepeleri: güneş, rüzgâr, baraj ]      ← Sv.31+
                 [ Tedarik vadisi: çiftlik, mandıra, fırın, et ] ← Sv.22+
  ─────────────── arka yol (kamyonlar) ───────────────
[ Şehir merkezi ]   [ Depo ][ MARKET ][ 2. salon ]   [ Doğu mahalleleri ]
[ belediye, banka ] [ 3. salon ]                      [ evler, siteler  ]  ← Sv.36+
  Sv.51+            ─────────── ön cadde ───────────
                         [ Liman / sahil ]  ← Sv.69+
```

Her işletmenin bir **arsa şeridi** vardır (ön cephe yola bakar, modüller arkaya doğru eklenir). Böylece büyüdükçe arsa dolar ve haritada görünür.

## Sürümler (sırayla)

| Sürüm | Seviyeler | İçerik | Bitince |
|---|---|---|---|
| **S1** ✅ | 21–25 | Holding tableti, işletme çekirdeği, müdür/muhasebeci rolleri ve şapkalar, market muhasebecisi, kuzey harita genişlemesi, ulaşım, başlangıç hikâyesi, ilk tedarikçi (çiftlik) | Oynat + geri bildirim |
| **S2** ✅ | 26–30 | Mandıra, fırın, et tesisi; rakip marketlere satış; kamyon filosu; maaş ve elektrik giderleri | Ekonomi dengesi soruları |
| **S3** ✅ | 31–35 | Güneş, rüzgâr, batarya, şebekeye satış, enerji kadrosu | |
| **S4** 🚧 | 36–50 | Arazi ofisi, evler, apartman, site, inşaat şirketi, mahalle memnuniyeti, 2.–3. market şubeleri, baraj | Konut oynanışı soruları |
| **S5** 🚧 | 51–65 | Şehir merkezi, nüfuz, gazete, seçimler, başkanlık, şehir projeleri | Siyaset mekaniği soruları |
| **S6** ✅ | 66–80 | Yatırım şirketi, rakip zincirleri alma, liman, kendi banka, şubeler | |
| **S7** ✅ | 81–100 | Bölge bölge satın alma, mega projeler, final, derece ekranı | |

## S1'de yapılanlar (Sv.21–25)

- Seviyeler 100'e çıktı (eşikler Sv.20 sonrası her seviyede %7,5 artar); XP: müşteri + işletme kârı ($100 = 1 XP) + satın alımlar ($100 = 1 XP).
- Yeni oyun: giriş hikâyesi ve $1.500 **kuruluş kredisi** (%1/gün, bankada ayrı satır; ödemelerde önce %4'lük kredi kapanır).
- Şapkalar: işçi sarı, müdür kırmızı, muhasebeci mavi.
- **Market muhasebecisi** (Sv.21, $3.000): siparişler (%45 altına inen paletleri %85'e tamamlar), kampanya kararı (her akşam 19:00, son kampanya sonucuna göre stok), birikim (gün sonu borç öder, fazlayı yatırır). Her biri muhasebe odasındaki 🧑‍💼 sekmesinden açılıp kapatılır; kampanya iptal edilebilir (para iade).
- **Holding tableti** (💼, Sv.21) ve **harita** (🗺️): bölgelere hızlı geçiş.
- **Tedarik vadisi** (arka yolun kuzeyi): Yeşil Vadi Çiftliği (Sv.22), Ak Süt Mandırası (Sv.24), Altın Başak Fırını (Sv.26), Kasaba Et Tesisi (Sv.28). Satın al → modül ekle (arkaya doğru, en fazla 5) → işçi (modül başına 2), müdür ve muhasebeci (Sv.25). Ürün kamyonla markete gider; fazlası depoda birikir, muhasebeci satar. Gün sonu maaşlar ödenir, kâr özetle gösterilir.

## S1 sonrası düzeltmeler ve eklemeler

- Taşıyıcılar: en acil (en boş) reyonu seçer; kampanya standları öncelikli ama aynı standa gidenler arttıkça çekiciliği azalır, kampanya günü taşıyıcıların en fazla yarısı standlara gider (normal reyonlarda iş yoksa hepsi). 3 yeni taşıyıcı alanı (Sv.13/16/19).
- Kampanyalar: aynı gün en fazla 3; 10 özel ürün (burger, sebze burger, akşam menüsü, reçel, turşu, zeytin, sos seti, hardal, hazır çorba, tava seti); stok 20–1000; kampanya başına 50–500 ek müşteri; kampanya müşterilerinin %20'si başka reyondan da alır. Her standın yanında kendi stok paleti var.
- Market muhasebecisi marketin tüm işlerini takip eder (banka hariç): sipariş, kampanya (3'e kadar, son sonuçlara göre ürün ve stok), yatırım (açılmış market alanlarını yedek bırakarak satın alır).
- 🔍 Büyüteç: yakın / normal / uzak / çok uzak (masaüstünde fare tekerleği).
- Tedarikçilerde elle çalışma: tarlada/üretimde dolaşan oyuncu üretir; 📦 alanından kasa alıp depo paletine ya da reyona kendin taşırsın.
- Müdür + muhasebeci olan işletme bağımsızdır: eksik işçiyi alır, para yetince kendini büyütür (tabletten durdurulabilir).
- Kredi limiti ekonomiye göre: seviye + işletme değerinin yarısı + son 3 günün ortalama kazancının 3 katı.

## S2'de yapılanlar (devam ediyor)

- **Maaşlar:** işe alım ucuz (kasiyer/temizlikçi $60, taşıyıcı $80, güvenlik/reklamcı/otopark $100, müdür/muhasebeci $150; tedarikçide işçi $50). Her gün sonunda maaş: çalışan $50, temizlikçi $45, müdür $65, muhasebeci $70. Önce nakitten, yetmezse mevduattan; işe alınma sırasıyla ödenir. Maaşı ödenemeyen çalışan ayrılır, alanı yeniden belirir; para kazanınca tekrar işe alınır (muhasebeci açıksa kendisi alır). Muhasebeci kasada maaş + faiz kadar yedek bırakır.
- **Banka faizi:** gün sonunda nakitten (yetmezse mevduattan) ödenir; ödenemeyen kısım borca eklenir. Faiz üst üste 3 gün ödenmezse banka en değersiz işletmeye el koyar (değerinin %70'i borçtan düşer, modüller korunur). Borcun tamamı kapanınca işletme aynı fiyata 💼 tabletten geri alınır.
- **Lojistik firması** (🚛 Hızlı Nakliyat, Sv.29, $40.000; dört tedarikçinin hepsi alındıktan sonra): kamyon filosunu yönetir. Yokken tedarikçi sevkiyatı dış nakliyeyle gider (kasa başı $1). Varken sevkiyat bedava, market siparişleri %10 ucuz ve kamyonlar modül başına %15 hızlı; kamyonlar (modül başına 2, şoför başına) başka firmalara taşıma yapıp günde kamyon başı $220'ye kadar getirir; fazla ürün rakip marketlere (Ucuz Market, Köşe Bakkal) alış fiyatının 1,15 katına satılır.
- **Yeni modeller:** çiftliğe yel değirmeni, tahıl ambarı, çuval, el arabası; vadinin arkasına orman; enerji tepelerinde (Sv.31'de açılacak) rüzgâr türbinleri ve güneş paneli sıraları; caddede iki rakip market.
- **İsimler:** yeni oyunda markete isim verilir (tabela ve reklam panosunda "<isim> Market"); menüden ve tabletten (✏️) değiştirilebilir. Satın alınan her işletmeye tabletten isim verilir.
- **Elektrik (Sv.30):** gün sonu fatura = market 60 + ek salon başı 40 + işletme modülü başı 25 birim ($1/birim). Ödenemeyen kısım krediye yazılır.

## S3'te yapılanlar (Sv.31–35)

- **Enerji tepeleri** (vadinin arkası, haritada ⚡): *Güneşli Tepe Güneş Tarlası* (Sv.31, $45.000, modül başı 200 birim/gün, sadece gündüz) ve *Rüzgârlı Sırt Rüzgâr Santrali* (Sv.33, $60.000, modül başı 320 birim/gün × günün rüzgârı 0,5–1,4). Modül başı 1 teknisyen; enerji müdürü Sv.32, enerji muhasebecisi Sv.35.
- Kendi üretimin önce kendi tüketimini karşılar (fatura düşer/biter). Güneş, **batarya** (Sv.34, $18.000) yoksa tüketimin gece payını (%30) karşılayamaz.
- Fazla elektrik, santrallerden birinde muhasebeci varsa **şebekeye** birim başı $0,8'e satılır; yoksa boşa gider.
- Muhasebeci kasada tahmini fatura kadar da yedek bırakır.

## Kira, konut, şube, medya düzenlemesi (kullanıcı kararları)

- **Market Sv.20'ye kadar kiralık.** Haftalık kira (her 7. günün sonunda) = 120 + ek salon başı 140 + reyon başı 8 + otopark aşaması başı 40 + depo yükseltmesi 40. Sv.20'den sonra muhasebe odası → 🏦 Banka sekmesinden bina satın alınır (30 haftalık kira).
- **Kiralık işletmeler:** fırın (Sv.38'de satın alınabilir), et tesisi (Sv.42), rüzgâr santrali (Sv.46), Kiralık Dükkân şubesi (Sv.60). Devir bedeliyle kiralanır, haftalık kira modül başına artar. Banka kiralık işletmeye el koyamaz. Çiftlik, mandıra, lojistik, güneş, diğer şubeler ve medya doğrudan satın alınır.
- **Konut (Sv.36+, doğu mahallesi, 12 arsa):** arsa $3.000 → ev tipi seç ve öde (müstakil ev Sv.37, apartman Sv.39, site Sv.42, villa Sv.47) → gündüzleri aşama aşama inşa (temel, kaba inşaat, çatı). Bitince "Kiraya ver"; kiracı 1–2 günde bulunur, 14–42 gün kalır, çıkınca daire tadilat ister. Her binaya ayrı emlakçı ($200, Sv.37): kiracı ve tadilatı kendisi yapar, kiradan %10 komisyon alır. Kira günlük birikir, haftalık ödenir. İnşaat şirketi (Sv.38, $25.000): %40 hızlı, %15 ucuz. Mahalle memnuniyeti şimdilik kiracılara bağlı değil.
- **Market şubeleri (Sv.50+):** Köşe Bakkal (Sv.50, satın al), Kiralık Dükkân (Sv.52, kirala), Ucuz Market (Sv.56, satın al). Boş gelir: müdür, muhasebeci ve çalışanları sen atarsın; müdür + muhasebeci olunca çalışan alır ve büyür.
- **Medya (Sv.52, Kasaba Gazetesi & Radyo, şehir merkezi):** almadan önce reklamlar ücretli (muhasebe → 📢 sekmesi: el ilanı, gazete, radyo, TV; o gün açıksa hemen, değilse ertesi gün). Medya alınınca reklamlar %60 ucuz, market ve şubelere +%15 müşteri.
- **Belediye:** 4 ve üzeri işletmede her sabah %25 olasılıkla ceza (ruhsat, kaldırım işgali…). Belediye başkanı olunca (Sv.60) kesilmez.
- **HUD:** Sv.21'den sonra toplam çalışan sayısı (👥) görünür.

## S4 tamamlananlar (Sv.41–50)

- **Akçay Barajı** (Sv.41, $90.000, enerji tepelerinin batısı): modül başı 500 birim/gün, gece payını da karşılar.
- **Emlak muhasebecisi** (Sv.44, $150 + $70/gün): emlakçısı olmayan binalarda kiracı bulur, tadilat yaptırır; kiraları her gün tahsil eder.
- **Okul ve sağlık ocağı** (Sv.45, arka yolun kuzeyinde): her biri kiraları %10 artırır.
- **Doğu Mahallesi tapusu** (Sv.50): 12 arsanın hepsinde bina bitince +500 XP, kiralar +%10.
- Mahalle memnuniyeti ve altyapı (Sv.40) kullanıcı kararıyla ertelendi.

## S5 siyaset (kullanıcı kararları)

- Takvim: 1 oyun ayı = 2 gün, 1 yıl = 24 gün. Sv.51'den sonra 2 yılda bir belediye başkanlığı seçimi. Sol üstteki 🗳️ düğmesinde seçime kalan süre ve popülerlik yazar; tıklayınca siyaset paneli açılır.
- **Nüfuz (popülerlik):** bağış (geçici), spor kulübü sponsorluğu (günlük, geçici), miting (seçime 6 ay kala, günde bir), kamu binası bağışı (park, kütüphane, spor salonu — kalıcı), okul/sağlık ocağı (kalıcı), 100+ çalışan (kalıcı, +8…+20). Geçici nüfuz günde %3 azalır.
- **Seçim:** 3–5 rakip; ana rakip her zaman en az %25, diğerleri en fazla %8. Oyun oranın = popülerlik × 0,8 (±2). Ana rakipten fazla alırsan kazanırsın.
- Seçime 6 ay kala rakip adaylar "OY VER" pankartlarıyla caddede gezer, ara sıra miting yapar.
- **Başkanlık:** belediye cezası yok; vergi oranı (%0–30, %5 üstü memnuniyeti düşürür), imar izni (doğu mahallesinde 4 yeni arsa), şehir projeleri ihalesi (otogar: günlük gelir + %5 müşteri; stadyum: günlük gelir + haftalık maç günü %40 müşteri).
- **Otokrasi:** üst üste 4 seçim kazanınca geçilebilir; seçim yapılmaz, kral olursun. Halk memnuniyeti 2 yıl (48 gün) üst üste %50'nin altında kalırsa otokrasi biter, 6 ay sonra seçim yapılır.
- Halk memnuniyeti = market puanı + kamu binaları + okul/sağlık + projeler + istihdam − yüksek vergi.

## S6'da yapılanlar (Sv.66–80, finans)

- **Liman ve sanayi bölgesi** ön caddenin güneyinde, kıyıda (Sv.66'da yürünebilir): Anadolu Otel ve Lezzet Restoran Zinciri (Sv.68), Kasaba Limanı (Sv.69; modül başı mal alımı %8 ucuz, Sv.78 genişletme), Sanayi Fabrikası (Sv.73), Kasaba AVM (Sv.75, +%5 müşteri), Havalimanı ihalesi (Sv.76, +%10 müşteri). Hepsi boş gelir: müdür, muhasebeci, çalışan atanır.
- **Yatırım şirketi** (Sv.66): tabletteki 📈 Finans sekmesinde borsa. Hisse fiyatları her gün değişir, temettü öder. %51 = kontrol: Ucuzcu zinciri (+%10 müşteri, Sv.66), Anadolu Otelcilik / Kasaba Tekstil (temettü ×2), Kuzey Enerji (Sv.74, elektrik −%50), Şehir Bankası (Sv.79, kredi faizi −%50).
- **Kendi bankan** (Sv.70 lisans): sermaye koy → günlük %1 faiz geliri; şubeler (Sv.71, 4'e kadar), kredi kartı ve sigorta (Sv.72, gelir +%30/+%20), **finans merkezi** (Sv.80): kendi kredilerin faizsiz, kredi limiti ×2. Banka genel merkezi binası kıyıda görünür.
- **Halka arz** (Sv.77): şirket değerinin %20'si nakit. Tablette şirket değeri ve portföy görünür.
- Yeni modeller: KayKit City Builder binaları (B, E, G, H; CC0, mevcut dokuyu paylaşır).

## S7'de yapılanlar (Sv.81–100) ve bitiş

- **Şehri satın almak:** 6 bölge, 18 mülk (Eski Çarşı Sv.81, Sahil Şeridi Sv.83, Sanayi Bölgesi Sv.85, Üniversite Sv.87, Kuzey Köyleri Sv.89, Belediye Meydanı Sv.95). Tabletteki 🗺️ Harita sekmesinin altında mülk sahiplerine teklif verilir (%75 / %85 / %95 / tam fiyat).
  - Esnek sahip: 1. teklifte %95, 2.'de %85, 3.'den sonra %75'i kabul eder (en fazla %25 indirim).
  - İnatçı sahip: düşük teklife kızar, fiyatı her seferinde %8 artırır, asla indirmez.
  - Alınan mülkte yeşil bayrak dalgalanır.
- **Bitiş:** bütün mülkler + bütün işletmeler senin olunca Sv.100 ve 👑 **Kasabanın Hakimi**. XP ile en fazla Sv.99'a çıkılır. Final ekranı: derece (oyun gününe göre S ≤ 200, A ≤ 300, B ≤ 420, C ≤ 600, D), gün, oynama süresi, para, şirket değeri, işletme/mülk/konut/çalışan sayısı, müşteri, kazanılan seçim, en büyük işletme. "Oynamaya devam et" ile oyun sürer; seviye artık ilerlemez, para kazanmaya devam edilir.
- **Yaşayan şehir (Sv.20+):** kasabalılar evlerinden (yoksa şehir dışından) çıkar, kaldırımlarda yürür; senin dükkânlarına uğrayıp para bırakır, parka, sahile, işletmelere gider; akşam eve döner. Sayı seviye ve evlerle artar (en fazla 16).
- **Şehir zamanla değişir:** Sv.20'den sonra her gün kaldırımlara yeni ağaç, çiçeklik, bank ve lamba eklenir; alınan mülkler bayrakla görünür.

## Sonradan eklenenler

- **Menü:** açılınca oyun duraklar; "Menü açıkken arka planda devam et" seçeneği; "Devam et". **Günü hızlandır (2×)** menüden ya da sağdaki ⏩/▶️ düğmesinden açılıp kapanır. Ayarlar cihazda saklanır.
- **Müzik:** dosyasız, WebAudio ile çalan 16-bit tarzı polifonik döngü (104 BPM, bas + arpej + melodi + hafif ritim). Menüden kapatılabilir; boyut eklemez.
- **Market muhasebecisi yetkileri:** sipariş, kampanya seçimi, alan yatırımı, personel alımı, ödemeler için kredi (gün sonu kasa yetmezse eksik kadar kredi; önce maaşlar). **Stajyer** ($70/gün) geçmişe bakarak tahmin eder; **tecrübeli** ($600 + $140/gün, 🎓) pazar araştırmasıyla kampanya talebini ve mağazanın kaldırabileceği müşteri sayısını bilir (az mağdur, az kalan stok), maaşı karşılanmayacak personeli almaz, tam ihtiyaç kadar kredi çeker.

- **Kampanya personeli** ($80/gün, kampanya hazırlarken seçilir): standın yanında durur, paletten standa hızlı doldurur, müşteriler standdan 3 kat hızlı alır ve ödemeyi standda yapar (kasa kuyruğuna girmez); personelli kampanyaya mağazaya aynı anda +40 kişi daha girebilir (günde ~250 kişiye kadar). Ürün bitince sıradakiler beklemez: personel varsa özür diler, memnuniyet çok az düşer; yoksa kızgın giderler. Ürün bitince o kampanyaya yeni müşteri gelmez. Tecrübeli muhasebeci talep yüksekse personel tutar.
- Marketin ve dükkânların önündeki ağaçlar kaldırıldı (kampanya standları görünsün).
- **Yol kenarı reklam panoları:** 3 yeni yer (Sv.13, reklam panosundan sonra); her biri +%5 müşteri; fiyat $600 → $1.200 → $2.400 (kalan azaldıkça artar).

## Bitirme ve derece

Derece eşikleri ilk tam oynanış testinden sonra ayarlanabilir (`config.js` → `CITY.grades`).

## Teknik notlar

- Tek dosyalık sürüm 5 MB sınırına yaklaşacak. Şehir binaları için KayKit City Builder paketi (CC0) kullanılacak; dokular ortak olduğu için ek boyut küçük. Gerekirse tek dosyalık sürüm sadece "reklam/tanıtım" bölümünü içerir, tam oyun normal web sürümünde olur.
- Uzak bölgeler oyuncu yakında değilken sadeleştirilmiş çizilir; işletmeler arka planda sayısal olarak çalışır (her karede değil, saniyede bir).
- Kayıt dosyası sürümlenir (v3, v4…), eski kayıtlar taşınır.
