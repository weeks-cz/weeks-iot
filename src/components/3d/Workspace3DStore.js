import { create } from "zustand";
import { Quaternion, Vector3 } from "three";

const identityQuat = [0, 0, 0, 1];
const unitScale = [1, 1, 1];
const defaultBaseSizes = {
  box: [1, 1, 1],
  sphere: [1, 1, 1],
  cylinder: [1, 1, 1],
  cone: [1, 1, 1],
  pyramid: [1, 1, 1],
  wedge: [1, 1, 1],
  hemisphere: [1, 1, 1],
  torus: [1, 1, 1],
  star: [1, 1, 1],
  text3d: [1, 1, 1],
};
const namePrefixes = {
  box: "cube",
  sphere: "sphere",
  cylinder: "cylinder",
  cone: "cone",
  pyramid: "pyramid",
  wedge: "wedge",
  hemisphere: "hemisphere",
  torus: "torus",
  star: "star",
  text3d: "text",
  group: "union",
};
const defaultColor = "hotpink";
const historyLimit = 80;
const pyramidGridQuat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4).toArray();

function baseSizeFor(type) {
  return [...(defaultBaseSizes[type] ?? defaultBaseSizes.box)];
}

function segmentsFor(type) {
  if (type === "pyramid") return 4;
  if (type === "hexagonalPrism") return 6;
  if (type === "sphere" || type === "cylinder" || type === "cone" || type === "hemisphere" || type === "torus") return 32;
  return undefined;
}

function quatFor(type) {
  return type === "pyramid" ? [...pyramidGridQuat] : [...identityQuat];
}

function visualCenterFor(comp) {
  const baseSize = comp.baseSize ?? [0, 0, 0];
  const localCenter = comp.type === "group"
    ? new Vector3(...comp.pivotOffset)
    : new Vector3(comp.pivotOffset[0], comp.pivotOffset[1], comp.pivotOffset[2] + baseSize[2] / 2);

  return localCenter
    .multiply(new Vector3(...comp.scale))
    .applyQuaternion(new Quaternion(...comp.quat))
    .add(new Vector3(...comp.pos))
    .toArray();
}

function transformedChild(child, parent) {
  const parentPos = new Vector3(...parent.pos);
  const parentQuat = new Quaternion(...parent.quat);
  const parentScale = new Vector3(...parent.scale);
  const childPos = new Vector3(...child.pos).multiply(parentScale).applyQuaternion(parentQuat).add(parentPos);
  const childQuat = parentQuat.clone().multiply(new Quaternion(...child.quat));
  const childScale = new Vector3(...child.scale).multiply(parentScale);

  return {
    ...child,
    pos: childPos.toArray(),
    quat: childQuat.toArray(),
    scale: childScale.toArray(),
  };
}

function flattenToWorld(comp) {
  if (comp.type !== "group") return [{ ...comp }];

  return comp.children.flatMap((child) => {
    const worldChild = transformedChild(child, comp);
    return flattenToWorld(worldChild);
  });
}

function withLocalTransform(comp, groupPos) {
  return {
    ...comp,
    pos: new Vector3(...comp.pos).sub(groupPos).toArray(),
    quat: [...comp.quat],
    scale: [...comp.scale],
  };
}

function cloneComponent(comp) {
  return {
    ...comp,
    name: comp.name,
    pos: [...comp.pos],
    quat: [...comp.quat],
    scale: [...comp.scale],
    baseSize: comp.baseSize ? [...comp.baseSize] : undefined,
    color: comp.color,
    text: comp.text,
    segments: comp.segments,
    geometryData: comp.geometryData ? { positions: [...(comp.geometryData.positions ?? [])] } : undefined,
    pivotOffset: [...comp.pivotOffset],
    children: comp.children?.map(cloneComponent),
  };
}

function validNumberArray(value, fallback, length = fallback.length) {
  if (!Array.isArray(value) || value.length !== length) return [...fallback];
  const numbers = value.map((item) => Number(item));
  return numbers.every(Number.isFinite) ? numbers : [...fallback];
}

