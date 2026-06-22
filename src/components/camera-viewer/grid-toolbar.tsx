"use client";

import type { GridFilter, GridLayout } from "@/hooks/use-grid-preferences";
import { GripVertical, Check, RotateCcw } from "lucide-react";

interface GridToolbarProps {
  layout: GridLayout;
  filter: GridFilter;
  onLayoutChange: (layout: GridLayout) => void;
  onFilterChange: (filter: GridFilter) => void;
  /** Hide filter toggle on pages that are already favorites-only */
  showFilter?: boolean;
  /** Drag-and-drop reorder mode */
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onResetOrder?: () => void;
  hasCustomOrder?: boolean;
}

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={[
            "px-3 py-1.5 text-xs font-medium transition-colors",
            value === opt.id
              ? "bg-white text-black"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function GridToolbar({
  layout,
  filter,
  onLayoutChange,
  onFilterChange,
  showFilter = true,
  isEditing = false,
  onToggleEdit,
  onResetOrder,
  hasCustomOrder = false,
}: GridToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        value={layout}
        options={[
          { id: "2x2", label: "2×2" },
          { id: "3x3", label: "3×3" },
        ]}
        onChange={onLayoutChange}
      />
      {showFilter && (
        <ToggleGroup
          value={filter}
          options={[
            { id: "all", label: "Todas" },
            { id: "favorites", label: "Favoritas" },
          ]}
          onChange={onFilterChange}
        />
      )}
      {onToggleEdit && (
        <>
          <button
            type="button"
            onClick={onToggleEdit}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
              isEditing
                ? "bg-white text-black border-white"
                : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500",
            ].join(" ")}
          >
            {isEditing ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Listo
              </>
            ) : (
              <>
                <GripVertical className="w-3.5 h-3.5" />
                Reordenar
              </>
            )}
          </button>
          {isEditing && hasCustomOrder && onResetOrder && (
            <button
              type="button"
              onClick={onResetOrder}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restablecer
            </button>
          )}
        </>
      )}
    </div>
  );
}
