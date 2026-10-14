import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { GearPassport } from "./components/GearPassport";
import { evidenceFor, gears, sampleGearId, timelineFor } from "./data/sample";
import { fetchAppInfo, isTauri } from "./lib/tauri";
import type { AppInfo } from "./types";

export function App() {
  const [selectedId, setSelectedId] = useState(sampleGearId);
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAppInfo().then((value) => {
      if (!cancelled) setInfo(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = gears.find((gear) => gear.id === selectedId) ?? gears[0];

  return (
    <AppShell
      gears={gears}
      selectedId={selected.id}
      onSelect={setSelectedId}
      info={info}
      runtime={isTauri() ? "Runs on this device" : "Browser preview"}
    >
      <GearPassport
        gear={selected}
        evidence={evidenceFor(selected.id)}
        events={timelineFor(selected.id)}
      />
    </AppShell>
  );
}
