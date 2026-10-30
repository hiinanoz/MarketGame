# TestFlight'a yükleme (GitHub Actions)

Derleme ve yükleme GitHub'ın macOS sunucularında yapılır; Mac gerekmez. Bir kez şu adımlar:

1. **Uygulama kaydı** — App Store Connect → Uygulamalar → ➕ Yeni uygulama
   - Platform: iOS · Ad: Market Krallığı · Birincil dil: Türkçe (sonra English (U.S.) yerelleştirmesi ekle → ad: Corner Shop Empire)
   - Paket kimliği (Bundle ID): `com.othinks.cornershopempire` (listede yoksa developer.apple.com → Identifiers → ➕ ile oluştur;
     orada **Game Center** ve **iCloud** yeteneklerini işaretle)
   - SKU: `cornershopempire`
2. **API anahtarı** — App Store Connect → Kullanıcılar ve Erişim → Entegrasyonlar → App Store Connect API → Takım anahtarları → ➕
   - Erişim: **Admin** (dağıtım sertifikasını otomatik oluşturabilmesi için; App Manager bazen yetmiyor)
   - `.p8` dosyasını indir (bir kez indirilebilir), **Key ID** ve sayfanın üstündeki **Issuer ID**'yi not al
3. **Takım kimliği** — developer.apple.com → Membership → **Team ID** (10 karakter)
4. **GitHub gizli değişkenleri** — github.com/hiinanoz/MarketGame → Settings → Secrets and variables → Actions → New repository secret
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

## İmza

Xcode'un **bulut yönetimli** otomatik imzası kullanılır; sertifika ve profili Apple yönetir, hiçbir şey oluşturulup
iptal edilmez ("revoked" e-postası gelmez):

1. **Arşivle** — geçici (ad-hoc) imzayla: `CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="-" AD_HOC_CODE_SIGNING_ALLOWED=YES
   PROVISIONING_PROFILE_SPECIFIER="" DEVELOPMENT_TEAM=<takım>`. (Otomatik imza arşivde geliştirme profili ister, o da kayıtlı cihaz ister.)
2. **Dışa aktar + yükle** — `xcodebuild -exportArchive` ile `apple/ci/ExportOptions.plist` (`method=app-store-connect`,
   `destination=upload`, `signingStyle=automatic`) ve `-allowProvisioningUpdates` + API anahtarı bayrakları. Gerçek imza burada:
   bulut dağıtım sertifikası + otomatik App Store profili.

Durum kontrolü: Actions → **iOS TestFlight durumu** (derlemelerin işlenme durumu, test grupları, davetler; `apple/ci/asc_status.py`).

## Sorun giderme

- *No profiles for 'com.othinks.cornershopempire'* → Bundle ID bu takımda kayıtlı değil (adım 1).
- *Missing app record* → App Store Connect'te uygulama kaydı yok (adım 1).
- *Cloud signing permission error* → API anahtarı Admin değil (adım 2).
- *The bundle version must be higher* → normalde olmaz; elle yüklenen bir derleme varsa Actions'ı bir kez daha çalıştır.
