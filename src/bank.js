import { BANK } from './config.js';

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
    const n = Math.min(amount, this.available);
    if (n <= 0) return 0;
    this.debt += n;
    this.game.money += n;
    this.changed(`🏦 $${n} kredi çekildi`);
    return n;
  }

  repay(amount) {
    const n = Math.min(amount, this.debt, this.game.money);
    if (n <= 0) return 0;
    this.debt -= n;
    this.game.money -= n;
    this.changed(this.debt === 0 ? '✅ Borç kapandı' : `🏦 $${n} borç ödendi`);
    return n;
  }

  put(amount) {
    const n = Math.min(amount, this.game.money);
    if (n <= 0) return 0;
    this.deposit += n;
    this.game.money -= n;
    this.changed(`🏦 $${n} yatırıldı`);
    return n;
  }

  withdraw(amount) {
    const n = Math.min(amount, this.deposit);
    if (n <= 0) return 0;
    this.deposit -= n;
    this.game.money += n;
    this.changed(`🏦 $${n} çekildi`);
    return n;
  }

  changed(msg) {
    this.game.hud.setMoney(this.game.money);
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
