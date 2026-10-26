import * as THREE from 'three';
import { prop } from './assets.js';
import { OFFICE, PRODUCTS, SPECIALS, CAMPAIGN, RENT, AD_TYPES } from './config.js';
import { formatMoney } from './hud.js';

// Muhasebe odası: mağazanın arka sağ köşesi. İçeri girince Sipariş / Banka / Kampanya paneli açılır.

export class Office {
  constructor(game) {
    this.game = game;
    const [dx, dz] = OFFICE.door;
    this.x = dx;
    this.z = dz;
    this.build();
    this.panel = new OfficePanel(game, this);
  }

  build() {
    const g = this.game;
    const s = g.scene;
    const O = OFFICE;
    const add = (name, x, z, rotY = 0, y = 0, scale = 1) => {
      const m = prop(name);
      m.position.set(x, y, z);
      m.rotation.y = rotY;
      m.scale.setScalar(scale);
      s.add(m);
      return m;
    };
    // Alçak bölme duvarlar (kapı sol önde)
    const w1 = add('wall', 10.65, O.maxZ, 0);
    w1.scale.set(0.675, 0.32, 1);
    g.nav.setBox('office-front', { minX: 9.3, maxX: 12, minZ: O.maxZ - 0.25, maxZ: O.maxZ + 0.25 });
    const w2 = add('wall', O.minX, -14.65, Math.PI / 2);
    w2.scale.set(0.675, 0.32, 1);
    g.nav.setBox('office-side', { minX: O.minX - 0.25, maxX: O.minX + 0.25, minZ: O.minZ, maxZ: -13.3 });
    // Halı, masa, sandalye, dolap, lamba, tablo
    add('rug_rectangle_A', 9.9, -13.4, Math.PI / 2);
    add('table_medium', 10.5, -13.6);
    add('chair_A', 11.3, -13.6, -Math.PI / 2);
    add('lamp_table', 10.9, -14.1, 0, 1.0, 0.55);
    add('cabinet_medium_decorated', 10.4, -15.45);
    add('book_set', 9.8, -13.2, 0.3, 1.25, 1);
    g.nav.setBox('office-desk', { minX: 9.5, maxX: 11.9, minZ: -16, maxZ: -12.6 });
    // Bilgisayar
    const pc = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), new THREE.MeshStandardMaterial({ color: 0x3c4552 }));
    base.position.y = 0.25;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.9), new THREE.MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x2a6f84 }));
    screen.position.y = 0.6;
    pc.add(base, screen);
    pc.position.set(10.3, 1.0, -13.6);
    pc.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    s.add(pc);
    // Kapıdaki etkileşim alanı
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(80,140,255,0.3)';
    ctx.strokeStyle = '#cfe1ff';
    ctx.lineWidth = 12;
    ctx.setLineDash([26, 16]);
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 236, 34);
    ctx.fill();
    ctx.stroke();
    ctx.font = '80px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🧾', 128, 100);
    ctx.font = 'bold 36px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Muhasebe', 128, 190);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const zone = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(this.x, 0.03, this.z);
    zone.renderOrder = 1;
    s.add(zone);
  }

  inRange(p) {
    return Math.abs(p.x - this.x) < 1.0 && Math.abs(p.z - this.z) < 1.0;
  }

  update() {
    this.panel.update();
  }
}

// ---- Panel ---------------------------------------------------------------------------------