function normalizeImportedComponent(comp, usedIds, index = 0) {
  const type = typeof comp?.type === "string" ? comp.type : "box";
  const rawId = typeof comp?.id === "string" && comp.id.trim() ? comp.id.trim() : `${type}-import-${index}`;
  let id = rawId;
  let suffix = 1;
  while (usedIds.has(id)) {
    id = `${rawId}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);

  const normalized = {
    id,
    name: typeof comp?.name === "string" && comp.name.trim() ? comp.name : id,
    type,
    isHole: Boolean(comp?.isHole),
    color: typeof comp?.color === "string" ? comp.color : defaultColor,
    pos: validNumberArray(comp?.pos, [0, 0, 0]),
    quat: validNumberArray(comp?.quat, identityQuat),
    scale: validNumberArray(comp?.scale, unitScale),
    baseSize: validNumberArray(comp?.baseSize, baseSizeFor(type)),
    pivotOffset: validNumberArray(comp?.pivotOffset, [0, 0, 0]),
    ...(Number.isFinite(Number(comp?.segments)) ? { segments: Number(comp.segments) } : {}),
    ...(typeof comp?.text === "string" ? { text: comp.text } : {}),
  };

  if (comp?.geometryData?.positions) {
    const positions = validNumberArray(comp.geometryData.positions, [], comp.geometryData.positions.length);
    if (positions.length > 0) normalized.geometryData = { positions };
  }

  if (Array.isArray(comp?.children)) {
    normalized.children = comp.children.map((child, childIndex) => normalizeImportedComponent(child, usedIds, childIndex));
  }

  return normalized;
}

function nextComponentName(type, comps) {
  const prefix = namePrefixes[type] ?? type;
  const pattern = new RegExp(`^${prefix}(\\d+)$`, "i");
  const highest = comps.reduce((max, comp) => {
    const match = comp.name?.match(pattern);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}${highest + 1}`;
}

function stampIds(comp, comps = []) {
  const name = nextComponentName(comp.type, comps);
  const id = `${comp.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const stamped = {
    ...comp,
    id,
    name,
    children: comp.children?.map((child) => stampIds(child, comps)),
  };
  comps.push(stamped);
  return stamped;
}

function snapshotState(state) {
  return {
    comps: state.comps.map(cloneComponent),
    cursorPos: [...state.cursorPos],
    selectedIds: [...state.selectedIds],
    selectionMethod: state.selectionMethod,
    editTarget: state.editTarget,
  };
}

function sameSnapshot(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pushHistory(state) {
  const snapshot = snapshotState(state);
  const previous = state.history.at(-1);
  if (previous && sameSnapshot(previous, snapshot)) return state.history;
  return [...state.history, snapshot].slice(-historyLimit);
}

export const useWorkspace3DStore = create((set, get) => ({
  comps: [
    {
      id: "box-1",
      name: "cube1",
      type: "box",
      isHole: false,
      color: defaultColor,
      pos: [0, 0, 0],
      quat: [0, 0, 0, 1],
      scale: [1, 1, 1],
      baseSize: [1, 1, 1],
      pivotOffset: [0, 0, 0],
    },
  ],
  cursorPos: [0, 0, 0],
  selectedIds: [],
  selectionMethod: "none",
  history: [],
  clipboard: [],
  splitPlane: null,
  unitType: "mm",
  isSnappingEnabled: false,
  scaleMode: "both",
  transformMode: "translate",
  editTarget: "object",
  saveHistory: () => {
    set((state) => ({ history: pushHistory(state) }));
  },
  undo: () => {
    set((state) => {
      const current = snapshotState(state);
      const history = [...state.history];
      let snapshot = history.pop();

      while (snapshot && sameSnapshot(snapshot, current)) {
        snapshot = history.pop();
      }

      if (!snapshot) return state;

      return {
        ...snapshot,
        history,
      };
    });
  },
  addShape: (type) => {
    const cursorPos = get().cursorPos;
    set((state) => ({
      history: pushHistory(state),
      ...(() => {
        const name = nextComponentName(type, state.comps);
        const id = `${name}-${Date.now()}`;
        return {
          comps: [
          ...state.comps,
          {
            id,
            name,
            type,
            isHole: false,
            color: defaultColor,
            pos: [...cursorPos],
            quat: quatFor(type),
            scale: [1, 1, 1],
            baseSize: baseSizeFor(type),
            pivotOffset: [0, 0, 0],
            ...(segmentsFor(type) ? { segments: segmentsFor(type) } : {}),
            ...(type === "text3d" ? { text: "Text" } : {}),
          },
          ],
          selectedIds: [id],
        };
      })(),
      selectionMethod: "single",
      editTarget: "object",
    }));
  },
  selectShape: (id, additive = false) => {
    if (!id) {
      set({ selectedIds: [], selectionMethod: "none" });
      return;
    }

    set((state) => {
      if (!additive) return { selectedIds: [id], selectionMethod: "single" };
      const selected = state.selectedIds.includes(id);
      const selectedIds = selected ? state.selectedIds.filter((selectedId) => selectedId !== id) : [...state.selectedIds, id];
      return {
        selectedIds,
        selectionMethod: "sequential",
        editTarget: selectedIds.length > 1 ? "object" : state.editTarget,
      };
    });
  },
  clearSelection: () => set({ selectedIds: [], selectionMethod: "none" }),
  selectAll: () => set((state) => ({ selectedIds: state.comps.map((comp) => comp.id), selectionMethod: "mass", editTarget: "object" })),
  copySelected: () => {
    const { comps, selectedIds } = get();
    const copied = comps.filter((comp) => selectedIds.includes(comp.id)).map(cloneComponent);
    set({ clipboard: copied });
  },
  pasteClipboard: () => {
    const { clipboard } = get();
    if (clipboard.length === 0) return;

    const namingPool = get().comps.map(cloneComponent);
    const pasted = clipboard.map((comp) => {
      const clone = stampIds(cloneComponent(comp), namingPool);
      return clone;
    });

    set((state) => ({
      history: pushHistory(state),
      comps: [...state.comps, ...pasted],
      selectedIds: pasted.map((comp) => comp.id),
      selectionMethod: pasted.length > 1 ? "mass" : "single",
      editTarget: pasted.length > 1 ? "object" : state.editTarget,
    }));
  },
  addSelectedShapes: (ids) => {
    if (ids.length === 0) return;
    set((state) => ({
      selectedIds: Array.from(new Set([...state.selectedIds, ...ids])),
      selectionMethod: "mass",
      editTarget: Array.from(new Set([...state.selectedIds, ...ids])).length > 1 ? "object" : state.editTarget,
    }));
  },
  setTransformMode: (mode) => set({ transformMode: mode }),
  setEditTarget: (editTarget) => set((state) => (state.editTarget === editTarget ? state : { editTarget })),
  setUnitType: (unitType) => set({ unitType }),
  loadProject: (project) => {
    const importedComps = Array.isArray(project?.comps) ? project.comps : [];
    if (importedComps.length === 0) return false;

    const usedIds = new Set();
    const comps = importedComps.map((comp, index) => normalizeImportedComponent(comp, usedIds, index));
    const importedSelectedIds = Array.isArray(project?.selectedIds) ? project.selectedIds : [];
    const selectedIds = importedSelectedIds.filter((id) => usedIds.has(id));
    const cursorPos = validNumberArray(project?.cursorPos, [0, 0, 0]);
    const unitType = ["mm", "cm", "m", "inch"].includes(project?.unitType) ? project.unitType : get().unitType;

    set((state) => ({
      history: pushHistory(state),
      comps,
      cursorPos,
      selectedIds,
      selectionMethod: selectedIds.length > 1 ? "mass" : selectedIds.length === 1 ? "single" : "none",
      editTarget: "object",
      splitPlane: null,
      unitType,
    }));

    return true;
  },
  startSplit: () => {
    const { comps, selectedIds } = get();
    if (selectedIds.length === 0) return;
    const selected = selectedIds.map((id) => comps.find((comp) => comp.id === id)).filter(Boolean);
    if (selected.length === 0) return;
    const center = selected
      .reduce((sum, comp) => sum.add(new Vector3(...visualCenterFor(comp))), new Vector3())
      .divideScalar(selected.length);
    set({
      splitPlane: {
        targetIds: selected.map((comp) => comp.id),
        pos: center.toArray(),
        quat: [...identityQuat],
      },
      editTarget: "object",
      transformMode: "translate",
    });
  },
  updateSplitPlane: (newData) => set((state) => (state.splitPlane ? { splitPlane: { ...state.splitPlane, ...newData } } : state)),
  cancelSplit: () => set({ splitPlane: null }),
  replaceWithSplitParts: (targetId, parts) => {
    const targetIds = Array.isArray(targetId) ? targetId : [targetId];
    if (parts.length === 0 || targetIds.length === 0) {
      set({ splitPlane: null });
      return;
    }
    set((state) => ({
      history: pushHistory(state),
      comps: [...state.comps.filter((comp) => !targetIds.includes(comp.id)), ...parts],
      selectedIds: parts.map((part) => part.id),
      selectionMethod: "mass",
      editTarget: "object",
      splitPlane: null,
    }));
  },
  toggleSnapping: () => set((state) => ({ isSnappingEnabled: !state.isSnappingEnabled })),
  cycleScaleMode: () => {
    set((state) => {
      const next = state.scaleMode === "negative" ? "both" : state.scaleMode === "both" ? "positive" : "negative";
      return { scaleMode: next };
    });
  },
  toggleHole: (id) => {
    set((state) => ({
      history: pushHistory(state),
      comps: state.comps.map((comp) => (comp.id === id ? { ...comp, isHole: !comp.isHole } : comp)),
    }));
  },
  setSelectedColor: (color) => {
    set((state) => ({
      history: pushHistory(state),
      comps: state.comps.map((comp) => (state.selectedIds.includes(comp.id) && comp.type !== "group" ? { ...comp, color } : comp)),
    }));
  },
  mirrorSelected: (axisIndex) => {
    set((state) => ({
      history: pushHistory(state),
      comps: state.comps.map((comp) => {
        if (!state.selectedIds.includes(comp.id)) return comp;
        const scale = [...comp.scale];
        scale[axisIndex] *= -1;
        return { ...comp, scale };
      }),
    }));
  },
  duplicateSelected: () => {
    const { comps, selectedIds } = get();
    const selected = comps.filter((comp) => selectedIds.includes(comp.id));
    if (selected.length === 0) return;
    const namingPool = comps.map(cloneComponent);
    const duplicates = selected.map((comp) => {
      const clone = stampIds(cloneComponent(comp), namingPool);
      return { ...clone, pos: [clone.pos[0] + 1, clone.pos[1] + 1, clone.pos[2]] };
    });

    set((state) => ({
      history: pushHistory(state),
      comps: [...state.comps, ...duplicates],
      selectedIds: duplicates.map((comp) => comp.id),
      selectionMethod: duplicates.length > 1 ? "mass" : "single",
      editTarget: duplicates.length > 1 ? "object" : state.editTarget,
    }));
  },
  alignSelected: (axisIndex) => {
    const { comps, selectedIds, selectionMethod } = get();
    if (selectedIds.length < 2) return;

    const selected = selectedIds.map((id) => comps.find((comp) => comp.id === id)).filter(Boolean);
    if (selected.length < 2) return;

    const target =
      selectionMethod === "sequential"
        ? selected[0].pos[axisIndex]
        : selected.reduce((sum, comp) => sum + comp.pos[axisIndex], 0) / selected.length;
    const anchorId = selectionMethod === "sequential" ? selected[0].id : null;

    set((state) => ({
      history: pushHistory(state),
      comps: state.comps.map((comp) => {
        if (!selectedIds.includes(comp.id) || comp.id === anchorId) return comp;
        const pos = [...comp.pos];
        pos[axisIndex] = target;
        return { ...comp, pos };
      }),
    }));
  },
  setCursorPos: (cursorPos) => set((state) => ({ history: pushHistory(state), cursorPos: [...cursorPos] })),
  groupSelected: () => {
    const { comps, selectedIds } = get();
    if (selectedIds.length <= 1) return;

    const selected = selectedIds.map((id) => comps.find((comp) => comp.id === id)).filter(Boolean);
    const groupChildren = selected.map(cloneComponent);
    if (groupChildren.length === 0) return;

    const centroid = groupChildren
      .reduce((sum, comp) => sum.add(new Vector3(...comp.pos)), new Vector3())
      .divideScalar(groupChildren.length);
    const groupName = nextComponentName("group", comps);
    const groupId = `${groupName}-${Date.now()}`;
    const group = {
      id: groupId,
      name: groupName,
      type: "group",
      isHole: false,
      color: defaultColor,
      pos: centroid.toArray(),
      quat: [...identityQuat],
      scale: [...unitScale],
      pivotOffset: [0, 0, 0],
      children: groupChildren.map((child) => withLocalTransform(child, centroid)),
    };

    set((state) => ({
      history: pushHistory(state),
      comps: [...state.comps.filter((comp) => !selectedIds.includes(comp.id)), group],
      selectedIds: [groupId],
      selectionMethod: "single",
      editTarget: "object",
    }));
  },
  ungroupSelected: () => {
    const { comps, selectedIds } = get();
    if (selectedIds.length !== 1) return;

    const group = comps.find((comp) => comp.id === selectedIds[0] && comp.type === "group");
    if (!group) return;

    const extracted = group.children.map((child) => transformedChild(child, group));

    set((state) => ({
      history: pushHistory(state),
      comps: [...state.comps.filter((comp) => comp.id !== group.id), ...extracted],
      selectedIds: extracted.map((comp) => comp.id),
      selectionMethod: extracted.length > 1 ? "mass" : "single",
      editTarget: extracted.length > 1 ? "object" : state.editTarget,
    }));
  },
  centerCursorToSelected: () => {
    const [selectedId] = get().selectedIds;
    const selected = get().comps.find((comp) => comp.id === selectedId);
    if (!selected) return;
    const center = visualCenterFor(selected);
    set((state) => ({
      history: pushHistory(state),
      cursorPos: center,
      comps: state.comps.map((comp) =>
        comp.id === selected.id ? { ...comp, pos: center, pivotOffset: [0, 0, 0] } : comp,
      ),
    }));
  },
  deleteShape: (id) => {
    if (!id) return;
    set((state) => ({
      history: pushHistory(state),
      comps: state.comps.filter((comp) => comp.id !== id),
      selectedIds: state.selectedIds.filter((selectedId) => selectedId !== id),
    }));
  },
  deleteSelected: () => {
    set((state) => ({
      history: pushHistory(state),
      comps: state.comps.filter((comp) => !state.selectedIds.includes(comp.id)),
      selectedIds: [],
      selectionMethod: "none",
    }));
  },
  updateShape: (id, newData, recordHistory = true) => {
    set((state) => ({
      history: recordHistory ? pushHistory(state) : state.history,
      comps: state.comps.map((comp) => (comp.id === id ? { ...comp, ...newData } : comp)),
    }));
  },
  updateShapes: (updatesById, recordHistory = true) => {
    set((state) => ({
      history: recordHistory ? pushHistory(state) : state.history,
      comps: state.comps.map((comp) => (updatesById[comp.id] ? { ...comp, ...updatesById[comp.id] } : comp)),
    }));
  },
  updatePivot: (id, newData, recordHistory = true) => {
    set((state) => ({
      history: recordHistory ? pushHistory(state) : state.history,
      comps: state.comps.map((comp) => (comp.id === id ? { ...comp, ...newData } : comp)),
    }));
  },
}));
