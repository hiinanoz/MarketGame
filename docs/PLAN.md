# Geliştirme planı

Alınan kararlar: **sipariş + kamyon** ile tedarik, **gece molası** (atlanabilir), **memnuniyet puanı** (kir, kuyruk, boş raf, hırsızlık puanı düşürür → daha az müşteri), **seviye + para** ile açılma (bir sonraki seviyenin alanları gri/kilitli görünür).

## Seviye sistemi
Ödeme yapıp çıkan her müşteri 1 XP. Eşikler `src/config.js` → `LEVELS`.

| Sv. | Toplam müşteri | Açılanlar | Durum |
|---|---|---|---|
| 1 | 0 | Domates, havuç, kasa, depo + sipariş, gün/saat | ✅ |
| 2 | 15 | Peynir, kasiyer, reyon kapasitesi 8→16 | ✅ |
| 3 | 40 | Taşıyıcı işçi, oyuncu taşıma 7 | ✅ |
| 4 | 80 | Marul, kirlenme + temizlikçi | Marul ✅ · temizlik ⏳ |
| 5 | 130 | Soğan, taşıyıcı kapasitesi 6, reyon 16→24, taşıma 10 | ✅ |
| 6 | 200 | Depo 40 + otomatik sipariş, 2. taşıyıcı | ✅ |
| 7 | 280 | Patates, müdür (kasadaki paraları toplar) | Patates ✅ · müdür ⏳ |
| 8 | 380 | 2. salon, 2. giriş kapısı, taşıyıcı kapasitesi 8 | ✅ |
| 9 | 500 | Ekmek, 2. kasa + kasiyer, otopark | Ekmek/kasa ✅ · otopark ⏳ |
| 10 | 650 | 3. taşıyıcı, reklam görevlisi, hırsızlık + güvenlik | taşıyıcı ✅ · ⏳ |
| 11 | 800 | But, taşıma 14 | ✅ |
| 12 | 1000 | Biftek, taşıyıcı kapasitesi 10, toptancıyı satın alma | Biftek/kapasite ✅ · ⏳ |
| 14 | 1500 | 3. salon, 3. kasa, otopark 2. aşama | ⏳ |
| 16 | 2200 | Tedarik krizleri (gecikme, zam) | ⏳ |
| 18 | 3000 | Üretimhaneler: sera, mandıra, fırın | ⏳ |
| 20 | 4000 | Kasap/şarküteri üretimi, büyük genişleme | ⏳ |

## Gün döngüsü
4 dk = 08:00–22:00. Yoğunluk: sabah düşük, 12–14 ve 17–20 tepe (`rushFactor`). 22:00'de kapı kapanır; raftaki müşteriler elindekiyle kasaya gider, eli boş olanlar çıkar (30 sn sonra kalanlar ödemeden gider). Gün özeti → gece molası (25 sn, raf doldurma/sipariş için) → "Gün N" ile sabah.

## Aşamalar
1. ✅ Seviye/XP, gün-saat, yoğunluk, kapanış, gün özeti, gece
2. ✅ Reyon kapasitesi (8/16/24), taşıyıcı kapasitesi (4/6/8/10), 2. kapı
3. ✅ Arka depo, paletler, sipariş paneli, toptancı kamyonu, otomatik sipariş
4. ⏳ Kirlenme + temizlikçi, müdür, memnuniyet puanı
5. ⏳ Araç trafiği + otopark
6. ⏳ Reklam görevlisi, hırsızlık + güvenlik
7. ⏳ Toptancı satın alma, tedarik krizleri, üretimhaneler, 3. salon
