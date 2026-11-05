import { t } from './i18n.js';
import { DAY, CEO } from './config.js';
import { formatMoney } from './hud.js';
import { CARDS } from './eventcards.js';
import { VENUES } from './venues.js';

// Günlük ajanda (1.2): her sabah sekreter günün listesini getirir (holding büyüdükçe 2–3'ten 4–6'ya).
// Madde türleri: 🗂️ karar (gün içinde ne zaman istersen), 🎟️ etkinlik / 🤝 toplantı / ⚽ maç (saat aralığı var;
// katılmak oyun saatini ilerletir, aynı saatteki iki etkinliğe gidilemez). Etkinlikler çok adımlı olabilir
// (masaya otur → müzayede…). Gün sonunda cevapsız madde "katılmadın" olarak kapanır (kartın `skip` etkisi);
// zorunlu maddeler (`mandatory`, ör. dava) varsayılan seçenekle kapanır. Geçici etkiler `mods` → çarpanlar.

const HOURS = DAY.closeHour - DAY.openHour;
const hourToT = (h) => ((h - DAY.openHour) / HOURS) * DAY.length;
const KIND = { decision: '🗂️', event: '🎟️', meeting: '🤝', match: '⚽' };

export class Events {
  constructor(game) {
    this.game = game;
    this.active = [];     // bugünkü ajanda: { id, vars, from, to, step, sum, notified }
    this.later = [];      // takip maddeleri: { id, day }
    this.cooldown = {};   // id → en son geldiği gün
    this.mods = [];       // { type: 'biz'|'customers', target, mult, until }
    this.log = [];        // son sonuçlar (en yeni başta)
    this.plannedDay = 0;
    this.closedDay = 0;
    this.busy = false;    // etkinlikteyken (zaman ilerliyor) yeni seçim yapılmaz
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

  /** Kart nerede cevaplanır: holding varsa CEO masası / plaza, yoksa kulüp ya da siyaset paneli. */
  homeOf(card) {
    const g = this.game;
    if (g.ceo?.founded) return 'ceo';
    if (card?.need === 'club') return 'club';
    if (card?.need === 'legal' && !g.politics?.started) return 'club';
    return 'politics';
  }

  /** Bugünün madde sayısı: holding büyüdükçe 2–3'ten 4–6'ya. Holding yoksa 1–2. */
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
    if (card.minLevel && g.level < card.minLevel) return false;
    if (card.maxLevel && g.level > card.maxLevel) return false;
    if ((this.cooldown[card.id] ?? -99) > g.day.day - CEO.cooldownDays) return false;
    if (this.active.some((a) => a.id === card.id)) return false;
    try { return card.when ? !!card.when(g) : true; } catch { return false; }
  }

  /** Maddenin saat aralığı (oyun saniyesi). Karar: tüm gün; etkinlik: kartın penceresi ya da rastgele. */
  windowOf(card) {
    if (card.window) return [hourToT(card.window[0]), hourToT(card.window[1])];
    if (!card.kind || card.kind === 'decision') return [0, DAY.length];
    const len = Math.max(...(card.steps?.start?.choices ?? card.choices ?? []).map((c) => c.hours ?? 0), 1) + 2;
    const start = 9 + Math.floor(Math.random() * Math.max(1, 21 - len - 9));
    return [hourToT(start), hourToT(Math.min(DAY.closeHour, start + len))];
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
    // Takip maddeleri bugün gelir
    for (const f of this.later.filter((x) => x.day <= g.day.day)) picked.push(CARDS.find((c) => c.id === f.id));
    this.later = this.later.filter((x) => x.day > g.day.day);
    for (const card of picked.filter(Boolean)) {
      this.cooldown[card.id] = g.day.day;
      let vars = {};
      try { vars = card.vars ? card.vars(g) : {}; } catch { vars = {}; }
      const [from, to] = this.windowOf(card);
      this.active.push({ id: card.id, vars, from, to, step: null, sum: [], notified: from <= 0 });
    }
    this.active.sort((a, b) => a.from - b.from);
    if (this.active.length) this.notifyDay();
  }

