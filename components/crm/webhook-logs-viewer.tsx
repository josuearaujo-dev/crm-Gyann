"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Webhook,
  ChevronDown,
  ChevronRight,
  Search,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { formatInAppTimezone } from "@/lib/timezone";

interface WebhookLog {
  id: string;
  source_id: string | null;
  method: string;
  url: string;
  headers: Record<string, string> | null;
  query_params: Record<string, string> | null;
  body: any;
  ip_address: string | null;
  user_agent: string | null;
  status_code: number | null;
  response: any;
  created_at: string;
  lead_sources?: {
    name: string;
    type: string;
  } | null;
}

interface LeadSourceOption {
  id: string;
  name: string;
}

interface WebhookLogsViewerProps {
  logs: WebhookLog[];
  sources?: LeadSourceOption[];
}

function isSuccessResponse(response: any): boolean | null {
  if (!response || typeof response !== "object") return null;
  if (typeof response.success === "boolean") return response.success;
  if (response.error) return false;
  if (response.lead_id || response.lead) return true;
  return null;
}

function summarizeBodyFields(body: any): { label: string; value: string }[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];

  const entries = Object.entries(body as Record<string, unknown>);
  const interesting: { label: string; value: string }[] = [];
  const seen = new Set<string>();

  const pushIf = (label: string, keyNorm: string, rawKey: string, value: unknown) => {
    if (seen.has(label)) return;
    const val = String(value ?? "").trim();
    if (!val) return;
    if (
      keyNorm === label.toLowerCase().replace(/[^a-z]/g, "") ||
      keyNorm.includes(label.toLowerCase().replace(/[^a-z]/g, ""))
    ) {
      interesting.push({ label: rawKey, value: val });
      seen.add(label);
    }
  };

  for (const [key, value] of entries) {
    const keyNorm = key.toLowerCase().replace(/[^a-z]/g, "");
    pushIf("name", keyNorm, key, value);
    pushIf("nome", keyNorm, key, value);
    pushIf("fullname", keyNorm, key, value);
    pushIf("email", keyNorm, key, value);
    pushIf("phone", keyNorm, key, value);
    pushIf("telefone", keyNorm, key, value);
    pushIf("telephone", keyNorm, key, value);
    pushIf("company", keyNorm, key, value);
    pushIf("empresa", keyNorm, key, value);
  }

  // Fallback: primeiros campos com valor (exceto meta/headers)
  if (interesting.length === 0) {
    for (const [key, value] of entries.slice(0, 8)) {
      const val = String(value ?? "").trim();
      if (!val || key.toLowerCase().startsWith("fields[")) continue;
      interesting.push({
        label: key,
        value: val.length > 80 ? `${val.slice(0, 80)}…` : val,
      });
    }
  }

  return interesting;
}

