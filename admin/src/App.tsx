import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { isAuthed } from "@/store/auth";
const Login = lazy(() => import("@/pages/Login").then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Transactions = lazy(() => import("@/pages/Transactions").then((m) => ({ default: m.Transactions })));
const Users = lazy(() => import("@/pages/Users").then((m) => ({ default: m.Users })));
const UserDetail = lazy(() => import("@/pages/UserDetail").then((m) => ({ default: m.UserDetail })));
const Games = lazy(() => import("@/pages/Games").then((m) => ({ default: m.Games })));
const GameDetail = lazy(() => import("@/pages/GameDetail").then((m) => ({ default: m.GameDetail })));
const Staff = lazy(() => import("@/pages/Staff").then((m) => ({ default: m.Staff })));
const Bots = lazy(() => import("@/pages/Bots").then((m) => ({ default: m.Bots })));
const Bonus = lazy(() => import("@/pages/Bonus").then((m) => ({ default: m.Bonus })));
const PromoCodes = lazy(() => import("@/pages/PromoCodes").then((m) => ({ default: m.PromoCodes })));
const Reports = lazy(() => import("@/pages/Reports").then((m) => ({ default: m.Reports })));
const VerificationLogs = lazy(() => import("@/pages/VerificationLogs").then((m) => ({ default: m.VerificationLogs })));
const Settings = lazy(() => import("@/pages/Settings").then((m) => ({ default: m.Settings })));

function RequireAuth({ children }: { children: JSX.Element }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-txt-3">Loading…</div>}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/games" element={<Games />} />
        <Route path="/games/:id" element={<GameDetail />} />
        <Route path="/bots" element={<Bots />} />
        <Route path="/bonus" element={<Bonus />} />
        <Route path="/promo" element={<PromoCodes />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/verification" element={<VerificationLogs />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
