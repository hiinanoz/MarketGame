import * as THREE from 'three';
import { Character } from './character.js';
import { POLITICS, HOUSING } from './config.js';
import { formatMoney } from './hud.js';

// Siyaset (Sv.51+): nüfuz (popülerlik) toplanır, 2 oyun yılında bir belediye başkanlığı seçimi yapılır.
// Nüfuz: bağış, sponsorluk, kamu binası bağışı, çok kişiye iş verme (100+ çalışan), miting.
// Seçime 6 ay kala 3–5 rakip aday "OY VER" pankartlarıyla haritada gezer ve miting yapar.
// Ana rakip her zaman %25'in üstünde, diğerleri %8'i geçemez; popülerliğin yüksekse kazanırsın.
// Üst üste 4 seçim kazanınca otokrasiye (krallık) geçebilirsin; halk memnuniyeti 2 yıl %50'nin
// altında kalırsa seçimler geri gelir. Başkanken: ceza yok, vergi, imar izni, şehir projeleri.

const M = POLITICS.daysPerMonth;
const YEAR = M * 12;

export class Politics {
  constructor(game) {
    this.game = game;
    this.started = false;
    this.nextElection = 0;   // seçim gününün sonu
    this.temp = 0;           // zamanla azalan nüfuz (bağış, miting, sponsorluk)
    this.donated = 0;
    this.sponsor = false;
    this.buildings = {};     // kamu binaları (park, kütüphane, spor salonu)
    this.projects = {};      // başkanlık projeleri (otogar, stadyum)
    this.mayor = false;
    this.wins = 0;           // üst üste kazanılan seçim
    this.autocracy = false;
    this.lowDays = 0;        // otokraside memnuniyetin %50 altında kaldığı gün
    this.taxRate = 0;
    this.zoned = false;
    this.rallyDay = 0;
    this.rivals = [];        // { name, share, main }
    this.history = [];
    this.walkers = [];
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.pill = document.getElementById('election-pill');
    this.panel = document.getElementById('politics');
    this.body = document.getElementById('politics-body');
    this.pill.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.pill.addEventListener('click', () => this.open());
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    document.getElementById('politics-close').addEventListener('click', () => this.close());
    this.body.addEventListener('click', (e) => this.onClick(e));
    this.buildCity();
  }

  get unlocked() {
    return this.game.level >= POLITICS.fromLevel;
  }

  // ---- Nüfuz ve memnuniyet ----

  /** Kalıcı nüfuz: kamu binaları, okul/sağlık ocağı, istihdam (100+ çalışan). */
  get permanent() {
    let n = 0;
    for (const [k, b] of Object.entries(POLITICS.buildings)) if (this.buildings[k]) n += b.influence;
    for (const k of Object.keys(HOUSING.amenities)) if (this.game.housing.amenities[k]) n += POLITICS.amenityInfluence;
    return n + this.jobsInfluence;
  }

  get jobsInfluence() {
    const s = this.game.totalStaff;
    if (s < POLITICS.jobs.min) return 0;
    return Math.min(POLITICS.jobs.max, POLITICS.jobs.base + Math.floor((s - POLITICS.jobs.min) / POLITICS.jobs.per));
  }

  /** Popülerlik (nüfuz puanı) %. */
  get popularity() {
    return Math.max(0, Math.min(POLITICS.maxPopularity, Math.round(this.permanent + this.temp)));
  }

  /** Halk memnuniyeti % (vergi düşürür; kamu binaları, projeler, iş, market puanı artırır). */
  get satisfaction() {
    const g = this.game;
    let s = 35 + g.rating.stars * 5;
    for (const k of Object.keys(POLITICS.buildings)) if (this.buildings[k]) s += 5;
    for (const k of Object.keys(HOUSING.amenities)) if (g.housing.amenities[k]) s += 3;
    for (const k of Object.keys(POLITICS.projects)) if (this.projects[k]) s += 4;
    s += Math.min(10, g.totalStaff / 15);
    s -= Math.max(0, this.taxRate - 5) * 1.6;
    return Math.max(0, Math.min(100, Math.round(s)));
  }

