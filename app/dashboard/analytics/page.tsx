import { createClient } from "@/lib/supabase/server";
import { AnalyticsDashboard } from "@/components/crm/analytics-dashboard";
import { USMapDashboard } from "@/components/crm/us-map-dashboard";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from("leads")
    .select("*, lead_sources(name, type), pipeline_columns(name, color), us_states(name, abbreviation)")
    .eq("excluded_from_reports", false)
    .order("created_at", { ascending: false });

  const { data: columns } = await supabase
    .from("pipeline_columns")
    .select("*")
    .order("position", { ascending: true });

  const { data: sources } = await supabase
    .from("lead_sources")
    .select("*");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("assigned_to", user?.id);

  // Aggregate leads by state
  const leadsByState = (leads || []).reduce((acc: any[], lead: any) => {
    if (lead.us_states) {
      const existing = acc.find(
        (item) => item.state_abbreviation === lead.us_states.abbreviation
      );
      if (existing) {
        existing.count++;
      } else {
        acc.push({
          state_abbreviation: lead.us_states.abbreviation,
          state_name: lead.us_states.name,
          count: 1,
        });
      }
    }
    return acc;
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <USMapDashboard leadsByState={leadsByState} />
      </div>
      
      <AnalyticsDashboard
        leads={leads || []}
        columns={columns || []}
        sources={sources || []}
        tasks={tasks || []}
      />
    </div>
  );
}
