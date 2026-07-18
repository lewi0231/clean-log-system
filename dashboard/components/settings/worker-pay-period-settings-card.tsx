"use client";

import { organizationSettingsKey } from "@/app/query-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { log } from "@/lib/logger";
import { invokeEdgeFunction } from "@/lib/supabase/invoke-edge-function";
import type { OrganizationSettings, WorkerPaymentCycleConfig } from "@/lib/types";
import {
  buildWorkerPaymentCycleConfig,
  freqFromValue,
  type PayFrequencyChoice,
  workerPaymentCycleConfigsEqual,
} from "@/lib/worker-payment-cycle-form";
import { isValidIanaTimeZone } from "@/lib/worker-payments/org-pay-period";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const COMMON_TIMEZONES = [
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Darwin",
  "Australia/Hobart",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

const ISO_DAYS: { value: string; label: string }[] = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];

interface WorkerPayPeriodSettingsCardProps {
  organizationId: string;
  value: WorkerPaymentCycleConfig | null;
  onApplied: (settings: OrganizationSettings) => void;
}

export function WorkerPayPeriodSettingsCard({
  organizationId,
  value,
  onApplied,
}: WorkerPayPeriodSettingsCardProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [frequency, setFrequency] = useState<PayFrequencyChoice>(() => freqFromValue(value));
  const [tzIana, setTzIana] = useState(() => value?.timezone?.trim() || "Australia/Adelaide");
  const [paymentDayOfWeek, setPaymentDayOfWeek] = useState(() =>
    String(value?.payment_day_of_week ?? 1)
  );
  const [paymentDayOfMonth, setPaymentDayOfMonth] = useState(() =>
    value?.payment_day_of_month != null ? String(value.payment_day_of_month) : "15"
  );
  const [cutOffTime, setCutOffTime] = useState(() => value?.cut_off_time ?? "17:00");
  const [requireApproval, setRequireApproval] = useState(() => value?.require_approval ?? false);
  const [autoCalculate, setAutoCalculate] = useState(() => value?.auto_calculate ?? false);

  const skipAutosaveRef = useRef(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    skipAutosaveRef.current = true;
    setFrequency(freqFromValue(value));
    setTzIana(value?.timezone?.trim() || "Australia/Adelaide");
    setPaymentDayOfWeek(String(value?.payment_day_of_week ?? 1));
    setPaymentDayOfMonth(
      value?.payment_day_of_month != null ? String(value.payment_day_of_month) : "15"
    );
    setCutOffTime(value?.cut_off_time ?? "17:00");
    setRequireApproval(value?.require_approval ?? false);
    setAutoCalculate(value?.auto_calculate ?? false);
    const t = setTimeout(() => {
      skipAutosaveRef.current = false;
    }, 0);
    return () => clearTimeout(t);
  }, [value]);

  const { tzSelectValue, showCustomTz } = useMemo(() => {
    const t = tzIana.trim();
    if (COMMON_TIMEZONES.includes(t)) return { tzSelectValue: t, showCustomTz: false };
    return { tzSelectValue: "__custom__", showCustomTz: true };
  }, [tzIana]);

  const persist = async () => {
    const tzRaw = tzIana.trim();

    // Incomplete custom timezone while typing — wait (no toast spam)
    if (frequency !== "none" && showCustomTz && tzRaw === "") {
      return;
    }
    if (tzRaw && !isValidIanaTimeZone(tzRaw)) {
      return;
    }

    const worker_payment_cycle_config = buildWorkerPaymentCycleConfig({
      frequency,
      tzIana,
      paymentDayOfWeek,
      paymentDayOfMonth,
      cutOffTime,
      requireApproval,
      autoCalculate,
    });

    if (workerPaymentCycleConfigsEqual(worker_payment_cycle_config, valueRef.current)) {
      return;
    }

    setSaving(true);
    try {
      const data = await invokeEdgeFunction<{ settings?: OrganizationSettings }>(
        "update-organization-settings",
        {
          organization_id: organizationId,
          worker_payment_cycle_config,
        }
      );
      if (data?.settings) {
        onApplied(data.settings);
      }
      void queryClient.invalidateQueries({
        queryKey: organizationSettingsKey(organizationId),
      });
      log.info("Settings: worker pay period updated");
    } catch (e) {
      log.error("Settings: worker pay period save failed", {
        error: e instanceof Error ? e.message : "unknown",
      });
      toast.error(e instanceof Error ? e.message : "Failed to save payment cycle");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (skipAutosaveRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      void persist();
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist reads latest state; deps are the form fields
  }, [
    frequency,
    tzIana,
    paymentDayOfWeek,
    paymentDayOfMonth,
    cutOffTime,
    requireApproval,
    autoCalculate,
    organizationId,
    showCustomTz,
  ]);

  return (
    <Card id="worker-pay-period">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="flex items-center gap-2">
              Worker payment cycle
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </CardTitle>
            <CardDescription>
              Defines how pay periods are cut for Worker Payments and calculate-dialog presets. For
              week and fortnight, set the day each period <strong>starts</strong> (ISO Mon=1 …
              Sun=7). Monthly uses calendar months (1st–last day) in the timezone below;
              &quot;payment day of month&quot; is a label for your pay date. Changes save
              automatically.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="pay-freq">Payment frequency</Label>
          <Select value={frequency} onValueChange={(v) => setFrequency(v as PayFrequencyChoice)}>
            <SelectTrigger id="pay-freq">
              <SelectValue placeholder="Not configured" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not configured</SelectItem>
              <SelectItem value="weekly">Week</SelectItem>
              <SelectItem value="fortnightly">Fortnight</SelectItem>
              <SelectItem value="monthly">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {frequency !== "none" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="pay-tz">Timezone (IANA)</Label>
              <Select
                value={tzSelectValue}
                onValueChange={(v) => {
                  if (v === "__custom__") {
                    setTzIana("");
                  } else {
                    setTzIana(v);
                  }
                }}
              >
                <SelectTrigger id="pay-tz">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {COMMON_TIMEZONES.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom__">Other…</SelectItem>
                </SelectContent>
              </Select>
              {showCustomTz && (
                <Input
                  placeholder="e.g. Australia/Adelaide"
                  value={tzIana}
                  onChange={(e) => setTzIana(e.target.value)}
                  className="font-mono text-sm"
                />
              )}
            </div>

            {(frequency === "weekly" || frequency === "fortnightly") && (
              <div className="space-y-2">
                <Label htmlFor="pay-dow">Pay period starts on</Label>
                <p className="text-xs text-muted-foreground">
                  Each new period begins on this weekday in the timezone above (e.g. Monday starts a
                  Mon–Sun week).
                </p>
                <Select value={paymentDayOfWeek} onValueChange={setPaymentDayOfWeek}>
                  <SelectTrigger id="pay-dow">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ISO_DAYS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {frequency === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="pay-dom">Typical pay day of month (reference)</Label>
                <p className="text-xs text-muted-foreground">
                  The accrual period in-app is the calendar month. This field is for your own
                  reference (e.g. pay day 15th).
                </p>
                <Input
                  id="pay-dom"
                  type="number"
                  min={1}
                  max={31}
                  value={paymentDayOfMonth}
                  onChange={(e) => setPaymentDayOfMonth(e.target.value)}
                  className="max-w-[120px]"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pay-cutoff">Cut-off time</Label>
              <Input
                id="pay-cutoff"
                value={cutOffTime}
                onChange={(e) => setCutOffTime(e.target.value)}
                placeholder="17:00"
                className="max-w-[160px]"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Require approval</Label>
                <p className="text-xs text-muted-foreground">
                  Optional workflow flag for future accrual flows
                </p>
              </div>
              <Switch checked={requireApproval} onCheckedChange={setRequireApproval} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Auto-calculate</Label>
                <p className="text-xs text-muted-foreground">Optional flag for future automation</p>
              </div>
              <Switch checked={autoCalculate} onCheckedChange={setAutoCalculate} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
