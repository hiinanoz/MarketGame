import * as THREE from 'three';
import { CITY, LEVELS } from './config.js';
import { prop } from './assets.js';
import { textTexture } from './fx.js';
import { formatMoney } from './hud.js';

// Şehri satın almak (Sv.81+): bölge bölge mülk sahiplerine teklif verilir, pazarlık yapılır.
// Her şey senin olunca Sv.100 ve "Kasabanın Hakimi" — final ekranı ve derece. İstersen devam edersin
// (seviye artık ilerlemez, para kazanmaya ve gezmeye devam).

export class City {
  constructor(game) {
    this.game = game;
    this.props = [];
    this.finished = false;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    for (const r of CITY.regions) {
      r.props.forEach((d, i) => {
        const p = { ...d, region: r, id: `${r.id}${i}`, price: d.price, asks: 0, owned: false, lastMsg: '', basePrice: () => d.price };
        this.props.push(p);
        this.build(p);
      });
    }
  }

  get unlocked() {
    return this.game.level >= CITY.fromLevel;
  }

  regionOpen(r) {
    return this.game.level >= r.level;
  }

  get ownedCount() {
    return this.props.filter((p) => p.owned).length;
  }

  /** Esnek sahibin şu anki teklifte kabul edeceği en düşük fiyat. */
  minAccept(p) {
    if (p.mood === 'angry') return p.price;
    const steps = CITY.flexSteps;
    return Math.round(p.basePrice() * steps[Math.min(p.asks, steps.length - 1)]);
  }

  /** Teklif ver: oran asıl (ilk) fiyata göre. */
  offer(id, ratio) {
    const g = this.game;
    const p = this.props.find((x) => x.id === id);
    if (!p || p.owned || !this.regionOpen(p.region)) return null;
    const amount = Math.round((p.mood === 'angry' ? p.price : p.basePrice()) * ratio);
    if (g.money < amount) return { ok: false, msg: 'Paran yetmiyor' };
    const min = this.minAccept(p);
    p.asks++;
    if (amount >= min) {
      g.spend(amount);
      p.owned = true;
      p.paid = amount;
      p.lastMsg = `🤝 ${p.owner}: "Anlaştık!" ($${formatMoney(amount)})`;
      g.gainXp(Math.floor(amount / 300));
      g.hud.toast(`🏁 ${p.name} artık senin!`);
      g.audio.play('unlock');
      this.build(p);
      this.checkFinish();
    } else if (p.mood === 'angry') {
      p.price = Math.round(p.price * (1 + CITY.angryRaise));
      p.lastMsg = `😠 ${p.owner}: "Bu ne biçim teklif! Fiyat artık $${formatMoney(p.price)}."`;
    } else {
      const next = this.minAccept(p);
      p.lastMsg = p.asks >= CITY.flexSteps.length
        ? `🤔 ${p.owner}: "En son $${formatMoney(next)}, daha aşağı olmaz."`
        : `🤔 ${p.owner}: "Olmaz… ama biraz daha konuşabiliriz."`;
    }
    this.build(p);
    g.save();
    return { ok: p.owned, msg: p.lastMsg };
  }

  // ---- Final ----

  /** Şehirdeki her şey senin mi? (bütün mülkler + bütün işletmeler) */
  get missing() {
    const g = this.game;
    const props = this.props.filter((p) => !p.owned).length;
    const biz = g.holding.businesses.filter((b) => !b.owned).length;
    return { props, biz };
  }

  checkFinish() {
    const g = this.game;
    if (this.finished) return;
    const m = this.missing;
    if (m.props || m.biz) return;
    this.finished = true;
    this.finishDay = g.day.day;
    g.level = 100;
    g.xp = Math.max(g.xp, LEVELS[99] ?? g.xp);
    g.hud.setLevel(100, 1);
    g.audio.play('unlock');
    this.showFinal();
    g.save();
  }

  get grade() {
    const d = this.finishDay ?? this.game.day.day;
    return CITY.grades.find(([max]) => d <= max)[1];
  }

  showFinal() {
    const g = this.game;
    const el = document.getElementById('final');
    const P = g.politics;
    const biggest = g.holding.owned.slice().sort((a, b) => b.value - a.value)[0];
    const wins = P.history.filter((h) => h.won).length;
    const hours = Math.floor((g.stats.playTime ?? 0) / 3600);
    const mins = Math.floor(((g.stats.playTime ?? 0) % 3600) / 60);
    document.getElementById('final-body').innerHTML = `
      <div class="final-grade">${this.grade}</div>
      <p class="final-title">👑 Kasabanın Hakimi</p>
      <div class="stats">
        <div><span>📅 Oyun günü</span><b>${this.finishDay}</b></div>
        <div><span>⏱️ Oynama süresi</span><b>${hours} sa ${mins} dk</b></div>
        <div><span>💵 Para</span><b>$${formatMoney(Math.round(g.money))}</b></div>
        <div><span>🏢 Şirket değeri</span><b>$${formatMoney(g.finance.companyValue)}</b></div>
        <div><span>💼 İşletme</span><b>${g.holding.owned.length}</b></div>
        <div><span>🏙️ Şehir mülkü</span><b>${this.ownedCount}</b></div>
        <div><span>🏘️ Konut</span><b>${g.housing.plots.filter((p) => p.built).length}</b></div>
        <div><span>👥 Çalışan</span><b>${g.totalStaff}</b></div>
        <div><span>🛒 Müşteri</span><b>${formatMoney(g.stats.customers ?? 0)}</b></div>
        <div><span>🗳️ Kazanılan seçim</span><b>${wins}</b></div>
        <div><span>🏆 En büyük işletme</span><b>${biggest ? `${biggest.def.emoji} ${biggest.name}` : '—'}</b></div>
        <div><span>⭐ Market puanı</span><b>${g.rating.stars.toFixed(1)}</b></div>
      </div>
      <p class="note">Derece oyun gününe göre: S ≤ 200 · A ≤ 300 · B ≤ 420 · C ≤ 600 · D</p>`;
    el.classList.remove('hidden');
    g.paused = true;
  }

