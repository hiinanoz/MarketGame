import { BANK, START_LOAN, PREMIUM } from './config.js';
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
    const assets = (g.holding ? g.holding.businesses.reduce((a, b) => a + b.value, 0) : 0) + (g.housing?.value ?? 0) + (g.rent?.marketOwned ? g.rent.boughtPrice ?? 0 : 0);
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
    // Standart oyuncuda limit dörtte bir (Premium tam limit)
    const prem = this.game.premium ? 1 : PREMIUM.creditFactor;
    return Math.round((p.base + p.assets + p.income) * (this.game.finance?.limitFactor ?? 1) * prem);
  }

  get available() {
    return Math.max(0, this.limit - this.debt);
  }

  borrow(amount) {
    const n = Math.floor(Math.min(amount, this.available));
    if (n <= 0) return 0;
    this.debt += n;
    this.game.money += n;
    this.changed(`🏦 Đ${n} kredi çekildi · toplam borç Đ${this.debt}`);
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
    this.changed(left === 0 ? `✅ Đ${n} ödendi · borç kapandı` : `🏦 Đ${n} ödendi · kalan borç Đ${left}`);
    return n;
  }

  put(amount) {
    const n = Math.floor(Math.min(amount, Math.max(0, this.game.money)));
    if (n <= 0) return 0;
    this.deposit += n;
    this.game.money -= n;
    this.changed(`🏦 Đ${n} yatırıldı · mevduat Đ${this.deposit}`);
    return n;
  }

  withdraw(amount) {
    const n = Math.floor(Math.min(amount, this.deposit));
    if (n <= 0) return 0;
    this.deposit -= n;
    this.game.money += n;
    this.changed(`🏦 Đ${n} çekildi · mevduat Đ${this.deposit}`);
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

  /**
   * Gün sonu faiz: nakitten (yetmezse mevduattan) ödenir. Ödenemeyen kısım borca eklenir.
   * Faiz üst üste BANK.missLimit gün ödenemezse banka en değersiz işletmeye el koyar;
   * değerinin bir kısmı borçtan düşülür. Borç kapanınca işletme aynı fiyata geri alınabilir.
   */
  payInterest(today) {
    const g = this.game;
    const f = g.finance?.interestFactor ?? 1; // Şehir Bankası / finans merkezi
    const a = Math.round(this.debt * BANK.loanRate * f);
    const b = Math.round(this.startDebt * START_LOAN.rate * f);
    const due = a + b;
    let paid = Math.min(due, Math.max(0, Math.floor(g.money)));
    g.money -= paid;
    if (paid < due && this.deposit > 0) {
      const take = Math.min(this.deposit, due - paid);
      this.deposit -= take;
      paid += take;
    }
    const unpaid = due - paid;
    if (unpaid > 0) {
      // Ödenmeyen faiz, ait olduğu krediye eklenir
      const ua = Math.round(unpaid * (due ? a / due : 1));
      this.debt += ua;
      this.startDebt += unpaid - ua;
      this.missed = (this.missed ?? 0) + 1;
    } else this.missed = 0;
    today.interestPaid = paid;
    today.interestUnpaid = unpaid;
    today.missed = this.missed;
    if (this.missed >= BANK.missLimit) {
      const s = this.seizeOne();
      if (s) {
        today.seized = s;
        this.missed = 0;
      } else today.seizeNone = true;
    } else if (unpaid > 0) {
      g.hud.toast(`⚠️ Kredi faizi ödenemedi (${this.missed}/${BANK.missLimit}) — ${BANK.missLimit}. günde banka bir işletmene el koyar`);
    }
  }

  /** En değersiz işletmeye el koy, değerinin bir kısmını borçtan düş. */
  seizeOne() {
    const g = this.game;
    const owned = g.holding.owned.filter((b) => !b.leased).sort((x, y) => x.fullValue - y.fullValue);
    const biz = owned[0];
    if (!biz) return null;
    const price = Math.round(biz.fullValue * BANK.seizeRatio);
    biz.seize(price);
    let left = price;
    const d1 = Math.min(left, this.debt);
    this.debt -= d1;
    left -= d1;
    const d2 = Math.min(left, this.startDebt);
    this.startDebt -= d2;
    left -= d2;
    if (left > 0) g.money += left; // borçtan artan para sana kalır
    g.hud.toast(`🏦 Banka ${biz.def.emoji} ${biz.name} işletmesine el koydu (−Đ${formatMoney(price)} borç)`);
    return { name: biz.name, emoji: biz.def.emoji, price, change: left };
  }

  /** Gün sonu: mevduat faizi, kazanç geçmişi (limit için). */
  endOfDay(today) {
    this.history ??= [];
    this.history.push((today.revenue ?? 0) + (today.holding?.profit ?? 0));
    if (this.history.length > 3) this.history.shift();
    const earned = Math.floor(this.deposit * BANK.depositRate);
    this.deposit += earned;
    today.interestEarned = earned;
  }

  serialize() {
    return { debt: this.debt, startDebt: this.startDebt, deposit: this.deposit, history: this.history ?? [], missed: this.missed ?? 0 };
  }

  restore(d) {
    if (!d) return;
    this.debt = d.debt ?? 0;
    this.startDebt = d.startDebt ?? 0;
    this.history = d.history ?? [];
    this.deposit = d.deposit ?? 0;
    this.missed = d.missed ?? 0;
  }
}
