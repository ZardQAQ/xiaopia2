import * as THREE from 'three';
import { PhysicsEngine } from './PhysicsEngine.js';
import { ReceiptRenderer } from './ReceiptRenderer.js';
import { ReceiptTexture, products, quizQuestions } from './ReceiptTexture.js';
import { Interaction } from './Interaction.js';

export class App {
  constructor() {
    // 默认参数
    this.params = {
      cols: 22,
      rows: 72,
      clothW: 3.0,
      clothH: 11.1,
      gravity: -10.0,
      damping: 0.97,
      iters: 22,
      stiffStruct: 1.0,
      stiffShear: 0.75,
      stiffBend: 0.35,
      wind: -0.12,
      groundY: -7.0,
      thickness: 0.30,
      maxStretch: 1.5
    };
    this.FIXED_DT = 1 / 60;
    this.preSimDone = false;
    this.cameraAnimating = false;

    // G4: 主题配置
    this.themes = [
      { name: '暖白', cls: 'theme-warm', bg: '#EDE3D0', sceneBg: 0xEDE3D0, lightColor: 0xFFF5E8, clothColor: 0xF8F5EE },
      { name: '冷蓝', cls: 'theme-cool', bg: '#D8E0EF', sceneBg: 0xD8E0EF, lightColor: 0xE0E8F8, clothColor: 0xF0F4FA },
      { name: '复古黄', cls: 'theme-vintage', bg: '#E4D5B8', sceneBg: 0xE4D5B8, lightColor: 0xFFF0D0, clothColor: 0xF5EEDD }
    ];
    this.themeIdx = parseInt(localStorage.getItem('theme') || '0');

    // F4: 学习进度追踪
    this.learnedIds = new Set(JSON.parse(localStorage.getItem('learned') || '[]'));

    this.physics = null;
    this.renderer = null;
    this.texture = null;
    this.interaction = null;
    this.audioContext = null;
    this.uiCreated = false;
    this.animating = true;

    this.init();
  }

  init() {
    this.showLoading();
    this.buildScene();
    this.setupAudio();
    if (!this.uiCreated) {
      this.setupUI();
      this.uiCreated = true;
    }
    window.addEventListener('resize', () => this.onResize());
    if (!this._keyHandler) {
      this._keyHandler = (e) => this.onKeyDown(e);
      window.addEventListener('keydown', this._keyHandler);
    }
    this.animate();
  }

  buildScene() {
    const p = this.params;
    this.physics = new PhysicsEngine(p.cols, p.rows, p.clothW, p.clothH);
    this.physics.GRAVITY = p.gravity;
    this.physics.DAMPING = p.damping;
    this.physics.ITERS = p.iters;
    this.physics.STIFF_STRUCT = p.stiffStruct;
    this.physics.STIFF_SHEAR = p.stiffShear;
    this.physics.STIFF_BEND = p.stiffBend;
    this.physics.WIND_FORCE = p.wind;
    this.physics.GROUND_Y = p.groundY;
    this.physics.THICKNESS = p.thickness;
    this.MAX_STRETCH = p.maxStretch;

    if (!this.renderer) {
      this.renderer = new ReceiptRenderer();
      const canvasEl = this.renderer.init(p.clothW, p.clothH, this.physics.TOP_Y);
      document.body.appendChild(canvasEl);
    } else {
      this.renderer.rebuildEnvironment(p.clothW, p.clothH, this.physics.TOP_Y);
    }

    this.texture = new ReceiptTexture();
    const tex = this.texture.create();
    const normalMap = this.texture.createNormalMap();
    this.renderer.createClothMesh(p.cols, p.rows, p.clothW, p.clothH, tex, normalMap);
    const clothMesh = this.renderer.getClothMesh();

    this.interaction = new Interaction(
      this.renderer.getRenderer(),
      this.renderer.getCamera(),
      this.physics,
      clothMesh,
      this.texture,
      p.clothH,
      this.onProductClick.bind(this)
    );
    this.interaction.onCut = () => this.playSound('cut');

    this.preSimDone = false;
    this.syncWindInput();
    this.applyTheme();
  }

  destroyScene() {
    if (this.interaction) {
      this.interaction.dispose();
      this.interaction = null;
    }
    if (this.renderer) {
      this.renderer.disposeCloth();
    }
    this.physics = null;
  }

  rebuildWithParams(newParams) {
    Object.assign(this.params, newParams);
    this.animating = false;
    this.destroyScene();
    this.showLoading();
    this.buildScene();
    this.animating = true;
    this.animate();
  }

  onResize() {
    if (this.renderer) this.renderer.onResize();
  }

  showLoading() {
    this.hideLoading(true);
    this.loadingEl = document.createElement('div');
    this.loadingEl.id = 'loadingOverlay';
    this.loadingEl.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: #F5F2EC; z-index: 9999;
      transition: opacity 0.6s ease;
    `;
    this.loadingEl.innerHTML = `
      <div style="font-size: 28px; color: #1A1A2A; font-family: 'Courier New', monospace; margin-bottom: 16px;">
        ⎙ 正在打印小票...
      </div>
      <div style="width: 200px; height: 4px; background: rgba(0,0,0,0.08); border-radius: 2px; overflow: hidden;">
        <div id="loadingBar" style="width: 0%; height: 100%; background: #1A1A2A; transition: width 0.3s;"></div>
      </div>
    `;
    document.body.appendChild(this.loadingEl);
  }

  hideLoading(immediate = false) {
    document.querySelectorAll('#loadingOverlay').forEach(el => el.remove());
    if (this.loadingEl) {
      if (immediate) {
        this.loadingEl.remove();
      } else {
        this.loadingEl.style.opacity = '0';
        setTimeout(() => {
          if (this.loadingEl && this.loadingEl.parentNode) {
            this.loadingEl.remove();
          }
        }, 600);
      }
      this.loadingEl = null;
    }
  }

  setupUI() {
    // 暗角 overlay
    const vignette = document.createElement('div');
    vignette.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 50;
      background: radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,0.06) 100%);
    `;
    document.body.appendChild(vignette);

    // 操作提示
    const hint = document.createElement('div');
    hint.id = 'hint';
    hint.innerHTML = '<span class="hint-item">🖱️ 左键拖拽</span><span class="hint-sep">│</span><span class="hint-item">中键平移</span><span class="hint-sep">│</span><span class="hint-item">滚轮缩放</span><span class="hint-sep">│</span><span class="hint-item">A键切割</span><span class="hint-sep">│</span><span class="hint-item">🎓 学习导览</span><span class="hint-sep">│</span><span class="hint-item">H键帮助</span>';
    hint.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      color: #8A8478; font-size: 12px; pointer-events: auto; cursor: default; text-align: center;
      background: rgba(255,253,248,0.75); padding: 9px 24px; border-radius: 20px;
      backdrop-filter: blur(12px); border: 1px solid rgba(0,0,0,0.04);
      font-family: 'Courier New', monospace;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
      letter-spacing: 0.3px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 60;
      overflow: hidden;
      user-select: none;
    `;
    hint.onmouseover = function() {
      this.style.transform = 'translateX(-50%) translateY(-2px)';
      this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)';
      this.style.background = 'rgba(255,253,248,0.9)';
    };
    hint.onmouseout = function() {
      this.style.transform = 'translateX(-50%) translateY(0)';
      this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)';
      this.style.background = 'rgba(255,253,248,0.75)';
    };
    document.body.appendChild(hint);

    const hintStyle = document.createElement('style');
    hintStyle.textContent = `
      .hint-sep {
        color: rgba(0,0,0,0.12);
        margin: 0 10px;
        font-size: 10px;
      }
      .hint-item {
        position: relative;
        display: inline-block;
      }
      #hint::before {
        content: '';
        position: absolute;
        top: 0; left: -100%;
        width: 60%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
        animation: hintShimmer 4s ease-in-out infinite;
      }
      @keyframes hintShimmer {
        0% { left: -60%; }
        50% { left: 100%; }
        100% { left: 100%; }
      }
    `;
    document.head.appendChild(hintStyle);

    const BTN_SHADOW = '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)';
    const BTN_SHADOW_HOVER = '0 2px 8px rgba(0,0,0,0.08), 0 6px 20px rgba(0,0,0,0.06)';
    const BTN_SHADOW_ACTIVE = '0 1px 2px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)';
    const _btnOver = function() { this.style.background = 'rgba(255,253,248,0.95)'; this.style.transform = 'translateY(-2px)'; this.style.boxShadow = BTN_SHADOW_HOVER; };
    const _btnOut = function() { this.style.background = 'rgba(255,253,248,0.75)'; this.style.transform = 'translateY(0)'; this.style.boxShadow = BTN_SHADOW; };
    const _btnDown = function() { this.style.transform = 'translateY(0) scale(0.97)'; this.style.boxShadow = BTN_SHADOW_ACTIVE; };
    const _btnUp = function() { this.style.transform = 'translateY(-2px)'; this.style.boxShadow = BTN_SHADOW_HOVER; };
    const _mkBtn = (cfg) => {
      const b = document.createElement('button');
      if (cfg.id) b.id = cfg.id;
      b.innerHTML = cfg.label;
      b.className = 'side-panel-btn';
      b.style.cssText = `
        padding: 9px 16px; font-size: 13px; color: #4A4640;
        background: rgba(255,253,248,0.75); border: 1px solid rgba(0,0,0,0.05);
        border-radius: 10px; cursor: pointer; box-shadow: ${BTN_SHADOW};
        backdrop-filter: blur(12px);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: 'Courier New', monospace; text-align: left; width: 100%;
      `;
      b.onmouseover = _btnOver; b.onmouseout = _btnOut;
      b.onmousedown = _btnDown; b.onmouseup = _btnUp;
      b.onclick = () => cfg.onClick && cfg.onClick();
      return b;
    };

    // 右侧面板容器
    const rightPanel = document.createElement('div');
    rightPanel.id = 'rightPanel';
    rightPanel.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 80;
      display: flex; flex-direction: column; gap: 8px;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
    `;
    document.body.appendChild(rightPanel);

    // 组1：视图操作
    const g1 = document.createElement('div');
    g1.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    g1.appendChild(_mkBtn({ id: 'resetBtn', label: '🔄 重置视角', onClick: () => { this.renderer.resetCamera(); this.playSound('reset'); } }));
    g1.appendChild(_mkBtn({ id: 'themeBtn', label: `🎨 ${this.themes[this.themeIdx].name}`, onClick: () => this.switchTheme() }));
    g1.appendChild(_mkBtn({ id: 'shotBtn', label: '📷 截图', onClick: () => this.takeScreenshot() }));
    rightPanel.appendChild(g1);

    // 分隔线
    const sp1 = document.createElement('div');
    sp1.style.cssText = 'height: 1px; background: rgba(0,0,0,0.06); margin: 4px 0;';
    rightPanel.appendChild(sp1);

    // 组2：学习功能
    const g2 = document.createElement('div');
    g2.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    g2.appendChild(_mkBtn({ id: 'tourBtn', label: '🎓 学习导览', onClick: () => this.startLearningTour() }));
    g2.appendChild(_mkBtn({ id: 'pipelineBtn', label: '⚙ 管线视图', onClick: () => this.togglePipeline() }));
    g2.appendChild(_mkBtn({ id: 'kbBtn', label: '📖 知识库', onClick: () => this.toggleKnowledgeBase() }));
    rightPanel.appendChild(g2);

    // 更多折叠区
    const moreWrap = document.createElement('div');
    moreWrap.id = 'moreGroup';
    moreWrap.style.cssText = 'overflow: hidden; max-height: 0; opacity: 0; transition: max-height 0.4s ease, opacity 0.3s ease, margin-top 0.3s ease; margin-top: 0; display: flex; flex-direction: column; gap: 8px;';
    rightPanel.appendChild(moreWrap);

    const sp2 = document.createElement('div');
    sp2.style.cssText = 'height: 1px; background: rgba(0,0,0,0.06);';
    moreWrap.appendChild(sp2);

    // 组3：更多功能
    const g3 = document.createElement('div');
    g3.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
    g3.appendChild(_mkBtn({ id: 'consoleBtn', label: '🎛 控制台', onClick: () => this.toggleConsole() }));
    g3.appendChild(_mkBtn({ id: 'aboutBtn', label: 'ℹ 关于', onClick: () => this.toggleAboutPanel() }));
    g3.appendChild(_mkBtn({ id: 'uploadBtn', label: '🖼 自定义图片', onClick: () => this.uploadImage() }));
    g3.appendChild(_mkBtn({ id: 'reprintBtn', label: '🖨 重新打印', onClick: () => this.reprintReceipt() }));
    moreWrap.appendChild(g3);

