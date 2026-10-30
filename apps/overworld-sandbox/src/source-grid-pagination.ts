export interface SourceGridPageLayout {
  readonly columns: number;
  readonly rows: number;
  readonly pageSize: number;
}

/** Size a page from the grid's measured content box, after headers and controls take their space. */
export function sourceGridPageLayout(width: number, height: number, minimumWidth: number,
  minimumHeight: number, maximumColumns: number, maximumRows: number, gap: number): SourceGridPageLayout {
  const columns = Math.max(1, Math.min(maximumColumns,
    Math.floor((Math.max(0, width) + gap) / (minimumWidth + gap))));
  const rows = Math.max(1, Math.min(maximumRows,
    Math.floor((Math.max(0, height) + gap) / (minimumHeight + gap))));
  return { columns, rows, pageSize: columns * rows };
}
