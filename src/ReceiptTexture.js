import * as THREE from 'three';

export const products = [
  {
    id: 'vbo',
    name: '顶点缓冲对象 VBO',
    nameEn: 'Vertex Buffer Object',
    price: '299.00',
    quantity: 1,
    stage: '几何阶段',
    stageOrder: 0,
    depth: 5,
    description: '存储顶点数据的GPU内存缓冲区，是现代图形API的核心数据结构，实现CPU到GPU的数据传输优化。',
    params: ['GL_ARRAY_BUFFER', 'GL_STATIC_DRAW', 'GPU显存'],
    icon: '◢',
    related: ['vertexshader', 'normalmap'],
    codeExample: `// 创建并填充 VBO
const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, 
  new Float32Array(vertices), 
  gl.STATIC_DRAW
);
// 关联到顶点属性
gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);`
  },
  {
    id: 'vertexshader',
    name: '顶点着色器 VertShader',
    nameEn: 'Vertex Shader',
    price: '459.00',
    quantity: 1,
    stage: '几何阶段',
    stageOrder: 0,
    depth: 5,
    description: '渲染管线第一个可编程阶段，处理每个顶点的位置变换，将模型坐标转换到裁剪空间。',
    params: ['gl_Position', 'attribute', 'uniform'],
    icon: '▲',
    related: ['vbo', 'mattransform', 'pipeline'],
    codeExample: `// GLSL 顶点着色器
attribute vec3 aPosition;
attribute vec2 aUV;
uniform mat4 uMVP;
varying vec2 vUV;

void main() {
  gl_Position = uMVP * vec4(aPosition, 1.0);
  vUV = aUV;
}`
  },
  {
    id: 'frag',
    name: '片段着色器 FragShader',
    nameEn: 'Fragment Shader',
    price: '599.00',
    quantity: 1,
    stage: '光栅化阶段',
    stageOrder: 2,
    depth: 5,
    description: '决定每个像素最终颜色的程序，运行在GPU的每个像素处理器上，实现光照、纹理采样等效果。',
    params: ['gl_FragColor', 'texture2D()', 'varying'],
    icon: '▣',
    related: ['vertexshader', 'sampler', 'rasterizer'],
    codeExample: `// GLSL 片段着色器
precision mediump float;
varying vec2 vUV;
uniform sampler2D uTexture;

void main() {
  vec4 color = texture2D(uTexture, vUV);
  gl_FragColor = color;
}`
  },
  {
    id: 'mipmap',
    name: 'Mipmap Level 0',
    nameEn: 'Mipmap',
    price: '49.00',
    quantity: 2,
    stage: '纹理阶段',
    stageOrder: 3,
    depth: 2,
    description: '预计算的纹理金字塔，根据距离自动选择合适分辨率，提升渲染性能和图像质量。',
    params: ['GL_NEAREST_MIPMAP_LINEAR', 'LOD Bias', '各向异性过滤'],
    icon: '◇',
    related: ['sampler', 'textureatlas'],
    codeExample: `// 生成 Mipmap 链
gl.generateMipmap(gl.TEXTURE_2D);
gl.texParameteri(gl.TEXTURE_2D,
  gl.TEXTURE_MIN_FILTER, 
  gl.LINEAR_MIPMAP_LINEAR);`
  },
  {
    id: 'msaa',
    name: '4xMSAA 抗锯齿',
    nameEn: 'Multi-Sample Anti-Aliasing',
    price: '199.00',
    quantity: 1,
    stage: '输出阶段',
    stageOrder: 5,
    depth: 3,
    description: '在每个像素内采样多次，平滑边缘锯齿，是最常用的全屏抗锯齿技术之一。',
    params: ['GL_SAMPLES', 'Coverage Sampling', 'FXAA'],
    icon: '◉',
    related: ['rasterizer', 'framebuffer'],
    codeExample: `// 创建多重采样缓冲
gl.renderbufferStorageMultisample(
  gl.RENDERBUFFER, 
  4, // 4x MSAA
  gl.DEPTH_COMPONENT16, 
  width, height
);`
  },
  {
    id: 'zbuffer',
    name: '深度缓冲 Z-Buffer',
    nameEn: 'Depth Buffer',
    price: '399.00',
    quantity: 1,
    stage: '光栅化阶段',
    stageOrder: 2,
    depth: 4,
    description: '存储每个像素的深度值，用于确定可见性，实现正确的遮挡关系。',
    params: ['gl_FragDepth', 'Z-Fighting', 'Depth Test'],
    icon: '▫',
    related: ['framebuffer', 'rasterizer'],
    codeExample: `// 启用深度测试
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);
// 清除深度缓冲
gl.clear(gl.DEPTH_BUFFER_BIT);`
  },
  {
    id: 'normalmap',
    name: '法线贴图 NormalMap',
    nameEn: 'Normal Map',
    price: '149.00',
    quantity: 1,
    stage: '几何阶段',
    stageOrder: 0,
    depth: 4,
    description: '存储表面法线方向的纹理，在低多边形模型上模拟高细节表面凹凸效果。',
    params: ['Tangent Space', 'Bump Mapping', 'Parallax Mapping'],
    icon: '◣',
    related: ['vbo', 'sampler', 'frag'],
    codeExample: `// 法线贴图光照计算
vec3 normal = texture2D(normalMap, vUV).rgb;
normal = normalize(normal * 2.0 - 1.0);
vec3 lightDir = normalize(uLightPos - vPos);
float diff = max(dot(normal, lightDir), 0.0);`
  },
  {
    id: 'frustum',
    name: '视锥体裁剪 FrustumClip',
    nameEn: 'Frustum Culling',
    price: '89.00',
    quantity: 1,
    stage: '几何阶段',
    stageOrder: 0,
    depth: 3,
    description: '剔除视锥体外的物体，减少不必要的渲染计算，提升场景渲染性能。',
    params: ['6个平面', 'Bounding Box', 'GPU Instancing'],
    icon: '◭',
    related: ['pipeline', 'mattransform'],
    codeExample: `// AABB 与视锥体相交检测
function inFrustum(box, frustum) {
  for (const plane of frustum) {
    if (dot3(plane.normal, 
        box.cornerFurthest(plane.normal)) 
        < plane.distance) 
      return false;
  }
  return true;
}`
  },
  {
    id: 'homocoord',
    name: '齐次坐标 HomoCoord',
    nameEn: 'Homogeneous Coordinates',
    price: '29.00',
    quantity: 3,
    stage: '变换阶段',
    stageOrder: 1,
    depth: 4,
    description: '用4维向量表示3维点，统一处理平移、旋转、缩放和透视投影变换。',
    params: ['4x4 Matrix', 'Perspective Divide', 'w分量'],
    icon: '⊕',
    related: ['mattransform', 'vertexshader'],
    codeExample: `// 透视除法：齐次坐标 → NDC
vec4 clipPos = uProjection * viewPos;
vec3 ndcPos = clipPos.xyz / clipPos.w;
// w=1 表示点，w=0 表示方向
vec4 point = vec4(pos, 1.0);
vec4 direction = vec4(dir, 0.0);`
  },
  {
    id: 'backcull',
    name: '背面剔除 BackCull',
    nameEn: 'Back-Face Culling',
    price: '59.00',
    quantity: 1,
    stage: '光栅化阶段',
    stageOrder: 2,
    depth: 2,
    description: '剔除背对观察者的三角形，利用三角形的朝向信息减少一半的光栅化工作量。',
    params: ['CCW Winding', 'glFrontFace', 'Double-Sided'],
    icon: '◥',
    related: ['rasterizer', 'pipeline'],
    codeExample: `// 启用背面剔除
gl.enable(gl.CULL_FACE);
gl.cullFace(gl.BACK);
gl.frontFace(gl.CCW); // 逆时针为正面`
  },
  {
    id: 'sampler',
    name: '纹理采样器 Sampler',
    nameEn: 'Texture Sampler',
    price: '179.00',
    quantity: 2,
    stage: '纹理阶段',
    stageOrder: 3,
    depth: 3,
    description: '定义纹理如何被采样的状态对象，包括过滤方式、坐标环绕模式等。',
    params: ['GL_REPEAT', 'GL_LINEAR', 'Mipmap Filter'],
    icon: '◉',
    related: ['mipmap', 'frag', 'textureatlas'],
    codeExample: `// 配置采样器状态
gl.texParameteri(gl.TEXTURE_2D, 
  gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D,
  gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.uniform1i(uSamplerLoc, 0);
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, texture);`
  },
  {
    id: 'geoshader',
    name: '几何着色器 GeoShader',
    nameEn: 'Geometry Shader',
    price: '499.00',
    quantity: 1,
    stage: '几何阶段',
    stageOrder: 0,
    depth: 5,
    description: '在顶点和片段着色器之间执行，可以创建或销毁几何体，常用于粒子系统和高级效果。',
    params: ['gl_PrimitiveID', 'EmitVertex()', 'EndPrimitive()'],
    icon: '▲',
    related: ['vertexshader', 'tessellation', 'pipeline'],
    codeExample: `// GLSL 几何着色器（输入点 → 输出三角形）
layout(points) in;
layout(triangle_strip, max_vertices=3) out;

void main() {
  for (int i = 0; i < 3; i++) {
    gl_Position = gl_in[0].gl_Position 
      + offset[i];
    EmitVertex();
  }
  EndPrimitive();
}`
  },
  {
    id: 'tessellation',
    name: '曲面细分 TessShader',
    nameEn: 'Tessellation Shader',
    price: '529.00',
    quantity: 1,
    stage: '几何阶段',
    stageOrder: 0,
    depth: 5,
    description: '在GPU上动态细分低多边形网格，根据距离自适应增加几何细节，实现LOD控制。',
    params: ['Tess Control', 'Tess Evaluation', 'PN Triangles'],
    icon: '◬',
    related: ['geoshader', 'vertexshader', 'normalmap'],
    codeExample: `// 曲面细分控制着色器
layout(vertices = 3) out;
void main() {
  gl_TessLevelOuter[0] = 4.0;
  gl_TessLevelOuter[1] = 4.0;
  gl_TessLevelOuter[2] = 4.0;
  gl_TessLevelInner[0] = 4.0;
  gl_out[gl_InvocationID].gl_Position 
    = gl_in[gl_InvocationID].gl_Position;
}`
  },
  {
    id: 'computeshader',
    name: '计算着色器 CompShader',
    nameEn: 'Compute Shader',
    price: '649.00',
    quantity: 1,
    stage: '核心架构',
    stageOrder: 0,
    depth: 5,
    description: '通用GPU计算程序，不经过图形管线，用于物理模拟、图像处理、AI推理等并行计算任务。',
    params: ['glDispatchCompute', 'SSBO', 'Shared Memory'],
    icon: '⚡',
    related: ['pipeline', 'framebuffer'],
    codeExample: `// 计算着色器调度
gl.useProgram(computeProgram);
gl.bindBufferBase(gl.SHADER_STORAGE_BUFFER, 
  0, ssbo);
gl.dispatchCompute(
  numGroupsX, numGroupsY, numGroupsZ
);
gl.memoryBarrier(gl.SHADER_STORAGE_BARRIER_BIT);`
  },
  {
    id: 'rasterizer',
    name: '光栅化器 Rasterizer',
    nameEn: 'Rasterizer',
    price: '349.00',
    quantity: 1,
    stage: '光栅化阶段',
    stageOrder: 2,
    depth: 5,
    description: '将几何图元转换为像素片段的硬件单元，负责插值属性和确定像素覆盖。',
    params: ['Scanline', 'Coverage', 'Interpolation'],
    icon: '■',
    related: ['frag', 'backcull', 'zbuffer'],
    codeExample: `// 光栅化：三角形 → 像素
// 硬件自动完成，伪代码示意
for (pixel in triangle_coverage) {
  float w = barycentricWeight(pixel, tri);
  vec2 uv = w.u * v0.uv 
          + w.v * v1.uv 
          + w.w * v2.uv;
  invokeFragmentShader(pixel, uv);
}`
  },
  {
    id: 'pipeline',
    name: '渲染管线 Pipeline',
    nameEn: 'Rendering Pipeline',
    price: '899.00',
    quantity: 1,
    stage: '核心架构',
    stageOrder: 0,
    depth: 5,
    description: '图形渲染的完整流程，包括顶点处理、光栅化、片段处理和帧缓冲输出。',
    params: ['Vertex Shader', 'Primitive Assembly', 'Framebuffer'],
    icon: '⟹',
    related: ['vertexshader', 'frag', 'framebuffer'],
    codeExample: `// 可编程渲染管线流程
// 1. 顶点着色器 (可编程)
// 2. 曲面细分 (可选, 可编程)
// 3. 几何着色器 (可选, 可编程)
// 4. 光栅化 (固定)
// 5. 片段着色器 (可编程)
// 6. 逐片元测试 (固定)
// 7. 帧缓冲写入

gl.drawElements(gl.TRIANGLES, 
  count, gl.UNSIGNED_SHORT, 0);`
  },
  {
    id: 'mattransform',
    name: '矩阵变换 MatTransform',
    nameEn: 'Matrix Transformation',
    price: '69.00',
    quantity: 2,
    stage: '变换阶段',
    stageOrder: 1,
    depth: 4,
    description: '通过矩阵乘法实现坐标变换，包括模型、视图、投影三种基本变换矩阵。',
    params: ['Model Matrix', 'View Matrix', 'Projection Matrix'],
    icon: '◈',
    related: ['homocoord', 'vertexshader', 'frustum'],
    codeExample: `// MVP 矩阵组合
mat4 model = translate * rotate * scale;
mat4 view = lookAt(eye, target, up);
mat4 projection = perspective(
  fovy, aspect, near, far);
mat4 mvp = projection * view * model;
gl_Position = mvp * vec4(pos, 1.0);`
  },
  {
    id: 'gbuffer',
    name: 'G缓冲 G-Buffer',
    nameEn: 'Geometry Buffer',
    price: '389.00',
    quantity: 1,
    stage: '输出阶段',
    stageOrder: 5,
    depth: 4,
    description: '延迟渲染中存储几何属性（位置、法线、颜色等）的多张纹理，实现高效多光源光照计算。',
    params: ['MRT', 'Deferred Shading', 'Position/Normal/Albedo'],
    icon: '▤',
    related: ['framebuffer', 'frag', 'ao'],
    codeExample: `// 多渲染目标 (MRT) 写入 G-Buffer
layout(location = 0) out vec4 gPosition;
layout(location = 1) out vec4 gNormal;
layout(location = 2) out vec4 gAlbedo;

void main() {
  gPosition = vec4(vPos, 1.0);
  gNormal = vec4(normalize(vNormal), 1.0);
  gAlbedo = vec4(diffuseColor, 1.0);
}`
  },
  {
    id: 'shadowmap',
    name: '阴影贴图 ShadowMap',
    nameEn: 'Shadow Map',
    price: '259.00',
    quantity: 1,
    stage: '纹理阶段',
    stageOrder: 3,
    depth: 4,
    description: '从光源视角渲染深度图，用于判断像素是否被遮挡，实现实时阴影效果。',
    params: ['Depth from Light', 'PCF', 'Shadow Acne'],
    icon: '◐',
    related: ['zbuffer', 'framebuffer', 'frustum'],
    codeExample: `// 阴影贴图采样
float shadow = 0.0;
vec4 lightSpacePos = lightMatrix * vPos;
vec3 projCoords = lightSpacePos.xyz 
  / lightSpacePos.w;
float closestDepth = texture(
  shadowMap, projCoords.xy).r;
float currentDepth = projCoords.z;
shadow = currentDepth > closestDepth 
  + 0.005 ? 0.5 : 1.0;`
  },
  {
    id: 'ao',
    name: '环境光遮蔽 AO',
    nameEn: 'Ambient Occlusion',
    price: '219.00',
    quantity: 1,
    stage: '纹理阶段',
    stageOrder: 3,
    depth: 4,
    description: '模拟物体间相互遮挡导致的环境光衰减，增强几何立体感和接触阴影的真实感。',
    params: ['SSAO', 'HBAO', 'GTAO'],
    icon: '◍',
    related: ['gbuffer', 'normalmap', 'frag'],
    codeExample: `// SSAO 简化实现
float occlusion = 0.0;
for (int i = 0; i < kernelSize; i++) {
  vec3 sample = pos + kernel[i] * radius;
  vec4 offset = projection * vec4(sample, 1.0);
  offset.xyz /= offset.w;
  float sampleDepth = texture(
    gPosition, offset.xy).z;
  occlusion += (sample.z < sampleDepth 
    ? 1.0 : 0.0);
}
occlusion = 1.0 - occlusion / kernelSize;`
  },
  {
    id: 'textureatlas',
    name: '纹理图集 TexAtlas',
    nameEn: 'Texture Atlas',
    price: '99.00',
    quantity: 2,
    stage: '纹理阶段',
    stageOrder: 3,
    depth: 3,
    description: '将多张小纹理合并为一张大图，减少纹理切换开销，提升GPU采样性能。',
    params: ['UV Packing', 'Array Texture', 'Batching'],
    icon: '▦',
    related: ['sampler', 'mipmap', 'vbo'],
    codeExample: `// 从图集中采样
vec2 atlasUV = uvOffset + vUV * uvScale;
vec4 color = texture2D(
  atlasTexture, atlasUV);
// uvOffset: 该子图在图集中的偏移
// uvScale:  该子图的尺寸比例`
  },
  {
    id: 'screenspace',
    name: '屏幕空间 ScreenSpace',
    nameEn: 'Screen Space',
    price: '159.00',
    quantity: 1,
    stage: '输出阶段',
    stageOrder: 5,
    depth: 3,
    description: '最终渲染结果所在的坐标系，所有3D坐标经过变换后映射到2D屏幕坐标。',
    params: ['Viewport', 'Pixel Coordinates', 'Screen Space Effects'],
    icon: '▦',
    related: ['framebuffer', 'mattransform', 'msaa'],
    codeExample: `// NDC → 屏幕坐标
vec2 screenPos;
screenPos.x = (ndc.x + 1.0) * 0.5 * width;
screenPos.y = (1.0 - ndc.y) * 0.5 * height;
// 设置视口
gl.viewport(0, 0, width, height);`
  },
  {
    id: 'stencilbuffer',
    name: '模板缓冲 StencilBuf',
    nameEn: 'Stencil Buffer',
    price: '189.00',
    quantity: 1,
    stage: '输出阶段',
    stageOrder: 5,
    depth: 3,
    description: '控制像素是否被绘制的掩码缓冲，常用于轮廓描边、反射、阴影体等效果。',
    params: ['Stencil Test', 'glStencilFunc', 'Shadow Volume'],
    icon: '◫',
    related: ['framebuffer', 'zbuffer'],
    codeExample: `// 模板测试：绘制轮廓
gl.enable(gl.STENCIL_TEST);
gl.stencilFunc(gl.NOTEQUAL, 1, 0xFF);
gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
// 先填充模板，再绘制描边
gl.stencilMask(0x00); // 禁止写入
drawOutline();`
  },
  {
    id: 'blendmode',
    name: '混合模式 BlendMode',
    nameEn: 'Blend Mode',
    price: '129.00',
    quantity: 1,
    stage: '输出阶段',
    stageOrder: 5,
    depth: 3,
    description: '控制新片段与帧缓冲已有颜色的混合方式，实现透明、叠加、屏幕等效果。',
    params: ['SRC_ALPHA', 'ADD', 'Premultiplied'],
    icon: '◍',
    related: ['framebuffer', 'frag'],
    codeExample: `// Alpha 混合
gl.enable(gl.BLEND);
gl.blendFunc(
  gl.SRC_ALPHA, 
  gl.ONE_MINUS_SRC_ALPHA
);
// 加法混合（发光效果）
gl.blendFunc(gl.SRC_ALPHA, gl.ONE);`
  },
  {
    id: 'doublebuffer',
    name: '双缓冲 DoubleBuf',
    nameEn: 'Double Buffering',
    price: '79.00',
    quantity: 2,
    stage: '输出阶段',
    stageOrder: 5,
    depth: 2,
    description: '使用前后两个帧缓冲交替显示，避免渲染过程中的画面撕裂，保证流畅显示。',
    params: ['Front Buffer', 'Back Buffer', 'V-Sync'],
    icon: '⇄',
    related: ['framebuffer', 'screenspace'],
    codeExample: `// 双缓冲机制（浏览器自动管理）
// 后缓冲渲染 → 交换 → 前缓冲显示
requestAnimationFrame(() => {
  renderer.render(scene, camera);
  // 浏览器自动交换缓冲
});
// V-Sync 同步刷新率`
  },
  {
    id: 'framebuffer',
    name: '帧缓冲 FrameBuffer',
    nameEn: 'Frame Buffer',
    price: '449.00',
    quantity: 1,
    stage: '输出阶段',
    stageOrder: 5,
    depth: 5,
    description: '存储渲染结果的内存区域，包含颜色缓冲、深度缓冲和模板缓冲。',
    params: ['FBO', 'Renderbuffer', 'Ping-Pong'],
    icon: '▤',
    related: ['zbuffer', 'gbuffer', 'stencilbuffer'],
    codeExample: `// 创建帧缓冲对象 (FBO)
const fbo = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.framebufferTexture2D(
  gl.FRAMEBUFFER, 
  gl.COLOR_ATTACHMENT0, 
  gl.TEXTURE_2D, colorTexture, 0);
gl.framebufferRenderbuffer(
  gl.FRAMEBUFFER,
  gl.DEPTH_ATTACHMENT,
  gl.RENDERBUFFER, depthBuffer);`
  }
];

