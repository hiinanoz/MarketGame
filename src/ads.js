import { AD_TYPES, MEDIA, MUNICIPALITY } from './config.js';
import { formatMoney } from './hud.js';

// Reklam: istediğin gün ücretini ödeyip reklam verirsin (o gün açıksa hemen, kapalıysa ertesi gün).
// Medya şirketini (gazete + radyo) alınca reklamlar ucuzlar, market ve şubelere sürekli müşteri gelir.
// Belediye: işletme sayın 3'ü geçince ara sıra ceza keser; belediye başkanı olunca kesmez.

export class Ads {
  constructor(game) {
    this.game = game;
    this.bought = []; // { type, day }
  }

  get mediaOwned() {
    return !!this.game.holding?.mediaOwned;
  }

  cost(type) {
    const t = AD_TYPES[type];
    return Math.round(t.cost * (1 + this.game.level * 0.03) * (this.mediaOwned ? 1 - MEDIA.adDiscount : 1));
  }

  /** Reklamın geçerli olacağı gün: dükkân açıksa bugün, değilse yarın. */
  get targetDay() {
    const d = this.game.day;
    return d.phase === 'open' ? d.day : d.day + 1;
  }

  has(type) {
    return this.bought.some((b) => b.type === type && b.day === this.targetDay);
  }

  buy(type) {
    const g = this.game;
    const t = AD_TYPES[type];
    const c = this.cost(type);
    if (!t || g.level < t.level || this.has(type) || g.money < c) return false;
    g.spend(c);
    this.bought.push({ type, day: this.targetDay });
    g.hud.toast(`${t.emoji} ${t.name} ${this.targetDay === g.day.day ? 'yayında' : 'yarın yayında'} (+%${Math.round(t.boost * 100)} müşteri)`);
    g.save();
    return true;
  }

  /** Müşteri çarpanı: bugünkü reklamlar + medya sahipliği. */
  get factor() {
    const day = this.game.day.day;
    let f = 1;
    for (const b of this.bought) if (b.day === day) f += AD_TYPES[b.type].boost;
    if (this.mediaOwned) f *= MEDIA.salesBoost;
    return f;
  }

  get todayList() {
    const day = this.game.day.day;
    return this.bought.filter((b) => b.day === day).map((b) => AD_TYPES[b.type]);
  }

  /** Sabah: eski reklam kayıtlarını temizle, belediye denetimi. */
  startDay() {
    const g = this.game;
    this.bought = this.bought.filter((b) => b.day >= g.day.day);
    const count = g.holding.owned.length;
    if (g.isMayor || count < MUNICIPALITY.minBusinesses) return;
    if (Math.random() >= MUNICIPALITY.chance) return;
    const M = MUNICIPALITY;
    const amount = M.base + count * M.perBusiness + Math.round(g.level * 5);
    const reason = M.reasons[Math.floor(Math.random() * M.reasons.length)];
    const pay = Math.min(amount, Math.max(0, Math.floor(g.money)));
    g.money -= pay;
    if (amount > pay) g.bank.debt += amount - pay;
    g.day.today.fine = { amount, reason };
    g.hud.setMoney(g.money);
    g.hud.toast(`🏛️ Belediye cezası: ${reason} −$${formatMoney(amount)}`);
  }

  serialize() {
    return { bought: this.bought };
  }

  restore(d) {
    this.bought = d?.bought ?? [];
  }
}