  /** Anket: senin oyun, ana rakip (en az %25) ve diğer adaylar (en fazla %8). */
  poll() {
    if (!this.rivals.length) this.makeRivals();
    const minors = this.rivals.filter((r) => !r.main);
    const S = minors.reduce((a, r) => a + r.share, 0);
    const me = Math.min(this.popularity * POLITICS.voteFactor, 100 - POLITICS.mainMin - S);
    const main = 100 - me - S;
    return { me: Math.round(me), main: Math.round(main), mainName: this.rivals.find((r) => r.main).name, minors };
  }

  makeRivals() {
    const names = POLITICS.names.slice().sort(() => Math.random() - 0.5);
    const n = 3 + Math.floor(Math.random() * 3); // 3–5 aday
    this.rivals = names.slice(0, n).map((name, i) => ({
      name, main: i === 0, share: i === 0 ? 0 : 2 + Math.round(Math.random() * (POLITICS.minorMax - 2)),
    }));
  }

  // ---- Takvim ----

  /** Oyun günü → "Yıl 3, 5. ay" (1 ay = 2 gün). */
  dateText(day = this.game.day.day) {
    const y = Math.floor((day - 1) / YEAR) + 1;
    const m = Math.floor(((day - 1) % YEAR) / M) + 1;
    return `${y}. yıl ${m}. ay`;
  }

  get daysLeft() {
    return Math.max(0, this.nextElection - this.game.day.day);
  }

  leftText() {
    const d = this.daysLeft;
    if (d === 0) return 'bugün';
    const months = Math.ceil(d / M);
    const y = Math.floor(months / 12);
    const mo = months % 12;
    return [y ? `${y} yıl` : '', mo ? `${mo} ay` : ''].filter(Boolean).join(' ');
  }

  get campaignTime() {
    return this.started && !this.autocracy && this.daysLeft <= POLITICS.campaignMonths * M;
  }

  // ---- İşlemler ----

  donate(amount) {
    const g = this.game;
    if (!this.unlocked || g.money < amount) return false;
    g.spend(amount);
    const pts = amount / (POLITICS.donationPerPoint + g.level * 20);
    this.temp += pts;
    this.donated += amount;
    g.hud.toast(`🤝 Đ${formatMoney(amount)} bağış: nüfuz +${pts.toFixed(1)}`);
    g.save();
    return true;
  }

  build(k) {
    const g = this.game;
    const b = POLITICS.buildings[k];
    if (!b || this.buildings[k] || g.money < b.cost) return false;
    g.spend(b.cost);
    this.buildings[k] = true;
    g.gainXp(Math.floor(b.cost / 100));
    g.hud.toast(`${b.emoji} ${b.name} şehre bağışlandı: kalıcı nüfuz +${b.influence}`);
    g.audio.play('unlock');
    this.buildCity();
    g.save();
    return true;
  }

  rally() {
    const g = this.game;
    const cost = POLITICS.rallyCost + g.level * 60;
    if (!this.campaignTime || this.rallyDay === g.day.day || g.money < cost) return false;
    g.spend(cost);
    this.rallyDay = g.day.day;
    this.temp += POLITICS.rallyPoints;
    g.hud.toast(`📣 Miting yapıldı: nüfuz +${POLITICS.rallyPoints}`);
    g.save();
    return true;
  }

  setTax(r) {
    if (!this.mayor) return;
    this.taxRate = Math.max(0, Math.min(POLITICS.taxMax, r));
    this.game.save();
  }

  zone() {
    const g = this.game;
    if (!this.mayor || this.zoned || g.money < POLITICS.zoningCost) return false;
    g.spend(POLITICS.zoningCost);
    this.zoned = true;
    g.housing.openZoned();
    g.hud.toast('🗺️ İmar izni verildi: doğu mahallesinde 4 yeni arsa açıldı');
    g.save();
    return true;
  }

