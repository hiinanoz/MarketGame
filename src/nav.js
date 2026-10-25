// Basit ızgara tabanlı yol bulma (A*) + engellere çarpmayı önleyen çarpışma kutuları.
// Müşteriler ve işçiler bunu kullanır; oyuncu sadece çarpışma kutularıyla sınırlanır.

const CELL = 0.5;

export class Nav {
  constructor({ minX, maxX, minZ, maxZ }) {
    this.minX = minX;
    this.minZ = minZ;
    this.w = Math.ceil((maxX - minX) / CELL);
    this.h = Math.ceil((maxZ - minZ) / CELL);
    this.blocked = new Uint8Array(this.w * this.h);
    this.boxes = new Map(); // id → {minX,maxX,minZ,maxZ}
    this.agentRadius = 0.45;
  }

  /** Engel ekle/güncelle. Kutu: dünya koordinatlarında eksen hizalı dikdörtgen. */
  setBox(id, box) {
    if (box) this.boxes.set(id, box);
    else this.boxes.delete(id);
    this.rebuild();
  }

  rebuild() {
    this.blocked.fill(0);
    const r = this.agentRadius;
    for (const b of this.boxes.values()) {
      const x0 = Math.max(0, Math.floor((b.minX - r - this.minX) / CELL));
      const x1 = Math.min(this.w - 1, Math.floor((b.maxX + r - this.minX) / CELL));
      const z0 = Math.max(0, Math.floor((b.minZ - r - this.minZ) / CELL));
      const z1 = Math.min(this.h - 1, Math.floor((b.maxZ + r - this.minZ) / CELL));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.blocked[z * this.w + x] = 1;
    }
  }

  cellOf(x, z) {
    return [
      Math.min(this.w - 1, Math.max(0, Math.floor((x - this.minX) / CELL))),
      Math.min(this.h - 1, Math.max(0, Math.floor((z - this.minZ) / CELL))),
    ];
  }

  center(cx, cz) {
    return [this.minX + (cx + 0.5) * CELL, this.minZ + (cz + 0.5) * CELL];
  }

  isFree(cx, cz) {
    return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h && !this.blocked[cz * this.w + cx];
  }

  nearestFree(cx, cz) {
    if (this.isFree(cx, cz)) return [cx, cz];
    for (let r = 1; r < 12; r++) {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (this.isFree(cx + dx, cz + dz)) return [cx + dx, cz + dz];
        }
    }
    return [cx, cz];
  }

  /** [x,z] noktaları listesi döner (başlangıç hariç, hedef dahil). */
  findPath(sx, sz, tx, tz) {
    let [ax, az] = this.nearestFree(...this.cellOf(sx, sz));
    const [bx, bz] = this.nearestFree(...this.cellOf(tx, tz));
    const W = this.w;
    const start = az * W + ax;
    const goal = bz * W + bx;
    const g = new Float32Array(this.w * this.h).fill(Infinity);
    const came = new Int32Array(this.w * this.h).fill(-1);
    const closed = new Uint8Array(this.w * this.h);
    const open = new MinHeap();
    g[start] = 0;
    open.push(start, 0);
    const hx = (i) => {
      const dx = Math.abs((i % W) - bx);
      const dz = Math.abs(((i / W) | 0) - bz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    let found = false;
    let iterations = 0;
    while (open.size && iterations++ < 20000) {
      const cur = open.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W;
      const cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (!this.isFree(nx, nz)) continue;
          if (dx && dz && (!this.isFree(cx + dx, cz) || !this.isFree(cx, cz + dz))) continue;
          const ni = nz * W + nx;
          const ng = g[cur] + (dx && dz ? 1.414 : 1);
          if (ng < g[ni]) {
            g[ni] = ng;
            came[ni] = cur;
            open.push(ni, ng + hx(ni));
          }
        }
    }
    if (!found) return [[tx, tz]];
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    // Görüş hattı ile gereksiz ara noktaları at (yol düzleştirme)
    const pts = [];
    let anchor = cells[0];
    for (let k = 1; k < cells.length; k++) {
      if (!this.lineFree(anchor, cells[k])) {
        anchor = cells[k - 1];
        pts.push(this.center(anchor % W, (anchor / W) | 0));
      }
    }
    pts.push([tx, tz]);
    return pts;
  }

  lineFree(a, b) {
    const W = this.w;
    let x0 = a % W, z0 = (a / W) | 0;
    const x1 = b % W, z1 = (b / W) | 0;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0)) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      const x = Math.round(x0 + (x1 - x0) * t);
      const z = Math.round(z0 + (z1 - z0) * t);
      if (!this.isFree(x, z)) return false;
    }
    return true;
  }

  /** Bir dairenin (oyuncu) kutuların içine girmesini engeller; düzeltilmiş konumu yazar. */
  collide(pos, radius) {
    for (const b of this.boxes.values()) {
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // Merkez kutunun içinde: en yakın kenardan dışarı it
        const pushes = [
          [b.minX - radius - pos.x, 0], [b.maxX + radius - pos.x, 0],
          [0, b.minZ - radius - pos.z], [0, b.maxZ + radius - pos.z],
        ];
        pushes.sort((p, q) => Math.abs(p[0] + p[1]) - Math.abs(q[0] + q[1]));
        pos.x += pushes[0][0];
        pos.z += pushes[0][1];
      }
    }
  }
}

class MinHeap {
  constructor() { this.items = []; this.prios = []; }
  get size() { return this.items.length; }
  push(item, prio) {
    const it = this.items, pr = this.prios;
    let i = it.length;
    it.push(item); pr.push(prio);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (pr[p] <= prio) break;
      it[i] = it[p]; pr[i] = pr[p];
      i = p;
    }
    it[i] = item; pr[i] = prio;
  }
  pop() {
    const it = this.items, pr = this.prios;
    const top = it[0];
    const lastI = it.pop(), lastP = pr.pop();
    if (it.length) {
      let i = 0;
      const n = it.length;
      while (true) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && pr[c + 1] < pr[c]) c++;
        if (pr[c] >= lastP) break;
        it[i] = it[c]; pr[i] = pr[c];
        i = c;
      }
      it[i] = lastI; pr[i] = lastP;
    }
    return top;
  }
}
