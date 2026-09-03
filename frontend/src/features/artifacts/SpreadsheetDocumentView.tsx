import { useMemo, useState } from "react";
import { SpreadsheetDocument, type SpreadsheetWorkbook } from "./document-model";

type View = "information" | "sheet" | "source";

export function SpreadsheetDocumentView({
  content,
  onContentChange,
  disabled,
  activeView,
  showNavigation = true,
}: {
  content: string;
  onContentChange: (value: string) => void;
  disabled: boolean;
  activeView?: View;
  showNavigation?: boolean;
}) {
  const [localView, setLocalView] = useState<View>("information");
  const view = activeView ?? localView;
  const document = useMemo(() => new SpreadsheetDocument(content), [content]);
  const sheet = document.workbook.sheets[0];

  const update = (workbook: SpreadsheetWorkbook) =>
    onContentChange(SpreadsheetDocument.stringify(workbook));

  const replaceSheet = (nextSheet: typeof sheet) =>
    update({ ...document.workbook, sheets: [nextSheet, ...document.workbook.sheets.slice(1)] });

  const addColumn = () => {
    const index = sheet.columns.length + 1;
    const key = `column${index}`;
    replaceSheet({
      ...sheet,
      columns: [...sheet.columns, { key, label: `칼럼 ${index}`, type: "text" }],
      rows: sheet.rows.map((row) => ({ ...row, [key]: "" })),
    });
  };

  const renameColumn = (key: string, label: string) =>
    replaceSheet({
      ...sheet,
      columns: sheet.columns.map((column) => (column.key === key ? { ...column, label } : column)),
    });

  const addRow = () =>
    replaceSheet({
      ...sheet,
      rows: [...sheet.rows, Object.fromEntries(sheet.columns.map((column) => [column.key, ""]))],
    });

  const updateCell = (rowIndex: number, key: string, value: string) =>
    replaceSheet({
      ...sheet,
      rows: sheet.rows.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row)),
    });

  const deleteRow = (rowIndex: number) =>
    replaceSheet({ ...sheet, rows: sheet.rows.filter((_, index) => index !== rowIndex) });

  return (
    <div className="spreadsheet-document">
      {showNavigation ? (
        <nav className="document-view-tabs" aria-label="Excel 문서 보기">
          <button
            className={view === "information" ? "active" : ""}
            onClick={() => setLocalView("information")}
          >
            문서 정보
          </button>
          <button
            className={view === "sheet" ? "active" : ""}
            onClick={() => setLocalView("sheet")}
          >
            미리보기
          </button>
          <button
            className={view === "source" ? "active" : ""}
            onClick={() => setLocalView("source")}
          >
            JSON 원문
          </button>
        </nav>
      ) : null}

      {view === "information" ? (
        <section className="document-information spreadsheet-information">
          <header>
            <span>WORKBOOK</span>
            <h2>{document.workbook.title}</h2>
            <p>구조화된 Excel workbook 정보입니다.</p>
          </header>
          <div className="document-info-grid">
            <div>
              <span>스키마</span>
              <strong>aidlc.workbook/v1</strong>
            </div>
            <div>
              <span>시트 수</span>
              <strong>{document.workbook.sheets.length}</strong>
            </div>
            <div>
              <span>현재 시트</span>
              <strong>{sheet.name}</strong>
            </div>
            <div>
              <span>데이터 규모</span>
              <strong>
                {sheet.columns.length}개 열 · {sheet.rows.length}개 행
              </strong>
            </div>
          </div>
        </section>
      ) : null}

      {view === "sheet" ? (
        <div className="spreadsheet-editor">
          <header className="spreadsheet-toolbar">
            <label>
              <span>시트 이름</span>
              <input
                value={sheet.name}
                disabled={disabled}
                onChange={(event) => replaceSheet({ ...sheet, name: event.target.value })}
              />
            </label>
            <div>
              <button className="secondary-button" disabled={disabled} onClick={addColumn}>
                + 컬럼 추가
              </button>
              <button
                className="primary-button"
                disabled={disabled || !sheet.columns.length}
                onClick={addRow}
              >
                + 행 추가
              </button>
            </div>
          </header>
          <div className="spreadsheet-grid-wrap">
            <table className="spreadsheet-grid">
              <thead>
                <tr>
                  <th className="row-number-cell">#</th>
                  {sheet.columns.map((column) => (
                    <th key={column.key}>
                      <input
                        value={column.label}
                        disabled={disabled}
                        onChange={(event) => renameColumn(column.key, event.target.value)}
                      />
                      <small>
                        {column.key} · {column.type}
                      </small>
                    </th>
                  ))}
                  <th className="row-action-cell" />
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <th className="row-number-cell">{rowIndex + 1}</th>
                    {sheet.columns.map((column) => (
                      <td key={column.key}>
                        <textarea
                          value={String(row[column.key] ?? "")}
                          disabled={disabled}
                          onChange={(event) => updateCell(rowIndex, column.key, event.target.value)}
                          placeholder="값 입력"
                        />
                      </td>
                    ))}
                    <td className="row-action-cell">
                      <button
                        disabled={disabled}
                        onClick={() => deleteRow(rowIndex)}
                        aria-label={`${rowIndex + 1}행 삭제`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!sheet.rows.length ? (
            <div className="spreadsheet-empty">행 추가를 눌러 첫 데이터를 입력하세요.</div>
          ) : null}
          <footer className="sheet-tabs">
            <span className="active">{sheet.name}</span>
            <small>
              {sheet.columns.length} columns · {sheet.rows.length} rows
            </small>
          </footer>
        </div>
      ) : null}

      {view === "source" ? (
        <div className="requirements-source-editor">
          <div className="source-editor-heading">
            <div>
              <strong>Workbook JSON</strong>
              <span>줄바꿈은 JSON 문자열의 \n으로 안전하게 저장됩니다.</span>
            </div>
            <span>{content.length.toLocaleString()}자</span>
          </div>
          <textarea
            data-testid="artifact-content-input"
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            disabled={disabled}
            spellCheck={false}
          />
        </div>
      ) : null}
    </div>
  );
}
