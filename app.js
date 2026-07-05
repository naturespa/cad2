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

function createSolidBox(width, depth, height) {
  boxPart(width, height, depth, 0, height / 2, 0);
}

function createCone(diameter, height) {
  addMesh(new THREE.ConeGeometry(diameter / 2, height, 64), materials.body, [0, height / 2, 0]);
}

function createPyramid(width, depth, height) {
  const geometry = new THREE.ConeGeometry(Math.max(width, depth) / Math.SQRT2, height, 4);
  const pyramid = addMesh(geometry, materials.body, [0, height / 2, 0]);
  pyramid.scale.x = width / Math.max(width, depth);
  pyramid.scale.z = depth / Math.max(width, depth);
  pyramid.rotation.y = Math.PI / 4;
}

function createPrism(sides, diameter, height) {
  addMesh(new THREE.CylinderGeometry(diameter / 2, diameter / 2, height, sides), materials.body, [0, height / 2, 0]);
}

function createPlateWithHole(width, depth, thickness, holeDiameter) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -depth / 2);
  shape.lineTo(width / 2, -depth / 2);
  shape.lineTo(width / 2, depth / 2);
  shape.lineTo(-width / 2, depth / 2);
  shape.lineTo(-width / 2, -depth / 2);

  if (holeDiameter > 0) {
    const hole = new THREE.Path();
    hole.absellipse(0, 0, holeDiameter / 2, holeDiameter / 2, 0, Math.PI * 2, false);
    shape.holes.push(hole);
  }

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  addMesh(geometry, materials.body, [0, thickness, 0], [-Math.PI / 2, 0, 0]);
}

function createUHandle(width, height, depth, yOffset = 0) {
  const postRadius = Math.max(2, Math.min(width, height) * 0.08);
  addMesh(new THREE.CylinderGeometry(postRadius, postRadius, height, 24), materials.accent, [-width / 2, yOffset + height / 2, depth / 2]);
  addMesh(new THREE.CylinderGeometry(postRadius, postRadius, height, 24), materials.accent, [width / 2, yOffset + height / 2, depth / 2]);
  addMesh(
    new THREE.CylinderGeometry(postRadius, postRadius, width, 24),
    materials.accent,
    [0, yOffset + height, depth / 2],
    [0, 0, Math.PI / 2],
  );
}

function createFourLegs(width, depth, height, radius) {
  const x = width / 2 - radius * 2;
  const z = depth / 2 - radius * 2;
  [[-x, -z], [x, -z], [-x, z], [x, z]].forEach(([legX, legZ]) => {
    addMesh(new THREE.CylinderGeometry(radius, radius, height, 24), materials.dark, [legX, height / 2, legZ]);
  });
}

function createStairs(width, depth, height, steps) {
  const stepDepth = depth / steps;
  const stepHeight = height / steps;
  for (let i = 0; i < steps; i += 1) {
    const blockHeight = stepHeight * (i + 1);
    const z = -depth / 2 + stepDepth * i + stepDepth / 2;
    boxPart(width, blockHeight, stepDepth, 0, blockHeight / 2, z, i % 2 ? materials.body : materials.accent);
  }
}

