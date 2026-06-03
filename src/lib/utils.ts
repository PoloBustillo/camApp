import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Retorna la fecha actual en formato ISO 8601 UTC */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Pausa la ejecución por N milisegundos */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
