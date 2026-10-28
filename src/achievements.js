import { platform } from './platform.js';

// Başarımlar: oyunda yerel olarak tutulur (kayıtta), iOS'ta Game Center'a da bildirilir.
// Kimlikler Game Center'da `mt.ach.<id>` olarak tanımlanır (apple/GAMECENTER.md).
export const ACHIEVEMENTS = [
  { id: 'first_shelf', name: 'İlk reyon', emoji: '🥕', check: (g) => g.shelves.length >= 2 },
  { id: 'first_cashier', name: 'Kasiyer işe alındı', emoji: '💳', check: (g) => g.workers.some((w) => w.role === 'cashier') },
  { id: 'level5', name: 'Mahallenin marketi (Sv.5)', emoji: '⭐', check: (g) => g.level >= 5 },
  { id: 'first_campaign', name: 'İlk kampanya', emoji: '📢', check: (g) => Object.keys(g.campaign.lastResults).length > 0 },
  { id: 'second_room', name: 'Genişleme', emoji: '🏗️', check: (g) => g.room2Open },
  { id: 'five_stars', name: 'Beş yıldız', emoji: '🌟', check: (g) => g.rating.stars >= 4.95 },
  { id: 'market_owner', name: 'Bina artık senin', emoji: '🏪', check: (g) => g.rent.marketOwned },
  { id: 'accountant', name: 'Muhasebeci işe aldın', emoji: '🧾', check: (g) => !!g.accountant },
  { id: 'first_supplier', name: 'İlk tedarikçi', emoji: '🌾', check: (g) => g.holding.owned.some((b) => b.def.products?.length) },
  { id: 'logistics', name: 'Kendi filon', emoji: '🚛', check: (g) => g.holding.logisticsOwned },
  { id: 'first_plant', name: 'Enerji üreticisi', emoji: '☀️', check: (g) => g.holding.owned.some((b) => b.isEnergy) },
  { id: 'free_power', name: 'Bedava elektrik', emoji: '⚡', check: (g) => g.energy.last && g.energy.last.consumption > 0 && g.energy.last.bill === 0 },
  { id: 'first_house', name: 'İlk ev', emoji: '🏠', check: (g) => g.housing.plots.some((p) => p.built) },
  { id: 'landlord', name: 'Ev sahibi', emoji: '🏘️', check: (g) => g.housing.plots.filter((p) => p.built).length >= 6 },
  { id: 'deed', name: 'Mahallenin tapusu', emoji: '📜', check: (g) => g.housing.deed },
  { id: 'branch', name: 'İlk şube', emoji: '🛍️', check: (g) => g.holding.owned.some((b) => b.def.kind === 'shop') },
  { id: 'media', name: 'Medya patronu', emoji: '📰', check: (g) => g.holding.mediaOwned },
  { id: 'staff100', name: '100 çalışan', emoji: '👥', check: (g) => g.totalStaff >= 100 },
  { id: 'mayor', name: 'Belediye başkanı', emoji: '🏛️', check: (g) => g.politics.mayor },
  { id: 'king', name: 'Otokrat', emoji: '👑', check: (g) => g.politics.autocracy },
  { id: 'takeover', name: 'Şirket avcısı', emoji: '📈', check: (g) => Object.keys(g.finance.stocks).some((k) => g.finance.controls(k)) },
  { id: 'own_bank', name: 'Kendi bankan', emoji: '🏦', check: (g) => !!g.finance.bank },
  { id: 'ipo', name: 'Halka arz', emoji: '🔔', check: (g) => g.finance.ipo },
  { id: 'bargain', name: 'Pazarlıkçı', emoji: '🤝', check: (g) => g.city.props.some((p) => p.owned && p.paid <= p.basePrice() * 0.76) },
  { id: 'ruler', name: 'Kasabanın Hakimi', emoji: '🏆', check: (g) => g.city.finished },
];

export class Achievements {
  constructor(game) {
    this.game = game;
    this.earned = new Set();
    this.t = 2;
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 3;
    for (const a of ACHIEVEMENTS) {
      if (this.earned.has(a.id)) continue;
      let ok = false;
      try { ok = a.check(this.game); } catch { ok = false; }
      if (!ok) continue;
      this.earned.add(a.id);
      this.game.hud.toast(`🏆 Başarım: ${a.emoji} ${a.name}`);
      platform.achievement(a.id);
      platform.haptic('MEDIUM');
    }
  }

  /** Game Center'a sonradan bağlanınca önceki başarımları da bildir. */
  syncAll() {
    for (const id of this.earned) platform.achievement(id);
  }

  serialize() {
    return [...this.earned];
  }

  restore(d) {
    this.earned = new Set(d ?? []);
  }
}
