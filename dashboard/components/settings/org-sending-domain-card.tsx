"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_DISPLAY_NAME } from "@/lib/brand";
import { getSupportEmail } from "@/lib/env";
import { log } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { invokeTypedEdge } from "@/lib/supabase/invoke-edge-function";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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

const PENDING_STATUSES = new Set(["pending_setup", "pending_dns"]);
const AUTO_POLL_MS = 45_000;

interface DnsRecord {
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
  record?: string;
  status?: string;
}

const DNS_PROVIDER_GUIDES = [
  {
    name: "Cloudflare",
    url: "https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/",
  },
  { name: "GoDaddy", url: "https://www.godaddy.com/help/add-a-txt-record-19232" },
  {
    name: "Namecheap",
    url: "https://www.namecheap.com/support/knowledgebase/article.aspx/317/2237/how-do-i-add-txtspfdaborecdnsmxnsaaaa-records-for-my-domain/",
  },
  {
    name: "Route 53",
    url: "https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-creating.html",
  },
];

const RECORD_EXPLANATIONS: Record<string, string> = {
  DKIM: "Authenticates your emails with a digital signature. Required for good deliverability.",
  SPF: "Tells email servers which services can send mail on your behalf.",
  MX: "Handles bounce and complaint feedback from email providers.",
};

