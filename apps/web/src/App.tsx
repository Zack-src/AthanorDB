import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  applyNodeChanges,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  getRefsMap,
  getStickyNotesMap,
  getTablesMap,
  getZonesMap,
  type DetailLevel,
  type Project,
  type RevisionMeta,
} from "@athanordb/shared";
import {
  diffProjects,
  validateProject,
  type ChangeStatus,
  type ProjectDiff,
  type ValidationIssue,
} from "@athanordb/dbml-engine";
import { useProjectDoc } from "./useProjectDoc.js";
import { useAwarenessStates } from "./useAwarenessStates.js";
import { computeAutoLayout } from "./autoLayout.js";
import { hashColor } from "./awarenessColor.js";
import { TableNode, type TableNodeType } from "./TableNode.js";
import { RefEdge, CARDINALITY_STYLE, type RefEdgeType } from "./RefEdge.js";
import { ZoneNode, type ZoneNodeType } from "./ZoneNode.js";
import { StickyNoteNode, type StickyNoteNodeType } from "./StickyNoteNode.js";
import { CursorNode, type CursorNodeType } from "./CursorNode.js";
import { PresenceList } from "./PresenceList.js";
import type { Awareness } from "y-protocols/awareness.js";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  CodeIcon,
  DownloadIcon,
  FolderIcon,
  FrameIcon,
  LayoutGridIcon,
  LogoMarkIcon,
  NoteIcon,
  PlusIcon,
  RedoIcon,
  ShieldCheckIcon,
  TableIcon,
  UndoIcon,
  UploadIcon,
  type IconProps,
} from "./Icons.js";

const nodeTypes = { table: TableNode, zone: ZoneNode, sticky: StickyNoteNode, cursor: CursorNode };
const edgeTypes = { ref: RefEdge };

type CanvasNode = TableNodeType | ZoneNodeType | StickyNoteNodeType;
type AllNodes = CanvasNode | CursorNodeType;

interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
}

type SqlDialect = "postgres" | "mysql" | "mssql";
type ExportFormat = "dbml" | SqlDialect;

const USER_KEY = "athanordb.user";

