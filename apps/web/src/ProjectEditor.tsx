import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { validateProject, type ValidationIssue } from "@athanordb/dbml-engine";
import { useProjectDoc } from "./useProjectDoc.js";
import { useAwarenessStates } from "./useAwarenessStates.js";
import { hashColor } from "./awarenessColor.js";
import { CanvasArea } from "./CanvasArea.js";
import { ChevronRightIcon } from "./Icons.js";
import { loadHighlightLinks, saveHighlightLinks } from "./localPrefs.js";
import type { CanvasExportHandle, ProjectSummary } from "./types.js";
import { useCanvasNodes } from "./editor/useCanvasNodes.js";
import { useCanvasEdges } from "./editor/useCanvasEdges.js";
import { useCursorNodes } from "./editor/useCursorNodes.js";
import { useCanvasFontScale } from "./editor/useCanvasFontScale.js";
import { useProjectMutations } from "./editor/useProjectMutations.js";
import { useEditorKeyboardShortcuts } from "./editor/useEditorKeyboardShortcuts.js";
import { ProjectToolbar } from "./editor/ProjectToolbar.js";

// Each of these is only needed once a specific panel/dialog is actually
// opened — Monaco (DbmlPanel) especially, which used to load eagerly for
// every visit including the project-list page that never touches it.
const DbmlPanel = lazy(() => import("./DbmlPanel.js"));
const ImportDialog = lazy(() => import("./ImportDialog.js"));
const ExportDialog = lazy(() => import("./ExportDialog.js"));
const HistoryPanel = lazy(() => import("./HistoryPanel.js"));
const ValidationPanel = lazy(() => import("./ValidationPanel.js"));

export function ProjectEditor(props: {
  project: ProjectSummary;
  user: string;
  userId: string;
  onDisplayNameChange: (name: string) => void;
  onBack: () => void;
}) {
  const { project, user } = props;
  const { project: liveProject, doc, undoManager, awareness } = useProjectDoc(project.id, project.name, user);
  const remoteAwareness = useAwarenessStates(awareness);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [dbmlOpen, setDbmlOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const { fontScale, adjustFontScale } = useCanvasFontScale();
  const [highlightLinks, setHighlightLinks] = useState(loadHighlightLinks);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);

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

  const { nodes, onNodesChange } = useCanvasNodes(liveProject, doc, refFieldIdsByTable, user, highlightLinks);
  const edges = useCanvasEdges(liveProject, doc, nodes, highlightLinks, hoveredTableId);

  const {
    addTable,
    addZone,
    addStickyNote,
    setAllDetailLevels,
    activeDetailLevel,
    autoLayout,
    resetAllLinks,
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
        connected={Boolean(liveProject)}
        onBack={props.onBack}
        onUndo={() => undoManager?.undo()}
        onRedo={() => undoManager?.redo()}
        onAutoLayout={autoLayout}
        activeDetailLevel={activeDetailLevel}
        onSetDetailLevel={setAllDetailLevels}
        fontScale={fontScale}
        onAdjustFontScale={adjustFontScale}
        onShowImport={() => setShowImport(true)}
        onShowExport={() => setShowExport(true)}
        onShowHistory={() => setShowHistory(true)}
        onResetLinks={resetAllLinks}
        onShowValidation={() => setShowValidation(true)}
        validationCount={validationIssues.length}
        hasValidationErrors={hasValidationErrors}
        localUser={user}
        localColor={hashColor(user)}
        remoteAwareness={remoteAwareness}
        onDisplayNameChange={props.onDisplayNameChange}
      />
      <div className="canvas-container">
        {dbmlOpen && liveProject ? (
          <Suspense fallback={<div className="side-panel" style={{ width: 440 }} />}>
            <DbmlPanel project={liveProject} projectId={project.id} onClose={() => setDbmlOpen(false)} />
          </Suspense>
        ) : (
          <button className="panel-expand-tab" onClick={() => setDbmlOpen(true)} data-tooltip="Show DBML editor" data-tooltip-pos="bottom">
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
            fontScale={fontScale}
            highlightLinks={highlightLinks}
            onHighlightLinksChange={handleHighlightLinksChange}
            onTableHoverChange={setHoveredTableId}
            projectId={project.id}
            viewportUserId={props.userId}
            exportRef={canvasExportRef}
          />
        </ReactFlowProvider>
      </div>
      <Suspense fallback={null}>
        {showImport && <ImportDialog projectId={project.id} onClose={() => setShowImport(false)} />}
        {showExport && liveProject && (
          <ExportDialog
            projectId={project.id}
            projectName={project.name}
            captureCanvasImage={captureCanvasImage}
            onClose={() => setShowExport(false)}
          />
        )}
        {showHistory && liveProject && (
          <HistoryPanel projectId={project.id} currentProject={liveProject} onClose={() => setShowHistory(false)} />
        )}
        {showValidation && <ValidationPanel issues={validationIssues} onClose={() => setShowValidation(false)} />}
      </Suspense>
    </div>
  );
}
