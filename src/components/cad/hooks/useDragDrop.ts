import { useCallback } from "react";
import { snapToGrid } from "@/lib/cad/circuit";
import type { ComponentType } from "@/types/cad";
import type { CADAction } from "./useCADReducer";

const DRAG_MIME = "application/x-cad-component";

export function usePaletteDragSource() {
  const onDragStart = useCallback((e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData(DRAG_MIME, type);
    e.dataTransfer.effectAllowed = "copy";
  }, []);
  return { onDragStart };
}

export function usePlaneDropTarget(
  planeRef: React.RefObject<HTMLDivElement>,
  dispatch: React.Dispatch<CADAction>,
) {
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    const type = e.dataTransfer.getData(DRAG_MIME) as ComponentType | "";
    if (!type) return;
    e.preventDefault();
    const plane = planeRef.current;
    if (!plane) return;
    const rect = plane.getBoundingClientRect();
    const x = snapToGrid(e.clientX - rect.left);
    const y = snapToGrid(e.clientY - rect.top);
    dispatch({
      type: "PLACE_COMPONENT",
      comp: { id: crypto.randomUUID(), type, x, y, rotation: 0 },
    });
  }, [planeRef, dispatch]);

  return { onDragOver, onDrop };
}
