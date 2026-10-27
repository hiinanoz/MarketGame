import { PRODUCTS, GOALS, DAY } from './config.js';
import { formatMoney } from './hud.js';
import { confettiBurst } from './celebrate.js';

// Hedefler ve ödüller:
//  • 💎 elmas: görev, giriş takvimi ve kilometre taşlarından kazanılır, dekorasyonda harcanır
//  • Günlük görevler: her oyun gününün sabahı 3 yeni görev (ikisi tamamlanınca ek ödül)
//  • Giriş takvimi: gerçek takvimde her gün bir ödül, 7 günlük seri
//  • Müşteri kilometre taşları: 100, 500, 1000… müşteride büyük kutlama
//  • Çevrimdışı kazanç: uygulama kapalıyken çalışanların kazandığı (üst sınırlı)

export class Goals {
  constructor(game) {
    this.game = game;
    this.gems = 0;
    this.quests = [];     // { id, type, product?, target, progress, gems, money, done }
    this.questDay = 0;
    this.bonusDone = false;
    this.login = { last: '', streak: 0, claimed: '' };
    this.milestone = 0;   // ulaşılan son kilometre taşı (indeks + 1)
    this.offline = null;  // { amount, minutes } — gösterilecek
  }

  addGems(n, from = '') {
    if (n <= 0) return;
    this.gems += n;
    this.game.hud.setGems?.(this.gems);
    if (from) this.game.hud.toast(`💎 +${n} elmas · ${from}`);
  }

  spendGems(n) {
    if (this.gems < n) return false;
    this.gems -= n;
    this.game.hud.setGems?.(this.gems);
    this.game.save();
    return true;
  }

  // ---- Günlük görevler ----

  /** Sabah (ya da ilk açılışta): bugünün üç görevi. */
  rollQuests() {
    const g = this.game;
    const L = g.level;
    const day = g.day.day;
    if (this.questDay === day && this.quests.length) return;
    this.questDay = day;
    this.bonusDone = false;
    const products = [...new Set(g.shelves.filter((s) => !s.id.startsWith('campaign')).map((s) => s.product))];
    const avgRev = Math.max(150, ...(g.bank.history ?? [0]));
    const pool = [
      { type: 'customers', target: Math.round(20 + L * 5) },
      { type: 'revenue', target: Math.round(avgRev * 0.7 / 10) * 10 },
      { type: 'cash', target: 4 + Math.floor(L / 10) },
      { type: 'buy', target: 1 },
    ];
    if (products.length) {
      const p = products[Math.floor(Math.random() * products.length)];
      pool.push({ type: 'sell', product: p, target: Math.round(8 + L * 1.5) });
    }
    if (L <= 40) pool.push({ type: 'stock', target: Math.round(12 + L) });
    if (g.campaign.unlocked) pool.push({ type: 'campaign', target: 1 });
    if (g.online?.operating) pool.push({ type: 'online', target: 10 + Math.floor(L / 5) });
    if (L >= 2) pool.push({ type: 'rating', target: 45 });
    // Rastgele 3 farklı tür
    const picked = [];
    while (picked.length < 3 && pool.length) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    this.quests = picked.map((q, i) => ({
      ...q,
      id: `${day}-${i}`,
      progress: 0,
      gems: 2 + Math.floor(Math.random() * 3),
      money: Math.round((60 + L * 30) / 10) * 10,
      done: false,
    }));
  }

  /** Oyun olayları: görev ilerlemesi. */
  event(type, n = 1, product = null) {
    for (const q of this.quests) {
      if (q.done || q.type !== type) continue;
      if (q.product && q.product !== product) continue;
      q.progress = Math.min(q.target, q.progress + n);
      if (q.progress >= q.target) this.complete(q);
    }
  }

  complete(q) {
    const g = this.game;
    q.done = true;
    g.money += q.money;
    g.hud.setMoney(g.money);
    this.addGems(q.gems);
    g.hud.toast(`🎯 Görev tamam: ${questText(q)} · +$${formatMoney(q.money)} 💎${q.gems}`);
    g.audio.play('unlock');
    confettiBurst(36);
    if (!this.bonusDone && this.quests.every((x) => x.done)) {
      this.bonusDone = true;
      g.later.push({ t: 1.5, fn: () => {
        this.addGems(GOALS.allQuestsGems, 'günün tüm görevleri');
        confettiBurst(60);
      } });
    }
    g.hud.syncQuests?.();
  }

  /** Sürekli kontrol edilenler (memnuniyet). */
  update() {
    const r = this.game.rating.value;
    for (const q of this.quests) {
      if (q.done || q.type !== 'rating') continue;
      q.progress = Math.round(r * 10);
      if (q.progress >= q.target && this.game.day.isOpen) this.complete(q);
    }
  }

  // ---- Giriş takvimi (gerçek gün) ----