export const quizQuestions = [
  {
    question: 'Z-Buffer 的主要作用是什么？',
    options: ['存储顶点位置', '确定像素可见性', '加速纹理采样', '计算光照'],
    correct: 1,
    explain: '深度缓冲存储每个像素的深度值，通过深度测试确定遮挡关系。',
    difficulty: 'easy'
  },
  {
    question: '顶点着色器的核心职责是？',
    options: ['决定像素颜色', '顶点位置变换', '光栅化三角形', '剔除背面'],
    correct: 1,
    explain: '顶点着色器处理每个顶点的位置变换，将模型坐标转换到裁剪空间。',
    difficulty: 'easy'
  },
  {
    question: 'Mipmap 的主要优势是？',
    options: ['增加纹理分辨率', '减少显存占用', '根据距离自适应选择分辨率', '加速顶点计算'],
    correct: 2,
    explain: 'Mipmap 预计算纹理金字塔，根据距离自动选择合适分辨率，兼顾性能与质量。',
    difficulty: 'easy'
  },
  {
    question: '背面剔除利用什么信息减少光栅化工作量？',
    options: ['顶点颜色', '三角形朝向', '深度值', '纹理坐标'],
    correct: 1,
    explain: '通过三角形顶点的环绕顺序（CCW/CW）判断朝向，剔除背对观察者的面。',
    difficulty: 'easy'
  },
  {
    question: 'VBO（顶点缓冲对象）存储在哪里？',
    options: ['CPU 内存', 'GPU 显存', '硬盘', '缓存'],
    correct: 1,
    explain: 'VBO 是 GPU 显存中的缓冲区，用于高效传输和存储顶点数据。',
    difficulty: 'easy'
  },
  {
    question: '齐次坐标中 w=1 和 w=0 分别表示什么？',
    options: ['点和方向', '颜色和法线', '位置和速度', '顶点和像素'],
    correct: 0,
    explain: 'w=1 表示点（受平移影响），w=0 表示方向（不受平移影响）。',
    difficulty: 'medium'
  },
  {
    question: '视锥体裁剪的主要目的是？',
    options: ['提高纹理质量', '减少不必要的渲染计算', '增加光照精度', '改善抗锯齿'],
    correct: 1,
    explain: '剔除视锥体外的物体，避免渲染不可见内容，提升场景性能。',
    difficulty: 'medium'
  },
  {
    question: '法线贴图的作用是？',
    options: ['存储顶点颜色', '在低模上模拟高细节凹凸', '加速光栅化', '替代深度缓冲'],
    correct: 1,
    explain: '法线贴图存储表面法线方向，让低多边形模型呈现高细节的凹凸效果。',
    difficulty: 'medium'
  },
  {
    question: '阴影贴图（Shadow Map）的核心原理是？',
    options: ['从光源视角渲染深度', '计算光线追踪', '使用环境光遮蔽', '依赖法线方向'],
    correct: 0,
    explain: '从光源视角渲染深度图，通过比较深度判断像素是否被遮挡。',
    difficulty: 'medium'
  },
  {
    question: '纹理图集（Texture Atlas）的优势是？',
    options: ['提高纹理分辨率', '减少纹理切换开销', '增加显存占用', '替代 Mipmap'],
    correct: 1,
    explain: '将多张小纹理合并为一张大图，减少 GPU 纹理切换，提升采样性能。',
    difficulty: 'medium'
  },
  {
    question: '模板缓冲（Stencil Buffer）常用于？',
    options: ['存储顶点数据', '轮廓描边、反射、阴影体', '加速光栅化', '替代深度测试'],
    correct: 1,
    explain: '模板缓冲是掩码缓冲，控制像素是否被绘制，常用于描边、反射等效果。',
    difficulty: 'medium'
  },
  {
    question: '双缓冲（Double Buffering）解决什么问题？',
    options: ['显存不足', '画面撕裂', '纹理模糊', '深度冲突'],
    correct: 1,
    explain: '前后缓冲交替显示，避免渲染过程中的画面撕裂。',
    difficulty: 'medium'
  },
  {
    question: '延迟渲染（G-Buffer）相比前向渲染的优势是？',
    options: ['更少的显存占用', '支持更多光源而不显著降低性能', '更高的纹理精度', '更简单的着色器'],
    correct: 1,
    explain: '延迟渲染先写入几何属性到 G-Buffer，再统一计算光照，光源数量与片段着色器调用次数解耦。',
    difficulty: 'hard'
  },
  {
    question: '计算着色器（Compute Shader）的特点是？',
    options: ['必须经过图形管线', '通用 GPU 并行计算', '只能处理顶点', '无法访问显存'],
    correct: 1,
    explain: '计算着色器不经过图形管线，用于物理模拟、图像处理、AI 推理等通用并行计算。',
    difficulty: 'hard'
  },
  {
    question: '曲面细分着色器（Tessellation）的主要用途是？',
    options: ['减少三角形数量', 'GPU 上动态细分低模增加细节', '替代顶点着色器', '仅用于纹理'],
    correct: 1,
    explain: '曲面细分在 GPU 上动态细分低多边形网格，根据距离自适应增加几何细节，实现 LOD 控制。',
    difficulty: 'hard'
  }
];

