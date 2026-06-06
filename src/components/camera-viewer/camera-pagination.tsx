"use client";

interface CameraPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  onPage: (p: number) => void;
  totalCameras: number;
}

export function CameraPagination({
  page,
  totalPages,
  pageSize,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  onPage,
  totalCameras,
}: CameraPaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCameras);

  return (
    <div className="flex items-center justify-between gap-4 mt-4">
      <span className="text-xs text-zinc-500 hidden sm:block">
        Mostrando {start}–{end} de {totalCameras} cámaras
      </span>

      <div className="flex items-center gap-2 mx-auto sm:mx-0">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className="p-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Página anterior"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Page dots/numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              className={[
                "w-8 h-8 rounded-lg text-xs font-medium transition-all",
                p === page
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800",
              ].join(" ")}
              aria-label={`Página ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className="p-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          aria-label="Página siguiente"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