  project(k) {
    const g = this.game;
    const p = POLITICS.projects[k];
    if (!this.mayor || !p || this.projects[k] || g.money < p.cost) return false;
    g.spend(p.cost);
    this.projects[k] = true;
    g.gainXp(Math.floor(p.cost / 100));
    g.hud.toast(`${p.emoji} ${p.name} ihalesi senin: inşa edildi`);
    g.audio.play('unlock');
    this.buildCity();
    g.save();
    return true;
  }

  enterAutocracy() {
    if (this.wins < POLITICS.autocracyWins || this.autocracy) return false;
    this.autocracy = true;
    this.lowDays = 0;
    this.removeWalkers();
    this.game.hud.toast('👑 Otokrasi: artık seçim yok — kralsın! Halkı memnun tut.');
    this.game.save();
    return true;
  }

  /** Müşteri çarpanı (otogar, stadyum maç günü). */
  get customerFactor() {
    let f = 1;
    if (this.projects.bus) f *= POLITICS.projects.bus.customers;
    if (this.projects.stadium && this.game.day.day % POLITICS.projects.stadium.everyDays === 0) f *= POLITICS.projects.stadium.customers;
    return f;
  }

  // ---- Zaman ----

  update(dt) {
    const g = this.game;
    const show = this.unlocked;
    this.pill.classList.toggle('hidden', !show);
    if (!show) return;
    if (!this.started) {
      this.started = true;
      this.nextElection = g.day.day + POLITICS.termYears * YEAR;
      this.makeRivals();
      g.hud.toast(`🗳️ Siyaset açıldı! Seçime ${this.leftText()} var — nüfuzunu artır`);
    }
    const txt = this.autocracy ? '👑 Kral' : `🗳️ Seçime ${this.leftText()} · %${this.popularity}`;
    if (txt !== this.pillText) {
      this.pillText = txt;
      this.pill.textContent = txt;
    }
    // Rakip adaylar seçime 6 ay kala gezer
    if (this.campaignTime && !this.walkers.length) this.spawnWalkers();
    if (!this.campaignTime && this.walkers.length) this.removeWalkers();
    for (const w of this.walkers) w.update(dt);
    if (this.isOpen) {
      this.tick = (this.tick ?? 0) + dt;
      if (this.tick > 1.5) {
        this.tick = 0;
        this.render();
      }
    }
  }

  /** Gün sonu: nüfuz azalması, sponsorluk, vergi ve proje gelirleri, seçim. */
  endOfDay(today) {
    const g = this.game;
    if (!this.started) return;
    const info = {};
    this.temp *= 1 - POLITICS.decay;
    if (this.sponsor) {
      const c = POLITICS.sponsorCost + g.level * 20;
      if (g.money >= c) {
        g.money -= c;
        this.temp += POLITICS.sponsorPoints;
        info.sponsor = c;
      } else {
        this.sponsor = false;
        g.hud.toast('⚽ Sponsorluk ödenemedi, bitti');
      }
    }
    if (this.mayor) {
      if (this.taxRate) {
        const tax = Math.round(this.taxRate / 100 * (POLITICS.taxBase + g.level * 100 + g.housing.ownedCount * 300));
        g.money += tax;
        info.tax = tax;
      }
      let proj = 0;
      for (const [k, p] of Object.entries(POLITICS.projects)) if (this.projects[k]) proj += p.income;
      if (proj) {
        g.money += proj;
        info.projects = proj;
      }
    }
    // Otokrasi: memnuniyet 2 yıl %50 altında kalırsa seçimler geri gelir
    if (this.autocracy) {
      this.lowDays = this.satisfaction < 50 ? this.lowDays + 1 : 0;
      if (this.lowDays >= POLITICS.revoltYears * YEAR) {
        this.autocracy = false;
        this.wins = 0;
        this.nextElection = g.day.day + POLITICS.campaignMonths * M;
        info.revolt = true;
        g.hud.toast('📢 Halk memnun değil: seçimler geri geldi!');
      }
    } else if (g.day.day >= this.nextElection) {
      info.election = this.holdElection();
    }
    if (Object.keys(info).length) today.politics = info;
    g.hud.setMoney(g.money);
  }

