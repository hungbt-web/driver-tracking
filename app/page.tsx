"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import scrollGridPlugin from "@fullcalendar/scrollgrid";
import {
  Backdrop,
  Box,
  CircularProgress,
  Container,
  Paper,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import VirtualizedSelect from "./components/VirtualizedSelect";
import { useSiteData } from "./site-data-context";

const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false,
});

type EtapeEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps: {
    accountId: number;
    missionId: number;
    etapeId: number;
    etapeType: string;
    address: string;
    hasMissingTime: boolean;
  };
};

function normalizeDateTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Accept common DB-like values such as:
  // "2025-12-28 17:21:00.000 +0700" -> "2025-12-28T17:21:00.000+07:00"
  const dbLike = trimmed.match(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?) ([+-]\d{2})(\d{2})$/
  );
  const normalizedInput = dbLike
    ? `${dbLike[1]}T${dbLike[2]}${dbLike[3]}:${dbLike[4]}`
    : trimmed;

  const parsed = new Date(normalizedInput);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return normalizedInput;
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

export default function Home() {
  const { allEtapes, allAccounts, isApiSettled } = useSiteData();
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [currentView, setCurrentView] = useState("accountTimeline");
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);
  const [popoverText, setPopoverText] = useState("");

  const accountOptions = useMemo<
    Array<{ value: string; label: string }>
  >(() => {
    const ids = new Set<string>();
    for (const row of allEtapes) {
      if (row.accountid !== null && row.accountid !== undefined) {
        ids.add(String(row.accountid));
      }
    }
    const accountNameById = new Map<string, string>();
    for (const account of allAccounts) {
      const id = String(account.id);
      const fullName = `${normalizeText(account.prenom)} ${normalizeText(
        account.nom
      )}`.trim();
      const fallbackIdentity =
        normalizeText(account.email) ||
        normalizeText(account.username) ||
        normalizeText(account.nconducteur) ||
        "";
      const displayName = fullName || fallbackIdentity;
      if (displayName) {
        accountNameById.set(id, displayName);
      }
    }
    return Array.from(ids)
      .sort((a, b) => Number(a) - Number(b))
      .map((id) => ({
        value: id,
        label: accountNameById.has(id)
          ? `${id} - ${accountNameById.get(id)}`
          : id,
      }));
  }, [allEtapes, allAccounts]);

  const effectiveAccountId =
    selectedAccountId || accountOptions[0]?.value || "";

  const events = useMemo<EtapeEvent[]>(() => {
    if (!effectiveAccountId) return [];
    const accountId = Number(effectiveAccountId);

    const rawEvents: Array<EtapeEvent | null> = allEtapes
      .filter((e) => e.accountid === accountId)
      .map((e): EtapeEvent | null => {
        const startTime = normalizeDateTime(e.heuredebutreelle);
        const endTime = normalizeDateTime(e.heurefinreelle);
        const fallbackDate = normalizeDateTime(e.date);
        const fallbackStart = startTime ?? endTime ?? fallbackDate;
        if (!fallbackStart) return null;

        const hasCompleteTime = Boolean(startTime && endTime);
        return {
          id: `etape-${e.id}`,
          title: `${e.nomtypedetape ?? "Etape"} - Mission ${e.missionid}`,
          start: fallbackStart,
          end: endTime,
          ...(hasCompleteTime
            ? {}
            : {
                backgroundColor: "#ed6c02",
                borderColor: "#e65100",
                textColor: "#ffffff",
              }),
          extendedProps: {
            accountId: e.accountid,
            missionId: e.missionid,
            etapeId: e.id,
            etapeType: e.nomtypedetape ?? "Etape",
            address: e.adresse ?? "",
            hasMissingTime: !hasCompleteTime,
          },
        };
      });

    const baseEvents: EtapeEvent[] = rawEvents.filter(
      (event): event is EtapeEvent => event !== null
    );

    // Highlight overlapping events for quick conflict detection.
    const timed = baseEvents
      .filter((event) => Boolean(event.start && event.end))
      .map((event) => ({
        event,
        startMs: new Date(event.start).getTime(),
        endMs: new Date(event.end ?? event.start).getTime(),
      }))
      .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

    const conflictedIds = new Set<string>();
    const active: Array<{
      id: string;
      endMs: number;
    }> = [];

    for (const current of timed) {
      let i = active.length - 1;
      while (i >= 0) {
        if (active[i].endMs <= current.startMs) {
          active.splice(i, 1);
        }
        i -= 1;
      }

      if (active.length > 0) {
        conflictedIds.add(current.event.id);
        for (const item of active) {
          conflictedIds.add(item.id);
        }
      }

      active.push({ id: current.event.id, endMs: current.endMs });
    }

    return baseEvents.map((event) => {
      if (conflictedIds.has(event.id)) {
        return {
          ...event,
          backgroundColor: "#d32f2f",
          borderColor: "#b71c1c",
          textColor: "#ffffff",
        };
      }
      if (event.extendedProps.hasMissingTime || !event.start || !event.end) {
        return {
          ...event,
          backgroundColor: "#ed6c02",
          borderColor: "#e65100",
          textColor: "#ffffff",
        };
      }
      return event;
    });
  }, [allEtapes, effectiveAccountId]);

  const timelineRange = useMemo(() => {
    if (events.length === 0) {
      return null;
    }
    const starts = events.map((event) => new Date(event.start).getTime());
    const ends = events.map((event) =>
      event.end
        ? new Date(event.end).getTime()
        : new Date(event.start).getTime()
    );
    const minStart = Math.min(...starts);
    const maxEnd = Math.max(...ends);
    // FullCalendar visibleRange end is exclusive, so include next day.
    const endExclusive = new Date(maxEnd + 24 * 60 * 60 * 1000);
    return {
      start: new Date(minStart).toISOString(),
      end: endExclusive.toISOString(),
    };
  }, [events]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50", py: 4 }}>
      <Backdrop
        open={!isApiSettled}
        sx={{ zIndex: (theme) => theme.zIndex.modal + 1, color: "#fff" }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <CircularProgress color="inherit" size={24} />
          <Typography variant="body2">Loading data...</Typography>
        </Stack>
      </Backdrop>
      <Container maxWidth="xl">
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#333333" }}>
            Driver Etape Schedule
          </Typography>
          <VirtualizedSelect
            label="Driver ID"
            options={accountOptions}
            value={effectiveAccountId}
            onChange={setSelectedAccountId}
            width={280}
          />
        </Stack>

        <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ mb: 2, flexWrap: "wrap", alignItems: "center" }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: "3px",
                  bgcolor: "#ed6c02",
                  border: "1px solid #e65100",
                }}
              />
              <Typography variant="body2" color="text.secondary">
                Warning: Missing start/end time
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: "3px",
                  bgcolor: "#d32f2f",
                  border: "1px solid #b71c1c",
                }}
              />
              <Typography variant="body2" color="text.secondary">
                Error: Time conflict with another etape
              </Typography>
            </Stack>
          </Stack>

          <FullCalendar
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              interactionPlugin,
              listPlugin,
              scrollGridPlugin,
            ]}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right:
                "dayGridMonth,timeGridWeek,timeGridDay,listWeek,accountTimeline",
            }}
            views={{
              accountTimeline: {
                type: "timeGrid",
                buttonText: "account timeline",
                dayMinWidth: 100,
                dayHeaderContent: (arg: { date: Date; text: string }) => {
                  const monthDay = arg.date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "2-digit",
                  });
                  const weekDay = arg.date.toLocaleDateString(undefined, {
                    weekday: "short",
                  });
                  return (
                    <div style={{ lineHeight: 1.2 }}>
                      <div>{monthDay}</div>
                      <div>{weekDay}</div>
                    </div>
                  );
                },
              },
            }}
            initialView="accountTimeline"
            schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            editable={false}
            selectable
            dayMaxEvents
            nowIndicator
            height="auto"
            contentHeight="auto"
            events={events}
            visibleRange={
              currentView === "accountTimeline" && timelineRange
                ? {
                    start: timelineRange.start,
                    end: timelineRange.end,
                  }
                : undefined
            }
            datesSet={(arg) => setCurrentView(arg.view.type)}
            eventTimeFormat={{
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }}
            eventDidMount={(info) => {
              const p = info.event.extendedProps as EtapeEvent["extendedProps"];
              const isMissingTime = p.hasMissingTime || !info.event.end;
              if (isMissingTime) {
                info.el.style.backgroundColor = "#ed6c02";
                info.el.style.borderColor = "#e65100";
                info.el.style.color = "#ffffff";
              }
            }}
            eventMouseEnter={(info) => {
              const p = info.event.extendedProps as EtapeEvent["extendedProps"];
              const start = info.event.start;
              const end = info.event.end;
              const startLabel = start ? start.toLocaleString() : "N/A";
              const endLabel = end ? end.toLocaleString() : "N/A";
              const totalHours =
                start && end
                  ? (
                      (end.getTime() - start.getTime()) /
                      (1000 * 60 * 60)
                    ).toFixed(2)
                  : "N/A";
              setPopoverText(
                `Account: ${p.accountId}\nMission: ${p.missionId}\nEtape ID: ${p.etapeId}\nEtape: ${p.etapeType}\nAddress: ${p.address}\nStart: ${startLabel}\nEnd: ${endLabel}\nTotal hours: ${totalHours}`
              );
              setPopoverAnchor(info.el);
            }}
            eventMouseLeave={() => {
              setPopoverAnchor(null);
            }}
          />
          <Popover
            open={Boolean(popoverAnchor)}
            anchorEl={popoverAnchor}
            onClose={() => setPopoverAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            disableRestoreFocus
            sx={{ pointerEvents: "none" }}
            slotProps={{
              paper: {
                sx: {
                  p: 1.5,
                  maxWidth: 360,
                  whiteSpace: "pre-line",
                },
              },
            }}
          >
            <Typography variant="body2">{popoverText}</Typography>
          </Popover>
        </Paper>
      </Container>
    </Box>
  );
}