function loadUser(): string {
  const saved = localStorage.getItem(USER_KEY);
  if (saved) return saved;
  const generated = `user-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(USER_KEY, generated);
  return generated;
}

export function App() {
  const [user, setUser] = useState(loadUser);
  const [serverStatus, setServerStatus] = useState<"checking" | "ok" | "down">("checking");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [openProject, setOpenProject] = useState<ProjectSummary | null>(null);
  const [newName, setNewName] = useState("");

  const refreshProjects = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {});
  };

  useEffect(() => {
    fetch("/api/health")
      .then((r) => (r.ok ? setServerStatus("ok") : setServerStatus("down")))
      .catch(() => setServerStatus("down"));
    refreshProjects();
  }, []);

  useEffect(() => {
    localStorage.setItem(USER_KEY, user);
  }, [user]);

  const createProject = async () => {
    const name = newName.trim();
    if (!name) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setNewName("");
      refreshProjects();
    }
  };

  const statusDotClass =
    serverStatus === "ok" ? "status-dot-ok" : serverStatus === "down" ? "status-dot-down" : "status-dot-checking";

  if (openProject) {
    return (
      <div className="app-shell">
        <ProjectEditor
          project={openProject}
          user={user}
          onUserChange={setUser}
          onBack={() => setOpenProject(null)}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">
            <LogoMarkIcon size={15} style={{ color: "white" }} />
          </span>
          AthanorDB
        </div>
        <span className="status-pill">
          <span className={`status-dot ${statusDotClass}`} />
          {serverStatus === "ok" ? "connected" : serverStatus === "down" ? "server unreachable" : "connecting…"}
        </span>
        <span className="toolbar-spacer" />
        <label className="user-field">
          User
          <input className="input" value={user} onChange={(e) => setUser(e.target.value)} size={12} />
        </label>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ProjectList
          projects={projects}
          newName={newName}
          onNewNameChange={setNewName}
          onCreate={createProject}
          onOpen={setOpenProject}
        />
      </div>
    </div>
  );
}

function ProjectList(props: {
  projects: ProjectSummary[];
  newName: string;
  onNewNameChange: (v: string) => void;
  onCreate: () => void;
  onOpen: (p: ProjectSummary) => void;
}) {
  const { projects, newName, onNewNameChange, onCreate, onOpen } = props;
  return (
    <div className="project-list-page">
      <div className="project-list-inner">
        <h1 className="project-list-heading">Projects</h1>
        <p className="project-list-sub">DBML-native schema diagrams, versioned and shared live.</p>
        <div className="project-create-row">
          <input
            className="input"
            placeholder="New project name"
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
          />
          <button className="btn btn-primary" onClick={onCreate}>
            <PlusIcon size={14} /> Create
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state">No projects yet — create one above to get started.</div>
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <button key={p.id} className="project-card" onClick={() => onOpen(p)}>
                <span className="project-card-icon">
                  <FolderIcon size={17} />
                </span>
                <div className="project-card-name">{p.name}</div>
                <div className="project-card-date">{p.created_at}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectEditor(props: { project: ProjectSummary; user: string; onUserChange: (v: string) => void; onBack: () => void }) {
  const { project, user } = props;
  const { project: liveProject, doc, undoManager, awareness } = useProjectDoc(project.id, project.name, user);
  const remoteAwareness = useAwarenessStates(awareness);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [dbmlOpen, setDbmlOpen] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const validationIssues: ValidationIssue[] = useMemo(
    () => (liveProject ? validateProject(liveProject) : []),
    [liveProject],
  );
  const hasValidationErrors = validationIssues.some((i) => i.severity === "error");

  const cursorNodes: CursorNodeType[] = useMemo(() => {
    const result: CursorNodeType[] = [];
    remoteAwareness.forEach((state, clientId) => {
      if (!state.cursor) return;
      result.push({
        id: `cursor-${clientId}`,
        position: state.cursor,
        type: "cursor",
        draggable: false,
        selectable: false,
        deletable: false,
        focusable: false,
        zIndex: 1000,
        data: { name: state.user.name, color: state.user.color },
      });
    });
    return result;
  }, [remoteAwareness]);

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

  const builtNodes: CanvasNode[] = useMemo(() => {
    if (!liveProject || !doc) return [];

    // Zones render first (bottom, so tables/notes drag on top of them), then
    // tables, then sticky notes last (top, as annotations layered over the diagram).
    const zoneNodes: ZoneNodeType[] = liveProject.zones.map((zone) => ({
      id: zone.id,
      position: zone.position,
      width: zone.size.width,
      height: zone.size.height,
      type: "zone",
      data: {
        zone,
        onLabelChange: (label: string) => {
          const zones = getZonesMap(doc);
          const current = zones.get(zone.id);
          if (current) zones.set(zone.id, { ...current, label });
        },
        onColorChange: (color: string) => {
          const zones = getZonesMap(doc);
          const current = zones.get(zone.id);
          if (current) zones.set(zone.id, { ...current, style: { ...current.style, color } });
        },
        onResize: (position, size) => {
          const zones = getZonesMap(doc);
          const current = zones.get(zone.id);
          if (current) zones.set(zone.id, { ...current, position, size });
        },
      },
    }));

    const tableNodes: TableNodeType[] = liveProject.tables.map((table) => ({
      id: table.id,
      position: table.position,
      type: "table",
      data: {
        table,
        refFieldIds: refFieldIdsByTable.get(table.id) ?? new Set(),
        onRename: (name: string) => {
          const tables = getTablesMap(doc);
          const current = tables.get(table.id);
          if (current) tables.set(table.id, { ...current, name });
        },
        onStyleChange: (color?: string, borderColor?: string) => {
          const tables = getTablesMap(doc);
          const current = tables.get(table.id);
          if (current) tables.set(table.id, { ...current, style: { color, borderColor } });
        },
      },
    }));

    const stickyNodes: StickyNoteNodeType[] = liveProject.stickyNotes.map((note) => ({
      id: note.id,
      position: note.position,
      width: note.size.width,
      height: note.size.height,
      type: "sticky",
      data: {
        note,
        onTextChange: (text: string) => {
          const stickyNotes = getStickyNotesMap(doc);
          const current = stickyNotes.get(note.id);
          if (current) stickyNotes.set(note.id, { ...current, text });
        },
        onColorChange: (color: string) => {
          const stickyNotes = getStickyNotesMap(doc);
          const current = stickyNotes.get(note.id);
          if (current) stickyNotes.set(note.id, { ...current, style: { ...current.style, color } });
        },
        onResize: (position, size) => {
          const stickyNotes = getStickyNotesMap(doc);
          const current = stickyNotes.get(note.id);
          if (current) stickyNotes.set(note.id, { ...current, position, size });
        },
      },
    }));

    return [...zoneNodes, ...tableNodes, ...stickyNodes];
  }, [liveProject, doc, refFieldIdsByTable]);

  // React Flow needs local, controlled node state to show live drag position —
  // `builtNodes` (source of truth) only updates once the drag commits to the
  // doc, so without this the node would visually snap around during the drag.
  // Resetting during render (React's documented pattern for "adjust state
  // when an input changes") rather than in an effect avoids an extra render pass.
  const [nodes, setNodes] = useState<CanvasNode[]>(builtNodes);
  const [prevBuiltNodes, setPrevBuiltNodes] = useState(builtNodes);
  if (builtNodes !== prevBuiltNodes) {
    setPrevBuiltNodes(builtNodes);
    setNodes(builtNodes);
  }

  const onNodesChange = useCallback(
    // Typed against AllNodes since this is React Flow's nodes-prop change
    // handler and cursor nodes ride along in that same array — but cursor
    // nodes are always non-interactive (draggable/selectable/deletable:
    // false), so they never actually produce a change event; safe to narrow
    // back to CanvasNode for the part of this function that persists to the doc.
    (changes: NodeChange<AllNodes>[]) => {
      setNodes((nds) => applyNodeChanges(changes as NodeChange<CanvasNode>[], nds));
      if (!doc) return;
      const tables = getTablesMap(doc);
      const zones = getZonesMap(doc);
      const stickyNotes = getStickyNotesMap(doc);
      for (const change of changes) {
        if (change.type === "position" && change.position && change.dragging === false) {
          if (tables.has(change.id)) {
            const current = tables.get(change.id);
            if (current) tables.set(change.id, { ...current, position: change.position });
          } else if (zones.has(change.id)) {
            const current = zones.get(change.id);
            if (current) zones.set(change.id, { ...current, position: change.position });
          } else if (stickyNotes.has(change.id)) {
            const current = stickyNotes.get(change.id);
            if (current) stickyNotes.set(change.id, { ...current, position: change.position });
          }
        } else if (change.type === "remove") {
          if (tables.has(change.id)) {
            tables.delete(change.id);
            const refs = getRefsMap(doc);
            for (const [refId, ref] of refs.entries()) {
              if (ref.from.tableId === change.id || ref.to.tableId === change.id) refs.delete(refId);
            }
          } else if (zones.has(change.id)) {
            zones.delete(change.id);
          } else if (stickyNotes.has(change.id)) {
            stickyNotes.delete(change.id);
          }
        }
      }
    },
    [doc],
  );

  const duplicateSelected = useCallback(() => {
    if (!doc) return;
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    const OFFSET = 24;
    doc.transact(() => {
      for (const node of selected) {
        if (node.type === "table") {
          const tables = getTablesMap(doc);
          const src = node.data.table;
          const fieldIdMap = new Map(src.fields.map((f) => [f.id, crypto.randomUUID()]));
          const id = crypto.randomUUID();
          tables.set(id, {
            ...src,
            id,
            name: `${src.name}_copy`,
            position: { x: src.position.x + OFFSET, y: src.position.y + OFFSET },
            fields: src.fields.map((f) => ({ ...f, id: fieldIdMap.get(f.id)! })),
            indexes: src.indexes.map((idx) => ({
              ...idx,
              id: crypto.randomUUID(),
              fieldIds: idx.fieldIds.map((fid) => fieldIdMap.get(fid) ?? fid),
            })),
          });
        } else if (node.type === "zone") {
          const zones = getZonesMap(doc);
          const src = node.data.zone;
          const id = crypto.randomUUID();
          zones.set(id, { ...src, id, position: { x: src.position.x + OFFSET, y: src.position.y + OFFSET } });
        } else if (node.type === "sticky") {
          const stickyNotes = getStickyNotesMap(doc);
          const src = node.data.note;
          const id = crypto.randomUUID();
          stickyNotes.set(id, { ...src, id, position: { x: src.position.x + OFFSET, y: src.position.y + OFFSET } });
        }
      }
    });
  }, [doc, nodes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) undoManager?.redo();
        else undoManager?.undo();
      } else if (key === "y") {
        e.preventDefault();
        undoManager?.redo();
      } else if (key === "d") {
        e.preventDefault();
        duplicateSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoManager, duplicateSelected]);

  const edges: RefEdgeType[] = useMemo(() => {
    if (!liveProject) return [];
    const tablesById = new Map(liveProject.tables.map((t) => [t.id, t]));
    return liveProject.refs.map((ref) => {
      const fromCompact = tablesById.get(ref.from.tableId)?.detailLevel === "compact";
      const toCompact = tablesById.get(ref.to.tableId)?.detailLevel === "compact";
      return {
        id: ref.id,
        source: ref.from.tableId,
        target: ref.to.tableId,
        sourceHandle: fromCompact ? undefined : ref.from.fieldId,
        targetHandle: toCompact ? undefined : ref.to.fieldId,
        type: "ref",
        data: { cardinality: ref.cardinality },
        markerEnd: { type: MarkerType.ArrowClosed, color: CARDINALITY_STYLE[ref.cardinality].stroke },
      };
    });
  }, [liveProject]);

  const addTable = (position?: { x: number; y: number }) => {
    if (!doc) return;
    const tables = getTablesMap(doc);
    const id = crypto.randomUUID();
    const index = tables.size;
    tables.set(id, {
      id,
      name: `table_${index + 1}`,
      // A field-less table isn't just useless — @dbml/core's parser actually
      // throws on `Table t { }` (zero columns), which would break the live
      // DBML round-trip the moment this table's text gets re-imported (e.g.
      // the user edits any other table before giving this one a column).
      // Seeding an id column sidesteps that entirely, and matches how every
      // other schema tool (dbdiagram included) seeds a new table.
      fields: [{ id: crypto.randomUUID(), name: "id", type: "int", pk: true, increment: true }],
      indexes: [],
      position: position ?? { x: (index % 6) * 260, y: Math.floor(index / 6) * 200 },
      detailLevel: "standard",
    });
  };

  const addZone = (position?: { x: number; y: number }) => {
    if (!doc) return;
    const zones = getZonesMap(doc);
    const id = crypto.randomUUID();
    zones.set(id, {
      id,
      label: "Zone",
      position: position ?? { x: 40, y: 40 },
      size: { width: 300, height: 220 },
      style: { color: "#f59e0b" },
    });
  };

  const addStickyNote = (position?: { x: number; y: number }) => {
    if (!doc) return;
    const stickyNotes = getStickyNotesMap(doc);
    const id = crypto.randomUUID();
    stickyNotes.set(id, {
      id,
      text: "",
      position: position ?? { x: 60, y: 60 },
      size: { width: 160, height: 120 },
      style: { color: "#fef08a" },
    });
  };

  const setAllDetailLevels = (level: DetailLevel) => {
    if (!doc) return;
    const tables = getTablesMap(doc);
    tables.forEach((table, id) => tables.set(id, { ...table, detailLevel: level }));
  };

  const autoLayout = () => {
    if (!doc || !liveProject) return;
    const positions = computeAutoLayout(liveProject.tables, liveProject.refs);
    const tables = getTablesMap(doc);
    doc.transact(() => {
      for (const [id, position] of positions) {
        const current = tables.get(id);
        if (current) tables.set(id, { ...current, position });
      }
    });
  };

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <header className="app-header">
        <button className="btn btn-icon btn-ghost" onClick={props.onBack} title="Back to projects">
          <ChevronLeftIcon size={16} />
        </button>
        <span className="brand-mark" style={{ width: 24, height: 24 }}>
          <LogoMarkIcon size={13} style={{ color: "white" }} />
        </span>
        <span className="toolbar-project-name">{project.name}</span>
        <span className="toolbar-divider" />
        <div className="toolbar-group">
          <button className="btn btn-icon" onClick={() => undoManager?.undo()} title="Undo (Ctrl+Z)">
            <UndoIcon />
          </button>
          <button className="btn btn-icon" onClick={() => undoManager?.redo()} title="Redo (Ctrl+Shift+Z)">
            <RedoIcon />
          </button>
          <button className="btn btn-icon" onClick={autoLayout} title="Auto-layout (dagre)">
            <LayoutGridIcon size={14} />
          </button>
        </div>
        <span className="toolbar-divider" />
        <div className="toolbar-group">
          <button className="btn btn-sm" onClick={() => setAllDetailLevels("compact")} title="Show only key fields">
            Compact
          </button>
          <button className="btn btn-sm" onClick={() => setAllDetailLevels("standard")} title="Show primary/foreign keys">
            Standard
          </button>
          <button className="btn btn-sm" onClick={() => setAllDetailLevels("full")} title="Show all fields">
            Full
          </button>
        </div>
        <span className="toolbar-spacer" />
        <div className="toolbar-group">
          <button className="btn btn-sm" onClick={() => setShowImport(true)}>
            <UploadIcon size={13} /> Import
          </button>
          <button className="btn btn-sm" onClick={() => setShowExport(true)}>
            <DownloadIcon size={13} /> Export
          </button>
          <button className="btn btn-sm" onClick={() => setShowHistory(true)}>
            <ClockIcon size={13} /> History
          </button>
          <button className="btn btn-sm" onClick={() => setShowValidation(true)}>
            <ShieldCheckIcon size={13} /> Validate
            {validationIssues.length > 0 && (
              <span className={`badge-count${hasValidationErrors ? " badge-count-danger" : ""}`}>
                {validationIssues.length}
              </span>
            )}
          </button>
        </div>
        <span className="toolbar-divider" />
        <PresenceList localName={user} localColor={hashColor(user)} remote={remoteAwareness} />
        <label className="user-field">
          <input
            className="input"
            value={user}
            onChange={(e) => props.onUserChange(e.target.value)}
            size={10}
            title="Your display name"
          />
        </label>
        {!liveProject && <span className="status-pill">connecting…</span>}
      </header>
      <div className="canvas-container">
        {dbmlOpen && liveProject ? (
          <DbmlPanel project={liveProject} projectId={project.id} user={user} onClose={() => setDbmlOpen(false)} />
        ) : (
          <button className="panel-expand-tab" onClick={() => setDbmlOpen(true)} title="Show DBML editor">
            <ChevronRightIcon size={15} />
          </button>
        )}
        <ReactFlowProvider>
          <CanvasArea
            nodes={nodes}
            cursorNodes={cursorNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            awareness={awareness}
            onAddTable={addTable}
            onAddZone={addZone}
            onAddNote={addStickyNote}
          />
        </ReactFlowProvider>
      </div>
      {showImport && <ImportDialog projectId={project.id} user={user} onClose={() => setShowImport(false)} />}
      {showExport && liveProject && (
        <ExportDialog projectId={project.id} projectName={project.name} onClose={() => setShowExport(false)} />
      )}
      {showHistory && liveProject && (
        <HistoryPanel
          projectId={project.id}
          currentProject={liveProject}
          user={user}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showValidation && <ValidationPanel issues={validationIssues} onClose={() => setShowValidation(false)} />}
    </div>
  );
}

/**
 * Split out from `ProjectEditor` so it can call `useReactFlow()` — that hook
 * only works inside a `ReactFlowProvider`, and `screenToFlowPosition` is what
 * turns a mouse move into the flow-space coordinate broadcast as this user's
 * cursor, so peers' `CursorNode`s land in the right spot regardless of each
 * viewer's own pan/zoom.
 */
interface CanvasContextMenuState {
  screenX: number;
  screenY: number;
  flowPosition: { x: number; y: number };
}

/** Right-click-on-empty-canvas menu — the only way to add a table/zone/sticky note besides editing DBML directly. */
function CanvasContextMenu(props: {
  menu: CanvasContextMenuState;
  onAddTable: (position: { x: number; y: number }) => void;
  onAddZone: (position: { x: number; y: number }) => void;
  onAddNote: (position: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  const { menu } = props;
  const run = (fn: (position: { x: number; y: number }) => void) => {
    fn(menu.flowPosition);
    props.onClose();
  };
  return (
    <div className="context-menu" style={{ left: menu.screenX, top: menu.screenY }} onClick={(e) => e.stopPropagation()}>
      <button className="context-menu-item" onClick={() => run(props.onAddTable)}>
        <TableIcon size={14} /> Add table
      </button>
      <button className="context-menu-item" onClick={() => run(props.onAddZone)}>
        <FrameIcon size={14} /> Add zone
      </button>
      <button className="context-menu-item" onClick={() => run(props.onAddNote)}>
        <NoteIcon size={14} /> Add sticky note
      </button>
    </div>
  );
}

function CanvasArea(props: {
  nodes: CanvasNode[];
  cursorNodes: CursorNodeType[];
  edges: RefEdgeType[];
  onNodesChange: (changes: NodeChange<AllNodes>[]) => void;
  awareness: Awareness | null;
  onAddTable: (position: { x: number; y: number }) => void;
  onAddZone: (position: { x: number; y: number }) => void;
  onAddNote: (position: { x: number; y: number }) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState<CanvasContextMenuState | null>(null);

  const handleMouseMove = (e: ReactMouseEvent) => {
    props.awareness?.setLocalStateField("cursor", screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };
  const handleMouseLeave = () => {
    props.awareness?.setLocalStateField("cursor", null);
  };

  const closeMenu = useCallback(() => setMenu(null), []);

  const handlePaneContextMenu = useCallback(
    (e: ReactMouseEvent | MouseEvent) => {
      e.preventDefault();
      setMenu({
        screenX: e.clientX,
        screenY: e.clientY,
        flowPosition: screenToFlowPosition({ x: e.clientX, y: e.clientY }),
      });
    },
    [screenToFlowPosition],
  );

  useEffect(() => {
    if (!menu) return;
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    window.addEventListener("click", closeMenu);
    window.addEventListener("wheel", closeMenu);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("wheel", closeMenu);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menu, closeMenu]);

  const nodes: AllNodes[] = [...props.nodes, ...props.cursorNodes];

  return (
    <div className="canvas-pane" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <ReactFlow
        nodes={nodes}
        edges={props.edges}
        onNodesChange={props.onNodesChange}
        onPaneContextMenu={handlePaneContextMenu}
        onMoveStart={closeMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={["Backspace", "Delete"]}
        snapToGrid
        snapGrid={[10, 10]}
        fitView
      >
        <Background color="#33353c" gap={20} />
        <Controls />
        <MiniMap pannable zoomable bgColor="#1f2024" nodeColor="#4b4d8a" maskColor="rgba(23,24,27,0.75)" />
      </ReactFlow>
      {menu && (
        <CanvasContextMenu
          menu={menu}
          onAddTable={props.onAddTable}
          onAddZone={props.onAddZone}
          onAddNote={props.onAddNote}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

function Modal(props: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className={`modal${props.wide ? " modal-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{props.title}</span>
          <button className="btn btn-icon btn-ghost" onClick={props.onClose} title="Close">
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
      </div>
    </div>
  );
}