  holdElection() {
    const g = this.game;
    const p = this.poll();
    const noise = Math.round((Math.random() - 0.5) * 4);
    const S = p.minors.reduce((a, r) => a + r.share, 0);
    const me = Math.max(0, Math.min(p.me + noise, 100 - POLITICS.mainMin - S)); // ana rakip en az %25
    const main = 100 - me - S;
    const won = me > main;
    if (won) {
      this.wins++;
      this.mayor = true;
    } else {
      this.wins = 0;
      this.mayor = false;
      this.taxRate = 0;
    }
    g.isMayor = this.mayor;
    const res = { won, me, main, mainName: p.mainName, minors: p.minors.map((r) => ({ ...r })) };
    this.history.push({ day: g.day.day, ...res });
    this.nextElection = g.day.day + POLITICS.termYears * YEAR;
    this.makeRivals();
    this.removeWalkers();
    g.hud.toast(won ? `🎉 Seçimi kazandın (%${me})! Belediye başkanısın` : `😞 Seçimi ${p.mainName} kazandı (%${main}). Sen %${me}`);
    if (won) g.gainXp(POLITICS.winXp);
    return res;
  }

  // ---- Rakip adaylar (haritada) ----

  spawnWalkers() {
    const looks = ['Knight', 'Rogue', 'Mage', 'Rogue_Hooded'];
    this.rivals.forEach((r, i) => {
      const w = new Candidate(this.game, looks[i % looks.length], r.name, i);
      this.walkers.push(w);
    });
  }

  removeWalkers() {
    for (const w of this.walkers) this.game.scene.remove(w.root);
    this.walkers = [];
  }

  // ---- Şehir merkezi görselleri ----

  buildCity() {
    for (const c of [...this.root.children]) this.root.remove(c);
    const all = { ...POLITICS.buildings, ...POLITICS.projects };
    for (const [k, b] of Object.entries(all)) {
      const built = this.buildings[k] || this.projects[k];
      const g = new THREE.Group();
      g.position.set(b.pos[0], 0, b.pos[1]);
      if (built) g.add(cityMesh(k));
      else {
        const pad = new THREE.Mesh(new THREE.PlaneGeometry(b.size[0], b.size[1]), new THREE.MeshStandardMaterial({ color: 0xd8cfb0, roughness: 1, transparent: true, opacity: 0.6 }));
        pad.rotation.x = -Math.PI / 2;
        pad.position.y = 0.012;
        g.add(pad);
      }
      this.root.add(g);
    }
  }

  // ---- Panel ----

  get isOpen() {
    return !this.panel.classList.contains('hidden');
  }

  open() {
    this.panel.classList.remove('hidden');
    this.render();
  }

  close() {
    this.panel.classList.add('hidden');
  }

