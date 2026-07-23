import { createClient } from "@/lib/supabase/server";
import { HomeContent } from "@/components/crm/home-content";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Buscar tasks do dia (scheduled_at entre 00:00 e 23:59 do dia atual)
  // E também tasks com status scheduled ou overdue
  const { data: todayTasks } = await supabase
    .from("tasks")
    .select("*, leads(name, email)")
    .or(`and(scheduled_at.gte.${today.toISOString()},scheduled_at.lt.${tomorrow.toISOString()}),and(due_date.gte.${today.toISOString()},due_date.lt.${tomorrow.toISOString()})`)
    .in("status", ["scheduled", "overdue", "pending"])
    .eq("assigned_to", user?.id)
    .order("scheduled_at", { ascending: true, nullsLast: true });

  // Buscar reuniões do dia
  const { data: todayMeetings } = await supabase
    .from("meetings")
    .select("*, leads(name, email, company)")
    .gte("scheduled_at", today.toISOString())
    .lt("scheduled_at", tomorrow.toISOString())
    .eq("status", "scheduled")
    .order("scheduled_at", { ascending: true });

  const { data: recentLeads } = await supabase
    .from("leads")
    .select("*, lead_sources(name), pipeline_columns(name)")
    .eq("excluded_from_reports", false)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: leadStats } = await supabase
    .from("leads")
    .select("id, created_at, deal_value, column_id, is_lost, excluded_from_reports");

  const { data: pipelineColumns } = await supabase
    .from("pipeline_columns")
    .select("id, name, color, position, created_by, created_at, updated_at")
    .order("position", { ascending: true });

  const { data: tags } = await supabase.from("tags").select("*");

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .order("start_date", { ascending: false });

  const { data: taskStats } = await supabase
    .from("tasks")
    .select("id, completed")
    .eq("assigned_to", user?.id);

  // Buscar valores potenciais e realizados
  const { data: potentialValue } = await supabase
    .from("potential_value")
    .select("*")
    .single();

  const { data: realizedValue } = await supabase
    .from("realized_value")
    .select("*")
    .single();

  return (
    <HomeContent
      profile={profile}
      todayTasks={todayTasks || []}
      todayMeetings={todayMeetings || []}
      recentLeads={recentLeads || []}
      leadStats={leadStats || []}
      pipelineColumns={pipelineColumns || []}
      tags={tags || []}
      campaigns={campaigns || []}
      taskStats={taskStats || []}
      potentialValue={potentialValue?.total_potential || 0}
      realizedValue={realizedValue?.total_realized || 0}
    />
  );
}