function FormatSelect(props: { value: ExportFormat; onChange: (v: ExportFormat) => void }) {
  return (
    <select className="select" value={props.value} onChange={(e) => props.onChange(e.target.value as ExportFormat)}>
      <option value="dbml">DBML</option>
      <option value="postgres">SQL — Postgres</option>
      <option value="mysql">SQL — MySQL</option>
      <option value="mssql">SQL — SQL Server</option>
    </select>
  );
}

function ImportDialog(props: { projectId: string; user: string; onClose: () => void }) {
  const [source, setSource] = useState("");
  const [format, setFormat] = useState<ExportFormat>("dbml");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!source.trim()) return;
    setBusy(true);
    setError(null);
    const body: { source: string; dialect?: SqlDialect } = { source };
    if (format !== "dbml") body.dialect = format;
    try {
      const res = await fetch(`/api/projects/${props.projectId}/import?user=${encodeURIComponent(props.user)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        props.onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Import failed (${res.status})`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Import schema" onClose={props.onClose}>
      <p className="modal-hint">
        Matches tables/fields by name — existing positions and detail levels are kept; anything no longer in the source
        is removed.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <FormatSelect value={format} onChange={setFormat} />
        <button className="btn btn-primary" onClick={submit} disabled={busy || !source.trim()}>
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
      <textarea
        className="textarea textarea-code"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder={format === "dbml" ? "Paste DBML…" : "Paste SQL DDL…"}
        style={{ width: "100%", height: 320 }}
      />
      {error && <div className="modal-error">{error}</div>}
    </Modal>
  );
}

