"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
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
  UserPlus,
  Loader2,
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

type ParsedField = { label: string; value: string; id?: string };

type ParsedWebhookBody = {
  formName: string | null;
  formId: string | null;
  fields: ParsedField[];
  meta: ParsedField[];
  utms: ParsedField[];
  pageUrl: string | null;
};

function extractUtmsFromUrl(url: string | null): ParsedField[] {
  if (!url) return [];
  try {
    const parsed = new URL(url);
    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "utm_id",
    ];
    return keys
      .map((key) => {
        const value = parsed.searchParams.get(key);
        if (!value) return null;
        return { label: key, value: decodeURIComponent(value.replace(/\+/g, " ")) };
      })
      .filter((item): item is ParsedField => Boolean(item));
  } catch {
    return [];
  }
}

/** Transforma o payload bruto do Elementor/n8n em campos legíveis. */
function parseWebhookBody(body: any): ParsedWebhookBody {
  const empty: ParsedWebhookBody = {
    formName: null,
    formId: null,
    fields: [],
    meta: [],
    utms: [],
    pageUrl: null,
  };

  if (!body || typeof body !== "object" || Array.isArray(body)) return empty;

  const record = body as Record<string, unknown>;
  const formName = record["form[name]"] ? String(record["form[name]"]) : null;
  const formId = record["form[id]"] ? String(record["form[id]"]) : null;

  // Formato Elementor: fields[id][title] / fields[id][value]
  const fieldMap = new Map<string, { title?: string; value?: string; type?: string }>();
  const metaMap = new Map<string, { title?: string; value?: string }>();

  for (const [key, raw] of Object.entries(record)) {
    const fieldMatch = key.match(/^fields\[([^\]]+)\]\[(title|value|type|id)\]$/);
    if (fieldMatch) {
      const [, id, prop] = fieldMatch;
      const current = fieldMap.get(id) || {};
      if (prop === "title") current.title = String(raw ?? "");
      if (prop === "value") current.value = String(raw ?? "");
      if (prop === "type") current.type = String(raw ?? "");
      fieldMap.set(id, current);
      continue;
    }

    const metaMatch = key.match(/^meta\[([^\]]+)\]\[(title|value)\]$/);
    if (metaMatch) {
      const [, id, prop] = metaMatch;
      const current = metaMap.get(id) || {};
      if (prop === "title") current.title = String(raw ?? "");
      if (prop === "value") current.value = String(raw ?? "");
      metaMap.set(id, current);
    }
  }

  let fields: ParsedField[] = Array.from(fieldMap.entries())
    .map(([id, data]) => ({
      id,
      label: data.title?.trim() || id,
      value: (data.value ?? "").trim(),
    }))
    .filter((f) => f.value);

  const meta: ParsedField[] = Array.from(metaMap.entries())
    .map(([id, data]) => ({
      id,
      label: data.title?.trim() || id,
      value: (data.value ?? "").trim(),
    }))
    .filter((m) => m.value);

  // Formato direto (n8n flattened): Name / E-mail / Telephone
  if (fields.length === 0) {
    const skip = new Set([
      "form_id",
      "form_name",
      "form[id]",
      "form[name]",
      "headers",
      "query_params",
    ]);
    for (const [key, raw] of Object.entries(record)) {
      if (skip.has(key) || key.startsWith("fields[") || key.startsWith("meta[")) {
        continue;
      }
      const value = String(raw ?? "").trim();
      if (!value) continue;
      fields.push({ label: key, value });
    }
  }

  const pageUrl =
    meta.find((m) => m.id === "page_url" || /url/i.test(m.label))?.value ||
    (typeof record.page_url === "string" ? record.page_url : null);

  return {
    formName,
    formId,
    fields,
    meta,
    utms: extractUtmsFromUrl(pageUrl),
    pageUrl,
  };
}

function summarizeBodyFields(body: any): { label: string; value: string }[] {
  const parsed = parseWebhookBody(body);
  if (parsed.fields.length > 0) {
    return parsed.fields.map((f) => ({
      label: f.label,
      value: f.value.length > 60 ? `${f.value.slice(0, 60)}…` : f.value,
    }));
  }
  return [];
}

