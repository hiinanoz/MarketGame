import { t } from './i18n.js';
import { DAY, CEO } from './config.js';
import { formatMoney } from './hud.js';
import { CARDS } from './eventcards.js';

// Olay kartları (holding kurulduktan sonra): her oyun günü birkaç kart gelir (haber, skandal, gizli görüşme…).
// Kartın seçenekleri anlık etki (para, nüfuz, memnuniyet) ve geçici çarpan (işletme verimi, müşteri) uygular,
// bazıları birkaç gün sonra takip kartı getirir. Cevapsız kart süre dolunca varsayılan (temkinli) seçenekle kapanır.

export class Events {
  constructor(game) {
    this.game = game;
    this.queue = [];      // bugün gelecek kartlar: { id, at } (at: gün içi saniye)
    this.active = [];     // ekranda bekleyen: { id, at, expires, vars }
    this.later = [];      // takip kartları: { id, day }
    this.cooldown = {};   // id → en son geldiği gün
    this.mods = [];       // { type: 'biz'|'customers', target, mult, until }
    this.log = [];        // son sonuçlar (en yeni başta)
    this.plannedDay = 0;
  }

  get enabled() {
    const g = this.game;
    return !!g.ceo?.founded || !!g.politics?.started || !!(g.club?.unlocked && g.club.involved);
  }

  /** Kartın ön koşulu: holding (varsayılan), siyaset, kulüp ya da hukuk (takip). */
  ready(card) {
    const g = this.game;
    const need = card.need ?? 'holding';
    if (need === 'holding') return !!g.ceo?.founded;
    if (need === 'politics') return !!g.politics?.started;
    if (need === 'club') return !!(g.club?.unlocked && g.club.involved);
    return true;
  }

  /** Kart nerede cevaplanır: holding varsa CEO masası, yoksa kulüp ya da siyaset paneli. */
  homeOf(card) {
    const g = this.game;
    if (g.ceo?.founded) return 'ceo';
    if (card?.need === 'club') return 'club';
    if (card?.need === 'legal' && !g.politics?.started) return 'club';
    return 'politics';
  }

  /** Bugünün kart sayısı: holding büyüdükçe 2–3'ten 4–6'ya. */
  dailyCount() {
    if (!this.game.ceo?.founded) return 1 + (this.game.politics?.campaignTime && Math.random() < 0.6 ? 1 : 0);
    const owned = this.game.holding.owned.length;
    const base = 2 + Math.floor(Math.max(0, owned - 4) / 3);
    return Math.min(CEO.maxCards, base + (Math.random() < 0.5 ? 1 : 0));
  }

  /** Para etkilerinin ölçeği: holding büyüdükçe tutarlar da büyür. */
  get scale() {
    const g = this.game;
    return Math.max(1, Math.round((g.finance?.companyValue ?? 0) / CEO.scaleDiv));
  }

  eligible(card) {
    const g = this.game;
    if (card.followup || !this.ready(card)) return false;
    if ((this.cooldown[card.id] ?? -99) > g.day.day - CEO.cooldownDays) return false;
    if (this.active.some((a) => a.id === card.id) || this.queue.some((q) => q.id === card.id)) return false;
    try { return card.when ? !!card.when(g) : true; } catch { return false; }
  }

  planDay() {
    const g = this.game;
    this.plannedDay = g.day.day;
    const pool = CARDS.filter((c) => this.eligible(c));
    const n = Math.min(pool.length, this.dailyCount());
    const picked = [];
    for (let i = 0; i < n; i++) {
      const total = pool.reduce((a, c) => a + (c.weight ?? 1), 0);
      let r = Math.random() * total;
      const k = pool.findIndex((c) => (r -= c.weight ?? 1) <= 0);
      picked.push(pool.splice(Math.max(0, k), 1)[0]);
    }
    // Takip kartları bugün gelir
    for (const f of this.later.filter((x) => x.day <= g.day.day)) picked.push(CARDS.find((c) => c.id === f.id));
    this.later = this.later.filter((x) => x.day > g.day.day);
    // Gün içine yay (sabah 9 – akşam 20 arası)
    const span = DAY.length;
    this.queue = picked.filter(Boolean).map((c, i, arr) => ({ id: c.id, at: span * (0.08 + (0.75 * (i + Math.random() * 0.8)) / arr.length) }));
  }