function ExportDialog(props: { projectId: string; projectName: string; onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>("dbml");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this same effect kicks off
    setBusy(true);
    const url =
      format === "dbml"
        ? `/api/projects/${props.projectId}/export/dbml?visual=1`
        : `/api/projects/${props.projectId}/export/sql?dialect=${format}`;
    fetch(url)
      .then(async (res) => setText(res.ok ? await res.text() : `Error: ${res.status}`))
      .finally(() => setBusy(false));
  }, [format, props.projectId]);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const download = () => {
    const ext = format === "dbml" ? "dbml" : "sql";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.projectName}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Export schema" onClose={props.onClose}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <FormatSelect value={format} onChange={setFormat} />
        <button className="btn" onClick={copy} disabled={busy}>
          {copied ? "Copied" : "Copy"}
        </button>
        <button className="btn btn-primary" onClick={download} disabled={busy}>
          <DownloadIcon size={13} /> Download
        </button>
      </div>
      <textarea
        readOnly
        className="textarea textarea-code"
        value={busy ? "Loading…" : text}
        style={{ width: "100%", height: 320 }}
      />
    </Modal>
  );
}

type SyncStatus = "idle" | "typing" | "syncing" | "synced" | "error";

function SyncStatusPill({ status }: { status: SyncStatus }) {
  if (status === "idle") return null;
  const dotClass = status === "synced" ? "sync-dot-synced" : status === "error" ? "sync-dot-error" : "sync-dot-syncing";
  const label = { idle: "", typing: "Editing…", syncing: "Syncing…", synced: "Synced", error: "Sync error" }[status];
  return (
    <span className="sync-status">
      <span className={`sync-dot ${dotClass}`} />
      {label}
    </span>
  );
}