    // 更多按钮
    const moreBtn = document.createElement('button');
    moreBtn.id = 'moreBtn';
    moreBtn.innerHTML = '··· 更多';
    moreBtn.className = 'side-panel-btn';
    moreBtn.style.cssText = `
      padding: 9px 16px; font-size: 13px; color: #8A8478;
      background: rgba(255,253,248,0.6); border: 1px solid rgba(0,0,0,0.04);
      border-radius: 10px; cursor: pointer;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.03);
      backdrop-filter: blur(12px);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: 'Courier New', monospace; text-align: center; width: 100%; margin-top: 4px;
    `;
    let moreOpen = false;
    moreBtn.onmouseover = function() { this.style.background = 'rgba(255,253,248,0.85)'; this.style.color = '#4A4640'; this.style.transform = 'translateY(-1px)'; };
    moreBtn.onmouseout = function() { this.style.background = 'rgba(255,253,248,0.6)'; this.style.color = '#8A8478'; this.style.transform = 'translateY(0)'; };
    moreBtn.onclick = () => {
      moreOpen = !moreOpen;
      if (moreOpen) { moreWrap.style.maxHeight = '300px'; moreWrap.style.opacity = '1'; moreWrap.style.marginTop = '4px'; moreBtn.innerHTML = '▲ 收起'; }
      else { moreWrap.style.maxHeight = '0'; moreWrap.style.opacity = '0'; moreWrap.style.marginTop = '0'; moreBtn.innerHTML = '··· 更多'; }
      this.playSound('reset');
    };
    rightPanel.appendChild(moreBtn);

    // 左上角控制面板（风力 + 学习进度）
    const leftPanel = document.createElement('div');
    leftPanel.id = 'leftPanel';
    leftPanel.style.cssText = `
      position: fixed; top: 20px; left: 20px; z-index: 80;
      background: rgba(255,253,248,0.75); padding: 12px 16px; border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
      backdrop-filter: blur(12px); border: 1px solid rgba(0,0,0,0.05);
      font-family: 'Courier New', monospace; min-width: 200px;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    const windRow = document.createElement('div');
    windRow.style.cssText = 'margin-bottom: 10px;';
    const windTopRow = document.createElement('div');
    windTopRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;';
    const windLabel = document.createElement('span');
    windLabel.style.cssText = 'font-size: 13px; color: #4A4640; display: flex; align-items: center; gap: 6px;';
    const windIcon = document.createElement('span');
    windIcon.id = 'windIcon';
    windIcon.textContent = '🍃';
    windIcon.style.cssText = 'display: inline-block; transition: transform 0.3s ease;';
    windLabel.appendChild(windIcon);
    const windLabelText = document.createElement('span');
    windLabelText.textContent = '风力';
    windLabel.appendChild(windLabelText);
    const windValueDisplay = document.createElement('span');
    windValueDisplay.id = 'windValueDisplay';
    windValueDisplay.style.cssText = 'font-size: 12px; color: #4A90D9; font-weight: 600; font-family: monospace;';
    windValueDisplay.textContent = '-0.12';
    windTopRow.appendChild(windLabel);
    windTopRow.appendChild(windValueDisplay);
    windRow.appendChild(windTopRow);

    const windControlRow = document.createElement('div');
    windControlRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const windMinusBtn = document.createElement('button');
    windMinusBtn.textContent = '−';
    windMinusBtn.style.cssText = `
      width: 26px; height: 26px; border: 1px solid rgba(0,0,0,0.08);
      background: rgba(0,0,0,0.04); border-radius: 6px;
      cursor: pointer; font-size: 14px; color: #4A4640;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; font-family: monospace; flex-shrink: 0;
      line-height: 1;
    `;
    windMinusBtn.onmouseover = function() { this.style.background = 'rgba(0,0,0,0.08)'; };
    windMinusBtn.onmouseout = function() { this.style.background = 'rgba(0,0,0,0.04)'; };

    const windSlider = document.createElement('input');
    windSlider.id = 'windSlider';
    windSlider.type = 'range';
    windSlider.min = '-1';
    windSlider.max = '1';
    windSlider.step = '0.01';
    windSlider.value = '-0.12';
    windSlider.style.cssText = `
      flex: 1; height: 4px; accent-color: #4A90D9;
      cursor: pointer;
    `;

    const windPlusBtn = document.createElement('button');
    windPlusBtn.textContent = '+';
    windPlusBtn.style.cssText = `
      width: 26px; height: 26px; border: 1px solid rgba(0,0,0,0.08);
      background: rgba(0,0,0,0.04); border-radius: 6px;
      cursor: pointer; font-size: 14px; color: #4A4640;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; font-family: monospace; flex-shrink: 0;
      line-height: 1;
    `;
    windPlusBtn.onmouseover = function() { this.style.background = 'rgba(0,0,0,0.08)'; };
    windPlusBtn.onmouseout = function() { this.style.background = 'rgba(0,0,0,0.04)'; };

    windControlRow.appendChild(windMinusBtn);
    windControlRow.appendChild(windSlider);
    windControlRow.appendChild(windPlusBtn);
    windRow.appendChild(windControlRow);

    const updateWind = (v) => {
      v = Math.max(-1, Math.min(1, v));
      v = Math.round(v * 100) / 100;
      this.params.wind = v;
      if (this.physics) this.physics.setWind(v);
      windSlider.value = v;
      const windInputEl = document.getElementById('windInput');
      if (windInputEl) windInputEl.value = v;
      windValueDisplay.textContent = v.toFixed(2);
      const rot = v * 30;
      windIcon.style.transform = `rotate(${rot}deg) scale(${1 + Math.abs(v) * 0.3})`;
    };

    windMinusBtn.onclick = () => updateWind(this.params.wind - 0.05);
    windPlusBtn.onclick = () => updateWind(this.params.wind + 0.05);
    windSlider.oninput = (e) => updateWind(parseFloat(e.target.value));

    windRow.appendChild(windControlRow);
    leftPanel.appendChild(windRow);

    const sep = document.createElement('div');
    sep.style.cssText = 'height: 1px; background: rgba(0,0,0,0.06); margin-bottom: 10px;';
    leftPanel.appendChild(sep);

    const progressRow = document.createElement('div');
    progressRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
    const progressText = document.createElement('div');
    progressText.id = 'progressText';
    progressText.style.cssText = 'font-size: 12px; color: #4A4640; display: flex; justify-content: space-between;';
    const progressBarBg = document.createElement('div');
    progressBarBg.style.cssText = 'width: 100%; height: 5px; background: rgba(0,0,0,0.06); border-radius: 3px; overflow: hidden;';
    const progressBarFill = document.createElement('div');
    progressBarFill.id = 'progressBarFill';
    progressBarFill.style.cssText = 'height: 100%; width: 0%; background: linear-gradient(90deg, #50C878, #7ED8A0); border-radius: 3px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);';
    progressBarBg.appendChild(progressBarFill);
    progressRow.appendChild(progressText);
    progressRow.appendChild(progressBarBg);
    leftPanel.appendChild(progressRow);

    document.body.appendChild(leftPanel);



    // 移动端切割模式按钮（C3）
    const cutModeBtn = document.createElement('button');
    cutModeBtn.id = 'cutModeBtn';
    cutModeBtn.innerHTML = '✂ 切割';
    cutModeBtn.style.cssText = `
      position: fixed; bottom: 24px; right: 20px;
      padding: 10px 18px; font-size: 14px; color: #4A4640;
      background: rgba(255,253,248,0.9); border: 1px solid rgba(0,0,0,0.06);
      border-radius: 8px; cursor: pointer; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      backdrop-filter: blur(8px); transition: all 0.2s;
      font-family: 'Courier New', monospace;
      display: none;
    `;
    cutModeBtn.onclick = () => {
      if (!this.interaction) return;
      const active = this.interaction.toggleCutMode();
      cutModeBtn.style.background = active ? 'rgba(231,76,60,0.15)' : 'rgba(255,253,248,0.9)';
      cutModeBtn.style.color = active ? '#E74C3C' : '#4A4640';
    };
    document.body.appendChild(cutModeBtn);

    // 移动端检测显示切割按钮
    if ('ontouchstart' in window) {
      cutModeBtn.style.display = 'block';
    }

    this.createConsolePanel();
    this.renderPresetList();
    this.createPipelineDiagram();
    this.createProductCard();
    this.createIntroCard();
    this.createHelpPanel();
    this.createAboutPanel();
    this.applyResponsiveLayout();
    this.updateLearnedProgress();

    // TRAE 标识（左下角）- 金属光泽流光版
    if (!document.getElementById('traeBadge')) {
      const badge = document.createElement('div');
      badge.id = 'traeBadge';
      badge.style.cssText = `
        position: fixed; bottom: 24px; left: 20px; z-index: 60;
        display: flex; align-items: center; gap: 8px;
        padding: 6px 14px; border-radius: 20px;
        font-family: 'Courier New', monospace;
        font-size: 11px; cursor: pointer; overflow: hidden;
        background: linear-gradient(145deg, 
          #E8E5DC 0%, #F5F2EA 25%, #FFFFFF 45%, 
          #E0DDD4 55%, #D5D2C8 75%, #ECE9E0 100%);
        background-size: 200% 200%;
        border: 1px solid rgba(180,175,165,0.4);
        box-shadow: 
          inset 0 1px 0 rgba(255,255,255,0.8),
          inset 0 -1px 0 rgba(150,145,135,0.2),
          0 2px 8px rgba(0,0,0,0.08),
          0 6px 20px rgba(0,0,0,0.06);
        color: #4A4640;
        transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      `;
      badge.innerHTML = `
        <span class="trae-logo-icon" style="display: inline-flex; align-items: center; justify-content: center;
                     width: 20px; height: 20px; border-radius: 5px;
                     background: linear-gradient(145deg, #2A2A3A, #1A1A2A);
                     color: #F8F5EE; font-size: 12px; font-weight: bold;
                     box-shadow: inset 0 1px 0 rgba(255,255,255,0.15),
                                 inset 0 -1px 0 rgba(0,0,0,0.3),
                                 0 1px 3px rgba(0,0,0,0.2);
                     position: relative; overflow: hidden;">
          <span class="trae-logo-shine" style="position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
                       background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                       "></span>
          T
        </span>
        <span style="position: relative; z-index: 1;
                     text-shadow: 0 1px 0 rgba(255,255,255,0.6);">本项目由 TRAE 开发</span>
        <span class="trae-sweep" style="position: absolute; top: 0; left: -150%; width: 60%; height: 100%;
                     background: linear-gradient(90deg, 
                       transparent, 
                       rgba(255,255,255,0.7) 50%, 
                       rgba(255,255,255,0.3) 70%,
                       transparent);
                     transform: skewX(-20deg);
                     "></span>
      `;
      badge.onmouseover = function() {
        this.style.transform = 'translateY(-2px) scale(1.02)';
        this.style.boxShadow = `
          inset 0 1px 0 rgba(255,255,255,0.9),
          inset 0 -1px 0 rgba(150,145,135,0.25),
          0 4px 12px rgba(0,0,0,0.1),
          0 10px 28px rgba(0,0,0,0.08),
          0 0 20px rgba(200,195,180,0.3)
        `;
        this.style.animation = 'traeShimmer 1.8s ease-in-out infinite';
        const logoShine = this.querySelector('.trae-logo-shine');
        if (logoShine) logoShine.style.animation = 'traeLogoShine 1.8s ease-in-out infinite';
        const sweep = this.querySelector('.trae-sweep');
        if (sweep) sweep.style.animation = 'traeSweep 1.8s ease-in-out infinite';
      };
      badge.onmouseout = function() {
        this.style.transform = 'translateY(0) scale(1)';
        this.style.boxShadow = `
          inset 0 1px 0 rgba(255,255,255,0.8),
          inset 0 -1px 0 rgba(150,145,135,0.2),
          0 2px 8px rgba(0,0,0,0.08),
          0 6px 20px rgba(0,0,0,0.06)
        `;
        this.style.animation = 'none';
        const logoShine = this.querySelector('.trae-logo-shine');
        if (logoShine) logoShine.style.animation = 'none';
        const sweep = this.querySelector('.trae-sweep');
        if (sweep) sweep.style.animation = 'none';
      };
      badge.onclick = () => window.open('https://www.trae.cn/', '_blank');
      document.body.appendChild(badge);

      if (!document.getElementById('traeBadgeStyle')) {
        const traeStyle = document.createElement('style');
        traeStyle.id = 'traeBadgeStyle';
        traeStyle.textContent = `
          @keyframes traeShimmer {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes traeSweep {
            0% { left: -150%; }
            40% { left: 150%; }
            100% { left: 150%; }
          }
          @keyframes traeLogoShine {
            0% { left: -100%; }
            40% { left: 100%; }
            100% { left: 100%; }
          }
        `;
        document.head.appendChild(traeStyle);
      }
    }
  }

  createConsolePanel() {
    this.consolePanel = document.createElement('div');
    this.consolePanel.id = 'consolePanel';
    this.consolePanel.style.cssText = `
      position: fixed; top: 50%; left: 20px; transform: translateY(-50%) translateX(-120%);
      background: rgba(255,253,248,0.97); padding: 20px; border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.1); backdrop-filter: blur(12px);
      border: 1px solid rgba(0,0,0,0.05); width: 280px;
      transition: transform 0.4s ease; z-index: 90;
      font-family: 'Courier New', monospace;
      max-height: 85vh; overflow-y: auto;
    `;

    const title = document.createElement('div');
    title.style.cssText = `font-size: 14px; font-weight: 600; color: #1A1A2A; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;`;
    title.innerHTML = '<span>🎛 物理参数控制台</span>';
    const consoleCollapseBtn = document.createElement('button');
    consoleCollapseBtn.innerHTML = '✕';
    consoleCollapseBtn.style.cssText = `
      width: 24px; height: 24px; font-size: 14px; color: #8A8478;
      background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.06);
      border-radius: 6px; cursor: pointer; transition: all 0.2s;
      font-family: 'Courier New', monospace;
      display: flex; align-items: center; justify-content: center;
      line-height: 1;
    `;
    consoleCollapseBtn.onmouseover = () => { consoleCollapseBtn.style.background = 'rgba(0,0,0,0.08)'; consoleCollapseBtn.style.color = '#E74C3C'; };
    consoleCollapseBtn.onmouseout = () => { consoleCollapseBtn.style.background = 'rgba(0,0,0,0.04)'; consoleCollapseBtn.style.color = '#8A8478'; };
    consoleCollapseBtn.onclick = () => this.toggleConsole();
    title.appendChild(consoleCollapseBtn);
    this.consolePanel.appendChild(title);

    // 预设按钮组
    const presetGroup = document.createElement('div');
    presetGroup.style.cssText = `display: flex; gap: 6px; margin-bottom: 14px;`;
    const presets = [
      { name: '低面', params: { cols: 14, rows: 44 } },
      { name: '中面', params: { cols: 22, rows: 72 } },
      { name: '高面', params: { cols: 32, rows: 96 } }
    ];
    presets.forEach(preset => {
      const btn = document.createElement('button');
      btn.textContent = preset.name;
      btn.style.cssText = `
        flex: 1; padding: 6px; font-size: 11px; color: #4A4640;
        background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.06);
        border-radius: 6px; cursor: pointer; transition: all 0.2s;
        font-family: 'Courier New', monospace;
      `;
      btn.onmouseover = () => { btn.style.background = 'rgba(26,26,42,0.1)'; };
      btn.onmouseout = () => { btn.style.background = 'rgba(0,0,0,0.04)'; };
      btn.onclick = () => {
        this.rebuildWithParams(preset.params);
        this.syncConsoleInputs();
      };
      presetGroup.appendChild(btn);
    });
    this.consolePanel.appendChild(presetGroup);

    // I3: 自定义预设保存/加载区
    const customPresetGroup = document.createElement('div');
    customPresetGroup.style.cssText = 'margin-bottom: 14px;';
    const customTitle = document.createElement('div');
    customTitle.style.cssText = 'font-size: 11px; color: #8A8478; margin-bottom: 6px;';
    customTitle.textContent = '我的预设';
    customPresetGroup.appendChild(customTitle);

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 保存当前';
    saveBtn.style.cssText = `
      width: 100%; padding: 6px; font-size: 11px; color: #4A4640;
      background: rgba(74,144,217,0.12); border: 1px solid rgba(74,144,217,0.2);
      border-radius: 6px; cursor: pointer; transition: all 0.2s;
      font-family: 'Courier New', monospace; margin-bottom: 8px;
    `;
    saveBtn.onmouseover = () => { saveBtn.style.background = 'rgba(74,144,217,0.22)'; };
    saveBtn.onmouseout = () => { saveBtn.style.background = 'rgba(74,144,217,0.12)'; };
    saveBtn.onclick = () => {
      const name = prompt('请输入预设名称：');
      if (name && name.trim()) this.savePreset(name.trim());
    };
    customPresetGroup.appendChild(saveBtn);

    this.presetListEl = document.createElement('div');
    this.presetListEl.style.cssText = 'display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto;';
    customPresetGroup.appendChild(this.presetListEl);

    this.consolePanel.appendChild(customPresetGroup);

    // 参数输入区
    const fields = [
      { key: 'cols', label: '布料列数', min: 6, max: 60, step: 1 },
      { key: 'rows', label: '布料行数', min: 16, max: 150, step: 1 },
      { key: 'clothW', label: '布料宽度', min: 1, max: 8, step: 0.1 },
      { key: 'clothH', label: '布料高度', min: 3, max: 20, step: 0.1 },
      { key: 'gravity', label: '重力', min: -30, max: 0, step: 0.5 },
      { key: 'damping', label: '阻尼', min: 0.8, max: 0.999, step: 0.005 },
      { key: 'iters', label: '迭代次数', min: 4, max: 50, step: 1 },
      { key: 'stiffStruct', label: '结构刚度', min: 0.1, max: 1.0, step: 0.05 },
      { key: 'stiffShear', label: '剪切刚度', min: 0.1, max: 1.0, step: 0.05 },
      { key: 'stiffBend', label: '弯曲刚度', min: 0.1, max: 1.0, step: 0.05 },
      { key: 'wind', label: '风力', min: -1, max: 1, step: 0.01 },
      { key: 'groundY', label: '地面高度', min: -15, max: 0, step: 0.5 },
      { key: 'thickness', label: '碰撞厚度', min: 0.05, max: 1.0, step: 0.05 },
      { key: 'maxStretch', label: '最大拉伸', min: 1.0, max: 3.0, step: 0.05 }
    ];

    this.consoleInputs = {};
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

    fields.forEach(f => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';
      const lbl = document.createElement('label');
      lbl.textContent = f.label;
      lbl.style.cssText = 'font-size: 11px; color: #4A4640; flex: 1;';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = this.params[f.key];
      inp.min = f.min; inp.max = f.max; inp.step = f.step;
      inp.style.cssText = `
        width: 70px; padding: 3px 6px; border: 1px solid rgba(0,0,0,0.1);
        border-radius: 4px; font-family: monospace; font-size: 11px; text-align: center;
        outline: none; background: rgba(255,255,255,0.8); color: #4A4640;
      `;
      inp.dataset.key = f.key;
      inp.dataset.min = f.min;
      inp.dataset.max = f.max;
      this.consoleInputs[f.key] = inp;
      row.appendChild(lbl);
      row.appendChild(inp);
      inputContainer.appendChild(row);
    });
    this.consolePanel.appendChild(inputContainer);

    // 操作按钮组
    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display: flex; gap: 8px; margin-top: 14px;';

    const applyBtn = document.createElement('button');
    applyBtn.textContent = '✓ 应用并重建';
    applyBtn.style.cssText = `
      flex: 1; padding: 8px; font-size: 12px; color: #fff;
      background: #1A1A2A; border: none; border-radius: 6px;
      cursor: pointer; transition: all 0.2s;
      font-family: 'Courier New', monospace;
    `;
    applyBtn.onmouseover = () => { applyBtn.style.background = '#2A2A3A'; };
    applyBtn.onmouseout = () => { applyBtn.style.background = '#1A1A2A'; };
    applyBtn.onclick = () => this.applyConsoleParams();
    btnGroup.appendChild(applyBtn);

    const resetBtn = document.createElement('button');
    resetBtn.textContent = '↺ 恢复默认';
    resetBtn.style.cssText = `
      flex: 1; padding: 8px; font-size: 12px; color: #4A4640;
      background: rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.08);
      border-radius: 6px; cursor: pointer; transition: all 0.2s;
      font-family: 'Courier New', monospace;
    `;
    resetBtn.onmouseover = () => { resetBtn.style.background = 'rgba(0,0,0,0.1)'; };
    resetBtn.onmouseout = () => { resetBtn.style.background = 'rgba(0,0,0,0.06)'; };
    resetBtn.onclick = () => this.resetToDefault();
    btnGroup.appendChild(resetBtn);

    this.consolePanel.appendChild(btnGroup);
    document.body.appendChild(this.consolePanel);
  }

