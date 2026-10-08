import * as THREE from 'three';

export class ReceiptRenderer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clothMesh = null;
    this.clothGeo = null;
    this.holder = null;
    this.normalUpdateCounter = 0;
    this.normalUpdateInterval = 3;
    this.cameraAnimating = false;
  }

  init(clothWidth, clothHeight, topY) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xF5F2EC);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 0.5, 14);
    this.camera.lookAt(0, -1.0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.initLights();
    this.initEnvironment(clothWidth, topY);
    this.initDustParticles();

    // E3: WebGL 上下文丢失处理
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.showContextLostWarning();
    }, false);

    return this.renderer.domElement;
  }

  showContextLostWarning() {
    if (document.getElementById('contextLostWarning')) return;
    const warning = document.createElement('div');
    warning.id = 'contextLostWarning';
    warning.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(26,26,42,0.95); color: #F8F5EE;
      padding: 24px 36px; border-radius: 12px; z-index: 9999;
      font-family: 'Courier New', monospace; text-align: center;
      box-shadow: 0 8px 40px rgba(0,0,0,0.3);
    `;
    warning.innerHTML = `
      <div style="font-size: 32px; margin-bottom: 12px;">⚠</div>
      <div style="font-size: 16px; margin-bottom: 8px;">WebGL 上下文丢失</div>
      <div style="font-size: 13px; color: #8A8478;">请刷新页面以恢复渲染</div>
      <button onclick="location.reload()" style="
        margin-top: 16px; padding: 8px 24px; font-size: 14px;
        background: #4A90D9; color: #fff; border: none;
        border-radius: 6px; cursor: pointer; font-family: inherit;
      ">刷新页面</button>
    `;
    document.body.appendChild(warning);
  }

  initLights() {
    // 主光：暖白，模拟工作室主光源
    this.keyLight = new THREE.DirectionalLight(0xFFF5E8, 1.2);
    this.keyLight.position.set(3, 5, 6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 30;
    this.keyLight.shadow.camera.left = -6;
    this.keyLight.shadow.camera.right = 6;
    this.keyLight.shadow.camera.top = 10;
    this.keyLight.shadow.camera.bottom = -10;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.radius = 4;
    this.scene.add(this.keyLight);

    // 补光：半球光，消除死黑阴影
    const hemiLight = new THREE.HemisphereLight(0xFFFFFF, 0xE8E3D6, 0.4);
    this.scene.add(hemiLight);

    // 轮廓光：微冷白，勾勒收据卷曲边缘
    const rimLight = new THREE.DirectionalLight(0xEAF0FF, 0.5);
    rimLight.position.set(-2, -1, -5);
    this.scene.add(rimLight);
  }

  // 氛围尘埃粒子（B3）
  initDustParticles() {
    const count = 150;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      velocities[i * 3] = (Math.random() - 0.5) * 0.002;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.001;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
    }
    this.dustGeo = new THREE.BufferGeometry();
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustVelocities = velocities;

    const dustMat = new THREE.PointsMaterial({
      color: 0xFFF5E8,
      size: 0.04,
      transparent: true,
      opacity: 0.35,
      sizeAttenuation: true,
      depthWrite: false
    });
    this.dustPoints = new THREE.Points(this.dustGeo, dustMat);
    this.scene.add(this.dustPoints);
  }

  updateDustParticles() {
    if (!this.dustPoints) return;
    const pos = this.dustGeo.attributes.position.array;
    const vel = this.dustVelocities;
    const time = performance.now() * 0.001;
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] += vel[i] + Math.sin(time + i) * 0.0005;
      pos[i + 1] += vel[i + 1] + Math.cos(time + i * 0.5) * 0.0003;
      pos[i + 2] += vel[i + 2];
      // 循环边界
      if (pos[i] > 8) pos[i] = -8;
      if (pos[i] < -8) pos[i] = 8;
      if (pos[i + 1] > 8) pos[i + 1] = -8;
      if (pos[i + 1] < -8) pos[i + 1] = 8;
    }
    this.dustGeo.attributes.position.needsUpdate = true;
  }

  initEnvironment(clothWidth, topY) {
    // 阴影接收平面：仅接收阴影，本身透明
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.12 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -4.5;
    shadowPlane.receiveShadow = true;
    this.scene.add(shadowPlane);
    this.shadowPlane = shadowPlane;

    // 小票支架横杆
    const holderGeo = new THREE.BoxGeometry(clothWidth + 0.5, 0.1, 0.22);
    const holderMat = new THREE.MeshStandardMaterial({
      color: 0x8C8C8C,
      metalness: 0.85,
      roughness: 0.25
    });
    this.holder = new THREE.Mesh(holderGeo, holderMat);
    this.holder.position.set(0, topY + 0.08, 0);
    this.holder.castShadow = true;
    this.scene.add(this.holder);

    // 支架两侧固定夹
    const bracketGeo = new THREE.BoxGeometry(0.12, 0.28, 0.28);
    const bracketMat = new THREE.MeshStandardMaterial({
      color: 0x6E6E6E,
      metalness: 0.9,
      roughness: 0.2
    });

    this.leftBracket = new THREE.Mesh(bracketGeo, bracketMat);
    this.leftBracket.position.set(-clothWidth / 2 - 0.18, topY + 0.04, 0);
    this.leftBracket.castShadow = true;
    this.scene.add(this.leftBracket);

    this.rightBracket = new THREE.Mesh(bracketGeo, bracketMat);
    this.rightBracket.position.set(clothWidth / 2 + 0.18, topY + 0.04, 0);
    this.rightBracket.castShadow = true;
    this.scene.add(this.rightBracket);
  }

  rebuildEnvironment(clothWidth, clothHeight, topY) {
    // 移除旧的布料和环境
    this.disposeCloth();
    if (this.shadowPlane) {
      this.scene.remove(this.shadowPlane);
      this.shadowPlane.geometry.dispose();
      this.shadowPlane.material.dispose();
      this.shadowPlane = null;
    }
    if (this.holder) {
      this.scene.remove(this.holder);
      this.holder.geometry.dispose();
      this.holder.material.dispose();
      this.holder = null;
    }
    if (this.leftBracket) {
      this.scene.remove(this.leftBracket);
      this.leftBracket.geometry.dispose();
      this.leftBracket.material.dispose();
      this.leftBracket = null;
    }
    if (this.rightBracket) {
      this.scene.remove(this.rightBracket);
      this.rightBracket.geometry.dispose();
      this.rightBracket.material.dispose();
      this.rightBracket = null;
    }
    // 重建环境（不重新创建 renderer/camera/scene）
    this.initEnvironment(clothWidth, topY);
  }

  disposeCloth() {
    if (this.clothMesh) {
      this.scene.remove(this.clothMesh);
      if (this.clothGeo) {
        this.clothGeo.dispose();
        this.clothGeo = null;
      }
      if (this.clothMesh.material) {
        if (this.clothMesh.material.map) this.clothMesh.material.map.dispose();
        this.clothMesh.material.dispose();
      }
      this.clothMesh = null;
    }
  }

  createClothMesh(cols, rows, clothWidth, clothHeight, texture, normalMap) {
    this.clothGeo = new THREE.PlaneGeometry(clothWidth, clothHeight, cols - 1, rows - 1);

    // B1: 升级为 MeshPhysicalMaterial，增加纸张透光感（sheen）
    // G1: 添加法线贴图模拟纸张纤维凹凸
    const mat = new THREE.MeshPhysicalMaterial({
      map: texture,
      normalMap: normalMap || null,
      normalScale: new THREE.Vector2(0.3, 0.3),
      side: THREE.DoubleSide,
      roughness: 0.92,
      metalness: 0.0,
      color: 0xF8F5EE,
      sheen: 0.4,
      sheenColor: new THREE.Color(0xFFF5E8),
      sheenRoughness: 0.8,
      clearcoat: 0.0
    });

    this.clothMesh = new THREE.Mesh(this.clothGeo, mat);
    this.clothMesh.castShadow = true;
    this.clothMesh.receiveShadow = true;
    this.scene.add(this.clothMesh);
  }

  updateMesh(physics) {
    if (!this.clothMesh) return;

    const pos = this.clothGeo.attributes.position;
    const arr = pos.array;

    for (let j = 0; j < physics.ROWS; j++) {
      for (let i = 0; i < physics.COLS; i++) {
        const vi = j * physics.COLS + i;
        const id = physics.idx(i, j);
        arr[vi * 3] = physics.px[id];
        arr[vi * 3 + 1] = physics.py[id];
        arr[vi * 3 + 2] = physics.pz[id];
      }
    }

    pos.needsUpdate = true;

    this.normalUpdateCounter++;
    if (this.normalUpdateCounter >= this.normalUpdateInterval) {
      this.clothGeo.computeVertexNormals();
      this.normalUpdateCounter = 0;
    }
  }

  render() {
    // B3: 更新尘埃粒子
    this.updateDustParticles();
    // B4: 主光微摆，增加呼吸感
    if (this.keyLight) {
      const t = performance.now() * 0.0005;
      this.keyLight.position.x = 3 + Math.sin(t) * 0.8;
      this.keyLight.position.y = 5 + Math.cos(t * 0.7) * 0.4;
    }
    this.renderer.render(this.scene, this.camera);
  }

  startCameraAnimation() {
    this.cameraAnimating = true;
    this.cameraAnimStart = performance.now();
    this.cameraStartPos = new THREE.Vector3(0, 4, 22);
    this.cameraEndPos = new THREE.Vector3(0, 0.5, 14);
    this.camera.position.copy(this.cameraStartPos);
  }

  updateCameraAnimation() {
    if (!this.cameraAnimating) return;
    const elapsed = (performance.now() - this.cameraAnimStart) / 1500;
    if (elapsed >= 1) {
      this.cameraAnimating = false;
      this.camera.position.copy(this.cameraEndPos);
      this.camera.lookAt(0, -1.0, 0);
      return;
    }
    const t = 1 - Math.pow(1 - elapsed, 3);
    this.camera.position.lerpVectors(this.cameraStartPos, this.cameraEndPos, t);
    this.camera.lookAt(0, -1.0 + (1 - t) * 2, 0);
  }

  resetCamera() {
    this.cameraAnimating = false;
    this.camera.position.set(0, 0.5, 14);
    this.camera.lookAt(0, -1.0, 0);
  }

  getCamera() {
    return this.camera;
  }

  getRenderer() {
    return this.renderer;
  }

  getClothMesh() {
    return this.clothMesh;
  }

  // G4: 应用主题色
  applyTheme(theme) {
    if (this.scene) {
      this.scene.background = new THREE.Color(theme.sceneBg);
    }
    if (this.keyLight) {
      this.keyLight.color = new THREE.Color(theme.lightColor);
    }
    if (this.clothMesh && this.clothMesh.material) {
      this.clothMesh.material.color = new THREE.Color(theme.clothColor);
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
