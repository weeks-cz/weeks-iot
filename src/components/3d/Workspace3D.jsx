"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Frustum,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Scene,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Euler,
  Vector3,
} from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport, Grid, OrbitControls, TransformControls } from "@react-three/drei";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import helvetikerFont from "three/examples/fonts/helvetiker_regular.typeface.json";
import {
  ArrowLeft,
  Box,
  Check,
  Combine,
  Crosshair,
  Download,
  LocateFixed,
  Magnet,
  Move3D,
  Ruler,
  Rotate3D,
  Scale3D,
  Ungroup,
} from "lucide-react";
import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from "three-bvh-csg";
import { useWorkspace3DStore } from "./Workspace3DStore";

const SHAPE_LABELS = {
  box: "Cube",
  sphere: "Sphere",
  cylinder: "Cylinder",
  cone: "Cone",
  pyramid: "Pyramid",
  wedge: "Wedge",
  hemisphere: "Hemisphere",
  torus: "Torus",
  star: "Star",
  text3d: "3D Text",
};
const SEGMENT_LIMITS = {
  sphere: { min: 8, max: 96, label: "Segments" },
  cylinder: { min: 3, max: 96, label: "Sides" },
  cone: { min: 3, max: 96, label: "Sides" },
  pyramid: { min: 3, max: 12, label: "Sides" },
  hemisphere: { min: 8, max: 96, label: "Segments" },
  torus: { min: 8, max: 96, label: "Segments" },
};

const UNIT_OPTIONS = [
  { value: "mm", label: "mm", factor: 1 },
  { value: "cm", label: "cm", factor: 0.1 },
  { value: "m", label: "m", factor: 0.001 },
  { value: "inch", label: "inch", factor: 0.0393701 },
];
const GIZMO_X_COLOR = "#cc2222";
const GIZMO_Y_COLOR = "#008800";
const GIZMO_Z_COLOR = "#1f5cff";
const GIZMO_ACTIVE_COLOR = "#333333";
const SCREEN_SPACE_ROTATION_COLOR = "#000000";
const AXES = ["X", "Y", "Z"];
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const DEFAULT_BASE_SIZE = [1, 1, 1];
const PITCH = 1;
const WORLD_UP = new Vector3(0, 0, 1);
const handleBox = new Box3();
const handleCenter = new Vector3();
const handleSize = new Vector3();
const sharedBox = new Box3();
const sharedCenter = new Vector3();
const sharedDeltaMatrix = new Matrix4();
const sharedInitialInverse = new Matrix4();
const sharedNextMatrix = new Matrix4();
const sharedPosition = new Vector3();
const sharedQuaternion = new Quaternion();
const sharedScale = new Vector3();
const sharedWorldPosition = new Vector3();
const sharedWorldQuaternion = new Quaternion();
const sharedWorldScale = new Vector3();
const selectionBox = new Box3();
const selectionCorner = new Vector3();
const selectionFrustum = new Frustum();
const selectionViewProjection = new Matrix4();
const textFont = new FontLoader().parse(helvetikerFont);
const pyramidBaseRadius = Math.SQRT1_2;

