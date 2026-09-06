import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { tg } from "@/lib/telegram";

/**
 * Wires Telegram's native BackButton to in-app navigation. It's shown on every
 * screen except the home/lobby, and tapping it returns to the lobby — so users
 * are never stranded on the card picker, game room, wallet, etc. No-op outside
 * Telegram (a normal browser), where screens provide their own back controls.
 */
export function TelegramBackButton() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const bb = tg?.BackButton;
    if (!bb) return;

    if (pathname === "/") {
      bb.hide();
      return;
    }

    const goBack = () => nav("/");
    bb.onClick(goBack);
    bb.show();
    return () => bb.offClick(goBack);
  }, [pathname, nav]);

  return null;
}
