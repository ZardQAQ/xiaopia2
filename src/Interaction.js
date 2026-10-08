import * as THREE from 'three';

export class Interaction {
  constructor(renderer, camera, physics, clothMesh, texture, clothHeight, onProductClick) {
    this.renderer = renderer;
    this.camera = camera;
    this.physics = physics;
    this.clothMesh = clothMesh;
    this.texture = texture;
    this.clothHeight = clothHeight;
    this.onProductClick = onProductClick;
    this.onCut = null;

    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.isDragging = false;
    this.dragIdx = -1;
    this.dragPlane = new THREE.Plane();
    this.dragOffset = new THREE.Vector3();
    this.intersectPt = new THREE.Vector3();
    this.INFLUENCE_R = 4;
    this.isKeyADown = false;
    this.isCutting = false;
    this.cutStart = new THREE.Vector2();
    this.cutEnd = new THREE.Vector2();
    this.cutPath = [];

    this.touchStartDist = 0;
    this.touchStartPinchDist = 0;
    this.isPinching = false;

    this.clickStartPos = new THREE.Vector2();

    // 移动端切割模式（替代桌面 A 键）
    this.cutMode = false;

    // 中键平移视角
    this.isPanning = false;
    this.panStart = new THREE.Vector2();
    this.panCameraStart = new THREE.Vector3();
    this.panTargetStart = new THREE.Vector3();

    // 商品 hover tooltip
    this.hoverProduct = null;
    this.hoverTooltip = null;

    this.initCutOverlay();
    this.initHoverTooltip();
    this._bound = {};
    this.setupEventListeners();
  }

  initHoverTooltip() {
    this.hoverTooltip = document.createElement('div');
    this.hoverTooltip.className = 'cut-overlay-el';
    this.hoverTooltip.style.cssText = `
      position: fixed; z-index: 85; pointer-events: none;
      background: rgba(26,26,42,0.92); color: #F8F5EE;
      padding: 8px 14px; border-radius: 8px;
      font-family: 'Courier New', monospace; font-size: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; gap: 8px;
      opacity: 0; transform: translateY(4px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.1);
    `;
    this.hoverTooltip.innerHTML = `
      <span id="hoverTooltipIcon" style="font-size: 16px;"></span>
      <span style="display: flex; flex-direction: column; gap: 2px;">
        <span id="hoverTooltipName" style="font-weight: 600;"></span>
        <span id="hoverTooltipHint" style="font-size: 10px; color: rgba(255,255,255,0.5);">点击查看详情</span>
      </span>
    `;
    document.body.appendChild(this.hoverTooltip);
  }

  showHoverTooltip(product, clientX, clientY) {
    if (!this.hoverTooltip) return;
    document.getElementById('hoverTooltipIcon').textContent = product.icon || '📦';
    document.getElementById('hoverTooltipName').textContent = product.name || product.id;
    this.hoverTooltip.style.left = (clientX + 14) + 'px';
    this.hoverTooltip.style.top = (clientY + 14) + 'px';
    this.hoverTooltip.style.opacity = '1';
    this.hoverTooltip.style.transform = 'translateY(0)';
  }

  hideHoverTooltip() {
    if (!this.hoverTooltip) return;
    this.hoverTooltip.style.opacity = '0';
    this.hoverTooltip.style.transform = 'translateY(4px)';
  }

  initCutOverlay() {
    document.querySelectorAll('.cut-overlay-el').forEach(el => el.remove());
    // 切割轨迹画布
    this.cutCanvas = document.createElement('canvas');
    this.cutCanvas.className = 'cut-overlay-el';
    this.cutCanvas.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 80; display: none;
    `;
    this.cutCanvas.width = window.innerWidth;
    this.cutCanvas.height = window.innerHeight;
    document.body.appendChild(this.cutCanvas);
    this.cutCtx = this.cutCanvas.getContext('2d');

    // 切割模式状态指示
    this.cutModeIndicator = document.createElement('div');
    this.cutModeIndicator.className = 'cut-overlay-el';
    this.cutModeIndicator.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(26,26,42,0.9); color: #F8F5EE;
      padding: 8px 24px; border-radius: 20px; font-size: 13px;
      font-family: 'Courier New', monospace; z-index: 81; display: none;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      letter-spacing: 1px;
    `;
    this.cutModeIndicator.innerHTML = '✂ 切割模式 — 按住左键拖拽切割，松开A键退出';
    document.body.appendChild(this.cutModeIndicator);

    // K1: 切割纸屑粒子池
    this.cutShreds = [];
    this.shredAnimating = false;
  }

