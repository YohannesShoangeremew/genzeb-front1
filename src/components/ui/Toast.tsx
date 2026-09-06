import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  msg: string;
  kind: ToastKind;
}

interface ToastState {
  items: ToastItem[];
  push: (msg: string, kind?: ToastKind) => void;
  remove: (id: number) => void;
}

let counter = 1;

export const useToast = create<ToastState>((set) => ({
  items: [],
  push: (msg, kind = "info") => {
    const id = counter++;
    set((s) => ({ items: [...s.items, { id, msg, kind }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 3200);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

const COLORS: Record<ToastKind, string> = {
  success: "border-neon-green/40 text-neon-green",
  error: "border-neon-red/40 text-neon-red",
  info: "border-neon-cyan/40 text-neon-cyan",
};

export function ToastHost() {
  const items = useToast((s) => s.items);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`glass max-w-md rounded-2xl border px-4 py-3 text-sm font-medium ${COLORS[t.kind]}`}
          >
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
