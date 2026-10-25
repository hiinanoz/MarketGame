import * as THREE from 'three';
import { prop } from './assets.js';
import { OFFICE, PRODUCTS, SPECIALS, CAMPAIGN } from './config.js';
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
    this.tab = tab;
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
        ${row('Borç (%4/gün)', b.debt, b.debt ? 'warn' : '')}
        ${row('Kredi limiti', b.available)}
      </div>
      <div class="bank-group"><span>Kredi çek</span>
        ${[500, 2000, 10000].map((n) => `<button data-act="borrow" data-n="${n}" ${b.available < n ? 'disabled' : ''}>+$${formatMoney(n)}</button>`).join('')}
      </div>
      <div class="bank-group"><span>Borç öde</span>
        <button data-act="repay" data-n="500" ${!b.debt || m <= 0 ? 'disabled' : ''}>$${formatMoney(Math.min(500, b.debt, Math.max(0, Math.floor(m))))}</button>
        <button data-act="repay" data-n="all" ${!b.debt || m <= 0 ? 'disabled' : ''}>${m >= b.debt ? 'Borcun tamamı' : 'Elimdekini öde'} ($${formatMoney(Math.min(b.debt, Math.max(0, Math.floor(m))))})</button>
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

  onBank(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn || btn.disabled) return;
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
    if (!c.unlocked) {
      sec.innerHTML = `<p class="note">Kampanyalar Seviye ${CAMPAIGN.fromLevel}'te açılır.</p>`;
      return;
    }
    if (c.scheduled) {
      const info = PRODUCTS[c.scheduled.product];
      sec.innerHTML = `<p class="note big">${info.emoji} Yarın <b>${info.name}</b> kampanyası hazır.<br>${c.scheduled.qty} kasa stok. Sabah kapıda kuyruk olacak!</p>`;
      return;
    }
    const active = c.active ? `<p class="note">Bugün: ${PRODUCTS[c.active.product].emoji} kampanyası sürüyor (${c.active.sold} kasa satıldı).</p>` : '';
    const cards = SPECIALS.map((k) => {
      const p = PRODUCTS[k];
      return `<button class="camp-card ${k === this.campaignPick ? 'active' : ''}" data-pick="${k}">
        <span class="e">${p.emoji}</span><span>${p.name}</span><small>alış $${p.cost} · satış $${p.price}</small></button>`;
    }).join('');
    const total = c.costFor(this.campaignPick, this.campaignQty);
    sec.innerHTML = `${active}
      <p class="note">Yarın için özel ürün ve stok seç. Kampanya günü <b>${CAMPAIGN.extraMin}–${CAMPAIGN.extraMax}</b> ek müşteri gelir. Stok yetmezse müşteriler mutsuz gider, gün sonunda kalan stok zarar yazılır.</p>
      <div class="camp-cards">${cards}</div>
      <div class="bank-group"><span>Stok</span>
        <button data-q="-20">−20</button><b class="o-qty">${this.campaignQty} kasa</b><button data-q="20">+20</button>
      </div>
      <div class="sheet-foot">
        <span class="o-total">Hazırlık $${c.fee()} + stok $${this.campaignQty * PRODUCTS[this.campaignPick].cost}</span>
        <button id="camp-go" class="primary" ${this.game.money < total ? 'disabled' : ''}>Hazırla $${formatMoney(total)}</button>
      </div>`;
  }

  onCampaign(e) {
    const pick = e.target.closest('[data-pick]');
    if (pick) this.campaignPick = pick.dataset.pick;
    const q = e.target.closest('[data-q]');
    if (q) this.campaignQty = Math.max(20, Math.min(300, this.campaignQty + Number(q.dataset.q)));
    if (e.target.closest('#camp-go')) this.game.campaign.prepare(this.campaignPick, this.campaignQty);
    this.renderCampaign();
  }
}
