"use client";

import type { GridFilter, GridLayout } from "@/hooks/use-grid-preferences";

interface GridToolbarProps {
  layout: GridLayout;
  filter: GridFilter;
  onLayoutChange: (layout: GridLayout) => void;
  onFilterChange: (filter: GridFilter) => void;
  /** Hide filter toggle on pages that are already favorites-only */
  showFilter?: boolean;
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
    </div>
  );
}