  render() {
    const g = this.game;
    const m = g.money;
    const p = this.poll();
    const bar = (label, v, cls = '') => `<div class="poll-row ${cls}"><span>${label}</span><div class="progress"><i style="width:${v}%"></i></div><b>%${v}</b></div>`;
    const parts = [];
    parts.push(`<div class="stats">
      <div><span>📅 Bugün</span><b>${this.dateText()}</b></div>
      <div><span>${this.autocracy ? '👑 Yönetim' : '🗳️ Seçime kalan'}</span><b>${this.autocracy ? 'Otokrasi' : this.leftText()}</b></div>
      <div><span>⭐ Popülerlik (nüfuz)</span><b>%${this.popularity}</b></div>
      <div><span>😊 Halk memnuniyeti</span><b>%${this.satisfaction}</b></div>
      <div><span>🏛️ Makam</span><b>${this.autocracy ? 'Kral' : this.mayor ? (this.wins ? `Belediye başkanı (${this.wins}. dönem)` : 'Belediye başkanı') : 'yok'}</b></div>
    </div>`);
    if (!this.autocracy) {
      parts.push(`<p class="note"><b>Anket</b> — popülerliğin yüksekse seçimi kazanırsın.</p>
        ${bar(`🙋 Sen`, p.me, 'me')}${bar(`🟥 ${p.mainName}`, p.main)}${p.minors.map((r) => bar(`▫️ ${r.name}`, r.share)).join('')}`);
    } else if (this.lowDays) {
      parts.push(`<p class="note warn">⚠️ Memnuniyet ${this.lowDays} gündür %50'nin altında. ${POLITICS.revoltYears * YEAR - this.lowDays} gün daha sürerse seçimler geri gelir.</p>`);
    }
    // Nüfuz kaynakları
    parts.push(`<p class="note"><b>Nüfuz kaynakları</b> · kalıcı ${this.permanent} + geçici ${this.temp.toFixed(1)} (geçici puan her gün %${Math.round(POLITICS.decay * 100)} azalır)</p>
      <div class="biz-row"><span>👥 İstihdam</span><b>${g.totalStaff} çalışan</b><small>${this.jobsInfluence ? `+${this.jobsInfluence} nüfuz` : `${POLITICS.jobs.min}+ çalışanda nüfuz verir`}</small></div>
      <div class="bank-group"><span>🤝 Bağış</span>${POLITICS.donations.map((n) => `<button data-donate="${n}" ${m < n ? 'disabled' : ''}>Đ${formatMoney(n)}</button>`).join('')}</div>
      <div class="biz-row"><span>⚽ Spor kulübü sponsorluğu</span><b>${this.sponsor ? 'var' : 'yok'}</b><button data-sponsor>${this.sponsor ? 'Bitir' : `Başla Đ${formatMoney(POLITICS.sponsorCost + g.level * 20)}/gün`}</button></div>
      ${this.campaignTime ? `<div class="biz-row"><span>📣 Miting</span><b>+${POLITICS.rallyPoints} nüfuz</b><button data-rally ${this.rallyDay === g.day.day || m < POLITICS.rallyCost + g.level * 60 ? 'disabled' : ''}>${this.rallyDay === g.day.day ? 'bugün yapıldı' : `Yap Đ${formatMoney(POLITICS.rallyCost + g.level * 60)}`}</button></div>` : ''}`);
    parts.push(`<p class="note"><b>Kamu binası bağışla</b> (şehir merkezi, kalıcı nüfuz)</p>${Object.entries(POLITICS.buildings).map(([k, b]) => `<div class="biz-row"><span>${b.emoji} ${b.name}</span><b>${this.buildings[k] ? 'yapıldı' : `+${b.influence} nüfuz`}</b>${this.buildings[k] ? '' : `<button data-build="${k}" ${m < b.cost ? 'disabled' : ''}>Đ${formatMoney(b.cost)}</button>`}</div>`).join('')}`);
    if (this.mayor) {
      parts.push(`<p class="note"><b>Başkanlık</b> · belediye cezası kesilmez</p>
        <div class="bank-group"><span>💰 Vergi %${this.taxRate}</span>${[0, 5, 10, 15, 20, 30].map((r) => `<button data-tax="${r}" ${r === this.taxRate ? 'class="primary"' : ''}>%${r}</button>`).join('')}</div>
        <p class="note">Vergi her gün gelir getirir ama %5'in üstü halk memnuniyetini düşürür.</p>
        <div class="biz-row"><span>🗺️ İmar izni</span><b>${this.zoned ? 'verildi' : '+4 arsa'}</b>${this.zoned ? '' : `<button data-zone ${m < POLITICS.zoningCost ? 'disabled' : ''}>Đ${formatMoney(POLITICS.zoningCost)}</button>`}</div>
        ${Object.entries(POLITICS.projects).map(([k, pr]) => `<div class="biz-row"><span>${pr.emoji} ${pr.name}</span><b>${this.projects[k] ? `+Đ${formatMoney(pr.income)}/gün` : pr.desc}</b>${this.projects[k] ? '' : `<button data-project="${k}" ${m < pr.cost ? 'disabled' : ''}>İhale Đ${formatMoney(pr.cost)}</button>`}</div>`).join('')}`);
    }
    if (this.wins >= POLITICS.autocracyWins && !this.autocracy) {
      parts.push(`<div class="biz-btns"><button class="primary" data-autocracy>👑 Otokrasiye geç (seçimler kalkar)</button></div>`);
    } else if (!this.autocracy) {
      parts.push(`<p class="note">Üst üste ${POLITICS.autocracyWins} seçim kazanırsan otokrasiye geçebilirsin (şu an ${this.wins}).</p>`);
    }
    if (this.history.length) {
      parts.push(`<p class="note"><b>Geçmiş seçimler</b><br>${this.history.slice(-4).reverse().map((h) => `${this.dateText(h.day)}: ${h.won ? '✅ kazandın' : `❌ ${h.mainName} kazandı`} (sen %${h.me}, rakip %${h.main})`).join('<br>')}</p>`);
    }
    this.body.innerHTML = parts.join('');
  }

