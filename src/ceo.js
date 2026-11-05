import { t } from './i18n.js';
import { CEO, DAY } from './config.js';
import { formatMoney } from './hud.js';

// Holding ve CEO masası: 4 işletme sahibi olunca holding kurulur (ücret + isim). CEO masasında harita çizilmez
// (ısınma da azalır); gösterge tablosu, günün olay kartları ve işletme tablosuyla oyun ekrandan yönetilir.
// İstendiğinde haritaya dönülür, HUD'daki 🏢 ile tekrar masaya geçilir. Zaman her iki modda da akar.

export class CeoDesk {
  constructor(game) {
    this.game = game;
    this.founded = false;
    this.name = '';
    this.open = false;
    this.unseen = 0;
    this.btn = document.getElementById('ceo-btn');
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', () => this.show());
    this.el = document.createElement('div');
    this.el.id = 'ceo';
    this.el.className = 'overlay ceo-overlay hidden';
    this.el.innerHTML = '<div class="panel ceo"><div class="ceo-head"></div><div class="ceo-body"></div></div>';
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.el);
    this.head = this.el.querySelector('.ceo-head');
    this.body = this.el.querySelector('.ceo-body');
    this.tick = 0;
  }

  /** Holding kurulabilir mi (4+ işletme)? */
  get canFound() {
    return !this.founded && this.game.holding.owned.length >= CEO.foundBusinesses;
  }

  found(name) {
    const g = this.game;
    if (!this.canFound || g.money < CEO.foundCost) return false;
    g.spend(CEO.foundCost);
    this.founded = true;
    this.name = String(name || '').trim().slice(0, 24) || t('{name} Holding', { name: g.marketName === 'Kasaba' ? t('Kasaba') : g.marketName });
    g.gainXp(40);
    g.hud.toast(`🏢 ${t('{name} kuruldu! CEO masası açıldı (tüm işletmelere +%5 verim)', { name: this.name })}`);
    g.audio.play('levelup');
    this.syncButton();
    g.save();
    this.show();
    return true;
  }

  syncButton() {
    this.btn.classList.toggle('hidden', !this.founded);
    this.btn.querySelector('i').classList.toggle('hidden', !this.unseen);
    this.btn.querySelector('i').textContent = this.unseen || '';
  }

  show() {
    if (!this.founded) return;
    if (this.game.cityMode) {
      if (this.open) this.hide();
      return this.game.plaza.show();
    }
    this.open = true;
    this.unseen = 0;
    this.syncButton();
    this.el.classList.remove('hidden');
    document.body.classList.add('in-ceo');
    this.render();
  }

  hide() {
    this.open = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('in-ceo');
  }

  /** Yeni kart geldi (masa kapalıysa rozet + bildirim). */
  onCard(card, vars) {
    if (this.open) return this.render();
    this.unseen++;
    this.syncButton();
    this.game.hud.toast(`${card.emoji} ${t('Gündem: {title}', { title: t(card.title, vars) })}`);
    this.game.audio.play('bell', 0.6);
  }

  update() {
    if (!this.open) return;
    // Saat, para ve kart süreleri her yarım saniyede
    this.tick = (this.tick + 1) % 15;
    if (this.tick === 0) this.renderHead();
  }

  renderHead() {
    const g = this.game;
    const fin = g.finance;
    const profit = (g.bank.history ?? []).at(-1) ?? 0;
    this.head.innerHTML = `<div class="ceo-title"><b>🏢 ${esc(this.name)}</b><span>${t('Gün {n}', { n: g.day.day })} · ${g.day.clockText}</span><button class="primary" data-map>🗺️ ${t('Haritaya dön')}</button></div>
      <div class="ceo-stats">
        <div><span>💵 ${t('Nakit')}</span><b>$${formatMoney(Math.round(g.money))}</b></div>
        <div><span>🏢 ${t('Şirket değeri')}</span><b>$${formatMoney(Math.round(fin?.companyValue ?? 0))}</b></div>
        <div><span>📊 ${t('Dün kâr')}</span><b class="${profit >= 0 ? 'up' : 'down'}">${profit >= 0 ? '+' : '−'}$${formatMoney(Math.abs(Math.round(profit)))}</b></div>
        <div><span>⭐ ${t('Nüfuz')}</span><b>${t('%{n}', { n: g.politics?.popularity ?? 0 })}</b></div>
      </div>`;
  }

  render() {
    if (!this.open) return;
    if (this.game.cityMode) return this.show(); // şehir moduna geçildi: plaza
    const g = this.game;
    const ev = g.events;
    this.renderHead();
    const cards = ev.agendaHtml('ceo');
    const agenda = cards || `<p class="note">${g.day.phase === 'open' ? t('Bugünün gündemi tamam. Yarın yeni konular gelecek.') : t('Gece: gündem sabah açılır.')}</p>`;
    const table = this.dossierHtml();
    this.body.innerHTML = `
      <h4>🗂️ ${t('Günün gündemi')}</h4>${agenda}
      ${ev.log.length ? `<h4>📜 ${t('Son gelişmeler')}</h4>${this.logHtml(6)}` : ''}
      ${table}
      <div class="biz-btns"><button data-tablet>💼 ${t('Tableti aç')}</button></div>`;
  }

  logHtml(n = 6) {
    return `<div class="ceo-log">${this.game.events.log.slice(0, n).map((l) => `<div>${t('Gün {n}', { n: l.day })}: ${l.text}</div>`).join('')}</div>`;
  }

  /** İşletmeler tablosu (CEO masası ve plazadaki dosya dolabı). */
  dossierHtml() {
    const g = this.game;
    const rows = g.holding.owned.map((b) => {
      const y = b.yesterday;
      return `<tr><td>${b.def.emoji} ${esc(b.name)}</td><td>${b.modules}/${b.maxModules}</td><td>${b.workers}${b.manager ? ' · 🟥' : ''}</td><td class="${(y?.profit ?? 0) >= 0 ? 'up' : 'down'}">${y ? `${y.profit >= 0 ? '+' : '−'}$${formatMoney(Math.abs(Math.round(y.profit)))}` : '—'}</td>
        <td>${b.nextModule() && g.level >= b.nextModule().level ? `<button data-expand="${b.id}" ${g.money < b.nextModule().cost ? 'disabled' : ''}>🏗️ $${formatMoney(b.nextModule().cost)}</button>` : ''}</td></tr>`;
    }).join('');
    const market = g.gm.active ? `🧑‍💼 ${t('Genel müdür yönetiyor')} · ~$${formatMoney(Math.round(g.gm.dailyRevenue))}/${t('gün')}` : `⚠️ ${t('Market senin yönetiminde — genel müdür alırsan CEO masasından ayrılmana gerek kalmaz')}`;
    return `<h4>🏭 ${t('İşletmeler')}</h4>
      <p class="note">🛒 ${esc(g.marketTitle)} · ${market}</p>
      <div class="ceo-table"><table><thead><tr><th>${t('İşletme')}</th><th>${t('Modül')}</th><th>${t('Personel')}</th><th>${t('Dün')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">${t('Ayrıntılı yönetim (personel, satış, kira) için 💼 tablet; haritada gezmek için "Haritaya dön".')}</p>`;
  }

  onClick(e) {
    const g = this.game;
    if (e.target.closest('[data-map]')) return this.hide();
    if (e.target.closest('[data-tablet]')) {
      this.hide();
      g.holding.open('biz');
      return;
    }
    const exp = e.target.closest('[data-expand]');
    if (exp && !exp.disabled) {
      g.holding.get(exp.dataset.expand)?.expand();
      return this.render();
    }
    if (g.events.handleAgendaClick(e)) this.render();
  }

  serialize() {
    return { founded: this.founded, name: this.name, events: this.game.events.serialize() };
  }

  restore(d) {
    if (!d) return;
    this.founded = !!d.founded;
    this.name = d.name ?? '';
    this.game.events.restore(d.events);
    this.syncButton();
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
