import { useSettings } from "@/store/settingsStore";
import { haptic } from "@/lib/telegram";

export function LangToggle() {
  const { lang, setLang } = useSettings();
  return (
    <div className="inline-flex rounded-full bg-white/5 p-1 text-xs font-bold">
      {(["am", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => {
            haptic.select();
            setLang(l);
          }}
          className={`rounded-full px-3 py-1.5 transition-colors ${
            lang === l ? "bg-accent text-white" : "text-ink-muted"
          }`}
        >
          {l === "am" ? "አማ" : "EN"}
        </button>
      ))}
    </div>
  );
}
