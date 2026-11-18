import { unzipSync } from "fflate";
import { useEffect, useState } from "react";
import { formatBytes } from "../lib/format";

const ENTRY_LIMIT = 5_000;

type Entry = { name: string; size: number; index: number };

function archiveEntries(buffer: ArrayBuffer): { entries: Entry[]; count: number } {
  const entries: Entry[] = [];
  let count = 0;
  unzipSync(new Uint8Array(buffer), {
    filter(file) {
      const index = count++;
      if (index < ENTRY_LIMIT) entries.push({ name: file.name, size: file.originalSize, index });
      // Listing the central directory does not decompress any entry.
      return false;
    },
  });
  return { entries, count };
}

export function ArchiveView({ blob }: { blob: Blob }): React.JSX.Element {
  const [archive, setArchive] = useState<ReturnType<typeof archiveEntries> | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let active = true;
    void blob
      .arrayBuffer()
      .then(archiveEntries)
      .then(
        (result) => {
          if (active) setArchive(result);
        },
        () => {
          if (active) setError(true);
        },
      );
    return () => {
      active = false;
    };
  }, [blob]);

  if (error) return <div className="content-state error-state">This ZIP could not be read.</div>;
  if (!archive)
    return (
      <div className="content-state" role="status">
        Reading ZIP entries…
      </div>
    );

  const entries = archive.entries.filter((entry) =>
    entry.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const size = 100;
  return (
    <section className="csv-view">
      <label>
        Find entries{" "}
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setPage(0);
          }}
        />
      </label>
      <table>
        <thead>
          <tr>
            <th scope="col">Path</th>
            <th scope="col">Uncompressed size</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(page * size, (page + 1) * size).map((entry) => (
            <tr key={entry.index}>
              <td>{entry.name}</td>
              <td>{formatBytes(entry.size)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
        Previous entries
      </button>{" "}
      <button
        type="button"
        disabled={(page + 1) * size >= entries.length}
        onClick={() => setPage(page + 1)}
      >
        Next entries
      </button>
      <p role="status">
        {entries.length.toLocaleString()} matching entries of {archive.count.toLocaleString()}
        {archive.count > ENTRY_LIMIT
          ? ` · Listing limited to the first ${ENTRY_LIMIT.toLocaleString()}`
          : ""}
      </p>
    </section>
  );
}
