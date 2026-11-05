import { t } from './i18n.js';
import { NEWS } from './config.js';

// Haberler (1.2-c, plan Bölüm D): olumsuz haberler gerçek durumdan doğar (hukuki risk → "gizli bağış", borç →
// "borçlar büyüyor", kalabalık kadro → "az maaş", gıda işletmesi → "hijyen" …). Sekreter haberi yayından
// 1 gün (tecrübeli asistan 2 gün) önce bildirir; ajandaya "Olumsuz haber geliyor" maddesi düşer. Plazadan basın
// açıklaması ya da medya binasına gidip rica / reklam anlaşması / rüşvet / olay çıkarma / kendi gazeten.
// Yayın günü sonunda haber çıkar (etki × çarpan) ya da durdurulmuş olur. Olumlu haber medya binasında yaptırılır.

export class News {
  constructor(game) {
    this.game = game;
    this.items = [];        // { id, type, outlet, day, mult, blocked, done }
    this.seq = 0;
    this.bribes = 0;        // üst üste rüşvetle durdurulan haber
    this.journalist = false; // araştırmacı gazeteci: rüşvet işlemez
    this.neutrality = 70;   // kendi gazetenin tarafsızlığı
    this.posDay = 0;        // bugün olumlu haber yaptırıldı mı
    this.lastCharity = -99; // son hayır işi günü (hayır haberi için)
    this.lastDay = 0;
  }

  get enabled() {
    return this.game.cityMode;
  }

  get notice() {
    return this.game.plaza.secretary?.notice ?? 0;
  }

  type(id) {
    return NEWS.types[id];
  }

  /** Bu gün hangi olumsuz haber türleri mümkün (gerçek duruma göre). */
  candidates() {
    const g = this.game;
    const out = [];
    const ownsFood = g.holding.owned.some((b) => ['field', 'barn', 'hall', 'restaurant'].includes(b.def.kind));
    if (g.totalStaff >= 40) out.push('wages');
    if (ownsFood) out.push('hygiene');
    if (g.politics?.started && (g.legal?.risk ?? 0) >= 35) out.push('donations', 'donations');
    if (g.politics?.campaignTime) out.push('smear');
    if (g.level >= 66 && g.bank.totalDebt > (g.finance?.companyValue ?? 0) * 0.2) out.push('debt');
    if (g.holding.get('hotel')?.owned) out.push('party');
    if (g.politics?.autocracy) out.push('king');
    return out;
  }

  /** Sabah: yeni olumsuz haber üretimi ve uyarı. */
  planDay() {
    const g = this.game;
    if (!this.enabled || this.lastDay === g.day.day) return;
    this.lastDay = g.day.day;
    const c = this.candidates();
    const chance = NEWS.chance * (g.politics?.campaignTime ? 2 : 1) * (this.game.holding.mediaOwned ? 0.7 : 1);
    if (!c.length || Math.random() > chance) return;
    if (this.items.some((n) => !n.done)) return; // aynı anda bir haber
    const type = c[Math.floor(Math.random() * c.length)];
    const outlet = g.holding.mediaOwned || Math.random() < 0.4 ? 'tv' : 'gazette';
    const n = { id: ++this.seq, type, outlet, day: g.day.day + this.notice, mult: 1, blocked: false, done: false };
    this.items.push(n);
    if (this.notice > 0) {
      g.events.addNow('news_warn', { nid: n.id, headline: t(this.type(type).title), outlet: outlet === 'tv' ? t('Manşet TV') : t('Kasaba Gazetesi'), venue: outlet, when: this.notice === 1 ? t('yarın') : t('{n} gün sonra', { n: this.notice }) });
    }
  }

  get(nid) {
    return this.items.find((n) => n.id === Number(nid));
  }

  /** Gün sonu: zamanı gelen haberler yayınlanır. */
  endOfDay(today) {
    const g = this.game;
    for (const n of this.items) {
      if (n.done || n.day > g.day.day) continue;
      n.done = true;
      const ty = this.type(n.type);
      if (n.blocked) {
        g.events.addLog(`📰 ${t('Haber yayınlanmadı: "{title}"', { title: t(ty.title) })}`);
        continue;
      }
      const m = n.mult * (g.politics?.campaignTime ? 2 : 1);
      const fx = g.events.effects({});
      if (ty.influence) fx.influence(Math.round(ty.influence * m));
      if (ty.customers) fx.customers(Math.round(ty.customers * m), 3);
      if (ty.biz) fx.biz('all', Math.round(ty.biz * m), 3);
      if (ty.stock && g.finance?.ipo) fx.note(`📈 ${t('hisse')} ${Math.round(ty.stock * m)}%`);
      const outlet = n.outlet === 'tv' ? t('Manşet TV') : t('Kasaba Gazetesi');
      const text = `📰 ${outlet}: "${t(ty.title)}" · ${fx.summary.join(' · ')}`;
      g.events.addLog(text);
      today.news = text;
      g.hud.toast(text);
      // Sebep ortadan kalkmadıysa aynı tür tekrar gelebilir; rüşvet serisi sayacı
      if (!n.bribed) this.bribes = 0;
    }
    this.items = this.items.filter((n) => !n.done || n.day > g.day.day - 3);
  }