  update() {
    if (!this.enabled) return;
    const g = this.game;
    if (g.day.phase === 'open' && this.plannedDay !== g.day.day) this.planDay();
    const now = g.day.t;
    // Zamanı gelen kart ekrana
    for (const q of [...this.queue]) {
      if (g.day.phase !== 'open' || now < q.at) continue;
      this.queue.splice(this.queue.indexOf(q), 1);
      const card = CARDS.find((c) => c.id === q.id);
      if (!card) continue;
      this.cooldown[card.id] = g.day.day;
      const vars = card.vars ? card.vars(g) : {};
      this.active.push({ id: card.id, at: now, expires: now + DAY.length * CEO.expireShare, vars });
      this.notify(card, vars);
    }
    // Süresi dolan: varsayılan seçenek
    for (const a of [...this.active]) {
      if (g.day.phase === 'open' && now < a.expires) continue;
      const card = CARDS.find((c) => c.id === a.id);
      this.choose(a, card?.def ?? 0, true);
    }
    // Biten geçici etkiler
    this.mods = this.mods.filter((m) => m.until >= g.day.day);
  }

  /** Seçeneği uygula. */
  choose(entry, index, auto = false) {
    const g = this.game;
    const card = CARDS.find((c) => c.id === entry.id);
    this.active.splice(this.active.indexOf(entry), 1);
    if (!card) return;
    const choice = card.choices[index] ?? card.choices[0];
    const fx = this.effects(entry.vars);
    let extra = '';
    try { extra = choice.do?.(g, fx, entry.vars) ?? ''; } catch (e) { console.error(e); }
    if (fx.jailed) extra = [extra, `⛓️ ${t('Hapis cezası')}`].filter(Boolean).join(' · ');
    const text = `${card.emoji} ${t(card.title, entry.vars)} → ${t(choice.label, entry.vars)}${auto ? ` (${t('süre doldu')})` : ''}${fx.summary.length ? ` · ${fx.summary.join(' · ')}` : ''}${extra ? ` · ${extra}` : ''}`;
    this.log.unshift({ day: g.day.day, text });
    this.log.length = Math.min(this.log.length, 12);
    g.hud.setMoney(g.money);
    g.ceoDesk?.render();
    if (g.club?.isOpen) g.club.render();
    if (g.politics?.isOpen) g.politics.render();
    if (fx.jailed) g.legal.sentence();
    else if (!g.ceoDesk?.open) g.hud.toast(text);
  }

  /** Yeni kart: CEO masasına ya da (holding yoksa) siyaset / kulüp paneline. */
  notify(card, vars) {
    const g = this.game;
    const home = this.homeOf(card);
    if (home === 'ceo') return g.ceoDesk?.onCard(card, vars);
    const panel = home === 'club' ? g.club : g.politics;
    if (panel?.isOpen) return panel.render();
    if (panel) {
      panel.unseen = (panel.unseen ?? 0) + 1;
      panel.syncBadge?.();
    }
    g.hud.toast(`${card.emoji} ${t('Gündem: {title}', { title: t(card.title, vars) })}`);
    g.audio.play('bell', 0.6);
  }

  /** Bekleyen kartların HTML'i (where: 'ceo' | 'politics' | 'club'). */
  agendaHtml(where) {
    const g = this.game;
    return this.active.map((a) => {
      const c = CARDS.find((x) => x.id === a.id);
      if (!c || this.homeOf(c) !== where) return '';
      const left = Math.max(0, Math.min(100, ((a.expires - g.day.t) / (DAY.length * CEO.expireShare)) * 100));
      return `<div class="ceo-card"><div class="ceo-card-h"><span class="ce">${c.emoji}</span><b>${t(c.title, a.vars)}</b></div>
        <p>${t(c.text, a.vars)}</p>
        <div class="ceo-timer"><i data-left="${a.id}" style="width:${left}%"></i></div>
        <div class="ceo-choices">${c.choices.map((ch, i) => `<button data-card="${a.id}" data-i="${i}" class="${i === c.def ? 'def' : ''}">${t(ch.label, a.vars)}</button>`).join('')}</div></div>`;
    }).join('');
  }