  toggleConsole() {
    if (this.consolePanel.style.transform.includes('translateX(-120%)')) {
      this.consolePanel.style.transform = 'translateY(-50%) translateX(0)';
    } else {
      this.consolePanel.style.transform = 'translateY(-50%) translateX(-120%)';
    }
  }

  syncConsoleInputs() {
    if (!this.consoleInputs) return;
    for (const key in this.consoleInputs) {
      if (this.params[key] !== undefined) {
        this.consoleInputs[key].value = this.params[key];
      }
    }
  }

  applyConsoleParams() {
    const newParams = {};
    for (const key in this.consoleInputs) {
      const inp = this.consoleInputs[key];
      const v = parseFloat(inp.value);
      if (isNaN(v)) continue;
      const min = parseFloat(inp.dataset.min);
      const max = parseFloat(inp.dataset.max);
      newParams[key] = Math.max(min, Math.min(max, v));
    }
    this.rebuildWithParams(newParams);
    this.syncConsoleInputs();
    this.playSound('reset');
  }

  resetToDefault() {
    const defaults = {
      cols: 22, rows: 72, clothW: 3.0, clothH: 11.1,
      gravity: -10.0, damping: 0.97, iters: 22,
      stiffStruct: 1.0, stiffShear: 0.75, stiffBend: 0.35,
      wind: -0.12, groundY: -7.0, thickness: 0.30, maxStretch: 1.5
    };
    this.rebuildWithParams(defaults);
    this.syncConsoleInputs();
  }

  // I3: 参数预设管理
  getPresets() {
    try {
      return JSON.parse(localStorage.getItem('presets') || '[]');
    } catch (e) {
      return [];
    }
  }

  savePreset(name) {
    const presets = this.getPresets();
    // 同名覆盖
    const idx = presets.findIndex(p => p.name === name);
    const entry = { name, params: { ...this.params } };
    if (idx >= 0) presets[idx] = entry;
    else presets.push(entry);
    localStorage.setItem('presets', JSON.stringify(presets));
    this.renderPresetList();
    this.showToast(`预设「${name}」已保存`, 'success');
    this.playSound('reset');
  }

  loadPreset(name) {
    const presets = this.getPresets();
    const preset = presets.find(p => p.name === name);
    if (!preset) return;
    this.rebuildWithParams(preset.params);
    this.syncConsoleInputs();
    this.showToast(`已加载预设「${name}」`, 'info');
    this.playSound('reset');
  }

  deletePreset(name) {
    let presets = this.getPresets();
    presets = presets.filter(p => p.name !== name);
    localStorage.setItem('presets', JSON.stringify(presets));
    this.renderPresetList();
    this.showToast(`已删除预设「${name}」`, 'warn');
  }

  renderPresetList() {
    if (!this.presetListEl) return;
    const presets = this.getPresets();
    this.presetListEl.innerHTML = '';
    if (presets.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size: 11px; color: #8A8478; text-align: center; padding: 8px 0;';
      empty.textContent = '尚无自定义预设';
      this.presetListEl.appendChild(empty);
      return;
    }
    presets.forEach(preset => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: 11px;';
      const loadBtn = document.createElement('button');
      loadBtn.textContent = preset.name;
      loadBtn.title = '点击加载';
      loadBtn.style.cssText = `
        flex: 1; padding: 4px 8px; font-size: 11px; color: #4A4640;
        background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.06);
        border-radius: 4px; cursor: pointer; text-align: left;
        font-family: 'Courier New', monospace; transition: all 0.2s;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      `;
      loadBtn.onmouseover = () => { loadBtn.style.background = 'rgba(26,26,42,0.1)'; };
      loadBtn.onmouseout = () => { loadBtn.style.background = 'rgba(0,0,0,0.04)'; };
      loadBtn.onclick = () => this.loadPreset(preset.name);
      row.appendChild(loadBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.title = '删除';
      delBtn.style.cssText = `
        padding: 4px 7px; font-size: 11px; color: #E74C3C;
        background: rgba(231,76,60,0.08); border: 1px solid rgba(231,76,60,0.15);
        border-radius: 4px; cursor: pointer; transition: all 0.2s;
        font-family: 'Courier New', monospace;
      `;
      delBtn.onmouseover = () => { delBtn.style.background = 'rgba(231,76,60,0.2)'; };
      delBtn.onmouseout = () => { delBtn.style.background = 'rgba(231,76,60,0.08)'; };
      delBtn.onclick = () => this.deletePreset(preset.name);
      row.appendChild(delBtn);

      this.presetListEl.appendChild(row);
    });
  }