  update() {
    if (!this.enabled) return;
    const g = this.game;
    if (g.day.phase === 'open' && this.plannedDay !== g.day.day) this.planDay();
    if (g.day.phase === 'open') {
      // Saati gelen etkinlik için hatırlatma
      for (const a of this.active) {
        if (!a.notified && g.day.t >= a.from) {
          a.notified = true;
          const card = CARDS.find((c) => c.id === a.id);
          if (card) this.notifyStart(card, a);
        }
      }
    } else if (this.closedDay !== g.day.day) {
      this.closeDay();
    }
    // Biten geçici etkiler
    this.mods = this.mods.filter((m) => m.until >= g.day.day);
  }

  /** Gün sonu: cevapsız maddeler kapanır. */
  closeDay() {
    this.closedDay = this.game.day.day;
    for (const a of [...this.active]) {
      const card = CARDS.find((c) => c.id === a.id);
      if (!card) {
        this.active.splice(this.active.indexOf(a), 1);
        continue;
      }
      if (card.mandatory) this.choose(a, card.def ?? 0, { auto: true });
      else this.skip(a, card);
    }
  }

  /** "Katılmadın": kartın skip etkisi (varsa) ve kayıt. */
  skip(entry, card) {
    const g = this.game;
    this.active.splice(this.active.indexOf(entry), 1);
    const fx = this.effects(entry.vars);
    let extra = '';
    try { extra = card.skip?.(g, fx, entry.vars) ?? ''; } catch (e) { console.error(e); }
    const what = card.kind && card.kind !== 'decision' ? t('katılmadın') : t('cevapsız kaldı');
    this.addLog(`${card.emoji} ${t(card.title, entry.vars)} → ${what}${[...fx.summary, extra].filter(Boolean).length ? ` · ${[...fx.summary, extra].filter(Boolean).join(' · ')}` : ''}`);
  }

  addLog(text) {
    this.log.unshift({ day: this.game.day.day, text });
    this.log.length = Math.min(this.log.length, 16);
  }

  card(id) {
    return CARDS.find((c) => c.id === id);
  }

  /** Kartın şu anki adımı (çok adımlı etkinlik). */
  stepOf(card, entry) {
    if (entry?.step && card.steps?.[entry.step]) return card.steps[entry.step];
    return card.steps?.start ?? card;
  }

  /** Madde şu an cevaplanabilir mi? */
  isOpen(entry) {
    const g = this.game;
    return !this.busy && g.day.phase === 'open' && g.day.t >= entry.from && g.day.t < entry.to;
  }

  /** Seçeneği uygula. Etkinlik seçenekleri oyun saatini ilerletir; adım bitmediyse madde açık kalır. */
  choose(entry, index, { auto = false } = {}) {
    const g = this.game;
    const card = CARDS.find((c) => c.id === entry.id);
    if (!card) {
      this.active.splice(this.active.indexOf(entry), 1);
      return;
    }
    const step = this.stepOf(card, entry);
    const choice = step.choices[index] ?? step.choices[0];
    if (!auto && choice.when && !choice.when(g, entry.vars)) return;
    const fx = this.effects(entry.vars);
    let extra = '';
    try { extra = choice.do?.(g, fx, entry.vars) ?? ''; } catch (e) { console.error(e); }
    if (fx.jailed) extra = [extra, `⛓️ ${t('Hapis cezası')}`].filter(Boolean).join(' · ');
    entry.sum.push(...fx.summary);
    if (extra) entry.sum.push(extra);
    entry.labels = [...(entry.labels ?? []), t(choice.label, entry.vars)];
    const next = typeof choice.goto === 'function' ? choice.goto(g, entry.vars) : choice.goto;
    const finish = () => {
      if (next && card.steps?.[next] && !auto) {
        entry.step = next;
      } else {
        this.active.splice(this.active.indexOf(entry), 1);
        const text = `${card.emoji} ${t(card.title, entry.vars)} → ${entry.labels.join(' → ')}${auto ? ` (${t('süre doldu')})` : ''}${entry.sum.length ? ` · ${entry.sum.join(' · ')}` : ''}`;
        this.addLog(text);
        if (!this.panelOpen()) g.hud.toast(text);
      }
      g.hud.setMoney(g.money);
      this.refresh();
      if (fx.jailed) g.legal.sentence();
    };
    if (choice.hours && !auto) {
      this.busy = true;
      g.fastForward(choice.hours, `${card.emoji} ${t(card.title, entry.vars)}`, () => {
        this.busy = false;
        finish();
      });
    } else finish();
  }

