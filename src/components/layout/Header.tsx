import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { haptic } from "@/lib/telegram";

interface Props {
  title?: ReactNode;
  back?: boolean;
  right?: ReactNode;
  /** Override the default back behavior (nav(-1)) — e.g. return to the lobby. */
  onBack?: () => void;
}

export function Header({ title, back, right, onBack }: Props) {
  const nav = useNavigate();
  return (
    <header className="mb-3 flex items-center gap-3">
      {back && (
        <button
          onClick={() => {
            haptic.impact("light");
            if (onBack) onBack();
            else nav(-1);
          }}
          className="glass flex size-9 items-center justify-center rounded-xl text-lg"
        >
          ‹
        </button>
      )}
      {title && (
        <h1 className="flex-1 font-display text-2xl font-extrabold">{title}</h1>
      )}
      {right}
    </header>
  );
}
