import * as THREE from 'three';
import { t } from './i18n.js';
import { SECRETARY } from './config.js';
import { formatMoney } from './hud.js';
import { Character } from './character.js';

// Plaza ofisi (1.2, şehir modu): holding kurulmuş ve Sv.40 → oyun bu odadan yönetilir. Ayrı, küçük bir 3D sahne
// (harita o sırada çizilmez, zaman akar). Odadaki nesnelere dokununca panel açılır:
// 🗂️ masa (günlük ajanda) · ☎️ sekreter (brifing, rehber/ilişkiler) · 📺 televizyon (haberler) ·
// 🗄️ dosya dolabı (işletmeler) · 🏦 kasa (banka) · 🚗 garaj (şehre çık) · 🛒 pencere (markete git).

const ROOM = { w: 10, d: 7, h: 3.4 };

export class Plaza {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.sec = null;          // null | 'std' | 'expert'
    this.introDone = false;
    this.panel = null;        // açık panel: 'agenda' | 'secretary' | 'tv' | 'dossier' | 'safe'
    this.tick = 0;
    this.built = false;
    // DOM
    this.el = document.createElement('div');
    this.el.id = 'plaza';
    this.el.className = 'plaza hidden';
    this.el.innerHTML = `<div class="plz-top"></div><div class="plz-spots"></div><div class="plz-bottom"></div>
      <div class="plz-sheet hidden"><div class="plz-sheet-in"><div class="plz-sheet-head"><b></b><button class="x" data-close aria-label="✕">✕</button></div><div class="plz-sheet-body"></div></div></div>`;
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.el);
    this.top = this.el.querySelector('.plz-top');
    this.spotsEl = this.el.querySelector('.plz-spots');
    this.bottom = this.el.querySelector('.plz-bottom');
    this.sheet = this.el.querySelector('.plz-sheet');
    this.sheetTitle = this.sheet.querySelector('.plz-sheet-head b');
    this.sheetBody = this.sheet.querySelector('.plz-sheet-body');
    this.spots = [
      { id: 'agenda', emoji: '🗂️', label: t('Ajanda'), pos: [0, 1.3, -0.6] },
      { id: 'secretary', emoji: '☎️', label: t('Sekreter'), pos: [1.75, 2.0, 2.0] },
      { id: 'tv', emoji: '📺', label: t('Haberler'), pos: [-1.85, 2.0, 0.9] },
      { id: 'dossier', emoji: '🗄️', label: t('İşletmeler'), pos: [2.0, 1.9, -1.9] },
      { id: 'safe', emoji: '🏦', label: t('Kasa'), pos: [-1.7, 1.15, 3.0] },
      { id: 'window', emoji: '🛒', label: t('Markete git'), pos: [-1.5, 2.6, -3.3] },
      { id: 'garage', emoji: '🚗', label: t('Şehre çık'), pos: [1.5, 2.6, -3.3] },
    ];
    this.spotsEl.innerHTML = this.spots.map((s) => `<button class="plz-spot" data-spot="${s.id}"><span>${s.emoji}</span><b>${s.label}</b><i class="badge hidden"></i></button>`).join('');
  }

  get secretary() {
    return this.sec ? { ...SECRETARY[this.sec], tier: this.sec } : null;
  }

  // ---- 3D oda ----

  build() {
    if (this.built) return;
    this.built = true;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x2b3a48);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
    scene.add(new THREE.HemisphereLight(0xfff6e6, 0x4a4036, 1.6));
    const sun = new THREE.DirectionalLight(0xffe2b8, 1.6);
    sun.position.set(-3, 6, -8);
    scene.add(sun);
    const lamp = new THREE.PointLight(0xffd9a0, 6, 9);
    lamp.position.set(0, 3, 0.5);
    scene.add(lamp);
    const mat = (color, rough = 0.8) => new THREE.MeshStandardMaterial({ color, roughness: rough });
    const box = (w, h, d, color, x, y, z, rough) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough));
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    };
    const { w, d, h } = ROOM;
    // Zemin (parke) ve halı
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d + 8), mat(0x8a5a3b, 0.7));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 4;
    scene.add(floor);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.2), mat(0x7a2e2e, 1));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.01, 0.6);
    scene.add(rug);
    // Duvarlar (arka duvar cam: şehir manzarası)
    box(w, h, 0.2, 0xe9e2d4, 0, h / 2, d / 2 + 0.1).visible = false; // kameranın arkası (görünmez)
    box(0.2, h, d + 8, 0xd9cdb6, -w / 2, h / 2, 4);
    box(0.2, h, d + 8, 0xd9cdb6, w / 2, h / 2, 4);
    box(w, 0.35, 0.25, 0x3c3c44, 0, 0.17, -d / 2);         // pencere altı
    box(w, 0.3, 0.25, 0x3c3c44, 0, h - 0.15, -d / 2);      // pencere üstü
    for (const x of [-w / 2 + 0.1, -1.7, 1.7, w / 2 - 0.1]) box(0.14, h, 0.25, 0x3c3c44, x, h / 2, -d / 2);
    // Manzara: gökyüzü ve şehir siluetleri
    const sky = document.createElement('canvas');
    sky.width = 4;
    sky.height = 128;
    const sx = sky.getContext('2d');
    const gr = sx.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#5ea6e6');
    gr.addColorStop(1, '#ffe2b4');
    sx.fillStyle = gr;
    sx.fillRect(0, 0, 4, 128);
    const skyTex = new THREE.CanvasTexture(sky);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyM = new THREE.Mesh(new THREE.PlaneGeometry(60, 26), new THREE.MeshBasicMaterial({ map: skyTex }));
    skyM.position.set(0, 8, -22);
    scene.add(skyM);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const bh = 2 + rnd() * 9;
      const bw = 1.2 + rnd() * 2.4;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 1.5), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.58, 0.18, 0.32 + rnd() * 0.18) }));
      b.position.set(-24 + i * 1.9 + rnd(), bh / 2 - 2, -14 - rnd() * 5);
      scene.add(b);
    }
    // Masa, koltuk, bilgisayar, telefon
    box(3.2, 0.12, 1.4, 0x4a2f22, 0, 0.85, -0.6, 0.5);
    box(0.12, 0.8, 1.3, 0x3b251b, -1.5, 0.42, -0.6);
    box(0.12, 0.8, 1.3, 0x3b251b, 1.5, 0.42, -0.6);
    box(2.9, 0.6, 0.06, 0x3b251b, 0, 0.5, -1.2);
    box(0.9, 0.55, 0.06, 0x20242a, -0.6, 1.2, -0.95, 0.3);
    box(0.5, 0.04, 0.3, 0xe8e8e8, 0.7, 0.93, -0.5, 0.4);
    box(0.7, 1.1, 0.7, 0x1f1f24, 0, 0.65, -1.85, 0.5);       // koltuk sırtı
    box(0.8, 0.12, 0.8, 0x1f1f24, 0, 0.5, -1.5, 0.5);
    // Televizyon (sol duvar), dosya dolabı ve kasa
    const tv = new THREE.Group();
    const tvBox = (bw, bh, bd, color, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat(color, 0.3));
      m.position.set(x, y, z);
      tv.add(m);
      return m;
    };
    tvBox(1.3, 0.5, 0.5, 0x3b2a20, 0, 0.25, 0);       // sehpa
    tvBox(1.5, 0.9, 0.08, 0x111318, 0, 1.0, 0);       // ekran çerçevesi
    this.tvScreen = tvBox(1.36, 0.78, 0.02, 0x2f6fae, 0, 1.0, 0.05);
    tv.position.set(-2.1, 0, 0.6);
    tv.rotation.y = 0.55;
    scene.add(tv);
    box(1.3, 1.9, 0.6, 0x6e5a48, 2.3, 0.95, -2.3);
    for (let i = 0; i < 3; i++) box(1.2, 0.04, 0.02, 0x3d3127, 2.3, 0.45 + i * 0.6, -1.99);
    box(0.9, 0.9, 0.8, 0x50565e, -2.1, 0.45, 2.9, 0.35);
    box(0.1, 0.25, 0.04, 0xd4b44a, -2.1, 0.55, 3.31, 0.3);
    // Bitkiler
    for (const [x, z] of [[-3.4, -2.6], [3.4, 0.4]]) {
      box(0.5, 0.6, 0.5, 0xb26a3c, x, 0.3, z);
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: 0x3e8e41, flatShading: true }));
      leaf.position.set(x, 1.05, z);
      scene.add(leaf);
    }
    // Kapı (sağ duvar önü)
    box(0.1, 2.3, 1.1, 0x7a5236, w / 2 - 0.12, 1.15, 2.6);
    // Karakterler: sen (pencere önünde) ve sekreter (kapıda)
    const g = this.game;
    this.boss = new Character(g, 'Barbarian');
    this.boss.root.position.set(0.3, 0, -2.5);
    this.boss.root.rotation.y = 0.2;
    scene.add(this.boss.root);
    this.secChar = new Character(g, 'Mage', { look: 2 });
    this.secChar.root.position.set(1.85, 0, 2.2);
    this.secChar.root.rotation.y = -0.5;
    this.secChar.root.visible = false;
    scene.add(this.secChar.root);
    this.anchor = new THREE.Vector3();
  }

  /** Oyuncunun görünümünü plazadaki "sen"e uygula (karakter editöründeki seçimler). */
  syncBoss() {
    const g = this.game;
    if (!this.boss) return;
    const key = JSON.stringify(g.avatar ?? null);
    if (key === this.bossKey) return;
    this.bossKey = key;
    this.boss.rebuildModel(...g.avatarArgs());
    this.boss.current = null;
    this.boss.play('Idle');
  }

  // ---- Açma / kapama ----

  show() {
    const g = this.game;
    if (g.drive?.active) g.drive.end();
    this.build();
    this.syncBoss();
    this.open = true;
    g.ceoDesk.unseen = 0;
    g.ceoDesk.syncButton();
    this.el.classList.remove('hidden');
    document.body.classList.add('in-plaza');
    this.secChar.root.visible = !!this.sec;
    this.resize();
    this.refresh();
    if (!this.introDone) this.intro();
  }

  hide() {
    this.open = false;
    this.closeSheet();
    this.el.classList.add('hidden');
    document.body.classList.remove('in-plaza');
  }

  resize() {
    if (!this.camera) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const a = W / H;
    this.camera.aspect = a;
    // Dar ekranda (telefon dikey): kamera yukarıdan bakar, görüş açısı genişler; geniş ekranda odanın önünden
    if (a < 0.8) {
      this.camera.fov = 58;
      this.camera.position.set(0, 6.4, 9.6);
      this.camera.lookAt(0, 0.9, 0.2);
    } else {
      this.camera.fov = 50;
      this.camera.position.set(0, 3.6, 8.5);
      this.camera.lookAt(0, 1.3, -0.4);
    }
    this.camera.updateProjectionMatrix();
  }

  /** Şehir moduna ilk geçiş: sekreter kendini tanıtır. */
  intro() {
    this.introDone = true;
    this.openSheet('secretary');
    this.game.save();
  }

  // ---- Zaman ----

  update(dt) {
    if (!this.open || !this.built) return;
    this.boss?.mixer.update(dt);
    if (this.sec) this.secChar.mixer.update(dt);
    this.placeSpots();
    this.tick += dt;
    if (this.tick > 0.5) {
      this.tick = 0;
      this.renderTop();
      if (this.panel === 'agenda' || this.panel === 'secretary') this.renderSheet(true);
    }
  }

  render(renderer) {
    if (this.camera.aspect !== window.innerWidth / window.innerHeight) this.resize();
    renderer.shadowMap.autoUpdate = false;
    renderer.render(this.scene, this.camera);
    renderer.shadowMap.autoUpdate = true;
  }

  /** Nesne düğmeleri 3D noktaların ekrandaki yerine. */
  placeSpots() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (const s of this.spots) {
      const el = (s.el ??= this.spotsEl.querySelector(`[data-spot="${s.id}"]`));
      this.anchor.set(...s.pos).project(this.camera);
      el.style.transform = `translate(${Math.round((this.anchor.x * 0.5 + 0.5) * W)}px, ${Math.round((-this.anchor.y * 0.5 + 0.5) * H)}px) translate(-50%, -50%)`;
    }
  }

  // ---- Arayüz ----

  refresh() {
    if (!this.open) return;
    this.renderTop();
    this.renderBottom();
    if (this.panel) this.renderSheet();
  }

  renderTop() {
    const g = this.game;
    const desk = g.ceoDesk;
    this.top.innerHTML = `<div class="plz-title"><b>🏢 ${esc(desk.name)}</b><span>${t('Gün {n}', { n: g.day.day })} · ${g.day.clockText}</span></div>
      <div class="plz-stats">
        <span>💵 $${formatMoney(Math.round(g.money))}</span>
        <span>⭐ ${t('%{n}', { n: g.politics?.popularity ?? 0 })}</span>
        ${g.politics?.started ? `<span>⚖️ ${g.legal.levelText}</span>` : ''}
      </div>`;
  }

  renderBottom() {
    const g = this.game;
    const ev = g.events;
    const n = ev.pending('ceo');
    const next = ev.active.filter((a) => g.day.t < a.from).sort((a, b) => a.from - b.from)[0];
    const msg = g.day.phase !== 'open' ? t('Gece: ajanda sabah 08:00\'de gelir.')
      : n ? t('Bugün {n} madde bekliyor', { n }) + (next ? ` · ${t('sıradaki {time}', { time: ev.clock(next.from) })}` : '')
        : t('Bugünün ajandası tamam.');
    this.bottom.innerHTML = `<button class="plz-agenda" data-spot="agenda">🗂️ ${msg}</button>`;
    const badge = this.spotsEl.querySelector('[data-spot="agenda"] .badge');
    badge.textContent = n || '';
    badge.classList.toggle('hidden', !n);
    const secBadge = this.spotsEl.querySelector('[data-spot="secretary"] .badge');
    secBadge.textContent = this.sec ? '' : '!';
    secBadge.classList.toggle('hidden', !!this.sec);
  }

  openSheet(id) {
    this.panel = id;
    this.sheet.classList.remove('hidden');
    this.renderSheet();
    this.game.audio.play('click');
  }

  closeSheet() {
    this.panel = null;
    this.sheet.classList.add('hidden');
  }

  renderSheet(soft = false) {
    const g = this.game;
    const titles = { agenda: `🗂️ ${t('Günün ajandası')}`, secretary: `☎️ ${t('Sekreter')}`, tv: `📺 ${t('Haberler')}`, dossier: `🗄️ ${t('İşletmeler')}`, safe: `🏦 ${t('Kasa ve banka')}` };
    if (soft && this.pointerBusy) return;
    this.sheetTitle.textContent = titles[this.panel] ?? '';
    let html = '';
    if (this.panel === 'agenda') {
      const cards = g.events.agendaHtml('ceo');
      html = cards || `<p class="note">${g.day.phase === 'open' ? t('Bugünün gündemi tamam. Yarın yeni konular gelecek.') : t('Gece: gündem sabah açılır.')}</p>`;
      if (g.events.log.length) html += `<h4>📜 ${t('Bugün ne yaptın')}</h4>${g.ceoDesk.logHtml(8)}`;
    } else if (this.panel === 'secretary') html = this.secretaryHtml();
    else if (this.panel === 'tv') html = this.tvHtml();
    else if (this.panel === 'dossier') html = `${g.ceoDesk.dossierHtml()}<div class="biz-btns"><button data-tablet>💼 ${t('Tableti aç')}</button></div>`;
    else if (this.panel === 'safe') html = g.office.panel.bankHtml();
    if (soft && html === this.lastSheet) return;
    this.lastSheet = html;
    const sc = this.sheetBody.scrollTop;
    this.sheetBody.innerHTML = html;
    this.sheetBody.scrollTop = sc;
  }

  secretaryHtml() {
    const g = this.game;
    if (!this.sec) {
      const S = SECRETARY;
      const prem = !g.premium;
      return `<p>${t('Merhaba! Ben Selin. Holdingin artık bir merkez ofisi var; günün ajandasını, randevuları ve şehirdeki dostlarını ben takip edebilirim.')}</p>
        <div class="acc-tier"><b>☎️ ${t('Sekreter')} · ${t('maaş ${n}/gün', { n: S.std.wage })}</b><small>${t('Sabah ajandayı getirir, etkinlik saatlerini hatırlatır, haberleri {n} gün önceden duyurur.', { n: S.std.notice })}</small>
          <button data-hire="std" ${g.money < S.std.wage ? 'disabled' : ''}><span>${t('İşe al')}</span></button></div>
        <div class="acc-tier"><b>🎓 ${t('Tecrübeli asistan')} · ${t('maaş ${n}/gün', { n: S.expert.wage })}</b><small>${t('Haberleri {n} gün önceden duyurur, çiçek ve tebrik gibi ufak işleri kendisi yapar (ilişkiler kendiliğinden ısınır).', { n: S.expert.notice })}</small>
          ${prem ? `<button data-premium class="acc-prem"><span>👑 ${t('Premium\'a özel')}</span></button>` : `<button data-hire="expert"><span>${t('İşe al')}</span></button>`}</div>
        <p class="note">${t('Sekreter olmadan da ajanda masanda; ama hatırlatma ve brifing gelmez.')}</p>`;
    }
    const s = this.secretary;
    const ev = g.events;
    const items = ev.active.map((a) => {
      const c = ev.card(a.id);
      return c ? `<li>${c.emoji} <b>${c.kind && c.kind !== 'decision' ? `${ev.clock(a.from)}–${ev.clock(a.to)}` : t('gün içinde')}</b> ${t(c.title, a.vars)}</li>` : '';
    }).join('');
    const brief = g.day.phase !== 'open' ? t('İyi akşamlar! Yarın sabah 08:00\'de ajandayı getireceğim.')
      : items ? t('Günaydın! Bugünkü programınız:') : t('Bugün başka randevunuz yok.');
    return `<div class="sec-brief"><span class="sec-face">👩‍💼</span><div><b>${s.name}</b><small>${s.tier === 'expert' ? t('Tecrübeli asistan') : t('Sekreter')} · ${t('maaş ${n}/gün', { n: s.wage })}</small></div></div>
      <p>${brief}</p>${items ? `<ul class="sec-list">${items}</ul>` : ''}
      <h4>📇 ${t('Rehber (ilişkiler)')}</h4>${g.relations.html()}
      <p class="note">${t('İlişkiler kararlarınla değişir; iyi ilişki teklifleri ve başarı şansını artırır. Banka müdürüyle iyi ilişki kredi faizini düşürür.')}</p>
      <div class="biz-btns"><button data-fire-sec>${t('İşten çıkar')}</button></div>`;
  }

  tvHtml() {
    const g = this.game;
    const news = g.events.log.slice(0, 10).map((l) => `<div>${t('Gün {n}', { n: l.day })}: ${l.text}</div>`).join('');
    const gm = g.gm.active ? `<p class="note">🧑‍💼 ${t('Genel müdür yönetiyor')} · ${t('verim {n}', { n: t('%{n}', { n: Math.round(g.gm.ratio * 100) }) })}</p>` : '';
    const pol = g.politics?.started ? `<p class="note">🗳️ ${t('Anket: sen {me}, {name} {main}', { me: t('%{n}', { n: g.politics.poll().me }), name: g.politics.poll().mainName, main: t('%{n}', { n: g.politics.poll().main }) })}</p>` : '';
    const club = g.club?.unlocked && g.club.results.length ? `<p class="note">⚽ ${g.club.results.slice(0, 2).map((r) => `${t('Kasaba Spor')} ${r.gf}–${r.ga} ${r.opp}`).join(' · ')}</p>` : '';
    return `${gm}${pol}${club}<div class="ceo-log">${news || `<div>${t('Henüz haber yok.')}</div>`}</div>`;
  }

  hireSecretary(tier) {
    const g = this.game;
    const d = SECRETARY[tier];
    if (!d || (d.premium && !g.premium)) return;
    this.sec = tier;
    this.secChar.root.visible = true;
    g.hud.toast(`☎️ ${t('{name} işe başladı', { name: d.name })}`);
    g.save();
  }

  /** Gün sonu: tecrübeli asistanın ufak işleri. Maaş `payrollEntry` ile. */
  endOfDay() {
    const g = this.game;
    if (this.sec !== 'expert' || !g.cityMode) return;
    const people = g.relations.people;
    const [id] = people[Math.floor(Math.random() * people.length)];
    const s = g.relations.change(id, 2);
    g.hud.toast(`☎️ ${t('{name} sizin adınıza çiçek gönderdi', { name: SECRETARY.expert.name })} · ${s}`);
  }

  payrollEntry() {
    if (!this.sec) return null;
    return { wage: SECRETARY[this.sec].wage, label: `☎️ ${t('Sekreter')}`, fire: () => this.fireSecretary() };
  }

  fireSecretary() {
    this.sec = null;
    if (this.secChar) this.secChar.root.visible = false;
    this.game.hud.toast(`☎️ ${t('Sekreter ayrıldı')}`);
  }

  onClick(e) {
    const g = this.game;
    if (e.target.closest('[data-close]')) return this.closeSheet();
    if (this.panel === 'agenda' && g.events.handleAgendaClick(e)) return;
    if (this.panel === 'safe' && g.office.panel.bankAction(e)) return this.renderSheet();
    const spot = e.target.closest('[data-spot]');
    if (spot) {
      const id = spot.dataset.spot;
      if (id === 'window') return this.goMarket();
      if (id === 'garage') return this.goCity();
      return this.openSheet(id);
    }
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.hire) this.hireSecretary(b.dataset.hire);
    else if (b.dataset.fireSec !== undefined) this.fireSecretary();
    else if (b.dataset.premium !== undefined) {
      this.hide();
      g.menus?.showPremium?.();
      return;
    } else if (b.dataset.tablet !== undefined) {
      this.hide();
      g.holding.open('biz');
      return;
    } else if (b.dataset.expand) g.holding.get(b.dataset.expand)?.expand();
    this.renderSheet();
    this.renderBottom();
  }

  /** Markete git: plaza kapanır, oyuncu marketin önüne. */
  goMarket() {
    this.hide();
    this.game.holding.goTo('market');
  }

  /** Şehre çık: makam aracı plazanın önünde. */
  goCity() {
    this.game.drive.start();
  }

  serialize() {
    return { sec: this.sec, introDone: this.introDone };
  }

  restore(d) {
    if (!d) return;
    this.sec = d.sec ?? null;
    this.introDone = !!d.introDone;
  }
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
