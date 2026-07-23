"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, CalendarRange, DollarSign, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  budget: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

interface CampaignManagerProps {
  campaigns: Campaign[];
  userId: string;
  onCampaignsChange: (campaigns: Campaign[]) => void;
}

const emptyForm = {
  name: "",
  description: "",
  budget: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

export function CampaignManager({ campaigns, userId, onCampaignsChange }: CampaignManagerProps) {
  const supabase = createClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Retorna as campanhas que se sobrepõem ao range fornecido (excluindo a campanha em edição)
  const getConflictingCampaigns = (startDate: string, endDate: string): Campaign[] => {
    if (!startDate || !endDate) return [];
    const newStart = new Date(startDate + "T00:00:00");
    const newEnd = new Date(endDate + "T23:59:59");
    return campaigns.filter((c) => {
      if (editingCampaign && c.id === editingCampaign.id) return false;
      const cStart = new Date(c.start_date + "T00:00:00");
      const cEnd = new Date(c.end_date + "T23:59:59");
      return newStart <= cEnd && newEnd >= cStart;
    });
  };

  const handleDateChange = (field: "start_date" | "end_date", value: string) => {
    const newForm = { ...form, [field]: value };
    setForm(newForm);
    const conflicts = getConflictingCampaigns(newForm.start_date, newForm.end_date);
    if (conflicts.length > 0) {
      const names = conflicts.map((c) => `"${c.name}" (${new Date(c.start_date + "T00:00:00").toLocaleDateString("en-US")} – ${new Date(c.end_date + "T00:00:00").toLocaleDateString("en-US")})`).join(", ");
      setConflictWarning(`This period overlaps with: ${names}. Leads and costs may be shared between campaigns.`);
    } else {
      setConflictWarning(null);
    }
  };

  const openNew = () => {
    setEditingCampaign(null);
    setForm(emptyForm);
    setConflictWarning(null);
    setSheetOpen(true);
  };

  const openEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setForm({
      name: campaign.name,
      description: campaign.description || "",
      budget: String(campaign.budget),
      start_date: campaign.start_date,
      end_date: campaign.end_date,
      is_active: campaign.is_active,
    });
    setConflictWarning(null);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) return;
    setSaving(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      budget: parseFloat(form.budget) || 0,
      start_date: form.start_date,
      end_date: form.end_date,
      is_active: form.is_active,
    };

    if (editingCampaign) {
      const { data, error } = await supabase
        .from("campaigns")
        .update(payload)
        .eq("id", editingCampaign.id)
        .select()
        .single();

      if (!error && data) {
        onCampaignsChange(campaigns.map((c) => (c.id === data.id ? data : c)));
      }
    } else {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...payload, created_by: userId })
        .select()
        .single();

      if (!error && data) {
        onCampaignsChange([...campaigns, data]);
      }
    }

    setSaving(false);
    setSheetOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", deleteId);
    if (!error) {
      onCampaignsChange(campaigns.filter((c) => c.id !== deleteId));
    }
    setDeleteId(null);
  };

  const isActive = (c: Campaign) => {
    const today = new Date().toISOString().slice(0, 10);
    return c.is_active && c.start_date <= today && c.end_date >= today;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Campanhas</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre e gerencie suas campanhas de marketing
            </p>
          </div>
          <Button onClick={openNew} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Campanha
          </Button>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CalendarRange className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma campanha cadastrada ainda.</p>
              <p className="text-xs mt-1">Cadastre uma campanha para ver os relatórios.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{campaign.name}</p>
                      {isActive(campaign) ? (
                        <Badge className="text-xs bg-green-500/15 text-green-600 border-green-500/30">Vigente</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Encerrada</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarRange className="w-3 h-3" />
                        {new Date(campaign.start_date + "T00:00:00").toLocaleDateString("en-US")} — {new Date(campaign.end_date + "T00:00:00").toLocaleDateString("en-US")}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(campaign.budget)}
                      </span>
                    </div>
                    {campaign.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{campaign.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(campaign)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(campaign.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sheet de criação/edição */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto px-6">
          <SheetHeader>
            <SheetTitle>{editingCampaign ? "Editar Campanha" : "Nova Campanha"}</SheetTitle>
            <SheetDescription>
              Defina o nome, orçamento e período da campanha para calcular os relatórios.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1">
              <Label>Nome da Campanha *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Campanha Janeiro 2026"
              />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição opcional da campanha..."
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label>Amount Invested (USD) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => handleDateChange("start_date", e.target.value)}
                  className={conflictWarning ? "border-amber-500 focus-visible:ring-amber-500" : ""}
                />
              </div>
              <div className="space-y-1">
                <Label>Data Fim *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => handleDateChange("end_date", e.target.value)}
                  className={conflictWarning ? "border-amber-500 focus-visible:ring-amber-500" : ""}
                />
              </div>
            </div>

            {/* Aviso de sobreposição */}
            {conflictWarning && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
                  {conflictWarning}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={saving || !form.name || !form.start_date || !form.end_date}
              >
                {saving ? "Salvando..." : editingCampaign ? "Salvar Alterações" : "Criar Campanha"}
              </Button>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A campanha será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
