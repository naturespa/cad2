import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.165.0/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#modelCanvas");
const promptInput = document.querySelector("#promptInput");
const generateButton = document.querySelector("#generateButton");
const downloadButton = document.querySelector("#downloadButton");
const message = document.querySelector("#message");
const modelType = document.querySelector("#modelType");
const modelSize = document.querySelector("#modelSize");
const partCount = document.querySelector("#partCount");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f7fa);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
camera.position.set(160, 130, 180);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 18, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa6b2, 2.4));

const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
keyLight.position.set(120, 180, 90);
keyLight.castShadow = true;
scene.add(keyLight);

const grid = new THREE.GridHelper(220, 22, 0x91a0ad, 0xc8d0d8);
scene.add(grid);

const axes = new THREE.AxesHelper(72);
scene.add(axes);

const modelGroup = new THREE.Group();
scene.add(modelGroup);

const materials = {
  body: new THREE.MeshStandardMaterial({ color: 0x27a69a, roughness: 0.58, metalness: 0.02 }),
  accent: new THREE.MeshStandardMaterial({ color: 0xf0b23d, roughness: 0.5, metalness: 0.04 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x384454, roughness: 0.66, metalness: 0.01 }),
};

let currentName = "cad2-model";

function numberList(text) {
  const values = [];
  const pattern = /(\d+(?:\.\d+)?)\s*(cm|センチ|mm|ミリ)?/gi;
  for (const match of text.matchAll(pattern)) {
    const unit = match[2] || "mm";
    const multiplier = unit === "cm" || unit === "センチ" ? 10 : 1;
    values.push(Number(match[1]) * multiplier);
  }
  return values;
}

