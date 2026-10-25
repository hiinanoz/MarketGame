import { BANK } from './config.js';
import { formatMoney } from './hud.js';

// Banka: kredi (günlük faizli borç) ve mevduat (günlük faiz getiren birikim).

export class Bank {
  constructor(game) {
    this.game = game;
    this.debt = 0;
    this.deposit = 0;
  }

  get limit() {
    return BANK.limitBase + this.game.level * BANK.limitPerLevel;
  }

  get available() {
    return Math.max(0, this.limit - this.debt);
  }

  borrow(amount) {
    const n = Math.floor(Math.min(amount, this.available));
    if (n <= 0) return 0;
    this.debt += n;
    this.game.money += n;
    this.changed(`🏦 $${n} kredi çekildi · toplam borç $${this.debt}`);
    return n;
  }

  /** Borç öde: en fazla elindeki nakit kadar. Ödenen tutar borçtan aynen düşer. */
  repay(amount) {
    const n = Math.floor(Math.min(amount, this.debt, Math.max(0, this.game.money)));
    if (n <= 0) return 0;
    this.debt -= n;
    this.game.money -= n;
    this.changed(this.debt === 0 ? `✅ $${n} ödendi · borç kapandı` : `🏦 $${n} ödendi · kalan borç $${this.debt}`);
    return n;
  }

  put(amount) {
    const n = Math.floor(Math.min(amount, Math.max(0, this.game.money)));
    if (n <= 0) return 0;
    this.deposit += n;
    this.game.money -= n;
    this.changed(`🏦 $${n} yatırıldı · mevduat $${this.deposit}`);
    return n;
  }

  withdraw(amount) {
    const n = Math.floor(Math.min(amount, this.deposit));
    if (n <= 0) return 0;
    this.deposit -= n;
    this.game.money += n;
    this.changed(`🏦 $${n} çekildi · mevduat $${this.deposit}`);
    return n;
  }

  changed(msg) {
    this.lastLog = msg;
    this.game.hud.setMoney(this.game.money);
    this.game.hud.displayed = this.game.money; // para göstergesi anında güncellensin
    this.game.hud.moneyValue.textContent = formatMoney(Math.round(this.game.money));
    this.game.hud.toast(msg);
    this.game.audio.play('cash');
    this.game.save();
  }

  /** Gün sonu: borca faiz eklenir, mevduat faiz kazanır. */
  endOfDay(today) {
    const interest = Math.round(this.debt * BANK.loanRate);
    const earned = Math.floor(this.deposit * BANK.depositRate);
    this.debt += interest;
    this.deposit += earned;
    today.interestPaid = interest;
    today.interestEarned = earned;
  }

  serialize() {
    return { debt: this.debt, deposit: this.deposit };
  }

  restore(d) {
    if (!d) return;
    this.debt = d.debt ?? 0;
    this.deposit = d.deposit ?? 0;
  }
}
