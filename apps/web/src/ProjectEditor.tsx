import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { getMetaMap, writeProjectToDoc, type Project } from "@athanordb/shared";
import { validateProject, type ValidationIssue } from "@athanordb/dbml-engine";
import { useProjectDoc } from "./useProjectDoc.js";
import { useAwarenessStates } from "./useAwarenessStates.js";
import { hashColor } from "./awarenessColor.js";
import { CanvasArea } from "./CanvasArea.js";
import { ChevronRightIcon } from "./Icons.js";
import { DEFAULT_PALETTE } from "./ColorSwatchPicker.js";
import { loadHighlightLinks, saveHighlightLinks } from "./localPrefs.js";
import type { CanvasExportHandle, ProjectSummary } from "./types.js";
import { useCanvasNodes } from "./editor/useCanvasNodes.js";
import { useCanvasEdges } from "./editor/useCanvasEdges.js";
import { useCursorNodes } from "./editor/useCursorNodes.js";
import { useCanvasFontScale } from "./editor/useCanvasFontScale.js";
import { useProjectMutations } from "./editor/useProjectMutations.js";
import { useEditorKeyboardShortcuts } from "./editor/useEditorKeyboardShortcuts.js";
import { ProjectToolbar } from "./editor/ProjectToolbar.js";
import { useCanvasCommands } from "./plugins/usePlugins.js";
import { matchShortcut } from "./plugins/shortcuts.js";
import type { CanvasCommandResult } from "./plugins/types.js";

// Each of these is only needed once a specific panel/dialog is actually
// opened — Monaco (DbmlPanel) especially, which used to load eagerly for
// every visit including the project-list page that never touches it.
const DbmlPanel = lazy(() => import("./DbmlPanel.js"));
const ImportDialog = lazy(() => import("./ImportDialog.js"));
const ExportDialog = lazy(() => import("./ExportDialog.js"));
const HistoryPanel = lazy(() => import("./HistoryPanel.js"));
const ValidationPanel = lazy(() => import("./ValidationPanel.js"));
const PluginManagerDialog = lazy(() => import("./PluginManagerDialog.js"));

import { SettingsModal } from "./SettingsModal.js";
import type { Session } from "./types.js";

