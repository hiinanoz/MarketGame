import { t } from './i18n.js';
import { GM, DAY } from './config.js';

// Genel müdür (Sv.35+): market diğer işletmeler gibi kendi kendine çalışır.
// İşe alındığında son günlerin market ortalaması (ciro, mal alımı, müşteri) referans alınır; market açıkken
// cironun büyük kısmı özet olarak hesaplanır, ekranda az sayıda gerçek müşteri görünür (kalan pay onlardan).
// Sipariş/kampanya/reklam/personel muhasebeci yetkileriyle otomatik, ipucu ve market bildirimleri susar.

export class GeneralManager {
  constructor(game) {
    this.game = game;
    this.tier = null;      // null | 'std' | 'expert'
    this.active = false;   // izindeyken false: market normal oyuna döner
    this.baseline = null;  // { revenue, spent, customers, shelves }
    this.log = [];         // son günlerin market sonuçları (genel müdürsüz günler)
    this.custAcc = 0;
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
    return this.baseline.revenue * this.def.factor * growth;
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
        // Tüm yetkiler açık, kampanyalar kapalı (kampanya kalabalığı özete dahil); izinde eski ayarlar geri gelir
        this.savedSettings ??= { ...a.settings };
        for (const k of Object.keys(a.settings)) if (typeof a.settings[k] === 'boolean') a.settings[k] = k !== 'campaign';
      } else if (this.savedSettings) {
        Object.assign(a.settings, this.savedSettings);
        this.savedSettings = null;
      }
    }
    if (on) this.baseline = this.computeBaseline();
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
    const share = (dt / DAY.length) * GM.abstractShare;
    const revenue = this.dailyRevenue * share;
    const cost = revenue * GM.costRatio;
    g.money += revenue - cost;
    today.revenue += revenue;
    today.spent = (today.spent ?? 0) + cost;
    today.gmRevenue = (today.gmRevenue ?? 0) + revenue;
    g.goals.event('revenue', revenue);
    // Müşteri sayısı (XP, kilometre taşları)
    this.custAcc += this.baseline.customers * this.def.factor * share;
    while (this.custAcc >= 1) {
      this.custAcc--;
      g.onCustomerPaid();
    }
    g.hud.setMoney(g.money);
  }

  /** Gün sonu: genel müdürsüz günlerin sonucu referans için saklanır. */
  endOfDay(today) {
    if (this.active) return;
    this.log.push({ revenue: today.revenue ?? 0, spent: today.spent ?? 0, customers: today.customers ?? 0 });
    if (this.log.length > 5) this.log.shift();
  }

  payrollEntry() {
    if (!this.hired) return null;
    return { wage: this.def.wage, label: `🧑‍💼 ${t('Genel müdür')}`, fire: () => this.dismiss() };
  }

  serialize() {
    return { tier: this.tier, active: this.active, baseline: this.baseline, log: this.log, savedSettings: this.savedSettings ?? null };
  }

  restore(d) {
    if (!d) return;
    this.tier = d.tier ?? null;
    this.active = !!d.active && !!this.tier;
    this.baseline = d.baseline ?? null;
    this.log = d.log ?? [];
    this.savedSettings = d.savedSettings ?? null;
  }
}
