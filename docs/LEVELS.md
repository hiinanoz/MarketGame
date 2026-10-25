# Market Tycoon — 100 seviyelik oyun tasarımı

Hikâye: Kasabaya geliyorsun, bankadan kredi çekip küçük bir market alıyorsun. Marketi büyütüyor, tedarikçileri, santralleri ve arazileri satın alıyor, işletmeleri müdür ve muhasebecilere devrediyor, siyasete giriyor, kendi bankanı kuruyor ve sonunda **şehrin tamamını** satın alıyorsun. Son parsel alındığında oyun biter ve **bitirme süren** derecelendirilir.

## Perdeler

| Seviye | Perde | Harita bölgesi | Özet |
|---|---|---|---|
| 1–20 | Kasabanın marketi | Market | Kasabaya geliyorsun, bankadan kredi çekip küçük marketi satın alıyorsun. Market elle oynanır: taşı, diz, sat, büyüt. |
| 21–30 | Tedarik zinciri | Tedarik vadisi (kuzey) | Arka yolun kuzeyindeki tedarik vadisinde hâlihazırda çalışan (başkalarına ait) tedarikçileri satın alıp arkaya doğru büyütüyorsun. Müdür ve muhasebeci atayıp devrediyorsun. Ürünlerini rakip marketlere de satıyorsun. |
| 31–35 | Enerji | Enerji tepeleri (en kuzey) | Haritanın en kuzeyindeki tepelerde güneş ve rüzgâr santrallerini alıp büyütüyorsun. Kendi işletmelerinin elektrik gideri düşer, fazlası şebekeye satılır. |
| 36–50 | Arazi ve konut | Doğu mahalleleri | Doğudaki boş arazileri alıp ev, apartman ve site yapıyorsun. İnşaat şirketi, kira geliri, mahalle memnuniyeti. Enerji de büyümeye devam eder. |
| 51–65 | Siyaset | Şehir merkezi (batı) | Şehrin yönetimi işine karışır. Nüfuz kazanıyor, adayları fonluyor, seçimlere giriyor ve sonunda belediye başkanlığını alıp şehrin kurallarını sen koyuyorsun. |
| 66–80 | Finans | Şehir merkezi + liman (güney) | Kendi bankanı kurup kredi veriyor, rakip şirketleri ve zincirleri satın alıyorsun. Holding büyür. |
| 81–100 | Şehri satın almak | Tüm şehir | Kalan her bölgeyi parsel parsel satın alıyorsun. Son parsel alındığında oyun biter ve bitirme derecen hesaplanır. |

## Seviye tablosu

XP (itibar): Sv.1–20 arasında ödeme yapan her müşteri 1 XP (mevcut sistem). Sv.20'den sonra kaynak genişler (aşağıda *Açık sorular*). Eşikler Sv.20'den sonra her seviyede %7,5 artar.

### I. Perde — Kasabanın marketi (Sv.1–20)

| Sv. | Gereken XP | Açılanlar |
|---|---|---|
| 1 | 0 | Domates reyonu, kasa, depo + sipariş, gün/saat. **Başlangıç kredisiyle market alınır.** |
| 2 | 15 | Peynir, kasiyer, reyon kapasitesi 16 |
| 3 | 40 | Taşıyıcı işçi, oyuncu taşıma 7 |
| 4 | 80 | Marul, kirlenme + temizlikçi, kampanyalar |
| 5 | 130 | Soğan, taşıyıcı kapasitesi 6, reyon 24, taşıma 10 |
| 6 | 200 | Depo 40 + otomatik sipariş, 2. taşıyıcı, kasa 1'e 2. kasiyer |
| 7 | 280 | Patates, market müdürü (kırmızı şapka) |
| 8 | 380 | 2. salon, 2. kapı, taşıyıcı kapasitesi 8 |
| 9 | 500 | Ekmek, 2. kasa, otopark, 2. temizlikçi |
| 10 | 650 | Reklamcı, hırsızlık + güvenlik, 3. taşıyıcı |
| 11 | 800 | But, taşıma 14, kasa 2'ye 2. kasiyer |
| 12 | 1.000 | Biftek, toptancıyı satın alma (−%30), otopark görevlisi |
| 13 | 1.250 | Reklam panosu |
| 14 | 1.500 | 3. salon, 3. kasa, otopark 12 |
| 15 | 1.800 | 2. peynir reyonu, otopark 18, kasa 3'e 2. kasiyer |
| 16 | 2.200 | Tedarik krizleri, 2. marul reyonu |
| 17 | 2.600 | 2. ekmek reyonu |
| 18 | 3.000 | Sera + mandıra atölyesi (bahçe), otopark 24 |
| 19 | 3.500 | Fırın atölyesi |
| 20 | 4.000 | Kasap atölyesi — **marketin tamamı** |

