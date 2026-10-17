import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ExtractDialog } from "./components/ExtractDialog";
import { GearEditor } from "./components/GearEditor";
import { GearPassport } from "./components/GearPassport";
import { Icon } from "./components/Icon";
import { LocalDataPanel } from "./components/LocalDataPanel";
import { Toast } from "./components/Toast";
import { fetchAppInfo } from "./lib/tauri";
import type { AppInfo, Gear, GearInput } from "./types";
import { RecordsProvider, useRecords } from "./state/RecordsProvider";
import type { ActionResult } from "./state/RecordsProvider";

export function App() {
  return (
    <RecordsProvider>
      <Workspace />
    </RecordsProvider>
  );
}

type Confirm = "delete" | "restore" | null;

function LoadingState() {
  return (
    <div className="state">
      <p className="state__title">Loading your records…</p>
      <p className="state__note">Reading the local database on this device.</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state state--error">
      <Icon name="alert" size={20} />
      <p className="state__title">Could not load your records</p>
      <p className="state__note">{message}</p>
      <button type="button" className="btn btn--small" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="state">
      <Icon name="package" size={22} />
      <p className="state__title">No gear records yet</p>
      <p className="state__note">
        Add your first camera, lens, or flash to start its passport. Everything stays on this device.
      </p>
      <button type="button" className="btn btn--primary" onClick={onAdd}>
        Add your first gear
      </button>
    </div>
  );
}

function Workspace() {
  const records = useRecords();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [editor, setEditor] = useState<Gear | "new" | null>(null);
  const [editorPreset, setEditorPreset] = useState<Partial<GearInput> | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [showData, setShowData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const openEditor = (target: Gear | "new", preset: Partial<GearInput> | null = null) => {
    setEditorPreset(preset);
    setEditor(target);
  };

  useEffect(() => {
    let cancelled = false;
    fetchAppInfo().then((value) => {
      if (!cancelled) setInfo(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const closeEditor = () => {
    setEditor(null);
    setEditorPreset(null);
  };

  const openData = () => {
    setDataError(null);
    setShowData(true);
  };

  const closeData = () => {
    setDataError(null);
    setShowData(false);
  };

  const recordResult = (result: ActionResult) => {
    setDataError(result.ok ? null : result.error);
  };

  const submitEditor = async (input: GearInput): Promise<string | null> => {
    if (!editor) return null;
    const result =
      editor === "new"
        ? await records.createGear(input)
        : await records.updateGear(editor.id, input);
    if (result.ok) {
      closeEditor();
      return null;
    }
    return result.error ?? "Something went wrong. Please try again.";
  };

  const count = records.gears.length;
  const hint = records.loading
    ? "Loading records…"
    : `${count} record${count === 1 ? "" : "s"} on this device`;

  let body;
  if (records.loading) {
    body = <LoadingState />;
  } else if (records.error) {
    body = <ErrorState message={records.error} onRetry={records.refresh} />;
  } else if (!records.selected) {
    body = <EmptyState onAdd={() => openEditor("new")} />;
  } else {
    body = (
      <GearPassport
        gear={records.selected}
        evidence={records.evidence}
        events={records.timeline}
        busy={Boolean(records.busy)}
        detailLoading={records.detailLoading}
        onEdit={() => records.selected && openEditor(records.selected)}
        onDelete={() => setConfirm("delete")}
        onAttach={records.attachEvidence}
        onRemoveEvidence={records.removeEvidence}
        onAddEvent={records.addEvent}
        onRemoveEvent={records.removeEvent}
      />
    );
  }

  return (
    <>
      <AppShell
        gears={records.gears}
        selectedId={records.selectedId}
        onSelect={records.select}
        info={info}
        runtime={records.runningInTauri ? "Stored on this device" : "Browser preview"}
        hint={hint}
        actions={
          <>
            <button type="button" className="btn btn--small" onClick={openData}>
              <Icon name="lock" size={15} />
              Local data
            </button>
            <button type="button" className="btn btn--small" onClick={() => setReading(true)}>
              <Icon name="receipt" size={15} />
              Read a receipt
            </button>
            <button type="button" className="btn btn--small btn--primary" onClick={() => openEditor("new")}>
              <Icon name="package" size={15} />
              Add gear
            </button>
          </>
        }
      >
        {body}
      </AppShell>

      {editor ? (
        <GearEditor
          gear={editor === "new" ? null : editor}
          preset={editorPreset}
          busy={Boolean(records.busy)}
          onClose={closeEditor}
          onSubmit={submitEditor}
        />
      ) : null}

      {reading ? (
        <ExtractDialog
          gearId={records.selected?.id ?? null}
          onClose={() => setReading(false)}
          onApply={(preset) => {
            openEditor(records.selected ?? "new", preset);
            setReading(false);
          }}
        />
      ) : null}

      {confirm === "delete" ? (
        <ConfirmDialog
          title="Delete this record?"
          message={`${records.selected?.name ?? "This gear"} and its attached files will be removed from this device.`}
          confirmLabel="Delete record"
          tone="danger"
          busy={Boolean(records.busy)}
          onConfirm={() => {
            const id = records.selected?.id;
            if (id) records.deleteGear(id).then(() => setConfirm(null));
          }}
          onCancel={() => setConfirm(null)}
        />
      ) : null}

      {confirm === "restore" ? (
        <ConfirmDialog
          title="Restore a backup?"
          message="Your current records and attached files will be replaced by the backup folder you choose next."
          confirmLabel="Choose folder and restore"
          busy={Boolean(records.busy)}
          onConfirm={() =>
            records.restore().then((result) => {
              recordResult(result);
              setConfirm(null);
            })
          }
          onCancel={() => setConfirm(null)}
        />
      ) : null}

      {showData ? (
        <LocalDataPanel
          status={records.status}
          runningInTauri={records.runningInTauri}
          busy={Boolean(records.busy)}
          error={dataError}
          onBackup={() => void records.backup().then(recordResult)}
          onRestore={() => setConfirm("restore")}
          onClose={closeData}
        />
      ) : null}

      {records.notice ? <Toast notice={records.notice} onDismiss={records.dismissNotice} /> : null}
    </>
  );
}
