import { Business } from './business.js';
import { formatMoney } from './hud.js';
import { BUSINESSES, STAFF, REGIONS } from './config.js';

// Holding: tedarikçi işletmeleri + tablet ekranı (İşletmeler / Harita ile hızlı geçiş).

export class Holding {
  constructor(game) {
    this.game = game;
    this.businesses = Object.keys(BUSINESSES).map((id) => new Business(game, id));
    this.el = document.getElementById('holding');
    this.body = document.getElementById('holding-body');
    this.tab = 'biz';
    this.btn = document.getElementById('holding-btn');
    this.btn.addEventListener('click', () => this.open('biz'));
    document.getElementById('map-btn').addEventListener('click', () => this.open('map'));
    document.getElementById('holding-close').addEventListener('click', () => this.close());
    for (const el of [this.el, this.btn, document.getElementById('map-btn')]) {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    this.el.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
      this.tab = b.dataset.tab;
      this.render();
    }));
    this.body.addEventListener('click', (e) => this.onClick(e));
    this.body.addEventListener('pointerdown', () => { this.pointerDown = true; });
    window.addEventListener('pointerup', () => { this.pointerDown = false; });
  }

  get(id) {
    return this.businesses.find((b) => b.id === id);
  }

  get owned() {
    return this.businesses.filter((b) => b.owned);
  }

  update(dt) {
    for (const b of this.businesses) b.update(dt);
    this.btn.classList.toggle('hidden', this.game.level < 21);
    if (this.isOpen) {
      this.tick = (this.tick ?? 0) + dt;
      if (this.tick > 1.5) {
        this.tick = 0;
        if (!this.pointerDown) this.render();
      }
    }
  }

  /** Gün sonu: işletmelerin maaşları ve kârı. Özet için toplam döner. */
  endOfDay(today) {
    let profit = 0;
    let wages = 0;
    for (const b of this.owned) {
      const r = b.endOfDay();
      profit += r.profit;
      wages += r.wages;
    }
    if (this.owned.length) today.holding = { profit, wages, count: this.owned.length };
    this.game.hud.setMoney(this.game.money);
  }

  // ---- Tablet ----

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open(tab) {
    this.tab = tab;
    this.el.classList.remove('hidden');
    this.render();
  }

  close() {
    this.el.classList.add('hidden');
  }

  render() {
    this.el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === this.tab));
    this.body.innerHTML = this.tab === 'map' ? this.renderMap() : this.renderBusinesses();
  }

  renderBusinesses() {
    const g = this.game;
    const m = g.money;
    const day = g.day.today;
    const acc = g.accountant;
    const cards = [`
      <div class="biz owned">
        <div class="biz-head"><span class="biz-e">🛒</span><div><b>Market</b><small>Bugün: $${formatMoney(day.revenue)} ciro · ${day.customers} müşteri · ⭐ ${g.rating.stars.toFixed(1)}</small></div></div>
        <div class="biz-row"><span>Muhasebeci</span><b>${acc ? '🧑‍💼 çalışıyor' : g.level >= 21 ? 'muhasebe odasının yanından işe al' : '🔒 Sv.21'}</b></div>
        <div class="biz-btns"><button data-go="market">📍 Git</button><button data-go="office">🧾 Muhasebe</button></div>
      </div>`];
    for (const b of this.businesses) {
      const d = b.def;
      if (!b.owned) {
        const locked = g.level < d.level;
        cards.push(`
          <div class="biz ${locked ? 'locked' : ''}">
            <div class="biz-head"><span class="biz-e">${d.emoji}</span><div><b>${d.name}</b><small>Sahibi: ${d.owner} · Ürün: ${d.products.length} çeşit</small></div></div>
            <div class="biz-btns">
              ${locked ? `<span class="lock">🔒 Seviye ${d.level}'te satılığa çıkar</span>` : `<button class="primary" data-buy="${b.id}" ${m < d.price ? 'disabled' : ''}>Satın al $${formatMoney(d.price)}</button>`}
              ${g.level >= 22 ? `<button data-go="biz:${b.id}">📍 Git</button>` : ''}
            </div>
          </div>`);
        continue;
      }
      const next = b.nextModule();
      const y = b.yesterday;
      const eff = Math.round(b.efficiency * 100);
      const W = STAFF.wage;
      const H = STAFF.hire;
      cards.push(`
        <div class="biz owned">
          <div class="biz-head"><span class="biz-e">${d.emoji}</span><div><b>${d.name}</b><small>Modül ${b.modules}/${b.maxModules} · verim %${eff}${!b.manager && !b.playerHere ? ' (müdür yok)' : ''}</small></div></div>
          <div class="biz-row"><span>👷 İşçi</span><b>${b.workers}/${b.workerSlots}</b><button data-hire="${b.id}:worker" ${b.workers >= b.workerSlots || m < H.worker ? 'disabled' : ''}>+ $${H.worker}</button></div>
          <div class="biz-row"><span>🟥 Müdür</span><b>${b.manager ? 'var' : 'yok'}</b>${b.manager ? '' : g.level < STAFF.levels.manager ? `<span class="lock">Sv.${STAFF.levels.manager}</span>` : `<button data-hire="${b.id}:manager" ${m < H.manager ? 'disabled' : ''}>Al $${formatMoney(H.manager)}</button>`}</div>
          <div class="biz-row"><span>🟦 Muhasebeci</span><b>${b.accountant ? 'var' : 'yok'}</b>${b.accountant ? '' : g.level < STAFF.levels.accountant ? `<span class="lock">Sv.${STAFF.levels.accountant}</span>` : `<button data-hire="${b.id}:accountant" ${m < H.accountant ? 'disabled' : ''}>Al $${formatMoney(H.accountant)}</button>`}</div>
          <div class="biz-row"><span>📦 Depo</span><b>${b.stored}/${STAFF.storage}</b><button data-sell="${b.id}" ${!b.stored ? 'disabled' : ''}>Fazlayı sat</button></div>
          ${b.independent ? `<div class="biz-row"><span>🤖 Bağımsız</span><b>işçi alır${b.autoGrow ? ', büyür' : ''}</b><button data-grow="${b.id}">${b.autoGrow ? 'Büyümeyi durdur' : 'Kendi büyüsün'}</button></div>` : ''}
          <div class="biz-row"><span>💵 Dün</span><b>${y ? `${y.profit >= 0 ? '+' : '−'}$${formatMoney(Math.abs(y.profit))}` : '—'}</b><small>maaş $${b.dailyWages}/gün</small></div>
          <div class="biz-btns">
            ${next ? (g.level < next.level ? `<span class="lock">${b.modules + 1}. modül: Sv.${next.level}</span>` : `<button class="primary" data-expand="${b.id}" ${m < next.cost ? 'disabled' : ''}>🏗️ Büyüt $${formatMoney(next.cost)}</button>`) : '<span class="lock">En büyük boyutta</span>'}
            <button data-go="biz:${b.id}">📍 Git</button>
          </div>
        </div>`);
    }
    return `<p class="note">İşçi maaşı $${W_text()} · Müdür yokken işletme sen oradaysan tam hızda, değilsen %${Math.round(STAFF.noManagerRate * 100)} hızda çalışır. Tarlada/üretimde dolaşırsan sen de üretirsin; 📦 alanından kasa alıp markete kendin taşıyabilirsin. Müdür + muhasebeci olunca işletme bağımsız çalışır.</p>${cards.join('')}`;
  }

  renderMap() {
    const g = this.game;
    return `<div class="regions">${REGIONS.map((r) => {
      const locked = g.level < r.level;
      return `<button class="region ${locked ? 'locked' : ''}" data-region="${r.id}" ${locked ? 'disabled' : ''}>
        <span class="biz-e">${r.emoji}</span><span>${r.name}</span><small>${locked ? `🔒 Sv.${r.level}${r.soon ? ' · yakında' : ''}` : 'Git →'}</small></button>`;
    }).join('')}</div>`;
  }

  onClick(e) {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.buy) this.get(d.buy).buy();
    if (d.expand) this.get(d.expand).expand();
    if (d.hire) {
      const [id, role] = d.hire.split(':');
      this.get(id).hire(role);
    }
    if (d.sell) {
      const r = this.get(d.sell).sellSurplus(0);
      if (r.n) this.game.hud.toast(`💵 ${r.n} kasa satıldı (+$${r.income})`);
    }
    if (d.grow) {
      const b = this.get(d.grow);
      b.autoGrow = !b.autoGrow;
    }
    if (d.go) this.goTo(d.go);
    if (d.region) this.goTo(d.region);
    if (this.isOpen) this.render();
  }

  /** Hızlı geçiş: oyuncuyu bölgeye ışınla. */
  goTo(key) {
    let pos;
    if (key.startsWith('biz:')) {
      const b = this.get(key.slice(4));
      pos = [b.x, -35.8];
    } else {
      pos = REGIONS.find((r) => r.id === key)?.pos;
    }
    if (!pos) return;
    const g = this.game;
    g.player.position.set(pos[0], 0, pos[1]);
    g.cameraTarget.copy(g.player.position);
    g.player.stop?.();
    this.close();
    g.audio.play('pick');
  }

  serialize() {
    return Object.fromEntries(this.businesses.map((b) => [b.id, b.serialize()]));
  }

  restore(d) {
    if (!d) return;
    for (const b of this.businesses) b.restore(d[b.id]);
  }
}

function W_text() {
  const w = STAFF.wage;
  return `${w.worker}, müdür $${w.manager}, muhasebeci $${w.accountant} (günlük)`;
}
