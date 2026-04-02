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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Clock, MapPin, Video, Phone, Users, Globe, Bell, Plus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { toDateStringInAppTimezone } from "@/lib/timezone";

interface MeetingModalProps {
  leadId: string;
  leadName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MeetingModal({
  leadId,
  leadName,
  open,
  onOpenChange,
  onSuccess,
}: MeetingModalProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [meetingType, setMeetingType] = useState<string>("");
  const [meetingStatus, setMeetingStatus] = useState<"scheduled" | "done" | "no_show">("scheduled");
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [reminders, setReminders] = useState<
    { minutes_before: number; channels: string[] }[]
  >([{ minutes_before: 1440, channels: ["email"] }]); // 24h antes por padrão

  const supabase = createClient();

  const handleSave = async () => {
    if (!date || !time) {
      alert("Por favor, preencha data e horário");
      return;
    }

    setLoading(true);

    // Combinar data e hora em um timestamp (Pacific Time)
    // Parse como se fosse Pacific Time e converter para UTC
    const localDate = new Date(`${date}T${time}:00`);
    
    // Detectar se estamos em PST ou PDT
    const isPST = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' }).includes('PST');
    const pacificOffset = isPST ? 8 : 7; // UTC está 7-8 horas AHEAD de Pacific
    
    // Adicionar o offset para converter para UTC
    const scheduledAtUTC = new Date(Date.UTC(
      localDate.getFullYear(),
      localDate.getMonth(),
      localDate.getDate(),
      localDate.getHours() + pacificOffset, // ADICIONAR para converter PT -> UTC
      localDate.getMinutes(),
      0
    ));

    console.log("[v0] Criando reunião (Pacific Time):", { 
      date, 
      time,
      pacificOffset,
      inputLocal: `${date}T${time}:00`,
      scheduledAtUTC: scheduledAtUTC.toISOString(),
      leadId 
    });

    // Pegar o usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("[v0] Usuário não encontrado");
      alert("Erro: Usuário não autenticado");
      setLoading(false);
      return;
    }

    // Buscar a coluna "Reunião Marcada"
    const { data: columns } = await supabase
      .from("pipeline_columns")
      .select("id, name")
      .ilike("name", "%reunião marcada%")
      .limit(1);

    const reuniaoMarcadaColumnId = columns?.[0]?.id;

    // Criar reunião
    const meetingData = {
      lead_id: leadId,
      scheduled_at: scheduledAtUTC.toISOString(),
      duration_minutes: duration ? parseInt(duration) : 60,
      meeting_type: meetingType || null,
      meeting_link: meetingLink || null,
      status: meetingStatus,
      notes: notes || null,
    };

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert(meetingData)
      .select();

    if (meetingError) {
      console.error("[v0] Erro ao criar reunião:", meetingError);
      alert(`Erro ao marcar reunião: ${meetingError.message}`);
      setLoading(false);
      return;
    }

    console.log("[v0] Reunião criada:", meeting);

    // Criar lembretes
    if (meeting && meeting[0]) {
      const meetingId = meeting[0].id;
      const reminderInserts = [];

      for (const reminder of reminders) {
        for (const channel of reminder.channels) {
          reminderInserts.push({
            meeting_id: meetingId,
            minutes_before: reminder.minutes_before,
            channel: channel,
            sent: false,
          });
        }
      }

      if (reminderInserts.length > 0) {
        const { error: reminderError } = await supabase
          .from("meeting_reminders")
          .insert(reminderInserts);

        if (reminderError) {
          console.error("[v0] Erro ao criar lembretes:", reminderError);
        } else {
          console.log("[v0] Lembretes criados:", reminderInserts.length);
        }
      }
    }

    // Mover lead para "Reunião Marcada" se a coluna existir
    if (reuniaoMarcadaColumnId) {
      const { error: updateError } = await supabase
        .from("leads")
        .update({ column_id: reuniaoMarcadaColumnId })
        .eq("id", leadId);

      if (updateError) {
        console.error("[v0] Erro ao mover lead:", updateError);
      } else {
        console.log("[v0] Lead movido para Reunião Marcada");
      }
    }

    // Limpar formulário
    setDate("");
    setTime("");
    setDuration("60");
    setMeetingType("");
    setMeetingStatus("scheduled");
    setMeetingLink("");
    setNotes("");
    setReminders([{ minutes_before: 1440, channels: ["email"] }]);
    
    setLoading(false);
    
    // Fechar modal e atualizar lista
    onOpenChange(false);
    onSuccess();
  };

