import { create } from "zustand";
import { Icon } from "@/components/Icon";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  opts: ConfirmOptions | null;
  resolve: ((ok: boolean) => void) | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  opts: null,
  resolve: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => set({ open: true, opts, resolve })),
  close: (ok) => {
    get().resolve?.(ok);
    set({ open: false, opts: null, resolve: null });
  },
}));

/** Returns an async confirm() that resolves true/false — a drop-in, prettier
 *  replacement for window.confirm used across the admin's destructive actions. */
export function useConfirm() {
  return useConfirmStore((s) => s.ask);
}

/** Mounted once (in main.tsx) alongside the Toaster. */
export function ConfirmHost() {
  const { open, opts, close } = useConfirmStore();
  if (!open || !opts) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-txt/30 backdrop-blur-[2px]" onClick={() => close(false)} />
      <div className="relative w-full max-w-sm rounded-lg border border-edge bg-panel p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
              opts.danger ? "bg-danger/12 text-danger" : "bg-brand/12 text-brand"
            }`}
          >
            <Icon name={opts.danger ? "trash" : "shield"} size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-txt">{opts.title}</h3>
            {opts.message && <p className="mt-1 text-sm text-txt-3">{opts.message}</p>}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => close(false)}
            className="rounded-lg border border-edge bg-panel px-3.5 py-2 text-[13px] font-semibold text-txt-2 transition hover:bg-edge"
          >
            Cancel
          </button>
          <button
            onClick={() => close(true)}
            className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
              opts.danger
                ? "bg-danger text-white hover:brightness-110"
                : "bg-brand text-white hover:bg-brandDark"
            }`}
          >
            {opts.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
