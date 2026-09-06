import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useAuth } from "@/store/authStore";
import { useWallet } from "@/store/walletStore";
import { api } from "@/lib/api";
import { ToastHost } from "@/components/ui/Toast";
import { Splash } from "@/screens/Splash";
import { Maintenance } from "@/screens/Maintenance";
import { NotRegistered } from "@/screens/NotRegistered";
import { CardSelect } from "@/screens/CardSelect";
import { Report } from "@/screens/Report";
import { GameRoom } from "@/screens/GameRoom";
import { WalletScreen } from "@/screens/Wallet";
import { Profile } from "@/screens/Profile";
import { Referral } from "@/screens/Referral";
import { Leaderboard } from "@/screens/Leaderboard";
import { TelegramBackButton } from "@/components/layout/TelegramBackButton";
import { LiveGameSync } from "@/components/layout/LiveGameSync";

export default function App() {
  const { status, authenticate, user } = useAuth();
  const refreshWallet = useWallet((s) => s.refresh);
  const [maintenance, setMaintenance] = useState<{ on: boolean; message: string }>({
    on: false,
    message: "",
  });

  // Poll maintenance status on mount and every 30s, so the app both drops into
  // and recovers from maintenance without the player reloading. Fails soft (the
  // api.status helper resolves to "live" on any error), so it never wrongly locks
  // players out.
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const s = await api.status();
      if (alive) setMaintenance({ on: s.maintenance, message: s.message });
    };
    check();
    const id = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Authenticate once on mount.
  useEffect(() => {
    if (status === "idle") authenticate();
  }, [status, authenticate]);

  // Hydrate wallet after auth.
  useEffect(() => {
    if (status === "authed") refreshWallet().catch(() => {});
  }, [status, refreshWallet]);

  // Re-pull the balance whenever the app is brought back to the foreground
  // (e.g. the player tabbed out to their bank app to deposit, then returned),
  // so the lobby balance pill and affordability checks aren't left stale.
  useEffect(() => {
    if (status !== "authed") return;
    const onActive = () => {
      if (document.visibilityState === "visible") refreshWallet().catch(() => {});
    };
    document.addEventListener("visibilitychange", onActive);
    window.addEventListener("focus", onActive);
    return () => {
      document.removeEventListener("visibilitychange", onActive);
      window.removeEventListener("focus", onActive);
    };
  }, [status, refreshWallet]);

  // Maintenance takes priority over everything — no lobby, wallet, or game while
  // it's on. The backend also rejects player mutations with 503 as a backstop.
  if (maintenance.on) {
    return (
      <>
        <ToastHost />
        <Maintenance message={maintenance.message} />
      </>
    );
  }

  return (
    <>
      <ToastHost />
      {renderByStatus(status, !!user)}
    </>
  );
}

function renderByStatus(
  status: ReturnType<typeof useAuth.getState>["status"],
  hasUser: boolean,
) {
  if (status === "authed" && hasUser) {
    return (
      <>
        <TelegramBackButton />
        <LiveGameSync />
        <Routes>
          <Route path="/" element={<CardSelect home />} />
          <Route path="/play/:gameType" element={<CardSelect />} />
          <Route path="/game/:gameId" element={<GameRoom />} />
          <Route path="/wallet" element={<WalletScreen />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/report" element={<Report />} />
          <Route path="/referral" element={<Referral />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="*" element={<CardSelect home />} />
        </Routes>
      </>
    );
  }
  if (status === "not_registered") return <NotRegistered />;
  return <Splash status={status} />;
}
