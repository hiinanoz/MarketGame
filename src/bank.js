import { BANK, START_LOAN } from './config.js';
import { formatMoney } from './hud.js';

// Banka: kredi (günlük faizli borç) ve mevduat (günlük faiz getiren birikim).

export class Bank {
  constructor(game) {
    this.game = game;
    this.debt = 0;       // normal kredi (%4/gün)
    this.startDebt = 0;  // kuruluş kredisi (marketi alırken, %1/gün)
    this.deposit = 0;
  }

  get totalDebt() {
    return this.debt + this.startDebt;
  }

  /**
   * Kredi limiti ekonomine göre değişir: seviye + sahip olduğun işletmelerin değeri +
   * son günlerin ortalama kazancı. Yeni işletme aldıkça kredi hakkın artar.
   */
  get limitParts() {
    const g = this.game;
    const assets = g.holding ? g.holding.businesses.reduce((a, b) => a + b.value, 0) : 0;
    const hist = this.history ?? [];
    const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
    return {
      base: BANK.limitBase + g.level * BANK.limitPerLevel,
      assets: Math.round(assets * BANK.assetRatio),
      income: Math.round(Math.max(0, avg) * BANK.incomeDays),
    };
  }

  get limit() {
    const p = this.limitParts;
    return p.base + p.assets + p.income;
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

  /** Borç öde: en fazla elindeki nakit kadar. Önce yüksek faizli kredi kapanır. */
  repay(amount) {
    const n = Math.floor(Math.min(amount, this.totalDebt, Math.max(0, this.game.money)));
    if (n <= 0) return 0;
    const a = Math.min(n, this.debt);
    this.debt -= a;
    this.startDebt -= n - a;
    this.game.money -= n;
    const left = this.totalDebt;
    this.changed(left === 0 ? `✅ $${n} ödendi · borç kapandı` : `🏦 $${n} ödendi · kalan borç $${left}`);
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

  /** Gün sonu: borca faiz eklenir, mevduat faiz kazanır, kazanç geçmişi (limit için) güncellenir. */
  endOfDay(today) {
    this.history ??= [];
    this.history.push((today.revenue ?? 0) + (today.holding?.profit ?? 0));
    if (this.history.length > 3) this.history.shift();
    const interest = Math.round(this.debt * BANK.loanRate + this.startDebt * START_LOAN.rate);
    const earned = Math.floor(this.deposit * BANK.depositRate);
    this.debt += Math.round(this.debt * BANK.loanRate);
    this.startDebt += Math.round(this.startDebt * START_LOAN.rate);
    this.deposit += earned;
    today.interestPaid = interest;
    today.interestEarned = earned;
  }

  serialize() {
    return { debt: this.debt, startDebt: this.startDebt, deposit: this.deposit, history: this.history ?? [] };
  }

  restore(d) {
    if (!d) return;
    this.debt = d.debt ?? 0;
    this.startDebt = d.startDebt ?? 0;
    this.history = d.history ?? [];
    this.deposit = d.deposit ?? 0;
  }
}
