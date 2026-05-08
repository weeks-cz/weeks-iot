import { WIRE_COLOR_DEFAULT, WIRE_COLOR_SELECTED, WIRE_STROKE_WIDTH } from "@/lib/cad/constants";

interface Props {
  fromX: number; fromY: number;
  toX: number;   toY: number;
  selected?: boolean;
  onClick?: () => void;
}

export function WirePath({ fromX, fromY, toX, toY, selected, onClick }: Props) {
  const d = `M ${fromX} ${fromY} L ${toX} ${toY}`;
  return (
    <path
      d={d}
      stroke={selected ? WIRE_COLOR_SELECTED : WIRE_COLOR_DEFAULT}
      strokeWidth={WIRE_STROKE_WIDTH}
      fill="none"
      strokeLinecap="round"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default", pointerEvents: "stroke" }}
    />
  );
}
