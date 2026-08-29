export const PITCH = 16;                     // px between breadboard hole centers (Štěpán's brief)

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.0;
export const ZOOM_STEP = 0.1;
export const ZOOM_DEFAULT = 1.0;

// workspace-plane div sits at CSS left:2000 top:2000; this pan brings its (0,0) to viewport (0,0)
export const DEFAULT_PAN = { x: -2000, y: -2000 };

export const GRID_DOT_SIZE = 1;              // grid background dot diameter (px)
export const GRID_DOT_OPACITY = 0.18;

export const SAVE_DEBOUNCE_MS = 200;         // debounce window before pushing to GameState

export const PIN_HIT_AREA = 20;              // overlay hit-area square side (px) for pin clicks

export const WIRE_COLOR_DEFAULT = "#9ca3af"; // tailwind gray-400
export const WIRE_COLOR_SELECTED = "#fbbf24";// tailwind amber-400
export const WIRE_COLOR_DRAFT = "#60a5fa";   // tailwind blue-400 (in-progress wire)
export const WIRE_STROKE_WIDTH = 2;
