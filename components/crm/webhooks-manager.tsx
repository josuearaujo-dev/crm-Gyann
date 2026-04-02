"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Webhook,
  Copy,
  Trash2,
  ExternalLink,
  CheckCircle,
} from "lucide-react";
import type { LeadSource, PipelineColumn } from "@/lib/types";

interface WebhooksManagerProps {
  sources: LeadSource[];
  columns: PipelineColumn[];
  userId: string;
}

export function WebhooksManager({
  sources,
  columns,
  userId,
}: WebhooksManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceType, setNewSourceType] = useState<"webhook" | "meta">(
    "webhook"
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleCreateSource = async () => {
    if (!newSourceName.trim()) {
      alert("Por favor, preencha o nome da fonte");
      return;
    }

    console.log("[v0] Criando fonte de leads:", { 
      name: newSourceName, 
      type: newSourceType, 
      userId 
    });

    const { data, error } = await supabase
      .from("lead_sources")
      .insert({
        name: newSourceName,
        type: newSourceType,
        created_by: userId,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("[v0] Erro ao criar fonte:", error);
      alert(`Erro ao criar fonte: ${error.message}\n\nVerifique as permissões do banco de dados.`);
      return;
    }

    if (data) {
      console.log("[v0] Fonte criada com sucesso:", data);
      setNewSourceName("");
      setNewSourceType("webhook");
      setIsCreating(false);
      router.refresh();
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    const { error } = await supabase
      .from("lead_sources")
      .delete()
      .eq("id", sourceId);

    if (!error) {
      router.refresh();
    }
  };

  const copyToClipboard = async (text: string, sourceId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(sourceId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWebhookUrl = (source: LeadSource) => {
    if (source.type === "meta") {
      return `${baseUrl}/api/webhooks/meta?source=${source.id}`;
    }
    // Usar rota elementor que suporta tanto JSON quanto form-urlencoded
    return `${baseUrl}/api/webhooks/elementor?source=${source.id}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas fontes de leads e webhooks
          </p>
        </div>
        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Fonte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Fonte de Leads</DialogTitle>
              <DialogDescription>
                Configure uma nova fonte para receber leads via webhook
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome da fonte</Label>
                <Input
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  placeholder="Ex: Formulario do Site"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={newSourceType}
                  onValueChange={(v) => setNewSourceType(v as "webhook" | "meta")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webhook">Webhook (Formulario)</SelectItem>
                    <SelectItem value="meta">Meta Ads (Facebook/Instagram)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleCreateSource} className="w-full">
                Criar Fonte
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((source) => (
          <Card key={source.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10"
                  >
                    <Webhook className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{source.name}</CardTitle>
                    <CardDescription>
                      <Badge variant="outline" className="mt-1">
                        {source.type === "meta" ? "Meta Ads" : "Webhook"}
                      </Badge>
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteSource(source.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={getWebhookUrl(source)}
                    className="text-xs font-mono bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(getWebhookUrl(source), source.id)}
                  >
                    {copiedId === source.id ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {source.type === "webhook" && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">
                    Formato esperado (POST):
                  </p>
                  <pre className="text-xs font-mono text-foreground overflow-x-auto">
{`{
  "name": "Nome do Lead",
  "email": "email@exemplo.com",
  "phone": "11999999999",
  "company": "Empresa (opcional)"
}`}
                  </pre>
                </div>
              )}

              {source.type === "meta" && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">
                    Configure no Meta Business:
                  </p>
                  <ol className="text-xs text-foreground space-y-1 list-decimal list-inside">
                    <li>Acesse o Gerenciador de Eventos</li>
                    <li>Selecione seu Lead Ads</li>
                    <li>Configure o webhook com a URL acima</li>
                    <li>Verifique o token: use seu user ID</li>
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {sources.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="py-12 text-center">
              <Webhook className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhuma fonte cadastrada
              </h3>
              <p className="text-muted-foreground mb-4">
                Crie uma fonte para comecar a receber leads
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Fonte
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
