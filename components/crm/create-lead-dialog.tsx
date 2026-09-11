"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, UserPlus } from "lucide-react";
import type { LeadSource, PipelineColumn } from "@/lib/types";

interface CreateLeadDialogProps {
  columns: PipelineColumn[];
  sources: Pick<LeadSource, "id" | "name" | "type">[];
  userId: string;
  onCreated?: (leadId: string) => void;
  triggerVariant?: "default" | "outline" | "secondary";
  triggerClassName?: string;
  triggerLabel?: string;
}

function pickDefaultColumnId(columns: PipelineColumn[]): string {
  const novoLead = columns.find(
    (c) => c.name.toLowerCase().trim() === "novo lead",
  );
  if (novoLead) return novoLead.id;

  const sorted = [...columns].sort((a, b) => a.position - b.position);
  return sorted[0]?.id || "";
}

export function CreateLeadDialog({
  columns,
  sources,
  userId,
  onCreated,
  triggerVariant = "default",
  triggerClassName,
  triggerLabel = "Novo Lead",
}: CreateLeadDialogProps) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const defaultColumnId = useMemo(
    () => pickDefaultColumnId(columns),
    [columns],
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [sourceId, setSourceId] = useState<string>("manual");
  const [columnId, setColumnId] = useState(defaultColumnId);
  const [segmento, setSegmento] = useState("");
  const [faturamento, setFaturamento] = useState("");

  useEffect(() => {
    if (open) {
      setColumnId(defaultColumnId);
      setError("");
    }
  }, [open, defaultColumnId]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setSourceId("manual");
    setColumnId(defaultColumnId);
    setSegmento("");
    setFaturamento("");
    setError("");
  };

  const ensureManualSourceId = async (): Promise<string | null> => {
    const existing = sources.find(
      (s) =>
        s.type === "manual" ||
        s.name.toLowerCase() === "manual" ||
        s.name.toLowerCase() === "cadastro manual",
    );
    if (existing) return existing.id;

    const { data, error: insertError } = await supabase
      .from("lead_sources")
      .insert({
        name: "Cadastro Manual",
        type: "manual",
        is_active: true,
        created_by: userId || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[v0] Failed to create manual source:", insertError);
      return null;
    }

    return data.id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Informe o nome do lead.");
      return;
    }

    if (!columnId) {
      setError("Selecione a coluna inicial da pipeline.");
      return;
    }

    setSaving(true);
    try {
      let resolvedSourceId: string | null =
        sourceId && sourceId !== "manual" ? sourceId : null;

      if (!resolvedSourceId) {
        resolvedSourceId = await ensureManualSourceId();
      }

      const metadata: Record<string, string> = {};
      if (segmento.trim()) {
        metadata.segmento = segmento.trim();
        metadata.segmento_label = segmento.trim();
      }
      if (faturamento.trim()) {
        metadata.faturamento = faturamento.trim();
        metadata.faturamento_mensal = faturamento.trim();
        metadata.faturamento_mensal_label = faturamento.trim();
      }

      const payload: Record<string, unknown> = {
        name: trimmedName,
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        source_id: resolvedSourceId,
        column_id: columnId,
        assigned_to: userId || null,
        is_finished: false,
        is_lost: false,
        excluded_from_reports: false,
        deal_value: 0,
      };

      if (Object.keys(metadata).length > 0) {
        payload.metadata = metadata;
      }

      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert(payload)
        .select("id")
        .single();

      if (leadError) {
        setError(leadError.message || "Não foi possível criar o lead.");
        return;
      }

      resetForm();
      setOpen(false);
      onCreated?.(lead.id);
    } catch (err: any) {
      setError(err?.message || "Erro inesperado ao criar o lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className={triggerClassName}>
          <UserPlus className="w-4 h-4 mr-2" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
          <DialogDescription>
            Preencha os dados para incluir o lead na pipeline.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="lead-name">Nome *</Label>
            <Input
              id="lead-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lead-email">E-mail</Label>
              <Input
                id="lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-phone">Telefone / WhatsApp</Label>
              <Input
                id="lead-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5511999999999"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-company">Empresa</Label>
            <Input
              id="lead-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Fonte</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Cadastro Manual" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Cadastro Manual</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Coluna inicial</Label>
              <Select value={columnId} onValueChange={setColumnId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a coluna" />
                </SelectTrigger>
                <SelectContent>
                  {[...columns]
                    .sort((a, b) => a.position - b.position)
                    .map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="lead-segmento">Segmento</Label>
              <Input
                id="lead-segmento"
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                placeholder="Ex: Restaurant"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-faturamento">Faturamento mensal</Label>
              <Input
                id="lead-faturamento"
                value={faturamento}
                onChange={(e) => setFaturamento(e.target.value)}
                placeholder="Ex: Até 20.000"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Criar lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