  /** Kart seçeneği tıklandıysa uygula (true döner). */
  handleAgendaClick(e) {
    const b = e.target.closest('[data-card]');
    if (!b) return false;
    const entry = this.active.find((a) => a.id === b.dataset.card);
    if (entry) this.choose(entry, Number(b.dataset.i));
    this.game.audio.play('click');
    return true;
  }

  /** Kart seçeneklerinin kullandığı etki yardımcıları (özet metni de üretir). */
  effects(vars = {}) {
    const g = this.game;
    const ev = this;
    const summary = [];
    const sign = (n) => (n >= 0 ? `+$${formatMoney(n)}` : `−$${formatMoney(-n)}`);
    return {
      summary,
      vars,
      scale: ev.scale,
      /** Para (holding büyüklüğüyle ölçeklenir). */
      cash(n) {
        const v = Math.round(n * ev.scale);
        g.money += v;
        summary.push(`💵 ${sign(v)}`);
        return v;
      },
      /** Nüfuz (siyaset popülerliği). */
      influence(n) {
        if (!g.politics) return;
        g.politics.temp = Math.max(-50, g.politics.temp + n);
        summary.push(`⭐ ${n >= 0 ? '+' : '−'}${Math.abs(n)} ${t('nüfuz')}`);
      },
      /** Market memnuniyeti (0–100 ölçeği). */
      rating(n) {
        g.rating.add(n);
        summary.push(`😊 ${n >= 0 ? '+' : '−'}${Math.abs(n)}`);
      },
      /** İşletme verimi (yüzde) birkaç gün. target: işletme kimliği ya da 'all'. */
      biz(target, pct, days) {
        ev.mods.push({ type: 'biz', target, mult: 1 + pct / 100, until: g.day.day + days });
        summary.push(`🏭 ${pct >= 0 ? '+' : '−'}${t('%{n}', { n: Math.abs(pct) })} ${t('{n} gün', { n: days })}`);
      },
      /** Market müşterisi (yüzde) birkaç gün. */
      customers(pct, days) {
        ev.mods.push({ type: 'customers', mult: 1 + pct / 100, until: g.day.day + days });
        summary.push(`🛒 ${pct >= 0 ? '+' : '−'}${t('%{n}', { n: Math.abs(pct) })} ${t('{n} gün', { n: days })}`);
      },
      /** Takip kartı n gün sonra. */
      later(id, days) {
        ev.later.push({ id, day: g.day.day + days });
      },
      /** Gizli hukuki risk (oyuncu yalnızca yönünü görür). */
      risk(n) {
        g.legal?.add(n);
        if (n > 0) summary.push(`⚖️ ${t('hukuki risk ↑')}`);
        else if (n < 0) summary.push(`⚖️ ${t('hukuki risk ↓')}`);
      },
      /** Kulüp taraftar sevgisi. */
      fans(n) {
        if (!g.club) return;
        g.club.fans = Math.max(0, Math.min(100, g.club.fans + n));
        summary.push(`📣 ${n >= 0 ? '+' : '−'}${Math.abs(n)} ${t('taraftar')}`);
      },
      /** Hapis cezası (seçim uygulandıktan sonra hapis ekranı açılır). */
      jail() {
        this.jailed = true;
      },
      jailed: false,
      chance: (p) => Math.random() < p,
    };
  }

  /** İşletme verim çarpanı (holding bonusu + olay etkileri). */
  bizFactor(b) {
    let f = this.game.ceo?.founded ? CEO.holdingBonus : 1;
    for (const m of this.mods) if (m.type === 'biz' && (m.target === 'all' || m.target === b.id)) f *= m.mult;
    return f;
  }

  get customerFactor() {
    let f = 1;
    for (const m of this.mods) if (m.type === 'customers') f *= m.mult;
    return f;
  }

  serialize() {
    return { queue: this.queue, active: this.active, later: this.later, cooldown: this.cooldown, mods: this.mods, log: this.log, plannedDay: this.plannedDay };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this, { queue: d.queue ?? [], active: d.active ?? [], later: d.later ?? [], cooldown: d.cooldown ?? {}, mods: d.mods ?? [], log: d.log ?? [], plannedDay: d.plannedDay ?? 0 });
  }
}