  showCutOverlay() {
    this.cutCanvas.style.display = 'block';
    this.cutModeIndicator.style.display = 'block';
  }

  hideCutOverlay() {
    this.cutCanvas.style.display = 'none';
    this.cutModeIndicator.style.display = 'none';
    this.clearCutTrail();
  }

  clearCutTrail() {
    this.cutCtx.clearRect(0, 0, this.cutCanvas.width, this.cutCanvas.height);
  }

  drawCutTrail() {
    const ctx = this.cutCtx;
    const w = this.cutCanvas.width;
    const h = this.cutCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.cutPath.length < 2) return;

    // K2: 动态脉冲发光
    const t = performance.now();
    const pulse = 8 + Math.sin(t * 0.01) * 4;
    ctx.shadowColor = 'rgba(231, 76, 60, 0.6)';
    ctx.shadowBlur = pulse;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // K2: 笔锋渐变 — 分段绘制，越靠近末端越粗
    const n = this.cutPath.length;
    for (let i = 1; i < n; i++) {
      const sx0 = (this.cutPath[i - 1].x + 1) * 0.5 * w;
      const sy0 = (1 - this.cutPath[i - 1].y) * 0.5 * h;
      const sx1 = (this.cutPath[i].x + 1) * 0.5 * w;
      const sy1 = (1 - this.cutPath[i].y) * 0.5 * h;
      const ratio = i / n; // 0→1，末端最粗
      ctx.strokeStyle = `rgba(231, 76, 60, ${0.6 + ratio * 0.35})`;
      ctx.lineWidth = 1.5 + ratio * 3;
      ctx.beginPath();
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx1, sy1);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // K2: 末端径向渐变光点
    const last = this.cutPath[n - 1];
    const lx = (last.x + 1) * 0.5 * w;
    const ly = (1 - last.y) * 0.5 * h;
    const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, 14);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    grad.addColorStop(0.4, 'rgba(231, 76, 60, 0.6)');
    grad.addColorStop(1, 'rgba(231, 76, 60, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(lx, ly, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // K1: 切割纸屑飞溅
  spawnCutShreds() {
    const w = this.cutCanvas.width;
    const h = this.cutCanvas.height;
    for (let i = 0; i < this.cutPath.length; i += 1) {
      const sx = (this.cutPath[i].x + 1) * 0.5 * w;
      const sy = (1 - this.cutPath[i].y) * 0.5 * h;
      const count = 6 + Math.floor(Math.random() * 4);
      for (let k = 0; k < count; k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        this.cutShreds.push({
          x: sx, y: sy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          life: 1.0,
          size: 2 + Math.random() * 3,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.3
        });
      }
    }
    if (!this.shredAnimating) this.animateCutShreds();
  }

  animateCutShreds() {
    this.shredAnimating = true;
    const w = this.cutCanvas.width;
    const h = this.cutCanvas.height;
    const ctx = this.cutCtx;

    const step = () => {
      ctx.clearRect(0, 0, w, h);

      for (let i = this.cutShreds.length - 1; i >= 0; i--) {
        const s = this.cutShreds[i];
        s.vy += 0.25; // 重力
        s.vx *= 0.98;
        s.x += s.vx;
        s.y += s.vy;
        s.rot += s.vrot;
        s.life -= 0.015;
        if (s.life <= 0 || s.y > h + 20) {
          this.cutShreds.splice(i, 1);
        }
      }

      for (let j = 0; j < this.cutShreds.length; j++) {
        const s = this.cutShreds[j];
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = j % 3 === 0 ? '#E8E3D6' : '#F8F5EE';
        ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size * 0.6);
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      if (this.cutShreds.length > 0) {
        this.cutCanvas.style.display = 'block';
        requestAnimationFrame(step);
      } else {
        this.shredAnimating = false;
        // 不在切割中则隐藏画布
        if (!this.isCutting && !this.cutMode && !this.isKeyADown) {
          this.cutCanvas.style.display = 'none';
        } else {
          ctx.clearRect(0, 0, w, h);
        }
      }
    };
    step();
  }

  setupEventListeners() {
    const cv = this.renderer.domElement;
    this._bound.onDown = this.onDown.bind(this);
    this._bound.onMove = this.onMove.bind(this);
    this._bound.onWheel = this.onWheel.bind(this);
    this._bound.onUp = this.onUp.bind(this);
    this._bound.onKeyDown = this.onKeyDown.bind(this);
    this._bound.onKeyUp = this.onKeyUp.bind(this);
    this._bound.onTouchStart = this.onTouchStart.bind(this);
    this._bound.onTouchMove = this.onTouchMove.bind(this);
    this._bound.onTouchEnd = this.onTouchEnd.bind(this);
    this._bound.onResize = () => {
      this.cutCanvas.width = window.innerWidth;
      this.cutCanvas.height = window.innerHeight;
    };

    cv.addEventListener('mousedown', this._bound.onDown);
    cv.addEventListener('mousemove', this._bound.onMove);
    cv.addEventListener('wheel', this._bound.onWheel, { passive: false });
    window.addEventListener('mouseup', this._bound.onUp);
    window.addEventListener('keydown', this._bound.onKeyDown);
    window.addEventListener('keyup', this._bound.onKeyUp);
    cv.addEventListener('touchstart', this._bound.onTouchStart, { passive: false });
    cv.addEventListener('touchmove', this._bound.onTouchMove, { passive: false });
    cv.addEventListener('touchend', this._bound.onTouchEnd);
    window.addEventListener('resize', this._bound.onResize);
  }

  getMouse(e) {
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  findClosestParticle() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    let minD = Infinity;
    let best = -1;
    const ray = this.raycaster.ray;
    const tmp = new THREE.Vector3();

    for (let i = 0; i < this.physics.N; i++) {
      if (this.physics.pin[i]) continue;
      tmp.set(this.physics.px[i], this.physics.py[i], this.physics.pz[i]);
      const d = ray.distanceToPoint(tmp);
      if (d < minD) {
        minD = d;
        best = i;
      }
    }

    return minD < 0.6 ? best : -1;
  }

  // 拖拽影响逻辑（鼠标/触控共用）
  applyDragInfluence(target) {
    const di = this.dragIdx % this.physics.COLS;
    const dj = Math.floor(this.dragIdx / this.physics.COLS);
    const origX = this.physics.px[this.dragIdx];
    const origY = this.physics.py[this.dragIdx];
    const origZ = this.physics.pz[this.dragIdx];

    this.physics.px[this.dragIdx] = target.x;
    this.physics.py[this.dragIdx] = target.y;
    this.physics.pz[this.dragIdx] = target.z;

    const ddx = target.x - origX;
    const ddy = target.y - origY;
    const ddz = target.z - origZ;

    for (let dj2 = Math.max(0, dj - this.INFLUENCE_R); dj2 <= Math.min(this.physics.ROWS - 1, dj + this.INFLUENCE_R); dj2++) {
      for (let di2 = Math.max(0, di - this.INFLUENCE_R); di2 <= Math.min(this.physics.COLS - 1, di + this.INFLUENCE_R); di2++) {
        if (di2 === di && dj2 === dj) continue;
        const id = this.physics.idx(di2, dj2);
        if (this.physics.pin[id]) continue;
        const dist = Math.sqrt((di2 - di) * (di2 - di) + (dj2 - dj) * (dj2 - dj));
        if (dist > this.INFLUENCE_R) continue;
        const inf = Math.exp(-dist * dist / 3.0) * 0.35;
        this.physics.px[id] += ddx * inf;
        this.physics.py[id] += ddy * inf;
        this.physics.pz[id] += ddz * inf;
      }
    }
  }

  // 移动端切割模式切换
  toggleCutMode() {
    this.cutMode = !this.cutMode;
    if (this.cutMode) {
      this.showCutOverlay();
      this.renderer.domElement.style.cursor = 'crosshair';
    } else {
      this.hideCutOverlay();
      this.isCutting = false;
      this.cutPath = [];
      this.renderer.domElement.style.cursor = 'default';
    }
    return this.cutMode;
  }

  isUIElement(target) {
    let el = target;
    while (el && el !== document.body) {
      if (el.id && (
        el.id === 'productCard' ||
        el.id === 'helpPanel' ||
        el.id === 'aboutOverlay' ||
        el.id === 'quizOverlay' ||
        el.id === 'kbOverlay' ||
        el.id === 'imageEditorPanel' ||
        el.id === 'consolePanel' ||
        el.id === 'pipelinePanel' ||
        el.id === 'tourOverlay'
      )) return true;
      if (el.className && typeof el.className === 'string' && (
        el.className.includes('app-toast')
      )) return true;
      el = el.parentElement;
    }
    return false;
  }

  onDown(e) {
    if (e.button === 1) {
      e.preventDefault();
      if (this.isUIElement(e.target)) return;
      this.isPanning = true;
      this.panStart.set(e.clientX, e.clientY);
      this.panCameraStart.copy(this.camera.position);
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      const dist = this.camera.position.length();
      this.panTargetStart.copy(this.camera.position).addScaledVector(dir, dist);
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;
    if (this.isUIElement(e.target)) return;
    this.getMouse(e);
    this.clickStartPos.set(this.mouse.x, this.mouse.y);

    if (this.isKeyADown) {
      this.isCutting = true;
      this.cutStart.set(this.mouse.x, this.mouse.y);
      this.cutEnd.set(this.mouse.x, this.mouse.y);
      this.cutPath = [{ x: this.mouse.x, y: this.mouse.y }];
      return;
    }

    const ci = this.findClosestParticle();
    if (ci < 0) return;
    this.isDragging = true;
    if (navigator.vibrate) navigator.vibrate(10);
    this.dragIdx = ci;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const ppos = new THREE.Vector3(
      this.physics.px[ci],
      this.physics.py[ci],
      this.physics.pz[ci]
    );
    const camDir = this.camera.getWorldDirection(new THREE.Vector3());
    this.dragPlane.setFromNormalAndCoplanarPoint(camDir, ppos);
    this.raycaster.ray.intersectPlane(this.dragPlane, this.intersectPt);
    this.dragOffset.copy(ppos).sub(this.intersectPt);
    this.renderer.domElement.style.cursor = 'grabbing';
  }

  onUp(e) {
    if (e && e.button === 1) {
      this.isPanning = false;
      this.renderer.domElement.style.cursor = 'default';
      return;
    }
    if (this.isCutting) {
      this.performCut();
      this.isCutting = false;
      this.cutPath = [];
      this.clearCutTrail();
      this.renderer.domElement.style.cursor = this.isKeyADown ? 'crosshair' : 'default';
      return;
    }

    if (!this.isDragging && e && !this.isUIElement(e.target)) {
      this.handleClick();
    }

    this.isDragging = false;
    this.dragIdx = -1;
    if (this.isKeyADown) {
      this.renderer.domElement.style.cursor = 'crosshair';
    } else {
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  handleClick() {
    const dx = this.mouse.x - this.clickStartPos.x;
    const dy = this.mouse.y - this.clickStartPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.02) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.clothMesh);

    if (intersects.length > 0) {
      const uv = intersects[0].uv;
      this.detectProductClick(uv.y);
    }
  }

  detectProductClick(uvY) {
    const product = this.texture.getProductByUV(uvY, this.clothHeight);
    if (product && this.onProductClick) {
      this.onProductClick(product.id);
    }
  }

  performCut() {
    if (this.cutPath.length < 2) return;

    // 1. 找到紧贴切口的粒子（铰链粒子），用于消除对角线连接
    const cutWidth = 0.015;
    const cutParticles = new Set();
    for (let i = 0; i < this.physics.N; i++) {
      if (this.physics.pin[i]) continue;
      const pos = this.screenPos(i);
      if (this.isPointNearPath(pos.x, pos.y, cutWidth)) {
        cutParticles.add(i);
      }
    }

    // 缓存所有粒子的屏幕坐标
    const screenCache = new Array(this.physics.N);
    for (let i = 0; i < this.physics.N; i++) {
      screenCache[i] = this.screenPos(i);
    }

    // 2. 删除所有跨越切口的约束（线段相交检测）
    let removed = 0;
    for (let c = this.physics.cA.length - 1; c >= 0; c--) {
      const a = this.physics.cA[c];
      const b = this.physics.cB[c];

      // 端点在切口上的约束直接删除
      if (cutParticles.has(a) || cutParticles.has(b)) {
        this.recordCutEdge(a, b);
        this.physics.cA.splice(c, 1);
        this.physics.cB.splice(c, 1);
        this.physics.cR.splice(c, 1);
        this.physics.cS.splice(c, 1);
        removed++;
        continue;
      }

      // 检测约束线段是否与切口路径相交
      const posA = screenCache[a];
      const posB = screenCache[b];
      let intersects = false;
      for (let i = 0; i < this.cutPath.length - 1; i++) {
        if (this.segmentsIntersect(
          posA.x, posA.y, posB.x, posB.y,
          this.cutPath[i].x, this.cutPath[i].y,
          this.cutPath[i + 1].x, this.cutPath[i + 1].y
        )) {
          intersects = true;
          break;
        }
      }

      if (intersects) {
        this.recordCutEdge(a, b);
        this.physics.cA.splice(c, 1);
        this.physics.cB.splice(c, 1);
        this.physics.cR.splice(c, 1);
        this.physics.cS.splice(c, 1);
        removed++;
      }
    }

    // 3. 解除铰链粒子的钉住状态，让它们自由脱落
    for (const i of cutParticles) {
      this.physics.pin[i] = 0;
      // G2: 切口毛糙撕裂增强 — 更强位移 + Z 轴翘曲 + torn 标记持续微颤
      this.physics.px[i] += (Math.random() - 0.5) * 0.08;
      this.physics.py[i] += (Math.random() - 0.5) * 0.08;
      this.physics.pz[i] += (Math.random() - 0.5) * 0.12;
      if (this.physics.torn) this.physics.torn[i] = 1;
    }

    // 4. 重建几何体索引缓冲区，移除跨越切口的三角形
    if (removed > 0) {
      this.rebuildGeometry();
      this.spawnCutShreds(); // K1: 纸屑飞溅
      if (navigator.vibrate) navigator.vibrate(30);
      if (this.onCut) {
        this.onCut();
      }
    }
  }

  recordCutEdge(a, b) {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    this.physics.cutEdges.add(key);
  }

  rebuildGeometry() {
    if (!this.clothMesh || !this.clothMesh.geometry) return;
    const geo = this.clothMesh.geometry;
    const idx = geo.index;
    if (!idx) return;

    const oldArr = idx.array;
    const newIndices = [];

    for (let i = 0; i < oldArr.length; i += 3) {
      const a = oldArr[i];
      const b = oldArr[i + 1];
      const c = oldArr[i + 2];

      const ab = a < b ? `${a}_${b}` : `${b}_${a}`;
      const bc = b < c ? `${b}_${c}` : `${c}_${b}`;
      const ac = a < c ? `${a}_${c}` : `${c}_${a}`;

      // 如果三角形的任何一条边被切断，则不渲染该三角形
      if (!this.physics.cutEdges.has(ab) && !this.physics.cutEdges.has(bc) && !this.physics.cutEdges.has(ac)) {
        newIndices.push(a, b, c);
      }
    }

    geo.setIndex(newIndices);
  }

  // 线段相交检测：AB 与 CD 是否相交
  segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const d1x = x2 - x1, d1y = y2 - y1;
    const d2x = x4 - x3, d2y = y4 - y3;
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-10) return false;
    const dx = x3 - x1, dy = y3 - y1;
    const t = (dx * d2y - dy * d2x) / denom;
    const s = (dx * d1y - dy * d1x) / denom;
    return t >= 0 && t <= 1 && s >= 0 && s <= 1;
  }

  isPointNearPath(px, py, threshold) {
    for (let i = 0; i < this.cutPath.length - 1; i++) {
      const x1 = this.cutPath[i].x;
      const y1 = this.cutPath[i].y;
      const x2 = this.cutPath[i + 1].x;
      const y2 = this.cutPath[i + 1].y;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy;

      if (len2 === 0) {
        const dist = Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        if (dist < threshold) return true;
        continue;
      }

      const t = ((px - x1) * dx + (py - y1) * dy) / len2;
      const clampedT = Math.max(0, Math.min(1, t));

      const nearX = x1 + clampedT * dx;
      const nearY = y1 + clampedT * dy;

      const dist = Math.sqrt((px - nearX) * (px - nearX) + (py - nearY) * (py - nearY));
      if (dist < threshold) return true;
    }
    return false;
  }

  onMove(e) {
    this.getMouse(e);

    if (this.isPanning) {
      const dx = (e.clientX - this.panStart.x) / window.innerWidth;
      const dy = (e.clientY - this.panStart.y) / window.innerHeight;

      const camDist = this.panTargetStart.distanceTo(this.panCameraStart);
      const panSpeed = camDist * 1.5;

      const worldUp = new THREE.Vector3(0, 1, 0);
      const camDir = this.camera.getWorldDirection(new THREE.Vector3());
      const right = new THREE.Vector3().crossVectors(camDir, worldUp).normalize();
      const camUp = new THREE.Vector3().crossVectors(right, camDir).normalize();

      const panOffset = new THREE.Vector3();
      panOffset.addScaledVector(right, -dx * panSpeed);
      panOffset.addScaledVector(camUp, dy * panSpeed);

      this.camera.position.copy(this.panCameraStart).add(panOffset);
      this.camera.lookAt(this.panTargetStart.clone().add(panOffset));
      return;
    }

    if (this.isCutting) {
      const last = this.cutPath[this.cutPath.length - 1];
      const dist = Math.sqrt(
        (this.mouse.x - last.x) * (this.mouse.x - last.x) +
        (this.mouse.y - last.y) * (this.mouse.y - last.y)
      );
      if (dist > 0.01) {
        this.cutEnd.set(this.mouse.x, this.mouse.y);
        this.cutPath.push({ x: this.mouse.x, y: this.mouse.y });
        this.drawCutTrail();
      }
      return;
    }

    if (!this.isDragging || this.dragIdx < 0) {
      // this.checkHover(e);
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.intersectPt)) return;
    this.applyDragInfluence(this.intersectPt.add(this.dragOffset));
  }

  checkHover(e) {
    if (this.isCutting || this.isPanning || this.isKeyADown || this.cutMode) {
      this.hideHoverTooltip();
      this.renderer.domElement.style.cursor = 'default';
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.clothMesh);
    if (intersects.length > 0 && intersects[0].uv) {
      const uv = intersects[0].uv;
      const product = this.texture.getProductByUV(uv.y, this.clothHeight);
      if (product && product.name) {
        if (this.hoverProduct !== product.id) {
          this.hoverProduct = product.id;
          this.showHoverTooltip(product, e.clientX, e.clientY);
        } else {
          this.hoverTooltip.style.left = (e.clientX + 14) + 'px';
          this.hoverTooltip.style.top = (e.clientY + 14) + 'px';
        }
        this.renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }
    if (this.hoverProduct) {
      this.hoverProduct = null;
      this.hideHoverTooltip();
    }
    this.renderer.domElement.style.cursor = 'default';
  }

  onWheel(e) {
    e.preventDefault();
    const zoomSpeed = 0.0015;
    const factor = 1 - e.deltaY * zoomSpeed;
    const newDist = this.camera.position.length() * factor;
    if (newDist < 5 || newDist > 25) return;

    const mouse3D = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.raycaster.ray.intersectPlane(plane, mouse3D);

    const dir = this.camera.position.clone().sub(mouse3D);
    dir.multiplyScalar(factor);
    this.camera.position.copy(mouse3D).add(dir);
  }

  onKeyDown(e) {
    if (e.key.toLowerCase() === 'a') {
      this.isKeyADown = true;
      this.renderer.domElement.style.cursor = 'crosshair';
      this.showCutOverlay();
    }
  }

  onKeyUp(e) {
    if (e.key.toLowerCase() === 'a') {
      this.isKeyADown = false;
      this.renderer.domElement.style.cursor = this.isDragging ? 'grabbing' : 'default';
      this.hideCutOverlay();
    }
  }

  screenPos(id) {
    const vec = new THREE.Vector3(this.physics.px[id], this.physics.py[id], this.physics.pz[id]);
    vec.project(this.camera);
    return { x: vec.x, y: vec.y };
  }

  onTouchStart(e) {
    e.preventDefault();

    if (e.touches.length === 1) {
      this.getTouchPos(e);
      this.clickStartPos.set(this.mouse.x, this.mouse.y);

      // 移动端切割模式
      if (this.cutMode) {
        this.isCutting = true;
        this.cutStart.set(this.mouse.x, this.mouse.y);
        this.cutEnd.set(this.mouse.x, this.mouse.y);
        this.cutPath = [{ x: this.mouse.x, y: this.mouse.y }];
        return;
      }

      const ci = this.findClosestParticle();
      if (ci >= 0) {
        this.isDragging = true;
        this.dragIdx = ci;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const ppos = new THREE.Vector3(
          this.physics.px[ci],
          this.physics.py[ci],
          this.physics.pz[ci]
        );
        const camDir = this.camera.getWorldDirection(new THREE.Vector3());
        this.dragPlane.setFromNormalAndCoplanarPoint(camDir, ppos);
        this.raycaster.ray.intersectPlane(this.dragPlane, this.intersectPt);
        this.dragOffset.copy(ppos).sub(this.intersectPt);
      }
    } else if (e.touches.length === 2) {
      this.isPinching = true;
      this.isDragging = false;
      this.isCutting = false;
      this.touchStartDist = this.getTouchDistance(e);
      this.touchStartPinchDist = this.camera.position.length();
    }
  }

  onTouchMove(e) {
    e.preventDefault();

    // H3: 手指数量变化时重置状态，避免误触
    if (this.isPinching && e.touches.length !== 2) {
      this.isPinching = false;
      this.isDragging = false;
      this.dragIdx = -1;
      return;
    }

    if (this.isPinching && e.touches.length === 2) {
      const currentDist = this.getTouchDistance(e);
      // H3: 降低缩放灵敏度（阻尼 50%）
      const rawFactor = currentDist / this.touchStartDist;
      const factor = 1 + (rawFactor - 1) * 0.5;
      const newDist = this.touchStartPinchDist * factor;

      if (newDist >= 5 && newDist <= 25) {
        this.camera.position.multiplyScalar(factor);
        this.touchStartPinchDist = this.camera.position.length();
        this.touchStartDist = currentDist;
      }
      return;
    }

    this.getTouchPos(e);

    // 移动端切割拖拽
    if (this.isCutting) {
      const last = this.cutPath[this.cutPath.length - 1];
      const dist = Math.sqrt(
        (this.mouse.x - last.x) * (this.mouse.x - last.x) +
        (this.mouse.y - last.y) * (this.mouse.y - last.y)
      );
      // H3: 提高切割采样阈值，减少抖动
      if (dist > 0.015) {
        this.cutEnd.set(this.mouse.x, this.mouse.y);
        this.cutPath.push({ x: this.mouse.x, y: this.mouse.y });
        this.drawCutTrail();
      }
      return;
    }

    if (!this.isDragging || this.dragIdx < 0) return;

    // H3: 拖拽最小移动阈值，防止微抖动
    const dragDx = this.mouse.x - this.clickStartPos.x;
    const dragDy = this.mouse.y - this.clickStartPos.y;
    if (Math.sqrt(dragDx * dragDx + dragDy * dragDy) < 0.005) return;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.intersectPt)) return;
    this.applyDragInfluence(this.intersectPt.add(this.dragOffset));
  }

  onTouchEnd() {
    if (this.isCutting) {
      this.performCut();
      this.isCutting = false;
      this.cutPath = [];
      this.clearCutTrail();
      return;
    }

    // 移动端商品点击检测（短按未拖拽）
    if (!this.isDragging) {
      this.handleClick();
    }

    this.isDragging = false;
    this.isPinching = false;
    this.dragIdx = -1;
  }

  getTouchPos(e) {
    const touch = e.touches[0];
    this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  }

  getTouchDistance(e) {
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    return Math.sqrt(
      (t2.clientX - t1.clientX) * (t2.clientX - t1.clientX) +
      (t2.clientY - t1.clientY) * (t2.clientY - t1.clientY)
    );
  }

  dispose() {
    const cv = this.renderer.domElement;
    const b = this._bound;
    if (b.onDown) cv.removeEventListener('mousedown', b.onDown);
    if (b.onMove) cv.removeEventListener('mousemove', b.onMove);
    if (b.onWheel) cv.removeEventListener('wheel', b.onWheel);
    if (b.onUp) window.removeEventListener('mouseup', b.onUp);
    if (b.onKeyDown) window.removeEventListener('keydown', b.onKeyDown);
    if (b.onKeyUp) window.removeEventListener('keyup', b.onKeyUp);
    if (b.onTouchStart) cv.removeEventListener('touchstart', b.onTouchStart);
    if (b.onTouchMove) cv.removeEventListener('touchmove', b.onTouchMove);
    if (b.onTouchEnd) cv.removeEventListener('touchend', b.onTouchEnd);
    if (b.onResize) window.removeEventListener('resize', b.onResize);
    if (this.cutCanvas && this.cutCanvas.parentNode) {
      this.cutCanvas.parentNode.removeChild(this.cutCanvas);
    }
    if (this.cutModeIndicator && this.cutModeIndicator.parentNode) {
      this.cutModeIndicator.parentNode.removeChild(this.cutModeIndicator);
    }
  }
}