  panelOpen() {
    const g = this.game;
    return !!(g.ceoDesk?.open || g.plaza?.open || g.venues?.open || g.club?.isOpen || g.politics?.isOpen);
  }

  refresh() {
    const g = this.game;
    g.ceoDesk?.render();
    g.plaza?.refresh();
    if (g.venues?.open) g.venues.render();
    if (g.club?.isOpen) g.club.render();
    if (g.politics?.isOpen) g.politics.render();
  }

  /** Sabah: günün ajandası hazır. */
  notifyDay() {
    const g = this.game;
    const n = this.active.length;
    const byHome = {};
    for (const a of this.active) {
      const card = CARDS.find((c) => c.id === a.id);
      const home = this.homeOf(card);
      byHome[home] = (byHome[home] ?? 0) + 1;
    }
    if (byHome.ceo) {
      g.ceoDesk.unseen = byHome.ceo;
      g.ceoDesk.syncButton();
    }
    for (const [home, panel] of [['club', g.club], ['politics', g.politics]]) {
      if (byHome[home] && panel) {
        panel.unseen = byHome[home];
        panel.syncBadge?.();
      }
    }
    if (!this.panelOpen()) {
      const sec = g.plaza?.secretary;
      g.hud.toast(sec ? `☎️ ${t('{name}: günün ajandası hazır — {n} madde', { name: sec.name, n })}` : `🗂️ ${t('Günün ajandası: {n} madde', { n })}`);
      g.audio.play('bell', 0.6);
    }
    this.refresh();
  }

  /** Etkinliğin saati geldi. */
  notifyStart(card, entry) {
    if (this.panelOpen()) return this.refresh();
    const g = this.game;
    g.hud.toast(`${card.emoji} ${t('Başladı: {title} ({from}–{to})', { title: t(card.title, entry.vars), from: this.clock(entry.from), to: this.clock(entry.to) })}`);
    g.audio.play('bell', 0.5);
  }

