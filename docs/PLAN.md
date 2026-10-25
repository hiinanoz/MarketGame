# Geliştirme planı

Alınan kararlar: **sipariş + kamyon** ile tedarik, **gece molası** (atlanabilir), **memnuniyet puanı** (kir, kuyruk, boş raf, hırsızlık puanı düşürür → daha az müşteri), **seviye + para** ile açılma (bir sonraki seviyenin alanları gri/kilitli görünür).

## Seviye sistemi
Ödeme yapıp çıkan her müşteri 1 XP. Eşikler `src/config.js` → `LEVELS`.

| Sv. | Toplam müşteri | Açılanlar | Durum |
|---|---|---|---|
| 1 | 0 | Domates, havuç, kasa, depo + sipariş, gün/saat | ✅ |
| 2 | 15 | Peynir, kasiyer, reyon kapasitesi 8→16 | ✅ |
| 3 | 40 | Taşıyıcı işçi, oyuncu taşıma 7 | ✅ |
| 4 | 80 | Marul, kirlenme + temizlikçi | ✅ |
| 5 | 130 | Soğan, taşıyıcı kapasitesi 6, reyon 16→24, taşıma 10 | ✅ |
| 6 | 200 | Depo 40 + otomatik sipariş, 2. taşıyıcı | ✅ |
| 7 | 280 | Patates, müdür (kasadaki paraları toplar) | ✅ |
| 8 | 380 | 2. salon, 2. giriş kapısı, taşıyıcı kapasitesi 8 | ✅ |
| 9 | 500 | Ekmek, 2. kasa + kasiyer, otopark, 2. temizlikçi | ✅ |
| 10 | 650 | 3. taşıyıcı, reklam görevlisi, hırsızlık + güvenlik | ✅ |
| 11 | 800 | But, taşıma 14 | ✅ |
| 12 | 1000 | Biftek, taşıyıcı kapasitesi 10, toptancıyı satın alma (alış fiyatları −%30) | ✅ |
| 13 | 1250 | Reklam panosu | ✅ |
| 14 | 1500 | 3. salon (ikinci domates reyonu), 3. kasa + kasiyer, otopark 2. aşama | ✅ |
| 15 | 1800 | İkinci peynir reyonu | ✅ |
| 16 | 2200 | Tedarik krizleri (günlük zam ya da kıtlık), ikinci marul reyonu | ✅ |
| 17 | 2600 | İkinci ekmek reyonu | ✅ |
| 18 | 3000 | Üretimhaneler: sera (sebzeler), mandıra (peynir) | ✅ |
| 19 | 3500 | Fırın (ekmek) | ✅ |
| 20 | 4000 | Kasap (but, biftek) | ✅ |

## Gün döngüsü
4 dk = 08:00–22:00. Yoğunluk: sabah düşük, 12–14 ve 17–20 tepe (`rushFactor`). 22:00'de kapı kapanır; raftaki müşteriler elindekiyle kasaya gider, eli boş olanlar çıkar (30 sn sonra kalanlar ödemeden gider). Gün özeti → gece molası (25 sn, raf doldurma/sipariş için) → "Gün N" ile sabah.

## Aşamalar
1. ✅ Seviye/XP, gün-saat, yoğunluk, kapanış, gün özeti, gece
2. ✅ Reyon kapasitesi (8/16/24), taşıyıcı kapasitesi (4/6/8/10), 2. kapı
3. ✅ Arka depo, paletler, sipariş paneli, toptancı kamyonu, otomatik sipariş
4. ✅ Kirlenme + temizlikçi (2 kişi), müdür, memnuniyet puanı (yıldız)
5. ✅ Araç trafiği + otopark (yaya müşteri sınırı 12; otopark 6 + 6 yer)
6. ✅ Reklam görevlisi (+%35), reklam panosu (Sv.13, +%25), hırsızlık + kapı güvenliği
7. ✅ Toptancı satın alma, tedarik krizleri, üretimhaneler (depo yanındaki bahçede), 3. salon

## Ek özellikler (2. tur)
- ✅ **Çalışan üniforması**: yeşil iş kıyafeti + sarı şapka + görev rozeti. Müşteriler 4 modelin 6 renk çeşidinden (24 görünüm) gelir, şövalyelerin yarısı miğfersiz.
- ✅ **Muhasebe odası** (salon 1 arka sağ köşe): Sipariş / Banka / Kampanya sekmeleri. Depodaki sipariş noktası buraya taşındı.
- ✅ **Banka**: kredi (limit = 500 + seviye × 800, günlük %4 faiz), mevduat (günlük %2 faiz). Faizler gün sonunda işlenir ve özette görünür.
- ✅ **Kampanya** (Sv.4+): bir gün önceden özel ürün (🍔 Burger, 🍯 Reçel, 🥫 Sos seti, 🍲 Hazır çorba) ve stok seçilir, hazırlık ücreti + stok ödenir. Kampanya günü: gece sonunda kapıda kuyruk, gün boyu 50–250 ek müşteri, yoğunluk ×1.4. Stand mağazanın önünde, ilk 24 kasa hazır, kalanı kamyonla depoya gelir. Stok yetmezse müşteriler mutsuz gider; gün sonunda kalan stok zarar yazılır.
- ✅ **Otopark** 4 aşama (6/12/18/24 yer, alan sola büyür) + **otopark görevlisi** (Sv.12): 12+ yerde görevli yoksa girişte tıkanma olur, memnuniyet düşer.
- ✅ Trafik ve otoparkta KayKit City Builder araba modelleri, kaldırımda sokak lambaları ve banklar.

## Ek özellikler (3. tur)
- ✅ Reyon ve kampanya standında düzenli sıra: sıranın başındaki alır, çıkan olunca arkadakiler ilerler. Kampanya standının önünde iple ayrılmış zikzak kuyruk (25 kişi). Sabır sadece reyon boşken azalır.
- ✅ Kampanya günü taşıyıcılar standı öncelikli ve birlikte doldurur (başka reyon çok boşalmadıkça).
- ✅ Ek mesai: gün sonunda "Ek mesai" seçilirse her çalışana 30–60 arası ödeme yapılır, çalışanlar gece çalışır; "Sabahı bekle" seçilirse ödeme yok.
- ✅ 2. kasiyer: her kasaya ikinci kasiyer (kasa 1: Sv.6, kasa 2: Sv.11, kasa 3: Sv.15), ödemeler iki kat hızlı.
- ✅ Banka paneli: butonlarda ödenecek tutar yazıyor (ör. "Elimdekini öde ($700)"), işlem sonrası kalan borç gösteriliyor, para göstergesi anında güncelleniyor, panel dokunurken yenilenmiyor.

## Sonraki fikirler
- Seviye 20 sonrası: 4. salon / ikinci şube, müşteri alışveriş listeleri (birden çok ürün)
- Ürün fiyatı/kâr marjı yükseltmeleri, işçi hız yükseltmeleri
- Günlük görevler, başarımlar
- Gerçek ses/müzik, parçacık efektleri
- Mobil mağaza paketi (Capacitor)
