// Ekranın herhangi bir yerine dokununca beliren "yüzen" joystick + klavye (WASD / ok tuşları).
// Çıktı: move = { x, z } (uzunluk 0..1). Ekranda yukarı = dünyada -z.

const MAX_RADIUS = 55;

export class Input {
  constructor(el) {
    this.move = { x: 0, z: 0 };
    this.keys = new Set();
    this.pointerId = null;
    this.origin = { x: 0, y: 0 };
    this.stick = { x: 0, y: 0 };
    this.enabled = true;

    this.base = document.getElementById('joystick');
    this.knob = document.getElementById('joystick-knob');

    el.addEventListener('pointerdown', (e) => this.onDown(e));
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => { if (e.target?.tagName !== 'INPUT') this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.release();
    });
  }

  onDown(e) {
    if (!this.enabled || this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.origin = { x: e.clientX, y: e.clientY };
    this.stick = { x: 0, y: 0 };
    this.base.style.left = `${e.clientX}px`;
    this.base.style.top = `${e.clientY}px`;
    this.base.classList.remove('hidden');
    this.knob.style.transform = 'translate(0px, 0px)';
  }

  onMove(e) {
    if (e.pointerId !== this.pointerId) return;
    let dx = e.clientX - this.origin.x;
    let dy = e.clientY - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len > MAX_RADIUS) {
      dx *= MAX_RADIUS / len;
      dy *= MAX_RADIUS / len;
    }
    this.stick = { x: dx / MAX_RADIUS, y: dy / MAX_RADIUS };
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  onUp(e) {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  }

  release() {
    this.pointerId = null;
    this.stick = { x: 0, y: 0 };
    this.base.classList.add('hidden');
  }

  update() {
    let x = this.stick.x;
    let z = this.stick.y;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) z -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) z += 1;
    let len = Math.hypot(x, z);
    if (len < 0.12) {
      x = 0;
      z = 0;
      len = 0;
    } else if (len > 1) {
      x /= len;
      z /= len;
    }
    this.move.x = x;
    this.move.z = z;
  }
}
