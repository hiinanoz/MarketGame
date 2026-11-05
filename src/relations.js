import { t } from './i18n.js';
import { RELATIONS } from './config.js';

// İlişkiler (1.2): şehrin 7 önemli kişisiyle −100…+100 arası puan. Ajanda kararları ve etkinlikler değiştirir;
// puan sonraki tekliflerin türünü ve başarı ihtimalini etkiler (kartlarda `g.relations.chance(id, p)`).
// Banka müdürüyle iyi ilişki kredi faizini düşürür, kötü ilişki artırır. Her gün biraz sıfıra yaklaşır.

export class Relations {
  constructor(game) {
    this.game = game;
    this.score = Object.fromEntries(Object.keys(RELATIONS.people).map((k) => [k, 0]));
  }

  get(id) {
    return this.score[id] ?? 0;
  }

  /** Puanı değiştir; özet metni döner ("🏦 Nermin Hanım +5"). */
  change(id, n) {
    if (!(id in this.score)) return '';
    this.score[id] = Math.max(-100, Math.min(100, Math.round(this.score[id] + n)));
    const p = RELATIONS.people[id];
    return `${p.emoji} ${p.name} ${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n))}`;
  }

  /** Temel ihtimale ilişkinin etkisi (±%20'ye kadar). */
  chance(id, base) {
    return Math.max(0.05, Math.min(0.95, base + this.get(id) / 500));
  }

  /** Banka müdürü: kredi faizi çarpanı. */
  get bankRate() {
    const r = RELATIONS.bankRate;
    const v = this.get('banker');
    return v >= r.good ? r.goodMult : v <= r.bad ? r.badMult : 1;
  }

  /** Bu seviyede tanınan kişiler. */
  get people() {
    return Object.entries(RELATIONS.people).filter(([, p]) => !p.level || this.game.level >= p.level);
  }

  label(v) {
    return v >= 60 ? t('Dost') : v >= 20 ? t('Sıcak') : v > -20 ? t('Nötr') : v > -60 ? t('Soğuk') : t('Düşman');
  }

  endOfDay() {
    for (const k of Object.keys(this.score)) this.score[k] = Math.round(this.score[k] * (1 - RELATIONS.decay));
  }

  html() {
    return `<div class="rel-list">${this.people.map(([id, p]) => {
      const v = this.get(id);
      const w = Math.abs(v) / 2;
      return `<div class="rel"><span class="rel-e">${p.emoji}</span><div class="rel-t"><b>${p.name}</b><small>${p.role}</small></div>
        <div class="rel-bar"><i class="${v < 0 ? 'neg' : 'pos'}" style="width:${w}%;${v < 0 ? `right:50%` : 'left:50%'}"></i></div><em class="${v < 0 ? 'down' : v > 0 ? 'up' : ''}">${v > 0 ? '+' : ''}${v} · ${this.label(v)}</em></div>`;
    }).join('')}</div>`;
  }

  serialize() {
    return { ...this.score };
  }

  restore(d) {
    if (!d) return;
    for (const k of Object.keys(this.score)) if (typeof d[k] === 'number') this.score[k] = d[k];
  }
}
