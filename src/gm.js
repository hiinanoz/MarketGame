import { t } from './i18n.js';
import { GM, DAY, PRODUCTS, specialsAt } from './config.js';

// Genel müdür (Sv.35+): market diğer işletmeler gibi kendi kendine çalışır.
// İşe alındığında son günlerin market ortalaması (ciro, mal alımı, müşteri) referans alınır; market açıkken
// cironun büyük kısmı özet olarak hesaplanır, ekranda az sayıda gerçek müşteri görünür (kalan pay onlardan).
// Sipariş/reklam/personel muhasebecinin kendi ayarlarıyla sürer (genel müdür onlara karışmaz); ipucu ve market
// bildirimleri susar. Genel müdür 2.0: her gün kendi kampanyasını kurar, verimi günden güne değişir (çoğu gün
// +%5–10, ara sıra hatayla −%10–15), tavana (standart ×1.6, tecrübeli ×2.0) yaklaştıkça artış yavaşlar.

export class GeneralManager {
  constructor(game) {
    this.game = game;
    this.tier = null;      // null | 'std' | 'expert'
    this.active = false;   // izindeyken false: market normal oyuna döner
    this.baseline = null;  // { revenue, spent, customers, shelves }
    this.log = [];         // son günlerin market sonuçları (genel müdürsüz günler)
    this.custAcc = 0;
    this.perf = 1;         // günlük verim çarpanı (referans × factor × perf)
    this.hist = [];        // son 7 gün: { day, revenue, change, note }
    this.camps = [];       // bugünkü kampanyalar: { product, boost }
  }

  /** Referans ciroya göre şu anki oran (factor × perf). */
  get ratio() {
    return this.def.factor * this.perf;
  }

  get cap() {
    return GM.cap[this.tier] ?? GM.cap.std;
  }

  get hired() {
    return !!this.tier;
  }

  get def() {
    return GM.tiers[this.tier] ?? GM.tiers.std;
  }

  get wage() {
    return this.hired ? this.def.wage : 0;
  }

  /** Özetin günlük cirosu (raf sayısı arttıkça büyür). */
  get dailyRevenue() {
    if (!this.baseline) return 0;
    const growth = Math.sqrt(Math.max(1, this.game.shelves.length) / Math.max(1, this.baseline.shelves));
    const camp = this.camps.reduce((a, c) => a + c.boost, 0);
    return this.baseline.revenue * this.ratio * growth * (1 + camp);
  }

  /** Sabah: günün kampanyaları (Premium'da 2). En iyi sonuç veren üründen başlar. */
  planCampaigns() {
    const g = this.game;
    const n = g.premium ? GM.campaigns.premium : GM.campaigns.standard;
    const results = g.campaign.lastResults ?? {};
    const pool = specialsAt(g.level);
    if (!pool.length) return (this.camps = []);
    pool.sort((a, b) => (results[b]?.sold ?? 0) - (results[a]?.sold ?? 0) || Math.random() - 0.5);
    const [lo, hi] = GM.campaignBoost;
    this.camps = pool.slice(0, n).map((product) => ({ product, boost: lo + Math.random() * (hi - lo) }));
    const names = this.camps.map((c) => `${PRODUCTS[c.product].emoji} ${PRODUCTS[c.product].name}`).join(', ');
    g.hud.toast(`🧑‍💼 ${t('Genel müdür bugün kampanya yapıyor: {list}', { list: names })}`);
  }

  /** Gün sonu verim değişimi. */
  rollPerf() {
    const cur = this.ratio;
    let change;
    let note = '';
    if (Math.random() < GM.goodChance) {
      const [lo, hi] = GM.good;
      const room = Math.max(0, Math.min(1, (this.cap - cur) / (this.cap * 0.35))); // tavana yaklaştıkça küçülür
      change = (lo + Math.random() * (hi - lo)) * room;
    } else {
      const [lo, hi] = GM.bad;
      change = -(lo + Math.random() * (hi - lo));
      const notes = [t('yanlış ürünü kampanyaya koydu'), t('siparişi geç verdi, raflar boş kaldı'), t('kasiyerlerin vardiyasını karıştırdı'), t('raf düzenini değiştirdi, müşteriler aradığını bulamadı')];
      note = notes[Math.floor(Math.random() * notes.length)];
    }
    const next = Math.max(GM.floor, Math.min(this.cap, cur * (1 + change)));
    this.perf = next / this.def.factor;
    return { change: next / cur - 1, note };
  }

  /** Son günlerin ortalaması; kayıt yoksa raf sayısından kaba tahmin. */
  computeBaseline() {
    const g = this.game;
    const days = this.log.slice(-3);
    if (days.length) {
      const avg = (k) => days.reduce((a, d) => a + (d[k] ?? 0), 0) / days.length;
      return { revenue: avg('revenue'), spent: avg('spent'), customers: avg('customers'), shelves: g.shelves.length };
    }
    const revenue = g.shelves.length * 900;
    return { revenue, spent: revenue * 0.4, customers: g.shelves.length * 25, shelves: g.shelves.length };
  }