function valueAfter(text, labels, fallback) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*(\\d+(?:\\.\\d+)?)\\s*(cm|センチ|mm|ミリ)?`, "i");
    const match = text.match(pattern);
    if (match) {
      const multiplier = match[2] === "cm" || match[2] === "センチ" ? 10 : 1;
      return Number(match[1]) * multiplier;
    }
  }
  return fallback;
}

function clearModel() {
  while (modelGroup.children.length) {
    const child = modelGroup.children.pop();
    child.geometry?.dispose();
  }
}

function addMesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  modelGroup.add(mesh);
  return mesh;
}

function boxPart(width, height, depth, x, y, z, material = materials.body) {
  return addMesh(new THREE.BoxGeometry(width, height, depth), material, [x, y, z]);
}

function createTray(width, depth, height, wall) {
  boxPart(width, wall, depth, 0, wall / 2, 0, materials.accent);
  boxPart(wall, height, depth, -width / 2 + wall / 2, height / 2, 0);
  boxPart(wall, height, depth, width / 2 - wall / 2, height / 2, 0);
  boxPart(width, height, wall, 0, height / 2, -depth / 2 + wall / 2);
  boxPart(width, height, wall, 0, height / 2, depth / 2 - wall / 2);
}

function createPhoneStand(width, height, depth) {
  const baseDepth = Math.max(46, depth);
  boxPart(width, 8, baseDepth, 0, 4, 0, materials.dark);
  boxPart(width, 7, 12, 0, 11, -baseDepth / 2 + 11, materials.accent);
  const back = boxPart(width, height, 7, 0, height / 2 + 6, 14, materials.body);
  back.rotation.x = THREE.MathUtils.degToRad(-14);
  boxPart(width * 0.76, 6, 10, 0, 18, -baseDepth / 2 + 23, materials.accent);
}

function createHook(width, height, depth) {
  boxPart(width, height, 6, 0, height / 2, 0, materials.dark);
  const peg = addMesh(
    new THREE.CylinderGeometry(depth / 2, depth / 2, Math.max(26, width * 0.55), 48),
    materials.body,
    [0, height * 0.55, 18],
    [Math.PI / 2, 0, 0],
  );
  peg.name = "round-hook";
  addMesh(new THREE.SphereGeometry(depth / 2 + 2, 32, 16), materials.accent, [0, height * 0.55, 38]);
}

function createCylinder(radius, height) {
  addMesh(new THREE.CylinderGeometry(radius, radius, height, 72), materials.body, [0, height / 2, 0]);
}

function createSphere(radius) {
  addMesh(new THREE.SphereGeometry(radius, 48, 24), materials.body, [0, radius, 0]);
}

function createRing(outerRadius, innerRadius, thickness) {
  const tube = Math.max(1.5, (outerRadius - innerRadius) / 2);
  const centerRadius = innerRadius + tube;
  const ring = addMesh(new THREE.TorusGeometry(centerRadius, tube, 28, 96), materials.body, [0, thickness / 2, 0], [Math.PI / 2, 0, 0]);
  ring.scale.y = thickness / (tube * 2);
}

function buildFromPrompt(text) {
  const normalized = text.replace(/\s+/g, "");
  const values = numberList(text);
  const has = (...words) => words.some((word) => normalized.includes(word));

  if (has("スマホ", "スマートフォン", "携帯", "スタンド")) {
    const width = valueAfter(normalized, ["幅", "横"], values[0] || 72);
    const height = valueAfter(normalized, ["高さ", "縦"], values[1] || 92);
    const depth = valueAfter(normalized, ["奥行き", "奥行", "深さ"], values[2] || 62);
    createPhoneStand(width, height, depth);
    return { type: "スマホスタンド", size: `${width} x ${depth} x ${height} mm` };
  }

  if (has("フック", "掛け", "かける")) {
    const width = valueAfter(normalized, ["幅", "横"], values[0] || 48);
    const height = valueAfter(normalized, ["高さ", "縦"], values[1] || 62);
    const depth = valueAfter(normalized, ["奥行き", "長さ", "出幅"], values[2] || 18);
    createHook(width, height, depth);
    return { type: "フック", size: `${width} x ${depth} x ${height} mm` };
  }

  if (has("リング", "輪", "ドーナツ")) {
    const outer = valueAfter(normalized, ["外径", "直径"], values[0] || 50);
    const inner = valueAfter(normalized, ["内径", "穴"], values[1] || outer * 0.45);
    const thickness = valueAfter(normalized, ["厚さ", "高さ"], values[2] || 8);
    createRing(outer / 2, inner / 2, thickness);
    return { type: "リング", size: `外径${outer} 内径${inner} 厚さ${thickness} mm` };
  }

  if (has("球", "ボール", "丸")) {
    const diameter = valueAfter(normalized, ["直径", "径"], values[0] || 40);
    createSphere(diameter / 2);
    return { type: "球", size: `直径${diameter} mm` };
  }

  if (has("円柱", "丸棒", "棒")) {
    const diameter = valueAfter(normalized, ["直径", "径"], values[0] || 36);
    const height = valueAfter(normalized, ["高さ", "長さ"], values[1] || 60);
    createCylinder(diameter / 2, height);
    return { type: "円柱", size: `直径${diameter} 高さ${height} mm` };
  }

  const width = valueAfter(normalized, ["幅", "横"], values[0] || 80);
  const depth = valueAfter(normalized, ["奥行き", "奥行", "深さ"], values[1] || 50);
  const height = valueAfter(normalized, ["高さ", "縦"], values[2] || 30);
  const wall = Math.min(4, Math.max(2, valueAfter(normalized, ["厚さ", "肉厚"], 3)));
  createTray(width, depth, height, wall);
  return { type: "小物入れ", size: `${width} x ${depth} x ${height} mm / 壁${wall} mm` };
}

function fitCamera() {
  const box = new THREE.Box3().setFromObject(modelGroup);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 60);
  const distance = maxSize * 2.25;
  camera.position.set(center.x + distance, center.y + distance * 0.7, center.z + distance);
  controls.target.copy(center);
  controls.update();
}

function generateModel() {
  clearModel();
  const prompt = promptInput.value.trim() || "幅80mm 奥行き50mm 高さ30mm の小物入れ";
  const result = buildFromPrompt(prompt);
  currentName = `cad2-${result.type}`;
  modelType.textContent = result.type;
  modelSize.textContent = result.size;
  partCount.textContent = `${modelGroup.children.length}`;
  message.textContent = "モデルを生成しました。ドラッグで回転、ホイールで拡大できます。";
  fitCamera();
}

function triangleToStl(a, b, c) {
  const cb = new THREE.Vector3().subVectors(c, b);
  const ab = new THREE.Vector3().subVectors(a, b);
  const normal = cb.cross(ab).normalize();
  return [
    `facet normal ${normal.x} ${normal.y} ${normal.z}`,
    "  outer loop",
    `    vertex ${a.x} ${a.y} ${a.z}`,
    `    vertex ${b.x} ${b.y} ${b.z}`,
    `    vertex ${c.x} ${c.y} ${c.z}`,
    "  endloop",
    "endfacet",
  ].join("\n");
}

function exportStl() {
  if (!modelGroup.children.length) {
    generateModel();
  }

  modelGroup.updateMatrixWorld(true);
  const chunks = [`solid ${currentName}`];

  modelGroup.traverse((object) => {
    if (!object.isMesh) return;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    const position = geometry.getAttribute("position");

    for (let i = 0; i < position.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
      const b = new THREE.Vector3().fromBufferAttribute(position, i + 1).applyMatrix4(object.matrixWorld);
      const c = new THREE.Vector3().fromBufferAttribute(position, i + 2).applyMatrix4(object.matrixWorld);
      chunks.push(triangleToStl(a, b, c));
    }

    geometry.dispose();
  });

  chunks.push(`endsolid ${currentName}`);
  const blob = new Blob([chunks.join("\n")], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${currentName}.stl`;
  link.click();
  URL.revokeObjectURL(url);
  message.textContent = "STLファイルを保存しました。";
}

function resize() {
  const { clientWidth, clientHeight } = canvas.parentElement;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
}

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

generateButton.addEventListener("click", generateModel);
downloadButton.addEventListener("click", exportStl);

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    promptInput.value = button.dataset.example;
    generateModel();
  });
});

window.addEventListener("resize", resize);
resize();
generateModel();
animate();