export class ReceiptTexture {
  constructor() {
    this.W = 512;
    this.H = 1860;
    this.productPositions = [];
    this.customImage = null;
    this.customImageConfig = {
      x: 0.5,
      y: 0.15,
      scale: 0.3,
      opacity: 1.0,
      rotation: 0
    };
  }

  create() {
    const cv = document.createElement('canvas');
    cv.width = this.W;
    cv.height = this.H;
    this.canvas = cv;
    const c = cv.getContext('2d');

    this.drawBaseTexture(c);
    this.drawReceiptContent(c);

    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    this.texture = tex;
    return tex;
  }

  updateTexture() {
    if (!this.canvas) return null;
    const c = this.canvas.getContext('2d');
    this.drawBaseTexture(c);
    this.drawReceiptContent(c);
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
    return this.texture;
  }

  // G1: 程序生成法线贴图（纸张纤维凹凸质感）
  createNormalMap() {
    const sz = 256;
    const cv = document.createElement('canvas');
    cv.width = sz;
    cv.height = sz;
    const c = cv.getContext('2d');

    // 生成随机高度图
    const heightMap = new Float32Array(sz * sz);
    for (let i = 0; i < heightMap.length; i++) {
      heightMap[i] = Math.random();
    }
    // 平滑滤波（模拟纤维连续性）
    const smooth = new Float32Array(sz * sz);
    for (let y = 0; y < sz; y++) {
      for (let x = 0; x < sz; x++) {
        let sum = 0, cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = (x + dx + sz) % sz;
            const ny = (y + dy + sz) % sz;
            sum += heightMap[ny * sz + nx];
            cnt++;
          }
        }
        smooth[y * sz + x] = sum / cnt;
      }
    }

    // Sobel 算子计算法线
    const imgData = c.createImageData(sz, sz);
    const data = imgData.data;
    const strength = 2.0;
    for (let y = 0; y < sz; y++) {
      for (let x = 0; x < sz; x++) {
        const xL = smooth[y * sz + ((x - 1 + sz) % sz)];
        const xR = smooth[y * sz + ((x + 1) % sz)];
        const yU = smooth[((y - 1 + sz) % sz) * sz + x];
        const yD = smooth[((y + 1) % sz) * sz + x];
        const dx = (xR - xL) * strength;
        const dy = (yD - yU) * strength;
        const dz = 1.0;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const p = (y * sz + x) * 4;
        data[p] = Math.floor((dx / len * 0.5 + 0.5) * 255);
        data[p + 1] = Math.floor((dy / len * 0.5 + 0.5) * 255);
        data[p + 2] = Math.floor((dz / len * 0.5 + 0.5) * 255);
        data[p + 3] = 255;
      }
    }
    c.putImageData(imgData, 0, 0);

    const normalTex = new THREE.CanvasTexture(cv);
    normalTex.wrapS = THREE.RepeatWrapping;
    normalTex.wrapT = THREE.RepeatWrapping;
    return normalTex;
  }

  drawBaseTexture(c) {
    c.fillStyle = '#f6f1e3';
    c.fillRect(0, 0, this.W, this.H);

    const id = c.getImageData(0, 0, this.W, this.H);
    const d = id.data;
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const p = (y * this.W + x) * 4;
        const n = (Math.random() - 0.5) * 8;
        d[p] = Math.min(255, Math.max(0, d[p] + n));
        d[p + 1] = Math.min(255, Math.max(0, d[p + 1] + n));
        d[p + 2] = Math.min(255, Math.max(0, d[p + 2] + n));
      }
    }
    c.putImageData(id, 0, 0);

    this.drawScanlines(c);
    this.drawEdgeFade(c);
  }

  drawScanlines(c) {
    c.globalAlpha = 0.03;
    c.fillStyle = '#000';
    for (let y = 0; y < this.H; y += 3) {
      c.fillRect(0, y, this.W, 1);
    }
    c.globalAlpha = 1.0;
  }

  drawEdgeFade(c) {
    const gradient = c.createLinearGradient(0, 0, this.W, 0);
    gradient.addColorStop(0, 'rgba(230, 200, 150, 0.15)');
    gradient.addColorStop(0.05, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.95, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(230, 200, 150, 0.15)');
    c.fillStyle = gradient;
    c.fillRect(0, 0, this.W, this.H);
  }

  drawReceiptContent(c) {
    // 热敏纸墨色：深蓝黑（热敏墨特征）
    const tc = '#1A1A2A';
    const fc = '#3A3A52';
    c.textAlign = 'center';

    let y0 = 50;

    const line = (txt, sz, color) => {
      c.fillStyle = color || tc;
      c.font = `${sz}px 'Courier New', monospace`;
      c.fillText(txt, this.W / 2, y0);
      y0 += sz * 1.5;
    };

    const dashLine = () => {
      c.strokeStyle = tc;
      c.lineWidth = 1;
      c.setLineDash([6, 4]);
      c.beginPath();
      c.moveTo(40, y0);
      c.lineTo(this.W - 40, y0);
      c.stroke();
      c.setLineDash([]);
      y0 += 16;
    };

    const solidLine = () => {
      c.strokeStyle = tc;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(40, y0);
      c.lineTo(this.W - 40, y0);
      c.stroke();
      y0 += 16;
    };

    const doubleLine = () => {
      c.strokeStyle = tc;
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(40, y0);
      c.lineTo(this.W - 40, y0);
      c.stroke();
      c.beginPath();
      c.moveTo(40, y0 + 5);
      c.lineTo(this.W - 40, y0 + 5);
      c.stroke();
      y0 += 18;
    };

    const item = (product) => {
      c.fillStyle = tc;
      c.font = '17px "Courier New", monospace';
      c.textAlign = 'left';
      c.fillText(product.name, 44, y0);
      c.textAlign = 'right';
      c.fillText(`${product.quantity} x ${product.price}`, this.W - 44, y0);
      c.textAlign = 'center';

      this.productPositions.push({
        id: product.id,
        y: y0,
        height: 24
      });

      y0 += 24;
    };

    line('===============================', 16, tc);
    line('\u{1F5A5} 3D图形用品超市 \u{1F5A5}', 22, tc);
    line('3D GRAPHICS SUPPLY STORE', 13, fc);
    line('===============================', 16, tc);
    y0 += 4;
    line(`日期: ${new Date().toLocaleDateString('zh-CN')} ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`, 14, fc);
    line('单号: GL-20260518-001', 14, fc);
    line('收银员: GPU #0 (CUDA Cores)', 14, fc);
    line('===============================', 16, tc);
    y0 += 4;
    dashLine();
    y0 += 2;

    c.fillStyle = tc;
    c.font = 'bold 15px "Courier New", monospace';
    c.textAlign = 'left';
    c.fillText('商品名', 44, y0);
    c.textAlign = 'right';
    c.fillText('数量×单价  金额', this.W - 44, y0);
    c.textAlign = 'center';
    y0 += 22;
    dashLine();
    y0 += 4;

    products.forEach(p => item(p));

    y0 += 4;
    dashLine();
    y0 += 6;

    c.textAlign = 'right';
    c.fillStyle = tc;
    c.font = '16px "Courier New", monospace';

    const subtotal = products.reduce((sum, p) => sum + parseFloat(p.price) * p.quantity, 0);
    const tax = subtotal * 0.13;
    const total = subtotal + tax;

    c.fillText(`小计:           ${subtotal.toFixed(2)}`, this.W - 44, y0);
    y0 += 24;
    c.fillText(`渲染税(13%):      ${tax.toFixed(2)}`, this.W - 44, y0);
    y0 += 24;
    solidLine();
    y0 += 4;
    c.font = 'bold 20px "Courier New", monospace';
    c.fillText(`总计:       ¥${total.toFixed(2)}`, this.W - 44, y0);
    y0 += 28;

    doubleLine();
    y0 += 8;
    c.textAlign = 'center';
    line('\u{1F389} 感谢惠顾！帧率永不低于60！ \u{1F389}', 16, tc);
    line('扫码获取你的 Shader', 14, fc);
    y0 += 10;

    // I1: 程序生成二维码
    this.drawQRCode(c, this.W / 2 - 50, y0, 100);
    y0 += 110;
    line('Powered by Verlet Physics + WebGL', 11, fc);
    y0 += 4;
    line('===============================', 16, tc);

    this.drawCustomImage(c);
  }

  // I1: 程序生成装饰性二维码（21x21 伪随机矩阵 + 定位角）
  drawQRCode(c, x, y, size) {
    const cells = 21;
    const cellSize = size / cells;
    c.fillStyle = '#1A1A2A';

    // 用确定性伪随机生成二维码图案
    const pattern = [];
    for (let i = 0; i < cells * cells; i++) {
      pattern.push((Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1 > 0.5 ? 1 : 0);
    }

    // 绘制数据区
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        // 跳过三个定位角区域（7x7）
        const inCorner =
          (row < 7 && col < 7) ||
          (row < 7 && col >= cells - 7) ||
          (row >= cells - 7 && col < 7);
        if (inCorner) continue;

        if (pattern[row * cells + col]) {
          c.fillRect(x + col * cellSize, y + row * cellSize, cellSize, cellSize);
        }
      }
    }

    // 绘制三个定位角（7x7 嵌套方块）
    const drawCorner = (cx, cy) => {
      c.fillRect(x + cx * cellSize, y + cy * cellSize, 7 * cellSize, 7 * cellSize);
      c.fillStyle = '#f6f1e3';
      c.fillRect(x + (cx + 1) * cellSize, y + (cy + 1) * cellSize, 5 * cellSize, 5 * cellSize);
      c.fillStyle = '#1A1A2A';
      c.fillRect(x + (cx + 2) * cellSize, y + (cy + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    };
    drawCorner(0, 0);
    drawCorner(cells - 7, 0);
    drawCorner(0, cells - 7);
  }

  drawCustomImage(c) {
    if (!this.customImage) return;
    const cfg = this.customImageConfig;
    const img = this.customImage;

    const baseSize = Math.min(this.W, this.H) * cfg.scale;
    const imgAspect = img.width / img.height;
    let drawW, drawH;
    if (imgAspect > 1) {
      drawW = baseSize * imgAspect;
      drawH = baseSize;
    } else {
      drawW = baseSize;
      drawH = baseSize / imgAspect;
    }

    const cx = cfg.x * this.W;
    const cy = cfg.y * this.H;

    c.save();
    c.globalAlpha = cfg.opacity;
    c.translate(cx, cy);
    c.rotate(cfg.rotation);
    c.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    c.restore();
  }

  setCustomImage(img) {
    this.customImage = img;
  }

  setCustomImageConfig(config) {
    Object.assign(this.customImageConfig, config);
  }

  getCustomImageConfig() {
    return { ...this.customImageConfig };
  }

  clearCustomImage() {
    this.customImage = null;
  }

  getProductByUV(uvY, clothHeight) {
    const worldY = (uvY - 0.5) * clothHeight;
    const canvasY = (worldY + clothHeight / 2) / clothHeight * this.H;
    const pos = this.productPositions.find(p => canvasY >= p.y - 12 && canvasY <= p.y + p.height);
    if (!pos) return null;
    return products.find(p => p.id === pos.id) || pos;
  }
}