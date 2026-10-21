/**
 * What a confirmation dialog should do after its action finishes.
 *
 * A failure has to keep the dialog open with the reason. A toast alone sits
 * behind a modal `<dialog>` and cannot be read, so the caller would otherwise
 * look at a confirmation that silently failed.
 */
export interface ConfirmOutcome {
  /** Close the dialog when the action succeeded. */
  close: boolean;
  /** The message to show inside the dialog when it stays open. */
  error: string | null;
}

const FALLBACK = "Something went wrong. Please try again.";

/** Turns an action result into the next state for the dialog that asked for it. */
export function confirmOutcome(result: { ok: boolean; error: string | null }): ConfirmOutcome {
  if (result.ok) return { close: true, error: null };
  return { close: false, error: result.error ?? FALLBACK };
}