  // J2: Toast 通知系统
  showToast(message, type = 'info') {
    const colors = {
      info: { bg: 'rgba(26,26,42,0.92)', accent: '#8A8478' },
      success: { bg: 'rgba(39,174,96,0.92)', accent: '#FFF' },
      warn: { bg: 'rgba(232,168,56,0.95)', accent: '#1A1A2A' },
      error: { bg: 'rgba(231,76,60,0.95)', accent: '#FFF' }
    };
    const c = colors[type] || colors.info;
    // 最多同时 3 条
    const existing = document.querySelectorAll('.app-toast');
    if (existing.length >= 3) existing[0].remove();

    const toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.style.cssText = `
      position: fixed; bottom: 80px; right: 20px; z-index: 300;
      background: ${c.bg}; color: ${c.accent};
      padding: 10px 18px; border-radius: 8px; font-size: 13px;
      font-family: 'Courier New', monospace; max-width: 280px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      transform: translateX(120%); transition: transform 0.3s ease;
      backdrop-filter: blur(8px);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    // 滑入
    requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
    // 2 秒后滑出移除
    setTimeout(() => {
      toast.style.transform = 'translateX(120%)';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  createPipelineDiagram() {
    this.pipelinePanel = document.createElement('div');
    this.pipelinePanel.id = 'pipelinePanel';
    this.pipelinePanel.style.cssText = `
      position: fixed; top: 50%; right: 20px; transform: translateY(-50%) translateX(120%);
      background: rgba(255,253,248,0.95); padding: 20px; border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.1); backdrop-filter: blur(12px);
      border: 1px solid rgba(0,0,0,0.05); width: 220px;
      transition: transform 0.4s ease; z-index: 90;
      font-family: 'Courier New', monospace;
    `;

    const stages = [
      { order: 0, name: '几何阶段', icon: '◢', color: '#4A90D9' },
      { order: 1, name: '变换阶段', icon: '⊕', color: '#50C878' },
      { order: 2, name: '光栅化阶段', icon: '■', color: '#E8A838' },
      { order: 3, name: '纹理阶段', icon: '◇', color: '#9B59B6' },
      { order: 5, name: '输出阶段', icon: '▤', color: '#E74C3C' }
    ];

    const title = document.createElement('div');
    title.textContent = '渲染管线流程';
    title.style.cssText = `font-size: 14px; font-weight: 600; color: #1A1A2A; margin-bottom: 16px; text-align: center;`;
    this.pipelinePanel.appendChild(title);

    const flow = document.createElement('div');
    flow.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

    stages.forEach((stage, i) => {
      const node = document.createElement('div');
      node.dataset.stageOrder = stage.order;
      node.className = 'pipeline-node';
      node.style.cssText = `
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px; border-radius: 8px;
        background: rgba(0,0,0,0.03); transition: all 0.3s;
      `;
      node.innerHTML = `
        <span style="font-size: 18px; color: ${stage.color};">${stage.icon}</span>
        <span style="font-size: 12px; color: #4A4640;">${stage.name}</span>
      `;
      flow.appendChild(node);

      if (i < stages.length - 1) {
        const arrow = document.createElement('div');
        arrow.textContent = '↓';
        arrow.style.cssText = 'text-align: center; color: #8A8478; font-size: 12px;';
        flow.appendChild(arrow);
      }
    });

    this.pipelinePanel.appendChild(flow);

    // F1: 数据流动画播放按钮
    const playBtn = document.createElement('button');
    playBtn.innerHTML = '▶ 播放数据流';
    playBtn.style.cssText = `
      width: 100%; margin-top: 14px; padding: 8px;
      font-size: 12px; color: #fff; background: #4A90D9;
      border: none; border-radius: 6px; cursor: pointer;
      transition: all 0.2s; font-family: inherit;
    `;
    playBtn.onmouseover = () => { playBtn.style.background = '#3A7DC9'; };
    playBtn.onmouseout = () => { playBtn.style.background = '#4A90D9'; };
    playBtn.onclick = () => this.playPipelineAnimation();
    this.pipelinePanel.appendChild(playBtn);

    document.body.appendChild(this.pipelinePanel);