  const meetingTypeIcons = {
    zoom: Video,
    google_meet: Video,
    phone: Phone,
    in_person: Users,
    other: Globe,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Marcar Reunião
          </DialogTitle>
          <Badge variant="secondary" className="w-fit gap-1 mt-2">
            <MapPin className="w-3 h-3" />
            Horário: São Francisco (Pacific Time)
          </Badge>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-sm font-medium">Lead</Label>
            <p className="text-sm text-muted-foreground mt-1">{leadName}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="meeting-date">
                Data <span className="text-destructive">*</span>
              </Label>
              <Input
                id="meeting-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                min={toDateStringInAppTimezone(new Date())}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-time">
                Horário <span className="text-destructive">*</span>
              </Label>
              <Input
                id="meeting-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duração (minutos)</Label>
            <Input
              id="duration"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              min="15"
              step="15"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-type">Tipo de Reunião</Label>
            <Select value={meetingType} onValueChange={setMeetingType}>
              <SelectTrigger id="meeting-type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zoom">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Zoom
                  </div>
                </SelectItem>
                <SelectItem value="google_meet">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4" />
                    Google Meet
                  </div>
                </SelectItem>
                <SelectItem value="phone">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefone
                  </div>
                </SelectItem>
                <SelectItem value="in_person">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Presencial
                  </div>
                </SelectItem>
                <SelectItem value="other">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Outro
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-status">Status inicial</Label>
            <Select value={meetingStatus} onValueChange={(v) => setMeetingStatus(v as "scheduled" | "done" | "no_show")}>
              <SelectTrigger id="meeting-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Agendada</SelectItem>
                <SelectItem value="done">Realizada</SelectItem>
                <SelectItem value="no_show">No-show</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-link">Link da Reunião</Label>
            <Input
              id="meeting-link"
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="meeting-notes">Notas</Label>
            <Textarea
              id="meeting-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre a reunião..."
              rows={3}
            />
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Lembretes Automáticos
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setReminders([
                    ...reminders,
                    { minutes_before: 60, channels: ["email"] },
                  ])
                }
              >
                <Plus className="w-3 h-3 mr-1" />
                Adicionar
              </Button>
            </div>

            {reminders.map((reminder, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 border rounded-lg bg-muted/20"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={reminder.minutes_before.toString()}
                      onValueChange={(value) => {
                        const newReminders = [...reminders];
                        newReminders[index].minutes_before = parseInt(value);
                        setReminders(newReminders);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutos antes</SelectItem>
                        <SelectItem value="60">1 hora antes</SelectItem>
                        <SelectItem value="120">2 horas antes</SelectItem>
                        <SelectItem value="1440">24 horas antes</SelectItem>
                        <SelectItem value="2880">48 horas antes</SelectItem>
                      </SelectContent>
                    </Select>
                    {reminders.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setReminders(reminders.filter((_, i) => i !== index))
                        }
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={reminder.channels.includes("email")}
                        onCheckedChange={(checked) => {
                          const newReminders = [...reminders];
                          if (checked) {
                            newReminders[index].channels.push("email");
                          } else {
                            newReminders[index].channels = newReminders[
                              index
                            ].channels.filter((c) => c !== "email");
                          }
                          setReminders(newReminders);
                        }}
                      />
                      Email
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={reminder.channels.includes("whatsapp")}
                        onCheckedChange={(checked) => {
                          const newReminders = [...reminders];
                          if (checked) {
                            newReminders[index].channels.push("whatsapp");
                          } else {
                            newReminders[index].channels = newReminders[
                              index
                            ].channels.filter((c) => c !== "whatsapp");
                          }
                          setReminders(newReminders);
                        }}
                      />
                      WhatsApp
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={reminder.channels.includes("sms")}
                        onCheckedChange={(checked) => {
                          const newReminders = [...reminders];
                          if (checked) {
                            newReminders[index].channels.push("sms");
                          } else {
                            newReminders[index].channels = newReminders[
                              index
                            ].channels.filter((c) => c !== "sms");
                          }
                          setReminders(newReminders);
                        }}
                      />
                      SMS
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Marcar Reunião"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