function createRoof(width, depth, height, yOffset = 0) {
  const geometry = new THREE.BufferGeometry();
  const w = width / 2;
  const d = depth / 2;
  const vertices = new Float32Array([
    -w, 0, -d, w, 0, -d, 0, height, -d,
    -w, 0, d, 0, height, d, w, 0, d,
    -w, 0, -d, -w, 0, d, w, 0, d,
    -w, 0, -d, w, 0, d, w, 0, -d,
    -w, 0, -d, 0, height, -d, 0, height, d,
    -w, 0, -d, 0, height, d, -w, 0, d,
    w, 0, -d, w, 0, d, 0, height, d,
    w, 0, -d, 0, height, d, 0, height, -d,
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  addMesh(geometry, materials.accent, [0, yOffset, 0]);
}

function createChair(width, depth, height) {
  const seatHeight = Math.max(20, height * 0.42);
  const seatThickness = Math.max(5, height * 0.08);
  createFourLegs(width, depth, seatHeight, Math.max(2.5, Math.min(width, depth) * 0.045));
  boxPart(width, seatThickness, depth, 0, seatHeight + seatThickness / 2, 0, materials.body);
  boxPart(width, height - seatHeight, Math.max(5, depth * 0.12), 0, seatHeight + (height - seatHeight) / 2, depth / 2, materials.accent);
}

function createTable(width, depth, height) {
  const topThickness = Math.max(5, height * 0.1);
  createFourLegs(width, depth, height - topThickness, Math.max(3, Math.min(width, depth) * 0.045));
  boxPart(width, topThickness, depth, 0, height - topThickness / 2, 0, materials.body);
}

function createHouse(width, depth, height) {
  const bodyHeight = height * 0.68;
  createSolidBox(width, depth, bodyHeight);
  createRoof(width * 1.12, depth * 1.12, height - bodyHeight, bodyHeight);
  boxPart(width * 0.22, bodyHeight * 0.42, 3, 0, bodyHeight * 0.21, -depth / 2 - 1.5, materials.dark);
  boxPart(width * 0.18, bodyHeight * 0.18, 3, -width * 0.26, bodyHeight * 0.55, -depth / 2 - 1.5, materials.accent);
  boxPart(width * 0.18, bodyHeight * 0.18, 3, width * 0.26, bodyHeight * 0.55, -depth / 2 - 1.5, materials.accent);
}

function createVehicle(width, depth, height) {
  const wheelRadius = Math.max(5, Math.min(width, depth) * 0.1);
  boxPart(width, height * 0.42, depth, 0, wheelRadius + height * 0.21, 0, materials.body);
  boxPart(width * 0.48, height * 0.34, depth * 0.72, width * 0.05, wheelRadius + height * 0.59, 0, materials.accent);
  [[-width * 0.32, -depth / 2 - 1], [width * 0.32, -depth / 2 - 1], [-width * 0.32, depth / 2 + 1], [width * 0.32, depth / 2 + 1]].forEach(([x, z]) => {
    addMesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, 5, 32), materials.dark, [x, wheelRadius, z], [Math.PI / 2, 0, 0]);
  });
}

function createAirplane(width, depth, height) {
  addMesh(new THREE.CylinderGeometry(height * 0.16, height * 0.2, width, 32), materials.body, [0, height * 0.48, 0], [0, 0, Math.PI / 2]);
  boxPart(width * 0.42, Math.max(3, height * 0.06), depth, 0, height * 0.48, 0, materials.accent);
  boxPart(width * 0.18, Math.max(3, height * 0.05), depth * 0.45, -width * 0.42, height * 0.66, 0, materials.accent);
  createCone(height * 0.34, width * 0.18);
  modelGroup.children.at(-1).position.set(width * 0.58, height * 0.48, 0);
  modelGroup.children.at(-1).rotation.z = -Math.PI / 2;
}

function createBoat(width, depth, height) {
  createPrism(3, Math.max(width, depth), height * 0.42);
  const hull = modelGroup.children.at(-1);
  hull.scale.z = depth / Math.max(width, depth);
  hull.position.y = height * 0.21;
  hull.rotation.z = Math.PI;
  boxPart(width * 0.55, height * 0.28, depth * 0.52, 0, height * 0.55, 0, materials.accent);
}

function createAnimal(width, depth, height) {
  addMesh(new THREE.SphereGeometry(Math.min(width, depth) * 0.26, 32, 16), materials.body, [0, height * 0.48, 0]);
  addMesh(new THREE.SphereGeometry(Math.min(width, depth) * 0.18, 32, 16), materials.accent, [width * 0.34, height * 0.6, 0]);
  createFourLegs(width * 0.72, depth * 0.62, height * 0.34, Math.max(2.5, Math.min(width, depth) * 0.045));
  addMesh(new THREE.CylinderGeometry(2.5, 2.5, width * 0.32, 16), materials.dark, [-width * 0.34, height * 0.6, 0], [0, 0, Math.PI / 3]);
  if (height > 35) {
    createCone(Math.min(width, depth) * 0.14, height * 0.18);
    modelGroup.children.at(-1).position.set(width * 0.3, height * 0.82, -depth * 0.08);
    createCone(Math.min(width, depth) * 0.14, height * 0.18);
    modelGroup.children.at(-1).position.set(width * 0.3, height * 0.82, depth * 0.08);
  }
}

