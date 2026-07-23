"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TaskTemplate } from "@/lib/types";

interface TaskTemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSelect?: (template: TaskTemplate) => void;
}

export function TaskTemplateManager({
  open,
  onOpenChange,
  onTemplateSelect,
}: TaskTemplateManagerProps) {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("task_templates")
      .select("*")
      .order("created_at", { ascending: false });

    setTemplates(data || []);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Nome é obrigatório");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("task_templates").insert({
      name,
      description: description || null,
      duration_minutes: duration ? parseInt(duration) : null,
      created_by: user?.id,
    });

    setLoading(false);

    if (error) {
      alert(`Erro ao salvar template: ${error.message}`);
      return;
    }

    // Limpar formulário
    setName("");
    setDescription("");
    setDuration("");
    setShowForm(false);

    // Recarregar lista
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este template?")) return;

    await supabase.from("task_templates").delete().eq("id", id);
    loadTemplates();
  };

  const handleSelect = (template: TaskTemplate) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Templates de Tasks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              className="w-full gap-2"
              variant="outline"
            >
              <Plus className="w-4 h-4" />
              Criar Novo Template
            </Button>
          )}

          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
              <div className="space-y-1.5">
                <Label>Nome do Template</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Follow-up com cliente"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrição da tarefa..."
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Duração (minutos)</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="30"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Salvando..." : "Salvar Template"}
                </Button>
                <Button
                  onClick={() => {
                    setShowForm(false);
                    setName("");
                    setDescription("");
                    setDuration("");
                  }}
                  variant="outline"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Templates Salvos ({templates.length})
            </Label>
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum template cadastrado ainda
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => handleSelect(template)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {template.name}
                        </p>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        {template.duration_minutes && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {template.duration_minutes}min
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
