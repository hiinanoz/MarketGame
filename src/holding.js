import { Business } from './business.js';
import { formatMoney } from './hud.js';
import { BUSINESSES, STAFF, REGIONS, LOGISTICS, ELECTRICITY, HOUSING, RENT, PREMIUM } from './config.js';
import { stageName } from './housing.js';
import { t } from './i18n.js';

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
    this.body.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.id === 'rename-input') this.body.querySelector('[data-rename-save]')?.click();
      e.stopPropagation(); // klavyeyle yürüme tuşları yazarken çalışmasın
    });
    this.body.addEventListener('pointerdown', () => { this.pointerDown = true; });
    window.addEventListener('pointerup', () => { this.pointerDown = false; });
  }

  get(id) {
    return this.businesses.find((b) => b.id === id);
  }

  get owned() {
    return this.businesses.filter((b) => b.owned);
  }

  /** Sahip olunan işletmelerin müşteri çarpanı (AVM, havalimanı). */
  get customerFactor() {
    let f = 1;
    for (const b of this.owned) if (b.def.customers) f *= b.def.customers;
    return f;
  }

  /** Liman: ithalatla mal alımında indirim (modül başına). */
  get importDiscount() {
    const p = this.get('port');
    return p?.owned ? Math.min(0.3, p.def.importDiscount * p.modules * p.efficiency) : 0;
  }

  /** Medya şirketi sende mi (reklam indirimi + müşteri artışı)? */
  get mediaOwned() {
    return !!this.get('media')?.owned;
  }

  /** Kamyon filosunu kendi lojistik firman mı yönetiyor? */
  get logisticsOwned() {
    return !!this.get('logistics')?.owned;
  }

  update(dt) {
    for (const b of this.businesses) b.update(dt);
    this.btn.classList.toggle('hidden', this.game.level < 21);
    if (this.isOpen) {
      this.tick = (this.tick ?? 0) + dt;
      if (this.tick > 1.5) {
        this.tick = 0;
        if (!this.pointerDown && !this.renaming) this.render();
      }
    }
  }

  /** Gün sonu: işletmelerin maaşları ve kârı. Özet için toplam döner. */
  endOfDay(today) {
    let profit = 0;
    let wages = 0;
    let freight = 0;
    for (const b of this.owned) {
      const r = b.endOfDay();
      profit += r.profit;
      wages += r.wages;
      freight += r.freight ?? 0;
    }
    if (this.owned.length) today.holding = { profit, wages, freight, count: this.owned.length };
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
    this.body.innerHTML = this.tab === 'map' ? this.renderMap() : this.tab === 'estate' ? this.renderEstate() : this.tab === 'fin' ? this.game.finance.render() : this.renderBusinesses();
  }

  renderBusinesses() {
    const g = this.game;
    const m = g.money;
    const day = g.day.today;
    const acc = g.accountant;
    const lv = (n) => t('Sv.{n}', { n });
    const go = (id) => `<button data-go="${id}">📍 ${t('Git')}</button>`;
    const cards = [`
      <div class="biz owned">
        <div class="biz-head"><span class="biz-e">🛒</span><div>${this.nameField('market', g.marketTitle)}<small>${t('Bugün: ${revenue} ciro · {customers} müşteri', { revenue: formatMoney(day.revenue), customers: day.customers })} · ⭐ ${g.rating.stars.toFixed(1)}</small></div></div>
        <div class="biz-row"><span>👥 ${t('Çalışan')}</span><b>${g.workers.filter((w) => w.role).length}</b><small>${t('maaş ${n}/gün', { n: formatMoney(g.dailyPayroll - g.holding.owned.reduce((a, x) => a + x.dailyWages, 0)) })}</small></div>
        ${g.energy.active ? `<div class="biz-row"><span>⚡ ${t('Elektrik')}</span><b>${t('{n} birim/gün', { n: formatMoney(g.energy.consumption.total) })}</b><small>${g.energy.last ? t('dün fatura ${n}', { n: formatMoney(g.energy.last.bill) }) : t('gün sonunda faturalanır')}</small></div>` : ''}
        <div class="biz-row"><span>🔑 ${t('Bina')}</span><b>${g.rent.marketOwned ? t('senin') : t('kiralık ${n}/hafta', { n: formatMoney(g.rent.marketRent) })}</b><small>${g.rent.marketOwned ? '' : g.rent.canBuyMarket ? t('muhasebe → banka sekmesinden al') : t('Sv.{n}\'de satın alınır', { n: RENT.market.buyLevel })}</small></div>
        <div class="biz-row"><span>${t('Muhasebeci')}</span><b>${acc ? `🧑‍💼 ${t('çalışıyor')}` : g.level >= 21 ? t('muhasebe odasının yanından işe al') : `🔒 ${lv(21)}`}</b></div>
        <div class="biz-btns">${go('market')}<button data-go="office">🧾 ${t('Muhasebe')}</button></div>
      </div>`];
    let hidden = 0;
    for (const b of this.businesses) {
      const d = b.def;
      if (!b.owned && !b.seized && g.level < d.level - 3) {
        hidden++;
        continue;
      }
      if (b.seized) {
        const can = g.bank.totalDebt === 0;
        cards.push(`
          <div class="biz locked">
            <div class="biz-head"><span class="biz-e">${d.emoji}</span><div><b>${b.name}</b><small>🏦 ${t('Faiz ödenmediği için bankaya geçti · {n} modül korunuyor', { n: b.modules })}</small></div></div>
            <div class="biz-btns">
              ${can ? `<button class="primary" data-back="${b.id}" ${m < b.seizedPrice ? 'disabled' : ''}>${t('Geri al ${n}', { n: formatMoney(b.seizedPrice) })}</button>` : `<span class="lock">${t('Geri almak için önce tüm borcu kapat (${n})', { n: formatMoney(g.bank.totalDebt) })}</span>`}
              ${go(`biz:${b.id}`)}
            </div>
          </div>`);
        continue;
      }
      if (!b.owned) {
        const locked = g.level < d.level;
        const what = d.energy ? `⚡ ${t('{n} birim/gün/modül', { n: formatMoney(d.energyPerModule) })}`
          : d.kind === 'garage' ? `🚛 ${t('kamyon filosu')}`
          : d.kind === 'shop' ? `🏪 ${t('market şubesi · ~${n}/gün', { n: formatMoney(d.revenuePerModule) })}`
          : d.kind === 'media' ? `📰 ${t('gazete + radyo: reklam ucuzlar, ciro artar')}`
          : t('Ürün: {n} çeşit', { n: d.products.length });
        cards.push(`
          <div class="biz ${locked ? 'locked' : ''}">
            <div class="biz-head"><span class="biz-e">${d.emoji}</span><div><b>${d.name}</b><small>${t('Sahibi: {owner}', { owner: d.owner })} · ${what}${d.lease ? ` · 🔑 ${t('kiralık: haftalık ${n}+', { n: formatMoney(d.lease.weekly) })}` : ''}</small></div></div>
            <div class="biz-btns">
              ${locked ? `<span class="lock">🔒 ${t('Seviye {n}\'te satılığa çıkar', { n: d.level })}</span>` : b.missingReq.length ? `<span class="lock">🔒 ${t('Önce tüm tedarikçileri al ({list})', { list: b.missingReq.map((id) => BUSINESSES[id].emoji).join(' ') })}</span>` : `<button class="primary" data-buy="${b.id}" ${m < d.price ? 'disabled' : ''}>${d.lease ? t('Kirala (devir ${n})', { n: formatMoney(d.price) }) : t('Satın al ${n}', { n: formatMoney(d.price) })}</button>`}
              ${g.level >= 22 ? go(`biz:${b.id}`) : ''}
            </div>
          </div>`);
        continue;
      }
      const next = b.nextModule();
      const y = b.yesterday;
      const eff = Math.round(b.efficiency * 100);
      const H = STAFF.hire;
      const workerLabel = b.isLogistics ? `🧑‍✈️ ${t('Şoför')}` : b.isEnergy ? `🔧 ${t('Teknisyen')}` : d.kind === 'shop' ? `🧑‍💼 ${t('Çalışan')}` : d.kind === 'media' ? `🎙️ ${t('Muhabir')}` : `👷 ${t('İşçi')}`;
      cards.push(`
        <div class="biz owned">
          <div class="biz-head"><span class="biz-e">${d.emoji}</span><div>${this.nameField(b.id, b.name)}<small>${t('Modül {n}/{max} · verim %{eff}', { n: b.modules, max: b.maxModules, eff })}${!b.manager && !b.playerHere ? ` ${t('(müdür yok)')}` : ''}</small></div></div>
          ${b.leased ? `<div class="biz-row"><span>🔑 ${t('Kiralık')}</span><b>${t('${n}/hafta', { n: formatMoney(b.weeklyRent) })}</b>${b.canBuyOut ? `<button data-buyout="${b.id}" ${m < d.lease.buyPrice ? 'disabled' : ''}>${t('Satın al ${n}', { n: formatMoney(d.lease.buyPrice) })}</button>` : `<span class="lock">${t('Sv.{n}\'de satın alınır', { n: d.lease.buyLevel })}</span>`}</div>` : ''}
          ${d.revenuePerModule ? `<div class="biz-row"><span>💰 ${d.kind === 'media' ? t('Reklam geliri') : t('Ciro')}</span><b>${t('~${n}/gün', { n: formatMoney(b.serviceIncome) })}</b><small>${b.workers ? t('bugün ${n}', { n: formatMoney(b.today.sales) }) : t('çalışan ata!')}</small></div>` : ''}
          ${b.isLogistics ? `<div class="biz-row"><span>🚛 ${t('Kamyon')}</span><b>${b.trucks}</b><small>${t('~${n}/gün taşıma geliri', { n: formatMoney(b.contractIncome) })}</small></div>` : ''}
          ${b.isEnergy ? `<div class="biz-row"><span>⚡ ${t('Üretim')}</span><b>${t('{n} birim bugün', { n: formatMoney(Math.round(b.energyToday)) })}</b><small>${t('kapasite ~{n}/gün', { n: formatMoney(b.energyCapacity) })}${d.energy === 'wind' ? ` · ${t('rüzgâr ×{n}', { n: g.energy.wind })}` : ''}</small></div>` : ''}
          ${d.battery ? `<div class="biz-row"><span>🔋 ${t('Batarya')}</span><b>${b.battery ? t('var (gece de karşılar)') : t('yok')}</b>${b.battery ? '' : g.level < d.battery.level ? `<span class="lock">${lv(d.battery.level)}</span>` : `<button data-battery="${b.id}" ${m < d.battery.cost ? 'disabled' : ''}>${t('Kur ${n}', { n: formatMoney(d.battery.cost) })}</button>`}</div>` : ''}
          <div class="biz-row"><span>${workerLabel}</span><b>${b.workers}/${b.workerSlots}</b><button data-hire="${b.id}:worker" ${b.workers >= b.workerSlots || m < H.worker ? 'disabled' : ''}>+ $${H.worker}</button></div>
          <div class="biz-row"><span>🟥 ${t('Müdür')}<small>${t('tam hız · fazlayı satar · işçi alır')}</small></span><b>${b.manager ? t('var') : t('yok')}</b>${b.manager ? '' : g.level < b.staffLevel('manager') ? `<span class="lock">${lv(b.staffLevel('manager'))}</span>` : `<button data-hire="${b.id}:manager" ${m < H.manager ? 'disabled' : ''}>${t('Al ${n}', { n: formatMoney(H.manager) })}</button>`}</div>
          ${b.isEnergy ? `<div class="biz-row"><span>🔌 ${t('Şebeke')}</span><b>${b.manager ? t('fazla satılır') : t('fazla boşa gider')}</b><small>${b.manager ? t('birim başı ${n}', { n: ELECTRICITY.gridPrice }) : t('müdür alınca satılır (Sv.{n})', { n: b.staffLevel('manager') })}</small></div>` : d.kind === 'media' ? `<div class="biz-row"><span>📣 ${t('Reklam')}</span><b>${t('%60 ucuz')}</b><small>${t('market ve şubelere +%15 müşteri')}</small></div>` : d.kind === 'shop' ? '' : b.isLogistics ? `<div class="biz-row"><span>🤝 ${t('Filo')}</span><b>${t('sevkiyat bedava')}</b><small>${t('sipariş −%{n} · fazla ürün rakip marketlere ×{price}', { n: Math.round(LOGISTICS.orderDiscount * 100), price: LOGISTICS.rivalPrice })}</small></div>` : `<div class="biz-row"><span>📦 ${t('Depo')}</span><b>${b.stored}/${STAFF.storage}</b><button data-sell="${b.id}" ${!b.stored ? 'disabled' : ''}>${t('Fazlayı sat')}</button></div>`}
          ${b.independent ? `<div class="biz-row"><span>🤖 ${t('Bağımsız')}</span><b>${b.autoGrow ? t('işçi alır, büyür') : t('işçi alır')}</b><button data-grow="${b.id}">${b.autoGrow ? t('Büyümeyi durdur') : t('Kendi büyüsün')}</button></div>` : ''}
          <div class="biz-row"><span>💵 ${t('Dün')}</span><b>${y ? `${y.profit >= 0 ? '+' : '−'}$${formatMoney(Math.abs(y.profit))}` : '—'}</b><small>${t('maaş ${n}/gün', { n: b.dailyWages })}</small></div>
          <div class="biz-btns">
            ${next ? (g.level < next.level ? `<span class="lock">${t('{n}. modül: Sv.{level}', { n: b.modules + 1, level: next.level })}</span>` : `<button class="primary" data-expand="${b.id}" ${m < next.cost ? 'disabled' : ''}>🏗️ ${t('Büyüt ${n}', { n: formatMoney(next.cost) })}</button>`) : `<span class="lock">${t('En büyük boyutta')}</span>`}
            ${go(`biz:${b.id}`)}
          </div>
        </div>`);
    }
    if (hidden) cards.push(`<p class="note">🔒 ${t('{n} işletme ileriki seviyelerde satılığa ya da kiralığa çıkacak.', { n: hidden })}</p>`);
    const w = STAFF.wage;
    return `<p class="note">${t('İşçi maaşı ${worker}, müdür ${manager} (gün sonunda; ödenemezse çalışan ayrılır) · Müdür yokken işletme sen oradaysan tam hızda, değilsen %{rate} hızda çalışır. Tarlada/üretimde dolaşırsan sen de üretirsin; 📦 alanından kasa alıp markete kendin taşıyabilirsin. Müdür varsa işletme bağımsız çalışır: fazlayı satar, işçi alır, istersen kendini büyütür.', { worker: w.worker, manager: w.manager, rate: Math.round(STAFF.noManagerRate * 100) })}</p>${cards.join('')}`;
  }

  /** Emlak: arsalar, inşaat, kiracılar, emlakçılar. */
  renderEstate() {
    const g = this.game;
    const H = g.housing;
    const m = g.money;
    const lv = (n) => t('Sv.{n}', { n });
    if (!H.unlocked) return `<p class="note">🏘️ ${t('Doğu mahallesindeki arsalar Seviye {n}\'da satışa çıkar. Arsayı al, ev tipini seç, birkaç günde inşa edilsin, kiraya ver.', { n: HOUSING.fromLevel })}</p>`;
    const C = HOUSING.company;
    const when = g.rent.daysLeft === 0 ? t('bu akşam') : t('{n} gün sonra', { n: g.rent.daysLeft });
    const parts = [`<p class="note">${t('Kira geliri her gün birikir, 7. günün sonunda kasaya geçer (sonraki ödeme {when}). Kiracılar zamanla çıkar, daire tadilat ister. Her binaya ayrı emlakçı alınabilir: kiracı ve tadilatla o ilgilenir, kiradan %{n} alır.', { when, n: Math.round(HOUSING.agent.commission * 100) })}</p>
      <div class="biz ${H.company ? 'owned' : ''}"><div class="biz-row"><span>🏗️ ${t('İnşaat şirketi')}</span><b>${H.company ? t('senin: %40 hızlı, %15 ucuz') : t('yok')}</b>${H.company ? '' : g.level < C.level ? `<span class="lock">${lv(C.level)}</span>` : `<button data-company ${m < C.price ? 'disabled' : ''}>${t('Kur ${n}', { n: formatMoney(C.price) })}</button>`}</div>
      <div class="biz-row"><span>🟦 ${t('Emlak muhasebecisi')}</span><b>${H.accountant ? t('var: kira her gün') : t('yok')}</b>${H.accountant ? `<small>${t('emlakçısız binaları yönetir · $70/gün')}</small>` : g.level < HOUSING.accountant.level ? `<span class="lock">${lv(HOUSING.accountant.level)}</span>` : `<button data-haccountant ${m < HOUSING.accountant.hire ? 'disabled' : ''}>${t('Al ${n}', { n: HOUSING.accountant.hire })}</button>`}</div>
      ${Object.entries(HOUSING.amenities).map(([k, a]) => `<div class="biz-row"><span>${a.emoji} ${a.name}</span><b>${H.amenities[k] ? t('var: kira +%{n}', { n: Math.round(a.rentBoost * 100) }) : t('yok')}</b>${H.amenities[k] ? '' : g.level < a.level ? `<span class="lock">${lv(a.level)}</span>` : `<button data-amenity="${k}" ${m < a.price ? 'disabled' : ''}>${t('Yap ${n}', { n: formatMoney(a.price) })}</button>`}</div>`).join('')}
      <div class="biz-row"><span>📜 ${t('Mahalle tapusu')}</span><b>${H.deed ? t('senin: kira +%{n}', { n: Math.round(HOUSING.deed.rentBoost * 100) }) : t('{n}/{max} arsa dolu', { n: H.plots.filter((p) => !p.zoned && p.built).length, max: HOUSING.plots.length })}</b><small>${H.deed ? '' : t('Sv.{n}\'de tüm arsalar dolunca', { n: HOUSING.deed.level })}</small></div>
      ${H.rentFactor > 1 ? `<p class="note">${t('Kiralar şu an ×{n}', { n: H.rentFactor.toFixed(2) })}</p>` : ''}</div>`];
    for (const p of H.visiblePlots) {
      const go = `<button data-go="plot:${p.i}">📍 ${t('Git')}</button>`;
      const plotName = t('Arsa {n}', { n: p.i + 1 });
      if (!p.owned) {
        parts.push(`<div class="biz"><div class="biz-head"><span class="biz-e">📜</span><div><b>${plotName}</b><small>${t('Boş arsa')} · ${HOUSING.plotSize}×${HOUSING.plotSize}</small></div></div>
          <div class="biz-btns"><button class="primary" data-plot="${p.i}" ${m < HOUSING.plotPrice ? 'disabled' : ''}>${t('Satın al ${n}', { n: formatMoney(HOUSING.plotPrice) })}</button>${go}</div></div>`);
        continue;
      }
      if (!p.type) {
        const opts = Object.entries(HOUSING.types).map(([k, ht]) => {
          if (g.level < ht.level) return `<button disabled>${ht.emoji} ${ht.name}<br><small>🔒 ${lv(ht.level)}</small></button>`;
          const cost = H.costOf(k);
          return `<button data-build="${p.i}:${k}" ${m < cost || !H.canStartBuild ? 'disabled' : ''}>${ht.emoji} ${ht.name}<br><small>$${formatMoney(cost)} · ${t('{n} gün', { n: Math.ceil(H.buildDays(k)) })} · ${t('{units}×${rent}/hafta', { units: ht.units, rent: formatMoney(ht.rent) })}</small></button>`;
        }).join('');
        parts.push(`<div class="biz owned"><div class="biz-head"><span class="biz-e">📜</span><div><b>${plotName}</b><small>${t('Ne yapılsın? Ödeme şimdi, inşaat birkaç günde biter.')}${H.canStartBuild ? '' : ` <b>${t('👑 Aynı anda en fazla {n} inşaat (Premium\'da sınırsız)', { n: PREMIUM.builds })}</b>`}</small></div></div>
          <div class="ad-btns">${opts}</div><div class="biz-btns">${go}</div></div>`);
        continue;
      }
      const ht = H.type(p);
      if (!p.built) {
        const left = (1 - p.progress) * H.buildDays(p.type);
        parts.push(`<div class="biz owned"><div class="biz-head"><span class="biz-e">${ht.emoji}</span><div><b>${ht.name}</b><small>${stageName(p.progress)} · %${Math.floor(p.progress * 100)} · ${left < 1 ? t('~1 günden az kaldı') : t('~{n} gün kaldı', { n: Math.ceil(left) })}</small></div></div>
          <div class="progress"><i style="width:${Math.floor(p.progress * 100)}%"></i></div><div class="biz-btns">${go}</div></div>`);
        continue;
      }
      const cnt = (s) => p.units.filter((u) => u.state === s).length;
      const rented = cnt('rented');
      const empty = cnt('empty');
      const dirty = cnt('dirty');
      const busy = cnt('listed') + cnt('renovating');
      parts.push(`<div class="biz owned"><div class="biz-head"><span class="biz-e">${ht.emoji}</span><div><b>${ht.name}</b><small>${plotName} · ${t('{n}/{max} kirada · haftalık ${rent}', { n: rented, max: p.units.length, rent: formatMoney(rented * H.rentOf(p)) })}</small></div></div>
        <div class="biz-row"><span>💵 ${t('Biriken kira')}</span><b>$${formatMoney(Math.round(p.accrued))}</b><small>${t('7. günün sonunda ödenir')}</small></div>
        <div class="biz-row"><span>🧑‍💼 ${t('Emlakçı')}</span><b>${p.agent ? t('var (%10)') : t('yok')}</b>${p.agent ? '' : g.level < HOUSING.agent.level ? `<span class="lock">${lv(HOUSING.agent.level)}</span>` : `<button data-agent="${p.i}" ${m < HOUSING.agent.hire ? 'disabled' : ''}>${t('İşe al ${n}', { n: HOUSING.agent.hire })}</button>`}</div>
        ${busy ? `<div class="biz-row"><span>⏳ ${t('Süreçte')}</span><b>${t('{listed} ilanda · {renovating} tadilatta', { listed: cnt('listed'), renovating: cnt('renovating') })}</b></div>` : ''}
        <div class="biz-btns">
          ${empty && !p.agent && !H.accountant ? `<button class="primary" data-list="${p.i}">${t('Kiraya ver ({n})', { n: empty })}</button>` : ''}
          ${dirty && !p.agent && !H.accountant ? `<button data-renovate="${p.i}" ${m < ht.renovation ? 'disabled' : ''}>🔧 ${t('Tadilat {n}×${cost}', { n: dirty, cost: formatMoney(ht.renovation) })}</button>` : ''}
          ${go}
        </div></div>`);
    }
    return parts.join('');
  }

  /** Başlık: ad + ✏️ (düzenleme modunda metin kutusu). */
  nameField(id, name) {
    if (this.renaming === id) {
      const v = id === 'market' ? this.game.marketName : this.get(id).customName || this.get(id).def.name;
      return `<span class="rename"><input id="rename-input" maxlength="20" value="${escapeHtml(v)}" /><button class="primary" data-rename-save>✓</button><button data-rename-cancel>✕</button></span>`;
    }
    return `<b>${escapeHtml(name)} <button class="pen" data-rename="${id}" title="${t('İsim ver')}">✏️</button></b>`;
  }

  renderMap() {
    const g = this.game;
    return `<div class="regions">${REGIONS.map((r) => {
      const locked = g.level < r.level;
      return `<button class="region ${locked ? 'locked' : ''}" data-region="${r.id}" ${locked ? 'disabled' : ''}>
        <span class="biz-e">${r.emoji}</span><span>${r.name}</span><small>${locked ? `🔒 ${t('Sv.{n}', { n: r.level })}${r.soon ? ` · ${t('yakında')}` : ''}` : t('Git →')}</small></button>`;
    }).join('')}</div>${this.game.city.render()}`;
  }

  onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    if (d.offer) {
      const [id, r] = d.offer.split(':');
      this.game.city.offer(id, Number(r));
      this.render();
      return;
    }
    if (d.final !== undefined) {
      this.close();
      this.game.city.showFinal();
      return;
    }
    if (this.tab === 'fin') {
      this.game.finance.onClick(d);
      this.render();
      return;
    }
    if (d.buy) this.get(d.buy).buy();
    if (d.expand) this.get(d.expand).expand();
    if (d.back) this.get(d.back).buyBack();
    if (d.buyout) this.get(d.buyout).buyOut();
    const H = this.game.housing;
    if (d.plot) H.buyPlot(Number(d.plot));
    if (d.build) {
      const [i, type] = d.build.split(':');
      H.build(Number(i), type);
    }
    if (d.list) H.list(Number(d.list));
    if (d.renovate) H.renovate(Number(d.renovate));
    if (d.agent) H.hireAgent(Number(d.agent));
    if (d.company !== undefined) H.buyCompany();
    if (d.haccountant !== undefined) H.hireAccountant();
    if (d.amenity) H.buyAmenity(d.amenity);
    if (d.battery) this.get(d.battery).buyBattery();
    if (d.rename) {
      this.renaming = d.rename;
      this.render();
      const inp = this.body.querySelector('#rename-input');
      inp?.focus();
      inp?.select();
      return;
    }
    if (d.renameSave !== undefined) {
      const v = this.body.querySelector('#rename-input')?.value ?? '';
      if (this.renaming === 'market') this.game.setMarketName(v);
      else this.get(this.renaming)?.rename(v);
      this.renaming = null;
    }
    if (d.renameCancel !== undefined) this.renaming = null;
    if (d.hire) {
      const [id, role] = d.hire.split(':');
      this.get(id).hire(role);
    }
    if (d.sell) {
      const r = this.get(d.sell).sellSurplus(0);
      if (r.n) this.game.hud.toast(`💵 ${t('{n} kasa satıldı (+${income})', { n: r.n, income: r.income })}`);
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
    if (key.startsWith('city:')) {
      const p = this.game.city.props.find((x) => x.id === key.slice(5));
      pos = [p.pos[0], p.pos[1] + (p.facing === -1 ? -6 : 6)];
    } else if (key.startsWith('plot:')) {
      const p = this.game.housing.plots[Number(key.slice(5))];
      pos = [p.x, p.z + 6.5];
    } else if (key.startsWith('biz:')) {
      const b = this.get(key.slice(4));
      pos = [b.x, b.frontZ + (b.def.building?.facing === -1 ? -1.2 : 1.2)];
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
