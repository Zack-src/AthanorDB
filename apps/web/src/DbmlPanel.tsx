import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "@athanordb/shared";
import { projectToDbml } from "@athanordb/dbml-engine";
import { ChevronLeftIcon, CodeIcon, LayoutGridIcon, SettingsIcon } from "./Icons.js";
import { DbmlEditor, type DbmlEditorHandle } from "./dbmlEditor/DbmlEditor.js";
import type { ServerProblem } from "./dbmlEditor/lint.js";
import { Button } from "./ui/Button.js";
import { ErrorText } from "./ui/Alert.js";

type SyncStatus = "idle" | "typing" | "syncing" | "synced" | "error";

const DOT_TONE: Record<Exclude<SyncStatus, "idle">, string> = {
  typing: "bg-text-muted",
  syncing: "animate-pulse bg-warning",
  synced: "bg-success",
  error: "bg-danger",
};

function SyncStatusPill({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;
  const label = { typing: "Editing…", syncing: "Syncing…", synced: "Synced", error: "Sync error" }[status];
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_TONE[status]}`} />
      {label}
    </span>
  );
}

const DBML_SYNC_DEBOUNCE_MS = 600;
const DEFAULT_PANEL_WIDTH = 440;
const MIN_PANEL_WIDTH = 280;
const STORAGE_KEY_WIDTH = "athanordb_dbml_panel_width";

export interface DbmlErrorPos {
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

function DbmlPanel(props: {
  project: Project;
  projectId: string;
  onClose: () => void;
  scrollToTable?: { tableName: string; requestId: number } | null;
}) {
  const { project, projectId } = props;
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<ServerProblem | null>(null);
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WIDTH);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= MIN_PANEL_WIDTH) return parsed;
    }
    return DEFAULT_PANEL_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(dirty);
  const lastAppliedTextRef = useRef<string | null>(null);
  const editorRef = useRef<DbmlEditorHandle | null>(null);
  /** Mirror of `text` for Ctrl+S, which fires outside React's render cycle. */
  const textRef = useRef(text);

  const startResizing = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = panelWidth;

      const clamp = (deltaX: number) => {
        const maxWidth = Math.min(1200, window.innerWidth - 100);
        return Math.max(MIN_PANEL_WIDTH, Math.min(maxWidth, startWidth + deltaX));
      };

      const onMouseMove = (moveEvent: MouseEvent) => setPanelWidth(clamp(moveEvent.clientX - startX));
      const onMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        setIsResizing(false);
        localStorage.setItem(STORAGE_KEY_WIDTH, String(clamp(upEvent.clientX - startX)));
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [panelWidth],
  );

  const handleDoubleClickResizer = useCallback(() => {
    setPanelWidth(DEFAULT_PANEL_WIDTH);
    localStorage.setItem(STORAGE_KEY_WIDTH, String(DEFAULT_PANEL_WIDTH));
  }, []);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Fetch initial DBML content
  useEffect(() => {
    fetch(`/api/projects/${projectId}/export/dbml`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`export failed (${res.status})`))))
      .then((dbml) => {
        setText(dbml);
        lastAppliedTextRef.current = dbml;
        setStatus("synced");
      })
      .catch((err) => setError((err as Error).message));
  }, [projectId]);

  // Sync live project changes (e.g. node/ref deletions or modifications) into DBML text
  useEffect(() => {
    if (dirtyRef.current) return;
    try {
      const dbml = projectToDbml(project);
      if (text !== dbml && lastAppliedTextRef.current !== dbml) {
        setText(dbml);
        lastAppliedTextRef.current = dbml;
        setStatus("synced");
      }
    } catch {
      fetch(`/api/projects/${projectId}/export/dbml`)
        .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`export failed (${res.status})`))))
        .then((dbml) => {
          if (dirtyRef.current) return;
          if (text === dbml || lastAppliedTextRef.current === dbml) return;
          setText(dbml);
          lastAppliedTextRef.current = dbml;
          setStatus("synced");
        })
        .catch((err) => setError((err as Error).message));
    }
  }, [project, projectId, text]);

  const applyNow = useCallback(
    (source: string) => {
      setStatus("syncing");
      lastAppliedTextRef.current = source;
      fetch(`/api/projects/${projectId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      })
        .then(async (res) => {
          if (res.ok) {
            setDirty(false);
            setError(null);
            setProblem(null);
            setStatus("synced");
          } else {
            const data = await res.json().catch(() => ({}));
            const message = data.error ?? `Import failed (${res.status})`;
            setError(message);
            setProblem(
              typeof data.line === "number"
                ? { message, line: data.line, column: data.column, endLine: data.endLine, endColumn: data.endColumn }
                : null,
            );
            setStatus("error");
          }
        })
        .catch((err) => {
          setError((err as Error).message);
          setProblem(null);
          setStatus("error");
        });
    },
    [projectId],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setText(value);
      setDirty(true);
      setStatus("typing");
      setError(null);
      setProblem(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => applyNow(value), DBML_SYNC_DEBOUNCE_MS);
    },
    [applyNow],
  );

  /** Ctrl+S — skip the debounce and push the current buffer immediately. */
  const handleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    applyNow(textRef.current);
  }, [applyNow]);

  return (
    <div className="relative flex shrink-0 flex-col border-r border-border bg-surface nokey" style={{ width: panelWidth }}>
      <div
        className={`absolute bottom-0 right-[-4px] top-0 z-20 w-2 cursor-col-resize transition-colors duration-150 ${isResizing ? "bg-primary" : "hover:bg-primary"}`}
        onMouseDown={startResizing}
        onDoubleClick={handleDoubleClickResizer}
        data-tooltip="Glisser pour redimensionner / Double-cliquer pour réinitialiser"
      />
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
        <CodeIcon size={14} className="text-text-muted" />
        <span className="text-[13px] font-semibold text-text">DBML</span>
        <SyncStatusPill status={status} />
        <span className="ml-auto" />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => editorRef.current?.openPalette("symbols")}
          data-tooltip="Go to symbol (Ctrl+P)"
        >
          <LayoutGridIcon size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => editorRef.current?.openPalette("commands")}
          data-tooltip="Command palette (Ctrl+Shift+P)"
        >
          <SettingsIcon size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editorRef.current?.format()}
          data-tooltip="Format document (Shift+Alt+F)"
        >
          Format
        </Button>
        <Button variant="ghost" size="icon" onClick={props.onClose} data-tooltip="Collapse editor">
          <ChevronLeftIcon size={16} />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <DbmlEditor
          ref={editorRef}
          value={text}
          onChange={handleChange}
          onSave={handleSave}
          problem={problem}
          scrollToTable={props.scrollToTable}
        />
      </div>
      {error && (
        <div className="m-2">
          <ErrorText>
            {problem ? `Line ${problem.line}${problem.column ? `, col ${problem.column}` : ""} — ${error}` : error}
          </ErrorText>
        </div>
      )}
    </div>
  );
}

export { DbmlPanel };
export default DbmlPanel;