class OfficePanel {
  constructor(game, office) {
    this.game = game;
    this.office = office;
    this.el = document.getElementById('office-panel');
    this.tab = 'order';
    this.open = false;
    this.dismissed = false;
    this.campaignPick = SPECIALS[0];
    this.campaignQty = 60;

    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.getElementById('office-close').addEventListener('click', () => this.hide(true));
    this.el.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => this.setTab(b.dataset.tab)));
    document.getElementById('bank-sec').addEventListener('click', (e) => this.onBank(e));
    document.getElementById('campaign-sec').addEventListener('click', (e) => this.onCampaign(e));
    document.getElementById('acc-sec').addEventListener('change', (e) => {
      const k = e.target.dataset.set;
      if (k && this.game.accountant) this.game.accountant.settings[k] = e.target.checked;
    });
  }

  get orders() {
    return this.game.depot.panel;
  }

  show() {
    this.open = true;
    this.el.classList.remove('hidden');
    this.setTab(this.tab);
  }

  hide(byUser = false) {
    this.open = false;
    this.dismissed = byUser;
    this.el.classList.add('hidden');
    this.orders.hide();
  }

  setTab(tab) {
    if (tab === 'acc' && !this.game.accountant) tab = 'order';
    this.tab = tab;
    this.el.querySelector('.tabs button[data-tab="acc"]').classList.toggle('hidden', !this.game.accountant);
    this.el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    this.el.querySelectorAll('[data-sec]').forEach((sec) => sec.classList.toggle('hidden', sec.dataset.sec !== tab));
    if (tab === 'order') this.orders.show();
    else this.orders.hide();
    this.render();
  }

  update() {
    const inZone = this.office.inRange(this.game.player.position);
    if (inZone && !this.open && !this.dismissed) this.show();
    if (!inZone) {
      this.dismissed = false;
      if (this.open) this.hide();
    }
    if (this.open) {
      this.orders.update();
      this.tick = (this.tick ?? 0) + 1;
      // Banka/kampanya sekmesi sadece işlem sonrası yeniden çizilir (dokunurken butonlar değişmesin)
    }
  }

  render() {
    if (this.tab === 'bank') this.renderBank();
    if (this.tab === 'campaign') this.renderCampaign();
    if (this.tab === 'acc') this.renderAccountant();
  }

  renderAccountant() {
    const a = this.game.accountant;
    const sec = document.getElementById('acc-sec');
    if (!a) return;
    const t = (k, label, desc) => `<label class="row toggle"><span>${label}<small>${desc}</small></span><input type="checkbox" data-set="${k}" ${a.settings[k] ? 'checked' : ''} /></label>`;
    sec.innerHTML = `
      <p class="note">Muhasebeci marketin işlerini senin yerine takip eder; banka işleri sende kalır. Kapattığın işi sen yönetirsin, istediğin zaman diğer sekmelerden müdahale edebilirsin.</p>
      ${t('order', '🚚 Siparişler', 'Paletler %45 altına inince %85\'e tamamlar')}
      ${t('campaign', '📢 Kampanyalar', 'Her akşam 19:00\'da yarın için 3\'e kadar kampanya hazırlar')}
      ${t('invest', '🏗️ Yatırımlar', 'Açılmış market alanlarını (reyon, çalışan, genişleme…) yedek bırakarak satın alır')}
      <p class="note"><b>Kasada bırakılan en az para:</b> $${formatMoney(a.reserve)}</p>
      <div class="acc-log">${a.log.length ? a.log.map((l) => `<div>${l}</div>`).join('') : '<div>Henüz karar yok.</div>'}</div>`;
  }

  // ---- Banka ----

  renderBank() {
    const b = this.game.bank;
    const m = this.game.money;
    const row = (label, value, cls = '') => `<div class="${cls}"><span>${label}</span><b>$${formatMoney(Math.round(value))}</b></div>`;
    document.getElementById('bank-sec').innerHTML = `
      <div class="stats">
        ${row('Nakit', m)}
        ${row('Mevduat (+%2/gün)', b.deposit)}
        ${row('Kredi borcu (%4/gün)', b.debt, b.debt ? 'warn' : '')}
        ${b.startDebt ? row('Kuruluş kredisi (%1/gün)', b.startDebt, 'warn') : ''}
        ${row('Kullanılabilir kredi', b.available)}
      </div>
      ${row('Günlük faiz (gün sonu nakitten)', b.debt * 0.04 + b.startDebt * 0.01, b.missed ? 'warn' : '')}
      ${row('Günlük maaşlar (gün sonu)', this.game.dailyPayroll)}
      ${b.missed ? `<p class="note warn">⚠️ Faiz ${b.missed} gündür ödenemedi. ${3 - b.missed} gün daha ödenmezse banka en değersiz işletmene el koyar.</p>` : ''}
      ${this.game.holding.businesses.some((x) => x.seized) ? `<p class="note">🏦 Bankaya geçen işletmeler borcun tamamen kapanınca 💼 tabletten geri alınabilir.</p>` : ''}
      ${this.renderRent()}
      <p class="note">Kredi limiti $${formatMoney(b.limit)} = seviye $${formatMoney(b.limitParts.base)} + işletmeler $${formatMoney(b.limitParts.assets)} + kazanç $${formatMoney(b.limitParts.income)}. Yeni işletme aldıkça ve kazancın arttıkça yükselir.</p>
      <div class="bank-group"><span>Kredi çek</span>
        ${[500, 2000, 10000].map((n) => `<button data-act="borrow" data-n="${n}" ${b.available < n ? 'disabled' : ''}>+$${formatMoney(n)}</button>`).join('')}
      </div>
      <div class="bank-group"><span>Borç öde</span>
        <button data-act="repay" data-n="500" ${!b.totalDebt || m <= 0 ? 'disabled' : ''}>$${formatMoney(Math.min(500, b.totalDebt, Math.max(0, Math.floor(m))))}</button>
        <button data-act="repay" data-n="all" ${!b.totalDebt || m <= 0 ? 'disabled' : ''}>${m >= b.totalDebt ? 'Borcun tamamı' : 'Elimdekini öde'} ($${formatMoney(Math.min(b.totalDebt, Math.max(0, Math.floor(m))))})</button>
      </div>
      <div class="bank-group"><span>Para yatır</span>
        <button data-act="put" data-n="500" ${m < 1 ? 'disabled' : ''}>$500</button>
        <button data-act="put" data-n="half" ${m < 2 ? 'disabled' : ''}>Yarısı</button>
      </div>
      <div class="bank-group"><span>Para çek</span>
        <button data-act="withdraw" data-n="500" ${!b.deposit ? 'disabled' : ''}>$500</button>
        <button data-act="withdraw" data-n="all" ${!b.deposit ? 'disabled' : ''}>Tümünü çek</button>
      </div>
      ${b.lastLog ? `<p class="note bank-log">${b.lastLog}</p>` : ''}`;
  }

  /** Market binası (kira / satın alma) ve haftalık kiralar. */
  renderRent() {
    const g = this.game;
    const r = g.rent;
    const left = r.daysLeft;
    const when = left === 0 ? 'bu akşam' : `${left} gün sonra`;
    const lines = [];
    if (r.marketOwned) lines.push(`<p class="note">🏪 <b>${g.marketTitle}</b> binası senin.</p>`);
    else {
      lines.push(`<p class="note">🔑 <b>${g.marketTitle}</b> kiralık: haftalık <b>$${formatMoney(r.marketRent)}</b> (dükkân büyüdükçe artar).</p>`);
      lines.push(r.canBuyMarket
        ? `<div class="bank-group"><span>Binayı satın al</span><button class="primary" data-act="buymarket" ${g.money < r.marketPrice ? 'disabled' : ''}>$${formatMoney(r.marketPrice)}</button></div>`
        : `<p class="note">Binayı satın alma seçeneği Seviye ${RENT.market.buyLevel}'de açılır.</p>`);
    }
    if (r.weeklyTotal) lines.push(`<p class="note">Haftalık kira toplamı $${formatMoney(r.weeklyTotal)} · ödeme ${when}.</p>`);
    return lines.join('');
  }

  onBank(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.act === 'buymarket') {
      this.game.rent.buyMarket();
      this.renderBank();
      return;
    }
    const b = this.game.bank;
    const raw = btn.dataset.n;
    const n = raw === 'all' ? Infinity : raw === 'half' ? Math.floor(this.game.money / 2) : Number(raw);
    b[btn.dataset.act](n);
    this.renderBank();
  }

  // ---- Kampanya ----

  renderCampaign() {
    const c = this.game.campaign;
    const sec = document.getElementById('campaign-sec');
    const parts = [this.renderAds()];
    if (!c.unlocked) {
      sec.innerHTML = parts.join('') + `<p class="note">Kampanyalar Seviye ${CAMPAIGN.fromLevel}'te açılır.</p>`;
      return;
    }
    if (c.active.length) {
      parts.push(`<p class="note">Bugün: ${c.active.map((a) => `${PRODUCTS[a.product].emoji} ${a.sold}/${a.qty}`).join(' · ')} satıldı.</p>`);
    }
    // Yarın için planlananlar
    for (const sch of c.scheduled) {
      const info = PRODUCTS[sch.product];
      const who = sch.by === 'accountant' ? ' (muhasebeci)' : '';
      parts.push(`<div class="camp-plan"><span>${info.emoji} <b>${info.name}</b> · ${sch.qty} kasa${who}</span>
        <button data-cancel="${sch.product}">İptal ($${formatMoney(sch.paid ?? 0)} iade)</button></div>`);
    }
    if (c.slotsFree <= 0) {
      parts.push(`<p class="note">Yarın için en fazla ${CAMPAIGN.maxCampaigns} kampanya yapılabilir.</p>`);
      sec.innerHTML = parts.join('');
      return;
    }
    const options = SPECIALS.filter((k) => !c.isScheduled(k));
    if (!options.includes(this.campaignPick)) this.campaignPick = options[0];
    const cards = options.map((k) => {
      const p = PRODUCTS[k];
      const last = c.lastResults[k];
      return `<button class="camp-card ${k === this.campaignPick ? 'active' : ''}" data-pick="${k}">
        <span class="e">${p.emoji}</span><span>${p.name}</span><small>$${p.cost} → $${p.price}${last ? ` · son: ${last.sold}/${last.qty}` : ''}</small></button>`;
    }).join('');
    const total = c.costFor(this.campaignPick, this.campaignQty);
    parts.push(`
      <p class="note">Yarın için özel ürün ve stok seç (${c.scheduled.length}/${CAMPAIGN.maxCampaigns}). Her kampanyada <b>${CAMPAIGN.extraMin}–${CAMPAIGN.extraMax}</b> ek müşteri gelir, %${Math.round(CAMPAIGN.extraShopping * 100)}'si başka ürün de alır. Kalan stok gün sonunda zarar yazılır.</p>
      <div class="camp-cards">${cards}</div>
      <div class="bank-group"><span>Stok</span>
        <button data-q="-100">−100</button><button data-q="-20">−20</button><b class="o-qty">${this.campaignQty}</b><button data-q="20">+20</button><button data-q="100">+100</button>
      </div>
      <div class="sheet-foot">
        <span class="o-total">Hazırlık $${c.fee()} + stok $${formatMoney(this.campaignQty * PRODUCTS[this.campaignPick].cost)}</span>
        <button id="camp-go" class="primary" ${this.game.money < total ? 'disabled' : ''}>Hazırla $${formatMoney(total)}</button>
      </div>`);
    sec.innerHTML = parts.join('');
  }

  /** Ücretli reklam (medya senin olunca ucuz). */
  renderAds() {
    const g = this.game;
    const a = g.ads;
    const tomorrow = a.targetDay !== g.day.day;
    const btns = Object.entries(AD_TYPES).map(([k, t]) => {
      if (g.level < t.level) return `<button disabled>${t.emoji} 🔒 Sv.${t.level}</button>`;
      const done = a.has(k);
      return `<button data-ad="${k}" ${done || g.money < a.cost(k) ? 'disabled' : ''}>${t.emoji} ${t.name}<br><small>${done ? 'verildi' : `$${formatMoney(a.cost(k))} · +%${Math.round(t.boost * 100)}`}</small></button>`;
    }).join('');
    const today = a.todayList;
    return `<p class="note">📣 <b>Reklam ver</b> (${tomorrow ? 'yarın için' : 'bugün için'})${a.mediaOwned ? ' · 📰 medya senin: reklamlar %60 ucuz, müşteri +%15' : ''}${today.length ? ` · bugün yayında: ${today.map((t) => t.emoji).join(' ')}` : ''}</p>
      <div class="ad-btns">${btns}</div>`;
  }

  onCampaign(e) {
    const ad = e.target.closest('[data-ad]');
    if (ad && !ad.disabled) this.game.ads.buy(ad.dataset.ad);
    const pick = e.target.closest('[data-pick]');
    if (pick) this.campaignPick = pick.dataset.pick;
    const q = e.target.closest('[data-q]');
    if (q) this.campaignQty = Math.max(CAMPAIGN.minStock, Math.min(CAMPAIGN.maxStock, this.campaignQty + Number(q.dataset.q)));
    if (e.target.closest('#camp-go')) this.game.campaign.prepare(this.campaignPick, this.campaignQty);
    const cancel = e.target.closest('[data-cancel]');
    if (cancel) this.game.campaign.cancel(cancel.dataset.cancel);
    this.renderCampaign();
  }

}
