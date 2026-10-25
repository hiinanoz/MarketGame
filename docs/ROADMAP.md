# Yol haritası: Sv.21–100 (marketten şehre)

Seviye seviye içerik: [LEVELS.md](LEVELS.md). Bu belge **nasıl yapılacağını** ve **hangi sırayla** yapılacağını anlatır. Her sürümden sonra oynanabilir hâle getirilir, kritik kararlar sorulur.

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
| **S1** | 21–25 | Holding tableti, işletme çekirdeği, müdür/muhasebeci rolleri ve şapkalar, market muhasebecisi, kuzey harita genişlemesi, ulaşım, başlangıç hikâyesi, ilk tedarikçi (çiftlik) | Oynat + geri bildirim |
| **S2** | 26–30 | Mandıra, fırın, et tesisi; rakip marketlere satış; kamyon filosu; maaş ve elektrik giderleri | Ekonomi dengesi soruları |
| **S3** | 31–35 | Güneş, rüzgâr, batarya, şebekeye satış, enerji kadrosu | |
| **S4** | 36–50 | Arazi ofisi, evler, apartman, site, inşaat şirketi, mahalle memnuniyeti, 2.–3. market şubeleri, baraj | Konut oynanışı soruları |
| **S5** | 51–65 | Şehir merkezi, nüfuz, gazete, seçimler, başkanlık, şehir projeleri | Siyaset mekaniği soruları |
| **S6** | 66–80 | Yatırım şirketi, rakip zincirleri alma, liman, kendi banka, şubeler | |
| **S7** | 81–100 | Bölge bölge satın alma, mega projeler, final, derece ekranı | |

## Bitirme ve derece

Oyun, şehrin son parseli alındığında biter. Final ekranında: toplam gün, toplam oyun süresi, şirket değeri, en büyük işletme, istatistikler ve **derece** (S/A/B/C/D). Derece eşikleri ilk tam oynanış testinden sonra ayarlanır.

## Teknik notlar

- Tek dosyalık sürüm 5 MB sınırına yaklaşacak. Şehir binaları için KayKit City Builder paketi (CC0) kullanılacak; dokular ortak olduğu için ek boyut küçük. Gerekirse tek dosyalık sürüm sadece "reklam/tanıtım" bölümünü içerir, tam oyun normal web sürümünde olur.
- Uzak bölgeler oyuncu yakında değilken sadeleştirilmiş çizilir; işletmeler arka planda sayısal olarak çalışır (her karede değil, saniyede bir).
- Kayıt dosyası sürümlenir (v3, v4…), eski kayıtlar taşınır.
