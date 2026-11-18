import { useMemo, useState } from "react";

export type Sheet = {
  id: string;
  name: string;
  rows: { index: number; cells: string[] }[];
};

export function SpreadsheetView({ sheets }: { sheets: Sheet[] }): React.JSX.Element {
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const sheet = sheets[active];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (sheet?.rows ?? []).filter(
      ({ cells }) => !needle || cells.some((cell) => cell.toLowerCase().includes(needle)),
    );
  }, [sheet, query]);
  if (!sheet) return <p className="content-state">This workbook has no readable sheets.</p>;

  const pageSize = 50;
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const columnCount = Math.max(0, ...sheet.rows.map((row) => row.cells.length));
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    index,
    label: columnLabel(index),
  }));
  return (
    <section className="csv-view">
      <label>
        Sheet{" "}
        <select
          value={active}
          onChange={(event) => {
            setActive(Number(event.currentTarget.value));
            setPage(0);
          }}
        >
          {sheets.map((item, index) => (
            <option key={item.id} value={index}>
              {item.name}
            </option>
          ))}
        </select>
      </label>{" "}
      <label>
        Filter rows{" "}
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
            <th scope="col">Row</th>
            {columns.map(({ label }) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map(({ index, cells }) => (
            <tr key={index}>
              <th scope="row">{index}</th>
              {columns.map((column) => (
                <td key={column.label} title={cells[column.index]}>
                  {cells[column.index]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
        Previous rows
      </button>{" "}
      <button
        type="button"
        disabled={(page + 1) * pageSize >= filtered.length}
        onClick={() => setPage(page + 1)}
      >
        Next rows
      </button>
      <p role="status">
        {filtered.length.toLocaleString()} matches of {sheet.rows.length.toLocaleString()} rows
      </p>
    </section>
  );
}

function columnLabel(index: number): string {
  let label = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  }
  return label;
}
