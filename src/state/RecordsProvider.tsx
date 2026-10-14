import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api, runningInTauri } from "../lib/api";
import { pickEvidenceFile, pickFolder } from "../lib/dialog";
import type {
  DataStatus,
  Evidence,
  EvidenceKind,
  Gear,
  GearInput,
  TimelineEvent,
  TimelineEventInput,
} from "../types";

export interface Notice {
  tone: "success" | "error";
  message: string;
}

interface RecordsValue {
  gears: Gear[];
  selectedId: string | null;
  selected: Gear | null;
  evidence: Evidence[];
  timeline: TimelineEvent[];
  status: DataStatus | null;
  loading: boolean;
  detailLoading: boolean;
  busy: string | null;
  error: string | null;
  notice: Notice | null;
  runningInTauri: boolean;
  select: (id: string) => void;
  refresh: () => Promise<void>;
  createGear: (input: GearInput) => Promise<boolean>;
  updateGear: (id: string, input: GearInput) => Promise<boolean>;
  deleteGear: (id: string) => Promise<boolean>;
  attachEvidence: (kind: EvidenceKind) => Promise<boolean>;
  removeEvidence: (id: string) => Promise<boolean>;
  addEvent: (input: TimelineEventInput) => Promise<boolean>;
  removeEvent: (id: string) => Promise<boolean>;
  backup: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  dismissNotice: () => void;
  clearError: () => void;
}

const RecordsContext = createContext<RecordsValue | null>(null);

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function RecordsProvider({ children }: { children: ReactNode }) {
  const [gears, setGears] = useState<Gear[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const selected = useMemo(
    () => gears.find((gear) => gear.id === selectedId) ?? null,
    [gears, selectedId],
  );

  const loadList = useCallback(async () => {
    const [list, counts] = await Promise.all([api.listGear(), api.recordsStatus()]);
    setGears(list);
    setStatus(counts);
    setSelectedId((current) =>
      current && list.some((gear) => gear.id === current) ? current : list[0]?.id ?? null,
    );
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await loadList();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, [loadList]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        await loadList();
      } catch (caught) {
        if (active) setError(messageOf(caught));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setEvidence([]);
      setTimeline([]);
      return;
    }
    let active = true;
    (async () => {
      setDetailLoading(true);
      try {
        const [items, events] = await Promise.all([
          api.listEvidence(selectedId),
          api.listTimeline(selectedId),
        ]);
        if (active) {
          setEvidence(items);
          setTimeline(events);
        }
      } catch (caught) {
        if (active) setError(messageOf(caught));
      } finally {
        if (active) setDetailLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedId]);

  const action = useCallback(async (label: string, task: () => Promise<string | void>): Promise<boolean> => {
    setBusy(label);
    try {
      const message = await task();
      if (typeof message === "string" && message) setNotice({ tone: "success", message });
      return true;
    } catch (caught) {
      setNotice({ tone: "error", message: messageOf(caught) });
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  const syncStatus = useCallback(async () => {
    setStatus(await api.recordsStatus());
  }, []);

  const createGear = useCallback(
    (input: GearInput) =>
      action("Saving gear", async () => {
        const gear = await api.createGear(input);
        await loadList();
        setSelectedId(gear.id);
        return "Gear record created.";
      }),
    [action, loadList],
  );

  const updateGear = useCallback(
    (id: string, input: GearInput) =>
      action("Saving changes", async () => {
        await api.updateGear(id, input);
        await loadList();
        return "Changes saved.";
      }),
    [action, loadList],
  );

  const deleteGear = useCallback(
    (id: string) =>
      action("Deleting gear", async () => {
        await api.deleteGear(id);
        await loadList();
        return "Gear record deleted.";
      }),
    [action, loadList],
  );

  const attachEvidence = useCallback(
    (kind: EvidenceKind) =>
      action("Attaching file", async () => {
        if (!selectedId) throw new Error("Select a gear record first.");
        const source = await pickEvidenceFile();
        if (!source) return;
        const item = await api.importEvidence(selectedId, source, kind);
        setEvidence((current) => [item, ...current]);
        await syncStatus();
        return `${item.originalName} attached.`;
      }),
    [action, selectedId, syncStatus],
  );

  const removeEvidence = useCallback(
    (id: string) =>
      action("Removing attachment", async () => {
        await api.deleteEvidence(id);
        setEvidence((current) => current.filter((item) => item.id !== id));
        await syncStatus();
        return "Attachment removed.";
      }),
    [action, syncStatus],
  );

  const addEvent = useCallback(
    (input: TimelineEventInput) =>
      action("Adding event", async () => {
        if (!selectedId) throw new Error("Select a gear record first.");
        const event = await api.createTimelineEvent(selectedId, input);
        setTimeline((current) =>
          [...current, event].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn)),
        );
        return "Event added.";
      }),
    [action, selectedId],
  );

  const removeEvent = useCallback(
    (id: string) =>
      action("Removing event", async () => {
        await api.deleteTimelineEvent(id);
        setTimeline((current) => current.filter((item) => item.id !== id));
        return "Event removed.";
      }),
    [action],
  );

  const backup = useCallback(
    () =>
      action("Backing up", async () => {
        const dir = await pickFolder("Choose a folder for the backup");
        if (!dir) return;
        const info = await api.backupRecords(dir);
        await syncStatus();
        return `Backup saved to ${info.path}`;
      }),
    [action, syncStatus],
  );

  const restore = useCallback(
    () =>
      action("Restoring backup", async () => {
        const dir = await pickFolder("Choose a ShutterProof backup folder");
        if (!dir) return;
        await api.restoreRecords(dir);
        await loadList();
        return "Backup restored.";
      }),
    [action, loadList],
  );

  const dismissNotice = useCallback(() => setNotice(null), []);
  const clearError = useCallback(() => setError(null), []);

  const value: RecordsValue = {
    gears,
    selectedId,
    selected,
    evidence,
    timeline,
    status,
    loading,
    detailLoading,
    busy,
    error,
    notice,
    runningInTauri,
    select: setSelectedId,
    refresh,
    createGear,
    updateGear,
    deleteGear,
    attachEvidence,
    removeEvidence,
    addEvent,
    removeEvent,
    backup,
    restore,
    dismissNotice,
    clearError,
  };

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useRecords(): RecordsValue {
  const value = useContext(RecordsContext);
  if (!value) throw new Error("useRecords must be used inside a RecordsProvider");
  return value;
}