  // ---- Görsel ----

  build(p) {
    p.group?.removeFromParent();
    p.label?.removeFromParent();
    const g = new THREE.Group();
    g.position.set(p.pos[0], 0, p.pos[1]);
    let m;
    if (p.procedural) {
      m = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 7), new THREE.MeshStandardMaterial({ color: 0xa1887f }));
      body.position.y = 2.25;
      const silo = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 8, 12), new THREE.MeshStandardMaterial({ color: 0xbdbdbd }));
      silo.position.set(3, 4, -2);
      m.add(body, silo);
    } else {
      m = prop(p.model);
      const small = p.model.startsWith('building-') ? 6 : p.model.startsWith('trees') ? 3 : p.model.startsWith('building_') && p.model.includes('withoutBase') ? 5 : 4;
      m.scale.setScalar(small);
    }
    if (p.facing === -1) m.rotation.y = Math.PI;
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(m);
    if (p.owned) {
      // Bayrak: senin olduğunu gösterir
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4, 0.12), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
      pole.position.set(-4, 2, 4);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 0.05), new THREE.MeshStandardMaterial({ color: 0x3fae4a }));
      flag.position.set(-3.2, 3.5, 4);
      g.add(pole, flag);
    }
    this.root.add(g);
    p.group = g;
    const open = this.regionOpen(p.region);
    const text = p.owned ? `🏁 ${p.name}` : open ? `${p.region.emoji} ${p.name} · $${formatMoney(p.mood === 'angry' ? p.price : p.basePrice())}` : `🔒 ${p.region.name} · Sv.${p.region.level}`;
    const tex = textTexture(text, { color: p.owned ? '#1e5d2b' : '#5a3a10', size: 40, stroke: '#ffffff' });
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    label.renderOrder = 6;
    label.scale.set(0.75 * tex.image.width / tex.image.height, 0.75, 1);
    label.position.set(p.pos[0], 9, p.pos[1]);
    this.root.add(label);
    p.label = label;
    p.labelLevel = this.game.level;
  }

  update(dt) {
    this.root.visible = this.game.level >= 20; // uzaktan görünür, Sv.81'de satın alınır
    this.t = (this.t ?? 0) + dt;
    if (this.t > 3) {
      this.t = 0;
      for (const p of this.props) if (!p.owned && p.labelLevel !== this.game.level) this.build(p);
      if (!this.finished && this.unlocked) this.checkFinish();
    }
  }

  // ---- Tablet (Harita sekmesinin altı) ----

  render() {
    const g = this.game;
    if (!this.unlocked) return `<p class="note">🏙️ Seviye ${CITY.fromLevel}'den itibaren şehrin bölgelerindeki mülkleri sahiplerinden satın alabilirsin. Şehirdeki her şey senin olunca Seviye 100: Kasabanın Hakimi.</p>`;
    const m = this.missing;
    const parts = [`<p class="note"><b>🏙️ Şehri satın al</b> · ${this.ownedCount}/${this.props.length} mülk · ${g.holding.businesses.length - m.biz}/${g.holding.businesses.length} işletme${this.finished ? ' · 👑 Hakimsin' : ''}<br>Teklif ver: bazı sahipler 2–3 tekliften sonra %25'e kadar iner; bazıları sordukça kızar ve fiyatı artırır.</p>`];
    for (const r of CITY.regions) {
      const open = this.regionOpen(r);
      parts.push(`<p class="note"><b>${r.emoji} ${r.name}</b>${open ? '' : ` · 🔒 Sv.${r.level}`}</p>`);
      if (!open) continue;
      for (const p of this.props.filter((x) => x.region === r)) {
        const base = p.mood === 'angry' ? p.price : p.basePrice();
        parts.push(`<div class="biz ${p.owned ? 'owned' : ''}">
          <div class="biz-head"><div><b>${p.owned ? '🏁 ' : ''}${p.name}</b><small>Sahibi: ${p.owner}${p.owned ? ` · $${formatMoney(p.paid)}'a alındı` : ` · istenen $${formatMoney(base)}${p.asks ? ` · ${p.asks} teklif` : ''}`}</small></div></div>
          ${p.lastMsg ? `<p class="note">${p.lastMsg}</p>` : ''}
          ${p.owned ? '' : `<div class="biz-btns">${CITY.offers.map((o) => `<button data-offer="${p.id}:${o}" ${g.money < base * o ? 'disabled' : ''}>${o === 1 ? 'Tam fiyat' : `%${Math.round(o * 100)}`} $${formatMoney(base * o)}</button>`).join('')}<button data-go="city:${p.id}">📍</button></div>`}
        </div>`);
      }
    }
    if (this.finished) parts.push('<div class="biz-btns"><button class="primary" data-final>👑 Final ekranını göster</button></div>');
    return parts.join('');
  }

  serialize() {
    return {
      finished: this.finished, finishDay: this.finishDay,
      props: Object.fromEntries(this.props.map((p) => [p.id, { price: p.price, asks: p.asks, owned: p.owned, paid: p.paid, lastMsg: p.lastMsg }])),
    };
  }

  restore(d) {
    if (!d) return;
    this.finished = !!d.finished;
    this.finishDay = d.finishDay;
    for (const p of this.props) {
      const s = d.props?.[p.id];
      if (s) Object.assign(p, s);
      this.build(p);
    }
    if (this.finished) this.game.level = 100;
  }
}