  onClick(e) {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.donate) this.donate(Number(d.donate));
    if (d.sponsor !== undefined) this.sponsor = !this.sponsor;
    if (d.rally !== undefined) this.rally();
    if (d.build) this.build(d.build);
    if (d.tax !== undefined) this.setTax(Number(d.tax));
    if (d.zone !== undefined) this.zone();
    if (d.project) this.project(d.project);
    if (d.autocracy !== undefined) this.enterAutocracy();
    this.render();
  }

  serialize() {
    const { started, nextElection, temp, donated, sponsor, buildings, projects, mayor, wins, autocracy, lowDays, taxRate, zoned, rallyDay, rivals, history } = this;
    return { started, nextElection, temp, donated, sponsor, buildings, projects, mayor, wins, autocracy, lowDays, taxRate, zoned, rallyDay, rivals, history };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this, d);
    this.buildings ??= {};
    this.projects ??= {};
    this.history ??= [];
    this.rivals ??= [];
    this.game.isMayor = this.mayor || this.autocracy;
    if (this.zoned) this.game.housing.openZoned();
    this.buildCity();
  }
}

// ---- Rakip aday karakteri: "OY VER" pankartıyla gezer, ara sıra miting yapar ----

const SPOTS = [[-30, 14], [-12, 13.5], [6, 13.5], [24, 13.5], [-40, 8], [-20, 10.5], [14, 11]];

