"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { XCircle, Loader2 } from "lucide-react";

interface LossReason {
  id: string;
  name: string;
  description: string | null;
}

interface MarkLostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  currentDealValue?: number | null;
  onSuccess: () => void;
}

export function MarkLostDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  currentDealValue,
  onSuccess,
}: MarkLostDialogProps) {
  const [lossReasons, setLossReasons] = useState<LossReason[]>([]);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [dealValue, setDealValue] = useState<string>(currentDealValue?.toString() || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      loadLossReasons();
    }
  }, [open]);

  const loadLossReasons = async () => {
    const { data } = await supabase
      .from("loss_reasons")
      .select("*")
      .order("name", { ascending: true });

    if (data) {
      setLossReasons(data);
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      alert("Por favor, selecione um motivo de perda.");
      return;
    }

    if (!dealValue || dealValue.trim() === "") {
      alert("Por favor, informe o valor do lead para calcular o valor perdido.");
      return;
    }

    const parsedValue = parseFloat(dealValue);
    if (isNaN(parsedValue) || parsedValue < 0) {
      alert("Por favor, informe um valor válido.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          is_lost: true,
          loss_reason_id: selectedReason,
          loss_notes: notes.trim() || null,
          deal_value: parsedValue,
          lost_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (error) {
        console.error("[v0] Error marking lead as lost:", error);
        alert("Erro ao marcar lead como perdido. Tente novamente.");
      } else {
        onSuccess();
        onOpenChange(false);
        setSelectedReason("");
        setNotes("");
        setDealValue("");
      }
    } catch (err) {
      console.error("[v0] Error in handleSubmit:", err);
      alert("Erro ao marcar lead como perdido.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-destructive" />
            Marcar Lead como Perdido
          </DialogTitle>
          <DialogDescription>
            Você está marcando <strong>{leadName}</strong> como perdido. Esta ação removerá o lead do pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da Perda *</Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {lossReasons.map((reason) => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReason && (
              <p className="text-xs text-muted-foreground">
                {lossReasons.find(r => r.id === selectedReason)?.description}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dealValue">Lead Value (USD) *</Label>
            <Input
              id="dealValue"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 1500.00"
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Informe o valor para calcular a métrica de "Valor Perdido"
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Adicione detalhes sobre a perda do lead..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedReason || !dealValue.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Marcando...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Marcar como Perdido
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
