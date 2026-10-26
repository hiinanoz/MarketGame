import * as THREE from 'three';
import { DAY, rushFactor } from './config.js';

// Gün döngüsü: open (08-22) → closing (müşteriler çıkıyor) → night (gece molası) → yeni gün.

const SKY = [
  // saat, gökyüzü, güneş rengi, güneş şiddeti, ortam şiddeti
  [5, 0x2b3a5c, 0x8899cc, 0.35, 0.75],
  [8, 0xa8d8f0, 0xffe2b8, 1.9, 1.55],
  [12, 0x9ad3f0, 0xfff3dd, 2.3, 1.7],
  [17, 0x9ad3f0, 0xfff0d0, 2.1, 1.65],
  [20, 0xf2b27a, 0xffb070, 1.5, 1.35],
  [22, 0x34406a, 0x9aa8e0, 0.55, 0.9],
  [26, 0x1d2540, 0x7d8bc0, 0.35, 0.75],
];

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

export class DayCycle {
  constructor(game) {
    this.game = game;
    this.day = 1;
    this.t = 0;              // açık kalınan süre (sn)
    this.phase = 'open';     // open | closing | night
    this.nightT = 0;
    this.today = blankStats();
  }

  /** Oyun saati (ondalıklı, 8..22 gündüz, gece 22..32). */
  get hour() {
    if (this.phase === 'night') return DAY.closeHour + (24 + DAY.openHour - DAY.closeHour) * (this.nightT / DAY.night);
    return DAY.openHour + (DAY.closeHour - DAY.openHour) * Math.min(1, this.t / DAY.length);
  }

  get clockText() {
    const h = this.hour % 24;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60 / 10) * 10;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  /** Kapanışa kalan açık süre (sn). */
  get remaining() {
    return this.phase === 'open' ? DAY.length - this.t : 0;
  }

  get isOpen() {
    return this.phase === 'open';
  }

  /** Müşteri üretim çarpanı (kapalıyken 0). */
  get rush() {
    return this.isOpen ? rushFactor(this.hour) : 0;
  }

  update(dt) {
    if (this.phase === 'open') {
      this.t += dt;
      if (this.t >= DAY.length) {
        this.phase = 'closing';
        this.closingT = 0;
        this.game.hud.toast('🔒 Mağaza kapandı');
      }
    } else if (this.phase === 'closing') {
      // Rafta bekleyenler: elinde ürün varsa kasaya, yoksa çıkışa. Kasadakiler ödeyip çıkar.
      this.closingT += dt;
      for (const c of this.game.customers) {
        if (c.state !== 'atShelf') continue;
        if (c.carrying > 0) c.leaveShelf();
        else c.leaveQuietly();
      }
      // 30 sn içinde kimse kasaya bakmazsa kalanlar ödemeden gider
      if (this.closingT > 30) {
        for (const c of this.game.customers) if (c.state !== 'leaving') c.leaveQuietly();
      }
      const inside = this.game.customers.filter((c) => c.state !== 'leaving').length;
      if (inside === 0) this.endDay();
    } else if (this.phase === 'night') {
      if (!this.game.hud.summaryOpen) this.nightT += dt;
      if (this.nightT > DAY.night - 6) this.game.campaign.beforeOpening();
      if (this.nightT >= DAY.night) this.startDay();
    }
    this.applyLighting();
  }

  endDay() {
    const g = this.game;
    g.campaign.endOfDay(this.today);
    g.bank.payInterest(this.today);   // önce banka faizi (3 gün ödenmezse el koyma)
    g.payroll(this.today);            // sonra maaşlar (ödenemeyen ayrılır)
    g.holding.endOfDay(this.today);
    g.accountant?.endOfDay();
    g.bank.endOfDay(this.today);
    this.phase = 'night';
    this.nightT = 0;
    this.game.hud.showSummary(this.day, this.today);
    this.game.save();
  }

  skipNight() {
    if (this.phase === 'night') this.nightT = DAY.night;
  }

  startDay() {
    this.day++;
    this.t = 0;
    this.phase = 'open';
    this.today = blankStats();
    this.game.hud.toast(`☀️ Gün ${this.day} başladı`);
    this.game.supply.rollCrisis();
    this.game.campaign.startDay();
    this.game.save();
  }

  applyLighting() {
    let h = this.hour % 24;
    if (h < SKY[0][0]) h += 24;
    let i = SKY.findIndex((k) => k[0] > h);
    if (i <= 0) i = i === 0 ? 1 : SKY.length - 1;
    const a = SKY[i - 1];
    const b = SKY[i];
    const f = THREE.MathUtils.clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
    const g = this.game;
    _c1.setHex(a[1]).lerp(_c2.setHex(b[1]), f);
    g.scene.background.copy(_c1);
    g.scene.fog.color.copy(_c1);
    g.sun.color.setHex(a[2]).lerp(_c2.setHex(b[2]), f);
    g.sun.intensity = THREE.MathUtils.lerp(a[3], b[3], f);
    g.hemi.intensity = THREE.MathUtils.lerp(a[4], b[4], f);
  }

  serialize() {
    return { day: this.day, t: this.phase === 'open' ? this.t : 0, phase: this.phase === 'open' ? 'open' : 'night', today: this.today };
  }

  restore(d) {
    if (!d) return;
    this.day = d.day ?? 1;
    this.t = d.t ?? 0;
    this.today = d.today ?? blankStats();
    if (d.phase === 'night') {
      // Gece kaydedildiyse sabahtan başla
      this.day++;
      this.t = 0;
      this.today = blankStats();
    }
  }
}

function blankStats() {
  return { revenue: 0, customers: 0, crates: 0, angry: 0, spent: 0 };
}
