import type { UnlockedShare } from "@share/client";
import { displayPath, type ManifestFile } from "@share/protocol";
import { useEffect, useRef, useState } from "react";
import { previewKind, safeMediaType } from "./kinds";
import { readShareBlob } from "./share-file-cache";

type Point = { x: number; y: number };
type Note = Point & { id: string; text: string };
export type Notes = Record<string, Note[]>;

export function GalleryReview({
  share,
  files,
  notes,
  onNote,
  onRemove,
  onClose,
}: {
  share: UnlockedShare;
  files: ManifestFile[];
  notes: Notes;
  onNote: (fileId: string, note: Note) => void;
  onRemove: (fileId: string, noteId: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const file = files[index];

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  useEffect(() => {
    if (!playing || files.length < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % files.length),
      4000,
    );
    return () => window.clearInterval(timer);
  }, [playing, files.length]);

  function step(direction: number) {
    setIndex((current) => (current + direction + files.length) % files.length);
  }

  return (
    <dialog
      ref={dialog}
      className="gallery-review"
      aria-label="Gallery slideshow"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          step(event.key === "ArrowRight" ? 1 : -1);
        }
      }}
    >
      <div className="gallery-review-toolbar">
        <strong>{file ? displayPath(file.path) : "Slideshow"}</strong>
        <span role="status">
          {index + 1} / {files.length}
        </span>
        <button
          type="button"
          disabled={files.length < 2}
          className="button button-secondary"
          onClick={() => step(-1)}
        >
          Previous image
        </button>
        <button
          type="button"
          disabled={files.length < 2}
          className="button button-secondary"
          onClick={() => step(1)}
        >
          Next image
        </button>
        <button
          type="button"
          disabled={files.length < 2}
          className="button button-secondary"
          aria-pressed={playing}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
      </div>
      {file ? (
        <ReviewSlide
          key={file.id}
          share={share}
          file={file}
          notes={notes[file.id] ?? []}
          onAnnotate={() => setPlaying(false)}
          onNote={(note) => onNote(file.id, note)}
          onRemove={(id) => onRemove(file.id, id)}
        />
      ) : null}
    </dialog>
  );
}

function ReviewSlide({
  share,
  file,
  notes,
  onAnnotate,
  onNote,
  onRemove,
}: {
  share: UnlockedShare;
  file: ManifestFile;
  notes: Note[];
  onAnnotate: () => void;
  onNote: (note: Note) => void;
  onRemove: (id: string) => void;
}): React.JSX.Element {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [point, setPoint] = useState<Point | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    let active = true;
    let source: string | null = null;
    void readShareBlob(share, file)
      .then((blob) => {
        if (!active) return;
        const type = safeMediaType(previewKind(file.path, file.mime), file.path, file.mime);
        source = URL.createObjectURL(new Blob([blob], { type }));
        setUrl(source);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
      if (source) URL.revokeObjectURL(source);
    };
  }, [share, file]);

  return (
    <>
      <div className="gallery-review-stage">
        {url && !error ? (
          <div className="gallery-review-image">
            <img src={url} alt={displayPath(file.path)} onError={() => setError(true)} />
            {notes.map((note, index) => (
              <span
                key={note.id}
                className="gallery-pin"
                style={{ left: `${note.x}%`, top: `${note.y}%` }}
                title={note.text}
                aria-hidden="true"
              >
                {index + 1}
              </span>
            ))}
            {point ? (
              <span
                className="gallery-pin"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                aria-hidden="true"
              >
                +
              </span>
            ) : null}
            {placing ? (
              <button
                className="gallery-pin-target"
                type="button"
                aria-label="Place annotation pin"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x =
                    event.detail === 0 ? 50 : ((event.clientX - rect.left) / rect.width) * 100;
                  const y =
                    event.detail === 0 ? 50 : ((event.clientY - rect.top) / rect.height) * 100;
                  setPoint({ x, y });
                  setPlacing(false);
                }}
              />
            ) : null}
          </div>
        ) : (
          <p role="status">{error ? "This image could not be opened." : "Decrypting image…"}</p>
        )}
      </div>
      <div className="gallery-review-notes">
        <button
          className="button button-secondary"
          type="button"
          disabled={!url || error}
          aria-pressed={placing}
          onClick={() => {
            onAnnotate();
            setPlacing((current) => !current);
            setPoint(null);
            setText("");
          }}
        >
          {placing ? "Cancel pin" : "Add note"}
        </button>
        {placing ? (
          <p role="status">
            Choose a point on the image. Press Enter on the image to use its center.
          </p>
        ) : null}
        {point ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!text.trim()) return;
              onNote({ ...point, id: crypto.randomUUID(), text: text.trim() });
              setPoint(null);
              setText("");
            }}
          >
            <label>
              Note{" "}
              <input
                autoComplete="off"
                value={text}
                maxLength={500}
                onChange={(event) => setText(event.currentTarget.value)}
              />
            </label>{" "}
            <button type="submit" className="button button-primary" disabled={!text.trim()}>
              Save note
            </button>
          </form>
        ) : null}
        {notes.length ? (
          <ol>
            {notes.map((note) => (
              <li key={note.id}>
                {note.text}{" "}
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => onRemove(note.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        ) : null}
        <span>Notes stay in this tab.</span>
      </div>
    </>
  );
}
