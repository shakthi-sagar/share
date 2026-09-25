import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface ActionDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  initialValue?: string;
  inputLabel?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void | Promise<void>;
}

export function ActionDialog({
  title,
  description,
  confirmLabel,
  initialValue = "",
  inputLabel,
  danger = false,
  onClose,
  onConfirm,
}: ActionDialogProps): React.JSX.Element {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  const canSubmit = !inputLabel || value.trim().length > 0;

  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="action-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || busy) return;
          setBusy(true);
          setError(null);
          void Promise.resolve(onConfirm(value.trim())).catch((caught: unknown) => {
            setBusy(false);
            setError(caught instanceof Error ? caught.message : "Unable to complete this action");
          });
        }}
      >
        <div className="dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        {inputLabel ? (
          <label className="field-label" htmlFor={inputId}>
            <span>{inputLabel}</span>
            <input
              ref={inputRef}
              id={inputId}
              value={value}
              disabled={busy}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        ) : null}

        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="dialog-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`button ${danger ? "button-danger" : "button-primary"}`}
            type="submit"
            disabled={!canSubmit || busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
