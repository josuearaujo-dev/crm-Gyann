import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { isOverdueNextDayInAppTimezone } from "@/lib/timezone";

export async function POST() {
  try {
    const supabase = await createClient();
    
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: scheduledTasks, error: fetchError } = await supabase
      .from("tasks")
      .select("id, scheduled_at, due_date")
      .eq("status", "scheduled");

    if (fetchError) {
      console.error("Error fetching scheduled tasks:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const overdueIds =
      (scheduledTasks || [])
        .filter((task) =>
          isOverdueNextDayInAppTimezone(task.scheduled_at || task.due_date, now)
        )
        .map((task) => task.id);

    if (overdueIds.length === 0) {
      return NextResponse.json({ success: true, updated_at: nowIso, updated_count: 0 });
    }

    const { error } = await supabase
      .from("tasks")
      .update({ status: "overdue" })
      .in("id", overdueIds);

    if (error) {
      console.error("Error updating overdue tasks:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated_at: nowIso, updated_count: overdueIds.length });
  } catch (error) {
    console.error("Error in update-overdue:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Permitir chamada GET também (para cron jobs)
export async function GET() {
  return POST();
}
