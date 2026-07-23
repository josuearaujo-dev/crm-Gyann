"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, List } from "lucide-react";
import { TimelineView } from "./timeline-view";
import { CalendarView } from "./calendar-view";
import { TasksTable } from "./tasks-table";
import type { Task } from "@/lib/types";

interface AgendaContainerProps {
  initialTasks: (Task & { leads: { name: string; email: string; company: string | null } | null })[];
  userId: string;
}

export function AgendaContainer({ initialTasks, userId }: AgendaContainerProps) {
  const [activeTab, setActiveTab] = useState("timeline");

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Agenda Tasks</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie e visualize todas as suas tarefas</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-6">
          <TabsTrigger value="timeline" className="gap-2">
            <Clock className="w-4 h-4" />
            Timeline Diária
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4" />
            Calendário Mensal
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-2">
            <List className="w-4 h-4" />
            Todas as Tasks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-0">
          <TimelineView initialTasks={initialTasks} userId={userId} />
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
          <CalendarView 
            initialTasks={initialTasks}
            initialMeetings={[]}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <TasksTable initialTasks={initialTasks} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
