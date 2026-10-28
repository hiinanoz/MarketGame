import { RENT } from './config.js';
import { formatMoney } from './hud.js';

// Kiralar: market Sv.20'ye kadar kiralıktır (büyüdükçe kira artar), sonra muhasebe odasından
// satın alınır. Kiralık işletmeler de haftalık kira öder. Ödeme her 7. günün sonunda yapılır;
// para yetmezse mevduattan, o da yetmezse kalan kredi borcuna yazılır.

export class Rent {
  constructor(game) {
    this.game = game;
    this.marketOwned = false;
    this.last = null;
  }

  /** Marketin haftalık kirası: salon, reyon, otopark ve depo büyüdükçe artar. */
  get marketRent() {
    if (this.marketOwned) return 0;
    const g = this.game;
    const M = RENT.market;
    const rooms = (g.room2Open ? 1 : 0) + (g.room3Open ? 1 : 0);
    return M.base + rooms * M.room + g.shelves.length * M.shelf + (g.traffic?.lot?.stage ?? 0) * M.parking + (g.depot?.level ?? 0) * M.depot;
  }

  get marketPrice() {
    return Math.round(this.marketRent * RENT.market.buyWeeks / 100) * 100;
  }

  get canBuyMarket() {
    return !this.marketOwned && this.game.level >= RENT.market.buyLevel;
  }

  buyMarket() {
    const g = this.game;
    const price = this.marketPrice;
    if (!this.canBuyMarket || g.money < price) return false;
    g.spend(price);
    this.marketOwned = true;
    this.boughtPrice = price;
    g.gainXp(Math.floor(price / 100));
    g.hud.toast(`🏪 ${g.marketTitle} binası artık senin — kira bitti!`);
    g.audio.play('unlock');
    g.save();
    return true;
  }

  /** Kiralık işletmelerin haftalık toplamı. */
  get businessRent() {
    return this.game.holding.owned.reduce((a, b) => a + b.weeklyRent, 0);
  }

  get weeklyTotal() {
    return this.marketRent + this.businessRent;
  }

  /** Kira gününe kalan gün (0 = bugün akşam). */
  get daysLeft() {
    const d = this.game.day.day % RENT.week;
    return d === 0 ? 0 : RENT.week - d;
  }

  /** Gün sonu: haftanın son günüyse kiralar ödenir. */
  settle(today) {
    const g = this.game;
    if (g.day.day % RENT.week !== 0) return;
    const market = this.marketRent;
    const biz = this.businessRent;
    const total = market + biz;
    if (!total) return;
    let paid = Math.min(total, Math.max(0, Math.floor(g.money)));
    g.money -= paid;
    if (paid < total && g.bank.deposit > 0) {
      const take = Math.min(g.bank.deposit, total - paid);
      g.bank.deposit -= take;
      paid += take;
    }
    const unpaid = total - paid;
    if (unpaid > 0) g.bank.debt += unpaid;
    this.last = { market, biz, total, unpaid, day: g.day.day };
    today.rent = this.last;
    g.hud.setMoney(g.money);
  }

  label() {
    return this.marketOwned ? 'Bina senin' : `Kiralık · haftalık $${formatMoney(this.marketRent)}`;
  }

  serialize() {
    return { marketOwned: this.marketOwned, boughtPrice: this.boughtPrice ?? 0, last: this.last };
  }

  restore(d) {
    if (!d) return;
    this.marketOwned = !!d.marketOwned;
    this.boughtPrice = d.boughtPrice ?? 0;
    this.last = d.last ?? null;
  }
}