function formatCheckedAt(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      log.warn("Clipboard copy failed");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs gap-1 cursor-pointer"
      onClick={handleCopy}
      title={`Copy ${label}`}
    >
      {copied ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function DnsRecordRow({ record, domainName }: { record: DnsRecord; domainName: string }) {
  const recordType = record.record || record.type;
  const explanation = RECORD_EXPLANATIONS[recordType] || "";
  const statusIcon =
    record.status === "verified" ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : record.status === "not_started" || record.status === "pending" ? (
      <Clock className="h-4 w-4 text-amber-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-muted-foreground" />
    );

  const fullHostname = record.name.endsWith(domainName)
    ? record.name
    : `${record.name}.${domainName}`;
  const nameLooksRelative = !record.name.endsWith(domainName) && !record.name.includes(".");

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className="font-medium text-sm">{recordType}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{record.type}</span>
        </div>
        {record.status && (
          <span className="text-xs text-muted-foreground capitalize">
            {record.status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {explanation && <p className="text-xs text-muted-foreground">{explanation}</p>}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 bg-muted/50 rounded px-2 py-1">
          <div className="min-w-0 flex-1">
            <span className="text-xs text-muted-foreground block">Host / Name</span>
            <code className="text-xs break-all">{fullHostname}</code>
            {nameLooksRelative || record.name !== fullHostname ? (
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Copy uses provider name <code className="text-[10px]">{record.name}</code> — some
                panels want that relative form, not the full hostname.
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-0.5 shrink-0">
            <CopyButton value={record.name} label="host" />
            {record.name !== fullHostname ? (
              <CopyButton value={fullHostname} label="full host" />
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 bg-muted/50 rounded px-2 py-1">
          <div className="min-w-0 flex-1">
            <span className="text-xs text-muted-foreground block">Value</span>
            <code className="text-xs break-all">{record.value}</code>
          </div>
          <CopyButton value={record.value} label="value" />
        </div>

        {record.priority !== undefined && (
          <div className="flex items-center justify-between gap-2 bg-muted/50 rounded px-2 py-1">
            <div>
              <span className="text-xs text-muted-foreground block">Priority</span>
              <code className="text-xs">{record.priority}</code>
            </div>
            <CopyButton value={String(record.priority)} label="priority" />
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          TTL: {record.ttl || "Auto"} • Type: {record.type}
        </div>
      </div>
    </div>
  );
}

function DnsRecordsGuide({ snapshot, domainName }: { snapshot: unknown; domainName: string }) {
  if (snapshot == null) return null;

  let records: DnsRecord[] = [];
  try {
    if (Array.isArray(snapshot)) {
      records = snapshot as DnsRecord[];
    } else if (typeof snapshot === "string") {
      records = JSON.parse(snapshot) as DnsRecord[];
    }
  } catch {
    return (
      <pre className="text-xs bg-muted/50 border rounded-md p-3 overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
        {typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot, null, 2)}
      </pre>
    );
  }

  if (records.length === 0) return null;

  const apexHint = domainName.split(".").slice(-2).join(".");

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-sm mb-2">How to set up your DNS records</h4>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Log in to your domain registrar or DNS provider</li>
          <li>
            Navigate to DNS settings for <strong>{apexHint}</strong>
          </li>
          <li>Add each record below using the Copy buttons</li>
          <li>Save changes and wait for propagation (often minutes; up to 48 hours)</li>
          <li>
            Click <strong>Check DNS</strong> to verify — or we&apos;ll recheck automatically while
            this page is open
          </li>
        </ol>
        <ul className="mt-3 text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
          <li>
            <strong>Cloudflare:</strong> set each record to DNS only (grey cloud), not proxied
            (orange cloud).
          </li>
          <li>
            <strong>Host / Name:</strong> some panels want the relative name (e.g.{" "}
            <code className="text-[10px]">resend._domainkey</code>
            ), others want the full hostname. Use the matching Copy button if both are shown.
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-sm">Required DNS Records ({records.length})</h4>
        {records.map((record, idx) => (
          <DnsRecordRow
            key={`${record.type}-${record.name}-${idx}`}
            record={record}
            domainName={domainName}
          />
        ))}
      </div>

      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground mb-2">
          Need help? Here are guides for common DNS providers:
        </p>
        <div className="flex flex-wrap gap-2">
          {DNS_PROVIDER_GUIDES.map((guide) => (
            <a
              key={guide.name}
              href={guide.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {guide.name}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </div>
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
  const [busy, setBusy] = useState<null | "register" | "refresh" | "remove" | "test">(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const prevDisplayStatusRef = useRef<string | null>(null);
  const refreshInFlightRef = useRef(false);

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

  useEffect(() => {
    if (!row) {
      prevDisplayStatusRef.current = null;
      return;
    }
    const prev = prevDisplayStatusRef.current;
    if (prev && prev !== "verified" && row.display_status === "verified") {
      toast.success("Domain verified", {
        description: `Emails can send from addresses like invoices@${row.domain_name}`,
      });
    }
    prevDisplayStatusRef.current = row.display_status;
  }, [row]);

  const refreshStatus = useCallback(
    async (opts: { announce: boolean }) => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      if (opts.announce) {
        setActionError(null);
        setBusy("refresh");
      }
      try {
        const result = await invokeTypedEdge("refresh-org-sending-domain-status", {
          organization_id: organizationId,
        });
        setLastCheckedAt(new Date());
        await load();
        if (opts.announce) {
          if (result.display_status === "error") {
            toast.error("DNS check reported an error", {
              description: "Review the records below or try again shortly.",
            });
          } else if (result.display_status !== "verified") {
            toast.message("Still waiting for DNS", {
              description:
                "Records may take a few minutes to propagate. We will keep checking while this page is open.",
            });
          }
          // Verified: success toast comes from the display_status transition effect.
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Request failed";
        if (opts.announce) {
          setActionError(msg);
          toast.error("Could not check DNS", { description: msg });
        }
        log.warn("refresh-org-sending-domain-status failed (user action)", { error: msg });
      } finally {
        refreshInFlightRef.current = false;
        if (opts.announce) setBusy(null);
      }
    },
    [organizationId, load]
  );

  useEffect(() => {
    if (!isAdmin || !entitled || !row) return;
    if (!PENDING_STATUSES.has(row.display_status)) return;

    const id = window.setInterval(() => {
      void refreshStatus({ announce: false });
    }, AUTO_POLL_MS);

    return () => window.clearInterval(id);
  }, [isAdmin, entitled, row?.display_status, row?.id, refreshStatus]);

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
    const supportEmail = getSupportEmail();
    const mailSubject = encodeURIComponent(`${APP_DISPLAY_NAME}: Custom email domain (Pro)`);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email &amp; domain</CardTitle>
          <CardDescription>
            Send invoices and system mail from your own domain (Resend).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Custom email domain is available on Pro accounts. Interested? Contact support — an
            administrator can add DNS records and verify the domain once enabled.
          </p>
          {supportEmail ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="w-fit cursor-pointer" asChild>
                <a href={`mailto:${supportEmail}?subject=${mailSubject}`}>Email support</a>
              </Button>
              <p className="text-sm text-muted-foreground">
                Or write to{" "}
                <a
                  className="font-medium text-foreground underline underline-offset-2"
                  href={`mailto:${supportEmail}?subject=${mailSubject}`}
                >
                  {supportEmail}
                </a>
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ask your account administrator to enable Pro email domain, or set{" "}
              <code className="text-xs">NEXT_PUBLIC_SUPPORT_EMAIL</code> so this card can open a
              mail client.
            </p>
          )}
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
      setLastCheckedAt(new Date());
      await load();
      toast.message("Domain registered", {
        description: "Add the DNS records below, then click Check DNS.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setActionError(msg);
      toast.error("Could not register domain", { description: msg });
      log.warn("register-org-sending-domain failed (user action)", { error: msg });
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
      setLastCheckedAt(null);
      await load();
      toast.message("Domain removed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setActionError(msg);
      toast.error("Could not remove domain", { description: msg });
      log.warn("remove-org-sending-domain failed (user action)", { error: msg });
    } finally {
      setBusy(null);
    }
  };

  const handleSendTest = async () => {
    setActionError(null);
    setBusy("test");
    try {
      const result = await invokeTypedEdge("send-test-org-sending-domain-email", {
        organization_id: organizationId,
      });
      if (result.skipped) {
        toast.message("Test email skipped (local SKIP_EMAIL_SENDING)", {
          description: `Would send from ${result.from} to ${result.to}`,
        });
      } else {
        toast.success("Test email sent", {
          description: `Sent to ${result.to} from ${result.from}`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setActionError(msg);
      toast.error("Could not send test email", { description: msg });
      log.warn("send-test-org-sending-domain-email failed (user action)", { error: msg });
    } finally {
      setBusy(null);
    }
  };

  const isVerified = row?.display_status === "verified";
  const exampleFrom = row ? `invoices@${row.domain_name}` : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email &amp; domain</CardTitle>
        <CardDescription>
          Register a domain with our email provider, add the DNS records shown below, then wait for
          verification. We recheck automatically while this page is open, and notify you when it is
          ready.
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
              className="w-fit cursor-pointer"
            >
              {busy === "register" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {row ? "Update / sync domain" : "Register domain"}
            </Button>
          </div>
        </div>

        {row && isVerified && (
          <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              Domain verified and ready
            </div>
            <p className="text-sm text-muted-foreground">
              Outbound mail will use addresses on <code className="text-xs">{row.domain_name}</code>
              , for example <code className="text-xs">{exampleFrom}</code>.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="cursor-pointer"
              onClick={() => void handleSendTest()}
              disabled={busy !== null}
            >
              {busy === "test" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Mail className="h-4 w-4 mr-1" />
              )}
              Send test email to me
            </Button>
          </div>
        )}

        {row && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Status</span>
              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs">
                {isVerified && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                {DISPLAY_LABEL[row.display_status] ?? row.display_status}
              </span>
              <span className="text-xs text-muted-foreground">(Resend: {row.resend_status})</span>
              {lastCheckedAt && (
                <span className="text-xs text-muted-foreground">
                  Last checked {formatCheckedAt(lastCheckedAt)}
                </span>
              )}
              {PENDING_STATUSES.has(row.display_status) && (
                <span className="text-xs text-muted-foreground">
                  Auto-checking every {AUTO_POLL_MS / 1000}s
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void refreshStatus({ announce: true })}
                disabled={busy !== null}
                className="cursor-pointer"
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
                className="text-destructive border-destructive/50 hover:bg-destructive/10 cursor-pointer"
              >
                {busy === "remove" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Remove domain
              </Button>
            </div>
            {!isVerified && (
              <DnsRecordsGuide snapshot={row.dns_records_snapshot} domainName={row.domain_name} />
            )}
            {isVerified && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Show DNS records</summary>
                <div className="mt-3">
                  <DnsRecordsGuide
                    snapshot={row.dns_records_snapshot}
                    domainName={row.domain_name}
                  />
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
