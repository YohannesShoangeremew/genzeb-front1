import { create } from "zustand";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: Tone) => void;
  remove: (id: number) => void;
}

let seq = 1;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (message, tone = "info") => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

const toneStyles: Record<Tone, string> = {
  success: "border-success/40 bg-success/12 text-success",
  error: "border-danger/40 bg-danger/12 text-danger",
  info: "border-info/40 bg-info/12 text-info",
};

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const remove = useToast((s) => s.remove);
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => remove(t.id)}
          className={`max-w-sm rounded-xl border bg-panel px-4 py-2.5 text-left text-sm font-medium shadow-2xl backdrop-blur ${toneStyles[t.tone]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