export function WebhookLogsViewer({ logs, sources = [] }: WebhookLogsViewerProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sourceNames = useMemo(() => {
    const fromLogs = logs
      .map((l) => l.lead_sources?.name)
      .filter((n): n is string => Boolean(n));
    const fromProps = sources.map((s) => s.name);
    return Array.from(new Set([...fromProps, ...fromLogs])).sort();
  }, [logs, sources]);

  const filteredLogs = logs.filter((log) => {
    const haystack = [
      log.url,
      log.lead_sources?.name,
      log.ip_address,
      JSON.stringify(log.body ?? {}),
      JSON.stringify(log.response ?? {}),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !searchTerm || haystack.includes(searchTerm.toLowerCase());

    const matchesMethod =
      methodFilter === "all" || log.method === methodFilter;

    const matchesSource =
      sourceFilter === "all" ||
      log.lead_sources?.name === sourceFilter ||
      log.source_id === sourceFilter;

    const success = isSuccessResponse(log.response);
    const matchesResult =
      resultFilter === "all" ||
      (resultFilter === "success" && success === true) ||
      (resultFilter === "error" && success === false) ||
      (resultFilter === "unknown" && success === null);

    return matchesSearch && matchesMethod && matchesSource && matchesResult;
  });

  const stats = useMemo(() => {
    let success = 0;
    let error = 0;
    let unknown = 0;
    for (const log of logs) {
      const s = isSuccessResponse(log.response);
      if (s === true) success++;
      else if (s === false) error++;
      else unknown++;
    }
    return { total: logs.length, success, error, unknown };
  }, [logs]);

  const getStatusColor = (statusCode: number | null) => {
    if (statusCode == null) return "bg-muted text-muted-foreground";
    if (statusCode >= 200 && statusCode < 300)
      return "bg-success/10 text-success border-success/20";
    if (statusCode >= 400 && statusCode < 500)
      return "bg-warning/10 text-warning border-warning/20";
    if (statusCode >= 500)
      return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-muted text-muted-foreground";
  };

  const copyJson = async (id: string, data: unknown) => {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Logs de Webhook
          </h1>
          <p className="text-muted-foreground">
            Confira o payload bruto recebido e a resposta do CRM (últimos 90
            dias). Use isso para ver se o lead chegou errado ou se a exibição
            está incorreta.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/webhooks">
            <ExternalLink className="w-4 h-4 mr-2" />
            Gerenciar webhooks
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardDescription>Sucesso</CardDescription>
            <CardTitle className="text-2xl text-success">{stats.success}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardDescription>Erro / rejeitado</CardDescription>
            <CardTitle className="text-2xl text-destructive">{stats.error}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardDescription>Exibindo</CardDescription>
            <CardTitle className="text-2xl">{filteredLogs.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar em URL, fonte, IP, body ou response..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3">
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos métodos</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Fonte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fontes</SelectItem>
                {sourceNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos resultados</SelectItem>
                <SelectItem value="success">Só sucesso</SelectItem>
                <SelectItem value="error">Só erro</SelectItem>
                <SelectItem value="unknown">Sem status claro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Webhook className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ||
                methodFilter !== "all" ||
                sourceFilter !== "all" ||
                resultFilter !== "all"
                  ? "Nenhum log encontrado com os filtros aplicados"
                  : "Nenhum log de webhook registrado ainda"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const success = isSuccessResponse(log.response);
            const bodySummary = summarizeBodyFields(log.body);
            const responseError =
              log.response?.error ||
              log.response?.details ||
              (success === false ? "Falha ao processar" : null);
            const leadId = log.response?.lead_id || log.response?.lead?.id;

            return (
              <Card key={log.id} className="border-border/50">
                <CardContent className="p-4">
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() =>
                      setExpandedLog(expandedLog === log.id ? null : log.id)
                    }
                  >
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        type="button"
                      >
                        {expandedLog === log.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Badge variant="outline" className="font-mono">
                            {log.method}
                          </Badge>
                          {log.status_code != null && (
                            <Badge className={getStatusColor(log.status_code)}>
                              HTTP {log.status_code}
                            </Badge>
                          )}
                          {success === true && (
                            <Badge className="bg-success/10 text-success border-success/20 gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Lead criado
                            </Badge>
                          )}
                          {success === false && (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Erro
                            </Badge>
                          )}
                          {log.lead_sources && (
                            <Badge variant="secondary">
                              {log.lead_sources.name}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatInAppTimezone(log.created_at, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>

                        <p className="text-sm text-foreground font-mono truncate">
                          {log.url}
                        </p>

                        {bodySummary.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {bodySummary.slice(0, 4).map((f) => (
                              <span key={f.label}>
                                <span className="text-foreground/70">
                                  {f.label}:
                                </span>{" "}
                                {f.value}
                              </span>
                            ))}
                          </div>
                        )}

                        {success === false && responseError && (
                          <p className="text-xs text-destructive mt-2">
                            {String(responseError)}
                          </p>
                        )}
                        {leadId && (
                          <p className="text-xs text-muted-foreground mt-1">
                            lead_id:{" "}
                            <span className="font-mono text-foreground">
                              {leadId}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedLog === log.id && (
                    <div className="mt-4 space-y-4 pl-0 sm:pl-12">
                      {Object.keys(log.query_params || {}).length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-foreground">
                              Query Parameters
                            </h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyJson(`${log.id}-query`, log.query_params);
                              }}
                            >
                              {copiedId === `${log.id}-query` ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </Button>
                          </div>
                          <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                            {JSON.stringify(log.query_params, null, 2)}
                          </pre>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            Body recebido (payload bruto)
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyJson(`${log.id}-body`, log.body);
                            }}
                          >
                            {copiedId === `${log.id}-body` ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-80">
                          {JSON.stringify(log.body, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            Response do CRM
                          </h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyJson(`${log.id}-response`, log.response);
                            }}
                          >
                            {copiedId === `${log.id}-response` ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                          {JSON.stringify(log.response, null, 2)}
                        </pre>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          Headers
                        </h4>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-48">
                          {JSON.stringify(log.headers, null, 2)}
                        </pre>
                      </div>

                      {(log.ip_address || log.user_agent) && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {log.ip_address && <p>IP: {log.ip_address}</p>}
                          {log.user_agent && (
                            <p>User Agent: {log.user_agent}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