  clock(tSec) {
    const h = DAY.openHour + (tSec / DAY.length) * HOURS;
    const hh = Math.floor(h + 1e-6);
    const mm = Math.round((h - hh) * 60 / 15) * 15;
    return `${String(hh + (mm === 60 ? 1 : 0)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
  }

  /** Şehir modunda bu madde için mekâna gitmek gerekir mi? (etkinlik / toplantı / maç) */
  needsVenue(c) {
    return !!(this.game.cityMode && c.kind && c.kind !== 'decision' && c.place && VENUES[c.place]);
  }

  /** Bekleyen maddelerin HTML'i (where: 'ceo' | 'politics' | 'club'; opts.venue: yalnızca o mekândakiler). */
  agendaHtml(where, opts = {}) {
    const g = this.game;
    return this.active.map((a) => {
      const c = CARDS.find((x) => x.id === a.id);
      if (!c || this.homeOf(c) !== where) return '';
      const atVenue = opts.venue && c.place === opts.venue && (opts.venue !== 'biz' || a.vars?.id === opts.vars?.id);
      if (opts.venue && !atVenue) return '';
      const far = this.needsVenue(c) && !atVenue;
      const step = this.stepOf(c, a);
      const open = this.isOpen(a) && !far;
      const kind = c.kind ?? 'decision';
      const when = kind === 'decision' ? t('gün içinde') : `${this.clock(a.from)}–${this.clock(a.to)}`;
      const state = g.day.t < a.from ? `<span class="ag-wait">⏳ ${t('Başlangıç {time}', { time: this.clock(a.from) })}</span>` : '';
      const choices = step.choices.map((ch, i) => {
        const ok = !ch.when || ch.when(g, a.vars);
        const hrs = ch.hours ? ` <small>· ${t('{n} saat', { n: ch.hours })}</small>` : '';
        return `<button data-card="${a.id}" data-i="${i}" class="${i === c.def && c.mandatory ? 'def' : ''}" ${open && ok ? '' : 'disabled'}>${t(ch.label, a.vars)}${hrs}</button>`;
      }).join('');
      const progress = a.labels?.length ? `<p class="ag-prog">✔︎ ${a.labels.join(' → ')}${a.sum.length ? ` · ${a.sum.join(' · ')}` : ''}</p>` : '';
      return `<div class="ceo-card ag-${kind}${open ? '' : ' ag-later'}"><div class="ceo-card-h"><span class="ce">${c.emoji}</span><b>${t(c.title, a.vars)}</b></div>
        <div class="ag-meta">${KIND[kind]} ${when}${c.place ? ` · 📍 ${VENUES[c.place] ? g.venues.nameOf(c.place, a.vars) : t(c.place, a.vars)}` : ''}${c.mandatory ? ` · ⚠️ ${t('zorunlu')}` : ''}</div>
        ${progress}<p>${t(step.text ?? c.text, a.vars)}</p>${state}
        ${far ? `<div class="ag-far"><span>📍 ${t('Katılmak için mekâna git')}</span><button data-chauffeur="${a.id}" ${g.day.phase === 'open' && g.day.t < a.to && !this.busy ? '' : 'disabled'}>🚗 ${t('Şoförle git')} <small>· ${t('20 dk')}</small></button></div>` : ''}
        <div class="ceo-choices">${choices}</div></div>`;
    }).join('');
  }

  /** Bu ekranda bekleyen madde sayısı. */
  pending(where) {
    return this.active.filter((a) => this.homeOf(CARDS.find((c) => c.id === a.id)) === where).length;
  }

  /** Kart seçeneği tıklandıysa uygula (true döner). */
  handleAgendaClick(e) {
    const ch = e.target.closest('[data-chauffeur]');
    if (ch) {
      if (ch.disabled) return true;
      const entry = this.active.find((a) => a.id === ch.dataset.chauffeur);
      const card = entry && this.card(entry.id);
      if (card) {
        this.game.plaza.hide();
        this.game.drive.chauffeur(card.place, entry.vars);
      }
      return true;
    }
    const b = e.target.closest('[data-card]');
    if (!b) return false;
    if (b.disabled) return true;
    const entry = this.active.find((a) => a.id === b.dataset.card);
    if (entry && this.isOpen(entry)) this.choose(entry, Number(b.dataset.i));
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
      /** Takip maddesi n gün sonra. */
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
      /** Kişiyle ilişki. */
      rel(id, n) {
        const s = g.relations?.change(id, n);
        if (s) summary.push(s);
      },
      /** Halk memnuniyeti (siyaset). */
      happy(n) {
        if (!g.politics) return;
        g.politics.happyBonus = (g.politics.happyBonus ?? 0) + n;
        summary.push(`🙂 ${n >= 0 ? '+' : '−'}${Math.abs(n)} ${t('halk')}`);
      },
      /** Not (sonuç cümlesi). */
      note(s) {
        summary.push(s);
      },
      /** Hapis cezası (seçim uygulandıktan sonra hapis ekranı açılır). */
      jail() {
        this.jailed = true;
      },
      jailed: false,
      chance: (p) => Math.random() < p,
      /** İlişkiye bağlı ihtimal. */
      relChance: (id, p) => Math.random() < (g.relations?.chance(id, p) ?? p),
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
    return { v: 2, active: this.active, later: this.later, cooldown: this.cooldown, mods: this.mods, log: this.log, plannedDay: this.plannedDay, closedDay: this.closedDay };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this, { later: d.later ?? [], cooldown: d.cooldown ?? {}, mods: d.mods ?? [], log: d.log ?? [], closedDay: d.closedDay ?? 0 });
    if (d.v === 2) {
      this.active = (d.active ?? []).filter((a) => CARDS.some((c) => c.id === a.id));
      this.plannedDay = d.plannedDay ?? 0;
    } else {
      // Eski kartlar (anlık, süreli): bugünkü ajanda yeniden planlanır
      this.active = [];
      this.plannedDay = 0;
    }
  }
}
