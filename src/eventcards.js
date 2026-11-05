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
const formatK = (n) => (n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`);

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
      { label: t('Kabul et, peşin parayı al'), do: (g, E) => { E.cash(12000); E.customers(-5, 5); E.rel('rival', 10); } },
      { label: t('Sert pazarlık'), do: (g, E) => (E.chance(0.6) ? (E.cash(20000), t('Masadan büyük çekle kalktın')) : t('Kardeşler kapıyı çarpıp gitti')) },
      { label: t('Görüşmeyi basına sızdır'), do: (g, E) => { E.influence(2); E.customers(4, 3); E.rel('rival', -20); E.rel('editor', 4); } },
      { label: t('Kibarca reddet'), do: () => '' },
    ],
  },
  {
    id: 'union_raise', emoji: '👷', weight: 2, when: has(['factory', 'port', 'mall', 'airport', 'hall', 'barn']), vars: pick(['factory', 'port', 'mall', 'airport', 'hall', 'barn']), def: 1,
    title: t('Sendika: {biz} çalışanları zam istiyor'),
    text: t('Çalışanlar ellerinde pankartlarla toplandı. Pankartlardan biri yanlış yazılmış ama mesaj anlaşılıyor.'),
    choices: [
      { label: t('Zammı ver'), do: (g, E, v) => { E.cash(-4000); E.biz(v.id, 10, 5); E.rel('union', 6); } },
      { label: t('Yarısını ver'), do: (g, E) => { E.cash(-2000); } },
      { label: t('Reddet'), do: (g, E, v) => { E.rel('union', -8); return E.relChance('union', 0.5) ? t('Homurdanarak işe döndüler') : (E.biz(v.id, -40, 2), t('Grev başladı!')); } },
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
      { label: t('Krediyi al'), do: (g, E) => { E.cash(10000); E.rel('banker', 2); E.later('loan_due', 5); } },
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
    id: 'probe', emoji: '⚖️', need: 'legal', followup: true, def: 2, mandatory: true, kind: 'meeting', place: 'court', window: [9, 17],
    title: t('Savcılık senin hakkında soruşturma başlattı'),
    text: t('Dosya kalın. Kapağında senin fotoğrafın var, en kötü açıdan.'),
    choices: [
      { label: t('En iyi avukatı tut'), do: (g, E) => { E.cash(-8000); if (E.chance(Math.max(0.2, 1 - g.legal.risk / 110))) { g.legal.probe = false; E.risk(-20); return t('Soruşturma düştü'); } E.later('trial', 2); return t('Dava açıldı'); } },
      { label: t('İşbirliği yap, cezayı öde'), do: (g, E) => { E.cash(-15000); E.influence(-5); E.risk(-35); g.legal.probe = false; } },
      { label: t('Bekle'), do: (g, E) => { E.later('trial', 2); return t('Dava açıldı'); } },
    ],
  },
  {
    id: 'trial', emoji: '👨‍⚖️', need: 'legal', followup: true, def: 0, mandatory: true, kind: 'event', window: [10, 16], place: 'court',
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
  // ---- 1.2 Şehir modu: Sv.40–50 ajanda maddeleri (PLAN-1.2 C4 #1–#10) ----
  {
    id: 'charity_dinner', emoji: '🍽️', kind: 'event', place: 'culture', window: [18, 22], minLevel: 40, weight: 2,
    title: t('Esnaf hayır yemeği'),
    text: t('Esnaf derneği yaşlılar evi için yemek veriyor. Sonunda müzayede var; masanda belediyeden biri ve kulüp başkanı oturacak.'),
    skip: (g, E) => { E.influence(-1); },
    steps: {
      start: {
        choices: [
          { label: t('Masaya otur'), hours: 2, goto: 'auction', do: () => '' },
          { label: t('Gitme, bağış gönder'), do: (g, E) => { E.cash(-3000); E.influence(2); } },
        ],
      },
      auction: {
        text: t('Tatlılar geldi, müzayede başladı. Sunucu mikrofona üfleyip "Birinci lot!" diyor.'),
        choices: [
          { label: t('Yaşlılar evine bağış ($5K)'), do: (g, E) => { E.cash(-5000); E.influence(4); E.happy(2); if (g.news) g.news.lastCharity = g.day.day; } },
          { label: t('Ünlü futbolcunun formasına teklif ($12K)'), do: (g, E) => (E.relChance('club', 0.55) ? (E.cash(-12000), E.customers(5, 5), E.fans(3), E.rel('club', 5), t('Forma senin: marketin vitrininde')) : (E.rel('club', 2), t('Forma rakip patrona gitti'))) },
          { label: t('Sadece yemeğin tadını çıkar'), do: (g, E) => { E.influence(1); } },
        ],
      },
    },
  },
  {
    id: 'club_match_visit', emoji: '⚽', kind: 'match', place: 'stadium', window: [18, 22], minLevel: 40, weight: 2, when: (g) => g.club?.unlocked,
    title: t('Kasaba Spor maçı'),
    text: t('Akşam maç var. Tribün coşkulu, locada ikram, saha kenarında kameralar.'),
    steps: {
      start: {
        choices: [
          { label: t('Tribünden izle'), hours: 2, do: (g, E) => { E.fans(3); E.influence(1); } },
          { label: t('Locadan izle ($2K)'), hours: 2, goto: 'box', do: (g, E) => { E.cash(-2000); E.rel('club', 8); } },
          { label: t('Saha kenarı (sponsorsan)'), hours: 2, when: (g) => g.club?.sponsor, do: (g, E) => { E.influence(3); E.fans(2); return t('Maç sonu basına konuştun'); } },
        ],
      },
      box: {
        text: t('Devre arasında kulüp yöneticileri yanına oturdu: "Kulübün size ihtiyacı var."'),
        choices: [
          { label: t('Forma sponsoru ol'), when: (g) => !g.club?.sponsor, do: (g) => { g.club.sponsor = true; return t('Formada artık senin logon var'); } },
          { label: t('Altyapıya $20K'), do: (g, E) => { E.cash(-20000); E.fans(3); E.later('youth_talent', 6); } },
          { label: t('Stadyum tabelası ($8K)'), do: (g, E) => { E.cash(-8000); E.customers(10, 4); } },
          { label: t('Nazikçe reddet'), do: (g, E) => { E.rel('club', -5); } },
        ],
      },
    },
  },
  {
    id: 'youth_talent', emoji: '🌟', followup: true, mandatory: true, def: 0, need: 'holding',
    title: t('Altyapıdan yetenek çıktı'),
    text: t('Altyapıya yaptığın yatırım meyvesini verdi: 17 yaşında bir golcü herkesin ağzında.'),
    choices: [
      { label: t('Takımda tut'), do: (g, E) => { g.club.strength = Math.min(90, g.club.strength + 5); E.fans(4); } },
      { label: t('Büyük kulübe sat'), do: (g, E) => { E.cash(15000); E.fans(-5); } },
    ],
  },
  {
    id: 'banker_lunch', emoji: '🏦', kind: 'meeting', place: 'bank', window: [12, 15], minLevel: 40,
    title: t('Banka müdürüyle öğle yemeği'),
    text: t('Nermin Hanım seni öğle yemeğine davet etti. Masada iki çatal, bir de dosya var.'),
    skip: (g, E) => { E.rel('banker', -2); },
    choices: [
      { label: t('Özel kredi iste'), hours: 1, do: (g, E) => {
        E.rel('banker', 3);
        if (!E.relChance('banker', 0.5)) return t('"Şimdilik olmaz" dedi');
        const n = 20000 * E.scale;
        g.bank.debt += n;
        g.money += n;
        return t('${n} limit dışı kredi', { n: formatK(n) });
      } },
      { label: t('Mevduat yatır'), hours: 1, do: (g, E) => { const n = Math.round(g.money * 0.2); g.money -= n; g.bank.deposit += n; E.rel('banker', 10); return t('${n} mevduata', { n: formatK(n) }); } },
      { label: t('Sadece sohbet et'), hours: 1, do: (g, E) => { E.rel('banker', 3); } },
    ],
  },
  {
    id: 'union_meeting', emoji: '👷', kind: 'meeting', window: [10, 17], minLevel: 40, place: 'biz', when: has(['factory', 'port', 'mall', 'airport', 'hall', 'barn']), vars: pick(['factory', 'port', 'mall', 'airport', 'hall', 'barn']),
    title: t('Sendika toplantısı: {biz}'),
    text: t('Rıza Usta masaya bir dosya koydu: "Arkadaşlar yorgun, maaşlar yetmiyor."'),
    skip: (g, E, v) => { if (E.chance(0.3)) { E.biz(v.id, -40, 2); return t('Grev başladı!'); } return ''; },
    choices: [
      { label: t('%8 zam ver'), hours: 1, do: (g, E, v) => { E.cash(-4000); E.biz(v.id, 10, 7); E.rel('union', 10); } },
      { label: t('Prim sistemi öner'), hours: 1, do: (g, E, v) => { E.cash(-2000); E.biz(v.id, 5, 5); E.rel('union', 3); } },
      { label: t('Reddet'), hours: 1, do: (g, E, v) => (E.relChance('union', 0.5) ? (E.rel('union', -10), t('Homurdanarak işe döndüler')) : (E.biz(v.id, -40, 2), E.rel('union', -5), t('Grev başladı!'))) },
    ],
  },
  {
    id: 'rival_secret', emoji: '🕯️', kind: 'meeting', place: 'inn', window: [20, 22], minLevel: 40,
    title: t('Ucuzcu Kardeşler gizli görüşme istiyor'),
    text: t('Tarihi handa, mum ışığında. Kardeşlerin büyüğü "bölgeyi paylaşalım" diyor, küçüğü telefonla oynuyor.'),
    choices: [
      { label: t('Bölge paylaşımı (fiyat anlaşması)'), hours: 1, do: (g, E) => { E.customers(8, 5); E.risk(15); E.rel('rival', 10); } },
      { label: t('Ortak tedarik anlaşması'), hours: 1, do: (g, E) => { E.biz('all', 5, 5); E.rel('rival', 10); } },
      { label: t('Görüşmeyi kaydet, basına ver'), hours: 1, do: (g, E) => { E.influence(3); E.rel('rival', -30); E.rel('editor', 5); } },
    ],
  },
  {
    id: 'award_ceremony', emoji: '🏆', kind: 'event', place: 'culture', window: [19, 22], minLevel: 40,
    title: t('"Yılın Girişimcisi" ödül töreni'),
    text: t('Adın finalistler arasında. Kürsüde bir mikrofon, bir de çok yavaş açılan zarf var.'),
    skip: () => t('Ödül başkasına gitti'),
    choices: [
      { label: t('Katıl, konuşma yap'), hours: 2, do: (g, E) => { E.influence(5); E.rel('editor', 5); return t('Olumlu haber çıktı'); } },
      { label: t('Ödülü çalışanlara ithaf et'), hours: 2, do: (g, E) => { E.influence(3); E.biz('all', 5, 3); } },
    ],
  },
  {
    id: 'tender_next', emoji: '📑', minLevel: 40, place: 'townhall', when: (g) => g.holding.businesses.some((b) => !b.owned && !b.seized && b.def.level <= g.level + 6) && !g.holding.nextDiscount,
    title: t('Satılık işletme için erken teklif fırsatı'),
    text: t('Belediyedeki tanıdığın, bir sonraki satılık işletmenin ihalesinden önce teklif verebileceğini söylüyor.'),
    choices: [
      { label: t('Erken teklif ver (dosya ücreti)'), do: (g, E) => { E.cash(-2000); g.holding.nextDiscount = 0.15; E.rel('mayor', 3); return t('Sıradaki işletme alımında −%15'); } },
      { label: t('Bekle'), do: () => '' },
    ],
  },
  {
    id: 'school_visit', emoji: '🏫', kind: 'event', place: 'school', window: [9, 13], minLevel: 40,
    title: t('Okul ziyareti daveti'),
    text: t('Müdire Hanım, öğrencilerin "patronla tanışmak" istediğini yazmış. Bir çocuk şimdiden soru listesi hazırlamış.'),
    choices: [
      { label: t('Kütüphaneye kitap ($3K)'), hours: 1, do: (g, E) => { E.cash(-3000); E.happy(2); E.influence(3); if (g.news) g.news.lastCharity = g.day.day; } },
      { label: t('Girişimcilik dersi ver'), hours: 1, do: (g, E) => { E.influence(2); return E.chance(0.4) ? (E.customers(5, 3), t('Bir çocuğun sorusu viral oldu')) : ''; } },
    ],
  },
  {
    id: 'truckers_cafe', emoji: '🚚', kind: 'event', place: 'depot', window: [8, 12], minLevel: 40, when: (g) => g.holding.logisticsOwned,
    title: t('Kamyon şoförleri kahvesi'),
    text: t('Şoförler sabah çayında toplanmış; yolların, molaların ve kahvenin acılığının konuşulduğu yer.'),
    choices: [
      { label: t('Çay ısmarla, dinle'), hours: 1, do: (g, E) => { E.cash(-300); E.biz('logistics', 10, 5); E.rel('union', 3); } },
      { label: t('Yeni mola odası ($6K)'), hours: 1, do: (g, E) => { E.cash(-6000); E.biz('logistics', 5, 30); E.rel('union', 6); } },
    ],
  },
  // ---- 1.2-c Haberler (sekreterin uyarısı) ----
  {
    id: 'news_warn', emoji: '📰', followup: true, kind: 'meeting', window: [8, 22], def: 0, need: 'holding',
    title: t('Olumsuz haber geliyor: "{headline}"'),
    text: t('Sekreterin aradı: {outlet} {when} bu haberi yayınlayacak. Plazadan açıklama yapabilir ya da yayın binasına gidip konuşabilirsin.'),
    choices: [
      { label: t('Görmezden gel'), anywhere: true, do: () => t('Haber yayınlanacak') },
      { label: t('Basın açıklaması yaz'), anywhere: true, do: (g, E, v) => g.news.pressRelease(v.nid, E) },
      { label: t('Rica et'), do: (g, E, v) => g.news.deal(v.nid, 'ask', E) },
      { label: t('Reklam anlaşması öner'), do: (g, E, v) => g.news.deal(v.nid, 'ads', E) },
      { label: t('Rüşvet ver'), when: (g) => !g.news.journalist, do: (g, E, v) => g.news.deal(v.nid, 'bribe', E) },
      { label: t('Olay çıkar'), do: (g, E, v) => g.news.deal(v.nid, 'scene', E) },
      { label: t('Kendi gazetende göm'), hideIfNot: true, when: (g, v) => v.venue === 'gazette' && g.holding.mediaOwned, do: (g, E, v) => g.news.deal(v.nid, 'own', E) },
    ],
  },
  {
    id: 'journalist', emoji: '🕵️', followup: true, mandatory: true, def: 1, need: 'holding',
    title: t('Araştırmacı gazeteci peşinde'),
    text: t('Üç haberin parayla durdurulduğunu fark eden genç bir gazeteci dosya hazırlıyor. Rüşvet teklifini kaydetmekle tehdit ediyor.'),
    choices: [
      { label: t('Açık ol, röportaj ver'), do: (g, E) => { E.influence(-2); E.risk(-10); g.news.journalist = false; g.news.bribes = 0; } },
      { label: t('Görmezden gel'), do: (g, E) => { E.influence(-6); E.rel('editor', -10); g.news.journalist = false; g.news.bribes = 0; return t('Dosya yayınlandı'); } },
    ],
  },
  {
    id: 'bribe_scandal', emoji: '💸', followup: true, mandatory: true, def: 0, need: 'holding',
    title: t('Manşet: "Patron gazeteye rüşvet verdi!"'),
    text: t('Bir muhabir zarfın fotoğrafını çekmiş. Zarfın üstünde holdingin logosu var.'),
    choices: [
      { label: t('Özür dile'), do: (g, E) => { E.influence(-4); E.rel('editor', 3); } },
      { label: t('Kesinlikle inkâr et'), do: (g, E) => (E.chance(0.4) ? t('Haber kısa sürede unutuldu') : (E.influence(-10), E.risk(10), t('Kayıtlar ortaya çıktı!'))) },
    ],
  },
  // ---- 1.2-c Sv.51–65 (PLAN-1.2 C4 #11–#20) ----
  {
    id: 'council_session', emoji: '🏛️', kind: 'event', place: 'townhall', window: [10, 16], minLevel: 51, need: 'politics',
    title: t('Belediye meclisi oturumu'),
    text: t('Gündemde park, otopark ve vergi var. Galeride gazeteciler, sıralarda esnaf.'),
    choices: [
      { label: t('Halktan yana konuş'), hours: 2, do: (g, E) => { E.influence(4); if (!g.isMayor) E.rel('mayor', -5); } },
      { label: t('Başkanla anlaş'), hours: 2, when: (g) => !g.isMayor, do: (g, E) => { E.rel('mayor', 10); E.influence(-1); } },
      { label: t('Kendi imar projeni sun'), hours: 2, do: (g, E) => (g.isMayor || E.relChance('mayor', 0.45) ? (E.cash(8000), E.influence(1), t('Projen onaylandı: arsaların değerlendi')) : (E.influence(-1), t('Proje komisyona gönderildi'))) },
    ],
  },
  {
    id: 'election_rally', emoji: '📣', kind: 'event', place: 'townhall', window: [17, 22], minLevel: 51, need: 'politics', weight: 2, when: (g) => g.politics.campaignTime,
    title: t('Belediye meydanında seçim mitingi'),
    text: t('Meydana kürsü kuruldu. Kalabalık, çay ocağı ve bir davul ekibi hazır.'),
    skip: (g, E) => { E.influence(-2); return t('Rakip meydanı aldı'); },
    choices: [
      { label: t('İcraatını anlat'), hours: 3, do: (g, E) => { E.influence(5); } },
      { label: t('Konser + miting ($9K)'), hours: 3, do: (g, E) => { E.cash(-9000); E.influence(8); } },
      { label: t('Rakibe yüklen'), hours: 3, do: (g, E) => { E.influence(6); E.rel('rival', -15); E.risk(5); } },
    ],
  },
  {
    id: 'tv_debate', emoji: '📺', kind: 'event', place: 'tv', window: [18, 22], minLevel: 51, need: 'politics', weight: 2, when: (g) => g.politics.campaignTime, vars: (g) => ({ name: g.politics.poll().mainName }),
    title: t('Manşet TV açık oturum: sen ve {name}'),
    text: t('Stüdyo ışıkları yandı. Moderatör kartlarını düzeltiyor; {name} kravatını.'),
    skip: (g, E) => { E.influence(-3); return t('"Kaçtı" dediler'); },
    steps: {
      start: { choices: [{ label: t('Stüdyoya geç'), hours: 2, goto: 'q1', do: () => '' }] },
      q1: {
        text: t('1. soru: "Market fiyatları neden bu kadar yüksek?"'),
        choices: [
          { label: t('İcraat: indirim günlerini anlat'), goto: 'q2', do: (g, E) => { E.influence(2); } },
          { label: t('Vaat: fiyatlar düşecek'), goto: 'q2', do: (g, E) => { E.influence(E.chance(0.5) ? 3 : -1); } },
          { label: t('Saldırı: rakibin zammı'), goto: 'q2', do: (g, E) => { E.influence(E.chance(0.5) ? 4 : -2); } },
        ],
      },
      q2: {
        text: t('2. soru: "Şehirde iş bulmak neden zor?"'),
        choices: [
          { label: t('İcraat: istihdam rakamlarını anlat'), goto: 'q3', do: (g, E) => { E.influence(g.totalStaff >= 100 ? 4 : 1); } },
          { label: t('Vaat: yeni fabrika'), goto: 'q3', do: (g, E) => { E.influence(E.chance(0.55) ? 3 : -1); } },
          { label: t('Saldırı: rakip hiç iş vermedi'), goto: 'q3', do: (g, E) => { E.influence(E.chance(0.45) ? 4 : -3); } },
        ],
      },
      q3: {
        text: t('Son soru: "Seçilirsen şehir için ilk ne yapacaksın?"'),
        choices: [
          { label: t('Park ve oyun alanları'), do: (g, E) => { E.influence(3); E.happy(1); } },
          { label: t('Vergileri düşürmek'), do: (g, E) => { E.influence(4); } },
          { label: t('"Kendimi" diye espri yap'), do: (g, E) => (E.chance(0.5) ? (E.influence(5), t('Stüdyo kahkahaya boğuldu')) : (E.influence(-4), t('Espri anlaşılmadı'))) },
        ],
      },
    },
  },
  {
    id: 'neighborhood_breakfast', emoji: '🥯', kind: 'event', place: 'culture', window: [8, 11], minLevel: 51, need: 'politics',
    title: t('Mahalle derneği kahvaltısı'),
    text: t('Uzun masalar, simitler, çay. Mahallenin dertleri de masada.'),
    choices: [
      { label: t('Masaları sen öde ($4K)'), hours: 2, do: (g, E) => { E.cash(-4000); E.influence(5); E.happy(2); g.news.lastCharity = g.day.day; } },
      { label: t('Katıl, dinle'), hours: 2, do: (g, E) => { E.influence(2); E.later('neighborhood_wish', 1); return t('Mahalle bir istekte bulundu'); } },
    ],
  },
  {
    id: 'neighborhood_wish', emoji: '🛝', followup: true, need: 'politics', def: 1,
    title: t('Mahallenin isteği: çocuk oyun alanı'),
    text: t('Kahvaltıdaki teyzeler parka oyun alanı istiyor. Biri planı peçeteye çizmiş.'),
    skip: (g, E) => { E.later('broken_promise', 15); return t('Söz verdin sayıldı'); },
    choices: [
      { label: t('Oyun alanını yaptır ($15K)'), do: (g, E) => { E.cash(-15000); E.influence(6); E.happy(3); g.news.lastCharity = g.day.day; } },
      { label: t('Söz ver (sonra bakarız)'), do: (g, E) => { E.later('broken_promise', 15); } },
    ],
  },
  {
    id: 'broken_promise', emoji: '😠', followup: true, mandatory: true, def: 0, need: 'politics',
    title: t('Tutulmayan söz gündemde'),
    text: t('Teyzeler peçeteyi çerçeveletip belediyeye asmış: "Oyun alanı nerede?"'),
    choices: [
      { label: t('Özür dile'), do: (g, E) => { E.influence(-6); } },
      { label: t('Hemen yaptır ($20K)'), do: (g, E) => { E.cash(-20000); E.influence(2); E.happy(2); } },
    ],
  },
  // ---- 1.2-d Sv.66–80: ekonominin patronu (PLAN-1.2 C4 #21–#30) ----
  {
    id: 'hotel_gala', emoji: '🎭', kind: 'event', place: 'hotel', window: [19, 22], minLevel: 66, weight: 2,
    title: t('Hayır galası ve müzayede'),
    text: t('Grand Anadolu\'nun balo salonu ışıl ışıl. Rakip patronlar da davetli; müzayedede üç lot var.'),
    skip: (g, E) => { E.influence(-1); },
    steps: {
      start: { choices: [{ label: t('Salona gir'), hours: 3, goto: 'lot1', do: () => '' }] },
      lot1: {
        text: t('1. lot: yerel bir ressamın "Kasaba Sabahı" tablosu. Açılış $20K.'),
        choices: [
          { label: t('Teklif ver ($20K+)'), goto: 'lot2', do: (g, E) => (E.relChance('rival', 0.6) ? (E.cash(-22000), E.influence(4), t('Tablo senin')) : t('Ucuzcu Kardeşler son anda kaptı')) },
          { label: t('Bu lotu geç'), goto: 'lot2', do: () => '' },
        ],
      },
      lot2: {
        text: t('2. lot: "Başkanla bir akşam yemeği". Salonda kıkırdamalar.'),
        choices: [
          { label: t('Teklif ver ($15K)'), goto: 'lot3', do: (g, E) => { E.cash(-15000); E.rel('mayor', 20); } },
          { label: t('Bu lotu geç'), goto: 'lot3', do: () => '' },
        ],
      },
      lot3: {
        text: t('Son lot: Kasaba Stadyumu\'nun isim hakkı (5 sezon). Salon sessiz.'),
        choices: [
          { label: t('Stadyuma adını ver ($40K)'), do: (g, E) => { E.cash(-40000); E.fans(10); E.customers(5, 30); g.news.lastCharity = g.day.day; } },
          { label: t('Hiçbir şey alma'), do: (g, E) => { E.influence(1); } },
        ],
      },
    },
  },
  {
    id: 'investor_dinner', emoji: '🥂', kind: 'meeting', place: 'hotel', window: [19, 22], minLevel: 66,
    title: t('Yatırımcı yemeği: Mr. Kaplan'),
    text: t('Mr. Kaplan menüye bakmadan "en pahalısı" dedi. Sonra bir kartvizit uzattı.'),
    skip: (g, E) => { E.rel('investor', -5); },
    choices: [
      { label: t('%10 hisse sat'), hours: 2, do: (g, E) => { E.cash(60000); E.rel('investor', 8); return g.finance?.ipo ? t('📈 hisse +%5') : ''; } },
      { label: t('Ortak liman projesi'), hours: 2, when: (g) => g.holding.get('port')?.owned, do: (g, E) => { E.biz('port', 20, 10); E.rel('investor', 10); } },
      { label: t('Nazikçe geç'), hours: 2, do: (g, E) => { E.rel('investor', -5); } },
    ],
  },
  {
    id: 'ipo_gong', emoji: '🔔', kind: 'event', place: 'exchange', window: [9, 11], minLevel: 66, when: (g) => g.finance?.ipo,
    title: t('Borsada gong töreni'),
    text: t('Holdingin hisseleri bir yaşında. Borsa seni gongu çalmaya çağırdı.'),
    skip: () => t('📈 hisse −%2'),
    choices: [
      { label: t('Gongu çal, konuşma yap'), hours: 1, do: (g, E) => { E.influence(2); E.rel('investor', 5); return t('📈 hisse +%8'); } },
      { label: t('Genel müdürü gönder'), anywhere: true, do: () => t('📈 hisse +%3') },
    ],
  },
  {
    id: 'port_union', emoji: '⚓', kind: 'meeting', place: 'port', window: [10, 16], minLevel: 69, when: (g) => g.holding.get('port')?.owned,
    title: t('Liman işçileri grev uyarısı'),
    text: t('Vinç operatörleri vardiya istiyor. Rıza Usta limana bizzat gelmiş.'),
    skip: (g, E) => (E.chance(0.5) ? (E.biz('port', -60, 3), t('Grev başladı!')) : ''),
    choices: [
      { label: t('Uzlaş'), hours: 1, do: (g, E) => { E.cash(-8000); E.rel('union', 8); } },
      { label: t('Geçici işçi getir'), hours: 1, do: (g, E) => { E.risk(10); E.rel('union', -15); return t('Olumsuz haber çıktı'); } },
      { label: t('Bekle, grevi göze al'), hours: 1, do: (g, E) => (E.chance(0.5) ? (E.biz('port', -60, 3), t('Grev başladı!')) : t('Homurdanarak işe döndüler')) },
    ],
  },
  {
    id: 'celeb_wedding', emoji: '💍', minLevel: 68, when: (g) => g.holding.get('hotel')?.owned,
    title: t('Otelde ünlü düğünü'),
    text: t('Ünlü bir şarkıcı otelinde evlenmek istiyor. Menajeri "salonu bedava verirseniz çok konuşulur" diyor.'),
    choices: [
      { label: t('Salonu ücretsiz ver'), do: (g, E) => { E.biz('hotel', 25, 5); E.influence(2); return t('Olumlu haber çıktı'); } },
      { label: t('Tam fiyat iste'), do: (g, E) => { E.cash(15000); } },
    ],
  },
  {
    id: 'foreign_chain', emoji: '🛬', kind: 'meeting', place: 'airport', window: [12, 18], minLevel: 76,
    title: t('Havalimanı VIP: yabancı zincir şehre giriyor'),
    text: t('Dev bir market zincirinin temsilcileri VIP salonda. "Ya ortak oluruz ya rakip" diyorlar.'),
    skip: (g, E) => { E.customers(-8, 20); return t('Rakip zincir şehre girdi'); },
    choices: [
      { label: t('Ortaklık kur'), hours: 1, do: (g, E) => { E.cash(30000); E.customers(-5, 10); E.rel('investor', 5); } },
      { label: t('Arsayı sen kap ($50K)'), hours: 1, do: (g, E) => { E.cash(-50000); E.influence(2); return t('Zincirin yeri kalmadı'); } },
      { label: t('Belediyeye lobi yap'), hours: 1, do: (g, E) => { E.risk(10); return E.relChance('mayor', 0.5) ? t('Ruhsat çıkmadı, zincir geri döndü') : (E.customers(-8, 20), t('Rakip zincir şehre girdi')); } },
    ],
  },
  {
    id: 'econ_summit', emoji: '📊', kind: 'event', place: 'hotel', window: [10, 13], minLevel: 66,
    title: t('Ekonomi zirvesi paneli'),
    text: t('Panelde üç konuşmacı var; biri sensin. Salonda bakan yardımcısı ve yatırımcılar.'),
    choices: [
      { label: t('"Yerel üretim" konuşması'), hours: 2, do: (g, E) => { E.influence(4); E.biz('farm', 5, 7); E.biz('dairy', 5, 7); } },
      { label: t('"Büyüme" konuşması'), hours: 2, do: (g, E) => { E.rel('investor', 6); return t('📈 hisse +%4'); } },
      { label: t('Kuliste iş bağla'), hours: 2, do: (g, E) => { E.later('summit_deal', 2); return t('Bir yatırım teklifi gelecek'); } },
    ],
  },
  {
    id: 'summit_deal', emoji: '🤝', followup: true, def: 1,
    title: t('Zirveden yatırım teklifi'),
    text: t('Zirvede tanıştığın fon, holdinge sermaye koymak istiyor. Şartları masada.'),
    choices: [
      { label: t('Kabul et'), do: (g, E) => { E.cash(40000); E.rel('investor', 10); } },
      { label: t('Şimdilik reddet'), do: () => '' },
    ],
  },
  {
    id: 'critic_kitchen', emoji: '👨‍🍳', kind: 'event', place: 'restaurant', window: [19, 22], minLevel: 68, when: (g) => g.holding.get('restaurant')?.owned,
    title: t('Restoranda ünlü eleştirmen'),
    text: t('Eleştirmen pencere kenarında, defteri açık. Şef ellerini önlüğüne siliyor.'),
    choices: [
      { label: t('Mutfağa gir, şefle özel menü'), hours: 1, do: (g, E) => (E.chance(0.6) ? (E.influence(3), E.biz('restaurant', 15, 5), t('Beş yıldız!')) : (E.biz('restaurant', -10, 3), t('Tuzluk beğenilmedi'))) },
      { label: t('Masasına git, ikram et'), hours: 1, do: (g, E) => { E.risk(5); return E.chance(0.5) ? (E.influence(2), t('Çok iyi geçti')) : t('"Rüşvet mi bu?" dedi'); } },
    ],
  },
  {
    id: 'factory_drill', emoji: '🦺', minLevel: 73, when: (g) => g.holding.get('factory')?.owned,
    title: t('Fabrikada güvenlik tatbikatı'),
    text: t('İş güvenliği uzmanı raporunu bıraktı: "Yangın merdiveni var ama nerede olduğunu kimse bilmiyor."'),
    choices: [
      { label: t('Güvenlik yatırımı ($25K)'), do: (g, E) => { E.cash(-25000); E.rel('union', 5); } },
      { label: t('Ertele'), do: (g, E) => { if (E.chance(0.15)) E.later('factory_accident', 3); } },
    ],
  },
  {
    id: 'factory_accident', emoji: '🚑', followup: true, mandatory: true, def: 0,
    title: t('Fabrikada iş kazası'),
    text: t('Bir işçi hafif yaralandı. Gazeteciler kapıda, sendika toplantıda.'),
    choices: [
      { label: t('Tazminat öde, sorumluluk al'), do: (g, E) => { E.cash(-30000); E.influence(-2); E.rel('union', 5); } },
      { label: t('Olayı örtbas et'), do: (g, E) => { E.risk(20); E.rel('union', -15); return E.chance(0.4) ? (E.influence(-8), t('Örtbas haberi sızdı!')) : ''; } },
    ],
  },
  {
    id: 'bank_merger', emoji: '🏦', kind: 'meeting', place: 'bank', window: [10, 16], minLevel: 70, when: (g) => !!g.finance?.bank,
    title: t('Şehir Bankası birleşme teklif ediyor'),
    text: t('Nermin Hanım iki dosya getirdi: biri birleşme protokolü, diğeri "hayır derseniz" senaryosu.'),
    choices: [
      { label: t('Birleş'), hours: 2, do: (g, E) => { E.cash(50000); E.rel('banker', 20); } },
      { label: t('Bağımsız kal'), hours: 1, do: (g, E) => { E.rel('banker', -5); E.influence(1); } },
    ],
  },
  // ---- 1.2-d Sv.81–100: şehrin sahibi (#31–#35) ----
  {
    id: 'city_summit', emoji: '🌆', kind: 'event', place: 'fair', window: [10, 16], minLevel: 81,
    title: t('Şehir Zirvesi: büyük projeler'),
    text: t('Fuar alanında şehrin geleceği masada. Üç maket, üç fiyat etiketi.'),
    choices: [
      { label: t('Metro hattı ($300K)'), hours: 3, do: (g, E) => { E.cash(-300000); E.happy(10); E.customers(10, 60); } },
      { label: t('Teknopark ($200K)'), hours: 3, do: (g, E) => { E.cash(-200000); E.biz('all', 5, 60); E.rel('investor', 10); } },
      { label: t('Sahil yolu ($150K)'), hours: 3, do: (g, E) => { E.cash(-150000); E.biz('hotel', 15, 60); E.biz('restaurant', 15, 60); E.happy(4); } },
    ],
  },
  {
    id: 'national_doc', emoji: '🎥', minLevel: 82,
    title: t('Ulusal TV belgesel çekmek istiyor'),
    text: t('"Bakkaldan şehrin sahibine" adlı bir belgesel. Yönetmen ilk sahneyi marketinde çekmek istiyor.'),
    choices: [
      { label: t('Çocukluğunu, bakkal günlerini anlat'), do: (g, E) => { E.influence(8); E.happy(2); } },
      { label: t('Holdingi tanıt'), do: (g, E) => { E.rel('investor', 8); return t('📈 hisse +%5'); } },
      { label: t('Reddet'), do: () => '' },
    ],
  },
  {
    id: 'heir_question', emoji: '👑', minLevel: 95, def: 0, mandatory: true,
    title: t('Holdingi kime bırakacaksın?'),
    text: t('Avukatın vasiyet taslağını getirdi. Sekreter kapının arkasından dinliyor.'),
    choices: [
      { label: t('Genel müdüre (kurumsal devam)'), do: (g) => { g.legacy = 'corporate'; return t('Holding kurumsal olarak devam edecek'); } },
      { label: t('Bir vakfa (şehre bağış)'), do: (g, E) => { g.legacy = 'foundation'; E.influence(10); E.happy(5); } },
      { label: t('Satış (nakit)'), do: (g, E) => { g.legacy = 'sale'; E.cash(100000); } },
    ],
  },
  // ---- 1.2-d çeşitlilik: tekrar etmesin diye ek maddeler ----
  {
    id: 'charity_marathon', emoji: '🏃', kind: 'event', place: 'culture', window: [8, 11], minLevel: 40,
    title: t('Hayır koşusu'),
    text: t('Şehir çocuk hastanesi için koşuyor. Başlangıç çizgisinde senin adının yazılı olduğu boş bir forma var.'),
    choices: [
      { label: t('Koş!'), hours: 2, do: (g, E) => { E.influence(3); E.happy(1); g.news.lastCharity = g.day.day; return E.chance(0.3) ? t('Sondan ikinci oldun ama çok alkışlandın') : ''; } },
      { label: t('Sponsor ol ($5K)'), anywhere: true, do: (g, E) => { E.cash(-5000); E.influence(3); g.news.lastCharity = g.day.day; } },
    ],
  },
  {
    id: 'blood_drive', emoji: '🩸', kind: 'event', place: 'culture', window: [10, 16], minLevel: 40,
    title: t('Kan bağışı kampanyası'),
    text: t('Kızılay çadırı Kültür Merkezi\'nin önünde. Hemşire "patron örnek olsun" diyor.'),
    choices: [
      { label: t('Kan ver, çalışanlarını da çağır'), hours: 1, do: (g, E) => { E.influence(3); E.happy(2); E.biz('all', -3, 1); g.news.lastCharity = g.day.day; } },
      { label: t('Kurabiye ve meyve suyu gönder'), anywhere: true, do: (g, E) => { E.cash(-800); E.influence(1); } },
    ],
  },
  {
    id: 'teacher_request', emoji: '🧑‍🏫', minLevel: 40,
    title: t('Öğretmenler laboratuvar istiyor'),
    text: t('İlkokulun fen laboratuvarında tek mikroskop var, o da 1987 model.'),
    choices: [
      { label: t('Laboratuvarı donat ($8K)'), do: (g, E) => { E.cash(-8000); E.happy(3); E.influence(3); g.news.lastCharity = g.day.day; } },
      { label: t('Mikroskop gönder ($1K)'), do: (g, E) => { E.cash(-1000); E.influence(1); } },
      { label: t('Şimdilik olmaz'), do: () => '' },
    ],
  },
  {
    id: 'film_shoot', emoji: '🎬', minLevel: 45,
    title: t('Dizi ekibi marketinde çekim yapmak istiyor'),
    text: t('Başrol oyuncusu kasada "aşk sahnesi" çekecek. Kasiyerin heyecandan barkodu ters okuyor.'),
    choices: [
      { label: t('İzin ver (kira $6K)'), do: (g, E) => { E.cash(6000); E.customers(-10, 1); E.customers(8, 7); } },
      { label: t('Ücretsiz izin ver, logoyu göster'), do: (g, E) => { E.customers(12, 7); } },
      { label: t('Reddet'), do: () => '' },
    ],
  },
  {
    id: 'flood_warning', emoji: '🌊', minLevel: 40,
    title: t('Sel uyarısı'),
    text: t('Dere taşabilir. Depodaki paletler yerde, belediyenin kum torbaları bitti.'),
    choices: [
      { label: t('Kum torbası ve pompa al ($3K)'), do: (g, E) => { E.cash(-3000); } },
      { label: t('Mahalleye de dağıt ($9K)'), do: (g, E) => { E.cash(-9000); E.influence(4); E.happy(3); } },
      { label: t('Şansını dene'), do: (g, E) => (E.chance(0.4) ? (E.biz('all', -25, 2), t('Depo su aldı')) : t('Fırtına teğet geçti')) },
    ],
  },
  {
    id: 'golf_day', emoji: '⛳', kind: 'event', place: 'inn', window: [9, 14], minLevel: 55,
    title: t('Han bahçesinde "iş dünyası kahvaltısı"'),
    text: t('Banka müdürü, yatırımcılar ve gazeteciler aynı masada. Simit tabağı stratejik noktada.'),
    choices: [
      { label: t('Bankacıyla sohbet'), hours: 2, do: (g, E) => { E.rel('banker', 8); } },
      { label: t('Gazetecilerle sohbet'), hours: 2, do: (g, E) => { E.rel('editor', 8); } },
      { label: t('Rakiplerle barış çubuğu'), hours: 2, do: (g, E) => { E.rel('rival', 10); } },
    ],
  },
  {
    id: 'club_transfer', emoji: '✍️', kind: 'meeting', place: 'stadium', window: [11, 17], minLevel: 45, need: 'club', when: (g) => g.club.rank > 0,
    title: t('Transfer döneminde yıldız pazarlığı'),
    text: t('Menajer telefonu kapatmadan konuşuyor: "Üç kulüp daha istiyor, karar bugün."'),
    choices: [
      { label: t('Transfer et ($25K)'), hours: 1, do: (g, E) => { E.cash(-25000); g.club.strength = Math.min(90, g.club.strength + 5); E.fans(6); } },
      { label: t('Kiralık al ($8K)'), hours: 1, do: (g, E) => { E.cash(-8000); g.club.strength = Math.min(90, g.club.strength + 2); E.fans(2); } },
      { label: t('Bütçe yok'), hours: 1, do: (g, E) => { E.fans(-2); } },
    ],
  },
  {
    id: 'stock_rumor', emoji: '📉', minLevel: 66, when: (g) => g.finance?.ipo,
    title: t('Borsada söylenti: "holding zorda"'),
    text: t('Sosyal medyada bir hesap holdingin batacağını iddia ediyor. Hesabın profil fotoğrafı bir patates.'),
    choices: [
      { label: t('Geri alım yap ($30K)'), do: (g, E) => { E.cash(-30000); E.rel('investor', 5); return t('📈 hisse +%6'); } },
      { label: t('Açıklama yap'), do: (g, E) => (E.chance(0.6) ? t('📈 söylenti söndü') : t('📉 hisse −%4')) },
      { label: t('Görmezden gel'), do: () => t('📉 hisse −%3') },
    ],
  },
  {
    id: 'minister_transit', emoji: '🧳', kind: 'meeting', place: 'airport', window: [14, 18], minLevel: 76,
    title: t('Bakan aktarmada, VIP salonda bekliyor'),
    text: t('Uçuşu iki saat rötarlı. Danışmanı "bakan bey çay içer" dedi.'),
    choices: [
      { label: t('Şehir projelerini anlat'), hours: 1, do: (g, E) => { E.influence(4); E.rel('mayor', 5); } },
      { label: t('Teşvik iste'), hours: 1, do: (g, E) => (E.chance(0.5) ? (E.cash(25000), t('Teşvik çıktı')) : t('"Bakarız" dedi')) },
    ],
  },
  {
    id: 'mall_anniversary', emoji: '🎈', kind: 'event', place: 'mall', window: [12, 20], minLevel: 75, when: (g) => g.holding.get('mall')?.owned,
    title: t('AVM yıl dönümü kutlaması'),
    text: t('Balonlar şişirildi, konfeti topları hazır. Sunucu "patron kurdeleyi keser mi?" diye soruyor.'),
    choices: [
      { label: t('Kurdeleyi kes, konuş'), hours: 1, do: (g, E) => { E.biz('mall', 15, 5); E.influence(2); } },
      { label: t('Çekiliş yap ($10K)'), hours: 1, do: (g, E) => { E.cash(-10000); E.biz('mall', 25, 5); E.happy(2); } },
    ],
  },
  {
    id: 'ship_delay', emoji: '🚢', minLevel: 69, when: (g) => g.holding.get('port')?.owned,
    title: t('Limanda gemi rötarı'),
    text: t('Fırtına yüzünden üç gemi açıkta bekliyor. Kaptanlardan biri telsizden şarkı söylüyor.'),
    choices: [
      { label: t('Ek römorkör kirala ($7K)'), do: (g, E) => { E.cash(-7000); } },
      { label: t('Bekle'), do: (g, E) => { E.biz('port', -30, 2); } },
    ],
  },
  {
    id: 'health_inspector', emoji: '🧪', minLevel: 68, when: (g) => g.holding.get('restaurant')?.owned || g.holding.get('hotel')?.owned,
    title: t('Sağlık müfettişi habersiz geldi'),
    text: t('Müfettiş buzdolabını açtı, termometreye baktı, sonra size.'),
    choices: [
      { label: t('Her yeri göster'), do: (g, E) => (E.chance(0.75) ? (E.influence(1), t('Her şey temiz çıktı')) : (E.cash(-6000), t('Ceza kesildi'))) },
      { label: t('"Bir çay içelim" de'), do: (g, E) => { E.risk(8); return E.chance(0.5) ? t('Müfettiş çayı sevdi') : (E.cash(-10000), t('Ceza kesildi')); } },
    ],
  },
  {
    id: 'stadium_concert', emoji: '🎤', kind: 'event', place: 'stadium', window: [19, 22], minLevel: 50,
    title: t('Stadyumda yaz konseri'),
    text: t('Ünlü bir grup sahnede. Organizatör "sponsor yayında anons edilir" diyor.'),
    choices: [
      { label: t('Locadan izle, sponsor ol ($6K)'), hours: 2, do: (g, E) => { E.cash(-6000); E.customers(8, 3); E.fans(3); } },
      { label: t('Tribünde halkla izle'), hours: 2, do: (g, E) => { E.influence(2); E.happy(1); } },
    ],
  },
  {
    id: 'court_witness', emoji: '📜', kind: 'meeting', place: 'court', window: [10, 15], minLevel: 51,
    title: t('Tanık olarak çağrıldın'),
    text: t('Ucuzcu Kardeşler\'in vergi davasında tanıksın. Kardeşler koridorda sana el sallıyor.'),
    skip: (g, E) => { E.risk(5); return t('Mahkeme celp kâğıdı gönderdi'); },
    choices: [
      { label: t('Doğruyu söyle'), hours: 1, do: (g, E) => { E.rel('rival', -15); E.risk(-5); E.influence(1); } },
      { label: t('"Hatırlamıyorum"'), hours: 1, do: (g, E) => { E.rel('rival', 10); E.risk(8); } },
    ],
  },
  // ---- Ek kısa kararlar (çeşitlilik) ----
  {
    id: 'cat_in_store', emoji: '🐈', minLevel: 30,
    title: t('Markete bir kedi yerleşti'),
    text: t('Sarman bir kedi peynir reyonunun üstünde uyuyor. Müşteriler fotoğraf çekiyor.'),
    choices: [
      { label: t('Maskot yap, mama koy'), do: (g, E) => { E.cash(-200); E.customers(4, 5); E.rating(1); } },
      { label: t('Barınağa götür'), do: (g, E) => { E.happy(1); } },
    ],
  },
  {
    id: 'parking_complaint', emoji: '🚗', minLevel: 30,
    title: t('Komşular otopark kalabalığından şikâyetçi'),
    text: t('Bir komşu, arabasının önüne park eden müşteriye not bırakmış: "Bir dahakine lastik."'),
    choices: [
      { label: t('Otopark görevlisi tut ($1.5K)'), do: (g, E) => { E.cash(-1500); E.happy(1); } },
      { label: t('Komşulara indirim kuponu dağıt'), do: (g, E) => { E.cash(-800); E.customers(3, 3); } },
      { label: t('Umursama'), do: (g, E) => { E.happy(-1); } },
    ],
  },
  {
    id: 'supplier_bankrupt', emoji: '📦', minLevel: 32,
    title: t('Bir tedarikçi iflasın eşiğinde'),
    text: t('Yıllardır mal aldığın ambalaj firması batmak üzere. Sahibi telefonda ağlıyor.'),
    choices: [
      { label: t('Satın al ($12K)'), do: (g, E) => { E.cash(-12000); E.biz('all', 4, 20); E.rel('union', 4); } },
      { label: t('Avans ver ($4K)'), do: (g, E) => { E.cash(-4000); E.happy(1); } },
      { label: t('Başka tedarikçi bul'), do: (g, E) => { E.biz('all', -3, 3); } },
    ],
  },
  {
    id: 'energy_price_spike', emoji: '⚡', minLevel: 33,
    title: t('Elektrik zammı kapıda'),
    text: t('Dağıtım şirketi zam yapacağını duyurdu. Santrallerin varsa bu iyi haber olabilir.'),
    choices: [
      { label: t('Fazla elektriği sat'), when: (g) => g.holding.owned.some((b) => b.def.energy), do: (g, E) => { E.cash(8000); } },
      { label: t('Tasarruf kampanyası'), do: (g, E) => { E.cash(-1000); E.influence(1); } },
    ],
  },
  {
    id: 'influencer_visit', emoji: '🤳', minLevel: 35,
    title: t('Ünlü bir fenomen "market turu" çekmek istiyor'),
    text: t('Takipçi sayısı kasabanın nüfusunun yüz katı. İstediği: ücretsiz sepet.'),
    choices: [
      { label: t('Sepeti doldur'), do: (g, E) => { E.cash(-1500); E.customers(9, 3); } },
      { label: t('Kibarca reddet'), do: () => '' },
    ],
  },
  {
    id: 'tax_incentive', emoji: '🧾', minLevel: 40,
    title: t('Yeşil yatırım vergi teşviki'),
    text: t('Devlet, güneş paneli kuranlara vergi indirimi veriyor. Formu doldurmak 14 sayfa.'),
    choices: [
      { label: t('Muhasebeciye doldurt'), do: (g, E) => { E.cash(6000); } },
      { label: t('Uğraşmaya değmez'), do: () => '' },
    ],
  },
  {
    id: 'competitor_poach', emoji: '🎣', minLevel: 42,
    title: t('Rakip en iyi müdürünü transfer etmeye çalışıyor'),
    text: t('Ucuzcu Kardeşler, işletme müdürlerinden birine iki katı maaş teklif etmiş.'),
    choices: [
      { label: t('Maaşına zam yap ($5K)'), do: (g, E) => { E.cash(-5000); E.biz('all', 3, 10); } },
      { label: t('Bırak gitsin'), do: (g, E) => { E.biz('all', -6, 5); E.rel('rival', 3); } },
    ],
  },
  {
    id: 'street_festival', emoji: '🎪', minLevel: 45,
    title: t('Cadde festivali için sponsor aranıyor'),
    text: t('Bando, pamuk şeker ve dev bir balon. Belediye "ana sponsor" arıyor.'),
    choices: [
      { label: t('Ana sponsor ol ($10K)'), do: (g, E) => { E.cash(-10000); E.customers(15, 2); E.influence(3); } },
      { label: t('Stand aç ($2K)'), do: (g, E) => { E.cash(-2000); E.customers(6, 2); } },
      { label: t('Katılma'), do: () => '' },
    ],
  },
  {
    id: 'cyber_attack', emoji: '💻', minLevel: 48,
    title: t('Online sipariş sistemine siber saldırı'),
    text: t('Sitede sadece dans eden bir kedi gif\'i görünüyor. Müşteriler eğleniyor ama sipariş veremiyor.'),
    choices: [
      { label: t('Güvenlik firması tut ($7K)'), do: (g, E) => { E.cash(-7000); } },
      { label: t('Stajyere çözdür'), do: (g, E) => (E.chance(0.5) ? t('Stajyer çözdü!') : (E.customers(-8, 2), t('Site iki gün kapalı kaldı'))) },
    ],
  },
  {
    id: 'water_shortage', emoji: '🚰', minLevel: 50,
    title: t('Şehirde su kesintisi'),
    text: t('Üç gün su yok. Markette damacana rafları boşalıyor.'),
    choices: [
      { label: t('Fiyatı sabit tut, ekstra sipariş'), do: (g, E) => { E.cash(-3000); E.influence(3); E.happy(2); } },
      { label: t('Fiyatı yükselt'), do: (g, E) => { E.cash(6000); E.influence(-4); E.happy(-3); } },
    ],
  },
  {
    id: 'billboard_war', emoji: '🪧', minLevel: 52, need: 'politics', when: (g) => g.politics.campaignTime,
    title: t('Rakip adayın afişi marketinin duvarında'),
    text: t('Gece biri marketin yan duvarına dev bir afiş asmış. Afişteki aday gülümsüyor.'),
    choices: [
      { label: t('Söktür, yerine kendi afişini as'), do: (g, E) => { E.influence(2); E.rel('rival', -5); } },
      { label: t('Bırak, "herkese açığız" de'), do: (g, E) => { E.influence(3); } },
    ],
  },
  {
    id: 'pension_fund', emoji: '👵', minLevel: 55,
    title: t('Çalışanlar için emeklilik fonu önerisi'),
    text: t('İnsan kaynakları müdürü bir sunum hazırlamış. Slaytlarda çok fazla ok işareti var.'),
    choices: [
      { label: t('Fonu kur ($15K)'), do: (g, E) => { E.cash(-15000); E.rel('union', 15); E.biz('all', 5, 30); } },
      { label: t('Seneye'), do: (g, E) => { E.rel('union', -3); } },
    ],
  },
  {
    id: 'mayor_dinner_invite', emoji: '🍷', minLevel: 51, need: 'politics', when: (g) => !g.isMayor,
    title: t('Belediye başkanı akşam yemeğine çağırıyor'),
    text: t('"Gelin konuşalım" diyor. Menüde balık, gündemde imar.'),
    choices: [
      { label: t('Git, dinle'), do: (g, E) => { E.rel('mayor', 8); E.influence(-1); } },
      { label: t('Seçim öncesi görüşmem'), do: (g, E) => { E.rel('mayor', -5); E.influence(2); } },
    ],
  },
  {
    id: 'stock_tip', emoji: '📈', minLevel: 66,
    title: t('Bir broker "kaçırılmaz hisse" fısıldıyor'),
    text: t('Broker ceketinin içinden bir kâğıt çıkardı: üzerinde sadece "AL!" yazıyor.'),
    choices: [
      { label: t('$20K yatır'), do: (g, E) => (E.chance(0.5) ? (E.cash(16000), t('Hisse uçtu!')) : (E.cash(-20000), t('Hisse çakıldı'))) },
      { label: t('İçeriden bilgi mi? Reddet'), do: (g, E) => { E.risk(-3); } },
    ],
  },
  {
    id: 'hotel_overbooking', emoji: '🛎️', minLevel: 68, when: (g) => g.holding.get('hotel')?.owned,
    title: t('Otelde aşırı rezervasyon'),
    text: t('Bir turist kafilesi ve bir düğün aynı gece. Resepsiyon görevlisi saklanacak yer arıyor.'),
    choices: [
      { label: t('Rakip otele yönlendir, ücreti öde'), do: (g, E) => { E.cash(-5000); E.influence(1); } },
      { label: t('Toplantı salonuna yatak kur'), do: (g, E) => (E.chance(0.5) ? t('Misafirler macerayı sevdi') : (E.biz('hotel', -15, 3), t('Yorumlar kötü geldi'))) },
    ],
  },
  {
    id: 'airport_strike', emoji: '🛫', minLevel: 76, when: (g) => g.holding.get('airport')?.owned,
    title: t('Yer hizmetleri iş bıraktı'),
    text: t('Bavullar pistte sıraya dizilmiş. Bir yolcu bavulunun üstünde uyuyor.'),
    choices: [
      { label: t('Zam ver ($12K)'), do: (g, E) => { E.cash(-12000); E.rel('union', 8); } },
      { label: t('Taşeron getir'), do: (g, E) => { E.biz('airport', -20, 3); E.rel('union', -12); } },
    ],
  },
  {
    id: 'museum_donation', emoji: '🏺', minLevel: 81,
    title: t('Eski Çarşı\'da müze açılacak'),
    text: t('Kazıda bir Roma sikkesi ve çok eski bir yazar kasa çıktı. Müze için bağış aranıyor.'),
    choices: [
      { label: t('Müzeyi sen kur ($50K)'), do: (g, E) => { E.cash(-50000); E.influence(6); E.happy(4); g.news.lastCharity = g.day.day; } },
      { label: t('Yazar kasayı satın al ($5K)'), do: (g, E) => { E.cash(-5000); E.customers(3, 10); return t('Kasa marketinde sergileniyor'); } },
    ],
  },
  {
    id: 'university_chair', emoji: '🎓', minLevel: 87,
    title: t('Üniversite adına bir kürsü açmak istiyor'),
    text: t('"Perakende ve Girişimcilik Kürsüsü". Rektör senin adını önermiş.'),
    choices: [
      { label: t('Bursları da sen ver ($80K)'), do: (g, E) => { E.cash(-80000); E.influence(8); E.happy(3); } },
      { label: t('Sadece adını ver'), do: (g, E) => { E.influence(2); } },
    ],
  },
  {
    id: 'village_road', emoji: '🛣️', minLevel: 89,
    title: t('Kuzey köyleri yol istiyor'),
    text: t('Köylerden gelen heyet traktörle gelmiş. Traktör belediyenin önünde park halinde.'),
    choices: [
      { label: t('Yolu yaptır ($120K)'), do: (g, E) => { E.cash(-120000); E.happy(6); E.biz('farm', 10, 60); } },
      { label: t('Bütçeye koy (seneye)'), do: (g, E) => { E.influence(-2); } },
    ],
  },
  {
    id: 'sister_city', emoji: '🌍', minLevel: 85,
    title: t('Kardeş şehir protokolü'),
    text: t('Denizaşırı bir şehrin belediye başkanı ziyarete geliyor. Getirdiği hediye bir tulum peyniri.'),
    choices: [
      { label: t('Ağırla, ticaret anlaşması öner'), do: (g, E) => { E.cash(-5000); E.rel('investor', 10); E.biz('port', 10, 20); } },
      { label: t('Kısa bir tören yeter'), do: (g, E) => { E.influence(1); } },
    ],
  },
];