export function ProjectEditor(props: {
  project: ProjectSummary;
  session: Session;
  onDisplayNameChange: (name: string) => void;
  onLogout: () => void;
  onBack: () => void;
}) {
  const { project, session } = props;
  const user = session.displayName;
  const {
    project: liveProject,
    doc,
    undoManager,
    awareness,
    connection,
  } = useProjectDoc(project.id, project.name, user);
  const remoteAwareness = useAwarenessStates(awareness);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [dbmlOpen, setDbmlOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showPlugins, setShowPlugins] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pluginMessage, setPluginMessage] = useState<string | null>(null);

  const canvasCommands = useCanvasCommands(project.id);
  const { fontScale, adjustFontScale } = useCanvasFontScale();
  const [highlightLinks, setHighlightLinks] = useState(loadHighlightLinks);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [dbmlScrollRequest, setDbmlScrollRequest] = useState<{ tableName: string; requestId: number } | null>(null);
  const goToDbml = useCallback((tableName: string) => {
    setDbmlOpen(true);
    setDbmlScrollRequest((prev) => ({ tableName, requestId: (prev?.requestId ?? 0) + 1 }));
  }, []);

  /**
   * The canvas selection, held in a ref rather than passed as a dependency:
   * commands read it at the moment they run, and re-creating `runCanvasCommand`
   * on every selection change would re-render the whole canvas toolbar.
   */
  const selectedTableIdsRef = useRef<string[]>([]);

  /**
   * Runs a plugin canvas command and writes back whatever project it returns.
   * `writeProjectToDoc` diffs entity by entity, so a command that only renames
   * one table produces exactly one Yjs update — and the change lands in every
   * collaborator's canvas through the normal sync path.
   */
  const runCanvasCommand = useCallback(
    async (command: (typeof canvasCommands)[number]) => {
      if (!liveProject || !doc) return;
      const flash = (message: string) => {
        setPluginMessage(message);
        setTimeout(() => setPluginMessage(null), 4000);
      };
      try {
        const selection = selectedTableIdsRef.current;
        const result = (await command.run(liveProject, { selection })) as CanvasCommandResult;
        if (result?.project) doc.transact(() => writeProjectToDoc(doc, result.project as Project));
        flash(result?.message ?? `${command.contribution.label} applied`);
      } catch (err) {
        flash(`Plugin error: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [liveProject, doc],
  );

  const handleHighlightLinksChange = (val: boolean) => {
    setHighlightLinks(val);
    saveHighlightLinks(val);
  };

  // Populated by CanvasArea (inside the ReactFlowProvider) so ExportDialog
  // (outside it) can still trigger a canvas screenshot.
  const canvasExportRef = useRef<CanvasExportHandle | null>(null);
  const captureCanvasImage = useCallback(
    (format: "png" | "svg") =>
      canvasExportRef.current?.capture(format) ?? Promise.reject(new Error("Canvas is not ready yet")),
    [],
  );

  const validationIssues: ValidationIssue[] = useMemo(
    () => (liveProject ? validateProject(liveProject) : []),
    [liveProject],
  );
  const hasValidationErrors = validationIssues.some((i) => i.severity === "error");

  const cursorNodes = useCursorNodes(remoteAwareness);

  // Fields that are some ref's endpoint for a given table — shown outside compact detail level even if not PK.
  const refFieldIdsByTable = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!liveProject) return map;
    for (const table of liveProject.tables) map.set(table.id, new Set());
    for (const ref of liveProject.refs) {
      map.get(ref.from.tableId)?.add(ref.from.fieldId);
      map.get(ref.to.tableId)?.add(ref.to.fieldId);
    }
    return map;
  }, [liveProject]);

  const palette = liveProject?.paletteColors ?? DEFAULT_PALETTE;
  const onPaletteChange = useCallback(
    (next: string[]) => {
      if (doc) getMetaMap(doc).set("paletteColors", next);
    },
    [doc],
  );

  const { nodes, onNodesChange } = useCanvasNodes(liveProject, doc, refFieldIdsByTable, user, highlightLinks, goToDbml);

  const selectedTableIds = useMemo(
    () => nodes.filter((n) => n.type === "table" && n.selected).map((n) => n.id),
    [nodes],
  );
  useEffect(() => {
    selectedTableIdsRef.current = selectedTableIds;
  }, [selectedTableIds]);

  /**
   * Global bindings for plugin canvas commands. The app's own shortcuts are
   * bound elsewhere and run first; anything typed into a field or the DBML
   * editor is left alone.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, .cm-editor, [contenteditable='true']")) return;
      const command = matchShortcut(
        canvasCommands.map((c) => ({ command: c, shortcut: c.contribution.shortcut })),
        event,
      )?.command;
      if (!command) return;
      event.preventDefault();
      void runCanvasCommand(command);
    };
    // Capture phase: a focused React Flow node stops keydown from bubbling to
    // the window (it handles arrows/delete itself), so a bubble-phase listener
    // never fires for the exact case these shortcuts are most useful in —
    // right after clicking a table.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [canvasCommands, runCanvasCommand]);
  const edges = useCanvasEdges(liveProject, doc, nodes, highlightLinks, hoveredTableId, palette, onPaletteChange);

  const {
    addTable,
    addZone,
    addStickyNote,
    addEnum,
    setAllDetailLevels,
    activeDetailLevel,
    autoLayout,
    setTablesColor,
    duplicateSelected,
    onEdgesDelete,
    onConnect,
  } = useProjectMutations(liveProject, doc, nodes);

  useEditorKeyboardShortcuts(undoManager, duplicateSelected);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <ProjectToolbar
        projectName={project.name}
        viewOnly={project.permission === "view"}
        connection={connection}
        synced={Boolean(liveProject)}
        onBack={props.onBack}
        onUndo={() => undoManager?.undo()}
        onRedo={() => undoManager?.redo()}
        onAutoLayout={autoLayout}
        onShowImport={() => setShowImport(true)}
        onShowExport={() => setShowExport(true)}
        onShowHistory={() => setShowHistory(true)}
        onShowPlugins={() => setShowPlugins(true)}
        onShowValidation={() => setShowValidation(true)}
        onOpenSettings={() => setShowSettings(true)}
        validationCount={validationIssues.length}
        hasValidationErrors={hasValidationErrors}
        localUser={user}
        localColor={hashColor(user)}
        remoteAwareness={remoteAwareness}
        onDisplayNameChange={props.onDisplayNameChange}
      />
      {showSettings && (
        <SettingsModal
          session={session}
          onClose={() => setShowSettings(false)}
          onDisplayNameChange={props.onDisplayNameChange}
          onLogout={props.onLogout}
        />
      )}

      <div className="relative flex min-h-0 min-w-0 flex-1">
        {dbmlOpen && liveProject ? (
          <Suspense
            fallback={
              <div className="relative flex shrink-0 flex-col border-r border-border bg-surface" style={{ width: 440 }} />
            }
          >
            <DbmlPanel
              project={liveProject}
              projectId={project.id}
              onClose={() => setDbmlOpen(false)}
              scrollToTable={dbmlScrollRequest}
            />
          </Suspense>
        ) : (
          <button
            className="absolute left-2 top-2 z-[5] flex h-[26px] w-[26px] cursor-pointer items-center justify-center rounded-sm border border-border bg-surface-raised p-0 text-text-muted shadow-sm hover:bg-surface-hover hover:text-text"
            onClick={() => setDbmlOpen(true)}
            data-tooltip="Show DBML editor"
            data-tooltip-pos="bottom"
          >
            <ChevronRightIcon size={15} />
          </button>
        )}
        <ReactFlowProvider>
          <CanvasArea
            nodes={nodes}
            cursorNodes={cursorNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesDelete={onEdgesDelete}
            onConnect={onConnect}
            awareness={awareness}
            onAddTable={addTable}
            onAddZone={addZone}
            onAddNote={addStickyNote}
            onAddEnum={addEnum}
            onSetTablesColor={setTablesColor}
            palette={palette}
            fontScale={fontScale}
            onAdjustFontScale={adjustFontScale}
            activeDetailLevel={activeDetailLevel}
            onSetDetailLevel={setAllDetailLevels}
            highlightLinks={highlightLinks}
            onHighlightLinksChange={handleHighlightLinksChange}
            onTableHoverChange={setHoveredTableId}
            projectId={project.id}
            viewportUserId={session.id}
            exportRef={canvasExportRef}
            canvasCommands={canvasCommands}
            onRunCanvasCommand={runCanvasCommand}
            onOpenPlugins={() => setShowPlugins(true)}
            statusMessage={pluginMessage}
          />
        </ReactFlowProvider>
      </div>
      <Suspense fallback={null}>
        {showImport && <ImportDialog projectId={project.id} onClose={() => setShowImport(false)} />}
        {showExport && liveProject && (
          <ExportDialog
            projectId={project.id}
            projectName={project.name}
            project={liveProject}
            captureCanvasImage={captureCanvasImage}
            onClose={() => setShowExport(false)}
          />
        )}
        {showHistory && liveProject && (
          <HistoryPanel projectId={project.id} currentProject={liveProject} onClose={() => setShowHistory(false)} />
        )}
        {showValidation && <ValidationPanel issues={validationIssues} onClose={() => setShowValidation(false)} />}
        {showPlugins && <PluginManagerDialog onClose={() => setShowPlugins(false)} />}
      </Suspense>
    </div>
  );
}
