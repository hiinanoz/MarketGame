import { ELECTRICITY } from './config.js';
import { t } from './i18n.js';
import { formatMoney } from './hud.js';

// Elektrik (Sv.30+): her gün sonunda market ve işletmelerin tüketimi faturalanır.
// Kendi güneş/rüzgâr santrallerin önce kendi tüketimini karşılar; güneş, batarya yoksa
// gece payını karşılayamaz. Fazlası santralde muhasebeci varsa şebekeye satılır.

export class Energy {
  constructor(game) {
    this.game = game;
    this.wind = 1;        // bugünkü rüzgâr gücü
    this.last = null;     // dünkü hesap (tablet için)
  }

  get active() {
    return this.game.level >= ELECTRICITY.fromLevel;
  }

  get plants() {
    return this.game.holding.owned.filter((b) => b.isEnergy);
  }

  /** Üretim çarpanı: güneş sadece mağaza açıkken (gündüz), rüzgâr günün rüzgârı kadar. */
  factor(kind) {
    const open = this.game.day.phase === 'open';
    if (kind === 'solar' || kind === 'hydro') return open ? 1 : 0; // baraj gece de üretir (gece payı sorun değil)
    return open ? this.wind : 0;
  }

  /** Günlük tüketim dökümü (birim). */
  get consumption() {
    const g = this.game;
    const E = ELECTRICITY;
    const rooms = (g.room2Open ? 1 : 0) + (g.room3Open ? 1 : 0);
    let modules = 0;
    for (const b of g.holding.owned) if (!b.isEnergy) modules += b.modules;
    const market = E.market + rooms * E.perRoom;
    return { market, business: modules * E.perModule, total: market + modules * E.perModule };
  }

  /** Tahmini günlük fatura (muhasebeci yedeği için). */
  get estimatedBill() {
    if (!this.active) return 0;
    let cap = 0;
    for (const p of this.plants) cap += p.energyCapacity * (p.def.energy === 'wind' ? this.wind : 1);
    return Math.max(0, Math.round(this.consumption.total - cap));
  }

  /** Gün sonu: tüketim, kendi üretim, fatura ve şebeke satışı. */
  settle(today) {
    const g = this.game;
    if (!this.active) return;
    const E = ELECTRICITY;
    const C = this.consumption.total;
    let solar = 0;
    let wind = 0;
    let battery = false;
    let accountant = false;
    for (const p of this.plants) {
      if (p.def.energy === 'solar') solar += p.energyToday;
      else wind += p.energyToday;
      battery ||= p.battery;
      accountant ||= p.accountant;
    }
    // Güneş bataryasızken sadece gündüz tüketimini karşılar
    const solarUsable = battery ? solar : Math.min(solar, C * (1 - E.nightShare));
    const own = Math.min(C, wind + solarUsable);
    const bill = Math.round((C - own) * (g.finance?.electricityFactor ?? 1));
    const surplus = Math.max(0, wind + solar - own);
    const gridIncome = accountant ? Math.round(surplus * E.gridPrice) : 0;
    // Fatura: kasadan; yetmezse kalan krediye yazılır
    const pay = Math.min(bill, Math.max(0, Math.floor(g.money)));
    g.money -= pay;
    if (bill > pay) g.bank.debt += bill - pay;
    g.money += gridIncome;
    // Santrallerin hesabına: karşıladıkları tüketim (tasarruf) + şebeke satışı
    const total = wind + solar || 1;
    for (const p of this.plants) {
      const share = p.energyToday / total;
      p.today.supplied += Math.round(own * share);
      p.today.sales += Math.round(gridIncome * share);
    }
    this.last = { consumption: Math.round(C), produced: Math.round(wind + solar), own: Math.round(own), bill, unpaid: bill - pay, surplus: Math.round(surplus), gridIncome, accountant, wind: this.wind };
    today.electricity = this.last;
    // Yarının rüzgârı
    const [a, b] = E.wind;
    this.wind = Math.round((a + Math.random() * (b - a)) * 100) / 100;
    g.hud.setMoney(g.money);
  }

  serialize() {
    return { wind: this.wind, last: this.last };
  }

  restore(d) {
    if (!d) return;
    this.wind = d.wind ?? 1;
    this.last = d.last ?? null;
  }
}

export function energySummary(e) {
  return `⚡ ${t('tüketim {use} · üretim {made}', { use: formatMoney(e.consumption), made: formatMoney(e.produced) })}`;
}
