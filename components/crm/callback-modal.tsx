"use client";

import { useState } from "react";
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
import { Calendar, Clock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toDateStringInAppTimezone } from "@/lib/timezone";

interface CallbackModalProps {
  leadId: string;
  leadName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CallbackModal({
  leadId,
  leadName,
  open,
  onOpenChange,
  onSuccess,
}: CallbackModalProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSave = async () => {
    if (!date || !time) {
      alert("Por favor, preencha data e horário");
      return;
    }

    setLoading(true);

    // Combinar data e hora interpretando como Pacific Time (São Francisco)
    // Criar string no formato ISO e converter para UTC considerando o offset de Pacific Time
    const dateTimeString = `${date}T${time}:00`;
    
    // Parse como se fosse Pacific Time e converter para UTC
    const localDate = new Date(dateTimeString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Obter partes da data em Pacific Time
    const parts = formatter.formatToParts(localDate);
    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;
    
    // Reconstruir como UTC ajustando o offset
    const ptDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    
    // Calcular o offset entre a data local e Pacific Time
    const utcDate = new Date(Date.UTC(
      parseInt(year!),
      parseInt(month!) - 1,
      parseInt(day!),
      parseInt(hour!),
      parseInt(minute!),
      parseInt(second!)
    ));
    
    // Ajustar para UTC considerando o offset de Pacific Time (normalmente -7 ou -8 horas)
    const ptOffset = -localDate.getTimezoneOffset(); // offset do navegador
    const targetDate = new Date(localDate.getTime() - ptOffset * 60000); // remover offset do navegador
    
    // Aplicar offset de Pacific Time (aproximadamente -8 horas / -7 no horário de verão)
    const isPST = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' }).includes('PST');
    const pacificOffset = isPST ? -8 : -7; // -8 para PST, -7 para PDT
    const scheduledAt = new Date(Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours() - pacificOffset,
      localDate.getMinutes(),
      0
    ));
    
    console.log("[v0] Criando callback (Pacific Time):", { 
      date, 
      time, 
      localInput: dateTimeString,
      pacificOffset,
      scheduledAtUTC: scheduledAt.toISOString() 
    });

    // Pegar o usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("[v0] Usuário não encontrado");
      alert("Erro: Usuário não autenticado");
      setLoading(false);
      return;
    }

    console.log("[v0] Usuário:", user.id);

    const taskData = {
      lead_id: leadId,
      title: "Ligar Novamente",
      description: `Callback agendado para ${leadName}`,
      type: "callback",
      scheduled_at: scheduledAt.toISOString(),
      status: "scheduled",
      note: note || null,
      completed: false,
      assigned_to: user.id,
      created_by: user.id,
    };

    console.log("[v0] Dados da task:", taskData);

    const { data, error } = await supabase.from("tasks").insert(taskData).select();

    setLoading(false);

    if (error) {
      console.error("[v0] Erro ao criar callback:", error);
      alert(`Erro ao agendar callback: ${error.message}`);
      return;
    }

    console.log("[v0] Callback criado com sucesso:", data);

    // Limpar formulário
    setDate("");
    setTime("");
    setNote("");
    
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Ligar Novamente
          </DialogTitle>
          <Badge variant="secondary" className="w-fit gap-1 mt-2">
            <MapPin className="w-3 h-3" />
            Horário: São Francisco (Pacific Time)
          </Badge>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Lead</Label>
            <Input value={leadName} disabled className="bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Data
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                min={toDateStringInAppTimezone(new Date())}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Horário
              </Label>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nota (opcional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Adicione uma nota sobre este callback..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
