import * as THREE from 'three';

export class PhysicsEngine {
  constructor(cols, rows, width, height) {
    this.COLS = cols;
    this.ROWS = rows;
    this.CLOTH_W = width;
    this.CLOTH_H = height;
    this.GRAVITY = -10.0;
    this.DAMPING = 0.97;
    this.ITERS = 22;
    this.STIFF_STRUCT = 1.0;
    this.STIFF_SHEAR = 0.75;
    this.STIFF_BEND = 0.35;
    this.TOP_Y = height / 2;
    this.GROUND_Y = -6.5;
    this.WIND_FORCE = -0.12;
    this.THICKNESS = 0.30;
    this.CELL_SZ = 0.15;

    this.N = cols * rows;
    this.px = new Float32Array(this.N);
    this.py = new Float32Array(this.N);
    this.pz = new Float32Array(this.N);
    this.ox = new Float32Array(this.N);
    this.oy = new Float32Array(this.N);
    this.oz = new Float32Array(this.N);
    this.pin = new Uint8Array(this.N);
    // G2: 撕裂边缘粒子标记
    this.torn = new Uint8Array(this.N);

    this.cA = [];
    this.cB = [];
    this.cR = [];
    this.cS = [];
    this.cutEdges = new Set();

    this.initParticles();
    this.initConstraints();
  }

  idx(i, j) {
    return j * this.COLS + i;
  }

  initParticles() {
    const sx = this.CLOTH_W / (this.COLS - 1);
    const sy = this.CLOTH_H / (this.ROWS - 1);
    for (let j = 0; j < this.ROWS; j++) {
      for (let i = 0; i < this.COLS; i++) {
        const id = this.idx(i, j);
        this.px[id] = -this.CLOTH_W / 2 + i * sx;
        this.py[id] = this.TOP_Y - j * sy;
        this.pz[id] = 0;
        this.ox[id] = this.px[id];
        this.oy[id] = this.py[id];
        this.oz[id] = this.pz[id];
        if (j === 0) this.pin[id] = 1;
      }
    }
    for (let j2 = this.ROWS - 8; j2 < this.ROWS; j2++) {
      const t = (j2 - (this.ROWS - 8)) / 8;
      for (let i2 = 0; i2 < this.COLS; i2++) {
        const id2 = this.idx(i2, j2);
        this.pz[id2] += t * t * 0.25;
        this.oz[id2] = this.pz[id2];
      }
    }
  }

  addConstraint(a, b, stiff) {
    const dx = this.px[a] - this.px[b];
    const dy = this.py[a] - this.py[b];
    const dz = this.pz[a] - this.pz[b];
    this.cA.push(a);
    this.cB.push(b);
    this.cR.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
    this.cS.push(stiff);
  }

  initConstraints() {
    for (let j = 0; j < this.ROWS; j++) {
      for (let i = 0; i < this.COLS; i++) {
        const id = this.idx(i, j);
        if (i < this.COLS - 1) this.addConstraint(id, this.idx(i + 1, j), this.STIFF_STRUCT);
        if (j < this.ROWS - 1) this.addConstraint(id, this.idx(i, j + 1), this.STIFF_STRUCT);
        if (i < this.COLS - 1 && j < this.ROWS - 1) {
          this.addConstraint(id, this.idx(i + 1, j + 1), this.STIFF_SHEAR);
          this.addConstraint(this.idx(i + 1, j), this.idx(i, j + 1), this.STIFF_SHEAR);
        }
        if (i < this.COLS - 2) this.addConstraint(id, this.idx(i + 2, j), this.STIFF_BEND);
        if (j < this.ROWS - 2) this.addConstraint(id, this.idx(i, j + 2), this.STIFF_BEND);
      }
    }
  }

