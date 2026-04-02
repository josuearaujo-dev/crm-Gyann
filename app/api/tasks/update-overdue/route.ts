import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const supabase = await createClient();
    
    const now = new Date().toISOString();

    // Atualizar tasks agendadas que passaram do horário para 'overdue'
    const { error } = await supabase
      .from("tasks")
      .update({ status: "overdue" })
      .eq("status", "scheduled")
      .lt("scheduled_at", now);

    if (error) {
      console.error("Error updating overdue tasks:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated_at: now });
  } catch (error) {
    console.error("Error in update-overdue:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Permitir chamada GET também (para cron jobs)
export async function GET() {
  return POST();
}
