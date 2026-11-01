import { t } from './i18n.js';

// CEO masası olay kartları. Metinler t() ile (8 dil); {biz} gibi yer tutucular vars'tan dolar.
// when(g): kart gelebilir mi · vars(g): yer tutucular ve hedef işletme · def: süre dolunca seçilen (temkinli) seçenek
// choices[].do(g, E, v): E = events.effects() → cash, influence, rating, biz, customers, later, chance
// followup: yalnızca başka bir kartın E.later(...) çağrısıyla gelir.

const owned = (g, kinds) => g.holding.owned.filter((b) => kinds.includes(b.def.kind));
const has = (kinds) => (g) => owned(g, kinds).length > 0;
const pick = (kinds) => (g) => {
  const list = owned(g, kinds);
  const b = list[Math.floor(Math.random() * list.length)];
  return b ? { biz: b.name, id: b.id } : {};
};
const FOOD = ['field', 'barn', 'hall', 'restaurant'];

export const CARDS = [
  {
    id: 'press_hygiene', emoji: '📰', weight: 2, when: has(FOOD), vars: pick(FOOD), def: 0,
    title: t('Gazete: "{biz} hijyen skandalıyla manşette!"'),
    text: t('Bir okur, ürünün içinde "şüpheli bir şey" bulduğunu iddia ediyor. Fotoğraf bulanık ama manşet net.'),
    choices: [
      { label: t('Basın açıklaması yap'), do: (g, E) => { E.influence(-2); E.customers(-5, 2); } },
      { label: t('Müfettişi çağır, kapıları aç'), do: (g, E, v) => { E.cash(-3000); E.influence(3); E.biz(v.id, 5, 3); } },
      { label: t('Haberi "ortadan kaldır"'), do: (g, E) => { E.cash(-6000); if (E.chance(0.5)) E.later('press_coverup', 2); else E.influence(2); } },
    ],
  },
  {
    id: 'press_coverup', emoji: '🗞️', followup: true, def: 0,
    title: t('Örtbas haberi sızdı!'),
    text: t('"Hijyen skandalını parayla kapattı" başlığı sosyal medyada dolaşıyor.'),
    choices: [
      { label: t('Özür dile'), do: (g, E) => { E.influence(-3); E.rating(-2); } },
      { label: t('Avukat ordusu tut'), do: (g, E) => { E.cash(-8000); E.influence(-1); } },
    ],
  },
  {
    id: 'rival_merger', emoji: '🤝', when: (g) => g.level >= 30, def: 3,
    title: t('Gizli görüşme: Ucuzcu Kardeşler birleşme teklif ediyor'),
    text: t('Bodrum katta, tek ampullü bir odada buluşuyorsunuz. "Kardeş kardeşe" diyorlar ama gözleri kasada.'),
    choices: [
      { label: t('Kabul et, peşin parayı al'), do: (g, E) => { E.cash(12000); E.customers(-5, 5); } },
      { label: t('Sert pazarlık'), do: (g, E) => (E.chance(0.6) ? (E.cash(20000), t('Masadan büyük çekle kalktın')) : t('Kardeşler kapıyı çarpıp gitti')) },
      { label: t('Görüşmeyi basına sızdır'), do: (g, E) => { E.influence(2); E.customers(4, 3); } },
      { label: t('Kibarca reddet'), do: () => '' },
    ],
  },
  {
    id: 'union_raise', emoji: '👷', weight: 2, when: has(['factory', 'port', 'mall', 'airport', 'hall', 'barn']), vars: pick(['factory', 'port', 'mall', 'airport', 'hall', 'barn']), def: 1,
    title: t('Sendika: {biz} çalışanları zam istiyor'),
    text: t('Çalışanlar ellerinde pankartlarla toplandı. Pankartlardan biri yanlış yazılmış ama mesaj anlaşılıyor.'),
    choices: [
      { label: t('Zammı ver'), do: (g, E, v) => { E.cash(-4000); E.biz(v.id, 10, 5); } },
      { label: t('Yarısını ver'), do: (g, E) => { E.cash(-2000); } },
      { label: t('Reddet'), do: (g, E, v) => (E.chance(0.5) ? (E.biz(v.id, -40, 2), t('Grev başladı!')) : t('Homurdanarak işe döndüler')) },
    ],
  },
  {
    id: 'zoning_tip', emoji: '🏛️', when: (g) => g.level >= 45, def: 1,
    title: t('Belediyeden kulis: imar planı değişebilir'),
    text: t('Belediyede çay ocağındaki biri, "arsalar değerlenecek" diye fısıldadı. Kaynağı güvenilir mi? Çay ocağı.'),
    choices: [
      { label: t('Lobi yap'), do: (g, E) => { E.cash(-5000); if (E.chance(0.65)) E.later('zoning_result', 2); } },
      { label: t('Bekle ve gör'), do: () => '' },
    ],
  },
  {
    id: 'zoning_result', emoji: '🗺️', followup: true, def: 0,
    title: t('İmar planı onaylandı!'),
    text: t('Lobi işe yaradı: arsaların değerlendi, bir yatırımcı hemen teklif verdi.'),
    choices: [
      { label: t('Teklifi kabul et'), do: (g, E) => { E.cash(16000); } },
      { label: t('Arsaları tut, kiraları artır'), do: (g, E) => { E.biz('all', 5, 7); } },
    ],
  },
  {
    id: 'whistle_acc', emoji: '🕵️', when: (g) => !!g.accountant, def: 1,
    title: t('Muhbir: muhasebecin kayıtlarla oynuyor olabilir'),
    text: t('Adını vermeyen bir mektup geldi. Mektup kokulu kâğıda yazılmış; bu da ayrıca şüpheli.'),
    choices: [
      { label: t('Denetim yaptır'), do: (g, E) => { E.cash(-2500); return E.chance(0.4) ? (E.cash(9000), t('Kayıp para bulundu!')) : t('Her şey temiz çıktı'); } },
      { label: t('Görmezden gel'), do: (g, E) => (E.chance(0.3) ? (E.cash(-6000), t('Kasada açık çıktı')) : '') },
    ],
  },
  {
    id: 'celebrity', emoji: '🎤', def: 1,
    title: t('Ünlü şarkıcı marketinde selfie çekti'),
    text: t('Fotoğrafta arkada senin peynir reyonun görünüyor. Peynir hiç bu kadar ünlü olmamıştı.'),
    choices: [
      { label: t('Sosyal medyada paylaş'), do: (g, E) => { E.customers(15, 2); } },
      { label: t('Teşekkür çiçeği gönder'), do: (g, E) => { E.cash(-500); E.rating(3); } },
    ],
  },
  {
    id: 'food_blogger', emoji: '📱', def: 2,
    title: t('Yemek blogcusu ürünlerini yerden yere vurdu'),
    text: t('"Domatesler fazla domates" diyor. Ne demek istediği anlaşılmadı ama 200 bin kişi beğendi.'),
    choices: [
      { label: t('Bedava ürün sepeti gönder'), do: (g, E) => { E.cash(-1500); E.customers(6, 3); } },
      { label: t('Esprili bir cevap yaz'), do: (g, E) => (E.chance(0.5) ? (E.customers(12, 2), t('Cevabın viral oldu!')) : (E.customers(-10, 2), t('Espri anlaşılmadı'))) },
      { label: t('Görmezden gel'), do: () => '' },
    ],
  },
  {
    id: 'power_cut', emoji: '⚡', when: has(['solar', 'wind', 'hydro']), def: 1,
    title: t('Komşu ilçede elektrik kesintisi'),
    text: t('İlçe karanlıkta. Senin santrallerin ise pırıl pırıl çalışıyor.'),
    choices: [
      { label: t('Fazla elektriği pahalıya sat'), do: (g, E) => { E.cash(7000); E.influence(-2); } },
      { label: t('Ücretsiz destek ver'), do: (g, E) => { E.influence(5); E.rating(2); } },
    ],
  },
  {
    id: 'storm', emoji: '🌧️', def: 0,
    title: t('Meteoroloji fırtına uyarısı verdi'),
    text: t('Rüzgâr tabelaları uçurabilir. Hatta tabeladaki "M" harfi zaten biraz gevşek.'),
    choices: [
      { label: t('Önlem al'), do: (g, E) => { E.cash(-2000); } },
      { label: t('Şansını dene'), do: (g, E) => (E.chance(0.45) ? (E.biz('all', -20, 1), E.customers(-15, 1), t('Fırtına hasar verdi')) : t('Fırtına teğet geçti')) },
    ],
  },
  {
    id: 'tax_audit', emoji: '🧾', def: 0,
    title: t('Vergi müfettişleri kapıda'),
    text: t('Üç müfettiş, üç ayrı renkte dosya. Biri sürekli hesap makinesine bakıp gülümsüyor.'),
    choices: [
      { label: t('Danışman tut'), do: (g, E) => { E.cash(-4000); } },
      { label: t('Defterleri olduğu gibi aç'), do: (g, E) => (E.chance(0.7) ? t('Her şey yolunda') : (E.cash(-10000), t('Ceza kesildi'))) },
    ],
  },
  {
    id: 'interview', emoji: '🎙️', def: 1,
    title: t('Ekonomi kanalı canlı yayına davet etti'),
    text: t('Konu: "Bakkaldan holdinge". Makyözün elinde fırça, sende heyecan.'),
    choices: [
      { label: t('Katıl, başarı hikâyeni anlat'), do: (g, E) => (E.chance(0.75) ? (E.influence(4), E.customers(6, 2), t('Çok iyi geçti')) : (E.influence(-2), t('Canlı yayında hapşırdın'))) },
      { label: t('Halkla ilişkiler müdürünü gönder'), do: (g, E) => { E.influence(1); } },
    ],
  },
  {
    id: 'truck_strike', emoji: '🚚', def: 1,
    title: t('Nakliyeciler greve çıktı'),
    text: t('Şehre mal girişi yavaşladı. Kamyoncular kahvede tavla oynuyor.'),
    choices: [
      { label: t('Kendi filonla taşı'), do: (g, E) => (g.holding.logisticsOwned ? (E.biz('logistics', 15, 3), E.customers(5, 2), t('Filon şehri kurtardı')) : (E.cash(-5000), t('Kiralık kamyon pahalıya patladı'))) },
      { label: t('Grevin bitmesini bekle'), do: (g, E) => { E.customers(-10, 1); } },
    ],
  },
  {
    id: 'hotel_vip', emoji: '🏨', when: has(['hotel']), def: 1,
    title: t('Otelinde gizlice bir bakan kalıyor'),
    text: t('Takma bıyık ve güneş gözlüğüyle "Ahmet Bey" olarak kayıt yaptırdı. Bıyık yamuk.'),
    choices: [
      { label: t('Kral dairesine ücretsiz yükselt'), do: (g, E) => { E.cash(-3000); E.influence(6); } },
      { label: t('Herkese yaptığın gibi davran'), do: (g, E) => { E.rating(1); } },
      { label: t('Gazeteye haber ver'), do: (g, E) => { E.cash(4000); E.influence(-5); } },
    ],
  },
  {
    id: 'critic', emoji: '🍽️', when: has(['restaurant']), vars: pick(['restaurant']), def: 1,
    title: t('Ünlü eleştirmen geliyor: {biz}'),
    text: t('Eleştirmen sadece tuzluğa bakarak puan verdiğiyle tanınıyor.'),
    choices: [
      { label: t('Özel menü hazırla'), do: (g, E, v) => { E.cash(-2000); return E.chance(0.7) ? (E.biz(v.id, 15, 4), t('Beş yıldız!')) : (E.biz(v.id, -10, 3), t('Tuzluk beğenilmedi')); } },
      { label: t('Normal servis'), do: () => '' },
    ],
  },
  {
    id: 'port_customs', emoji: '⚓', when: has(['port']), vars: pick(['port']), def: 1,
    title: t('Gümrükte konteynerlerin bekletiliyor'),
    text: t('Memur "evrakta bir virgül eksik" diyor. Virgülü sen de göremedin.'),
    choices: [
      { label: t('"Hızlandırma ücreti" öde'), do: (g, E) => { E.cash(-3000); if (E.chance(0.3)) E.later('bribe_exposed', 2); } },
      { label: t('Resmi yoldan bekle'), do: (g, E, v) => { E.biz(v.id, -20, 2); } },
    ],
  },
  {
    id: 'bribe_exposed', emoji: '📰', followup: true, def: 0,
    title: t('Manşet: "Holdingden gümrüğe rüşvet!"'),
    text: t('Gazeteciler ofisinin önünde. Biri mikrofonu neredeyse burnuna soktu.'),
    choices: [
      { label: t('Özür dile, bağış yap'), do: (g, E) => { E.cash(-4000); E.influence(-4); } },
      { label: t('Kesinlikle inkâr et'), do: (g, E) => (E.chance(0.5) ? t('Haber kısa sürede unutuldu') : (E.influence(-10), t('Kayıtlar ortaya çıktı!'))) },
    ],
  },
  {
    id: 'airport_slot', emoji: '✈️', when: has(['airport']), vars: pick(['airport']), def: 1,
    title: t('Yeni hava yolu şirketi kalkış saati istiyor'),
    text: t('Şirketin logosu bir martı. Martının bakışları biraz kararsız.'),
    choices: [
      { label: t('Ucuza ver, trafik artsın'), do: (g, E, v) => { E.biz(v.id, 12, 5); } },
      { label: t('Pahalıya sat'), do: (g, E) => { E.cash(9000); } },
    ],
  },
  {
    id: 'mall_festival', emoji: '🛍️', when: has(['mall']), def: 1,
    title: t('AVM\'de çocuk festivali önerisi'),
    text: t('Palyaço, sihirbaz ve dev bir şişme dinozor. Dinozor biraz sönük ama çocuklar sever.'),
    choices: [
      { label: t('Festivali düzenle'), do: (g, E) => { E.cash(-2500); E.customers(10, 3); } },
      { label: t('Bu sefer geç'), do: () => '' },
    ],
  },
  {
    id: 'drought', emoji: '🌾', when: has(['field']), vars: pick(['field']), def: 1,
    title: t('Kuraklık: {biz} verim kaybediyor'),
    text: t('Domatesler güneşte "biz de insanız" der gibi bakıyor.'),
    choices: [
      { label: t('Damla sulama kur'), do: (g, E, v) => { E.cash(-4000); E.biz(v.id, 10, 6); } },
      { label: t('Yağmur bekle'), do: (g, E, v) => { E.biz(v.id, -20, 3); } },
    ],
  },
  {
    id: 'cow_contest', emoji: '🐄', when: has(['barn']), def: 0,
    title: t('İneğin Sarıkız güzellik yarışmasını kazandı!'),
    text: t('Jüri özellikle kirpiklerinden etkilenmiş.'),
    choices: [
      { label: t('Reklam yüzü yap'), do: (g, E) => { E.customers(8, 3); } },
      { label: t('Ödülü bağışla'), do: (g, E) => { E.influence(2); } },
    ],
  },
  {
    id: 'secret_recipe', emoji: '🥖', when: has(['hall']), vars: pick(['hall']), def: 1,
    title: t('Ustan gizli tarifini satmak istiyor'),
    text: t('"Ekmeğin sırrı hamurda değil, sevgide" diyor. Ama sevginin fiyatı yüksek.'),
    choices: [
      { label: t('Tarifi satın al'), do: (g, E, v) => { E.cash(-3500); E.biz(v.id, 15, 7); } },
      { label: t('Reddet'), do: (g, E, v) => (E.chance(0.3) ? (E.biz(v.id, -10, 3), t('Usta küstü')) : '') },
    ],
  },
  {
    id: 'price_war', emoji: '🏪', when: has(['shop']), def: 1,
    title: t('Rakip, şubenin karşısına dev indirim tabelası astı'),
    text: t('Tabelada "HER ŞEY UCUZ" yazıyor. "Her şey" kısmı şüpheli.'),
    choices: [
      { label: t('Fiyat savaşına gir'), do: (g, E) => { E.cash(-3000); E.customers(8, 3); } },
      { label: t('Kaliteyi öne çıkar'), do: (g, E) => { E.rating(2); } },
    ],
  },
  {
    id: 'charity_gala', emoji: '🎩', def: 2,
    title: t('Hayır gecesine davetlisin'),
    text: t('Kıyafet kuralı: smokin. Senin smokinin en son mezuniyette giyilmişti.'),
    choices: [
      { label: t('Büyük bağış yap'), do: (g, E) => { E.cash(-6000); E.influence(6); } },
      { label: t('Küçük bağış yap'), do: (g, E) => { E.cash(-1500); E.influence(2); } },
      { label: t('Gitme'), do: () => '' },
    ],
  },
  {
    id: 'intern_app', emoji: '💡', def: 1,
    title: t('Stajyerin bir uygulama fikriyle geldi'),
    text: t('"Market ama uygulamada" diyor. Online sipariş sistemini fark etmemiş.'),
    choices: [
      { label: t('Bütçe ver, denesin'), do: (g, E) => { E.cash(-2000); return E.chance(0.5) ? (E.customers(12, 5), t('Uygulama tuttu!')) : t('Uygulama çöktü'); } },
      { label: t('Teşekkür et, yüreklendir'), do: (g, E) => { E.rating(1); } },
    ],
  },
  {
    id: 'viral_dance', emoji: '🎬', def: 0,
    title: t('Kasiyerinin dans videosu viral oldu'),
    text: t('Barkod okuyucuyla ritim tutuyor. 3 milyon izlenme.'),
    choices: [
      { label: t('Ödül ver'), do: (g, E) => { E.cash(-1000); E.rating(3); E.customers(10, 2); } },
      { label: t('Kurallara uymasını iste'), do: (g, E) => { E.rating(-2); } },
    ],
  },
  {
    id: 'old_partner', emoji: '📜', when: (g) => g.level >= 30, def: 0,
    title: t('Eski ortağın alacak davası açtı'),
    text: t('İlk bakkal günlerinden kalma bir peçeteye yazılmış "anlaşma" var elinde.'),
    choices: [
      { label: t('Uzlaş'), do: (g, E) => { E.cash(-5000); } },
      { label: t('Mahkemeye git'), do: (g, E) => (E.chance(0.5) ? (E.cash(3000), t('Davayı kazandın')) : (E.cash(-9000), t('Peçete geçerli sayıldı'))) },
    ],
  },
  {
    id: 'spy', emoji: '🕶️', def: 1,
    title: t('Rakip seni gözetletiyor olabilir'),
    text: t('Üç gündür aynı adam aynı bankta aynı gazeteyi okuyor. Gazete ters.'),
    choices: [
      { label: t('Karşı istihbarat'), do: (g, E) => { E.cash(-3000); E.biz('all', 5, 3); } },
      { label: t('Umursama'), do: (g, E) => (E.chance(0.35) ? (E.customers(-8, 3), t('Kampanya planın sızdı')) : '') },
    ],
  },
  {
    id: 'candidate_support', emoji: '🗳️', when: (g) => g.politics?.started && !g.politics.mayor, def: 1,
    title: t('Bir aday kulis desteği istiyor'),
    text: t('"Seçilirsem marketinin önüne kırmızı halı sereceğim" diyor. Halı rengi tartışmaya açık.'),
    choices: [
      { label: t('Destekle'), do: (g, E) => { E.cash(-4000); E.influence(4); } },
      { label: t('Tarafsız kal'), do: () => '' },
    ],
  },
  {
    id: 'bank_offer', emoji: '🏦', def: 1,
    title: t('Banka "kaçırılmaz" kredi kampanyası sunuyor'),
    text: t('Faiz düşük görünüyor. Küçük yazılar ise mikroskopla okunacak kadar küçük.'),
    choices: [
      { label: t('Krediyi al'), do: (g, E) => { E.cash(10000); E.later('loan_due', 5); } },
      { label: t('Teşekkürler, gerek yok'), do: () => '' },
    ],
  },
  {
    id: 'loan_due', emoji: '📮', followup: true, def: 0,
    title: t('Kredi taksiti geldi'),
    text: t('Küçük yazılar büyüdü: "%10 hizmet bedeli".'),
    choices: [
      { label: t('Öde'), do: (g, E) => { E.cash(-11000); } },
    ],
  },
  {
    id: 'green_award', emoji: '🌱', when: has(['solar', 'wind', 'hydro']), def: 0,
    title: t('Yeşil enerji ödülüne aday gösterildin'),
    text: t('Tören salonu güneş paneliyle ısıtılıyor. Biraz serin.'),
    choices: [
      { label: t('Başvur'), do: (g, E) => { E.cash(-1000); E.influence(3); } },
      { label: t('Kibarca çekil'), do: () => '' },
    ],
  },
  {
    id: 'lottery', emoji: '🎟️', def: 0,
    title: t('Çalışanların ortak piyango kazandı'),
    text: t('Yarısı "yarın gelmiyorum" diye bağırarak çıktı. Diğer yarısı bileti hâlâ arıyor.'),
    choices: [
      { label: t('Kalanlara prim ver'), do: (g, E) => { E.cash(-3000); E.biz('all', 5, 2); } },
      { label: t('Bırak gitsinler'), do: (g, E) => { E.biz('all', -10, 2); } },
    ],
  },
  {
    id: 'heatwave', emoji: '☀️', def: 1,
    title: t('Sıcak hava dalgası geliyor'),
    text: t('Termometre 41 derece. Dondurmalar kendi kendine erimeye karar verdi.'),
    choices: [
      { label: t('Kapıya soğuk içecek standı kur'), do: (g, E) => { E.cash(-1000); E.customers(10, 2); } },
      { label: t('Klimaları tamir ettir'), do: (g, E) => { E.cash(-2000); E.rating(2); } },
    ],
  },
  {
    id: 'mascot', emoji: '🦊', def: 1,
    title: t('Ajans holdinge maskot öneriyor'),
    text: t('Adı "Kasabacık Tilki". Kostüm biraz dar, içindeki stajyer nefes almakta zorlanıyor.'),
    choices: [
      { label: t('Maskotu onayla'), do: (g, E) => { E.cash(-2500); E.customers(7, 4); } },
      { label: t('Fikri arşive kaldır'), do: () => '' },
    ],
  },
];
