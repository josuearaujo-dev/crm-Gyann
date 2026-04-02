import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface ReminderPayload {
  lead_name: string;
  lead_phone: string;
  lead_email: string;
  meeting_date: string;
  channel: string;
  meeting_id: string;
  reminder_id: string;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Validar token (você pode adicionar um secret aqui)
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Buscar reuniões futuras com lembretes pendentes
    const now = new Date();
    const { data: reminders, error: remindersError } = await supabase
      .from("meeting_reminders")
      .select(`
        id,
        meeting_id,
        minutes_before,
        channel,
        meetings!inner (
          id,
          scheduled_at,
          meeting_type,
          meeting_link,
          leads!inner (
            id,
            name,
            email,
            phone
          )
        )
      `)
      .eq("sent", false);

    if (remindersError) {
      console.error("[v0] Erro ao buscar lembretes:", remindersError);
      return NextResponse.json(
        { error: "Database error", details: remindersError },
        { status: 500 }
      );
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({
        message: "Nenhum lembrete pendente",
        processed: 0,
      });
    }

    const remindersSent = [];
    const errors = [];

    // Processar cada lembrete
    for (const reminder of reminders) {
      const meeting = reminder.meetings as any;
      const scheduledAt = new Date(meeting.scheduled_at);
      const reminderTime = new Date(
        scheduledAt.getTime() - reminder.minutes_before * 60 * 1000
      );

      // Verificar se já é hora de enviar o lembrete
      if (now >= reminderTime) {
        try {
          // Preparar payload para n8n
          const payload: ReminderPayload = {
            lead_name: meeting.leads.name,
            lead_phone: meeting.leads.phone || "",
            lead_email: meeting.leads.email || "",
            meeting_date: scheduledAt.toISOString(),
            channel: reminder.channel,
            meeting_id: meeting.id,
            reminder_id: reminder.id,
          };

          // Enviar para n8n webhook
          const webhookUrl = process.env.N8N_REMINDER_WEBHOOK_URL;
          
          if (!webhookUrl) {
            console.error("[v0] N8N_REMINDER_WEBHOOK_URL não configurado");
            errors.push({
              reminder_id: reminder.id,
              error: "Webhook URL não configurado",
            });
            continue;
          }

          const webhookResponse = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          const responseData = await webhookResponse.json();

          // Marcar lembrete como enviado
          const { error: updateError } = await supabase
            .from("meeting_reminders")
            .update({
              sent: true,
              sent_at: now.toISOString(),
              webhook_response: responseData,
            })
            .eq("id", reminder.id);

          if (updateError) {
            console.error("[v0] Erro ao atualizar lembrete:", updateError);
            errors.push({
              reminder_id: reminder.id,
              error: updateError.message,
            });
          } else {
            remindersSent.push({
              reminder_id: reminder.id,
              meeting_id: meeting.id,
              lead_name: meeting.leads.name,
              channel: reminder.channel,
            });
          }
        } catch (error) {
          console.error("[v0] Erro ao processar lembrete:", error);
          errors.push({
            reminder_id: reminder.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    return NextResponse.json({
      message: "Lembretes processados",
      processed: remindersSent.length,
      reminders_sent: remindersSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[v0] Erro no processamento de lembretes:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
