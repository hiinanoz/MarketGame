import * as THREE from 'three';

// Büyük kutlama (müşteri kilometre taşları): birkaç saniye herkes durup sevinir,
// ışıklar disko moduna geçer, ekrana konfeti yağar, kısa bir fanfar çalar.
// Bu sırada oyun saati ilerlemez (game.update kutlamayı günceller, simülasyonu değil).

const COLORS = [0xff3b6b, 0x3bc8ff, 0xffe03b, 0x7cff5b, 0xb36bff, 0xff8a3b];

export class Celebration {
  constructor(game) {
    this.game = game;
    this.t = 0;
    this.active = false;
    this.lights = [];
    this.el = null;
  }

  /** Kutlamayı başlat. */
  start(title, sub = '', seconds = 8) {
    const g = this.game;
    if (this.active) this.stop();
    this.active = true;
    this.t = 0;
    this.len = seconds;
    // Disko ışıkları: oyuncunun çevresinde dönen renkli noktasal ışıklar
    const p = g.player.position;
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(COLORS[i], 60, 26, 1.6);
      l.position.set(p.x, 6, p.z);
      g.scene.add(l);
      this.lights.push(l);
    }
    // Disko topu (parlak yansıtıcı küre)
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.7, 1),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1, roughness: 0.15, flatShading: true, emissive: 0x333333 }),
    );
    ball.position.set(p.x, 7.5, p.z - 2);
    g.scene.add(ball);
    this.ball = ball;
    this.sunI = g.sun.intensity;
    this.hemiI = g.hemi.intensity;
    // Herkes sevinsin
    for (const c of this.dancers()) {
      c.partyWas = c.busyAnim;
      c.busyAnim = true;
      c.velocity.set(0, 0, 0);
      c.play('Cheer');
    }
    // Ekran: başlık + konfeti (dokunmayı engellemez)
    this.el ??= document.getElementById('party');
    this.el.innerHTML = `<div class="party-banner"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const colors = ['#ffd23f', '#3fae49', '#ff6b6b', '#4dabf7', '#f783ac', '#b36bff', '#ffffff'];
    for (let i = 0; i < 120; i++) {
      const c = document.createElement('i');
      c.style.left = `${Math.random() * 100}%`;
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = `${Math.random() * (seconds - 2)}s`;
      c.style.animationDuration = `${2 + Math.random() * 2}s`;
      c.style.setProperty('--dx', `${(Math.random() - 0.5) * 200}px`);
      c.style.setProperty('--rot', `${Math.random() * 900 - 450}deg`);
      this.el.appendChild(c);
    }
    this.el.classList.remove('hidden');
    g.audio.play('levelup', 1.3);
    this.beatT = 0;
    g.platform?.haptic?.('HEAVY');
  }

  dancers() {
    const g = this.game;
    return [g.player, ...g.workers, ...g.customers].filter((c) => c?.root?.visible !== false);
  }

  update(dt) {
    if (!this.active) return false;
    const g = this.game;
    this.t += dt;
    const p = g.player.position;
    // Gün ışığı kısılır, renkli ışıklar daire çizer ve renk değiştirir
    const dim = Math.min(1, this.t / 0.6, (this.len - this.t) / 0.6);
    g.sun.intensity = THREE.MathUtils.lerp(this.sunI, this.sunI * 0.15, dim);
    g.hemi.intensity = THREE.MathUtils.lerp(this.hemiI, this.hemiI * 0.3, dim);
    this.lights.forEach((l, i) => {
      const a = this.t * 2.2 + (i * Math.PI) / 2;
      l.position.set(p.x + Math.cos(a) * 7, 5 + Math.sin(this.t * 3 + i) * 1.5, p.z + Math.sin(a) * 7);
      l.color.setHex(COLORS[(i + Math.floor(this.t * 3)) % COLORS.length]);
      l.intensity = 60 * dim;
    });
    this.ball.rotation.y += dt * 2;
    // Herkes sevinmeye devam (animasyon bitince yeniden)
    for (const c of this.dancers()) {
      c.velocity.set(0, 0, 0);
      c.busyAnim = true;
      const a = c.actions?.Cheer;
      if (a && (!a.isRunning() || c.current !== a)) c.play('Cheer', 0.1);
      c.root.rotation.y += Math.sin(this.t * 6 + c.position.x) * dt * 0.8;
      c.mixer.update(dt);
    }
    // Davul ritmi
    this.beatT -= dt;
    if (this.beatT <= 0) {
      this.beatT = 0.45;
      g.audio.play('beat', 0.7);
    }
    if (this.t >= this.len) this.stop();
    return true;
  }

  stop() {
    const g = this.game;
    this.active = false;
    for (const l of this.lights) g.scene.remove(l);
    this.lights = [];
    if (this.ball) {
      g.scene.remove(this.ball);
      this.ball.geometry.dispose();
      this.ball = null;
    }
    g.sun.intensity = this.sunI;
    g.hemi.intensity = this.hemiI;
    for (const c of this.dancers()) {
      c.busyAnim = c.partyWas ?? false;
      c.partyWas = undefined;
    }
    if (this.el) {
      this.el.classList.add('hidden');
      this.el.innerHTML = '';
    }
    g.day.applyLighting();
  }
}

/** Küçük ekran konfetisi (görev tamamlandı gibi küçük başarılar). */
export function confettiBurst(n = 40) {
  const box = document.createElement('div');
  box.className = 'confetti burst';
  const colors = ['#ffd23f', '#3fae49', '#ff6b6b', '#4dabf7', '#f783ac'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = `${30 + Math.random() * 40}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = `${1.2 + Math.random()}s`;
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
    c.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}
