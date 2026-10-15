import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { api } from "../lib/api";
import { pickEvidenceFile } from "../lib/dialog";
import { confidenceLabel, presetFromExtraction } from "../lib/extraction";
import type { Extraction, GearInput, OllamaStatus } from "../types";
import { Icon } from "./Icon";

interface ExtractDialogProps {
  gearId: string | null;
  onClose: () => void;
  onApply: (preset: Partial<GearInput>) => void;
}

type Phase = "checking" | "ready" | "reading" | "done" | "error";

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function ExtractDialog({ gearId, onClose, onApply }: ExtractDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [result, setResult] = useState<Extraction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const checkModel = useCallback(async () => {
    setPhase("checking");
    setError(null);
    try {
      setStatus(await api.ollamaStatus());
      setPhase("ready");
    } catch (caught) {
      setError(messageOf(caught));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void checkModel();
  }, [checkModel]);

  const chooseAndRead = useCallback(async () => {
    setError(null);
    try {
      const source = await pickEvidenceFile("Choose a receipt to read");
      if (!source) return;
      setPhase("reading");
      setResult(await api.extractReceipt(source, gearId));
      setPhase("done");
    } catch (caught) {
      setError(messageOf(caught));
      setPhase("error");
    }
  }, [gearId]);

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current && phase !== "reading") onClose();
  };

  const ready = phase === "ready" && status?.available === true && status.modelPresent;
  const modelName = status?.model ?? "qwen2.5vl:7b";

  return (
    <dialog
      ref={dialogRef}
      className="sheet sheet--form"
      aria-labelledby="extract-title"
      onCancel={(event) => {
        event.preventDefault();
        if (phase !== "reading") onClose();
      }}
      onClick={onBackdropClick}
    >
      <div className="sheet__head">
        <div>
          <h2 id="extract-title" className="sheet__title">
            Read a receipt
          </h2>
          <p className="sheet__subtitle">Runs on this device. Nothing is uploaded.</p>
        </div>
        <button
          type="button"
          className="sheet__close"
          onClick={onClose}
          aria-label="Close"
          disabled={phase === "reading"}
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="form__body">
        {phase === "checking" ? <p className="muted">Checking for the local model…</p> : null}

        {status && phase !== "checking" ? (
          <div className={`model__banner${ready ? " model__banner--ok" : ""}`}>
            <div className="model__row">
              <Icon name={ready ? "shield" : "alert"} size={16} />
              <span>{status.message}</span>
            </div>
            <div className="model__meta">
              <span className="mono">{modelName}</span>
              {status.version ? <span>Ollama {status.version}</span> : null}
              <button type="button" className="btn btn--small btn--quiet" onClick={() => void checkModel()}>
                Check again
              </button>
            </div>
            {!ready ? (
              <div className="model__setup">
                <p className="muted">
                  Install Ollama from ollama.com, start it, then run this once in a terminal:
                </p>
                <code className="model__command">ollama pull {modelName}</code>
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === "error" ? (
          <p className="form__error">{error}</p>
        ) : null}

        {phase === "reading" ? (
          <p className="muted">Reading the receipt on this device…</p>
        ) : null}

        {ready && phase !== "done" ? (
          <button type="button" className="btn btn--primary" onClick={() => void chooseAndRead()}>
            <Icon name="receipt" size={15} />
            Choose a receipt file
          </button>
        ) : null}

        {phase === "done" && result ? (
          <>
            <p className="muted">
              {result.fields.length > 0
                ? "The model read these fields. Check each one before it is saved."
                : "The model could not read any fields from this file."}
            </p>

            {result.fields.length > 0 ? (
              <ul className="suggestions">
                {result.fields.map((field) => (
                  <li key={field.key} className="suggestion">
                    <div className="suggestion__top">
                      <span className="suggestion__label">{field.label}</span>
                      <span className="suggestion__confidence">{confidenceLabel(field.confidence)}</span>
                    </div>
                    <p className="suggestion__value">{field.value}</p>
                    <div
                      className="suggestion__bar"
                      role="img"
                      aria-label={`Confidence ${Math.round(field.confidence * 100)} percent`}
                    >
                      <span style={{ width: `${Math.round(field.confidence * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {result.warnings.length > 0 ? (
              <ul className="warnings">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            <p className="muted">
              Warranty dates are never filled in automatically. Attach the file in the Evidence panel if you
              want to keep a copy.
            </p>

            <div className="form__actions">
              <button type="button" className="btn" onClick={() => void chooseAndRead()}>
                Choose another
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onApply(presetFromExtraction(result))}
                disabled={result.fields.length === 0}
              >
                Review in editor
              </button>
            </div>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