function baseDimensions(normalized, values) {
  return {
    width: valueAfter(normalized, ["幅", "横"], values[0] || 80),
    depth: valueAfter(normalized, ["奥行き", "奥行", "深さ"], values[1] || 50),
    height: valueAfter(normalized, ["高さ", "縦"], values[2] || 30),
  };
}

function buildCompositeModel(normalized, values) {
  const has = (...words) => words.some((word) => normalized.includes(word));
  const { width, depth, height } = baseDimensions(normalized, values);
  const made = [];

  if (has("椅子", "イス", "いす", "チェア", "chair", "座面", "背もたれ")) {
    createChair(width, depth, height);
    made.push("椅子");
  }

  if (has("机", "テーブル", "デスク", "table", "desk", "天板")) {
    createTable(width, depth, height);
    made.push("テーブル");
  }

  if (has("家", "住宅", "建物", "小屋", "house", "home", "屋根")) {
    createHouse(width, depth, height);
    made.push("家");
  }

  if (
    has("自動車", "カー", "car", "vehicle", "タイヤ", "車輪") ||
    (has("車") && !has("椅子", "イス", "いす", "チェア", "飛行機", "航空機", "船", "ボート"))
  ) {
    createVehicle(width, depth, height);
    made.push("車");
  }

  if (has("飛行機", "航空機", "airplane", "aircraft", "翼")) {
    createAirplane(width, depth, height);
    made.push("飛行機");
  }

  if (has("船", "ボート", "boat", "ship", "舟")) {
    createBoat(width, depth, height);
    made.push("船");
  }

  if (has("猫", "犬", "動物", "animal", "ネコ", "イヌ")) {
    createAnimal(width, depth, height);
    made.push("動物");
  }

  if (has("階段", "段々", "段差")) {
    createStairs(width, depth, height, Math.round(valueAfter(normalized, ["段"], 4)));
    made.push("階段");
  }

  if (has("板", "プレート", "パネル", "札")) {
    const thickness = valueAfter(normalized, ["厚さ"], Math.min(8, Math.max(3, height)));
    const hole = has("穴", "孔") ? valueAfter(normalized, ["穴", "内径", "直径"], Math.min(width, depth) * 0.28) : 0;
    createPlateWithHole(width, depth, thickness, hole);
    made.push(hole ? "穴あき板" : "板");
  }

  if (has("台座", "土台", "ベース", "台")) {
    boxPart(width, Math.max(6, height * 0.18), depth, 0, Math.max(6, height * 0.18) / 2, 0, materials.dark);
    made.push("台座");
  }

  if (has("箱", "四角", "直方体", "ブロック")) {
    createSolidBox(width, depth, height);
    made.push("箱");
  }

  if (has("円すい", "円錐", "コーン")) {
    const diameter = valueAfter(normalized, ["直径", "径"], Math.min(width, depth));
    createCone(diameter, height);
    made.push("円すい");
  }

  if (has("ピラミッド", "四角すい", "四角錐")) {
    createPyramid(width, depth, height);
    made.push("ピラミッド");
  }

  if (has("三角柱")) {
    createPrism(3, valueAfter(normalized, ["直径", "幅"], width), height);
    made.push("三角柱");
  } else if (has("六角", "六角柱")) {
    createPrism(6, valueAfter(normalized, ["直径", "幅"], width), height);
    made.push("六角柱");
  }

  if (has("円柱", "丸棒", "棒")) {
    const diameter = valueAfter(normalized, ["直径", "径"], Math.min(width, depth));
    createCylinder(diameter / 2, height);
    made.push("円柱");
  }

  if (has("球", "ボール", "丸")) {
    const diameter = valueAfter(normalized, ["直径", "径"], Math.min(width, depth, height));
    createSphere(diameter / 2);
    made.push("球");
  }

  if (has("屋根") && !made.includes("家")) {
    createRoof(width * 1.12, depth * 1.12, Math.max(14, height * 0.35), height);
    made.push("屋根");
  }

  if (has("足", "脚")) {
    createFourLegs(width, depth, Math.max(18, height * 0.55), Math.max(3, Math.min(width, depth) * 0.06));
    if (!has("板", "プレート", "台座", "土台", "ベース")) {
      boxPart(width, Math.max(5, height * 0.12), depth, 0, Math.max(18, height * 0.55) + Math.max(5, height * 0.12) / 2, 0, materials.body);
    }
    made.push("4本足");
  }

  if (has("取っ手", "持ち手", "ハンドル")) {
    createUHandle(Math.min(width * 0.72, 70), Math.max(18, height * 0.45), Math.min(depth * 0.6, 40), height);
    made.push("取っ手");
  }

  if (!made.length) {
    createSolidBox(width, depth, height);
    if (values.length >= 4) {
      createCylinder((values[3] || 20) / 2, Math.max(12, height * 0.45));
      modelGroup.children.at(-1).position.y += height;
      made.push("自由形状");
    } else {
      made.push("基本形状");
    }
  }

  return {
    type: made.join(" + "),
    size: `${width} x ${depth} x ${height} mm`,
  };
}

