"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2 } from "lucide-react";

interface MarkFinishedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onSuccess: () => void;
}

export function MarkFinishedDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  onSuccess,
}: MarkFinishedDialogProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          is_finished: true,
          finished_at: new Date().toISOString(),
          finished_notes: notes.trim() || null,
          column_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leadId);

      if (error) {
        console.error("[v0] Error marking lead as finished:", error);
        alert("Erro ao marcar lead como finalizado. Tente novamente.");
      } else {
        onSuccess();
        onOpenChange(false);
        setNotes("");
      }
    } catch (err) {
      console.error("[v0] Error in handleSubmit:", err);
      alert("Erro ao marcar lead como finalizado.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-muted-foreground" />
            Marcar Lead como Finalizado
          </DialogTitle>
          <DialogDescription>
            Você está marcando <strong>{leadName}</strong> como finalizado (sem resposta no primeiro contato). Esta ação removerá o lead do pipeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Adicione detalhes sobre a finalização do lead..."
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
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Marcando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Marcar como Finalizado
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
