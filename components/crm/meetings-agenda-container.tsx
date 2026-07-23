"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, List } from "lucide-react";
import { MeetingsCalendarView } from "./meetings-calendar-view";
import { MeetingsTable } from "./meetings-table";
import type { Meeting } from "@/lib/types";

type MeetingWithLead = Meeting & { leads: { name: string; email: string; company: string | null } | null };

interface MeetingsAgendaContainerProps {
  initialMeetings: MeetingWithLead[];
  userId: string;
}

export function MeetingsAgendaContainer({ initialMeetings, userId }: MeetingsAgendaContainerProps) {
  const [activeTab, setActiveTab] = useState("calendar");

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Agenda Reuniões</h1>
        <p className="text-muted-foreground text-sm mt-1">Visualize e gerencie todas as suas reuniões</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4" />
            Calendário Mensal
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-2">
            <List className="w-4 h-4" />
            Todas as Reuniões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-0">
          <MeetingsCalendarView initialMeetings={initialMeetings} userId={userId} />
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <MeetingsTable initialMeetings={initialMeetings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