  canHire(tier) {
    const g = this.game;
    const d = GM.tiers[tier];
    return g.level >= GM.level && !!g.accountant && (!d.premium || g.premium) && g.money >= d.hire;
  }

  hire(tier) {
    const g = this.game;
    if (!this.canHire(tier)) return false;
    g.spend(GM.tiers[tier].hire);
    this.tier = tier;
    this.baseline = this.computeBaseline();
    this.setActive(true, true);
    g.hud.toast(`🧑‍💼 ${t('Genel müdür işe başladı: market artık kendi kendine çalışıyor')}`);
    g.audio.play('unlock');
    g.save();
    return true;
  }

  dismiss() {
    this.tier = null;
    this.active = false;
    this.game.hud.toast(`🧑‍💼 ${t('Genel müdür ayrıldı: market yeniden senin yönetiminde')}`);
  }

  /** İzne çıkar (markete dön) / geri çağır. */
  setActive(on, silent = false) {
    if (!this.hired) return;
    this.active = on;
    const a = this.game.accountant;
    if (a) {
      if (on) {
        // Genel müdür muhasebecinin ayarlarına dokunmaz. Eski sürümün değiştirdiği ayarlar varsa geri ver.
      }
      if (this.savedSettings) {
        Object.assign(a.settings, this.savedSettings);
        this.savedSettings = null;
      }
    }
    if (on) {
      this.baseline = this.computeBaseline();
      if (this.game.day.phase === 'open' && !this.camps.length) this.planCampaigns();
    } else this.camps = [];
    if (!silent) this.game.hud.toast(on ? `🧑‍💼 ${t('Genel müdür marketi yönetiyor')}` : `🛒 ${t('Genel müdür izinde: market senin yönetiminde')}`);
    this.game.save();
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    const today = g.day.today;
    // Kasadaki paralar kendiliğinden kasaya geçer
    for (const co of g.checkouts) {
      if (co.cash.value > 0) {
        g.money += co.cash.value;
        co.cash.value = 0;
        for (const b of co.cash.bills.splice(0)) b.mesh.removeFromParent();
        g.hud.setMoney(g.money);
      }
    }
    if (g.day.phase !== 'open' || !this.baseline) return;
    if (this.campDay !== g.day.day) {
      this.campDay = g.day.day;
      this.planCampaigns();
    }
    const share = (dt / DAY.length) * GM.abstractShare;
    const revenue = this.dailyRevenue * share;
    const cost = revenue * GM.costRatio;
    g.money += revenue - cost;
    today.revenue += revenue;
    today.spent = (today.spent ?? 0) + cost;
    today.gmRevenue = (today.gmRevenue ?? 0) + revenue;
    g.goals.event('revenue', revenue);
    // Müşteri sayısı (XP, kilometre taşları)
    this.custAcc += this.baseline.customers * this.ratio * share;
    while (this.custAcc >= 1) {
      this.custAcc--;
      g.onCustomerPaid();
    }
    g.hud.setMoney(g.money);
  }

  /** Gün sonu: genel müdürsüz günlerin sonucu referans için saklanır. */
  endOfDay(today) {
    if (this.active) {
      const { change, note } = this.rollPerf();
      this.hist.push({ day: this.game.day.day, revenue: Math.round(today.gmRevenue ?? 0), change, note });
      if (this.hist.length > 7) this.hist.shift();
      this.camps = [];
      today.gmChange = change;
      if (note) this.game.hud.toast(`🧑‍💼 ${t('Genel müdür hata yaptı: {what} (verim −%{n})', { what: note, n: Math.round(-change * 100) })}`);
      return;
    }
    this.log.push({ revenue: today.revenue ?? 0, spent: today.spent ?? 0, customers: today.customers ?? 0 });
    if (this.log.length > 5) this.log.shift();
  }

  payrollEntry() {
    if (!this.hired) return null;
    return { wage: this.def.wage, label: `🧑‍💼 ${t('Genel müdür')}`, fire: () => this.dismiss() };
  }

  serialize() {
    return { tier: this.tier, active: this.active, baseline: this.baseline, log: this.log, savedSettings: this.savedSettings ?? null, perf: this.perf, hist: this.hist, camps: this.camps, campDay: this.campDay ?? 0 };
  }

  restore(d) {
    if (!d) return;
    this.tier = d.tier ?? null;
    this.active = !!d.active && !!this.tier;
    this.baseline = d.baseline ?? null;
    this.log = d.log ?? [];
    this.savedSettings = d.savedSettings ?? null;
    this.perf = d.perf ?? 1;
    this.hist = d.hist ?? [];
    this.camps = d.camps ?? [];
    this.campDay = d.campDay ?? 0;
    // Eski sürüm muhasebeci ayarlarını değiştirmişti: geri ver
    if (this.savedSettings && this.game.accountant) {
      Object.assign(this.game.accountant.settings, this.savedSettings);
      this.savedSettings = null;
    }
  }
}
