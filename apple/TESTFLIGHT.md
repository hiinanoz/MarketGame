# TestFlight'a yükleme (GitHub Actions)

Derleme ve yükleme GitHub'ın macOS sunucularında yapılır; Mac gerekmez. Bir kez şu adımlar:

1. **Uygulama kaydı** — App Store Connect → Uygulamalar → ➕ Yeni uygulama
   - Platform: iOS · Ad: Market Tycoon (ya da istediğin ad) · Dil: Türkçe
   - Paket kimliği (Bundle ID): `com.uyelikposya.markettycoon` (listede yoksa developer.apple.com → Identifiers → ➕ ile oluştur;
     orada **Game Center** ve **iCloud** yeteneklerini işaretle)
   - SKU: `markettycoon`
2. **API anahtarı** — App Store Connect → Kullanıcılar ve Erişim → Entegrasyonlar → App Store Connect API → Takım anahtarları → ➕
   - Erişim: **Admin** (dağıtım sertifikasını otomatik oluşturabilmesi için; App Manager bazen yetmiyor)
   - `.p8` dosyasını indir (bir kez indirilebilir), **Key ID** ve sayfanın üstündeki **Issuer ID**'yi not al
3. **Takım kimliği** — developer.apple.com → Membership → **Team ID** (10 karakter)
4. **GitHub gizli değişkenleri** — github.com/uyelikposya/MarketGame → Settings → Secrets and variables → Actions → New repository secret
   - `ASC_KEY_ID` — Key ID
   - `ASC_ISSUER_ID` — Issuer ID
   - `ASC_PRIVATE_KEY` — `.p8` dosyasının tüm içeriği (BEGIN/END satırları dahil)
   - `APPLE_TEAM_ID` — Team ID
5. **Sözleşmeler** — App Store Connect → İş: bekleyen sözleşme varsa hesap sahibi kabul etmeli (yoksa yükleme reddedilir).

## Yükleme

GitHub → Actions → **iOS** → Run workflow → `TestFlight'a yükle` işaretle → Run.
Ya da bir etiket: `git tag ios-v1.0.0 && git push --tags`.

Derleme numarası her çalıştırmada artar (`github.run_number`). Yükleme bitince 10–30 dakika içinde TestFlight'ta görünür;
iç test için App Store Connect → TestFlight → Dahili test grubu → kendini ekle → iPhone'daki TestFlight uygulamasından yükle.

## Sorun giderme

- *No profiles for 'com.uyelikposya.markettycoon'* → Bundle ID bu takımda kayıtlı değil (adım 1).
- *Missing app record* → App Store Connect'te uygulama kaydı yok (adım 1).
- *Cloud signing permission error* → API anahtarı Admin değil (adım 2).
- *The bundle version must be higher* → normalde olmaz; elle yüklenen bir derleme varsa Actions'ı bir kez daha çalıştır.