  get today() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  /** Bugün alınacak ödül var mı? Seri günü (1..7). */
  get loginPending() {
    return this.login.claimed !== this.today;
  }

  get loginDay() {
    const yesterday = new Date(Date.now() - 864e5);
    const y = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`;
    if (this.login.claimed === this.today) return this.login.streak;
    const cont = this.login.claimed === y;
    return cont ? (this.login.streak % 7) + 1 : 1;
  }

  loginReward(day) {
    const r = GOALS.login[day - 1];
    const scale = 1 + this.game.level / 8;
    return { gems: r.gems, money: Math.round((r.money * scale) / 10) * 10 };
  }

  claimLogin() {
    if (!this.loginPending) return null;
    const day = this.loginDay;
    const r = this.loginReward(day);
    this.login = { last: this.today, streak: day, claimed: this.today };
    const g = this.game;
    g.money += r.money;
    g.hud.setMoney(g.money);
    this.addGems(r.gems);
    g.audio.play('levelup');
    confettiBurst(day === 7 ? 90 : 50);
    g.save();
    return r;
  }

  // ---- Müşteri kilometre taşları ----

  checkMilestone() {
    const n = this.game.stats.customers ?? 0;
    const list = GOALS.milestones;
    if (this.milestone >= list.length || n < list[this.milestone][0]) return;
    const [count, gems] = list[this.milestone];
    this.milestone++;
    this.addGems(gems);
    // Günü tamamla simülasyonunda kutlama, simülasyon bitince başlar
    if (this.game.simulating) {
      this.pendingParty = [count, gems];
      return;
    }
    this.game.party.start(`🎉 ${count.toLocaleString('tr-TR')}. müşteri!`, `Herkes kutluyor · 💎 +${gems}`, GOALS.partySeconds);
  }

  // ---- Çevrimdışı kazanç ----

  /**
   * Kayıttan bu yana geçen gerçek süre için kazanç: son günlerin ortalama günlük gelirinin
   * küçük bir kısmı (müdür yoksa yarısı), en fazla GOALS.offlineHours saat.
   */
  computeOffline(savedAt) {
    const g = this.game;
    if (!savedAt) return null;
    const ms = Date.now() - savedAt;
    if (ms < GOALS.offlineMinMinutes * 60e3) return null;
    const hist = g.bank.history ?? [];
    const avg = hist.length ? hist.reduce((a, b) => a + b, 0) / hist.length : 0;
    const staff = g.workers.filter((w) => w.role === 'cashier').length;
    if (avg <= 0 || !staff) return null;
    const capped = Math.min(ms, GOALS.offlineHours * 3600e3);
    const gameDays = capped / 1000 / (DAY.length + DAY.night);
    const hasManager = g.workers.some((w) => w.role === 'manager');
    const amount = Math.round(avg * gameDays * GOALS.offlineRate * (hasManager ? 1 : 0.5));
    if (amount < 10) return null;
    return { amount, minutes: Math.round(ms / 60e3), capped: ms > GOALS.offlineHours * 3600e3, manager: hasManager };
  }

  serialize() {
    return { gems: this.gems, quests: this.quests, questDay: this.questDay, bonusDone: this.bonusDone, login: this.login, milestone: this.milestone };
  }

  restore(d) {
    if (!d) {
      // Eski kayıt: geçilmiş kilometre taşlarını kutlamadan işaretle
      const n = this.game.stats.customers ?? 0;
      this.milestone = GOALS.milestones.filter(([c]) => c <= n).length;
      return;
    }
    this.gems = d.gems ?? 0;
    this.quests = d.quests ?? [];
    this.questDay = d.questDay ?? 0;
    this.bonusDone = !!d.bonusDone;
    this.login = d.login ?? this.login;
    this.milestone = d.milestone ?? 0;
  }
}

/** Görevin okunur metni. */
export function questText(q) {
  switch (q.type) {
    case 'customers': return `${q.target} müşteriye hizmet et`;
    case 'revenue': return `Bugün $${formatMoney(q.target)} ciro yap`;
    case 'cash': return `Kasadan ${q.target} kez para topla`;
    case 'buy': return 'Yeni bir alan satın al';
    case 'sell': return `${q.target} kasa ${PRODUCTS[q.product].emoji} ${PRODUCTS[q.product].name} sat`;
    case 'stock': return `Rafa kendin ${q.target} kasa koy`;
    case 'campaign': return 'Yarın için kampanya hazırla';
    case 'online': return `${q.target} online sipariş teslim et`;
    case 'rating': return 'Memnuniyeti 4.5 yıldıza çıkar';
    default: return q.type;
  }
}

export function questEmoji(q) {
  return { customers: '🧑‍🤝‍🧑', revenue: '💵', cash: '💰', buy: '🟩', sell: PRODUCTS[q.product]?.emoji ?? '📦', stock: '📦', campaign: '📢', online: '🌐', rating: '⭐' }[q.type] ?? '🎯';
}