function FieldTable({
  title,
  rows,
}: {
  title: string;
  rows: ParsedField[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.label}-${row.id || row.value}`}
                className="border-b border-border last:border-0"
              >
                <td className="align-top px-3 py-2 w-[38%] text-muted-foreground bg-muted/40">
                  {row.label}
                </td>
                <td className="align-top px-3 py-2 text-foreground break-all">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function WebhookLogsViewer({ logs, sources = [] }: WebhookLogsViewerProps) {
  const router = useRouter();
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSourceByLog, setSelectedSourceByLog] = useState<Record<string, string>>({});
  const [processingLogId, setProcessingLogId] = useState<string | null>(null);
  const [reprocessMessage, setReprocessMessage] = useState<Record<string, string>>({});
  const [duplicatePromptByLog, setDuplicatePromptByLog] = useState<Record<string, boolean>>({});

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
      (resultFilter === "unknown" && success === null) ||
      (resultFilter === "invalid_source" &&
        (log.response?.code === "INVALID_SOURCE_UUID" ||
          String(log.response?.error || "").includes("invalid input syntax for type uuid"))) ||
      (resultFilter === "source_not_found" &&
        log.response?.code === "SOURCE_NOT_FOUND") ||
      (resultFilter === "reprocessed" &&
        (log.response?.reprocessed === true || Boolean(log.response?.lead_id)));

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

  const canCreateLeadFromLog = (log: WebhookLog) => {
    const success = isSuccessResponse(log.response);
    const leadId = log.response?.lead_id || log.response?.lead?.id;
    return success === false && !leadId && log.body && typeof log.body === "object";
  };

  const describeError = (log: WebhookLog) => {
    const code = log.response?.code || log.response?.error_code;
    const received =
      log.response?.received_source ||
      log.query_params?.source ||
      null;
    const error = log.response?.error || log.response?.details;

    if (code === "INVALID_SOURCE_UUID") {
      return {
        title: "Source inválido",
        detail: received
          ? `Valor recebido: ${received}`
          : String(error || "UUID incompleto ou mal formatado"),
      };
    }
    if (code === "SOURCE_NOT_FOUND") {
      return { title: "Fonte não encontrada", detail: String(error || "") };
    }
    if (code === "SOURCE_MISSING") {
      return { title: "Source ausente", detail: "A URL não trouxe ?source=" };
    }
    if (error) {
      return { title: "Falha ao criar lead", detail: String(error) };
    }
    return null;
  };

  const handleCreateLeadFromLog = async (
    logId: string,
    forceDuplicate = false,
  ) => {
    const sourceId = selectedSourceByLog[logId];
    if (!sourceId) {
      setReprocessMessage((prev) => ({
        ...prev,
        [logId]: "Selecione a fonte/formulário do CRM antes de criar o lead.",
      }));
      return;
    }

    setProcessingLogId(logId);
    setReprocessMessage((prev) => ({ ...prev, [logId]: "" }));

    try {
      const response = await fetch(`/api/webhook-logs/${logId}/create-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, forceDuplicate }),
      });

      const data = await response.json();

      if (data.code === "POSSIBLE_DUPLICATE" && data.existingLead) {
        setReprocessMessage((prev) => ({
          ...prev,
          [logId]: `Já existe lead: ${data.existingLead.name} (${data.existingLead.email}). Use "Criar mesmo assim" se quiser duplicar.`,
        }));
        setDuplicatePromptByLog((prev) => ({ ...prev, [logId]: true }));
        return;
      }

      if (!response.ok || !data.success) {
        setReprocessMessage((prev) => ({
          ...prev,
          [logId]: data.error || "Não foi possível criar o lead.",
        }));
        return;
      }

      setDuplicatePromptByLog((prev) => ({ ...prev, [logId]: false }));
      setReprocessMessage((prev) => ({
        ...prev,
        [logId]: `Lead criado com sucesso (${data.lead_id}).`,
      }));
      router.refresh();
    } catch {
      setReprocessMessage((prev) => ({
        ...prev,
        [logId]: "Erro de rede ao criar o lead.",
      }));
    } finally {
      setProcessingLogId(null);
    }
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
                <SelectItem value="invalid_source">Source inválido</SelectItem>
                <SelectItem value="source_not_found">Fonte não encontrada</SelectItem>
                <SelectItem value="reprocessed">Já recuperados</SelectItem>
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
            const parsed = parseWebhookBody(log.body);
            const errorInfo = describeError(log);

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
                          {parsed.formName && (
                            <Badge variant="outline">{parsed.formName}</Badge>
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

                        {bodySummary.length > 0 ? (
                          <div className="mt-1 space-y-0.5">
                            {bodySummary.slice(0, 4).map((f) => (
                              <p
                                key={f.label}
                                className="text-sm text-foreground truncate"
                              >
                                <span className="text-muted-foreground">
                                  {f.label}:
                                </span>{" "}
                                {f.value}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-foreground font-mono truncate">
                            {log.url}
                          </p>
                        )}

                        {success === false && errorInfo && (
                          <div className="text-xs text-destructive mt-2 space-y-0.5">
                            <p className="font-medium">Erro: {errorInfo.title}</p>
                            {errorInfo.detail && <p>{errorInfo.detail}</p>}
                          </div>
                        )}
                        {success === false && !errorInfo && responseError && (
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
                            {log.response?.reprocessed && (
                              <Badge variant="outline" className="ml-2 text-[10px]">
                                Recuperado
                              </Badge>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {expandedLog === log.id && (
                    <div className="mt-4 space-y-4 pl-0 sm:pl-12">
                      {(parsed.formName || parsed.formId) && (
                        <div className="text-sm text-muted-foreground">
                          {parsed.formName && (
                            <p>
                              Formulário:{" "}
                              <span className="text-foreground font-medium">
                                {parsed.formName}
                              </span>
                              {parsed.formId ? ` (${parsed.formId})` : ""}
                            </p>
                          )}
                          {leadId && (
                            <p className="mt-1">
                              Resultado CRM:{" "}
                              <span className="text-foreground font-medium">
                                {success === true
                                  ? "Lead criado"
                                  : success === false
                                    ? "Erro"
                                    : "—"}
                              </span>
                              {leadId ? ` · ${leadId}` : ""}
                            </p>
                          )}
                        </div>
                      )}

                      <FieldTable
                        title="Campos do formulário"
                        rows={parsed.fields}
                      />
                      <FieldTable title="Campanha (UTM)" rows={parsed.utms} />
                      <FieldTable
                        title="Metadados"
                        rows={parsed.meta.filter(
                          (m) =>
                            m.id !== "user_agent" &&
                            m.id !== "credit" &&
                            !/agente de usu/i.test(m.label)
                        )}
                      />

                      {parsed.pageUrl && (
                        <div>
                          <h4 className="text-sm font-semibold text-foreground mb-2">
                            URL da página
                          </h4>
                          <p className="text-xs text-muted-foreground break-all bg-muted p-3 rounded-lg">
                            {parsed.pageUrl}
                          </p>
                        </div>
                      )}

                      {canCreateLeadFromLog(log) && sources.length > 0 && (
                        <div
                          className="rounded-lg border border-dashed border-border p-4 space-y-3 bg-muted/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div>
                            <h4 className="text-sm font-semibold text-foreground">
                              Criar lead manualmente
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              Este log falhou e não gerou lead. Escolha a fonte correta do CRM
                              para incluir o lead usando os dados salvos neste payload.
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                            <div className="space-y-1.5 flex-1">
                              <Label htmlFor={`source-${log.id}`} className="text-xs">
                                Fonte / formulário no CRM
                              </Label>
                              <Select
                                value={selectedSourceByLog[log.id] || ""}
                                onValueChange={(value) =>
                                  setSelectedSourceByLog((prev) => ({
                                    ...prev,
                                    [log.id]: value,
                                  }))
                                }
                              >
                                <SelectTrigger id={`source-${log.id}`}>
                                  <SelectValue placeholder="Selecione a fonte..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {sources.map((source) => (
                                    <SelectItem key={source.id} value={source.id}>
                                      {source.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button
                              type="button"
                              disabled={processingLogId === log.id}
                              onClick={() => handleCreateLeadFromLog(log.id)}
                            >
                              {processingLogId === log.id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <UserPlus className="w-4 h-4 mr-2" />
                              )}
                              Criar lead a partir deste log
                            </Button>
                          </div>
                          {duplicatePromptByLog[log.id] && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={processingLogId === log.id}
                                onClick={() =>
                                  handleCreateLeadFromLog(log.id, true)
                                }
                              >
                                Criar mesmo assim
                              </Button>
                            </div>
                          )}
                          {reprocessMessage[log.id] && (
                            <div
                              className={`text-xs space-y-1 ${
                                reprocessMessage[log.id].includes("sucesso")
                                  ? "text-success"
                                  : "text-destructive"
                              }`}
                            >
                              <p>{reprocessMessage[log.id]}</p>
                              {reprocessMessage[log.id].includes("sucesso") &&
                                log.response?.lead_id && (
                                  <Link
                                    href={`/dashboard/pipeline`}
                                    className="underline"
                                  >
                                    Abrir pipeline
                                  </Link>
                                )}
                            </div>
                          )}
                        </div>
                      )}

                      {leadId && success === true && (
                        <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
                          Lead criado
                          {log.response?.reprocessed ? " (recuperado do log)" : ""}.
                          <span className="font-mono text-xs ml-2">{leadId}</span>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-foreground">
                            Resposta do CRM
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
                        <div className="rounded-lg border border-border overflow-hidden text-sm">
                          <div className="grid grid-cols-[38%_1fr] border-b border-border">
                            <div className="px-3 py-2 text-muted-foreground bg-muted/40">
                              success
                            </div>
                            <div className="px-3 py-2">
                              {String(log.response?.success ?? "—")}
                            </div>
                          </div>
                          {leadId && (
                            <div className="grid grid-cols-[38%_1fr] border-b border-border">
                              <div className="px-3 py-2 text-muted-foreground bg-muted/40">
                                lead_id
                              </div>
                              <div className="px-3 py-2 font-mono text-xs break-all">
                                {leadId}
                              </div>
                            </div>
                          )}
                          {responseError && (
                            <div className="grid grid-cols-[38%_1fr]">
                              <div className="px-3 py-2 text-muted-foreground bg-muted/40">
                                erro
                              </div>
                              <div className="px-3 py-2 text-destructive">
                                {String(responseError)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <details className="group">
                        <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground list-none flex items-center gap-2">
                          <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
                          Ver JSON bruto / headers
                        </summary>
                        <div className="mt-3 space-y-4">
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
                                    copyJson(
                                      `${log.id}-query`,
                                      log.query_params
                                    );
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
                                Body bruto
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
                            <h4 className="text-sm font-semibold text-foreground mb-2">
                              Headers
                            </h4>
                            <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-48">
                              {JSON.stringify(log.headers, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
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