  simulate(dt) {
    const dt2 = dt * dt;
    const time = performance.now() * 0.001;
    const windX = this.WIND_FORCE + Math.sin(time * 0.4) * 0.06 + Math.sin(time * 1.8) * 0.03;
    const windZ = Math.cos(time * 0.6) * 0.04;

    for (let i = 0; i < this.N; i++) {
      if (this.pin[i]) continue;
      const vx = (this.px[i] - this.ox[i]) * this.DAMPING;
      const vy = (this.py[i] - this.oy[i]) * this.DAMPING;
      const vz = (this.pz[i] - this.oz[i]) * this.DAMPING;
      this.ox[i] = this.px[i];
      this.oy[i] = this.py[i];
      this.oz[i] = this.pz[i];
      this.px[i] += vx + windX * dt2;
      this.py[i] += vy + this.GRAVITY * dt2;
      this.pz[i] += vz + windZ * dt2;
    }

    for (let iter = 0; iter < this.ITERS; iter++) {
      for (let c = 0; c < this.cA.length; c++) {
        const a = this.cA[c];
        const b = this.cB[c];
        const dx = this.px[b] - this.px[a];
        const dy = this.py[b] - this.py[a];
        const dz = this.pz[b] - this.pz[a];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 1e-8) continue;
        const rest = this.cR[c];
        // 硬性拉伸钳制：约束长度不得超过静止长度的 1.5 倍
        const maxStretch = rest * 1.5;
        const targetDist = dist > maxStretch ? maxStretch : rest;
        const stiff = this.cS[c];
        const diff = (1 - targetDist / dist) * stiff * 0.5;
        const cx = dx * diff;
        const cy = dy * diff;
        const cz = dz * diff;
        if (!this.pin[a]) { this.px[a] += cx; this.py[a] += cy; this.pz[a] += cz; }
        if (!this.pin[b]) { this.px[b] -= cx; this.py[b] -= cy; this.pz[b] -= cz; }
      }
    }

    for (let i = 0; i < this.N; i++) {
      if (this.pin[i]) continue;
      if (this.pz[i] < -1.2) this.pz[i] = -1.2;
      if (this.py[i] < this.GROUND_Y) {
        this.py[i] = this.GROUND_Y;
        this.oy[i] = this.py[i] + (this.py[i] - this.oy[i]) * 0.3;
        this.px[i] = this.ox[i] + (this.px[i] - this.ox[i]) * 0.85;
        this.pz[i] = this.oz[i] + (this.pz[i] - this.oz[i]) * 0.85;
      }
      // G2: 撕裂边缘持续微颤
      if (this.torn[i]) {
        this.px[i] += (Math.random() - 0.5) * 0.003;
        this.py[i] += (Math.random() - 0.5) * 0.003;
        this.pz[i] += (Math.random() - 0.5) * 0.003;
      }
    }
  }

  selfCollision() {
    // 数值化空间哈希：将三轴格子坐标打包为唯一整数 key，避免字符串拼接开销
    // cx/cy/cz 各占 11 位（范围 [-1024,1023]），足以覆盖布料可达范围
    const grid = new Map();
    const CS = this.CELL_SZ;
    const packKey = (cx, cy, cz) => (cx + 1024) * 4194304 + (cy + 1024) * 2048 + (cz + 1024);
    for (let i = 0; i < this.N; i++) {
      const cx = Math.floor(this.px[i] / CS);
      const cy = Math.floor(this.py[i] / CS);
      const cz = Math.floor(this.pz[i] / CS);
      const key = packKey(cx, cy, cz);
      let cell = grid.get(key);
      if (!cell) { cell = []; grid.set(key, cell); }
      cell.push(i);
    }

    for (let i = 0; i < this.N; i++) {
      const cx = Math.floor(this.px[i] / CS);
      const cy = Math.floor(this.py[i] / CS);
      const cz = Math.floor(this.pz[i] / CS);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const cell = grid.get(packKey(cx + dx, cy + dy, cz + dz));
            if (!cell) continue;
            for (let k = 0; k < cell.length; k++) {
              const j = cell[k];
              if (j <= i) continue;
              const di = Math.abs((i % this.COLS) - (j % this.COLS));
              const dj = Math.abs(Math.floor(i / this.COLS) - Math.floor(j / this.COLS));
              if (di <= 2 && dj <= 2) continue;
              const ddx = this.px[j] - this.px[i];
              const ddy = this.py[j] - this.py[i];
              const ddz = this.pz[j] - this.pz[i];
              const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
              if (d2 < this.THICKNESS * this.THICKNESS && d2 > 1e-10) {
                const d = Math.sqrt(d2);
                const p = (this.THICKNESS - d) / d * 0.8;
                const mx = ddx * p;
                const my = ddy * p;
                const mz = ddz * p;
                if (!this.pin[i]) { this.px[i] -= mx; this.py[i] -= my; this.pz[i] -= mz; }
                if (!this.pin[j]) { this.px[j] += mx; this.py[j] += my; this.pz[j] += mz; }
              }
            }
          }
        }
      }
    }
  }

  setWind(value) {
    this.WIND_FORCE = value;
  }

  preSimulate(steps, dt) {
    for (let s = 0; s < steps; s++) {
      this.simulate(dt);
      this.selfCollision();
    }
  }
}