### II. Perde — Tedarik zinciri (Sv.21–30)

| Sv. | Gereken XP | Açılanlar |
|---|---|---|
| 21 | 4.300 | **Holding tableti** (tüm işletmeler tek ekranda) + **market muhasebecisi** (mavi şapka): siparişleri ve kampanyaları kendisi yönetir, sen istersen müdahale edersin |
| 22 | 4.600 | **Tedarik vadisi açılır.** İlk tedarikçi: *Yeşil Vadi Çiftliği* (sebze) satın alınır |
| 23 | 4.950 | Çiftlik 2. modül (tarla sırası arkaya doğru eklenir), çiftlik işçileri |
| 24 | 5.350 | *Ak Süt Mandırası* satın alınır |
| 25 | 5.750 | **Tedarikçi müdürü** (kırmızı şapka): işletmeyi sen olmadan çalıştırır. **Tedarikçi muhasebecisi**: maaş, satış, stok kararları |
| 26 | 6.150 | *Altın Başak Fırını* satın alınır, mandıra 2. modül |
| 27 | 6.650 | **Rakip marketlere satış**: haritadaki 3 rakip markete günlük teslimat sözleşmeleri |
| 28 | 7.150 | *Kasaba Et Tesisi* satın alınır, çiftlik 3. modül |
| 29 | 7.650 | Kendi kamyon filosu + lojistik deposu (teslimat hızı, nakliye gideri yok) |
| 30 | 8.250 | Tüm tedarikçilerde 4. modül. **Elektrik faturaları** başlar (her işletmenin günlük gideri) |

### III. Perde — Enerji (Sv.31–35)

| Sv. | Gereken XP | Açılanlar |
|---|---|---|
| 31 | 8.850 | **Enerji tepeleri açılır.** *Güneşli Tepe Güneş Tarlası* (küçük) satın alınır |
| 32 | 9.550 | Güneş tarlası panel sıraları (arkaya doğru), enerji müdürü |
| 33 | 10.250 | *Rüzgârlı Sırt Rüzgâr Santrali* (2 türbin) satın alınır |
| 34 | 11.000 | Batarya deposu (gece de enerji), türbin ekleme |
| 35 | 11.850 | Enerji muhasebecisi: **şebekeye satış** sözleşmeleri, kendi işletmelerin bedava elektrik |

### IV. Perde — Arazi ve konut (Sv.36–50)

| Sv. | Gereken XP | Açılanlar |
|---|---|---|
| 36 | 12.700 | **Arazi ofisi**: doğudaki boş arsalar satın alınır |
| 37 | 13.700 | İlk müstakil evler: kira geliri |
| 38 | 14.700 | Kendi **inşaat şirketin** (inşaat süresi kısalır, maliyet düşer) |
| 39 | 15.800 | Apartman (4 kat, kat kat yükselir) |
| 40 | 17.000 | Mahalle altyapısı: yol, park, sokak lambası → **mahalle memnuniyeti** |
| 41 | 18.250 | *Akçay Barajı* hidroelektrik santrali satın alınır |
| 42 | 19.650 | Site / rezidans (havuzlu) |
| 43 | 21.100 | **2. market şuben** (doğu mahallesinde, müdür + muhasebeciyle açılır) |
| 44 | 22.700 | Emlak muhasebecisi: kira tahsilatı, boş daire yönetimi |
| 45 | 24.400 | Okul ve sağlık ocağı (mahalle memnuniyeti ↑, kiralar ↑) |
| 46 | 26.200 | Rüzgâr santrali deniz kıyısına genişler (açık deniz türbinleri) |
| 47 | 28.200 | Lüks villalar (tepe manzaralı) |
| 48 | 30.300 | Tedarikçilerde 5. modül (fabrika ölçeği) |
| 49 | 32.600 | 3. market şuben (kuzey vadide) |
| 50 | 35.000 | Mahalle tamamen senin: **Doğu Mahallesi** tapusu |

### V. Perde — Siyaset (Sv.51–65)

