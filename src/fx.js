import * as THREE from 'three';

// ---- Uçuş animasyonları ---------------------------------------------------
// Bir nesneyi bulunduğu yerden, hedef ebeveynin içindeki bir konuma kavisli şekilde uçurur.

const flights = [];
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();

export class Fx {
  constructor(scene) {
    this.scene = scene;
    this.floaters = [];
  }

  /**
   * @param {THREE.Object3D} obj        uçacak nesne
   * @param {THREE.Object3D} parent     varışta eklenecek ebeveyn (null → uçuş bitince silinir)
   * @param {THREE.Vector3|Function} local  ebeveyn içindeki hedef konum (veya her karede hesaplayan fonksiyon)
   */
  fly(obj, parent, local, { duration = 0.28, arc = 1.4, onDone, scaleTo } = {}) {
    obj.updateWorldMatrix(true, false);
    obj.getWorldPosition(_a);
    obj.getWorldQuaternion(_qa);
    const startScale = obj.scale.clone();
    // Dünya koordinatlarında uçur
    this.scene.attach(obj);
    obj.position.copy(_a);
    flights.push({
      obj, parent, local,
      from: _a.clone(),
      fromQ: _qa.clone(),
      startScale,
      endScale: scaleTo ? scaleTo.clone() : startScale.clone(),
      t: 0, duration, arc, onDone,
    });
  }

  update(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt / f.duration;
      const t = Math.min(f.t, 1);
      const target = typeof f.local === 'function' ? f.local() : f.local;
      if (f.parent) {
        f.parent.updateWorldMatrix(true, false);
        _b.copy(target).applyMatrix4(f.parent.matrixWorld);
        f.parent.getWorldQuaternion(_q);
      } else {
        _b.copy(target);
        _q.identity();
      }
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      f.obj.position.lerpVectors(f.from, _b, e);
      f.obj.position.y += Math.sin(Math.PI * t) * f.arc;
      f.obj.quaternion.slerpQuaternions(f.fromQ, _q, e);
      f.obj.scale.lerpVectors(f.startScale, f.endScale, e);
      if (t >= 1) {
        flights.splice(i, 1);
        if (f.parent) {
          f.parent.add(f.obj);
          f.obj.position.copy(target);
          f.obj.quaternion.identity();
        } else {
          this.scene.remove(f.obj);
        }
        f.onDone?.(f.obj);
      }
    }

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const fl = this.floaters[i];
      fl.t += dt;
      fl.sprite.position.y += dt * 1.6;
      fl.sprite.material.opacity = Math.min(1, 2.5 * (1.2 - fl.t));
      if (fl.t > 1.2) {
        this.scene.remove(fl.sprite);
        fl.sprite.material.map.dispose();
        fl.sprite.material.dispose();
        this.floaters.splice(i, 1);
      }
    }
  }

  /** Bir noktanın üstünde yükselip kaybolan yazı (+Đ12 gibi). */
  floatText(pos, text, color = '#2fbf3a') {
    const tex = textTexture(text, { color, size: 64, stroke: '#ffffff' });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 10;
    const aspect = tex.image.width / tex.image.height;
    sprite.scale.set(0.9 * aspect, 0.9, 1);
    sprite.position.copy(pos);
    sprite.position.y += 2.8;
    this.scene.add(sprite);
    this.floaters.push({ sprite, t: 0 });
  }
}

// ---- Kanvas dokuları -------------------------------------------------------

export function textTexture(text, { color = '#222', size = 48, stroke = null, font = 'bold' } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const fontStr = `${font} ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.font = fontStr;
  const w = Math.ceil(ctx.measureText(text).width) + size * 0.5;
  c.width = w;
  c.height = Math.ceil(size * 1.35);
  ctx.font = fontStr;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, w / 2, c.height / 2);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Konuşma balonu içinde emoji (müşterinin istediği ürün). */
export function bubbleTexture(emoji, { count = 0, color = '#ffffff' } = {}) {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(8, 8, 144, 120, 30);
  ctx.moveTo(64, 126);
  ctx.lineTo(80, 152);
  ctx.lineTo(96, 126);
  ctx.fill();
  ctx.stroke();
  ctx.font = '76px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, count > 1 ? 66 : 80, 72);
  if (count > 1) {
    ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#333';
    ctx.fillText(`×${count}`, 118, 98);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- Para destesi modeli ----------------------------------------------------

let billGeo, bandGeo, billMat, bandMat;
export function makeBill() {
  if (!billGeo) {
    billGeo = new THREE.BoxGeometry(0.62, 0.1, 0.34);
    bandGeo = new THREE.BoxGeometry(0.14, 0.105, 0.35);
    billMat = new THREE.MeshStandardMaterial({ color: 0x4cc552, roughness: 0.7 });
    bandMat = new THREE.MeshStandardMaterial({ color: 0xd8f5d0, roughness: 0.7 });
  }
  const g = new THREE.Group();
  const m = new THREE.Mesh(billGeo, billMat);
  m.castShadow = true;
  g.add(m);
  const band = new THREE.Mesh(bandGeo, bandMat);
  g.add(band);
  return g;
}
