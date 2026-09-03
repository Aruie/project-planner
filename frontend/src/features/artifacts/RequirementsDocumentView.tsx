import { useMemo, useState } from "react";
import { replaceDocumentBody } from "./document-model";
import { parseRequirementsDocument, type RequirementRecord } from "./requirements-document";

type View = "requirements" | "source";

const hasValue = (value: string): boolean => Boolean(value && value !== "-");

const requirementMatches = (item: RequirementRecord, query: string): boolean =>
  [item.id, item.area, item.businessName, item.name, item.acceptanceCriteria]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query.toLocaleLowerCase());

export function RequirementsDocumentView({
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
  const [localView, setLocalView] = useState<View>("requirements");
  const view = activeView ?? localView;
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [type, setType] = useState("all");
  const document = useMemo(() => parseRequirementsDocument(content), [content]);
  const areas = useMemo(
    () => [...new Set(document.requirements.map((item) => item.area).filter(Boolean))],
    [document.requirements],
  );
  const filtered = useMemo(
    () =>
      document.requirements.filter(
        (item) =>
          (area === "all" || item.area === area) &&
          (type === "all" || item.type === type) &&
          requirementMatches(item, query),
      ),
    [area, document.requirements, query, type],
  );
  const reflected = document.requirements.filter((item) => item.reflected === "반영").length;
  const unitCovered = document.requirements.filter((item) => hasValue(item.unitTestIds)).length;
  const integrationCovered = document.requirements.filter((item) =>
    hasValue(item.integrationTestIds),
  ).length;

  return (
    <div className="requirements-document">
      {showNavigation ? (
        <nav className="document-view-tabs" aria-label="요구사항 문서 보기">
          <button
            className={view === "requirements" ? "active" : ""}
            onClick={() => setLocalView("requirements")}
          >
            요구사항 <span>{document.requirements.length}</span>
          </button>
          <button
            className={view === "source" ? "active" : ""}
            onClick={() => setLocalView("source")}
          >
            원문 편집
          </button>
        </nav>
      ) : null}

      {view === "requirements" ? (
        <div className="requirements-view">
          <div className="requirements-summary">
            <Summary label="전체 요구사항" value={document.requirements.length} />
            <Summary label="반영 완료" value={reflected} tone="success" />
            <Summary label="단위테스트 연결" value={unitCovered} />
            <Summary label="통합테스트 연결" value={integrationCovered} />
          </div>
          <div className="requirement-filters">
            <label className="requirement-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0" />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ID, 업무명, 요구사항 검색"
              />
            </label>
            <select value={area} onChange={(event) => setArea(event.target.value)}>
              <option value="all">전체 업무영역</option>
              {areas.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="all">전체 유형</option>
              <option value="기능">기능</option>
              <option value="비기능">비기능</option>
            </select>
            <span className="filtered-count">{filtered.length}건</span>
          </div>
          <div className="requirements-table-wrap">
            <table className="requirements-table">
              <thead>
                <tr>
                  <th>요구사항 ID</th>
                  <th>업무영역 / 업무명</th>
                  <th>요구사항</th>
                  <th>유형</th>
                  <th>반영</th>
                  <th>테스트 연결</th>
                  <th>검증 문서</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code>{item.id}</code>
                    </td>
                    <td>
                      <strong>{item.area}</strong>
                      <span>{item.businessName}</span>
                    </td>
                    <td className="requirement-name-cell">
                      <strong>{item.name}</strong>
                      <details>
                        <summary>적용방안 및 수용기준</summary>
                        <dl>
                          <div>
                            <dt>적용방안</dt>
                            <dd>{item.approach || "-"}</dd>
                          </div>
                          <div>
                            <dt>수용기준</dt>
                            <dd>{item.acceptanceCriteria || "-"}</dd>
                          </div>
                          {hasValue(item.changes) ? (
                            <div>
                              <dt>변경사항</dt>
                              <dd>{item.changes}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </details>
                    </td>
                    <td>
                      <span
                        className={`requirement-type ${item.type === "비기능" ? "non-functional" : "functional"}`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td>
                      <span className={item.reflected === "반영" ? "reflected" : "not-reflected"}>
                        {item.reflected || "-"}
                      </span>
                    </td>
                    <td className="test-links">
                      <span className={hasValue(item.unitTestIds) ? "linked" : "empty"}>UT</span>
                      <span className={hasValue(item.integrationTestIds) ? "linked" : "empty"}>
                        IT
                      </span>
                    </td>
                    <td>
                      {hasValue(item.verificationDocuments) ? (
                        item.verificationDocuments
                      ) : (
                        <span className="empty-value">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {view === "source" ? (
        <div className="requirements-source-editor">
          <div className="source-editor-heading">
            <strong>요구사항 Markdown 본문</strong>
            <span>{document.body.length.toLocaleString()}자</span>
          </div>
          <textarea
            data-testid="artifact-content-input"
            aria-label="요구사항 Markdown 본문"
            value={document.body}
            onChange={(event) => onContentChange(replaceDocumentBody(content, event.target.value))}
            disabled={disabled}
            spellCheck={false}
          />
        </div>
      ) : null}
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <div className={`requirement-summary-card ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