function buildFromPrompt(text) {
  const normalized = text.replace(/\s+/g, "");
  const values = numberList(text);
  const has = (...words) => words.some((word) => normalized.includes(word));
  const compositeTerms = [
    "板", "プレート", "パネル", "札", "穴", "孔", "台座", "土台", "ベース", "台",
    "箱", "四角", "直方体", "ブロック", "円すい", "円錐", "コーン", "ピラミッド",
    "四角すい", "四角錐", "三角柱", "六角", "屋根", "足", "脚", "取っ手", "持ち手",
    "ハンドル", "階段", "段々", "段差", "椅子", "イス", "いす", "チェア",
    "机", "テーブル", "デスク", "家", "住宅", "建物", "小屋", "車", "自動車",
    "カー", "タイヤ", "車輪", "飛行機", "航空機", "翼", "船", "ボート", "猫",
    "犬", "動物", "animal",
  ];
  const matchedCompositeTerms = compositeTerms.filter((term) => normalized.includes(term));
  const looksComposed = matchedCompositeTerms.length > 1 || ["と", "付き", "つき", "に", "上に", "乗せ"].some((term) => normalized.includes(term));

  if (matchedCompositeTerms.length && looksComposed) {
    return buildCompositeModel(normalized, values);
  }

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

  if (matchedCompositeTerms.length) {
    return buildCompositeModel(normalized, values);
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

async function fetchReferences(prompt) {
  try {
    const response = await fetch(`/api/reference?q=${encodeURIComponent(prompt)}`);
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return payload.references || [];
  } catch {
    return [];
  }
}

function enrichPrompt(prompt, references) {
  const referenceText = references
    .map((reference) => `${reference.title || ""} ${reference.text || ""}`)
    .join(" ");
  return `${prompt} ${referenceText}`;
}

async function generateModel() {
  generateButton.disabled = true;
  message.textContent = "インターネットで形の参考情報を探しています。";
  try {
    clearModel();
    const prompt = promptInput.value.trim() || "幅80mm 奥行き50mm 高さ30mm の小物入れ";
    const references = await fetchReferences(prompt);
    const result = buildFromPrompt(enrichPrompt(prompt, references));
    currentName = `cad2-${result.type}`;
    modelType.textContent = result.type;
    modelSize.textContent = result.size;
    partCount.textContent = `${modelGroup.children.length}`;
    message.textContent = references.length
      ? `Web参照を使ってモデルを生成しました: ${references.map((reference) => reference.source).join(" / ")}`
      : "Web参照が使えなかったため、手元の形状ルールでモデルを生成しました。";
    fitCamera();
  } finally {
    generateButton.disabled = false;
  }
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

async function exportStl() {
  if (!modelGroup.children.length) {
    await generateModel();
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