const DBML_SYNC_DEBOUNCE_MS = 600;

/**
 * Live DBML view of the project — edits sync to the canvas automatically as
 * you type, debounced, rather than requiring an explicit "Apply". Text comes
 * from the server's `/export/dbml` (same route `ExportDialog` uses) rather
 * than generating it client-side — `dbml-engine` wraps `@dbml/core`, which
 * instantiates a parser at module scope, so importing even the pure-string
 * `projectToDbml` from it would drag that whole (multi-MB) parser library
 * into the browser bundle. Re-fetches on every remote doc change *unless*
 * the user has unconfirmed local edits ("dirty") — otherwise a peer's edit
 * would silently overwrite what they're typing. Auto-sync POSTs to the same
 * `/import` route `ImportDialog` uses, which merges by name server-side so
 * tables/fields untouched by the edit keep their id, position, and detail
 * level rather than resetting.
 *
 * Known limitation: because this round-trips through the server (parsing has
 * to stay server-side — see above), edits made here arrive back over the
 * WebSocket like any remote change and so fall outside the local
 * `Y.UndoManager`'s tracked origins. Ctrl+Z undoes canvas edits but not DBML
 * panel edits; only the "Restore this revision" history flow can revert them.
 */
function DbmlPanel(props: { project: Project; projectId: string; user: string; onClose: () => void }) {
  const { project, projectId, user } = props;
  const [text, setText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  // executeEdits() below fires Monaco's onDidChangeModelContent same as a
  // real keystroke would — @monaco-editor/react only suppresses that for
  // edits *it* drives via the controlled `value` prop, not edits made
  // directly through the editor API. Without this flag, our own remote-sync
  // replace loops back through `handleChange` as if the user had just typed
  // the (already-applied) server text, marking the doc dirty and
  // re-POSTing it to /import — a redundant round-trip at best, and a race
  // that can transiently wipe content at worst when it overlaps a real edit.
  const suppressNextChangeRef = useRef(false);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // Server-reformatted DBML replaces the editor's content on every sync (own
  // edits included, once the debounce round-trips). A plain `setText` would
  // hand that new value to Monaco as a full-document replace with no
  // explicit cursor target, which snaps the caret to wherever Monaco's
  // default post-edit position lands — reported as the view "jumping"
  // mid-type. Driving the replace through the editor API directly lets us
  // snapshot/restore cursor, selection and scroll position around it.
  //
  // The server always emits LF, but Monaco's default model EOL is CRLF on
  // Windows — left unnormalized, that alone makes every single refetch look
  // "changed" and forces a full-buffer replace even when nothing meaningful
  // did. Normalizing to the model's own EOL first means a same-content sync
  // is a true no-op (no replace, no jump), and keeps `text` state in the
  // model's EOL convention so the Editor's own controlled-value diff doesn't
  // independently detect a (spurious) mismatch and redo the replace itself.
  const setTextPreservingView = (next: string) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) {
      setText(next);
      return;
    }
    const normalized = next.replace(/\r\n|\n/g, model.getEOL());
    if (model.getValue() !== normalized) {
      suppressNextChangeRef.current = true;
      const viewState = editor.saveViewState();
      editor.executeEdits("remote-sync", [{ range: model.getFullModelRange(), text: normalized }]);
      if (viewState) editor.restoreViewState(viewState);
    }
    setText(normalized);
  };

  const refetch = () => {
    fetch(`/api/projects/${projectId}/export/dbml`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`export failed (${res.status})`))))
      .then((dbml) => {
        setTextPreservingView(dbml);
        setStatus("synced");
      })
      .catch((err) => setError((err as Error).message));
  };

  useEffect(() => {
    if (!dirty) refetch();
    // project is a new object on every doc change (see useProjectDoc), so it's
    // exactly the "something changed remotely" signal this should refetch on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, dirty]);

  const applyNow = useCallback(
    (source: string) => {
      setStatus("syncing");
      fetch(`/api/projects/${projectId}/import?user=${encodeURIComponent(user)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      })
        .then(async (res) => {
          if (res.ok) {
            setDirty(false);
            setError(null);
            setStatus("synced");
          } else {
            const data = await res.json().catch(() => ({}));
            setError(data.error ?? `Import failed (${res.status})`);
            setStatus("error");
          }
        })
        .catch((err) => {
          setError((err as Error).message);
          setStatus("error");
        });
    },
    [projectId, user],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (value: string | undefined) => {
    if (suppressNextChangeRef.current) {
      suppressNextChangeRef.current = false;
      return;
    }
    const next = value ?? "";
    setText(next);
    setDirty(true);
    setStatus("typing");
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyNow(next), DBML_SYNC_DEBOUNCE_MS);
  };

  return (
    <div className="side-panel nokey" style={{ width: 440 }}>
      <div className="panel-header">
        <CodeIcon size={14} style={{ color: "var(--color-text-muted)" }} />
        <span className="panel-title">DBML</span>
        <SyncStatusPill status={status} />
        <span style={{ marginLeft: "auto" }} />
        <button className="btn btn-icon btn-ghost" onClick={props.onClose} title="Collapse editor">
          <ChevronLeftIcon size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          language="dbml"
          theme="vs-dark"
          value={text}
          onChange={handleChange}
          onMount={handleMount}
          options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, padding: { top: 10 } }}
        />
      </div>
      {error && (
        <div className="modal-error" style={{ margin: 8, borderRadius: "var(--radius-sm)" }}>
          {error}
        </div>
      )}
    </div>
  );
}

const DIFF_ROW_CLASS: Record<ChangeStatus, string> = {
  added: "diff-added",
  removed: "diff-removed",
  changed: "diff-changed",
};
const DIFF_SIGN: Record<ChangeStatus, string> = { added: "+", removed: "-", changed: "~" };

function DiffSummary(props: { diff: ProjectDiff }) {
  const { tables, refs } = props.diff;
  if (tables.length === 0 && refs.length === 0) {
    return <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>No schema changes since this revision.</div>;
  }
  return (
    <div>
      {tables.map((t) => (
        <div key={t.id} className={`diff-row ${DIFF_ROW_CLASS[t.status]}`}>
          {DIFF_SIGN[t.status]} Table {t.renamedFrom ? `${t.renamedFrom} → ${t.name}` : t.name}
          {t.fields.length > 0 && (
            <span style={{ color: "var(--color-text-muted)" }}>
              {" "}
              ({t.fields.map((f) => `${DIFF_SIGN[f.status]}${f.name}`).join(", ")})
            </span>
          )}
        </div>
      ))}
      {refs.map((r) => (
        <div key={r.id} className={`diff-row ${DIFF_ROW_CLASS[r.status]}`}>
          {DIFF_SIGN[r.status]} Ref{(r.after ?? r.before)?.name ? ` ${(r.after ?? r.before)!.name}` : ""}
        </div>
      ))}
    </div>
  );
}

/**
 * Revision timeline: list of past revisions (author + timestamp), DBML
 * preview of whichever one is selected (via the export-at-revision route,
 * mirroring `reconstructDocAtRevision`), a schema-level diff against the
 * current live state (`diffProjects` — safe to use client-side, unlike
 * `dbml.ts`'s exports, since it has no `@dbml/core` import to drag in), and a
 * restore button hitting the existing non-destructive restore endpoint
 * (creates a new revision rather than rewriting history).
 */
function HistoryPanel(props: { projectId: string; currentProject: Project; user: string; onClose: () => void }) {
  const [revisions, setRevisions] = useState<RevisionMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [diff, setDiff] = useState<ProjectDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${props.projectId}/revisions`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`list failed (${res.status})`))))
      .then((revs: RevisionMeta[]) => {
        setRevisions(revs);
        if (revs.length > 0) setSelectedId(revs[revs.length - 1].id);
      })
      .catch((err) => setError((err as Error).message));
  }, [props.projectId]);

  useEffect(() => {
    if (!selectedId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this same effect kicks off
    setBusy(true);
    Promise.all([
      fetch(`/api/projects/${props.projectId}/revisions/${selectedId}/export/dbml`).then((res) =>
        res.ok ? res.text() : Promise.reject(new Error(`preview failed (${res.status})`)),
      ),
      fetch(`/api/projects/${props.projectId}/revisions/${selectedId}`).then((res) =>
        res.ok ? (res.json() as Promise<Project>) : Promise.reject(new Error(`diff fetch failed (${res.status})`)),
      ),
    ])
      .then(([dbml, revisionProject]) => {
        setPreview(dbml);
        setDiff(diffProjects(revisionProject, props.currentProject));
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setBusy(false));
    // currentProject deliberately excluded: it's a new object on every doc
    // change, and re-diffing on every remote edit while the panel is open
    // would be noisy — the comparison point is "this revision vs. what's on
    // screen when I opened the panel / picked this revision".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, props.projectId]);

  const saveLabel = async () => {
    if (!selectedId || !labelInputRef.current) return;
    const label = labelInputRef.current.value.trim();
    setSavingLabel(true);
    try {
      const res = await fetch(`/api/projects/${props.projectId}/revisions/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || null }),
      });
      if (res.ok) {
        setRevisions((revs) => revs.map((r) => (r.id === selectedId ? { ...r, label: label || null } : r)));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Label failed (${res.status})`);
      }
    } finally {
      setSavingLabel(false);
    }
  };

  const restore = async () => {
    if (!selectedId) return;
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/projects/${props.projectId}/revisions/${selectedId}/restore?user=${encodeURIComponent(props.user)}`,
        { method: "POST" },
      );
      if (res.ok) {
        props.onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Restore failed (${res.status})`);
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal title="History" onClose={props.onClose} wide>
      <div className="history-layout">
        <ul className="history-list">
          {revisions.map((rev) => (
            <li key={rev.id}>
              <button
                className={`history-item${rev.id === selectedId ? " history-item-active" : ""}`}
                onClick={() => setSelectedId(rev.id)}
              >
                <div className="history-item-title">{rev.label ? `🏷 ${rev.label}` : rev.author}</div>
                <div className="history-item-sub">
                  {rev.label ? `${rev.author} · ${rev.createdAt}` : rev.createdAt}
                </div>
              </button>
            </li>
          ))}
          {revisions.length === 0 && (
            <li style={{ padding: 8, color: "var(--color-text-muted)", fontSize: 12 }}>No revisions yet.</li>
          )}
        </ul>
        <div className="history-detail">
          <div className="history-detail-toolbar">
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              <input
                key={selectedId}
                ref={labelInputRef}
                className="input"
                defaultValue={revisions.find((r) => r.id === selectedId)?.label ?? ""}
                placeholder="Checkpoint name (e.g. v1.0)"
                disabled={!selectedId}
                style={{ flex: 1 }}
              />
              <button className="btn btn-sm" onClick={saveLabel} disabled={!selectedId || savingLabel}>
                {savingLabel ? "Saving…" : "Label"}
              </button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={restore} disabled={!selectedId || restoring}>
              {restoring ? "Restoring…" : "Restore this revision"}
            </button>
          </div>
          <div className="history-diff-box">
            <div className="history-diff-title">Changes since this revision</div>
            {busy ? (
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Loading…</div>
            ) : (
              diff && <DiffSummary diff={diff} />
            )}
          </div>
          <textarea
            readOnly
            className="textarea textarea-code"
            value={busy ? "Loading…" : preview}
            style={{ flex: 1 }}
          />
        </div>
      </div>
      {error && <div className="modal-error">{error}</div>}
    </Modal>
  );
}

const SEVERITY_ICON: Record<ValidationIssue["severity"], (p: IconProps) => ReactNode> = {
  error: (p) => <AlertTriangleIcon {...p} />,
  warning: (p) => <AlertTriangleIcon {...p} />,
};

/** Structural check (`validateProject`, computed client-side — it's pure `Project` analysis with no `@dbml/core` dependency, safe to run on every doc change). Informational only — nothing here blocks editing. */
function ValidationPanel(props: { issues: ValidationIssue[]; onClose: () => void }) {
  return (
    <Modal title="Validation" onClose={props.onClose}>
      {props.issues.length === 0 ? (
        <div className="validation-empty">
          <CheckCircleIcon size={16} /> No issues found.
        </div>
      ) : (
        <div className="validation-list">
          {props.issues.map((issue, i) => (
            <div key={i} className={`validation-row validation-row-${issue.severity}`}>
              {SEVERITY_ICON[issue.severity]({ size: 14, style: { marginTop: 2, flexShrink: 0 } })}
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
