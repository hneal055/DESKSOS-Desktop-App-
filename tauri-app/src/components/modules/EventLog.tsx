import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface EventEntry {
  time: string;
  id: number;
  level: string;
  source: string;
  message: string;
}

type TimeRange = 1 | 6 | 24 | 168;
type LogFilter = "All" | "System" | "Application";

export default function EventLog() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hours, setHours] = useState<TimeRange>(24);
  const [logFilter, setLogFilter] = useState<LogFilter>("All");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setLoaded(false);
    setError(null);
    setExpanded(null);

    const logName =
      logFilter === "All" ? "'System','Application'" : `'${logFilter}'`;

    const cmd =
      `$r=@(Get-WinEvent -FilterHashtable @{LogName=${logName};Level=1,2;` +
      `StartTime=(Get-Date).AddHours(-${hours})} -MaxEvents 100 -EA SilentlyContinue | ` +
      `Select-Object @{n='time';e={$_.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss')}},` +
      `@{n='id';e={$_.Id}},` +
      `@{n='level';e={$_.LevelDisplayName}},` +
      `@{n='source';e={$_.ProviderName}},` +
      `@{n='message';e={($_.Message -replace '[\\r\\n]+',' ')}}); ` +
      `ConvertTo-Json -InputObject $r -Compress`;

    try {
      const result = await invoke<string>("run_custom_powershell", {
        command: cmd,
      });

      const trimmed = result.trim();
      if (!trimmed || trimmed === "null") {
        setEvents([]);
      } else {
        const parsed = JSON.parse(trimmed);
        setEvents(Array.isArray(parsed) ? parsed : [parsed]);
      }
    } catch (err) {
      setError(`Failed to read event log: ${err}`);
      setEvents([]);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  const criticalCount = events.filter((e) => e.level === "Critical").length;
  const errorCount = events.filter((e) => e.level === "Error").length;

  const timeLabel = (h: TimeRange) => {
    if (h === 168) return "7d";
    return `${h}h`;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-gray-800 rounded-lg p-4 flex flex-wrap gap-3 items-center">
        {/* Time range */}
        <div className="flex gap-1">
          {([1, 6, 24, 168] as TimeRange[]).map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                hours === h
                  ? "bg-blue-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {timeLabel(h)}
            </button>
          ))}
        </div>

        {/* Log filter */}
        <div className="flex gap-1">
          {(["All", "System", "Application"] as LogFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setLogFilter(f)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition ${
                logFilter === f
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={loadEvents}
          disabled={loading}
          className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
        >
          {loading ? "⏳ Loading..." : "🔍 Load Events"}
        </button>
      </div>

      {/* Summary bar */}
      {loaded && !error && (
        <div className="flex flex-wrap gap-3">
          <div className="bg-red-900/40 border border-red-800 rounded-lg px-4 py-2 text-red-400 font-semibold">
            🔴 {criticalCount} Critical
          </div>
          <div className="bg-orange-900/40 border border-orange-800 rounded-lg px-4 py-2 text-orange-400 font-semibold">
            🟠 {errorCount} Error{errorCount !== 1 ? "s" : ""}
          </div>
          <div className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-gray-400 text-sm">
            Last {hours === 168 ? "7 days" : `${hours}h`} &middot; {logFilter}{" "}
            log{logFilter === "All" ? "s" : ""}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400">
          ❌ {error}
        </div>
      )}

      {/* Empty state */}
      {loaded && !error && events.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-10 text-center text-gray-400">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-lg font-medium text-gray-300">All clear</div>
          <div className="text-sm mt-1">
            No critical errors or warnings in the last{" "}
            {hours === 168 ? "7 days" : `${hours} hours`}
          </div>
        </div>
      )}

      {/* Event list */}
      {events.length > 0 && (
        <div className="space-y-2">
          {events.map((event, i) => {
            const isCritical = event.level === "Critical";
            const isOpen = expanded === i;

            return (
              <div
                key={i}
                onClick={() => setExpanded(isOpen ? null : i)}
                className={`rounded-lg border cursor-pointer transition-colors ${
                  isCritical
                    ? "bg-red-950/40 border-red-800 hover:border-red-600"
                    : "bg-orange-950/30 border-orange-900 hover:border-orange-700"
                }`}
              >
                <div className="p-3 flex items-start gap-3">
                  <span className="text-base mt-0.5">
                    {isCritical ? "🔴" : "🟠"}
                  </span>
                  <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-gray-400 text-xs font-mono">
                        {event.time}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-200">
                        {event.source}
                      </span>
                      <span className="text-xs text-gray-500">
                        ID: {event.id}
                      </span>
                      <span
                        className={`text-xs font-semibold ml-auto ${isCritical ? "text-red-400" : "text-orange-400"}`}
                      >
                        {event.level}
                      </span>
                    </div>

                    {/* Message preview */}
                    {!isOpen && (
                      <div className="text-gray-300 text-sm truncate">
                        {event.message}
                      </div>
                    )}

                    {/* Expanded message */}
                    {isOpen && (
                      <div className="mt-2 bg-gray-900 rounded p-3 text-gray-300 text-sm break-words whitespace-pre-wrap">
                        {event.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
