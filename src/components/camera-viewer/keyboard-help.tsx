"use client";

interface KeyboardHelpProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "1", description: "Grid 1×1 (una cámara)" },
  { key: "4", description: "Grid 2×2 (cuatro cámaras)" },
  { key: "9", description: "Grid 3×3" },
  { key: "0", description: "Grid 4×4" },
  { key: "F", description: "Pantalla completa" },
  { key: "ESC", description: "Salir / Cerrar" },
  { key: "?", description: "Mostrar esta ayuda" },
];

export function KeyboardHelp({ onClose }: KeyboardHelpProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">Atajos de teclado</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white text-sm"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map(({ key, description }) => (
            <li key={key} className="flex items-center justify-between gap-4">
              <span className="text-zinc-400 text-sm">{description}</span>
              <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-white text-xs font-mono min-w-[32px] text-center">
                {key}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="text-zinc-600 text-xs mt-5 text-center">
          Presiona cualquier tecla para cerrar
        </p>
      </div>
    </div>
  );
}
