import { createClient } from "@/lib/supabase/server";
import { TasksPage } from "@/components/crm/tasks-page";

export default async function TasksListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, leads(name, email, company)")
    .eq("assigned_to", user?.id)
    .order("due_date", { ascending: true, nullsLast: true })
    .order("scheduled_at", { ascending: true, nullsLast: true })
    .order("created_at", { ascending: false });

  return <TasksPage initialTasks={tasks || []} userId={user?.id || ""} />;
}