class Candidate extends Character {
  constructor(game, model, name, i) {
    super(game, model, { speed: 2.2, look: i % 6 });
    const [x, z] = SPOTS[i % SPOTS.length];
    this.position.set(x, 0, z);
    this.name = name;
    this.timer = 2 + i;
    this.rallyT = 0;
    // Pankart: direk + "OY VER" levhası
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 0.06), new THREE.MeshStandardMaterial({ color: 0x6b4a33 }));
    pole.position.set(0.35, 1.5, 0.2);
    this.root.add(pole);
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 244, 148);
    ctx.fillStyle = '#c0392b';
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px "Trebuchet MS", sans-serif';
    ctx.fillText('OY VER', 128, 64);
    ctx.fillStyle = '#222';
    ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
    ctx.fillText(name, 128, 118, 236);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.set(0.35, 2.55, 0.2);
    this.board = board;
    this.root.add(board);
    // Miting balonu
    const bc = document.createElement('canvas');
    bc.width = 256;
    bc.height = 96;
    const b = bc.getContext('2d');
    b.fillStyle = 'rgba(192,57,43,0.9)';
    b.beginPath();
    b.roundRect(4, 4, 248, 88, 30);
    b.fill();
    b.fillStyle = '#fff';
    b.font = 'bold 44px "Trebuchet MS", sans-serif';
    b.textAlign = 'center';
    b.textBaseline = 'middle';
    b.fillText('📣 MİTİNG', 128, 50);
    const btex = new THREE.CanvasTexture(bc);
    btex.colorSpace = THREE.SRGBColorSpace;
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: btex, transparent: true, depthTest: false }));
    this.bubble.scale.set(2, 0.75, 1);
    this.bubble.position.set(0, 3.6, 0);
    this.bubble.visible = false;
    this.root.add(this.bubble);
    game.scene.add(this.root);
  }

  update(dt) {
    this.board.lookAt(this.board.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, 1)));
    if (this.rallyT > 0) {
      this.rallyT -= dt;
      this.bubble.visible = true;
      this.root.rotation.y = 0;
      if (this.rallyT <= 0) this.bubble.visible = false;
    } else {
      this.timer -= dt;
      if (this.timer <= 0 && !this.path) {
        if (Math.random() < 0.35) {
          this.rallyT = 8 + Math.random() * 8; // bir süre durup miting yapar
        } else {
          const [x, z] = SPOTS[Math.floor(Math.random() * SPOTS.length)];
          this.goTo(x + (Math.random() - 0.5) * 3, z);
        }
        this.timer = 4 + Math.random() * 5;
      }
      this.followPath(dt);
    }
    super.update(dt);
  }
}

// ---- Şehir merkezi binaları (basit) ----

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cityMesh(k) {
  const g = new THREE.Group();
  if (k === 'park') {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.MeshStandardMaterial({ color: 0x6fbf4a }));
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0.015;
    g.add(grass);
    for (const [x, z] of [[-3.5, -2.5], [3.5, -2.5], [-3.5, 2.5], [3.5, 2.5]]) {
      g.add(box(0.3, 1.4, 0.3, 0x6d4c41, x, 0.7, z));
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: 0x3f9a3a, flatShading: true }));
      crown.position.set(x, 2.1, z);
      crown.castShadow = true;
      g.add(crown);
    }
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1.5, 20), new THREE.MeshStandardMaterial({ color: 0x4fc3f7 }));
    pond.rotation.x = -Math.PI / 2;
    pond.position.y = 0.03;
    g.add(pond);
  } else if (k === 'library') {
    g.add(box(9, 3.6, 6, 0xe8dcc0, 0, 1.8, 0));
    g.add(box(9.6, 0.4, 6.6, 0x8d6e63, 0, 3.8, 0));
    for (let i = -3; i <= 3; i += 2) g.add(box(0.4, 3.2, 0.4, 0xffffff, i, 1.6, 3.2));
  } else if (k === 'gym') {
    g.add(box(11, 4, 7, 0x90caf9, 0, 2, 0));
    g.add(box(11.4, 0.4, 7.4, 0x37474f, 0, 4.2, 0));
  } else if (k === 'bus') {
    g.add(box(12, 0.2, 8, 0x9e9e9e, 0, 0.1, 0));
    g.add(box(10, 0.3, 3, 0xff8f00, 0, 3.2, -2));
    for (const x of [-4.5, 0, 4.5]) g.add(box(0.25, 3, 0.25, 0x546e7a, x, 1.6, -2));
    g.add(box(6, 2.2, 2.2, 0x1e88e5, -1, 1.2, 1.8)); // otobüs
  } else if (k === 'stadium') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 1.6, 6, 28), new THREE.MeshStandardMaterial({ color: 0xcfd8dc }));
    ring.rotation.x = -Math.PI / 2;
    ring.scale.set(1.3, 1, 1);
    ring.position.y = 1.2;
    ring.castShadow = true;
    g.add(ring);
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(13, 8), new THREE.MeshStandardMaterial({ color: 0x43a047 }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.02;
    g.add(pitch);
  }
  return g;
}
