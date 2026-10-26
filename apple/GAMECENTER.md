# Game Center kurulumu (App Store Connect)

App Store Connect → Uygulama → **Game Center** sekmesinde aşağıdaki kimliklerle tanımla. Kimlikler kodla aynı olmalı
(`src/achievements.js`, `src/platform.js`). Puan değerleri toplamı 1000'i geçemez; aşağıdakiler toplam 25 × 40 = 1000.

## Başarımlar (25)

| Kimlik (Achievement ID) | Ad | Puan |
| --- | --- | --- |
| `mt.ach.first_shelf` | 🥕 İlk reyon | 40 |
| `mt.ach.first_cashier` | 💳 Kasiyer işe alındı | 40 |
| `mt.ach.level5` | ⭐ Mahallenin marketi (Sv.5) | 40 |
| `mt.ach.first_campaign` | 📢 İlk kampanya | 40 |
| `mt.ach.second_room` | 🏗️ Genişleme | 40 |
| `mt.ach.five_stars` | 🌟 Beş yıldız | 40 |
| `mt.ach.market_owner` | 🏪 Bina artık senin | 40 |
| `mt.ach.accountant` | 🧾 Muhasebeci | 40 |
| `mt.ach.first_supplier` | 🌾 İlk tedarikçi | 40 |
| `mt.ach.logistics` | 🚛 Kendi filon | 40 |
| `mt.ach.first_plant` | ☀️ Enerji üreticisi | 40 |
| `mt.ach.free_power` | ⚡ Bedava elektrik | 40 |
| `mt.ach.first_house` | 🏠 İlk ev | 40 |
| `mt.ach.landlord` | 🏘️ Ev sahibi | 40 |
| `mt.ach.deed` | 📜 Mahallenin tapusu | 40 |
| `mt.ach.branch` | 🛍️ İlk şube | 40 |
| `mt.ach.media` | 📰 Medya patronu | 40 |
| `mt.ach.staff100` | 👥 100 çalışan | 40 |
| `mt.ach.mayor` | 🏛️ Belediye başkanı | 40 |
| `mt.ach.king` | 👑 Otokrat | 40 |
| `mt.ach.takeover` | 📈 Şirket avcısı | 40 |
| `mt.ach.own_bank` | 🏦 Kendi bankan | 40 |
| `mt.ach.ipo` | 🔔 Halka arz | 40 |
| `mt.ach.bargain` | 🤝 Pazarlıkçı | 40 |
| `mt.ach.ruler` | 🏆 Kasabanın Hakimi | 40 |

Her başarım için: "Gizli" = hayır (yalnızca `mt.ach.ruler` ve `mt.ach.bargain` gizli olabilir), 512×512 görsel, TR + EN açıklama.

## Liderlik tabloları

| Kimlik (Leaderboard ID) | Ad | Sıralama | Biçim |
| --- | --- | --- | --- |
| `mt.lb.company_value` | Şirket değeri | Yüksek iyi | Para (USD), en iyi skor |
| `mt.lb.customers` | Toplam müşteri | Yüksek iyi | Tam sayı, en iyi skor |
| `mt.lb.fastest_ruler` | Kasabanın Hakimi — en az gün | Düşük iyi | Tam sayı, en iyi skor |

Liderlik tablolarından Apple otomatik olarak arkadaşlar arası "challenge" üretir (iOS 26 Oyunlar uygulaması).
