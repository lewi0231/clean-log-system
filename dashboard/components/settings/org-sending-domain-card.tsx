"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_DISPLAY_NAME } from "@/lib/brand";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import { CheckCircle2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type SendingDomainRow = {
  id: string;
  domain_name: string;
  resend_status: string;
  display_status: string;
  dns_records_snapshot: unknown;
};

const DISPLAY_LABEL: Record<string, string> = {
  pending_setup: "Pending setup",
  pending_dns: "Pending DNS",
  verified: "Verified",
  error: "Error",
  disabled: "Disabled",
};

function DnsRecordsList({ snapshot }: { snapshot: unknown }) {
  if (snapshot == null) return null;
  const text = typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot, null, 2);
  return (
    <pre className="text-xs bg-muted/50 border rounded-md p-3 overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
      {text}
    </pre>
  );
}

function supabaseErrorDetails(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: string }).message;
    if (typeof m === "string" && m.length > 0) return m;
  }
  return JSON.stringify(e);
}

export function OrgSendingDomainCard({
  organizationId,
  isAdmin,
  entitled,
  /** Dashboard role from get-organization-id (null for many worker-only accounts). */
  organizationUserRole = null,
}: {
  organizationId: string;
  isAdmin: boolean;
  /** From get-organization-settings; client cannot read public.organization (RLS). */
  entitled: boolean;
  organizationUserRole?: string | null;
}) {
  const [loading, setLoading] = useState(isAdmin);
  const [row, setRow] = useState<SendingDomainRow | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [busy, setBusy] = useState<null | "register" | "refresh" | "remove">(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: dRow, error: dErr } = await supabase
        .from("organization_sending_domain")
        .select("id, domain_name, resend_status, display_status, dns_records_snapshot")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (dErr) throw dErr;
      if (dRow) {
        setRow(dRow as SendingDomainRow);
        setDomainInput(dRow.domain_name);
      } else {
        setRow(null);
        setDomainInput("");
      }
    } catch (e) {
      log.error("org-sending-domain: load failed", {
        message: supabaseErrorDetails(e),
        organizationId,
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAdmin) {
    const roleLabel =
      organizationUserRole === null || organizationUserRole === undefined
        ? "not set (common for field-worker accounts that are not in organization users)"
        : `"${organizationUserRole}"`;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email &amp; domain</CardTitle>
          <CardDescription>Custom sending domain (Resend)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Only <strong>organization administrators</strong> can register a domain, view DNS
            records, and remove a domain. Your current dashboard role is {roleLabel}.
          </p>
          <p>
            If you should be an admin, ask an owner to check <strong>Users</strong> and your
            invitation, or that your sign-in email matches the one on your organization user record.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email &amp; domain</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading email domain settings
        </CardContent>
      </Card>
    );
  }

  if (!entitled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email &amp; domain</CardTitle>
          <CardDescription>
            Send invoices and system mail from your own domain (Resend).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Custom sending domain is not enabled for this organization. When your plan includes it,
            an administrator can add DNS records and verify the domain here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleRegister = async () => {
    const name = domainInput.trim().toLowerCase();
    if (!name) return;
    setActionError(null);
    setBusy("register");
    try {
      await invokeTypedEdge("register-org-sending-domain", {
        organization_id: organizationId,
        domain_name: name,
      });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setActionError(msg);
      log.error("register-org-sending-domain", { error: msg });
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    setActionError(null);
    setBusy("refresh");
    try {
      await invokeTypedEdge("refresh-org-sending-domain-status", {
        organization_id: organizationId,
      });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setActionError(msg);
      log.error("refresh-org-sending-domain-status", { error: msg });
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove this domain from ${APP_DISPLAY_NAME} and Resend?`)) return;
    setActionError(null);
    setBusy("remove");
    try {
      await invokeTypedEdge("remove-org-sending-domain", {
        organization_id: organizationId,
      });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setActionError(msg);
      log.error("remove-org-sending-domain", { error: msg });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email &amp; domain</CardTitle>
        <CardDescription>
          Register a domain with our email provider (Resend), add the DNS records shown below, then
          check status until verified.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Australian users: email-related settings and worker payment features may be subject to
          your obligations under applicable workplace and tax law; this is general information, not
          legal advice.
        </p>

        {actionError && (
          <p className="text-sm text-destructive" role="alert">
            {actionError}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="sending-domain-name">Domain</Label>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Input
              id="sending-domain-name"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="mail.example.com"
              className="max-w-md"
            />
            <Button
              type="button"
              onClick={() => void handleRegister()}
              disabled={busy !== null}
              className="w-fit"
            >
              {busy === "register" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {row ? "Update / sync domain" : "Register domain"}
            </Button>
          </div>
        </div>

        {row && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Status</span>
              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
                {row.display_status === "verified" && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                )}
                {DISPLAY_LABEL[row.display_status] ?? row.display_status}
              </span>
              <span className="text-xs text-muted-foreground">(Resend: {row.resend_status})</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void handleRefresh()}
                disabled={busy !== null}
              >
                {busy === "refresh" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                Check DNS
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleRemove()}
                disabled={busy !== null}
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                {busy === "remove" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Remove domain
              </Button>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">DNS records (from provider)</p>
              <DnsRecordsList snapshot={row.dns_records_snapshot} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