  // ---- Olumsuz habere karşı yollar (ajanda kartı news_warn'dan) ----

  pressRelease(nid, E) {
    const n = this.get(nid);
    if (!n) return '';
    E.cash(-500);
    if (E.chance(0.6)) {
      n.mult = Math.min(n.mult, 0.5);
      return t('Açıklama işe yaradı: etki yarıya indi');
    }
    return t('Açıklama ilgi görmedi');
  }

  /** Medya binasında: rica / reklam / rüşvet / olay / kendi gazeten. */
  deal(nid, how, E) {
    const g = this.game;
    const n = this.get(nid);
    if (!n) return '';
    const own = n.outlet === 'gazette' && g.holding.mediaOwned;
    if (how === 'ask') {
      if (E.chance(0.35 + g.relations.get('editor') / 200)) {
        n.blocked = true;
        E.rel('editor', -5);
        return t('Haber durduruldu (bir iyilik borçlusun)');
      }
      return t('Rica geri çevrildi');
    }
    if (how === 'ads') {
      E.cash(-6000);
      E.customers(3, 7);
      E.rel('editor', 5);
      if (E.chance(0.6)) {
        n.blocked = true;
        return t('Reklam anlaşması: haber durduruldu');
      }
      n.mult = Math.min(n.mult, 0.5);
      return t('Haber yumuşatıldı');
    }
    if (how === 'bribe') {
      if (this.journalist) return t('Araştırmacı gazeteci rüşveti kabul etmedi');
      E.cash(-15000);
      E.risk(20);
      if (E.chance(0.85)) {
        n.blocked = true;
        n.bribed = true;
        this.bribes++;
        if (this.bribes >= 3) {
          this.journalist = true;
          E.later('journalist', 3);
        }
        if (E.chance(0.2)) E.later('bribe_scandal', 5);
        return t('Haber durduruldu');
      }
      n.mult = 1.3;
      return t('Rüşvet teklifi de habere eklendi!');
    }
    if (how === 'scene') {
      E.influence(-2);
      E.risk(10);
      E.rel('editor', -20);
      if (E.chance(0.25)) {
        n.blocked = true;
        return t('Haber geri çekildi');
      }
      n.mult = 1.5;
      return t('Haber daha sert çıkacak');
    }
    if (how === 'own' && own) {
      n.blocked = true;
      this.neutrality = Math.max(0, this.neutrality - 10);
      return t('Kendi gazetende haberi gömdün (tarafsızlık −10)');
    }
    return '';
  }

  // ---- Olumlu haber (medya binasında) ----

  get canPositive() {
    return this.posDay !== this.game.day.day;
  }

  positive(kind, E) {
    const g = this.game;
    if (!this.canPositive) return '';
    this.posDay = g.day.day;
    const boost = g.holding.mediaOwned && this.neutrality >= 70 ? 1.5 : 1;
    const win = (n) => {
      E.influence(Math.round(n * boost));
      return t('Olumlu haber çıktı');
    };
    if (kind === 'press') {
      E.cash(-2000);
      return E.chance(0.6) ? win(3) : t('Basın toplantısı ilgi görmedi');
    }
    if (kind === 'interview') return E.chance(0.6) ? win(4) : (E.influence(-2), t('Röportaj aleyhine döndü'));
    if (kind === 'sponsored') {
      E.cash(-8000);
      if (E.chance(0.1)) {
        E.influence(-3);
        return t('"Sponsorlu içerik" olduğu ortaya çıktı');
      }
      return win(4);
    }
    if (kind === 'charity') return win(4);
    return '';
  }

  serialize() {
    const { items, seq, bribes, journalist, neutrality, posDay, lastCharity, lastDay } = this;
    return { items, seq, bribes, journalist, neutrality, posDay, lastCharity, lastDay };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this, d);
    this.items ??= [];
  }
}