    const self2 = this;
    const pipelineCollapseBtn = document.createElement('button');
    pipelineCollapseBtn.innerHTML = '▶';
    pipelineCollapseBtn.style.cssText = `
      position: absolute; left: 12px; top: 18px;
      width: 24px; height: 24px; font-size: 11px; color: #8A8478;
      background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.06);
      border-radius: 6px; cursor: pointer; transition: all 0.2s;
      font-family: 'Courier New', monospace;
      display: flex; align-items: center; justify-content: center;
    `;
    pipelineCollapseBtn.onmouseover = () => { pipelineCollapseBtn.style.background = 'rgba(0,0,0,0.08)'; };
    pipelineCollapseBtn.onmouseout = () => { pipelineCollapseBtn.style.background = 'rgba(0,0,0,0.04)'; };
    pipelineCollapseBtn.onclick = () => self2.togglePipeline();
    this.pipelinePanel.appendChild(pipelineCollapseBtn);
  }

  // F1: 管线数据流动画
  playPipelineAnimation() {
    if (this.pipelineAnim) return;
    this.pipelineAnim = true;
    const stageOrders = [0, 1, 2, 3, 5];
    let idx = 0;

    const showStage = () => {
      if (idx >= stageOrders.length) {
        this.pipelineAnim = false;
        this.highlightPipelineStage(-1);
        this.hideProductCard();
        return;
      }
      const order = stageOrders[idx];
      this.highlightPipelineStage(order);
      // 同步显示该阶段的第一个商品卡片
      const product = products.find(p => p.stageOrder === order);
      if (product) this.showProductCard(product);
      idx++;
      this.pipelineAnimTimer = setTimeout(showStage, 1000);
    };
    showStage();
  }

  // F2: 知识体系总览页
  toggleKnowledgeBase() {
    if (this.kbOverlay) {
      this.kbOverlay.remove();
      this.kbOverlay = null;
      return;
    }
    this.createKnowledgeBase();
  }

  createKnowledgeBase() {
    this.kbOverlay = document.createElement('div');
    this.kbOverlay.id = 'kbOverlay';
    this.kbOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(245,242,236,0.97); z-index: 200;
      overflow-y: auto; padding: 40px 20px;
      font-family: 'Courier New', monospace;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `max-width: 900px; margin: 0 auto;`;

    const header = document.createElement('div');
    header.style.cssText = `display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;`;
    header.innerHTML = `
      <div>
        <h2 style="margin: 0; font-size: 22px; color: #1A1A2A;">📖 渲染管线知识库</h2>
        <p style="margin: 4px 0 0; font-size: 12px; color: #8A8478;">共 ${products.length} 个核心概念 · 点击查看详情</p>
      </div>
      <button id="kbClose" style="
        padding: 8px 16px; font-size: 14px; color: #4A4640;
        background: rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.08);
        border-radius: 8px; cursor: pointer; font-family: inherit;
      ">✕ 关闭</button>
    `;
    inner.appendChild(header);

    // 按阶段分组
    const stageGroups = [
      { order: 0, name: '几何阶段', icon: '◢', color: '#4A90D9', desc: '顶点数据处理' },
      { order: 1, name: '变换阶段', icon: '⊕', color: '#50C878', desc: '坐标空间转换' },
      { order: 2, name: '光栅化阶段', icon: '■', color: '#E8A838', desc: '图元转像素' },
      { order: 3, name: '纹理阶段', icon: '◇', color: '#9B59B6', desc: '纹理采样与处理' },
      { order: 5, name: '输出阶段', icon: '▤', color: '#E74C3C', desc: '帧缓冲与显示' }
    ];

    stageGroups.forEach(group => {
      const groupProducts = products.filter(p => p.stageOrder === group.order);
      if (groupProducts.length === 0) return;

      const groupEl = document.createElement('div');
      groupEl.style.cssText = `margin-bottom: 28px;`;
      groupEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid ${group.color}33;">
          <span style="font-size: 22px; color: ${group.color};">${group.icon}</span>
          <h3 style="margin: 0; font-size: 16px; color: #1A1A2A;">${group.name}</h3>
          <span style="font-size: 11px; color: #8A8478; margin-left: 8px;">${group.desc} · ${groupProducts.length} 项</span>
        </div>
      `;

      const grid = document.createElement('div');
      grid.style.cssText = `display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;`;

      groupProducts.forEach(product => {
        const card = document.createElement('div');
        const learned = this.learnedIds && this.learnedIds.has(product.id);
        card.style.cssText = `
          background: rgba(255,255,255,0.6); padding: 12px; border-radius: 8px;
          border: 1px solid rgba(0,0,0,0.04); cursor: pointer; transition: all 0.2s;
          ${learned ? 'border-left: 3px solid #50C878;' : ''}
        `;
        card.onmouseover = () => { card.style.background = 'rgba(255,255,255,0.95)'; card.style.transform = 'translateY(-2px)'; };
        card.onmouseout = () => { card.style.background = 'rgba(255,255,255,0.6)'; card.style.transform = 'translateY(0)'; };
        card.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 18px; color: ${group.color};">${product.icon}</span>
            <span style="font-size: 13px; color: #1A1A2A; font-weight: 600;">${product.name}</span>
            ${learned ? '<span style="color: #50C878; font-size: 12px;">✓</span>' : ''}
          </div>
          <div style="font-size: 11px; color: #8A8478;">${'★'.repeat(product.depth)}${'☆'.repeat(5 - product.depth)}</div>
        `;
        card.onclick = () => {
          this.toggleKnowledgeBase();
          this.showProductCard(product);
        };
        grid.appendChild(card);
      });

      groupEl.appendChild(grid);
      inner.appendChild(groupEl);
    });

    this.kbOverlay.appendChild(inner);
    this.kbOverlay.querySelector('#kbClose').onclick = () => this.toggleKnowledgeBase();
    document.body.appendChild(this.kbOverlay);
  }

  // G4: 主题切换
  switchTheme() {
    this.themeIdx = (this.themeIdx + 1) % this.themes.length;
    localStorage.setItem('theme', this.themeIdx.toString());
    this.applyTheme();
    this.playSound('reset');
    this.showToast(`已切换至「${this.themes[this.themeIdx].name}」主题`, 'info');
  }

  applyTheme() {
    const theme = this.themes[this.themeIdx];
    document.body.classList.remove('theme-warm', 'theme-cool', 'theme-vintage');
    document.body.classList.add(theme.cls);
    if (this.renderer) {
      this.renderer.applyTheme(theme);
    }
    const themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.innerHTML = `🎨 ${theme.name}`;
  }

  // F4: 学习进度显示
  updateLearnedProgress() {
    const count = this.learnedIds.size;
    const total = products.length;
    const pct = Math.round((count / total) * 100);
    const progressText = document.getElementById('progressText');
    const progressBarFill = document.getElementById('progressBarFill');
    if (progressText) {
      progressText.innerHTML = `<span>📚 已学</span><span style="color: #50C878; font-weight: 600;">${pct}%</span>`;
    }
    if (progressBarFill) {
      progressBarFill.style.width = pct + '%';
    }
  }

  togglePipeline() {
    if (this.pipelinePanel.style.transform.includes('translateX(120%)')) {
      this.pipelinePanel.style.transform = 'translateY(-50%) translateX(0)';
    } else {
      this.pipelinePanel.style.transform = 'translateY(-50%) translateX(120%)';
    }
  }

  highlightPipelineStage(stageOrder) {
    document.querySelectorAll('.pipeline-node').forEach(node => {
      if (parseInt(node.dataset.stageOrder) === stageOrder) {
        node.style.background = 'rgba(26,26,42,0.12)';
        node.style.transform = 'scale(1.05)';
        node.style.boxShadow = '0 0 16px rgba(26,26,42,0.15)';
      } else {
        node.style.background = 'rgba(0,0,0,0.03)';
        node.style.transform = 'scale(1)';
        node.style.boxShadow = 'none';
      }
    });
  }

  createProductCard() {
    this.productCard = document.createElement('div');
    this.productCard.id = 'productCard';
    this.productCard.style.cssText = `
      position: fixed; bottom: 80px; left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: rgba(255,253,248,0.97); padding: 20px 24px; border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.1); backdrop-filter: blur(12px);
      border: 1px solid rgba(0,0,0,0.05); max-width: 420px; width: 90vw;
      opacity: 0; transition: all 0.3s ease; pointer-events: none; z-index: 100;
      max-height: 80vh; overflow-y: auto;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
      position: absolute; top: 8px; right: 8px;
      width: 36px; height: 36px; border: none;
      background: rgba(0,0,0,0.05); border-radius: 50%;
      cursor: pointer; font-size: 16px; color: #8A8478; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center;
      z-index: 10;
    `;
    closeBtn.onmouseover = () => { closeBtn.style.background = 'rgba(231,76,60,0.12)'; closeBtn.style.color = '#E74C3C'; closeBtn.style.transform = 'scale(1.1)'; };
    closeBtn.onmouseout = () => { closeBtn.style.background = 'rgba(0,0,0,0.05)'; closeBtn.style.color = '#8A8478'; closeBtn.style.transform = 'scale(1)'; };
    closeBtn.onclick = (e) => { e.stopPropagation(); this.hideProductCard(); };
    closeBtn.onmousedown = (e) => { e.stopPropagation(); };
    this.productCard.appendChild(closeBtn);

    this.productCardContent = document.createElement('div');
    this.productCardContent.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
        <span id="productIcon" style="font-size: 28px; color: #1A1A2A;"></span>
        <div>
          <h3 id="productName" style="margin: 0; font-size: 16px; color: #1A1A2A; font-weight: 600;"></h3>
          <p id="productStage" style="margin: 2px 0 0; font-size: 12px; color: #8A8478; font-family: 'Courier New', monospace;"></p>
        </div>
        <div id="productDepth" style="margin-left: auto; font-size: 14px; color: #E8A838;"></div>
      </div>
      <p id="productDesc" style="font-size: 13px; line-height: 1.6; color: #4A4640; margin-bottom: 12px;"></p>
      <div style="margin-bottom: 12px;">
        <div style="font-size: 11px; color: #8A8478; margin-bottom: 4px; font-family: monospace;">管线位置</div>
        <div style="height: 6px; background: rgba(0,0,0,0.06); border-radius: 3px; overflow: hidden;">
          <div id="pipelineBar" style="height: 100%; border-radius: 3px; transition: width 0.3s;"></div>
        </div>
      </div>
      <div id="productParams" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;"></div>
      <div id="productCodeSection" style="margin-bottom: 12px; display: none;">
        <div style="font-size: 11px; color: #8A8478; margin-bottom: 4px; font-family: monospace; display: flex; justify-content: space-between; align-items: center;">
          <span>代码示例</span>
          <span id="codeToggle" style="cursor: pointer; color: #4A90D9;">▾</span>
        </div>
        <pre id="productCode" style="background: #1A1A2A; color: #E8E3D6; padding: 10px 12px; border-radius: 6px; font-size: 11px; line-height: 1.5; overflow-x: auto; font-family: 'Courier New', monospace; margin: 0; max-height: 200px; overflow-y: auto;"></pre>
      </div>
      <div id="productRelatedSection" style="display: none;">
        <div style="font-size: 11px; color: #8A8478; margin-bottom: 4px; font-family: monospace;">相关概念</div>
        <div id="productRelated" style="display: flex; flex-wrap: wrap; gap: 6px;"></div>
      </div>
    `;
    this.productCard.appendChild(this.productCardContent);
    document.body.appendChild(this.productCard);

    // 代码折叠切换
    setTimeout(() => {
      const codeToggle = document.getElementById('codeToggle');
      if (codeToggle) {
        codeToggle.onclick = () => {
          const code = document.getElementById('productCode');
          if (code.style.display === 'none') {
            code.style.display = 'block';
            codeToggle.textContent = '▾';
          } else {
            code.style.display = 'none';
            codeToggle.textContent = '▸';
          }
        };
      }
    }, 100);
  }

  // F3: 代码语法高亮
  highlightCode(code) {
    // 先转义 HTML 特殊字符
    let html = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // 注释（行内 // ...）
    html = html.replace(/(\/\/[^\n]*)/g, '<span style="color:#7C7C8C;">$1</span>');
    // 字符串
    html = html.replace(/('[^']*'|"[^"]*")/g, '<span style="color:#9B59B6;">$1</span>');
    // 关键字
    html = html.replace(/\b(gl_|vec[2-4]|mat[2-4]|float|int|void|uniform|attribute|varying|const|return|if|else|for|while|layout|in|out|precision|mediump|highp|bool)\b/g, '<span style="color:#4A90D9;">$1</span>');
    // 数字
    html = html.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#E8A838;">$1</span>');
    return html;
  }

  showProductCard(product) {
    if (!product) return;

    // F4: 记录学习进度
    if (!this.learnedIds.has(product.id)) {
      this.learnedIds.add(product.id);
      localStorage.setItem('learned', JSON.stringify([...this.learnedIds]));
      this.updateLearnedProgress();
    }

    document.getElementById('productIcon').textContent = product.icon;
    document.getElementById('productName').textContent = `${product.name} (${product.nameEn})`;
    document.getElementById('productStage').textContent = `渲染管线阶段: ${product.stage}`;

    const depthEl = document.getElementById('productDepth');
    depthEl.textContent = '★'.repeat(product.depth) + '☆'.repeat(5 - product.depth);

    document.getElementById('productDesc').textContent = product.description;

    const bar = document.getElementById('pipelineBar');
    const pct = ((product.stageOrder + 1) / 6) * 100;
    bar.style.width = `${pct}%`;
    const colors = ['#4A90D9', '#50C878', '#E8A838', '#9B59B6', '#9B59B6', '#E74C3C'];
    bar.style.background = colors[product.stageOrder] || '#8A8478';

    const paramsContainer = document.getElementById('productParams');
    paramsContainer.innerHTML = '';
    product.params.forEach(param => {
      const badge = document.createElement('span');
      badge.textContent = param;
      badge.style.cssText = `
        background: rgba(26,26,42,0.06); color: #1A1A2A;
        padding: 3px 8px; border-radius: 4px; font-size: 11px; font-family: monospace;
      `;
      paramsContainer.appendChild(badge);
    });

    // A2: 代码示例
    const codeSection = document.getElementById('productCodeSection');
    const codeEl = document.getElementById('productCode');
    if (product.codeExample) {
      codeEl.innerHTML = this.highlightCode(product.codeExample);
      codeEl.style.display = 'block';
      codeSection.style.display = 'block';
      const codeToggle = document.getElementById('codeToggle');
      if (codeToggle) codeToggle.textContent = '▾';
    } else {
      codeSection.style.display = 'none';
    }

    // A2: 相关概念
    const relatedSection = document.getElementById('productRelatedSection');
    const relatedContainer = document.getElementById('productRelated');
    if (product.related && product.related.length > 0) {
      relatedContainer.innerHTML = '';
      product.related.forEach(rid => {
        const related = products.find(p => p.id === rid);
        if (!related) return;
        const badge = document.createElement('span');
        badge.textContent = `${related.icon} ${related.name}`;
        badge.style.cssText = `
          background: rgba(74,144,217,0.1); color: #4A90D9;
          padding: 3px 8px; border-radius: 4px; font-size: 11px;
          font-family: monospace; cursor: pointer; transition: all 0.2s;
        `;
        badge.onmouseover = () => { badge.style.background = 'rgba(74,144,217,0.2)'; };
        badge.onmouseout = () => { badge.style.background = 'rgba(74,144,217,0.1)'; };
        badge.onclick = () => this.showProductCard(related);
        relatedContainer.appendChild(badge);
      });
      relatedSection.style.display = 'block';
    } else {
      relatedSection.style.display = 'none';
    }

    this.productCard.style.opacity = '1';
    this.productCard.style.transform = 'translateX(-50%) translateY(0)';
    this.productCard.style.pointerEvents = 'auto';

    this.highlightPipelineStage(product.stageOrder);
  }

  hideProductCard() {
    this.productCard.style.opacity = '0';
    this.productCard.style.transform = 'translateX(-50%) translateY(100px)';
    this.productCard.style.pointerEvents = 'none';
    this.highlightPipelineStage(-1);
  }

  onProductClick(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
      if (navigator.vibrate) navigator.vibrate(15);
      this.showProductCard(product);
    }
  }

  // A1: 学习导览模式
  startLearningTour() {
    if (this.tourActive) {
      this.endTour();
      return;
    }
    this.tourActive = true;
    this.tourStep = 0;
    // 按管线阶段排序生成导览序列
    this.tourSequence = [...products].sort((a, b) => {
      if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder;
      return b.depth - a.depth;
    });

    this.createTourOverlay();
    this.tourShowStep();
    this.playSound('reset');
  }

  createTourOverlay() {
    this.tourOverlay = document.createElement('div');
    this.tourOverlay.id = 'tourOverlay';
    this.tourOverlay.style.cssText = `
      position: fixed; bottom: 0; left: 0; width: 100%;
      background: rgba(26,26,42,0.94); color: #F8F5EE;
      padding: 0; z-index: 150;
      font-family: 'Courier New', monospace;
      box-shadow: 0 -4px 30px rgba(0,0,0,0.25);
      backdrop-filter: blur(16px);
      transform: translateY(100%);
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    this.tourOverlay.innerHTML = `
      <div style="height: 3px; background: rgba(255,255,255,0.08); position: relative;">
        <div id="tourProgressBar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #4A90D9, #50C878); transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);"></div>
      </div>
      <div style="padding: 14px 24px 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
        <div style="flex: 1; min-width: 0;">
          <div id="tourStepInfo" style="font-size: 11px; color: #8A8478; margin-bottom: 4px; letter-spacing: 0.5px;"></div>
          <div id="tourProductName" style="font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
          <div id="tourProductDesc" style="font-size: 12px; color: #C8C4B8; margin-top: 3px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;"></div>
        </div>
        <div style="display: flex; gap: 8px; flex-shrink: 0; align-items: center;">
          <button id="tourPrev" style="padding: 8px 14px; background: rgba(255,255,255,0.08); color: #F8F5EE; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 12px; transition: all 0.2s;">← 上一步</button>
          <button id="tourNext" style="padding: 8px 16px; background: linear-gradient(135deg, #4A90D9, #50C878); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; transition: all 0.2s; box-shadow: 0 2px 12px rgba(74,144,217,0.3);">下一步 →</button>
          <button id="tourExit" style="padding: 8px 14px; background: rgba(231,76,60,0.15); color: #F8F5EE; border: 1px solid rgba(231,76,60,0.3); border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 12px; transition: all 0.2s;">跳过</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.tourOverlay);

    const prevBtn = document.getElementById('tourPrev');
    const nextBtn = document.getElementById('tourNext');
    const exitBtn = document.getElementById('tourExit');

    prevBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.15)'; };
    prevBtn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.08)'; };
    nextBtn.onmouseover = function() { this.style.transform = 'translateY(-1px)'; this.style.boxShadow = '0 4px 16px rgba(74,144,217,0.4)'; };
    nextBtn.onmouseout = function() { this.style.transform = 'translateY(0)'; this.style.boxShadow = '0 2px 12px rgba(74,144,217,0.3)'; };
    exitBtn.onmouseover = function() { this.style.background = 'rgba(231,76,60,0.25)'; };
    exitBtn.onmouseout = function() { this.style.background = 'rgba(231,76,60,0.15)'; };

    prevBtn.onclick = () => this.tourPrev();
    nextBtn.onclick = () => this.tourNext();
    exitBtn.onclick = () => this.endTour();

    requestAnimationFrame(() => {
      this.tourOverlay.style.transform = 'translateY(0)';
    });
  }

  tourShowStep() {
    if (!this.tourSequence || this.tourStep >= this.tourSequence.length) {
      this.endTour();
      this.showQuiz();
      return;
    }
    const product = this.tourSequence[this.tourStep];
    document.getElementById('tourStepInfo').textContent =
      `第 ${this.tourStep + 1} / ${this.tourSequence.length} 步 · ${product.stage}`;
    document.getElementById('tourProductName').textContent = `${product.icon} ${product.name}`;
    document.getElementById('tourProductDesc').textContent = product.description;

    const progressBar = document.getElementById('tourProgressBar');
    if (progressBar) {
      const pct = ((this.tourStep + 1) / this.tourSequence.length) * 100;
      progressBar.style.width = pct + '%';
    }

    const prevBtn = document.getElementById('tourPrev');
    if (prevBtn) {
      prevBtn.style.opacity = this.tourStep === 0 ? '0.4' : '1';
      prevBtn.style.pointerEvents = this.tourStep === 0 ? 'none' : 'auto';
    }

    const nextBtn = document.getElementById('tourNext');
    if (nextBtn) {
      nextBtn.textContent = this.tourStep === this.tourSequence.length - 1 ? '开始测验 🎯' : '下一步 →';
    }

    // 高亮管线阶段
    this.highlightPipelineStage(product.stageOrder);
    // 显示商品详情卡片
    this.showProductCard(product);

    // 相机飞向商品位置（根据 stageOrder 估算 y 坐标）
    if (this.renderer && this.renderer.camera) {
      const cam = this.renderer.getCamera();
      const targetY = this.params.clothH / 2 - (this.tourStep / this.tourSequence.length) * this.params.clothH;
      const camY = targetY - 1;
      // 平滑过渡
      this.tourCamTarget = { y: camY };
    }
  }

  tourNext() {
    this.tourStep++;
    if (this.tourStep >= this.tourSequence.length) {
      this.endTour();
      this.showQuiz();
    } else {
      this.tourShowStep();
      this.playSound('reset');
    }
  }

  tourPrev() {
    if (this.tourStep > 0) {
      this.tourStep--;
      this.tourShowStep();
      this.playSound('reset');
    }
  }

  endTour() {
    this.tourActive = false;
    if (this.tourOverlay && this.tourOverlay.parentNode) {
      this.tourOverlay.style.transform = 'translateY(100%)';
      setTimeout(() => {
        if (this.tourOverlay && this.tourOverlay.parentNode) {
          this.tourOverlay.remove();
        }
        this.tourOverlay = null;
      }, 400);
    }
    this.hideProductCard();
  }

  // A3: 互动知识测验
  showQuiz() {
    this.quizStep = 0;
    this.quizScore = 0;
    // I2: 从 15 题中随机抽取 5 题
    const shuffled = [...quizQuestions].sort(() => Math.random() - 0.5);
    this.quizSelected = shuffled.slice(0, 5);
    this.createQuizOverlay();
    this.quizShowQuestion();
  }

  createQuizOverlay() {
    this.quizOverlay = document.createElement('div');
    this.quizOverlay.id = 'quizOverlay';
    this.quizOverlay.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(255,253,248,0.98); padding: 28px 36px; border-radius: 16px;
      box-shadow: 0 12px 60px rgba(0,0,0,0.15); backdrop-filter: blur(16px);
      border: 1px solid rgba(0,0,0,0.05); max-width: 480px; width: 90vw;
      z-index: 200; font-family: 'Courier New', monospace;
    `;
    document.body.appendChild(this.quizOverlay);
  }

  quizShowQuestion() {
    if (this.quizStep >= this.quizSelected.length) {
      this.quizShowResult();
      return;
    }
    const q = this.quizSelected[this.quizStep];
    const diffLabel = { easy: '入门', medium: '进阶', hard: '专家' }[q.difficulty] || '';
    const diffColor = { easy: '#50C878', medium: '#E8A838', hard: '#E74C3C' }[q.difficulty] || '#8A8478';
    this.quizOverlay.innerHTML = `
      <div style="font-size: 12px; color: #8A8478; margin-bottom: 8px; display: flex; justify-content: space-between;">
        <span>渲染管线小测验 · 第 ${this.quizStep + 1} / ${this.quizSelected.length} 题</span>
        <span style="color: ${diffColor};">[${diffLabel}]</span>
      </div>
      <h3 style="font-size: 16px; color: #1A1A2A; margin: 0 0 16px;">${q.question}</h3>
      <div id="quizOptions" style="display: flex; flex-direction: column; gap: 8px;"></div>
      <div id="quizFeedback" style="margin-top: 12px; font-size: 12px; color: #4A4640; line-height: 1.5; min-height: 36px;"></div>
    `;
    const optionsContainer = document.getElementById('quizOptions');
    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.textContent = opt;
      btn.style.cssText = `
        padding: 10px 16px; text-align: left; font-size: 13px; color: #4A4640;
        background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.06);
        border-radius: 8px; cursor: pointer; transition: all 0.2s;
        font-family: inherit;
      `;
      btn.onmouseover = () => { btn.style.background = 'rgba(26,26,42,0.08)'; };
      btn.onmouseout = () => { btn.style.background = 'rgba(0,0,0,0.03)'; };
      btn.onclick = () => this.quizAnswer(i);
      optionsContainer.appendChild(btn);
    });
  }

  quizAnswer(index) {
    const q = this.quizSelected[this.quizStep];
    const buttons = document.querySelectorAll('#quizOptions button');
    buttons.forEach((btn, i) => {
      btn.style.pointerEvents = 'none';
      if (i === q.correct) {
        btn.style.background = 'rgba(80,200,120,0.2)';
        btn.style.borderColor = '#50C878';
      } else if (i === index) {
        btn.style.background = 'rgba(231,76,60,0.15)';
        btn.style.borderColor = '#E74C3C';
      }
    });
    const feedback = document.getElementById('quizFeedback');
    if (index === q.correct) {
      this.quizScore++;
      feedback.innerHTML = `<span style="color: #50C878;">✓ 正确！</span> ${q.explain}`;
    } else {
      feedback.innerHTML = `<span style="color: #E74C3C;">✗ 答错了。</span> ${q.explain}`;
    }
    setTimeout(() => {
      this.quizStep++;
      this.quizShowQuestion();
    }, 2000);
  }

  quizShowResult() {
    const total = this.quizSelected.length;
    const pct = Math.round((this.quizScore / total) * 100);
    let msg = '';
    if (pct === 100) msg = '🏆 满分！你是渲染管线专家！';
    else if (pct >= 60) msg = '🎉 不错的成绩，继续加油！';
    else msg = '📚 再回去看看小票上的商品吧～';

    this.quizOverlay.innerHTML = `
      <div style="text-align: center; padding: 12px;">
        <div style="font-size: 48px; margin-bottom: 12px;">${pct === 100 ? '🏆' : pct >= 60 ? '🎉' : '📚'}</div>
        <h3 style="font-size: 20px; color: #1A1A2A; margin: 0 0 8px;">测验完成</h3>
        <div style="font-size: 32px; color: #4A90D9; font-weight: 600; margin: 12px 0;">
          ${this.quizScore} / ${total}
        </div>
        <p style="font-size: 14px; color: #4A4640; margin-bottom: 20px;">${msg}</p>
        <button id="quizClose" style="
          padding: 10px 28px; font-size: 14px; color: #fff;
          background: #1A1A2A; border: none; border-radius: 8px;
          cursor: pointer; font-family: inherit;
        ">关闭</button>
      </div>
    `;
    document.getElementById('quizClose').onclick = () => {
      if (this.quizOverlay && this.quizOverlay.parentNode) {
        this.quizOverlay.remove();
      }
      this.quizOverlay = null;
    };
    this.playSound('reset');
  }

  // E1: 截图功能
  takeScreenshot() {
    if (!this.renderer) return;
    const renderer = this.renderer.getRenderer();
    const dataURL = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `3d-receipt-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    this.playSound('reset');
    this.showToast('截图已下载', 'success');
  }

  // 自定义图片上传：打开图片编辑面板
  uploadImage() {
    this.createImageEditorPanel();
    this.openImageEditor();
  }

  createImageEditorPanel() {
    if (this.imageEditorPanel) return;

    this.imageEditorPanel = document.createElement('div');
    this.imageEditorPanel.id = 'imageEditorPanel';
    this.imageEditorPanel.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(26,26,42,0.6); z-index: 250;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
      backdrop-filter: blur(4px);
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: rgba(255,253,248,0.98); border-radius: 16px;
      padding: 24px 28px; max-width: 900px; width: 92vw;
      box-shadow: 0 16px 60px rgba(0,0,0,0.2);
      font-family: 'Courier New', monospace; position: relative;
      max-height: 85vh;
    `;
    card.className = 'image-editor-card';
    const hideScrollbarStyle = document.createElement('style');
    hideScrollbarStyle.textContent = `
      .image-editor-card::-webkit-scrollbar { display: none; }
      .image-editor-card { -ms-overflow-style: none; scrollbar-width: none; }
      #imgPreviewContainer { cursor: crosshair; }
      .img-editor-body { display: flex; gap: 24px; align-items: flex-start; }
      .img-editor-preview { flex: 1; min-width: 0; }
      .img-editor-controls { width: 280px; flex-shrink: 0; max-height: 75vh; overflow-y: auto; padding-right: 4px; }
      .img-editor-controls::-webkit-scrollbar { width: 4px; }
      .img-editor-controls::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 2px; }
    `;
    document.head.appendChild(hideScrollbarStyle);
    card.innerHTML = `
      <div style="position: absolute; top: 12px; right: 16px; cursor: pointer;
                  font-size: 22px; color: #8A8478; user-select: none;
                  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
                  border-radius: 50%; transition: all 0.2s; z-index: 10;" 
           id="imgEditorCloseBtn"
           onmouseover="this.style.background='rgba(231,76,60,0.12)'; this.style.color='#E74C3C'; this.style.transform='scale(1.1)';"
           onmouseout="this.style.background='transparent'; this.style.color='#8A8478'; this.style.transform='scale(1)';">✕</div>
      <h3 style="font-size: 18px; color: #1A1A2A; margin: 0 0 20px;">🖼 自定义图片编辑</h3>

      <div class="img-editor-body">
        <div class="img-editor-preview">
          <div style="font-size: 12px; color: #8A8478; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>👀 实时预览</span>
            <span style="font-size: 10px; color: #4A90D9;">点击预览图可快速定位</span>
          </div>
          <div id="imgPreviewContainer" style="
            background: linear-gradient(135deg, #f6f1e3 0%, #ece5d5 100%);
            border-radius: 12px; padding: 16px;
            border: 1px solid rgba(0,0,0,0.08); text-align: center;
            height: 440px; display: flex; align-items: center; justify-content: center;
            box-shadow: inset 0 2px 8px rgba(0,0,0,0.06);
          ">
            <canvas id="imgPreviewCanvas" style="
              max-width: 100%; max-height: 100%; border-radius: 6px;
              image-rendering: auto; box-shadow: 0 2px 12px rgba(0,0,0,0.12);
            "></canvas>
          </div>
        </div>

        <div class="img-editor-controls">
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: #8A8478; margin-bottom: 8px;">图片上传</div>
            <button id="imgUploadBtn" style="
              width: 100%; padding: 12px; font-size: 13px; color: #fff;
              background: #4A90D9; border: none; border-radius: 8px;
              cursor: pointer; font-family: inherit; transition: background 0.2s;
            ">📁 选择图片</button>
            <input type="file" id="imgFileInput" accept="image/*" style="display: none;">
          </div>

          <div id="imgEditorControls" style="display: none;">
            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #8A8478; margin-bottom: 4px;">
                <span>📍 水平位置 (X)</span>
                <span id="imgXVal">50%</span>
              </div>
              <input type="range" id="imgXSlider" min="0" max="100" value="50" step="1"
                style="width: 100%; accent-color: #4A90D9;">
            </div>

            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #8A8478; margin-bottom: 4px;">
                <span>📍 垂直位置 (Y)</span>
                <span id="imgYVal">15%</span>
              </div>
              <input type="range" id="imgYSlider" min="0" max="100" value="15" step="1"
                style="width: 100%; accent-color: #4A90D9;">
            </div>

            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #8A8478; margin-bottom: 4px;">
                <span>📐 大小</span>
                <span id="imgScaleVal">30%</span>
              </div>
              <input type="range" id="imgScaleSlider" min="5" max="100" value="30" step="1"
                style="width: 100%; accent-color: #4A90D9;">
            </div>

            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #8A8478; margin-bottom: 4px;">
                <span>🔄 旋转</span>
                <span id="imgRotVal">0°</span>
              </div>
              <input type="range" id="imgRotSlider" min="-180" max="180" value="0" step="1"
                style="width: 100%; accent-color: #4A90D9;">
            </div>

            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #8A8478; margin-bottom: 4px;">
                <span>💧 透明度</span>
                <span id="imgOpacityVal">100%</span>
              </div>
              <input type="range" id="imgOpacitySlider" min="10" max="100" value="100" step="5"
                style="width: 100%; accent-color: #4A90D9;">
            </div>

            <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 8px;">
              <button id="imgApplyBtn" style="
                width: 100%; padding: 11px; font-size: 13px; color: #fff;
                background: #1A1A2A; border: none; border-radius: 8px;
                cursor: pointer; font-family: inherit; transition: background 0.2s;
              ">✓ 应用到小票</button>
              <button id="imgResetBtn" style="
                width: 100%; padding: 10px; font-size: 12px; color: #4A4640;
                background: rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.08);
                border-radius: 8px; cursor: pointer; font-family: inherit; transition: background 0.2s;
              ">↺ 重置参数</button>
              <button id="imgRemoveBtn" style="
                width: 100%; padding: 9px; font-size: 12px; color: #E74C3C;
                background: rgba(231,76,60,0.08); border: 1px solid rgba(231,76,60,0.15);
                border-radius: 8px; cursor: pointer; font-family: inherit; transition: background 0.2s;
              ">🗑 移除图片</button>
            </div>
          </div>

          <div id="imgEditorPlaceholder" style="
            padding: 30px 16px; text-align: center; color: #8A8478; font-size: 12px;
            border: 2px dashed rgba(0,0,0,0.1); border-radius: 8px; margin-top: 8px;
          ">
            👆 点击上方按钮<br>选择图片开始编辑
          </div>
        </div>
      </div>
    `;
    this.imageEditorPanel.appendChild(card);
    document.body.appendChild(this.imageEditorPanel);

    this.imageEditorPanel.addEventListener('click', (e) => {
      if (e.target === this.imageEditorPanel || e.target.id === 'imgEditorCloseBtn') {
        this.closeImageEditor();
      }
    });

    document.getElementById('imgUploadBtn').onclick = () => {
      document.getElementById('imgFileInput').click();
    };

    document.getElementById('imgFileInput').onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          this._tempCustomImage = img;
          this.applyImageEditPreview();
          document.getElementById('imgEditorControls').style.display = 'block';
          document.getElementById('imgEditorPlaceholder').style.display = 'none';
          this.showToast('图片加载成功，请调整位置', 'success');
        };
        img.onerror = () => {
          this.showToast('图片加载失败', 'error');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };

    const xSlider = document.getElementById('imgXSlider');
    const ySlider = document.getElementById('imgYSlider');
    const scaleSlider = document.getElementById('imgScaleSlider');
    const rotSlider = document.getElementById('imgRotSlider');
    const opacitySlider = document.getElementById('imgOpacitySlider');

    xSlider.oninput = () => {
      document.getElementById('imgXVal').textContent = xSlider.value + '%';
      this.applyImageEditPreview();
    };
    ySlider.oninput = () => {
      document.getElementById('imgYVal').textContent = ySlider.value + '%';
      this.applyImageEditPreview();
    };
    scaleSlider.oninput = () => {
      document.getElementById('imgScaleVal').textContent = scaleSlider.value + '%';
      this.applyImageEditPreview();
    };
    rotSlider.oninput = () => {
      document.getElementById('imgRotVal').textContent = rotSlider.value + '°';
      this.applyImageEditPreview();
    };
    opacitySlider.oninput = () => {
      document.getElementById('imgOpacityVal').textContent = opacitySlider.value + '%';
      this.applyImageEditPreview();
    };

    const previewCanvas = document.getElementById('imgPreviewCanvas');
    let isDraggingPreview = false;
    const handlePreviewClick = (e) => {
      if (!this._tempCustomImage || !this.texture) return;
      const rect = previewCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const clampedX = Math.max(0, Math.min(1, x));
      const clampedY = Math.max(0, Math.min(1, y));
      xSlider.value = Math.round(clampedX * 100);
      ySlider.value = Math.round(clampedY * 100);
      document.getElementById('imgXVal').textContent = xSlider.value + '%';
      document.getElementById('imgYVal').textContent = ySlider.value + '%';
      this.applyImageEditPreview();
    };
    previewCanvas.addEventListener('mousedown', (e) => {
      isDraggingPreview = true;
      handlePreviewClick(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (isDraggingPreview) handlePreviewClick(e);
    });
    window.addEventListener('mouseup', () => {
      isDraggingPreview = false;
    });

    document.getElementById('imgApplyBtn').onclick = () => {
      if (!this._tempCustomImage) return;
      this.texture.setCustomImage(this._tempCustomImage);
      const cfg = this.getImageEditorValues();
      this.texture.setCustomImageConfig(cfg);
      this.texture.updateTexture();
      this.customImage = true;
      this.showToast('图片已应用到小票', 'success');
      this.playSound('reset');
      this.closeImageEditor();
    };

    document.getElementById('imgResetBtn').onclick = () => {
      xSlider.value = 50;
      ySlider.value = 15;
      scaleSlider.value = 30;
      rotSlider.value = 0;
      opacitySlider.value = 100;
      document.getElementById('imgXVal').textContent = '50%';
      document.getElementById('imgYVal').textContent = '15%';
      document.getElementById('imgScaleVal').textContent = '30%';
      document.getElementById('imgRotVal').textContent = '0°';
      document.getElementById('imgOpacityVal').textContent = '100%';
      this.applyImageEditPreview();
    };

    document.getElementById('imgRemoveBtn').onclick = () => {
      this.texture.clearCustomImage();
      this.texture.updateTexture();
      this.customImage = false;
      this._tempCustomImage = null;
      const previewCanvas = document.getElementById('imgPreviewCanvas');
      if (previewCanvas) {
        const ctx = previewCanvas.getContext('2d');
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      }
      document.getElementById('imgEditorControls').style.display = 'none';
      document.getElementById('imgEditorPlaceholder').style.display = 'block';
      this.showToast('图片已移除', 'info');
      this.playSound('reset');
    };
  }

  getImageEditorValues() {
    return {
      x: parseInt(document.getElementById('imgXSlider').value) / 100,
      y: parseInt(document.getElementById('imgYSlider').value) / 100,
      scale: parseInt(document.getElementById('imgScaleSlider').value) / 100,
      rotation: parseInt(document.getElementById('imgRotSlider').value) * Math.PI / 180,
      opacity: parseInt(document.getElementById('imgOpacitySlider').value) / 100
    };
  }

  applyImageEditPreview() {
    if (!this._tempCustomImage || !this.texture) return;
    const cfg = this.getImageEditorValues();
    this.texture.setCustomImage(this._tempCustomImage);
    this.texture.setCustomImageConfig(cfg);
    this.texture.updateTexture();
    this.drawImagePreview();
  }

  drawImagePreview() {
    const previewCanvas = document.getElementById('imgPreviewCanvas');
    if (!previewCanvas || !this.texture || !this.texture.canvas) return;

    const srcW = this.texture.W;
    const srcH = this.texture.H;
    const aspect = srcW / srcH;

    const maxW = 520;
    const maxH = 400;
    let pw, ph;
    if (aspect > maxW / maxH) {
      pw = maxW;
      ph = maxW / aspect;
    } else {
      ph = maxH;
      pw = maxH * aspect;
    }

    previewCanvas.width = pw;
    previewCanvas.height = ph;
    const ctx = previewCanvas.getContext('2d');

    // 直接复制纹理画布（updateTexture 已包含自定义图片）
    ctx.drawImage(this.texture.canvas, 0, 0, pw, ph);

    // 绘制图片位置标记框
    if (this._tempCustomImage) {
      const cfg = this.texture.customImageConfig;
      const baseSize = Math.min(srcW, srcH) * cfg.scale;
      const imgAspect = this._tempCustomImage.width / this._tempCustomImage.height;
      let drawW, drawH;
      if (imgAspect > 1) {
        drawW = baseSize * imgAspect;
        drawH = baseSize;
      } else {
        drawW = baseSize;
        drawH = baseSize / imgAspect;
      }
      const cx = cfg.x * srcW;
      const cy = cfg.y * srcH;
      const scale = pw / srcW;

      ctx.save();
      ctx.strokeStyle = 'rgba(74,144,217,0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.translate(cx * scale, cy * scale);
      ctx.rotate(cfg.rotation);
      ctx.strokeRect(-drawW / 2 * scale, -drawH / 2 * scale, drawW * scale, drawH * scale);
      ctx.restore();
    }
  }

  openImageEditor() {
    this.createImageEditorPanel();
    this.imageEditorPanel.style.opacity = '1';
    this.imageEditorPanel.style.pointerEvents = 'auto';

    if (this.texture && this.texture.customImage) {
      this._tempCustomImage = this.texture.customImage;
      const cfg = this.texture.getCustomImageConfig();
      document.getElementById('imgXSlider').value = Math.round(cfg.x * 100);
      document.getElementById('imgYSlider').value = Math.round(cfg.y * 100);
      document.getElementById('imgScaleSlider').value = Math.round(cfg.scale * 100);
      document.getElementById('imgRotSlider').value = Math.round(cfg.rotation * 180 / Math.PI);
      document.getElementById('imgOpacitySlider').value = Math.round(cfg.opacity * 100);
      document.getElementById('imgXVal').textContent = Math.round(cfg.x * 100) + '%';
      document.getElementById('imgYVal').textContent = Math.round(cfg.y * 100) + '%';
      document.getElementById('imgScaleVal').textContent = Math.round(cfg.scale * 100) + '%';
      document.getElementById('imgRotVal').textContent = Math.round(cfg.rotation * 180 / Math.PI) + '°';
      document.getElementById('imgOpacityVal').textContent = Math.round(cfg.opacity * 100) + '%';
      document.getElementById('imgEditorControls').style.display = 'block';
      document.getElementById('imgEditorPlaceholder').style.display = 'none';
      this.drawImagePreview();
    }
  }

  closeImageEditor() {
    if (!this.imageEditorPanel) return;
    this.imageEditorPanel.style.opacity = '0';
    this.imageEditorPanel.style.pointerEvents = 'none';
  }

  // 重新打印：重置物理 + 恢复原始小票纹理
  reprintReceipt() {
    this.customImage = false;
    this.rebuildWithParams({});
    this.showToast('正在重新打印...', 'info');
  }

  createIntroCard() {
    this.introCard = document.createElement('div');
    this.introCard.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(255,253,248,0.97); padding: 32px 40px; border-radius: 16px;
      box-shadow: 0 12px 60px rgba(0,0,0,0.12); backdrop-filter: blur(16px);
      border: 1px solid rgba(0,0,0,0.05); max-width: 480px; text-align: center;
      z-index: 200; transition: opacity 0.6s ease, transform 0.6s ease;
    `;
    this.introCard.innerHTML = `
      <div style="font-size: 36px; margin-bottom: 12px;">⎙</div>
      <h2 style="font-size: 20px; color: #1A1A2A; margin-bottom: 8px; font-family: 'Courier New', monospace;">
        3D图形用品超市小票
      </h2>
      <p style="font-size: 13px; color: #8A8478; margin-bottom: 16px; font-family: 'Courier New', monospace;">
        3D Graphics Supply Store Receipt
      </p>
      <p style="font-size: 14px; color: #4A4640; line-height: 1.7; margin-bottom: 20px;">
        这是一张来自图形渲染管线的"硬核"购物清单。<br>
        顶点缓冲、着色器、光栅化器——这些看不见的技术概念，<br>
        被具象化为超市里可以购买的商品。<br>
        <span style="color: #8A8478; font-size: 12px;">致敬每一位在屏幕前燃烧的 GPU。</span>
      </p>
      <button id="introBtn" style="
        padding: 10px 28px; font-size: 14px; color: #fff;
        background: #1A1A2A; border: none; border-radius: 8px;
        cursor: pointer; font-family: 'Courier New', monospace;
        transition: all 0.2s;
      ">开始探索 →</button>
    `;
    document.body.appendChild(this.introCard);

    document.getElementById('introBtn').onclick = () => this.hideIntroCard();

    setTimeout(() => this.hideIntroCard(), 5000);
  }

  hideIntroCard() {
    if (this.introCard && this.introCard.parentNode) {
      this.introCard.style.opacity = '0';
      this.introCard.style.transform = 'translate(-50%, -50%) scale(0.95)';
      setTimeout(() => this.introCard.remove(), 600);
    }
  }

  createHelpPanel() {
    this.helpPanel = document.createElement('div');
    this.helpPanel.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.9);
      background: rgba(255,253,248,0.97); padding: 28px 32px; border-radius: 16px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.12); backdrop-filter: blur(16px);
      border: 1px solid rgba(0,0,0,0.05); z-index: 200;
      opacity: 0; pointer-events: none; transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: 'Courier New', monospace;
      max-width: 480px; width: 90vw;
      max-height: 85vh; overflow-y: auto;
    `;
    this.helpPanel.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
        <h3 style="margin: 0; font-size: 18px; color: #1A1A2A; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 22px;">📋</span>
          快捷键 & 功能指南
        </h3>
        <button id="helpCloseBtn" style="
          width: 32px; height: 32px; border: none;
          background: rgba(0,0,0,0.04); border-radius: 8px;
          cursor: pointer; font-size: 16px; color: #8A8478;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s; font-family: inherit;
        ">✕</button>
      </div>
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div>
          <div style="font-size: 12px; color: #8A8478; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>🖱️</span> 鼠标操作
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; padding-left: 4px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #4A4640;">
              <kbd style="background: rgba(26,26,42,0.08); padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; min-width: 70px; text-align: center;">左键拖拽</kbd>
              <span>拉扯变形小票</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #4A4640;">
              <kbd style="background: rgba(26,26,42,0.08); padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; min-width: 70px; text-align: center;">中键拖拽</kbd>
              <span>平移视角</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #4A4640;">
              <kbd style="background: rgba(26,26,42,0.08); padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; min-width: 70px; text-align: center;">滚轮</kbd>
              <span>缩放视角远近</span>
            </div>
          </div>
        </div>
        <div style="height: 1px; background: rgba(0,0,0,0.06);"></div>
        <div>
          <div style="font-size: 12px; color: #8A8478; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>⌨️</span> 键盘快捷键
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; padding-left: 4px;">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #4A4640;">
              <kbd style="background: rgba(74,144,217,0.15); color: #4A90D9; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; min-width: 70px; text-align: center;">A</kbd>
              <span>按住 + 拖拽 → 切割小票</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #4A4640;">
              <kbd style="background: rgba(80,200,120,0.15); color: #50C878; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; min-width: 70px; text-align: center;">R</kbd>
              <span>重置视角</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; font-size: 13px; color: #4A4640;">
              <kbd style="background: rgba(155,89,182,0.15); color: #9B59B6; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; min-width: 70px; text-align: center;">H</kbd>
              <span>显示/隐藏帮助</span>
            </div>
          </div>
        </div>
        <div style="height: 1px; background: rgba(0,0,0,0.06);"></div>
        <div>
          <div style="font-size: 12px; color: #8A8478; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>🔘</span> 功能按钮（右上角）
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-left: 4px;">
            <div style="font-size: 12px; color: #4A4640; padding: 6px 10px; background: rgba(0,0,0,0.03); border-radius: 6px;">🎓 学习导览</div>
            <div style="font-size: 12px; color: #4A4640; padding: 6px 10px; background: rgba(0,0,0,0.03); border-radius: 6px;">⚙ 管线视图</div>
            <div style="font-size: 12px; color: #4A4640; padding: 6px 10px; background: rgba(0,0,0,0.03); border-radius: 6px;">📖 知识库</div>
            <div style="font-size: 12px; color: #4A4640; padding: 6px 10px; background: rgba(0,0,0,0.03); border-radius: 6px;">🎛 控制台</div>
            <div style="font-size: 12px; color: #4A4640; padding: 6px 10px; background: rgba(0,0,0,0.03); border-radius: 6px;">📷 截图保存</div>
            <div style="font-size: 12px; color: #4A4640; padding: 6px 10px; background: rgba(0,0,0,0.03); border-radius: 6px;">🎨 主题切换</div>
          </div>
        </div>
        <div style="height: 1px; background: rgba(0,0,0,0.06);"></div>
        <div style="font-size: 11px; color: #8A8478; text-align: center; padding-top: 4px;">
          💡 点击小票上的商品可以学习 3D 渲染知识哦～
        </div>
      </div>
    `;
    document.body.appendChild(this.helpPanel);

    setTimeout(() => {
      const closeBtn = document.getElementById('helpCloseBtn');
      if (closeBtn) {
        closeBtn.onmouseover = function() {
          this.style.background = 'rgba(231,76,60,0.12)';
          this.style.color = '#E74C3C';
        };
        closeBtn.onmouseout = function() {
          this.style.background = 'rgba(0,0,0,0.04)';
          this.style.color = '#8A8478';
        };
        closeBtn.onclick = () => this.toggleHelpPanel();
      }
    }, 0);
  }

  // C4: 移动端响应式适配
  applyResponsiveLayout() {
    const style = document.createElement('style');
    style.id = 'responsiveStyle';
    style.textContent = `
      @media (max-width: 768px) {
        #consolePanel { width: 90vw !important; max-width: 320px !important; }
        #pipelinePanel { width: 90vw !important; max-width: 200px !important; }
        #productCard { width: 90vw !important; max-width: none !important; bottom: 90px !important; }
        #hint { font-size: 10px !important; padding: 4px 12px !important; }
        .app-btn { padding: 6px 10px !important; font-size: 11px !important; }
      }
      @media (max-width: 480px) {
        #hint { display: none !important; }
        .app-btn span { display: none; }
      }
    `;
    document.head.appendChild(style);
  }

  toggleHelpPanel() {
    if (this.helpPanel.style.opacity === '1') {
      this.helpPanel.style.opacity = '0';
      this.helpPanel.style.pointerEvents = 'none';
      this.helpPanel.style.transform = 'translate(-50%, -50%) scale(0.9)';
    } else {
      this.helpPanel.style.opacity = '1';
      this.helpPanel.style.pointerEvents = 'auto';
      this.helpPanel.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  }

  // J1: 关于/技术信息面板
  createAboutPanel() {
    this.aboutOverlay = document.createElement('div');
    this.aboutOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(26,26,42,0.5); z-index: 250;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
      backdrop-filter: blur(4px);
    `;

    const card = document.createElement('div');
    card.className = 'about-panel-card';
    card.style.cssText = `
      background: rgba(255,253,248,0.98); border-radius: 16px;
      padding: 32px 40px; max-width: 560px; max-height: 85vh; overflow-y: auto;
      box-shadow: 0 16px 60px rgba(0,0,0,0.2);
      font-family: 'Courier New', monospace; position: relative;
    `;
    const aboutScrollbarStyle = document.createElement('style');
    aboutScrollbarStyle.textContent = `
      .about-panel-card::-webkit-scrollbar { display: none; }
      .about-panel-card { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    document.head.appendChild(aboutScrollbarStyle);
    card.innerHTML = `
      <div style="position: absolute; top: 12px; right: 16px; cursor: pointer;
                  font-size: 22px; color: #8A8478; user-select: none;
                  width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
                  border-radius: 50%; transition: all 0.2s; z-index: 10;" 
           id="aboutCloseBtn"
           onmouseover="this.style.background='rgba(231,76,60,0.12)'; this.style.color='#E74C3C'; this.style.transform='scale(1.1)';"
           onmouseout="this.style.background='transparent'; this.style.color='#8A8478'; this.style.transform='scale(1)';">✕</div>
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 32px; margin-bottom: 8px;">⎙</div>
        <h2 style="font-size: 18px; color: #1A1A2A; margin-bottom: 4px;">3D图形用品超市小票</h2>
        <p style="font-size: 12px; color: #8A8478;">3D Graphics Supply Store Receipt · v4.0 复赛版</p>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 600; color: #1A1A2A; margin-bottom: 6px;">📌 产品简介</div>
        <p style="font-size: 12px; color: #4A4640; line-height: 1.7;">
          一张来自图形渲染管线的"硬核"购物清单。把顶点缓冲、着色器、光栅化器等抽象的 GPU 概念，<br>
          具象化为超市里可以购买的商品，借助 Verlet 布料物理 + Three.js 实时渲染，<br>
          让学习渲染管线变得可触摸、可切割、可交互。
        </p>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 600; color: #1A1A2A; margin-bottom: 6px;">🛤️ 完整功能路径</div>
        <p style="font-size: 12px; color: #4A4640; line-height: 1.8;">
          浏览小票 → 点击商品看技术详情 + 代码示例 → ⚙ 管线视图看流程动画<br>
          → 🎓 学习导览按序学习 26 个概念 → 📖 知识库总览 → 🎓 测验 15 题检验<br>
          → A 键切割小票（纸屑飞溅 + 撕裂毛糙）→ 🎨 主题切换 → 💾 参数预设保存<br>
          → 📷 截图分享 → 🎛 控制台调 14 项物理参数
        </p>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 600; color: #1A1A2A; margin-bottom: 6px;">🛠 技术栈</div>
        <p style="font-size: 12px; color: #4A4640; line-height: 1.8;">
          · Three.js 0.160（MeshPhysicalMaterial / PCFSoftShadowMap / ACESFilmic）<br>
          · Verlet 物理模拟（结构/剪切/弯曲约束 + 空间哈希自碰撞）<br>
          · ES Modules + importmap（CDN 加载，无构建工具）<br>
          · Canvas 纹理生成（小票内容 + 程序法线贴图 Sobel 算子）<br>
          · localStorage 持久化（学习进度 / 主题 / 参数预设）<br>
          · 移动端适配（手势缩放 / 触觉震动 / FPS 自适应降级）
        </p>
      </div>
    `;
    this.aboutOverlay.appendChild(card);
    document.body.appendChild(this.aboutOverlay);

    // 点击背景或关闭按钮关闭
    this.aboutOverlay.addEventListener('click', (e) => {
      if (e.target === this.aboutOverlay || e.target.id === 'aboutCloseBtn') {
        this.toggleAboutPanel();
      }
    });
  }

  toggleAboutPanel() {
    if (this.aboutOverlay.style.opacity === '1') {
      this.aboutOverlay.style.opacity = '0';
      this.aboutOverlay.style.pointerEvents = 'none';
    } else {
      this.aboutOverlay.style.opacity = '1';
      this.aboutOverlay.style.pointerEvents = 'auto';
      this.playSound('reset');
    }
  }

  onKeyDown(e) {
    if (e.key.toLowerCase() === 'h') {
      this.toggleHelpPanel();
    } else if (e.key.toLowerCase() === 'r') {
      this.renderer.resetCamera();
      this.playSound('reset');
    } else if (e.key.toLowerCase() === 't') {
      this.startLearningTour();
    } else if (e.key.toLowerCase() === 's') {
      this.takeScreenshot();
    }
  }

  setupAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }

  playSound(type) {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'cut') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'reset') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(554, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  }

  animate() {
    if (!this.animating) return;
    requestAnimationFrame(() => this.animate());

    // H1: FPS 监测
    const now = performance.now();
    if (this._lastFrameTime) {
      const dt = now - this._lastFrameTime;
      this._frameTimes = this._frameTimes || [];
      this._frameTimes.push(dt);
      if (this._frameTimes.length > 60) this._frameTimes.shift();
    }
    this._lastFrameTime = now;

    try {
      if (!this.preSimDone) {
        const bar = document.getElementById('loadingBar');
        const steps = 60;
        for (let i = 0; i < steps; i++) {
          this.physics.preSimulate(1, this.FIXED_DT);
          if (bar) bar.style.width = `${((i + 1) / steps) * 100}%`;
        }
        this.preSimDone = true;

        setTimeout(() => {
          this.hideLoading();
          this.renderer.startCameraAnimation();
          this.staggerUIEntrance();
        }, 300);
      }

      this.physics.simulate(this.FIXED_DT);
      this.physics.selfCollision();
      this.renderer.updateMesh(this.physics);
      this.renderer.updateCameraAnimation();
      this.renderer.render();

      // H1: 每 30 帧检查一次性能
      if (this._frameTimes && this._frameTimes.length >= 30 && this._frameTimes.length % 30 === 0) {
        this.checkPerformance();
      }
    } catch(e) {
      console.error('Animate error:', e);
      if (!this.preSimDone) {
        this.preSimDone = true;
        this.hideLoading();
      }
    }
  }

  // H1: FPS 自适应降级
  checkPerformance() {
    if (!this._frameTimes || this._frameTimes.length === 0) return;
    const avgDt = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
    const fps = 1000 / avgDt;

    // 更新 FPS 显示
    this.updateFpsDisplay(fps);

    // 连续低帧率时降级（仅触发一次）
    if (fps < 30 && !this._downgraded && this.params.rows > 32) {
      this._downgraded = true;
      const newRows = Math.max(32, this.params.rows - 8);
      this.showPerfWarning(newRows);
      this.rebuildWithParams({ rows: newRows });
    }
  }

  updateFpsDisplay(fps) {
    if (!this.fpsLabel) {
      this.fpsLabel = document.createElement('div');
      this.fpsLabel.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        font-size: 11px; color: #8A8478; font-family: 'Courier New', monospace;
        background: rgba(255,253,248,0.75); padding: 5px 14px; border-radius: 20px;
        z-index: 70; pointer-events: none;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04);
        backdrop-filter: blur(12px); border: 1px solid rgba(0,0,0,0.04);
        transition: all 0.3s ease;
      `;
      document.body.appendChild(this.fpsLabel);
    }
    const color = fps >= 50 ? '#50C878' : fps >= 30 ? '#E8A838' : '#E74C3C';
    this.fpsLabel.innerHTML = `<span style="color:${color}; font-weight: 600;">⚡ ${fps.toFixed(0)} FPS</span>`;
  }

  showPerfWarning(newRows) {
    this.showToast(`⚡ 为流畅性已自动降级至 ${newRows} 行`, 'warn');
  }

  staggerUIEntrance() {
    const elements = [
      { id: 'leftPanel', delay: 200 },
      { id: 'rightPanel', delay: 350 },
      { id: 'hint', delay: 500 },
      { id: 'traeBadge', delay: 600 }
    ];
    elements.forEach(item => {
      const el = document.getElementById(item.id);
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = item.id === 'leftPanel' ? 'translateX(-20px)' :
                           item.id === 'rightPanel' ? 'translateX(20px)' :
                           item.id === 'hint' ? 'translateX(-50%) translateY(10px)' :
                           'translateY(10px)';
      setTimeout(() => {
        el.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        el.style.opacity = '1';
        el.style.transform = item.id === 'leftPanel' ? 'translateX(0)' :
                             item.id === 'rightPanel' ? 'translateX(0)' :
                             item.id === 'hint' ? 'translateX(-50%) translateY(0)' :
                             'translateY(0)';
      }, item.delay);
    });
    setTimeout(() => {
      if (this.fpsLabel) {
        this.fpsLabel.style.opacity = '0';
        this.fpsLabel.style.transform = 'translateX(-50%) translateY(-8px)';
        this.fpsLabel.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        requestAnimationFrame(() => {
          this.fpsLabel.style.opacity = '1';
          this.fpsLabel.style.transform = 'translateX(-50%) translateY(0)';
        });
      }
    }, 450);
  }

  syncWindInput() {
    const windInput = document.getElementById('windInput');
    if (windInput) windInput.value = this.params.wind.toFixed(2);
    const windSlider = document.getElementById('windSlider');
    if (windSlider) windSlider.value = this.params.wind;
    const windValueDisplay = document.getElementById('windValueDisplay');
    if (windValueDisplay) windValueDisplay.textContent = this.params.wind.toFixed(2);
    const windIcon = document.getElementById('windIcon');
    if (windIcon) {
      const rot = this.params.wind * 30;
      windIcon.style.transform = `rotate(${rot}deg) scale(${1 + Math.abs(this.params.wind) * 0.3})`;
    }
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => new App());
} else {
  new App();
}
