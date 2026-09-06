import { useEffect, useState } from "react";
import { api, type AppSettings } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Button, Card, Input, Toggle, Spinner, ErrorNote, Badge, PageHeader } from "@/components/ui";
import { useToast } from "@/components/toast";
import { date } from "@/lib/format";

export function Settings() {
  const { data, loading, error, reload } = useApi(() => api.getSettings(), []);
  const push = useToast((s) => s.push);
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);

  const save = async () => {
    if (!form) return;
    if (!Number.isFinite(form.min_deposit) || form.min_deposit < 0) {
      push("Enter a valid minimum deposit", "error");
      return;
    }
    if (!Number.isFinite(form.referral_amount) || form.referral_amount < 0) {
      push("Enter a valid referral amount", "error");
      return;
    }
    if (!Number.isFinite(form.deposit_bonus_percentage) || form.deposit_bonus_percentage < 0 || form.deposit_bonus_percentage > 100) {
      push("Enter a deposit bonus percentage between 0 and 100", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await api.updateSettings({
        min_deposit: form.min_deposit,
        welcome_bonus_enabled: form.welcome_bonus_enabled,
        referral_enabled: form.referral_enabled,
        referral_amount: form.referral_amount,
        deposit_bonus_enabled: form.deposit_bonus_enabled,
        deposit_bonus_percentage: form.deposit_bonus_percentage,
        maintenance_mode: form.maintenance_mode,
        maintenance_message: form.maintenance_message,
        deposit_telebirr_enabled: form.deposit_telebirr_enabled,
        deposit_cbebirr_enabled: form.deposit_cbebirr_enabled,
        deposit_mpesa_enabled: form.deposit_mpesa_enabled,
      });
      setForm(res.settings);
      push("Settings saved", "success");
      reload();
    } catch (e) {
      push(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const label = "mb-1.5 block text-sm font-medium text-txt";
  const hint = "mt-1.5 text-xs text-txt-3";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Platform controls" />

      {loading && !data && <Spinner />}
      {error && !data && <ErrorNote message={error} onRetry={reload} />}

      {form && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Maintenance mode — full width, most prominent */}
          <Card className={`p-5 lg:col-span-2 ${form.maintenance_mode ? "ring-2 ring-warning/60" : ""}`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-txt-4">Maintenance mode</h2>
              <Badge tone={form.maintenance_mode ? "yellow" : "green"}>
                {form.maintenance_mode ? "Under maintenance" : "Live"}
              </Badge>
            </div>

            <Toggle
              checked={form.maintenance_mode}
              onChange={(v) => setForm({ ...form, maintenance_mode: v })}
              label={
                <span className="font-medium text-txt">
                  Put the player app into maintenance (stop players from playing)
                </span>
              }
            />
            <p className={hint}>
              When on, players see a “we’ll be right back” screen and cannot join games, deposit, withdraw, or transfer.
              The admin dashboard and the API stay fully up, so you can keep reviewing. New games and existing balances
              are untouched.
            </p>

            <label className={`${label} mt-5`}>Message shown to players (optional)</label>
            <Input
              value={form.maintenance_message}
              maxLength={200}
              placeholder="We’re doing quick maintenance and will be back soon."
              onChange={(e) => setForm({ ...form, maintenance_message: e.target.value })}
            />
            <p className={hint}>Leave blank to show a default message.</p>
          </Card>

          {/* Deposits */}
          <Card className="p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-txt-4">Deposits</h2>
            <label className={label}>Minimum deposit (birr)</label>
            <Input
              type="number"
              min={0}
              value={form.min_deposit}
              onChange={(e) => setForm({ ...form, min_deposit: Number(e.target.value) })}
            />
            <p className={hint}>Players cannot deposit less than this. Applies to new deposits immediately.</p>
          </Card>

          {/* Deposit methods — per-channel on/off */}
          {(() => {
            const methods: { key: keyof AppSettings; label: string }[] = [
              { key: "deposit_telebirr_enabled", label: "Telebirr" },
              { key: "deposit_cbebirr_enabled", label: "CBE Birr" },
              { key: "deposit_mpesa_enabled", label: "M-Pesa" },
            ];
            const offCount = methods.filter((m) => !form[m.key]).length;
            return (
              <Card className={`p-5 ${offCount > 0 ? "ring-2 ring-warning/60" : ""}`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-txt-4">Deposit methods</h2>
                  <Badge tone={offCount > 0 ? "yellow" : "green"}>
                    {offCount > 0 ? `${offCount} off` : "All on"}
                  </Badge>
                </div>
                <div className="space-y-4">
                  {methods.map((m) => (
                    <Toggle
                      key={m.key}
                      checked={Boolean(form[m.key])}
                      onChange={(v) => setForm({ ...form, [m.key]: v })}
                      label={<span className="font-medium text-txt">Accept {m.label} deposits</span>}
                    />
                  ))}
                </div>
                <p className={hint}>
                  Turn a method off the moment its payment verification breaks — players can no longer deposit with it
                  (it disappears from the app and bot), so nobody pays into a channel whose receipts can't be confirmed.
                  Withdrawals are unaffected, so no one's balance is trapped. Applies immediately.
                </p>
              </Card>
            );
          })()}

          {/* Welcome bonus */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-txt-4">Welcome bonus</h2>
              <Badge tone={form.welcome_bonus_enabled ? "green" : "neutral"}>
                {form.welcome_bonus_enabled ? "On" : "Off"}
              </Badge>
            </div>

            <Toggle
              checked={form.welcome_bonus_enabled}
              onChange={(v) => setForm({ ...form, welcome_bonus_enabled: v })}
              label={<span className="font-medium text-txt">Give new players a 10 birr play-only bonus</span>}
            />
            <p className={hint}>
              Applies only to accounts registered after you save this setting. Turning it off does not remove bonus
              already granted to existing players, and it does not affect referral, deposit, promo, campaign, or manual bonuses.
            </p>
          </Card>

          {/* Referral reward */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-txt-4">Referral reward</h2>
              <Badge tone={form.referral_enabled ? "green" : "neutral"}>
                {form.referral_enabled ? "On" : "Off"}
              </Badge>
            </div>

            <div className="mb-5">
              <Toggle
                checked={form.referral_enabled}
                onChange={(v) => setForm({ ...form, referral_enabled: v })}
                label={<span className="font-medium text-txt">Give a play-only reward after an invited player's first successful deposit</span>}
              />
              <p className={hint}>
                Turn this off to stop paying referral rewards entirely — invites are still recorded, but no bonus is
                granted while it's off.
              </p>
            </div>

            <label className={label}>Reward amount (play-only bonus, birr)</label>
            <Input
              type="number"
              min={0}
              value={form.referral_amount}
              disabled={!form.referral_enabled}
              onChange={(e) => setForm({ ...form, referral_amount: Number(e.target.value) })}
            />
            <p className={hint}>Granted as bonus the referrer plays with — never withdrawable cash.</p>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-txt-4">Telebirr / CBE Birr deposit bonus</h2>
              <Badge tone={form.deposit_bonus_enabled ? "green" : "neutral"}>
                {form.deposit_bonus_enabled ? "On" : "Off"}
              </Badge>
            </div>

            <div className="mb-5">
              <Toggle
                checked={form.deposit_bonus_enabled}
                onChange={(v) => setForm({ ...form, deposit_bonus_enabled: v })}
                label={<span className="font-medium text-txt">Reward successful Telebirr and CBE Birr deposits</span>}
              />
              <p className={hint}>
                Added once for each successfully completed deposit. Pending, rejected, duplicate, and M-Pesa deposits do not create
                a reward.
              </p>
            </div>

            <label className={label}>Bonus percentage of deposit</label>
            <Input
              type="number"
              min={0}
              max={100}
              step="1"
              value={form.deposit_bonus_percentage}
              disabled={!form.deposit_bonus_enabled}
              onChange={(e) => setForm({ ...form, deposit_bonus_percentage: Number(e.target.value) })}
            />
            <p className={hint}>
              For example, at {form.deposit_bonus_percentage}%, a 100 birr deposit gives {form.deposit_bonus_percentage} birr bonus. Added only after verification or manual approval; deposited cash stays withdrawable and the reward is play-only.
            </p>
          </Card>

          <div className="lg:col-span-2">
            <div className="flex items-center gap-3">
              <Button icon="check" loading={saving} onClick={save}>
                Save settings
              </Button>
              <span className="text-xs text-txt-4">Updated {date(data!.settings.updated_at)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
