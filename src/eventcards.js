import { t } from './i18n.js';

// CEO masası olay kartları. Metinler t() ile (8 dil); {biz} gibi yer tutucular vars'tan dolar.
// when(g): kart gelebilir mi · vars(g): yer tutucular ve hedef işletme · def: süre dolunca seçilen (temkinli) seçenek
// choices[].do(g, E, v): E = events.effects() → cash, influence, rating, biz, customers, later, chance, risk, fans, jail
// followup: yalnızca başka bir kartın E.later(...) çağrısıyla gelir.
// need: 'holding' (varsayılan, CEO masası) · 'politics' · 'club' · 'legal' — holding yoksa siyaset / kulüp panelinde cevaplanır.

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
      { label: t('Haberi "ortadan kaldır"'), do: (g, E) => { E.cash(-6000); E.risk(10); if (E.chance(0.5)) E.later('press_coverup', 2); else E.influence(2); } },
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
      { label: t('Lobi yap'), do: (g, E) => { E.cash(-5000); E.risk(6); if (E.chance(0.65)) E.later('zoning_result', 2); } },
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
      { label: t('"Hızlandırma ücreti" öde'), do: (g, E) => { E.cash(-3000); E.risk(12); if (E.chance(0.3)) E.later('bribe_exposed', 2); } },
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
      { label: t('Destekle'), do: (g, E) => { E.cash(-4000); E.influence(4); E.risk(4); } },
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
  // ---- Siyaset 2.0 (need: 'politics') ----
  {
    id: 'smear', emoji: '🗯️', need: 'politics', weight: 3, when: (g) => g.politics.campaignTime, vars: (g) => ({ name: g.politics.poll().mainName }), def: 3,
    title: t('{name} senin hakkında iftira kampanyası başlattı'),
    text: t('Afişlerde senin fotoğrafın ve "Marketçi mi, ahtapot mu?" sorusu var. Fotoğrafta gözlerin kapalı.'),
    choices: [
      { label: t('Kanıtlarla yalanla'), do: (g, E) => { E.cash(-2000); E.influence(1); } },
      { label: t('Dava aç'), do: (g, E) => { E.cash(-5000); return E.chance(0.55) ? (E.influence(5), t('Mahkeme iftirayı tescilledi')) : (E.influence(-2), t('Dava sürüncemede kaldı')); } },
      { label: t('Karşı karalama kampanyası'), do: (g, E) => { E.cash(-4000); E.influence(4); E.risk(12); } },
      { label: t('Sessiz kal'), do: (g, E) => { E.influence(-4); } },
    ],
  },
  {
    id: 'debate', emoji: '📺', need: 'politics', weight: 2, when: (g) => g.politics.campaignTime, vars: (g) => ({ name: g.politics.poll().mainName }), def: 2,
    title: t('Canlı yayında açık oturum: sen ve {name}'),
    text: t('Moderatör iki kürsü, bir bardak su ve tek bir mikrofon hazırlamış. Mikrofon cızırdıyor.'),
    choices: [
      { label: t('Danışmanla hazırlan'), do: (g, E) => { E.cash(-3000); return E.chance(0.7) ? (E.influence(6), t('Tartışmayı kazandın')) : (E.influence(1), t('Berabere')); } },
      { label: t('Doğaçlama konuş'), do: (g, E) => (E.chance(0.5) ? (E.influence(7), t('Esprilerin çok tuttu')) : (E.influence(-4), t('Rakamları karıştırdın'))) },
      { label: t('Katılma'), do: (g, E) => { E.influence(-3); } },
    ],
  },
  {
    id: 'shady_donor', emoji: '💼', need: 'politics', when: (g) => g.politics.campaignTime, def: 1,
    title: t('Kimliği belirsiz bağışçı çanta dolusu para getirdi'),
    text: t('Çantada para, yanında bir not: "Hatırımız kalsın." Not parfüm kokuyor.'),
    choices: [
      { label: t('Al, kampanyaya kullan'), do: (g, E) => { E.cash(15000); E.influence(3); E.risk(22); } },
      { label: t('Kibarca reddet'), do: () => '' },
      { label: t('Reddet ve basına anlat'), do: (g, E) => { E.influence(4); } },
    ],
  },
  {
    id: 'press_pressure', emoji: '🗞️', need: 'politics', def: 2,
    title: t('Muhalif gazete senin hakkında dizi hazırlıyor'),
    text: t('Dizinin adı "Kasanın Gölgesinde". İlk bölüm yarın, ikinci bölüm "kaynaklar konuşursa".'),
    choices: [
      { label: t('Reklamlarını kes, baskı yap'), do: (g, E) => { E.influence(2); E.risk(15); } },
      { label: t('Açık röportaj ver'), do: (g, E) => (E.chance(0.6) ? (E.influence(4), t('Samimiyetin beğenildi')) : (E.influence(-2), t('Röportaj aleyhine döndü'))) },
      { label: t('Görmezden gel'), do: (g, E) => { E.influence(-2); } },
    ],
  },
  {
    id: 'vote_buying', emoji: '🧺', need: 'politics', when: (g) => g.politics.campaignTime, def: 1,
    title: t('Mahalle temsilcisi "erzak karşılığı oy" öneriyor'),
    text: t('"Bir koli makarna, bir oy" diyor. Makarna markası senin marketin.'),
    choices: [
      { label: t('Kabul et'), do: (g, E) => { E.cash(-6000); E.influence(7); E.risk(25); } },
      { label: t('Reddet'), do: () => '' },
    ],
  },
  {
    id: 'rally_race', emoji: '📣', need: 'politics', when: (g) => g.politics.campaignTime, vars: (g) => ({ name: g.politics.poll().mainName }), def: 2,
    title: t('{name} aynı gün meydanda miting yapacak'),
    text: t('İki miting, bir meydan. Belediye zabıtası şimdiden kulaklık takmış.'),
    choices: [
      { label: t('Daha büyük miting'), do: (g, E) => { E.cash(-5000); E.influence(5); } },
      { label: t('Konserle birleştir'), do: (g, E) => { E.cash(-9000); E.influence(8); E.customers(5, 1); } },
      { label: t('Meydanı ona bırak'), do: (g, E) => { E.influence(-2); } },
    ],
  },
  {
    id: 'mayor_tender', emoji: '🏗️', need: 'politics', when: (g) => g.isMayor, def: 1,
    title: t('Belediye ihalesi: eski bir dostun firması da teklif verdi'),
    text: t('Dostun "çocukluk arkadaşıyız" diyor. Çocukluğunuzu pek hatırlamıyorsun.'),
    choices: [
      { label: t('İhaleyi dostuna ver'), do: (g, E) => { E.cash(12000); E.risk(20); } },
      { label: t('Açık ihale yap'), do: (g, E) => { E.influence(3); } },
    ],
  },
  {
    id: 'potholes', emoji: '🕳️', need: 'politics', when: (g) => g.isMayor, def: 1,
    title: t('Halk çukurlu yollardan şikâyetçi'),
    text: t('Bir çukura ördekler yerleşmiş. Ördekler memnun, sürücüler değil.'),
    choices: [
      { label: t('Yolları yaptır'), do: (g, E) => { E.cash(-8000); E.influence(5); } },
      { label: t('Sonraya bırak'), do: (g, E) => { E.influence(-3); } },
      { label: t('Ördekleri turistik alan ilan et'), do: (g, E) => (E.chance(0.5) ? (E.influence(4), t('Ördekler fenomen oldu')) : (E.influence(-4), t('Kimse gülmedi'))) },
    ],
  },
  {
    id: 'protest', emoji: '✊', need: 'politics', when: (g) => g.politics.autocracy, def: 0,
    title: t('Meydanda protesto var'),
    text: t('Pankartlarda "Kral değil, indirim istiyoruz!" yazıyor. Talep makul.'),
    choices: [
      { label: t('Dinle, reform sözü ver'), do: (g, E) => { E.cash(-10000); E.influence(4); } },
      { label: t('Meydanı kapattır'), do: (g, E) => { E.influence(-3); E.risk(15); } },
      { label: t('İndirim günü ilan et'), do: (g, E) => { E.cash(-5000); E.customers(20, 1); E.influence(2); } },
    ],
  },
  // ---- Hukuk (takip kartları) ----
  {
    id: 'probe', emoji: '⚖️', need: 'legal', followup: true, def: 2,
    title: t('Savcılık senin hakkında soruşturma başlattı'),
    text: t('Dosya kalın. Kapağında senin fotoğrafın var, en kötü açıdan.'),
    choices: [
      { label: t('En iyi avukatı tut'), do: (g, E) => { E.cash(-8000); if (E.chance(Math.max(0.2, 1 - g.legal.risk / 110))) { g.legal.probe = false; E.risk(-20); return t('Soruşturma düştü'); } E.later('trial', 2); return t('Dava açıldı'); } },
      { label: t('İşbirliği yap, cezayı öde'), do: (g, E) => { E.cash(-15000); E.influence(-5); E.risk(-35); g.legal.probe = false; } },
      { label: t('Bekle'), do: (g, E) => { E.later('trial', 2); return t('Dava açıldı'); } },
    ],
  },
  {
    id: 'trial', emoji: '👨‍⚖️', need: 'legal', followup: true, def: 0,
    title: t('Dava günü'),
    text: t('Hâkim gözlüğünü indirdi. Bu genelde iyiye işaret değil.'),
    choices: [
      { label: t('Avukatına güven'), do: (g, E) => { E.cash(-5000); g.legal.probe = false; if (E.chance(Math.max(0.15, 1 - g.legal.risk / 100))) { E.risk(-25); return t('Beraat ettin!'); } E.jail(); return ''; } },
      { label: t('Uzlaş: yüklü ceza öde'), do: (g, E) => { E.cash(-25000); E.influence(-6); E.risk(-40); g.legal.probe = false; } },
      { label: t('Savunmanı kendin yap'), do: (g, E) => { g.legal.probe = false; if (E.chance(0.35)) { E.influence(5); E.risk(-25); return t('Salon alkışladı, beraat!'); } E.jail(); return ''; } },
    ],
  },
  // ---- Spor kulübü (need: 'club') ----
  {
    id: 'club_election', emoji: '🗳️', need: 'club', followup: true, def: 1,
    title: t('Kulüp başkanlığı seçimi'),
    text: t('Genel kurulda sandık kuruldu. Sandık aslında eski bir buzdolabı.'),
    choices: [
      { label: t('Aday ol (kampanya)'), do: (g, E) => { E.cash(-15000); return g.club.runForPresident(0.1) ? t('Kulüp başkanı oldun!') : t('Seçimi kaybettin'); } },
      { label: t('Mevcut başkanı destekle'), do: (g, E) => { E.fans(2); } },
    ],
  },
  {
    id: 'club_noconfidence', emoji: '📉', need: 'club', followup: true, def: 2,
    title: t('Taraftar istifa istiyor'),
    text: t('Tribünde dev pankart: "Başkan, marketine dön!" Pankartın sponsoru da senin marketin.'),
    choices: [
      { label: t('İstifa et'), do: (g, E) => { g.club.role = 'board'; E.influence(-2); } },
      { label: t('Büyük transfer sözü ver'), do: (g, E) => { E.cash(-25000); g.club.strength = Math.min(90, g.club.strength + 6); E.fans(6); } },
      { label: t('Görmezden gel'), do: (g, E) => { E.fans(-10); if (E.chance(0.4)) { g.club.role = 'board'; return t('Genel kurul seni düşürdü'); } return ''; } },
    ],
  },
  {
    id: 'club_star', emoji: '🌙', need: 'club', when: (g) => g.club.rank > 0, def: 1,
    title: t('Yıldız oyuncu gece kulübünde görüntülendi'),
    text: t('Saat 03.00, dans pistinde. Ertesi gün derbi var. Dans figürleri ise fena değil.'),
    choices: [
      { label: t('Ceza kes'), do: (g, E) => { E.fans(-1); g.club.strength += 1; } },
      { label: t('Görmezden gel'), do: (g, E) => (E.chance(0.5) ? (g.club.strength -= 3, t('Maçta uyudu')) : t('Maçta iki gol attı!')) },
    ],
  },
  {
    id: 'club_fixing', emoji: '🎲', need: 'club', when: (g) => g.club.rank > 0, def: 1,
    title: t('Rakip kulüp "maç alışverişi" teklif ediyor'),
    text: t('"Bu hafta siz kazanın, gelecek hafta biz" diyorlar. Futbolun ruhu biraz üzgün.'),
    choices: [
      { label: t('Kabul et'), do: (g, E) => { E.cash(10000); E.risk(25); } },
      { label: t('Reddet'), do: () => '' },
      { label: t('Federasyona bildir'), do: (g, E) => { E.influence(3); E.fans(4); } },
    ],
  },
  {
    id: 'club_derby', emoji: '🔥', need: 'club', def: 2,
    title: t('Derbi öncesi taraftarlar gergin'),
    text: t('İki taraftar grubu aynı çay ocağında. Çaycı istifa etmeyi düşünüyor.'),
    choices: [
      { label: t('Güvenliği artır'), do: (g, E) => { E.cash(-3000); E.fans(1); } },
      { label: t('Bilet fiyatını düşür'), do: (g, E) => { E.cash(-5000); E.fans(4); E.customers(5, 1); } },
      { label: t('Bir şey yapma'), do: (g, E) => (E.chance(0.4) ? (E.customers(-5, 1), t('Maç sonrası arbede çıktı')) : '') },
    ],
  },
  {
    id: 'club_youth', emoji: '🌟', need: 'club', def: 1,
    title: t('Altyapıdan bir yetenek parlıyor'),
    text: t('16 yaşında, topla dans ediyor. Annesi her antrenmana börek getiriyor.'),
    choices: [
      { label: t('Altyapıya yatırım yap'), do: (g, E) => { E.cash(-6000); g.club.strength = Math.min(90, g.club.strength + 2); E.fans(2); } },
      { label: t('Büyük kulübe sat'), do: (g, E) => { E.cash(9000); E.fans(-3); } },
    ],
  },
];
