"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Webhook, ChevronDown, ChevronRight, Search, Filter } from "lucide-react";
import { formatInAppTimezone } from "@/lib/timezone";

interface WebhookLog {
  id: string;
  source_id: string | null;
  method: string;
  url: string;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  body: any;
  ip_address: string | null;
  user_agent: string | null;
  status_code: number;
  response: any;
  created_at: string;
  lead_sources?: {
    name: string;
    type: string;
  } | null;
}

interface WebhookLogsViewerProps {
  logs: WebhookLog[];
}

export function WebhookLogsViewer({ logs }: WebhookLogsViewerProps) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState<string | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchTerm ||
      log.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.lead_sources?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip_address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMethod = !methodFilter || log.method === methodFilter;

    return matchesSearch && matchesMethod;
  });

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return "bg-success/10 text-success border-success/20";
    if (statusCode >= 400 && statusCode < 500) return "bg-warning/10 text-warning border-warning/20";
    if (statusCode >= 500) return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-muted text-muted-foreground";
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Logs de Webhook</h1>
        <p className="text-muted-foreground">
          Visualize todas as requisições recebidas pelos seus webhooks (últimos 7 dias)
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por URL, fonte ou IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={methodFilter === null ? "default" : "outline"}
                size="sm"
                onClick={() => setMethodFilter(null)}
              >
                Todos
              </Button>
              <Button
                variant={methodFilter === "GET" ? "default" : "outline"}
                size="sm"
                onClick={() => setMethodFilter("GET")}
              >
                GET
              </Button>
              <Button
                variant={methodFilter === "POST" ? "default" : "outline"}
                size="sm"
                onClick={() => setMethodFilter("POST")}
              >
                POST
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Logs */}
      {filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Webhook className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || methodFilter
                  ? "Nenhum log encontrado com os filtros aplicados"
                  : "Nenhum log de webhook registrado ainda"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="border-border/50">
              <CardContent className="p-4">
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
                        <Badge className={getStatusColor(log.status_code)}>
                          {log.status_code}
                        </Badge>
                        {log.lead_sources && (
                          <Badge variant="secondary">{log.lead_sources.name}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatInAppTimezone(log.created_at, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground font-mono truncate">
                        {log.url}
                      </p>
                      {log.ip_address && (
                        <p className="text-xs text-muted-foreground mt-1">
                          IP: {log.ip_address}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {expandedLog === log.id && (
                  <div className="mt-4 space-y-4 pl-12">
                    {/* Query Params */}
                    {Object.keys(log.query_params || {}).length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          Query Parameters
                        </h4>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                          {JSON.stringify(log.query_params, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Headers */}
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">Headers</h4>
                      <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-48">
                        {JSON.stringify(log.headers, null, 2)}
                      </pre>
                    </div>

                    {/* Body */}
                    {log.body && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">Body</h4>
                        <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto max-h-64">
                          {JSON.stringify(log.body, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Response */}
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">Response</h4>
                      <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                        {JSON.stringify(log.response, null, 2)}
                      </pre>
                    </div>

                    {/* User Agent */}
                    {log.user_agent && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          User Agent
                        </h4>
                        <p className="text-xs text-muted-foreground">{log.user_agent}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