function segmentCountFor(comp, fallback = 32) {
  const value = Number.parseInt(comp?.segments, 10);
  const limits = SEGMENT_LIMITS[comp?.type];
  const min = limits?.min ?? 3;
  const max = limits?.max ?? 96;
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function normalizeScreenRect(start, end) {
  return {
    left: Math.min(start.x, end.x),
    right: Math.max(start.x, end.x),
    top: Math.min(start.y, end.y),
    bottom: Math.max(start.y, end.y),
  };
}

function rectsIntersect(a, b) {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function snapVector(values) {
  return values.map((value) => Math.round(value / PITCH) * PITCH);
}

function rotationDegreesFor(quat) {
  const euler = new Euler().setFromQuaternion(new Quaternion(...quat), "XYZ");
  return [euler.x * RAD_TO_DEG, euler.y * RAD_TO_DEG, euler.z * RAD_TO_DEG];
}

function quaternionFromRotationDegrees(values) {
  return new Quaternion().setFromEuler(new Euler(values[0] * DEG_TO_RAD, values[1] * DEG_TO_RAD, values[2] * DEG_TO_RAD, "XYZ")).toArray();
}

function measureComps(comps, unitFactor = 1) {
  if (comps.length === 0) return null;

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const comp of comps) {
    const size = renderedDimensionsForComp(comp);
    for (let index = 0; index < 3; index += 1) {
      min[index] = Math.min(min[index], comp.pos[index]);
      max[index] = Math.max(max[index], comp.pos[index] + size[index]);
    }
  }

  return max.map((value, index) => Math.max(value - min[index], 0) * unitFactor);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value) {
  return (value || "model").replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") || "model";
}

function projectObjectBoxToScreen(object, camera, domElement) {
  selectionBox.setFromObject(object);
  if (selectionBox.isEmpty()) return null;

  const bounds = domElement.getBoundingClientRect();
  const projectedRect = {
    left: Infinity,
    right: -Infinity,
    top: Infinity,
    bottom: -Infinity,
  };

  for (const x of [selectionBox.min.x, selectionBox.max.x]) {
    for (const y of [selectionBox.min.y, selectionBox.max.y]) {
      for (const z of [selectionBox.min.z, selectionBox.max.z]) {
        selectionCorner.set(x, y, z).project(camera);
        const screenX = bounds.left + ((selectionCorner.x + 1) / 2) * bounds.width;
        const screenY = bounds.top + ((1 - selectionCorner.y) / 2) * bounds.height;
        projectedRect.left = Math.min(projectedRect.left, screenX);
        projectedRect.right = Math.max(projectedRect.right, screenX);
        projectedRect.top = Math.min(projectedRect.top, screenY);
        projectedRect.bottom = Math.max(projectedRect.bottom, screenY);
      }
    }
  }

  return projectedRect;
}

function geometryCenterForObject(object, target = new Vector3()) {
  if (!object) return null;
  object.updateMatrixWorld(true);
  const box = new Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  return box.getCenter(target);
}

function lockPositiveConePointers(transformControls) {
  const translateGizmo = transformControls?._gizmo?.gizmo?.translate;
  if (!translateGizmo) return;

  for (const handle of translateGizmo.children) {
    if (handle.name !== "X" && handle.name !== "Y" && handle.name !== "Z") continue;
    if (!handle.geometry) continue;

    handle.scale.set(Math.abs(handle.scale.x), Math.abs(handle.scale.y), Math.abs(handle.scale.z));

    handle.geometry.computeBoundingBox();
    handleBox.copy(handle.geometry.boundingBox);
    handleBox.getCenter(handleCenter);
    handleBox.getSize(handleSize);

    const axis = handle.name.toLowerCase();
    const crossSizes = ["x", "y", "z"].filter((key) => key !== axis).map((key) => handleSize[key]);
    const isConeTip = handleSize[axis] < 0.18 && Math.max(...crossSizes) > 0.04;

    if (!isConeTip) continue;

    if (handleCenter[axis] < 0) {
      handle.visible = false;
      handle.scale.setScalar(1e-10);
      continue;
    }

    handle.visible = true;
    handle.quaternion.identity();
  }
}

function forcePositiveGizmoScales(transformControls) {
  const gizmo = transformControls?._gizmo;
  if (!gizmo) return;

  gizmo.traverse((object) => {
    if (!object.scale) return;
    object.scale.set(Math.abs(object.scale.x), Math.abs(object.scale.y), Math.abs(object.scale.z));
  });

  if (gizmo.transform?.scale) {
    gizmo.transform.scale.set(Math.abs(gizmo.transform.scale.x), Math.abs(gizmo.transform.scale.y), Math.abs(gizmo.transform.scale.z));
  }
}

function stabilizeTransformGizmo(transformControls) {
  if (transformControls) transformControls.size = 0.85;
  transformControls?.setColors?.(GIZMO_X_COLOR, GIZMO_Y_COLOR, GIZMO_Z_COLOR, GIZMO_ACTIVE_COLOR);
  const materialLib = transformControls?._gizmo?.materialLib;
  if (materialLib?.activeTransparent) {
    materialLib.activeTransparent.color.set(SCREEN_SPACE_ROTATION_COLOR);
    materialLib.activeTransparent.opacity = 0.8;
  }
  if (materialLib?.yAxisTransparent) {
    materialLib.yAxisTransparent.opacity = 0.65;
  }
  forcePositiveGizmoScales(transformControls);
  lockPositiveConePointers(transformControls);
}

function ShapeGeometry({ comp }) {
  const type = comp.type;
  const segments = segmentCountFor(comp, type === "pyramid" ? 4 : 32);
  const geometry = useMemo(() => {
    if (type === "mesh") return createCustomGeometry(comp.geometryData);
    return createShapeGeometry(type, DEFAULT_BASE_SIZE, [0, 0, 0], comp.text, segments, false);
  }, [comp.geometryData, comp.text, segments, type]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return <primitive object={geometry} attach="geometry" />;
}

function createWedgeGeometry() {
  const geometry = new BufferGeometry();
  const vertices = [
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, 0.5,
    0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5, -0.5,
    0.5, -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
  ];
  geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createHemisphereGeometry(segments = 32) {
  const widthSegments = Math.max(8, segments);
  const heightSegments = Math.max(4, Math.floor(widthSegments / 2));
  const points = [];

  points.push(new Vector3(0, 0, 0));
  for (let yIndex = 1; yIndex <= heightSegments; yIndex += 1) {
    const phi = (yIndex / heightSegments) * (Math.PI / 2);
    for (let xIndex = 0; xIndex < widthSegments; xIndex += 1) {
      points.push(new Vector3(...hemispherePoint(phi, (xIndex / widthSegments) * Math.PI * 2)));
    }
  }

  points.push(new Vector3(0, -0.5, 0));
  const geometry = new ConvexGeometry(points);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function hemispherePoint(phi, theta) {
  const radius = 0.5;
  const x = Math.sin(phi) * Math.cos(theta) * radius;
  const y = Math.cos(phi) * radius - 0.5;
  const z = Math.sin(phi) * Math.sin(theta) * radius;
  return [x, y, z];
}

function createStarGeometry() {
  const shape = new Shape();
  const points = 10;
  for (let index = 0; index < points; index += 1) {
    const radius = index % 2 === 0 ? 0.5 : 0.22;
    const angle = -Math.PI / 2 + (index / points) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
  geometry.translate(0, 0, -0.09);
  geometry.computeVertexNormals();
  return geometry;
}

function createTextGeometry(text = "Text") {
  const geometry = new TextGeometry(text || "Text", {
    font: textFont,
    size: 0.9,
    depth: 0.08,
    steps: 1,
    curveSegments: 8,
    bevelEnabled: false,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box) {
    const height = Math.max(box.max.y - box.min.y, 0.001);
    const fitScale = 1 / height;
    geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
    geometry.scale(fitScale, fitScale, fitScale);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createCustomGeometry(data) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(data.positions ?? [], 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createCustomGeometryData(geometry) {
  const working = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  working.computeBoundingBox();
  const box = working.boundingBox;
  if (!box || box.isEmpty()) {
    working.dispose();
    return null;
  }

  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);
  const safeSize = [Math.max(size.x, 0.001), Math.max(size.y, 0.001), Math.max(size.z, 0.001)];
  const source = working.attributes.position.array;
  const positions = [];

  for (let index = 0; index < source.length; index += 3) {
    positions.push(
      (source[index] - center.x) / safeSize[0],
      (source[index + 1] - center.y) / safeSize[1],
      (source[index + 2] - center.z) / safeSize[2],
    );
  }

  working.dispose();
  return {
    positions,
    pos: [center.x, center.y, box.min.z],
    baseSize: safeSize,
  };
}

function orientGeometryForZUp(geometry, type) {
  if (type === "cylinder" || type === "hexagonalPrism" || type === "cone" || type === "pyramid" || type === "wedge" || type === "hemisphere" || type === "text3d") {
    geometry.rotateX(Math.PI / 2);
  }
  return geometry;
}

function createShapeGeometry(type, baseSize = DEFAULT_BASE_SIZE, pivotOffset = [0, 0, 0], text = "Text", segments = 32, applyVisualOffset = true) {
  let geometry;
  if (type === "mesh") geometry = createCustomGeometry(text);
  else if (type === "sphere") geometry = new SphereGeometry(0.5, segments, Math.max(8, Math.floor(segments * 0.75)));
  else if (type === "cylinder") geometry = new CylinderGeometry(0.5, 0.5, 1, segments);
  else if (type === "cone") geometry = new CylinderGeometry(0, 0.5, 1, segments);
  else if (type === "pyramid") geometry = new CylinderGeometry(0, pyramidBaseRadius, 1, segments);
  else if (type === "wedge") geometry = createWedgeGeometry();
  else if (type === "hexagonalPrism") {
    geometry = new CylinderGeometry(0.5, 0.5, 1, 6);
    geometry.rotateY(Math.PI / 6);
  } else if (type === "hemisphere") geometry = createHemisphereGeometry(segments);
  else if (type === "torus") {
    geometry = new TorusGeometry(0.35, 0.15, Math.max(8, Math.floor(segments / 2)), segments);
  } else if (type === "star") geometry = createStarGeometry();
  else if (type === "text3d") geometry = createTextGeometry(text);
  else geometry = new BoxGeometry(1, 1, 1);

  orientGeometryForZUp(geometry, type);
  geometry.scale(baseSize[0], baseSize[1], baseSize[2]);
  if (applyVisualOffset) geometry.translate(pivotOffset[0], pivotOffset[1], pivotOffset[2] + baseSize[2] / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function visualOffsetFor(comp) {
  const baseSize = comp.baseSize ?? DEFAULT_BASE_SIZE;
  return [comp.pivotOffset[0], comp.pivotOffset[1], comp.pivotOffset[2] + baseSize[2] / 2];
}

function anchoredScaleUpdate(comp, nextScale) {
  return { scale: nextScale };
}

function brushForComp(comp) {
  const geometry = geometryForComp(comp);
  if (!geometry) return null;
  const brush = new Brush(geometry);
  brush.position.fromArray(comp.pos);
  brush.quaternion.fromArray(comp.quat);
  brush.scale.fromArray(comp.scale);
  brush.updateMatrixWorld(true);
  return brush;
}

function geometryForComp(comp) {
  if (comp.type === "group") return evaluateBooleanGeometry(comp.children);
  if (comp.type === "mesh") return createShapeGeometry(comp.type, comp.baseSize ?? DEFAULT_BASE_SIZE, comp.pivotOffset, comp.geometryData);
  return createShapeGeometry(comp.type, comp.baseSize ?? DEFAULT_BASE_SIZE, comp.pivotOffset, comp.text, segmentCountFor(comp));
}

function unitGeometrySizeForComp(comp) {
  const geometry =
    comp.type === "mesh"
      ? createShapeGeometry(comp.type, DEFAULT_BASE_SIZE, [0, 0, 0], comp.geometryData, 32, false)
      : createShapeGeometry(comp.type, DEFAULT_BASE_SIZE, [0, 0, 0], comp.text, segmentCountFor(comp), false);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new Vector3(1, 1, 1);
  if (box && !box.isEmpty()) box.getSize(size);
  geometry.dispose();
  return size.toArray().map((value) => Math.max(value, 0.001));
}

function renderedDimensionsForComp(comp) {
  if (comp.type === "group") return measureComps(comp.children ?? [], 1) ?? DEFAULT_BASE_SIZE;

  const baseSize = comp.baseSize ?? DEFAULT_BASE_SIZE;
  const scale = comp.scale ?? DEFAULT_BASE_SIZE;
  const unitSize = unitGeometrySizeForComp(comp);
  return unitSize.map((value, index) => Math.abs(value * baseSize[index] * scale[index]));
}

function evaluateBooleanGeometry(children) {
  const solids = children.filter((child) => !child.isHole);
  const holes = children.filter((child) => child.isHole);

  if (solids.length === 0) return null;

  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  let result = brushForComp(solids[0]);
  if (!result) return null;
  for (const solid of solids.slice(1)) {
    const brush = brushForComp(solid);
    if (!brush) continue;
    const next = evaluator.evaluate(result, brush, ADDITION);
    result.geometry.dispose();
    result = next;
  }

  for (const hole of holes) {
    const brush = brushForComp(hole);
    if (!brush) continue;
    const next = evaluator.evaluate(result, brush, SUBTRACTION);
    result.geometry.dispose();
    result = next;
  }

  result.geometry.computeVertexNormals();
  return result.geometry;
}

function meshForExport(comp) {
  const geometry = geometryForComp(comp);
  if (!geometry) return null;
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.name = comp.name ?? comp.id;
  mesh.position.fromArray(comp.pos);
  mesh.quaternion.fromArray(comp.quat);
  mesh.scale.fromArray(comp.scale);
  mesh.updateMatrixWorld(true);
  return mesh;
}

function splitCompWithPlane(comp, splitPlane) {
  const sourceBrush = brushForComp(comp);
  if (!sourceBrush) return [];

  const planePos = new Vector3(...splitPlane.pos);
  const planeQuat = new Quaternion(...splitPlane.quat);
  const planeNormal = WORLD_UP.clone().applyQuaternion(planeQuat);
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  const parts = [];
  for (const side of [1, -1]) {
    const cutter = new Brush(new BoxGeometry(200, 200, 200));
    cutter.position.copy(planePos).addScaledVector(planeNormal, side * 100);
    cutter.quaternion.copy(planeQuat);
    cutter.updateMatrixWorld(true);

    const result = evaluator.evaluate(sourceBrush, cutter, INTERSECTION);
    result.geometry.computeVertexNormals();
    const data = createCustomGeometryData(result.geometry);
    cutter.geometry.dispose();
    result.geometry.dispose();

    if (!data || data.positions.length === 0) continue;
    parts.push({
      id: `${comp.id}-split-${side > 0 ? "a" : "b"}-${Date.now()}`,
      name: `${comp.name ?? comp.id}-${side > 0 ? "A" : "B"}`,
      type: "mesh",
      isHole: false,
      color: comp.color ?? "hotpink",
      pos: data.pos,
      quat: [0, 0, 0, 1],
      scale: [1, 1, 1],
      baseSize: data.baseSize,
      pivotOffset: [0, 0, 0],
      geometryData: { positions: data.positions },
    });
  }

  sourceBrush.geometry.dispose();
  return parts;
}

function downloadSelectedStl(comps, selectedIds) {
  const selected = comps.filter((comp) => selectedIds.includes(comp.id));
  if (selected.length === 0) return;

  const scene = new Scene();
  const meshes = selected.map(meshForExport).filter(Boolean);
  for (const mesh of meshes) scene.add(mesh);
  scene.updateMatrixWorld(true);

  const exporter = new STLExporter();
  const stl = exporter.parse(scene, { binary: false });
  const filename = selected.length === 1 ? `${safeFilename(selected[0].name ?? selected[0].id)}.stl` : "selection.stl";
  downloadText(filename, stl);

  for (const mesh of meshes) {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
}

function PivotMarkerMesh({ setRef }) {
  return (
    <mesh ref={setRef} renderOrder={1000}>
      <sphereGeometry args={[0.005, 12, 12]} />
      <meshBasicMaterial color="#f97316" depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function ShapeMaterial({ comp, selected }) {
  return (
    <meshStandardMaterial
      color={comp.isHole ? "#f97316" : selected ? "#38bdf8" : comp.color ?? "hotpink"}
      transparent={comp.isHole}
      opacity={comp.isHole ? 0.28 : 1}
      depthWrite={!comp.isHole}
      wireframe={comp.isHole}
      flatShading
    />
  );
}

function ShapeThumbnail({ type }) {
  const common = { fill: "rgba(56, 189, 248, 0.22)", stroke: "rgba(224, 242, 254, 0.92)", strokeWidth: 1.7, strokeLinejoin: "round" };
  const accent = { fill: "rgba(14, 165, 233, 0.34)", stroke: "rgba(125, 211, 252, 0.85)", strokeWidth: 1.3, strokeLinejoin: "round" };

  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      {type === "box" && (
        <>
          <path {...common} d="M18 22 32 14l14 8-14 8-14-8Z" />
          <path {...accent} d="M18 22v18l14 9V30L18 22Z" />
          <path {...common} d="M46 22v18l-14 9V30l14-8Z" />
        </>
      )}
      {type === "sphere" && (
        <>
          <circle {...common} cx="32" cy="32" r="18" />
          <ellipse {...accent} cx="32" cy="32" rx="18" ry="7" fill="none" />
          <path {...accent} fill="none" d="M32 14c6 4 9 10 9 18s-3 14-9 18M32 14c-6 4-9 10-9 18s3 14 9 18" />
        </>
      )}
      {type === "cylinder" && (
        <>
          <ellipse {...common} cx="32" cy="18" rx="15" ry="6" />
          <path {...accent} d="M17 18v26c0 4 7 7 15 7s15-3 15-7V18" />
          <ellipse {...common} fill="none" cx="32" cy="44" rx="15" ry="7" />
        </>
      )}
      {type === "cone" && (
        <>
          <path {...common} d="M32 11 17 46c3 5 27 5 30 0L32 11Z" />
          <ellipse {...accent} cx="32" cy="46" rx="15" ry="6" />
        </>
      )}
      {type === "pyramid" && (
        <>
          <path {...common} d="M32 11 14 45l18 9 18-9-18-34Z" />
          <path {...accent} d="M32 11v43M14 45h36" fill="none" />
        </>
      )}
      {type === "wedge" && (
        <>
          <path {...common} d="M15 45h34L15 18v27Z" />
          <path {...accent} d="M15 18h34v27H15L49 18Z" />
        </>
      )}
      {type === "hemisphere" && (
        <>
          <path {...common} d="M14 38a18 18 0 0 1 36 0H14Z" />
          <ellipse {...accent} cx="32" cy="38" rx="18" ry="7" />
        </>
      )}
      {type === "torus" && (
        <>
          <ellipse {...common} cx="32" cy="32" rx="21" ry="15" />
          <ellipse fill="rgba(15, 23, 42, 0.96)" stroke="rgba(224, 242, 254, 0.78)" strokeWidth="1.4" cx="32" cy="32" rx="9" ry="6" />
        </>
      )}
      {type === "star" && (
        <path {...common} d="m32 9 6 15 16 1-12 10 4 16-14-9-14 9 4-16-12-10 16-1 6-15Z" />
      )}
      {type === "text3d" && (
        <>
          <path {...accent} d="M16 19h32v8H37v24H27V27H16v-8Z" />
          <path {...common} fill="none" d="M20 15h32v8M37 27l6-4v24l-6 4" />
        </>
      )}
    </svg>
  );
}

function TextShapeContent({ comp, selected, onPick, setRef }) {
  const text = comp.text || "Text";
  const geometry = useMemo(() => createShapeGeometry("text3d", DEFAULT_BASE_SIZE, [0, 0, 0], text, 32, false), [text]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      ref={setRef}
      geometry={geometry}
      position={visualOffsetFor(comp)}
      scale={comp.baseSize ?? DEFAULT_BASE_SIZE}
      castShadow={!comp.isHole}
      receiveShadow={!comp.isHole}
      onClick={onPick}
    >
      <ShapeMaterial comp={comp} selected={selected} />
    </mesh>
  );
}

function ComponentContent({ comp, selected, onPick }) {
  if (comp.type === "group") {
    return <BooleanGroupContent comp={comp} selected={selected} onPick={onPick} />;
  }

  if (comp.type === "text3d") {
    return <TextShapeContent comp={comp} selected={selected} onPick={onPick} />;
  }

  return (
    <mesh position={visualOffsetFor(comp)} scale={comp.baseSize ?? DEFAULT_BASE_SIZE} castShadow={!comp.isHole} receiveShadow={!comp.isHole} onClick={onPick}>
      <ShapeGeometry comp={comp} />
      <ShapeMaterial comp={comp} selected={selected} />
    </mesh>
  );
}

function BooleanGroupContent({ comp, selected, onPick }) {
  const csgGeometry = useMemo(() => evaluateBooleanGeometry(comp.children), [comp.children]);

  useEffect(() => {
    return () => csgGeometry?.dispose();
  }, [csgGeometry]);

  if (csgGeometry) {
    return (
      <mesh geometry={csgGeometry} castShadow={!comp.isHole} receiveShadow={!comp.isHole} onClick={onPick}>
        <ShapeMaterial comp={comp} selected={selected} />
      </mesh>
    );
  }

  if (comp.type === "group") {
    return comp.children.map((child) => (
      <group key={child.id} position={child.pos} quaternion={child.quat} scale={child.scale}>
        <ComponentContent comp={child} selected={selected} onPick={onPick} />
      </group>
    ));
  }
}

function WorkspaceShape({ comp, onDraggingChanged, registerGroupRef, registerMeshRef }) {
  const groupRef = useRef(null);
  const meshRef = useRef(null);
  const pivotRef = useRef(null);
  const gizmoAnchorRef = useRef(null);
  const objectControlsRef = useRef(null);
  const pivotControlsRef = useRef(null);
  const scaleStartRef = useRef(null);
  const objectDraggingRef = useRef(false);
  const initialAnchorMatrixRef = useRef(new Matrix4());
  const initialObjectMatrixRef = useRef(new Matrix4());
  const [gizmoAnchorObject, setGizmoAnchorObject] = useState(null);
  const [pivotObject, setPivotObject] = useState(null);
  const selectedIds = useWorkspace3DStore((state) => state.selectedIds);
  const isSnappingEnabled = useWorkspace3DStore((state) => state.isSnappingEnabled);
  const transformMode = useWorkspace3DStore((state) => state.transformMode);
  const editTarget = useWorkspace3DStore((state) => state.editTarget);
  const splitPlane = useWorkspace3DStore((state) => state.splitPlane);
  const selectShape = useWorkspace3DStore((state) => state.selectShape);
  const updateShape = useWorkspace3DStore((state) => state.updateShape);
  const updatePivot = useWorkspace3DStore((state) => state.updatePivot);
  const selected = selectedIds.includes(comp.id);
  const singleSelected = selected && selectedIds.length === 1;

  const bindGroupRef = useCallback((node) => {
    groupRef.current = node;
    registerGroupRef(comp.id, node);
    if (comp.type === "group") registerMeshRef(comp.id, node);
  }, [comp.id, comp.type, registerGroupRef, registerMeshRef]);

  const bindPivotRef = useCallback((node) => {
    pivotRef.current = node;
    setPivotObject(node);
  }, []);

  const bindGizmoAnchorRef = useCallback((node) => {
    gizmoAnchorRef.current = node;
    setGizmoAnchorObject(node);
  }, []);

  const bindMeshRef = useCallback((node) => {
    meshRef.current = node;
    registerMeshRef(comp.id, node);
  }, [comp.id, registerMeshRef]);

  function moveObjectGizmoToGeometryCenter() {
    const anchor = gizmoAnchorRef.current;
    const targetObject = meshRef.current ?? groupRef.current;
    if (!anchor || !targetObject) return;

    const center = geometryCenterForObject(targetObject);
    if (!center) return;
    anchor.position.copy(center);
    anchor.quaternion.identity();
    anchor.scale.set(1, 1, 1);
    anchor.updateMatrixWorld(true);
  }

  function persistObjectTransform() {
    const group = groupRef.current;
    if (!group) return;
    group.updateMatrixWorld(true);
    const nextScale = group.scale.toArray();
    updateShape(comp.id, {
      pos: isSnappingEnabled ? snapVector(group.position.toArray()) : group.position.toArray(),
      quat: group.quaternion.toArray(),
      scale: nextScale,
    });
    scaleStartRef.current = null;
  }

  function beginObjectTransform() {
    const group = groupRef.current;
    const anchor = gizmoAnchorRef.current;
    if (!group || !anchor) return;
    if (objectDraggingRef.current) return;

    moveObjectGizmoToGeometryCenter();
    group.updateMatrixWorld(true);
    anchor.updateMatrixWorld(true);
    initialObjectMatrixRef.current.copy(group.matrixWorld);
    initialAnchorMatrixRef.current.copy(anchor.matrixWorld);
    objectDraggingRef.current = true;
    scaleStartRef.current = null;
  }

  function applyObjectTransform() {
    const group = groupRef.current;
    const anchor = gizmoAnchorRef.current;
    if (!group || !anchor || !objectDraggingRef.current) return;

    anchor.updateMatrixWorld(true);
    sharedInitialInverse.copy(initialAnchorMatrixRef.current).invert();
    sharedDeltaMatrix.multiplyMatrices(anchor.matrixWorld, sharedInitialInverse);
    sharedNextMatrix.multiplyMatrices(sharedDeltaMatrix, initialObjectMatrixRef.current);
    sharedNextMatrix.decompose(sharedPosition, sharedQuaternion, sharedScale);

    group.position.copy(sharedPosition);
    group.quaternion.copy(sharedQuaternion);
    group.scale.copy(sharedScale);
    group.updateMatrixWorld(true);
  }

  function finishObjectTransform() {
    if (!objectDraggingRef.current) return;
    applyObjectTransform();
    persistObjectTransform();
    objectDraggingRef.current = false;
    moveObjectGizmoToGeometryCenter();
  }

  function resetPivotToCenter() {
    const group = groupRef.current;
    const mesh = meshRef.current ?? groupRef.current;
    if (!group || !mesh) return;

    const center = geometryCenterForObject(mesh);
    if (!center) return;

    group.updateMatrixWorld(true);
    const localTranslationVector = group.worldToLocal(center.clone());
    const nextPivotOffset = new Vector3(...comp.pivotOffset).sub(localTranslationVector).toArray();

    updatePivot(comp.id, {
      pos: center.toArray(),
      quat: group.quaternion.toArray(),
      scale: group.scale.toArray(),
      pivotOffset: nextPivotOffset,
    });
    moveObjectGizmoToGeometryCenter();
  }

  function syncPivotTransform() {
    const group = groupRef.current;
    const mesh = meshRef.current;
    const pivot = pivotRef.current;
    if (!group || !mesh || !pivot) return;

    group.updateMatrixWorld(true);
    mesh.updateMatrixWorld(true);
    pivot.updateMatrixWorld(true);

    const oldPivotWorld = new Vector3();
    const newPivotWorld = new Vector3();
    group.getWorldPosition(oldPivotWorld);
    pivot.getWorldPosition(newPivotWorld);

    const globalTranslationVector = newPivotWorld.clone().sub(oldPivotWorld);
    const localTranslationVector = group.worldToLocal(oldPivotWorld.clone().add(globalTranslationVector));
    const nextPivotOffset = new Vector3(...comp.pivotOffset).sub(localTranslationVector).toArray();

    updatePivot(comp.id, {
      pos: newPivotWorld.toArray(),
      quat: group.quaternion.toArray(),
      scale: group.scale.toArray(),
      pivotOffset: nextPivotOffset,
    });
  }

  function handlePick(event) {
    event.stopPropagation();
    if (event.nativeEvent.shiftKey) {
      selectShape(comp.id, true);
      return;
    }
    selectShape(comp.id);
  }

  useFrame(() => {
    if (!singleSelected) return;

    if (editTarget === "object" && objectControlsRef.current) {
      if (!objectDraggingRef.current) moveObjectGizmoToGeometryCenter();
      stabilizeTransformGizmo(objectControlsRef.current);
    }

    if (editTarget === "pivot" && pivotControlsRef.current) {
      stabilizeTransformGizmo(pivotControlsRef.current);
    }
  });

  return (
    <>
      <group ref={bindGroupRef} position={comp.pos} quaternion={comp.quat} scale={comp.scale}>
        {comp.type === "group" ? (
          <ComponentContent comp={comp} selected={selected} onPick={handlePick} />
        ) : comp.type === "text3d" ? (
          <TextShapeContent comp={comp} selected={selected} onPick={handlePick} setRef={bindMeshRef} />
        ) : (
          <mesh
            ref={bindMeshRef}
            position={visualOffsetFor(comp)}
            scale={comp.baseSize ?? DEFAULT_BASE_SIZE}
            castShadow={!comp.isHole}
            receiveShadow={!comp.isHole}
            onClick={handlePick}
          >
            <ShapeGeometry comp={comp} />
            <ShapeMaterial comp={comp} selected={selected} />
          </mesh>
        )}
        {comp.type !== "group" && editTarget === "pivot" && singleSelected && <PivotMarkerMesh setRef={bindPivotRef} />}
      </group>
      <group ref={bindGizmoAnchorRef} />

      {singleSelected && !splitPlane && editTarget === "object" && gizmoAnchorObject && (
        <TransformControls
          ref={objectControlsRef}
          object={gizmoAnchorObject}
          mode={transformMode}
          space="world"
          translationSnap={isSnappingEnabled ? PITCH : null}
          onMouseDown={beginObjectTransform}
          onObjectChange={applyObjectTransform}
          onMouseUp={finishObjectTransform}
          onDraggingChanged={(event) => {
            onDraggingChanged(event);
            if (event.value) beginObjectTransform();
            else finishObjectTransform();
          }}
        />
      )}

      {singleSelected && !splitPlane && editTarget === "pivot" && pivotObject && (
        <TransformControls
          ref={pivotControlsRef}
          object={pivotObject}
          mode="translate"
          space="world"
          translationSnap={null}
          onMouseUp={syncPivotTransform}
          onDraggingChanged={(event) => {
            onDraggingChanged(event);
            if (!event.value) syncPivotTransform();
          }}
        />
      )}
      {singleSelected && pivotObject && (
        <ObjectPivotActions onResetPivot={resetPivotToCenter} />
      )}
    </>
  );
}

function SharedSelectionControls({ groupRefs, meshRefs, onDraggingChanged }) {
  const sharedGroupRef = useRef(null);
  const controlsRef = useRef(null);
  const draggingRef = useRef(false);
  const initialGroupMatrixRef = useRef(new Matrix4());
  const initialObjectMatricesRef = useRef(new Map());
  const [sharedObject, setSharedObject] = useState(null);
  const selectedIds = useWorkspace3DStore((state) => state.selectedIds);
  const isSnappingEnabled = useWorkspace3DStore((state) => state.isSnappingEnabled);
  const transformMode = useWorkspace3DStore((state) => state.transformMode);
  const updateShape = useWorkspace3DStore((state) => state.updateShape);
  const splitPlane = useWorkspace3DStore((state) => state.splitPlane);
  const active = selectedIds.length > 1;

  const bindSharedGroup = useCallback((node) => {
    sharedGroupRef.current = node;
    setSharedObject(node);
  }, []);

  function moveSharedGroupToSelectionCentroid() {
    const group = sharedGroupRef.current;
    if (!group || !active) return;

    sharedBox.makeEmpty();
    for (const id of selectedIds) {
      const mesh = meshRefs.current.get(id);
      if (!mesh) continue;
      mesh.updateMatrixWorld(true);
      sharedBox.expandByObject(mesh);
    }

    if (sharedBox.isEmpty()) return;
    sharedBox.getCenter(sharedCenter);
    group.position.copy(sharedCenter);
    group.quaternion.identity();
    group.scale.set(1, 1, 1);
    group.updateMatrixWorld(true);
  }

  function beginSharedTransform() {
    const group = sharedGroupRef.current;
    if (!group) return;

    moveSharedGroupToSelectionCentroid();
    group.updateMatrixWorld(true);
    initialGroupMatrixRef.current.copy(group.matrixWorld);
    initialObjectMatricesRef.current = new Map();

    for (const id of selectedIds) {
      const objectGroup = groupRefs.current.get(id);
      if (!objectGroup) continue;
      objectGroup.updateMatrixWorld(true);
      initialObjectMatricesRef.current.set(id, objectGroup.matrixWorld.clone());
    }

    draggingRef.current = true;
  }

  function applySharedTransform() {
    const group = sharedGroupRef.current;
    if (!group || !draggingRef.current) return;

    group.updateMatrixWorld(true);
    sharedInitialInverse.copy(initialGroupMatrixRef.current).invert();
    sharedDeltaMatrix.multiplyMatrices(group.matrixWorld, sharedInitialInverse);

    for (const [id, originalMatrix] of initialObjectMatricesRef.current) {
      const objectGroup = groupRefs.current.get(id);
      if (!objectGroup) continue;

      sharedNextMatrix.multiplyMatrices(sharedDeltaMatrix, originalMatrix);
      sharedNextMatrix.decompose(sharedPosition, sharedQuaternion, sharedScale);
      objectGroup.position.copy(sharedPosition);
      objectGroup.quaternion.copy(sharedQuaternion);
      objectGroup.scale.copy(sharedScale);
      objectGroup.updateMatrixWorld(true);
    }
  }

  function finishSharedTransform() {
    if (!draggingRef.current) return;
    applySharedTransform();

    for (const id of selectedIds) {
      const objectGroup = groupRefs.current.get(id);
      if (!objectGroup) continue;

      objectGroup.updateMatrixWorld(true);
      objectGroup.getWorldPosition(sharedWorldPosition);
      objectGroup.getWorldQuaternion(sharedWorldQuaternion);
      objectGroup.getWorldScale(sharedWorldScale);
      updateShape(id, {
        pos: isSnappingEnabled ? snapVector(sharedWorldPosition.toArray()) : sharedWorldPosition.toArray(),
        quat: sharedWorldQuaternion.toArray(),
        scale: sharedWorldScale.toArray(),
      });
    }

    draggingRef.current = false;
    moveSharedGroupToSelectionCentroid();
  }

  useFrame(() => {
    if (!active) return;
    if (!draggingRef.current) moveSharedGroupToSelectionCentroid();

    if (controlsRef.current) {
      stabilizeTransformGizmo(controlsRef.current);
    }
  });

  return (
    <>
      <group ref={bindSharedGroup} />
      {active && !splitPlane && sharedObject && (
        <TransformControls
          ref={controlsRef}
          object={sharedObject}
          mode={transformMode}
          space="world"
          translationSnap={isSnappingEnabled ? PITCH : null}
          onMouseDown={beginSharedTransform}
          onObjectChange={applySharedTransform}
          onMouseUp={finishSharedTransform}
          onDraggingChanged={(event) => {
            onDraggingChanged(event);
            if (event.value) beginSharedTransform();
            else finishSharedTransform();
          }}
        />
      )}
    </>
  );
}

function Cursor3D() {
  const cursorPos = useWorkspace3DStore((state) => state.cursorPos);

  return (
    <group position={cursorPos}>
      <mesh renderOrder={1000}>
        <sphereGeometry args={[0.005, 12, 12]} />
        <meshBasicMaterial color="orange" depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function SplitPlaneTool({ onDraggingChanged }) {
  const groupRef = useRef(null);
  const controlsRef = useRef(null);
  const [groupObject, setGroupObject] = useState(null);
  const splitPlane = useWorkspace3DStore((state) => state.splitPlane);
  const transformMode = useWorkspace3DStore((state) => state.transformMode);
  const isSnappingEnabled = useWorkspace3DStore((state) => state.isSnappingEnabled);
  const updateSplitPlane = useWorkspace3DStore((state) => state.updateSplitPlane);

  const bindGroupRef = useCallback((node) => {
    groupRef.current = node;
    setGroupObject(node);
  }, []);

  function syncSplitPlane() {
    const group = groupRef.current;
    if (!group) return;
    updateSplitPlane({
      pos: isSnappingEnabled ? snapVector(group.position.toArray()) : group.position.toArray(),
      quat: group.quaternion.toArray(),
    });
  }

  useFrame(() => {
    if (controlsRef.current) stabilizeTransformGizmo(controlsRef.current);
  });

  if (!splitPlane) return null;

  return (
    <>
      <group ref={bindGroupRef} position={splitPlane.pos} quaternion={splitPlane.quat}>
        <mesh renderOrder={900}>
          <planeGeometry args={[4, 4]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.22} depthWrite={false} toneMapped={false} />
        </mesh>
        <lineSegments renderOrder={901}>
          <edgesGeometry args={[new BoxGeometry(4, 4, 0.001)]} />
          <lineBasicMaterial color="#e0f2fe" transparent opacity={0.9} depthWrite={false} />
        </lineSegments>
      </group>
      {groupObject && (
        <TransformControls
          ref={controlsRef}
          object={groupObject}
          mode={transformMode === "rotate" ? "rotate" : "translate"}
          space="world"
          translationSnap={isSnappingEnabled ? PITCH : null}
          onObjectChange={syncSplitPlane}
          onMouseUp={syncSplitPlane}
          onDraggingChanged={(event) => {
            onDraggingChanged(event);
            if (!event.value) syncSplitPlane();
          }}
        />
      )}
    </>
  );
}

function WorkspaceScene({ boxSelecting, onBoxSelectReady }) {
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const orbitControlsRef = useRef(null);
  const groupRefs = useRef(new Map());
  const meshRefs = useRef(new Map());
  const comps = useWorkspace3DStore((state) => state.comps);
  const selectedIds = useWorkspace3DStore((state) => state.selectedIds);
  const addSelectedShapes = useWorkspace3DStore((state) => state.addSelectedShapes);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    camera.up.copy(WORLD_UP);
    camera.updateProjectionMatrix();
  }, [camera]);

  const registerGroupRef = useCallback((id, node) => {
    if (node) groupRefs.current.set(id, node);
    else groupRefs.current.delete(id);
  }, []);

  const registerMeshRef = useCallback((id, node) => {
    if (node) meshRefs.current.set(id, node);
    else meshRefs.current.delete(id);
  }, []);

  useEffect(() => {
    onBoxSelectReady((screenRect) => {
      const selected = [];
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      selectionViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      selectionFrustum.setFromProjectionMatrix(selectionViewProjection);

      for (const comp of comps) {
        const mesh = meshRefs.current.get(comp.id);
        if (!mesh) continue;
        mesh.updateMatrixWorld(true);
        selectionBox.setFromObject(mesh);
        if (!selectionFrustum.intersectsBox(selectionBox)) continue;
        const objectRect = projectObjectBoxToScreen(mesh, camera, gl.domElement);
        if (objectRect && rectsIntersect(screenRect, objectRect)) selected.push(comp.id);
      }

      addSelectedShapes(selected);
    });

    return () => onBoxSelectReady(null);
  }, [addSelectedShapes, camera, comps, gl.domElement, onBoxSelectReady]);

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, -4, 8]} intensity={1.4} castShadow />
      <Grid
        args={[40, 40]}
        cellSize={0.25}
        cellThickness={0.35}
        cellColor="#eeeeee"
        sectionSize={1}
        sectionThickness={0}
        sectionColor="#eeeeee"
        fadeDistance={80}
        fadeStrength={1}
        infiniteGrid
        depthTest
        depthWrite={false}
        renderOrder={-20}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.001]}
      />
      <Grid
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#d4d4d8"
        sectionSize={1}
        sectionThickness={0.6}
        sectionColor="#d4d4d8"
        fadeDistance={80}
        fadeStrength={1}
        infiniteGrid
        depthTest
        depthWrite={false}
        renderOrder={-10}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      />
      <line position={[0, 0, 0]} renderOrder={-5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([-100000, 0, 0, 100000, 0, 0]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#ff4d4d" depthTest depthWrite={false} />
      </line>
      <line position={[0, 0, 0]} renderOrder={-5}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([0, -100000, 0, 0, 100000, 0]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#35d46a" depthTest depthWrite={false} />
      </line>
      {comps.map((comp) => (
        <WorkspaceShape
          key={comp.id}
          comp={comp}
          onDraggingChanged={(event) => setOrbitEnabled(!event.value)}
          registerGroupRef={registerGroupRef}
          registerMeshRef={registerMeshRef}
        />
      ))}
      <SharedSelectionControls
        groupRefs={groupRefs}
        meshRefs={meshRefs}
        onDraggingChanged={(event) => setOrbitEnabled(!event.value)}
      />
      <SplitPlaneTool onDraggingChanged={(event) => setOrbitEnabled(!event.value)} />
      <GizmoHelper
        alignment="bottom-right"
        margin={[80, 80]}
        onTarget={() => orbitControlsRef.current?.target ?? new Vector3(0, 0, 0)}
      >
        <GizmoViewport
          axisColors={[GIZMO_X_COLOR, GIZMO_Y_COLOR, GIZMO_Z_COLOR]}
          labels={["X", "Y", "Z"]}
          labelColor="#ffffff"
          axisHeadScale={1.15}
          hideNegativeAxes={false}
        />
      </GizmoHelper>
      <OrbitControls ref={orbitControlsRef} makeDefault enabled={orbitEnabled && !boxSelecting} />
    </>
  );
}

function ToolButton({ active = false, disabled = false, title, children, onClick }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-3 py-2 text-sm font-semibold transition ${
        active ? "border-sky-500 bg-sky-400 text-slate-950" : "border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {children}
    </button>
  );
}

function ObjectPivotActions({ onResetPivot }) {
  return (
    <button
      type="button"
      title="Reset Pivot to Center"
      aria-label="Reset Pivot to Center"
      onMouseDown={stopUiEvent}
      onKeyDown={stopUiEvent}
      onClick={onResetPivot}
      className="pointer-events-auto fixed left-4 top-64 z-30 inline-flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 shadow-2xl transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300/70"
    >
      <LocateFixed className="h-4 w-4" />
      Reset Pivot
    </button>
  );
}

function AlignXIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" />
      <rect x="3" y="7" width="5" height="5" rx="1" />
      <rect x="16" y="12" width="5" height="5" rx="1" />
      <path d="M8.5 9.5H11" />
      <path d="M15.5 14.5H13" />
    </svg>
  );
}

function AlignYIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18" />
      <rect x="7" y="3" width="5" height="5" rx="1" />
      <rect x="12" y="16" width="5" height="5" rx="1" />
      <path d="M9.5 8.5V11" />
      <path d="M14.5 15.5V13" />
    </svg>
  );
}

function AlignZIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19 19 5" />
      <circle cx="12" cy="12" r="1.5" />
      <rect x="3.5" y="15.5" width="5" height="5" rx="1" />
      <rect x="15.5" y="3.5" width="5" height="5" rx="1" />
      <path d="m8.5 15.5 2-2" />
      <path d="m15.5 8.5-2 2" />
    </svg>
  );
}

function HoleToggleIcon({ active = false }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 4.5 7.25 12 11.5l7.5-4.25L12 3Z" />
      <path d="M4.5 7.25v8.5L12 20l7.5-4.25v-8.5" />
      <path d="M12 11.5V20" />
      {active ? <path d="M8 15h8" /> : <path d="M8 15h8M12 11v8" />}
    </svg>
  );
}

function MirrorXIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M3.5 5.5v13l6.5-6.5-6.5-6.5Z" fill="currentColor" opacity="0.92" />
      <path d="M20.5 5.5v13L14 12l6.5-6.5Z" fill="currentColor" opacity="0.92" />
      <path d="M12 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3" />
    </svg>
  );
}

function MirrorYIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M5.5 3.5h13L12 10 5.5 3.5Z" fill="currentColor" opacity="0.92" />
      <path d="M5.5 20.5h13L12 14l-6.5 6.5Z" fill="currentColor" opacity="0.92" />
      <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3" />
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M6.75 12h2.5M11 12h2.5M15.25 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function stopUiEvent(event) {
  event.stopPropagation();
}

function sanitizeDecimalInput(value) {
  const normalized = value.replaceAll(",", ".");
  let clean = "";
  let hasDot = false;

  for (const char of normalized) {
    if (char >= "0" && char <= "9") {
      clean += char;
      continue;
    }

    if (char === "." && !hasDot) {
      clean += char;
      hasDot = true;
    }
  }

  return clean;
}

function NumericField({ value, onChange }) {
  const [draft, setDraft] = useState((Number.isFinite(value) ? value : 0).toFixed(2));

  useEffect(() => {
    setDraft((Number.isFinite(value) ? value : 0).toFixed(2));
  }, [value]);

  function commit() {
    const clean = sanitizeDecimalInput(draft);
    const parsed = Number.parseFloat(clean);
    const safeValue = Number.isFinite(parsed) ? parsed : 0;
    setDraft(safeValue.toFixed(2));
    onChange(safeValue);
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onMouseDown={stopUiEvent}
      onKeyDown={(event) => {
        stopUiEvent(event);
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        }
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      className="h-8 w-full rounded border border-white/15 bg-white/10 px-2 text-right text-xs text-white outline-none focus:border-sky-300"
    />
  );
}

function IntegerField({ value, min = 1, max = 96, onChange }) {
  const safeValue = Number.isFinite(value) ? value : min;
  const [draft, setDraft] = useState(String(safeValue));

  useEffect(() => {
    setDraft(String(Number.isFinite(value) ? value : min));
  }, [min, value]);

  function commit() {
    const parsed = Number.parseInt(draft, 10);
    const nextValue = Math.min(Math.max(Number.isFinite(parsed) ? parsed : min, min), max);
    setDraft(String(nextValue));
    onChange(nextValue);
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      step="1"
      value={draft}
      onMouseDown={stopUiEvent}
      onKeyDown={(event) => {
        stopUiEvent(event);
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        }
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      className="h-8 w-full rounded border border-white/15 bg-white/10 px-2 text-right text-xs text-white outline-none focus:border-sky-300"
    />
  );
}

function PropertiesPanel() {
  const unitType = useWorkspace3DStore((state) => state.unitType);
  const selectedComp = useWorkspace3DStore((state) =>
    state.selectedIds.length === 1 ? state.comps.find((comp) => comp.id === state.selectedIds[0]) : null,
  );
  const updateShape = useWorkspace3DStore((state) => state.updateShape);
  const toggleHole = useWorkspace3DStore((state) => state.toggleHole);
  const unit = UNIT_OPTIONS.find((option) => option.value === unitType) ?? UNIT_OPTIONS[0];

  if (!selectedComp || selectedComp.type === "group") return null;

  const baseSize = selectedComp.baseSize ?? DEFAULT_BASE_SIZE;
  const scale = selectedComp.scale ?? DEFAULT_BASE_SIZE;
  const unitGeometrySize = unitGeometrySizeForComp(selectedComp);
  const dimensions = renderedDimensionsForComp(selectedComp).map((value) => value * unit.factor);
  const position = selectedComp.pos.map((value) => value * unit.factor);
  const rotation = rotationDegreesFor(selectedComp.quat);
  const segmentLimits = SEGMENT_LIMITS[selectedComp.type];
  const segments = segmentLimits ? segmentCountFor(selectedComp, selectedComp.type === "pyramid" ? 4 : 32) : null;

  function updatePosition(index, displayedValue) {
    if (!Number.isFinite(displayedValue)) return;
    const nextPos = [...selectedComp.pos];
    nextPos[index] = displayedValue / unit.factor;
    updateShape(selectedComp.id, { pos: nextPos });
  }

  function updateRotation(index, degrees) {
    if (!Number.isFinite(degrees)) return;
    const nextRotation = [...rotation];
    nextRotation[index] = degrees;
    updateShape(selectedComp.id, { quat: quaternionFromRotationDegrees(nextRotation) });
  }

  function updateDimension(index, displayedValue) {
    if (!Number.isFinite(displayedValue)) return;
    const desiredWorldSize = Math.max(displayedValue / unit.factor, 0.001);
    const nextScale = [...scale];
    nextScale[index] = desiredWorldSize / Math.max(unitGeometrySize[index] * baseSize[index], 0.001);
    updateShape(selectedComp.id, anchoredScaleUpdate(selectedComp, nextScale));
  }

  function updateScale(index, value) {
    if (!Number.isFinite(value)) return;
    const nextScale = [...scale];
    nextScale[index] = value;
    updateShape(selectedComp.id, anchoredScaleUpdate(selectedComp, nextScale));
  }

  function applyScale() {
    const nextBaseSize = baseSize.map((value, index) => Math.max(value * scale[index], 0.001));
    updateShape(selectedComp.id, {
      baseSize: nextBaseSize,
      scale: [1, 1, 1],
    });
  }

  return (
    <div
      className="pointer-events-auto absolute bottom-3 left-3 max-h-[calc(100vh-17rem)] w-56 overflow-y-auto rounded-lg border border-white/15 bg-slate-950/85 p-3 text-white shadow-2xl backdrop-blur"
      onMouseDown={stopUiEvent}
      onKeyDown={stopUiEvent}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-bold uppercase tracking-wider text-white/70">Properties</div>
        <div className="truncate text-xs text-white/45">{selectedComp.name ?? selectedComp.id}</div>
      </div>

      <button
        type="button"
        title={selectedComp.isHole ? "Prepnout na pozitivni objem" : "Prepnout na negativni objem"}
        onMouseDown={stopUiEvent}
        onKeyDown={stopUiEvent}
        onClick={() => toggleHole(selectedComp.id)}
        className={`mb-4 w-full rounded border px-3 py-2 text-xs font-semibold transition ${
          selectedComp.isHole ? "border-orange-300 bg-orange-400 text-slate-950" : "border-white/15 bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {selectedComp.isHole ? "Negative Volume" : "Solid Volume"}
      </button>

      {selectedComp.type === "text3d" && (
        <label className="mb-4 block text-xs font-semibold uppercase tracking-wider text-white/50">
          Text
          <input
            type="text"
            value={selectedComp.text ?? "Text"}
            onMouseDown={stopUiEvent}
            onKeyDown={stopUiEvent}
            onChange={(event) => updateShape(selectedComp.id, { text: event.target.value })}
            className="mt-2 h-8 w-full rounded border border-white/15 bg-white/10 px-2 text-sm normal-case tracking-normal text-white outline-none focus:border-sky-300"
          />
        </label>
      )}

      {segmentLimits && (
        <label className="mb-4 block text-xs font-semibold uppercase tracking-wider text-white/50">
          {segmentLimits.label}
          <IntegerField
            value={segments}
            min={segmentLimits.min}
            max={segmentLimits.max}
            onChange={(value) => updateShape(selectedComp.id, { segments: value })}
          />
        </label>
      )}

      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Dimensions ({unit.label})</div>
        <div className="grid grid-cols-3 gap-2">
          {AXES.map((axis, index) => (
            <label key={axis} className="text-xs text-white/60">
              {axis}
              <NumericField value={dimensions[index]} onChange={(value) => updateDimension(index, value)} />
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Position ({unit.label})</div>
        <div className="grid grid-cols-3 gap-2">
          {AXES.map((axis, index) => (
            <label key={axis} className="text-xs text-white/60">
              {axis}
              <NumericField value={position[index]} onChange={(value) => updatePosition(index, value)} />
            </label>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">Rotation (deg)</div>
        <div className="grid grid-cols-3 gap-2">
          {AXES.map((axis, index) => (
            <label key={axis} className="text-xs text-white/60">
              {axis}
              <NumericField value={rotation[index]} onChange={(value) => updateRotation(index, value)} />
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-white/50">Scale</div>
          <button
            type="button"
            title="Pouzit meritko"
            onMouseDown={stopUiEvent}
            onKeyDown={stopUiEvent}
            onClick={applyScale}
            className="rounded border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
          >
            Apply
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {AXES.map((axis, index) => (
            <label key={axis} className="text-xs text-white/60">
              {axis}
              <NumericField value={scale[index]} onChange={(value) => updateScale(index, value)} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function MeasurePanel() {
  const unitType = useWorkspace3DStore((state) => state.unitType);
  const comps = useWorkspace3DStore((state) => state.comps);
  const selectedIds = useWorkspace3DStore((state) => state.selectedIds);
  const unit = UNIT_OPTIONS.find((option) => option.value === unitType) ?? UNIT_OPTIONS[0];
  const selectedComps = useMemo(
    () => comps.filter((comp) => selectedIds.includes(comp.id) && comp.type !== "group"),
    [comps, selectedIds],
  );
  const size = measureComps(selectedComps, unit.factor);

  if (!size) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-white/15 bg-slate-950/85 px-4 py-3 text-xs font-semibold text-white shadow-2xl backdrop-blur">
      <Ruler className="h-4 w-4 text-sky-300" />
      <span>X {size[0].toFixed(2)} {unit.label}</span>
      <span>Y {size[1].toFixed(2)} {unit.label}</span>
      <span>Z {size[2].toFixed(2)} {unit.label}</span>
    </div>
  );
}

function WorkspaceOverlay({ onExit }) {
  const [flashedAlignAxis, setFlashedAlignAxis] = useState(null);
  const transformMode = useWorkspace3DStore((state) => state.transformMode);
  const editTarget = useWorkspace3DStore((state) => state.editTarget);
  const unitType = useWorkspace3DStore((state) => state.unitType);
  const isSnappingEnabled = useWorkspace3DStore((state) => state.isSnappingEnabled);
  const selectedIds = useWorkspace3DStore((state) => state.selectedIds);
  const splitPlane = useWorkspace3DStore((state) => state.splitPlane);
  const comps = useWorkspace3DStore((state) => state.comps);
  const selectedComp = useWorkspace3DStore((state) =>
    state.selectedIds.length === 1 ? state.comps.find((comp) => comp.id === state.selectedIds[0]) : null,
  );
  const addShape = useWorkspace3DStore((state) => state.addShape);
  const setTransformMode = useWorkspace3DStore((state) => state.setTransformMode);
  const setEditTarget = useWorkspace3DStore((state) => state.setEditTarget);
  const setUnitType = useWorkspace3DStore((state) => state.setUnitType);
  const toggleSnapping = useWorkspace3DStore((state) => state.toggleSnapping);
  const alignSelected = useWorkspace3DStore((state) => state.alignSelected);
  const mirrorSelected = useWorkspace3DStore((state) => state.mirrorSelected);
  const toggleHole = useWorkspace3DStore((state) => state.toggleHole);
  const startSplit = useWorkspace3DStore((state) => state.startSplit);
  const cancelSplit = useWorkspace3DStore((state) => state.cancelSplit);
  const replaceWithSplitParts = useWorkspace3DStore((state) => state.replaceWithSplitParts);
  const centerCursorToSelected = useWorkspace3DStore((state) => state.centerCursorToSelected);
  const groupSelected = useWorkspace3DStore((state) => state.groupSelected);
  const ungroupSelected = useWorkspace3DStore((state) => state.ungroupSelected);
  const pivotIsOffset = selectedComp ? selectedComp.pivotOffset.reduce((sum, value) => sum + Math.abs(value), 0) > 0.001 : false;
  const selectedIsGroup = selectedComp?.type === "group";
  const alignmentDisabled = selectedIds.length <= 1;
  const holeToggleDisabled = !selectedComp;
  const mirrorDisabled = selectedIds.length === 0;
  const splitDisabled = selectedIds.length !== 1;

  function handleAlign(axisIndex) {
    if (alignmentDisabled) return;
    alignSelected(axisIndex);
    setFlashedAlignAxis(axisIndex);
    window.setTimeout(() => setFlashedAlignAxis((current) => (current === axisIndex ? null : current)), 180);
  }

  function exportSelectedStl() {
    downloadSelectedStl(comps, selectedIds);
  }

  function confirmSplit() {
    if (!splitPlane) return;
    const targetComp = comps.find((comp) => comp.id === splitPlane.targetId);
    if (!targetComp) return;
    replaceWithSplitParts(targetComp.id, splitCompWithPlane(targetComp, splitPlane));
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {onExit && (
        <button
          type="button"
          title="Opustit Studio"
          aria-label="Opustit Studio"
          onMouseDown={stopUiEvent}
          onKeyDown={stopUiEvent}
          onClick={onExit}
          className="pointer-events-auto fixed left-[10px] top-[10px] z-[9999] inline-flex h-10 w-10 items-center justify-center rounded border border-slate-600 bg-slate-800 text-white shadow-2xl transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300/70"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <div className="pointer-events-auto absolute left-4 top-24 flex flex-col gap-2">
        <ToolButton title="Posunout" active={transformMode === "translate"} onClick={() => setTransformMode("translate")}>
          <Move3D className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Otocit" active={transformMode === "rotate"} onClick={() => setTransformMode("rotate")}>
          <Rotate3D className="h-4 w-4" />
        </ToolButton>
        <ToolButton title="Zmenit velikost" active={transformMode === "scale"} onClick={() => setTransformMode("scale")}>
          <Scale3D className="h-4 w-4" />
        </ToolButton>
      </div>

      <div className="pointer-events-auto absolute left-16 top-4 flex flex-wrap gap-2">
        <ToolButton
          title={editTarget === "object" ? "Upravit pivot" : "Upravit objekt"}
          active={editTarget === "pivot"}
          onClick={() => setEditTarget(editTarget === "object" ? "pivot" : "object")}
        >
          {editTarget === "object" ? <Box className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
        </ToolButton>
        <ToolButton title="Prichytavani ke gridu" active={isSnappingEnabled} onClick={toggleSnapping}>
          <Magnet className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          title={selectedComp?.isHole ? "Přepnout na pozitivní objem" : "Přepnout na negativní objem"}
          disabled={holeToggleDisabled}
          active={Boolean(selectedComp?.isHole)}
          onClick={() => selectedComp && toggleHole(selectedComp.id)}
        >
          <HoleToggleIcon active={Boolean(selectedComp?.isHole)} />
        </ToolButton>
        <ToolButton title="Zrcadlit podle X" disabled={mirrorDisabled} onClick={() => mirrorSelected(0)}>
          <MirrorXIcon />
        </ToolButton>
        <ToolButton title="Zrcadlit podle Y" disabled={mirrorDisabled} onClick={() => mirrorSelected(1)}>
          <MirrorYIcon />
        </ToolButton>
        <div className="flex gap-1 rounded-lg border border-slate-700 bg-slate-900/85 p-1" aria-label="Alignment">
          <ToolButton
            title="Zarovnat X"
            disabled={alignmentDisabled}
            active={flashedAlignAxis === 0}
            onClick={() => handleAlign(0)}
          >
            <AlignXIcon />
          </ToolButton>
          <ToolButton
            title="Zarovnat Y"
            disabled={alignmentDisabled}
            active={flashedAlignAxis === 1}
            onClick={() => handleAlign(1)}
          >
            <AlignYIcon />
          </ToolButton>
          <ToolButton
            title="Zarovnat Z"
            disabled={alignmentDisabled}
            active={flashedAlignAxis === 2}
            onClick={() => handleAlign(2)}
          >
            <AlignZIcon />
          </ToolButton>
        </div>
        <ToolButton title="Stahnout STL" disabled={selectedIds.length === 0} onClick={exportSelectedStl}>
          <Download className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          title="Rozříznout"
          disabled={splitDisabled}
          active={Boolean(splitPlane)}
          onClick={splitPlane ? cancelSplit : startSplit}
        >
          <SplitIcon />
        </ToolButton>
        {splitPlane && (
          <ToolButton title="Potvrdit rez" onClick={confirmSplit}>
            <Check className="h-4 w-4" />
          </ToolButton>
        )}
        {selectedIds.length === 1 && pivotIsOffset && (
          <ToolButton title="Vycentrovat pivot" onClick={centerCursorToSelected}>
            <LocateFixed className="h-4 w-4" />
          </ToolButton>
        )}
      </div>

      <div className="pointer-events-auto absolute left-1/2 top-4 -translate-x-1/2">
        <select
          value={unitType}
          onMouseDown={stopUiEvent}
          onKeyDown={stopUiEvent}
          onChange={(event) => setUnitType(event.target.value)}
          className="h-10 rounded border border-white/15 bg-slate-950/85 px-3 text-sm font-semibold text-white shadow-2xl outline-none backdrop-blur"
        >
          {UNIT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pointer-events-auto absolute right-5 top-16 flex max-h-[calc(100vh-5rem)] items-start gap-2.5">
        {(selectedIds.length > 1 || (selectedIds.length === 1 && selectedIsGroup)) && (
          <div>
            {selectedIds.length > 1 ? (
              <ToolButton title="Seskupit" onClick={groupSelected}>
                <Combine className="h-4 w-4" />
              </ToolButton>
            ) : (
              <ToolButton title="Rozdelit skupinu" onClick={ungroupSelected}>
                <Ungroup className="h-4 w-4" />
              </ToolButton>
            )}
          </div>
        )}

        <aside className="max-h-[calc(100vh-5rem)] w-52 overflow-y-auto rounded-xl border border-white/15 bg-slate-950/80 p-4 text-white shadow-2xl backdrop-blur">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/70">Shape Library</h2>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SHAPE_LABELS).map(([type, label]) => (
              <button
                type="button"
                key={type}
                title={label}
                aria-label={`Add ${label}`}
                onClick={() => addShape(type)}
                className="flex aspect-square items-center justify-center rounded border border-slate-600 bg-slate-800 text-slate-100 transition hover:border-sky-400/70 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300/70"
              >
                <ShapeThumbnail type={type} />
              </button>
            ))}
          </div>
          <div className="mt-4 text-xs text-white/50">
            {selectedIds.length === 1 && selectedComp ? selectedComp.name ?? selectedComp.id : selectedIds.length > 0 ? `Selected: ${selectedIds.length}` : "No selection"}
          </div>
        </aside>
      </div>
      <PropertiesPanel />
      <MeasurePanel />
    </div>
  );
}

export function Workspace3D({ onExit }) {
  const boxSelectHandlerRef = useRef(null);
  const boxStartRef = useRef(null);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [boxDrag, setBoxDrag] = useState(null);
  const comps = useWorkspace3DStore((state) => state.comps);
  const selectedIds = useWorkspace3DStore((state) => state.selectedIds);
  const splitPlane = useWorkspace3DStore((state) => state.splitPlane);
  const clearSelection = useWorkspace3DStore((state) => state.clearSelection);
  const deleteSelected = useWorkspace3DStore((state) => state.deleteSelected);
  const selectAll = useWorkspace3DStore((state) => state.selectAll);
  const copySelected = useWorkspace3DStore((state) => state.copySelected);
  const pasteClipboard = useWorkspace3DStore((state) => state.pasteClipboard);
  const undo = useWorkspace3DStore((state) => state.undo);
  const setEditTarget = useWorkspace3DStore((state) => state.setEditTarget);
  const replaceWithSplitParts = useWorkspace3DStore((state) => state.replaceWithSplitParts);
  const cancelSplit = useWorkspace3DStore((state) => state.cancelSplit);
  const boxSelecting = Boolean(boxDrag?.active);

  const setBoxSelectHandler = useCallback((handler) => {
    boxSelectHandlerRef.current = handler;
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Shift") setShiftHeld(true);
      const target = event.target;
      if (target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;

      if (splitPlane && event.key === "Enter") {
        event.preventDefault();
        const targetComp = comps.find((comp) => comp.id === splitPlane.targetId);
        if (!targetComp) return;
        replaceWithSplitParts(targetComp.id, splitCompWithPlane(targetComp, splitPlane));
        return;
      }

      if (splitPlane && event.key === "Escape") {
        event.preventDefault();
        cancelSplit();
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase();
        if (key === "a") {
          event.preventDefault();
          selectAll();
          return;
        }
        if (key === "z") {
          event.preventDefault();
          undo();
          return;
        }
        if (key === "c") {
          event.preventDefault();
          copySelected();
          return;
        }
        if (key === "v") {
          event.preventDefault();
          pasteClipboard();
          return;
        }
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedIds.length > 0) {
        event.preventDefault();
        deleteSelected();
      }
    }

    function handleKeyUp(event) {
      if (event.key === "Shift") setShiftHeld(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [cancelSplit, comps, copySelected, deleteSelected, pasteClipboard, replaceWithSplitParts, selectAll, selectedIds.length, splitPlane, undo]);

  useEffect(() => {
    const selectedComp = selectedIds.length === 1 ? comps.find((comp) => comp.id === selectedIds[0]) : null;
    if (selectedIds.length > 1 || selectedComp?.type === "group") setEditTarget("object");
  }, [comps, selectedIds, setEditTarget]);

  useEffect(() => {
    if (shiftHeld) return;
    boxStartRef.current = null;
    setBoxDrag(null);
  }, [shiftHeld]);

  useEffect(() => {
    function handlePointerMove(event) {
      const start = boxStartRef.current;
      if (!start) return;

      const current = { x: event.clientX, y: event.clientY };
      const distance = Math.hypot(current.x - start.x, current.y - start.y);
      if (distance < 5 && !boxDrag?.active) return;

      event.preventDefault();
      setBoxDrag({
        active: true,
        rect: normalizeScreenRect(start, current),
      });
    }

    function handlePointerUp(event) {
      const start = boxStartRef.current;
      if (!start) return;

      const current = { x: event.clientX, y: event.clientY };
      const distance = Math.hypot(current.x - start.x, current.y - start.y);
      if (distance >= 5) {
        const rect = normalizeScreenRect(start, current);
        boxSelectHandlerRef.current?.(rect);
      }

      boxStartRef.current = null;
      setBoxDrag(null);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [boxDrag?.active]);

  function handleBoxPointerDown(event) {
    if (!shiftHeld || event.button !== 0) return;
    boxStartRef.current = { x: event.clientX, y: event.clientY };
  }

  return (
    <section
      className="relative h-screen w-screen overflow-hidden bg-white"
      onPointerDownCapture={handleBoxPointerDown}
    >
      <Canvas
        className="absolute inset-0"
        shadows
        camera={{ position: [5, -7, 5], fov: 45, up: [0, 0, 1] }}
        onCreated={({ camera, gl }) => {
          gl.setClearColor("#ffffff", 1);
          camera.up.copy(WORLD_UP);
          camera.lookAt(0, 0, 0);
        }}
        onPointerMissed={(event) => {
          if (event.type === "click") clearSelection();
        }}
      >
        <WorkspaceScene boxSelecting={boxSelecting} onBoxSelectReady={setBoxSelectHandler} />
      </Canvas>
      {boxDrag?.active && (
        <div
          className="pointer-events-none absolute z-30 border border-sky-300 bg-sky-400/20"
          style={{
            left: boxDrag.rect.left,
            top: boxDrag.rect.top,
            width: boxDrag.rect.right - boxDrag.rect.left,
            height: boxDrag.rect.bottom - boxDrag.rect.top,
          }}
        />
      )}
      <WorkspaceOverlay onExit={onExit} />
    </section>
  );
}
