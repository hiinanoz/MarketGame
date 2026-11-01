import { t } from './i18n.js';
import { LEGAL } from './config.js';
import { formatMoney } from './hud.js';

// Hukuk (siyaset 2.0): bazı kart seçenekleri (rüşvet, örtbas, yasa dışı bağış, basına baskı) gizli bir
// hukuki risk puanı ekler. Oyuncu yalnızca "Düşük / Orta / Yüksek" görür. Risk her gün biraz azalır;
// yüksekken savcılık soruşturma açabilir (olay kartı) → dava → hapis. Hapisteyken hapis ekranı açılır:
// kefalet öde / işletmeleri kayyuma devret (sonra geri al) / cezayı çek (3 gün; nüfuz düşer, makam gider).
// Temiz sicil (düşük risk) seçimlerde birkaç oy kazandırır.

export class Legal {
  constructor(game) {
    this.game = game;
    this.risk = 0;
    this.probe = false;       // soruşturma sürüyor (yeni soruşturma açılmaz)
    this.jailed = false;
    this.releaseDay = 0;
    this.served = false;      // cezayı çekmeyi seçti
    this.el = document.createElement('div');
    this.el.id = 'jail';
    this.el.className = 'overlay jail-overlay hidden';
    this.el.innerHTML = '<div class="panel jail"></div>';
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.el);
    this.panel = this.el.querySelector('.jail');
  }

  add(n) {
    this.risk = Math.max(0, Math.min(100, this.risk + n));
  }

  /** Belirsiz gösterge. */
  get level() {
    const [a, b] = LEGAL.levels;
    return this.risk < a ? 0 : this.risk < b ? 1 : 2;
  }

  get levelText() {
    return [`🟢 ${t('Düşük')}`, `🟡 ${t('Orta')}`, `🔴 ${t('Yüksek')}`][this.level];
  }

  /** Temiz sicil oyu (risk düşükse en fazla LEGAL.trustVote), yüksek riskte eksi. */
  get voteBonus() {
    if (this.risk < LEGAL.levels[0]) return Math.round(LEGAL.trustVote * (1 - this.risk / LEGAL.levels[0]));
    if (this.risk >= LEGAL.levels[1]) return -3;
    return 0;
  }

  endOfDay() {
    const g = this.game;
    if (this.jailed) return;
    this.add(-LEGAL.decay);
    if (!this.probe && this.risk > LEGAL.probeFrom && Math.random() < (this.risk - LEGAL.probeFrom) * LEGAL.probeChance) {
      this.probe = true;
      g.events.later.push({ id: 'probe', day: g.day.day + 1 });
    }
  }

  // ---- Hapis ----

  get bail() {
    return Math.max(LEGAL.bail.min, Math.round(this.game.money * LEGAL.bail.share / 1000) * 1000);
  }

  /** Kayyuma gidecek işletmeler: en ucuzdan başlayıp değeri kefaleti karşılayana kadar. */
  trusteeList() {
    const list = this.game.holding.owned.filter((b) => !b.leased).sort((a, b) => a.fullValue - b.fullValue);
    const out = [];
    let v = 0;
    for (const b of list) {
      if (v >= this.bail) break;
      out.push(b);
      v += b.fullValue;
    }
    return v >= this.bail ? out : [];
  }

  sentence() {
    const g = this.game;
    this.jailed = true;
    this.served = false;
    this.probe = false;
    g.hud.toast(`⚖️ ${t('Mahkeme hapis cezası verdi!')}`);
    g.audio.play('error');
    g.ceoDesk?.hide();
    this.show();
    g.save();
  }

  release(text) {
    const g = this.game;
    this.jailed = false;
    this.served = false;
    this.risk = Math.min(this.risk, 10);
    this.el.classList.add('hidden');
    document.body.classList.remove('in-jail');
    g.hud.toast(text);
    g.save();
  }

  payBail() {
    const g = this.game;
    const c = this.bail;
    if (g.money < c) return;
    g.spend(c);
    g.politics.temp += LEGAL.jailInfluence / 3;
    this.release(`🔓 ${t('Kefalet ödendi (${n}): serbestsin', { n: formatMoney(c) })}`);
  }

  trustee() {
    const list = this.trusteeList();
    if (!list.length) return;
    for (const b of list) {
      b.seize(Math.round(b.fullValue * LEGAL.trustee.buyBack));
      b.trustee = true;
    }
    this.game.politics.temp += LEGAL.jailInfluence / 3;
    this.release(`⚖️ ${t('{n} işletme kayyuma devredildi: serbestsin. 💼 tabletten geri alabilirsin.', { n: list.length })}`);
  }

  serve() {
    const g = this.game;
    this.served = true;
    this.releaseDay = g.day.day + LEGAL.sentenceDays;
    const p = g.politics;
    p.temp += LEGAL.jailInfluence;
    if (p.mayor || p.autocracy) {
      p.mayor = false;
      p.autocracy = false;
      p.wins = 0;
      p.taxRate = 0;
      g.isMayor = false;
      if (p.nextElection < g.day.day) p.nextElection = g.day.day + 1;
    }
    this.render();
    g.save();
  }

  /** Gün başı kontrolü (yeni gün açıldığında). */
  update() {
    if (!this.jailed) return;
    const g = this.game;
    if (this.served && g.day.day >= this.releaseDay) this.release(`🔓 ${t('Cezanı çektin, serbestsin. Yeni bir sayfa!')}`);
    else if (this.el.classList.contains('hidden')) this.show();
    else {
      this.tick = (this.tick ?? 0) + 1;
      if (this.tick % 30 === 0) this.render();
    }
  }

  show() {
    this.el.classList.remove('hidden');
    document.body.classList.add('in-jail');
    this.render();
  }

  render() {
    const g = this.game;
    const bail = this.bail;
    const list = this.trusteeList();
    if (this.served) {
      const left = Math.max(0, this.releaseDay - g.day.day);
      this.panel.innerHTML = `<div class="jail-bars"></div><h2>⛓️ ${t('Cezaevi')}</h2>
        <p>${t('Kalan: {n} gün. İşletmelerin müdürlerle, market çalışanlarınla dönüyor.', { n: left })}</p>
        <p class="note">${t('Hücre arkadaşın her sabah aynı fıkrayı anlatıyor. Fıkra hâlâ komik değil.')}</p>
        <div class="biz-btns"><button class="primary" data-skip ${g.simulating || g.day.phase !== 'open' ? 'disabled' : ''}>⏩ ${t('Günü bitir')}</button></div>`;
      return;
    }
    this.panel.innerHTML = `<div class="jail-bars"></div><h2>⛓️ ${t('Hapistesin!')}</h2>
      <p>${t('Avukatın üç yol sunuyor. Seçene kadar dışarıda hayat devam ediyor.')}</p>
      <button class="jail-opt" data-bail ${g.money < bail ? 'disabled' : ''}><b>💰 ${t('Kefalet öde')} · $${formatMoney(bail)}</b><small>${t('Hemen çık; nüfuz biraz düşer.')}</small></button>
      <button class="jail-opt" data-trustee ${list.length ? '' : 'disabled'}><b>⚖️ ${t('İşletmeleri kayyuma devret')}</b><small>${list.length ? t('{list} devredilir; sonra değerinin %{n}\'ine geri alırsın.', { list: list.map((b) => `${b.def.emoji} ${b.name}`).join(', '), n: Math.round(LEGAL.trustee.buyBack * 100) }) : t('Kefaleti karşılayacak kadar işletmen yok.')}</small></button>
      <button class="jail-opt" data-serve><b>⛓️ ${t('Cezanı çek ({n} gün)', { n: LEGAL.sentenceDays })}</b><small>${t('Ücretsiz; ama nüfuz çok düşer ve makamın varsa gider.')}</small></button>`;
  }

  onClick(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const g = this.game;
    if (b.dataset.bail !== undefined) this.payBail();
    else if (b.dataset.trustee !== undefined) this.trustee();
    else if (b.dataset.serve !== undefined) this.serve();
    else if (b.dataset.skip !== undefined) g.finishDay({ free: true });
    g.audio.play('click');
  }

  serialize() {
    const { risk, probe, jailed, releaseDay, served } = this;
    return { risk, probe, jailed, releaseDay, served };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this, d);
  }
}
