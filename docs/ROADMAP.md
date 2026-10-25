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
| **S2** | 26–30 | Mandıra, fırın, et tesisi; rakip marketlere satış; kamyon filosu; maaş ve elektrik giderleri | Ekonomi dengesi soruları |
| **S3** | 31–35 | Güneş, rüzgâr, batarya, şebekeye satış, enerji kadrosu | |
| **S4** | 36–50 | Arazi ofisi, evler, apartman, site, inşaat şirketi, mahalle memnuniyeti, 2.–3. market şubeleri, baraj | Konut oynanışı soruları |
| **S5** | 51–65 | Şehir merkezi, nüfuz, gazete, seçimler, başkanlık, şehir projeleri | Siyaset mekaniği soruları |
| **S6** | 66–80 | Yatırım şirketi, rakip zincirleri alma, liman, kendi banka, şubeler | |
| **S7** | 81–100 | Bölge bölge satın alma, mega projeler, final, derece ekranı | |

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

## Bitirme ve derece

Oyun, şehrin son parseli alındığında biter. Final ekranında: toplam gün, toplam oyun süresi, şirket değeri, en büyük işletme, istatistikler ve **derece** (S/A/B/C/D). Derece eşikleri ilk tam oynanış testinden sonra ayarlanır.

## Teknik notlar

- Tek dosyalık sürüm 5 MB sınırına yaklaşacak. Şehir binaları için KayKit City Builder paketi (CC0) kullanılacak; dokular ortak olduğu için ek boyut küçük. Gerekirse tek dosyalık sürüm sadece "reklam/tanıtım" bölümünü içerir, tam oyun normal web sürümünde olur.
- Uzak bölgeler oyuncu yakında değilken sadeleştirilmiş çizilir; işletmeler arka planda sayısal olarak çalışır (her karede değil, saniyede bir).
- Kayıt dosyası sürümlenir (v3, v4…), eski kayıtlar taşınır.