| Sv. | Gereken XP | Açılanlar |
|---|---|---|
| 51 | 37.650 | **Şehir merkezi açılır.** Nüfuz (etki) puanı: bağış, sponsorluk |
| 52 | 40.450 | Yerel gazete satın alınır (reklam + nüfuz) |
| 53 | 43.500 | Mahalle muhtarlığı seçimi: kendi adayını fonla |
| 54 | 46.750 | Belediye ihalelerine gir (yol yapımı, kamu binası inşaatı) |
| 55 | 50.300 | Meclis üyeliği seçimi |
| 56 | 54.050 | Spor kulübü sponsorluğu (şehir memnuniyeti) |
| 57 | 58.100 | Ulaşım ihalesi: otobüs hattı işletmesi |
| 58 | 62.450 | **Belediye başkanlığı seçim kampanyası** (fonla, miting, anket) |
| 59 | 67.150 | Seçim günü: kazanırsan başkanlık |
| 60 | 72.200 | **Belediye başkanısın**: vergi oranları, imar izinleri, yeni yollar |
| 61 | 77.600 | Şehir projesi: otogar |
| 62 | 83.400 | Şehir projesi: stadyum (etkinlik günleri = yoğunluk) |
| 63 | 89.650 | Doğalgaz santrali (kış talebi) |
| 64 | 96.400 | Sanayi bölgesi imarı |
| 65 | 103.600 | İkinci dönem seçimi (memnuniyet düşükse kaybedebilirsin) |

### VI. Perde — Finans (Sv.66–80)

| Sv. | Gereken XP | Açılanlar |
|---|---|---|
| 66 | 111.400 | **Yatırım şirketi**: rakip şirketlerin hissesini al |
| 67 | 119.750 | Rakip market zinciri *Ucuzcu*'yu satın al |
| 68 | 128.750 | Otel ve restoran zinciri |
| 69 | 138.400 | Liman açılır: ithalat/ihracat |
| 70 | 148.750 | **Kendi bankanı kur** (lisans): mevduat topla, kredi ver, faiz geliri |
| 71 | 159.900 | Banka şubeleri (her bölgeye) |
| 72 | 171.900 | Kredi kartı ve sigorta işi |
| 73 | 184.800 | Sanayi bölgesinde fabrikalar |
| 74 | 198.650 | Rakip enerji şirketini satın al |
| 75 | 213.550 | AVM (tüm markalar senin) |
| 76 | 229.600 | Havaalanı ihalesi |
| 77 | 246.800 | Holding halka arz (şirket değeri) |
| 78 | 265.300 | Liman genişletme, konteyner terminali |
| 79 | 285.200 | Kalan rakip bankayı satın al |
| 80 | 306.600 | **Finans merkezi**: şehrin tüm kredileri senin bankanda |

### VII. Perde — Şehri satın almak (Sv.81–100)

| Sv. | Gereken XP | Açılanlar |
|---|---|---|
| 81 | 329.600 | Bölge alımı: Eski Kasaba (tarihî çarşı) |
| 82 | 354.300 | Bölge alımı: Sahil şeridi |
| 83 | 380.900 | Bölge alımı: Sanayi bölgesi |
| 84 | 409.450 | Bölge alımı: Üniversite yerleşkesi |
| 85 | 440.150 | Mega proje: köprü |
| 86 | 473.150 | Bölge alımı: Kuzey köyleri |
| 87 | 508.650 | Bölge alımı: Göl kenarı |
| 88 | 546.800 | Mega proje: metro hattı |
| 89 | 587.800 | Bölge alımı: Hastane bölgesi |
| 90 | 631.900 | Bölge alımı: Tren garı ve lojistik |
| 91 | 679.300 | Bölge alımı: Kale tepesi |
| 92 | 730.250 | Mega proje: fuar ve kongre merkezi |
| 93 | 785.000 | Bölge alımı: Batı sırtları |
| 94 | 843.900 | Bölge alımı: Havaalanı |
| 95 | 907.200 | Bölge alımı: Merkez çarşı |
| 96 | 975.200 | Mega proje: kule (şehrin simgesi) |
| 97 | 1.048.350 | Bölge alımı: Son çiftlikler |
| 98 | 1.127.000 | Bölge alımı: Belediye binası |
| 99 | 1.211.500 | Son pazarlıklar: direnen 3 mülk sahibi |
| 100 | 1.302.400 | **Şehrin tamamı senin. Oyun biter**, bitirme derecesi hesaplanır |
