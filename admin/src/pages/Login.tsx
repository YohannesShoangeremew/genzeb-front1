import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { Button, Card, Input } from "@/components/ui";

export function Login() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phone.trim()) {
      setError("Enter your phone number.");
      return;
    }
    setBusy(true);
    try {
      await login(phone.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <Card className="w-full max-w-sm p-7">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-brand text-lg font-extrabold text-white shadow-glow">
            B
          </div>
          <div>
            <div className="font-bold text-txt">EDL Bingo</div>
            <div className="text-xs text-txt-3">Operations</div>
          </div>
        </div>

        <h1 className="mt-6 text-xl font-bold text-txt">Sign in</h1>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-txt-3">Phone number</label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="e.g. 09XXXXXXXX"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-txt-3">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <div className="text-sm text-danger">{error}</div>}
          <Button type="submit" className="w-full" loading={busy}>
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}
