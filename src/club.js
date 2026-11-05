import * as THREE from 'three';
import { t } from './i18n.js';
import { CLUB } from './config.js';
import { formatMoney } from './hud.js';
import { Character } from './character.js';
import { CHARACTER_NAMES } from './assets.js';

// Spor kulübü (Sv.40+): "Kasaba Spor". Sponsorluk (günlük ücret → müşteri + taraftar + nüfuz), bağış →
// yönetim kurulu, sezon sonunda başkanlık seçimi (olay kartı). Başkanken transfer ve teknik direktör kararları,
// iyi sezon siyasette artı, kötü sezon eksi yazar. Her 2 günde bir maç: haritadaki sahada taraftar kalabalığı,
// sponsor / yönetimdeysen markete formalı taraftar akını.

const ROLES = { fan: 0, board: 1, president: 2 };

export class Club {
  constructor(game) {
    this.game = game;
    this.sponsor = false;
    this.donated = 0;
    this.role = 'fan';
    this.fans = 20;            // taraftarın sana sevgisi (0–100)
    this.strength = CLUB.strength;
    this.season = 1;
    this.played = 0;
    this.table = null;         // [{ name, pts, me }]
    this.results = [];         // son maçlar: { day, opp, gf, ga }
    this.history = [];         // sezon sonuçları: { season, pos }
    this.unseen = 0;
    this.btn = document.getElementById('club-btn');
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', () => this.open());
    this.el = document.createElement('div');
    this.el.id = 'club';
    this.el.className = 'overlay hidden';
    this.el.innerHTML = `<div class="panel holding"><div class="sheet-head"><b>⚽ ${t('Kasaba Spor')}</b><button class="x" data-close aria-label="✕">✕</button></div><div class="club-body"></div></div>`;
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => this.onClick(e));
    document.body.appendChild(this.el);
    this.body = this.el.querySelector('.club-body');
    this.root = new THREE.Group();
    this.root.position.set(CLUB.pos[0], 0, CLUB.pos[1]);
    game.scene.add(this.root);
    this.crowd = [];
    this.groundBuilt = null;
  }

  get unlocked() {
    return this.game.level >= CLUB.fromLevel;
  }

  get rank() {
    return ROLES[this.role] ?? 0;
  }

  get isMatchDay() {
    return this.game.day.day % CLUB.matchEvery === 0;
  }

  get involved() {
    return this.sponsor || this.rank > 0;
  }

  /** Market müşteri çarpanı. */
  get customerFactor() {
    if (!this.unlocked) return 1;
    let f = this.sponsor ? CLUB.sponsor.customers : 1;
    if (this.involved && this.isMatchDay && this.game.day.phase === 'open') f *= CLUB.matchCustomers;
    return f;
  }

  /** Siyasete kalıcı nüfuz (yönetim kurulu / başkanlık). */
  get influence() {
    return this.role === 'president' ? CLUB.influence.president : this.role === 'board' ? CLUB.influence.board : 0;
  }

  sponsorCost() {
    return CLUB.sponsor.cost + this.game.level * CLUB.sponsor.perLevel;
  }

  transferCost() {
    return CLUB.transfer.cost + this.game.level * CLUB.transfer.perLevel;
  }

  ensureTable() {
    if (this.table) return;
    this.table = [{ name: t('Kasaba Spor'), pts: 0, me: true }, ...CLUB.rivals.slice(0, CLUB.teams - 1).map((name) => ({ name, pts: 0, str: 40 + Math.round(Math.random() * 30) }))];
  }

  get position() {
    this.ensureTable();
    const sorted = [...this.table].sort((a, b) => b.pts - a.pts || (a.me ? -1 : 1));
    return sorted.findIndex((x) => x.me) + 1;
  }

  // ---- İşlemler ----

  toggleSponsor() {
    this.sponsor = !this.sponsor;
    this.game.hud.toast(this.sponsor ? `⚽ ${t('Kasaba Spor sponsoru oldun: formanda logon, maç günleri marketine taraftar akını')}` : `⚽ ${t('Sponsorluk bitti')}`);
    this.game.save();
  }

  donate(n) {
    const g = this.game;
    if (g.money < n) return false;
    g.spend(n);
    this.donated += n;
    this.fans = Math.min(100, this.fans + n / CLUB.fansPer);
    g.hud.toast(`⚽ ${t('Kulübe ${n} bağış: taraftar sevgisi arttı', { n: formatMoney(n) })}`);
    if (this.role === 'fan' && this.donated >= CLUB.boardAt) {
      this.role = 'board';
      g.gainXp(200);
      g.hud.toast(`🎖️ ${t('Yönetim kuruluna davet edildin! Siyasette kalıcı nüfuz +{n}', { n: CLUB.influence.board })}`);
      g.audio.play('levelup');
    }
    g.save();
    return true;
  }

  transfer() {
    const g = this.game;
    const c = this.transferCost();
    if (this.role !== 'president' || g.money < c || this.strength >= CLUB.transfer.max) return false;
    g.spend(c);
    this.strength = Math.min(CLUB.transfer.max, this.strength + CLUB.transfer.strength);
    this.fans = Math.min(100, this.fans + 3);
    g.hud.toast(`✍️ ${t('Yıldız transfer! Takım gücü {n}', { n: this.strength })}`);
    g.save();
    return true;
  }

  changeCoach() {
    const g = this.game;
    if (this.role !== 'president' || g.money < CLUB.coach.cost) return false;
    g.spend(CLUB.coach.cost);
    const d = Math.round((Math.random() - 0.35) * 10);
    this.strength = Math.max(30, Math.min(CLUB.transfer.max, this.strength + d));
    g.hud.toast(`📋 ${d >= 0 ? t('Yeni teknik direktör takımı toparladı: güç +{n}', { n: d }) : t('Yeni teknik direktör tutmadı: güç −{n}', { n: -d })}`);
    g.save();
    return true;
  }

  /** Sezon sonuna (başkanlık seçimine) kalan gün. */
  get daysToElection() {
    const g = this.game;
    const left = Math.max(0, CLUB.season - this.played);
    if (!left) return 0;
    const first = g.day.day % CLUB.matchEvery === 0 ? g.day.day : g.day.day + (CLUB.matchEvery - (g.day.day % CLUB.matchEvery));
    return first + (left - 1) * CLUB.matchEvery - g.day.day;
  }

  /** Aday olunca kazanma ihtimali (kampanya dahil). */
  get winChance() {
    return Math.max(0.1, Math.min(0.9, 0.55 + (this.fans - CLUB.electionFans) / 60));
  }

  /** Yönetim kurulu üyesi sezon sonundaki seçime aday olur (kampanya ücreti şimdi). */
  declareCandidacy() {
    const g = this.game;
    if (this.role !== 'board' || this.candidate || g.money < CLUB.campaign) return false;
    g.spend(CLUB.campaign);
    this.candidate = true;
    g.hud.toast(`🗳️ ${t('Kulüp başkanlığına aday oldun! Seçim {n} gün sonra', { n: this.daysToElection })}`);
    g.save();
    return true;
  }

  /** Başkanlık seçimi sonucu. */
  runForPresident(extraChance = 0) {
    const p = Math.max(0.1, Math.min(0.9, 0.45 + (this.fans - CLUB.electionFans) / 60 + extraChance));
    const won = Math.random() < p;
    if (won) {
      this.role = 'president';
      this.game.gainXp(400);
      this.game.audio.play('levelup');
    }
    this.game.save();
    return won;
  }

  // ---- Zaman ----

  update(dt) {
    const g = this.game;
    const show = this.unlocked;
    this.btn.classList.toggle('hidden', !show);
    if (!show) return;
    this.buildGround();
    const crowd = this.isMatchDay && g.day.phase === 'open';
    if (crowd && !this.crowd.length) this.spawnCrowd();
    if (!crowd && this.crowd.length) this.removeCrowd();
    for (const c of this.crowd) c.update(dt);
    if (this.isOpen) {
      this.tick = (this.tick ?? 0) + dt;
      if (this.tick > 1.5) {
        this.tick = 0;
        this.render();
      }
    }
  }

  endOfDay(today) {
    const g = this.game;
    if (!this.unlocked) return;
    const info = {};
    if (this.sponsor) {
      const c = this.sponsorCost();
      if (g.money >= c) {
        g.money -= c;
        this.fans = Math.min(100, this.fans + CLUB.sponsor.fans);
        if (g.politics?.started) g.politics.temp += CLUB.sponsor.influence;
        info.sponsor = c;
      } else {
        this.sponsor = false;
        g.hud.toast(t('⚽ Sponsorluk ödenemedi, bitti'));
      }
    }
    if (this.isMatchDay) info.match = this.playMatch();
    if (this.played >= CLUB.season) info.season = this.endSeason();
    if (Object.keys(info).length) today.club = info;
  }

  playMatch() {
    this.ensureTable();
    const rivals = this.table.filter((x) => !x.me);
    const opp = rivals[this.played % rivals.length];
    const diff = this.strength - opp.str;
    const pWin = Math.max(0.1, Math.min(0.8, 0.38 + diff * 0.012));
    const r = Math.random();
    let gf; let ga;
    if (r < pWin) {
      ga = Math.floor(Math.random() * 2);
      gf = ga + 1 + Math.floor(Math.random() * 2);
    } else if (r < pWin + 0.25) {
      gf = ga = Math.floor(Math.random() * 3);
    } else {
      gf = Math.floor(Math.random() * 2);
      ga = gf + 1 + Math.floor(Math.random() * 2);
    }
    const me = this.table.find((x) => x.me);
    me.pts += gf > ga ? 3 : gf === ga ? 1 : 0;
    opp.pts += ga > gf ? 3 : gf === ga ? 1 : 0;
    // Diğer maçlar
    for (const x of rivals) {
      if (x === opp) continue;
      const q = Math.random() + (x.str - 55) / 100;
      x.pts += q > 0.62 ? 3 : q > 0.36 ? 1 : 0;
    }
    if (this.involved) this.fans = Math.max(0, Math.min(100, this.fans + (gf > ga ? 2 : gf < ga ? -1 : 0)));
    this.played++;
    const res = { day: this.game.day.day, opp: opp.name, gf, ga };
    this.results.unshift(res);
    this.results.length = Math.min(this.results.length, 5);
    if (this.involved) this.game.hud.toast(`⚽ ${t('Kasaba Spor')} ${gf}–${ga} ${opp.name}`);
    return res;
  }

  endSeason() {
    const g = this.game;
    const pos = this.position;
    this.history.unshift({ season: this.season, pos });
    this.history.length = Math.min(this.history.length, 6);
    const good = pos <= 3;
    const bad = pos >= CLUB.teams - 2;
    if (this.rank > 0 && g.politics?.started) {
      if (good) g.politics.temp += CLUB.influence.good;
      if (bad && this.role === 'president') g.politics.temp += CLUB.influence.bad;
    }
    if (this.role === 'president') this.fans = Math.max(0, Math.min(100, this.fans + (good ? 8 : bad ? -12 : 0)));
    if (pos === 1 && this.involved) {
      g.gainXp(300);
      g.party?.start?.(`🏆 ${t('Kasaba Spor şampiyon!')}`, t('Kupa marketin vitrininde'), 6);
    }
    // Sezon sonu: başkanlık seçimi (aday olduysan sonuç hemen)
    if (this.role === 'board') {
      if (this.candidate) {
        const won = this.runForPresident(0.1);
        g.hud.toast(won ? `🎉 ${t('Kulüp başkanı oldun!')}` : `😞 ${t('Kulüp başkanlığı seçimini kaybettin')}`);
      } else g.hud.toast(`⚽ ${t('Kulüpte mevcut başkan yeniden seçildi')}`);
      this.candidate = false;
    } else if (this.role === 'president' && bad) g.events.later.push({ id: 'club_noconfidence', day: g.day.day + 1 });
    this.season++;
    this.played = 0;
    this.table = null;
    // Rakipler güçlenir/zayıflar, takım biraz geriler (transfer gerekli)
    this.strength = Math.max(35, this.strength - 2);
    return { pos, season: this.season - 1 };
  }

  // ---- Harita ----

  buildGround() {
    const big = !!this.game.politics?.projects?.stadium;
    if (this.groundBuilt === big) return;
    this.groundBuilt = big;
    for (const c of [...this.root.children]) this.root.remove(c);
    if (big) return; // belediye stadyumu (politics.js) çiziliyor
    const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(14, 8.5), mat(0x4caf50));
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.y = 0.03;
    pitch.receiveShadow = true;
    this.root.add(pitch);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 8.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.04;
    this.root.add(line);
    for (const x of [-7, 7]) {
      const goal = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 2.6), mat(0xffffff));
      goal.position.set(x, 0.6, 0);
      this.root.add(goal);
    }
    // İki yanda basamaklı tribün
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4 + i * 0.4, 0.9), mat(i % 2 ? 0xc62828 : 0xfafafa));
        step.position.set(0, (0.4 + i * 0.4) / 2, side * (5.2 + i * 0.9));
        step.castShadow = true;
        step.receiveShadow = true;
        this.root.add(step);
      }
    }
  }

  spawnCrowd() {
    const models = CHARACTER_NAMES.filter((n) => n !== 'Barbarian');
    for (let i = 0; i < 12; i++) {
      const c = new Character(this.game, models[i % models.length], { look: i % 6 });
      const side = i % 2 ? 1 : -1;
      const row = Math.floor(i / 6) % 3;
      c.position.set(CLUB.pos[0] - 5 + (i % 6) * 2, 0.4 + row * 0.4 + 0.4, CLUB.pos[1] + side * (5.2 + row * 0.9));
      c.root.position.copy(c.position);
      c.heading = side > 0 ? Math.PI : 0;
      c.root.rotation.y = c.heading;
      c.busyAnim = true;
      c.play(i % 3 ? 'Cheer' : 'Idle');
      this.game.scene.add(c.root);
      this.crowd.push(c);
    }
  }

  removeCrowd() {
    for (const c of this.crowd) this.game.scene.remove(c.root);
    this.crowd = [];
  }

  // ---- Panel ----

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  open() {
    this.unseen = 0;
    this.syncBadge();
    this.el.classList.remove('hidden');
    this.render();
  }

  close() {
    this.el.classList.add('hidden');
  }

  syncBadge() {
    this.btn.classList.toggle('alert', this.unseen > 0);
  }

  render() {
    const g = this.game;
    const m = g.money;
    this.ensureTable();
    const roleText = { fan: t('Taraftar'), board: t('Yönetim kurulu üyesi'), president: t('Kulüp başkanı') }[this.role];
    const parts = [];
    parts.push(`<div class="stats">
      <div><span>🎖️ ${t('Görevin')}</span><b>${roleText}</b></div>
      <div><span>📣 ${t('Taraftar sevgisi')}</span><b>${t('%{n}', { n: Math.round(this.fans) })}</b></div>
      <div><span>💪 ${t('Takım gücü')}</span><b>${this.strength}</b></div>
      <div><span>🏆 ${t('Sezon {n}', { n: this.season })}</span><b>${t('{pos}. sıra · {n}/{max} maç', { pos: this.position, n: this.played, max: CLUB.season })}</b></div>
    </div>`);
    // Gündem (holding yoksa kulüp kartları burada)
    const agenda = g.events.agendaHtml('club');
    if (agenda) parts.push(`<h4>🗂️ ${t('Kulüp gündemi')}</h4>${agenda}`);
    parts.push(`<p class="note">${this.isMatchDay ? `🏟️ ${t('Bugün maç günü!')}` : t('Maçlar {n} günde bir oynanır.', { n: CLUB.matchEvery })}${this.results.length ? ` · ${t('Son maçlar')}: ${this.results.slice(0, 3).map((r) => `${r.gf}–${r.ga} ${r.opp}`).join(' · ')}` : ''}</p>`);
    parts.push(`<div class="biz-row"><span>👕 ${t('Forma sponsorluğu')}</span><b>${this.sponsor ? t('var') : t('+%{n} müşteri', { n: Math.round((CLUB.sponsor.customers - 1) * 100) })}</b><button data-sponsor>${this.sponsor ? t('Bitir') : t('Başla ${n}/gün', { n: formatMoney(this.sponsorCost()) })}</button></div>
      <p class="note">${t('Sponsor ya da yönetimdeysen maç günleri markete {n} fazla müşteri gelir.', { n: t('%{n}', { n: Math.round((CLUB.matchCustomers - 1) * 100) }) })}</p>
      <div class="bank-group"><span>🤝 ${t('Bağış')}</span>${CLUB.donations.map((n) => `<button data-donate="${n}" ${m < n ? 'disabled' : ''}>$${formatMoney(n)}</button>`).join('')}</div>`);
    if (this.role === 'fan') {
      const pct = Math.min(100, Math.round((this.donated / CLUB.boardAt) * 100));
      parts.push(`<p class="note">${t('Toplam ${n} bağışta yönetim kuruluna davet edilirsin (siyasette kalıcı nüfuz).', { n: formatMoney(CLUB.boardAt) })} ${t('Yönetime girince başkanlığa aday olabilirsin (seçim {n} gün sonra).', { n: this.daysToElection })}</p><div class="progress"><i style="width:${pct}%"></i></div>`);
    } else if (this.role === 'board') {
      const d = this.daysToElection;
      const when = d === 0 ? t('bugün') : t('{n} gün sonra', { n: d });
      parts.push(`<div class="biz-row"><span>🗳️ ${t('Başkanlık seçimi')}</span><b>${when}</b>${this.candidate
        ? `<small>${t('Adaysın · kazanma şansı {n}', { n: t('%{n}', { n: Math.round(this.winChance * 100) }) })}</small>`
        : `<button data-candidate ${m < CLUB.campaign ? 'disabled' : ''}>${t('Aday ol ${n}', { n: formatMoney(CLUB.campaign) })}</button>`}</div>
        <p class="note">${this.candidate ? t('Taraftar sevgini artırdıkça şansın yükselir (bağış, sponsorluk, galibiyet).') : t('Aday olursan kazanma şansın şu an {n}. Taraftar sevgisi yükseldikçe artar.', { n: t('%{n}', { n: Math.round(this.winChance * 100) }) })}</p>`);
    } else {
      const c = this.transferCost();
      parts.push(`<p class="note">${t('<b>Başkanlık</b> · iyi sezon siyasette artı, kötü sezon eksi yazar.')}</p>
        <div class="biz-row"><span>✍️ ${t('Yıldız transfer')}</span><b>${t('güç +{n}', { n: CLUB.transfer.strength })}</b><button data-transfer ${m < c || this.strength >= CLUB.transfer.max ? 'disabled' : ''}>$${formatMoney(c)}</button></div>
        <div class="biz-row"><span>📋 ${t('Teknik direktörü değiştir')}</span><b>${t('riskli')}</b><button data-coach ${m < CLUB.coach.cost ? 'disabled' : ''}>$${formatMoney(CLUB.coach.cost)}</button></div>`);
    }
    const sorted = [...this.table].sort((a, b) => b.pts - a.pts || (a.me ? -1 : 1));
    parts.push(`<div class="ceo-table"><table><thead><tr><th>#</th><th>${t('Takım')}</th><th>${t('Puan')}</th></tr></thead><tbody>${sorted.map((x, i) => `<tr class="${x.me ? 'me' : ''}"><td>${i + 1}</td><td>${x.me ? '⚽ ' : ''}${x.name}</td><td>${x.pts}</td></tr>`).join('')}</tbody></table></div>`);
    if (this.history.length) parts.push(`<p class="note">${t('Geçmiş sezonlar')}: ${this.history.map((h) => t('{s}. sezon {pos}.', { s: h.season, pos: h.pos })).join(' · ')}</p>`);
    this.body.innerHTML = parts.join('');
  }

  onClick(e) {
    if (e.target.closest('[data-close]')) return this.close();
    if (this.game.events.handleAgendaClick(e)) return this.render();
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const d = btn.dataset;
    if (d.sponsor !== undefined) this.toggleSponsor();
    if (d.donate) this.donate(Number(d.donate));
    if (d.transfer !== undefined) this.transfer();
    if (d.coach !== undefined) this.changeCoach();
    if (d.candidate !== undefined) this.declareCandidacy();
    this.render();
  }

  serialize() {
    const { sponsor, donated, role, fans, strength, season, played, table, results, history, candidate } = this;
    return { sponsor, donated, role, fans, strength, season, played, table, results, history, candidate };
  }

  restore(d) {
    if (!d) return;
    Object.assign(this, d);
    this.results ??= [];
    this.history ??= [];
  }
}
