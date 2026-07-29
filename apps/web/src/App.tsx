import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider, MarkerType, applyNodeChanges, type Connection, type NodeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  getMetaMap,
  getRefsMap,
  getStickyNotesMap,
  getTablesMap,
  getZonesMap,
  type Comment,
  type DetailLevel,
  type Field,
  type RoutingPoint,
} from "@athanordb/shared";
import { validateProject, type ValidationIssue } from "@athanordb/dbml-engine";
import { useProjectDoc } from "./useProjectDoc.js";
import { useAwarenessStates } from "./useAwarenessStates.js";
import { computeAutoLayout } from "./autoLayout.js";
import { hashColor } from "./awarenessColor.js";
import { DEFAULT_PALETTE } from "./ColorSwatchPicker.js";
import { CARDINALITY_STYLE, type RefEdgeType } from "./RefEdge.js";
import { type ZoneNodeType } from "./ZoneNode.js";
import { type StickyNoteNodeType } from "./StickyNoteNode.js";
import { type CursorNodeType } from "./CursorNode.js";
import { type TableNodeType } from "./TableNode.js";
import { PresenceList } from "./PresenceList.js";
import { CanvasArea } from "./CanvasArea.js";
import { ProjectList } from "./ProjectList.js";
import { Login } from "./Login.js";
import { AcceptInvite } from "./AcceptInvite.js";
import { AdminConsole } from "./AdminConsole.js";
import { ChangePasswordModal } from "./ChangePasswordModal.js";
import { FONT_SCALE_KEY, FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP, loadFontScale, loadHighlightLinks, saveHighlightLinks } from "./localPrefs.js";
import type { CanvasExportHandle, CanvasNode, ProjectStatus, ProjectSummary, Session } from "./types.js";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  DownloadIcon,
  KeyIcon,
  LayoutGridIcon,
  LogOutIcon,
  LogoMarkIcon,
  RedoIcon,
  ShieldCheckIcon,
  UndoIcon,
  UploadIcon,
  UsersIcon,
} from "./Icons.js";

// Each of these is only needed once a specific panel/dialog is actually
// opened — Monaco (DbmlPanel) especially, which used to load eagerly for
// every visit including the project-list page that never touches it.
const DbmlPanel = lazy(() => import("./DbmlPanel.js"));
const ImportDialog = lazy(() => import("./ImportDialog.js"));
const ExportDialog = lazy(() => import("./ExportDialog.js"));
const HistoryPanel = lazy(() => import("./HistoryPanel.js"));
const ValidationPanel = lazy(() => import("./ValidationPanel.js"));

/** The display-name input shared by the project-list header and the in-project toolbar — local draft, committed via PATCH /api/users/me on blur/Enter rather than firing a network call per keystroke. */
function DisplayNameField(props: { value: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(props.value);
  // Adjust state during render (React's documented pattern for "reset state
  // when a prop changes") rather than in an effect — same idiom already used
  // for `builtNodes`/`prevBuiltNodes` below — avoids an extra render pass.
  const [prevValue, setPrevValue] = useState(props.value);
  if (props.value !== prevValue) {
    setPrevValue(props.value);
    setDraft(props.value);
  }
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== props.value) props.onCommit(trimmed);
    else setDraft(props.value);
  };
  return (
    <label className="user-field">
      <input
        className="input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        size={10}
        title="Your display name"
      />
    </label>
  );
}

export function App() {
  // A freshly-loaded (not client-navigated) `/invite/:token` link is the one
  // path this app treats as a URL rather than in-memory state — read once at
  // mount, matching the app's existing "no router" idiom everywhere else.
  const [inviteToken] = useState(() => location.pathname.match(/^\/invite\/([^/]+)$/)?.[1] ?? null);
  // Same idea for `/project/:id` — lets a bookmarked or shared link deep-link
  // straight into a project once the session/permission check clears.
  const [initialProjectId] = useState(() => location.pathname.match(/^\/project\/([^/]+)$/)?.[1] ?? null);
  const [session, setSession] = useState<Session | null | "loading">("loading");
  const [adminOpen, setAdminOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "ok" | "down">("checking");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [openProject, setOpenProject] = useState<ProjectSummary | null>(null);
  const [openLinkError, setOpenLinkError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Keeps the address bar in sync with which project is open, so the URL is
  // a valid direct link (bookmark, share) back to that project.
  const openProjectAndNavigate = (p: ProjectSummary) => {
    setOpenLinkError(null);
    setOpenProject(p);
    history.pushState(null, "", `/project/${p.id}`);
  };

  const closeProject = () => {
    setOpenProject(null);
    history.pushState(null, "", "/");
  };

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
    fetch("/api/auth/me")
      .then((r) => (r.ok ? (r.json() as Promise<Session>) : null))
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (session && session !== "loading") refreshProjects();
  }, [session]);

  // Resolves a deep-linked `/project/:id` once we know who's logged in — the
  // list fetch above races this, so this asks the server directly rather than
  // waiting on `projects` (and the endpoint enforces permission either way).
  useEffect(() => {
    if (!initialProjectId || !session || session === "loading" || openProject) return;
    fetch(`/api/projects/${initialProjectId}`)
      .then(async (r) => {
        if (r.ok) {
          setOpenProject(await r.json());
          return;
        }
        history.replaceState(null, "", "/");
        setOpenLinkError(
          r.status === 404 ? "That project no longer exists." : "You don't have access to that project.",
        );
      })
      .catch(() => history.replaceState(null, "", "/"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId, session]);

  // Mirrors browser back/forward on `/project/:id` <-> `/` to in-memory state.
  useEffect(() => {
    const onPopState = () => {
      const id = location.pathname.match(/^\/project\/([^/]+)$/)?.[1] ?? null;
      if (!id) {
        setOpenProject(null);
        return;
      }
      const found = projects.find((p) => p.id === id);
      if (found) {
        setOpenProject(found);
        return;
      }
      fetch(`/api/projects/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((p) => setOpenProject(p))
        .catch(() => setOpenProject(null));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [projects]);

  useEffect(() => {
    document.title = openProject ? `${openProject.name} · AthanorDB` : "AthanorDB";
  }, [openProject]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    setOpenProject(null);
    setAdminOpen(false);
    setProjects([]);
    history.replaceState(null, "", "/");
  };

  const updateDisplayName = async (name: string) => {
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name }),
    });
    if (res.ok) setSession(await res.json());
  };

  const createProject = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreateError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewName("");
        refreshProjects();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setCreateError(data.error ?? `Create failed (${res.status})`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Network error");
    }
  };

  const renameProject = async (p: ProjectSummary, name: string) => {
    const res = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) refreshProjects();
  };

  const setProjectStatus = async (p: ProjectSummary, status: ProjectStatus) => {
    const res = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) refreshProjects();
  };

  const deleteProjectForever = async (p: ProjectSummary): Promise<string | null> => {
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      refreshProjects();
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data.error ?? `Delete failed (${res.status})`;
  };

  const emptyTrash = async (items: ProjectSummary[]): Promise<string | null> => {
    const results = await Promise.all(items.map((p) => fetch(`/api/projects/${p.id}`, { method: "DELETE" })));
    refreshProjects();
    const failedCount = results.filter((r) => !r.ok).length;
    return failedCount > 0 ? `${failedCount} project(s) could not be deleted.` : null;
  };

  const statusDotClass =
    serverStatus === "ok" ? "status-dot-ok" : serverStatus === "down" ? "status-dot-down" : "status-dot-checking";

  if (inviteToken) {
    return (
      <div className="app-shell">
        <AcceptInvite
          token={inviteToken}
          onLoggedIn={(s) => {
            setSession(s);
            window.history.replaceState(null, "", "/");
          }}
        />
      </div>
    );
  }

  if (session === "loading") {
    return <div className="app-shell" />;
  }

  if (!session) {
    return (
      <div className="app-shell">
        <Login onLoggedIn={setSession} />
      </div>
    );
  }

  if (adminOpen) {
    return <AdminConsole onClose={() => setAdminOpen(false)} />;
  }

  if (openProject) {
    return (
      <div className="app-shell">
        <ProjectEditor
          project={openProject}
          user={session.displayName}
          userId={session.id}
          onDisplayNameChange={updateDisplayName}
          onBack={closeProject}
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
        {session.isAdmin && (
          <button className="btn btn-sm" onClick={() => setAdminOpen(true)} title="Admin console">
            <UsersIcon size={13} /> Admin
          </button>
        )}
        <DisplayNameField value={session.displayName} onCommit={updateDisplayName} />
        <button className="btn btn-icon btn-ghost" onClick={() => setShowChangePassword(true)} title="Change password">
          <KeyIcon size={14} />
        </button>
        <button className="btn btn-icon btn-ghost" onClick={logout} title="Log out">
          <LogOutIcon size={15} />
        </button>
      </header>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {openLinkError && <div className="modal-error">{openLinkError}</div>}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ProjectList
          projects={projects}
          newName={newName}
          onNewNameChange={(v) => {
            setNewName(v);
            setCreateError(null);
          }}
          onCreate={createProject}
          createError={createError}
          onOpen={openProjectAndNavigate}
          onRename={renameProject}
          onSetStatus={setProjectStatus}
          onDeleteForever={deleteProjectForever}
          onEmptyTrash={emptyTrash}
        />
      </div>
    </div>
  );
}

// Fallback size used the instant a table/zone/sticky mounts, before React
// Flow's ResizeObserver reports its real `measured` box — self-corrects on
// the next render once the real size lands, so accuracy here barely matters.
const DEFAULT_TABLE_WIDTH = 220;
const DEFAULT_TABLE_HEIGHT = 120;

interface TableBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Chooses which side (left/right) each end of a ref should exit/enter from.
 * Side-by-side tables get opposite sides (exit toward the other table, the
 * shortest path). Vertically stacked tables — bounding boxes overlap on X —
 * get the *same* side instead: opposite sides would force the smoothstep
 * router to swing all the way across the full table width and back just to
 * reach the far side, an unnecessary detour for tables sitting one above
 * the other.
 */
function pickHandleSides(from: TableBox, to: TableBox): { fromSide: "left" | "right"; toSide: "left" | "right" } {
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const overlapX = (from.width + to.width) / 2 - Math.abs(dx);
  const overlapY = (from.height + to.height) / 2 - Math.abs(dy);
  const stackedVertically = overlapX > 0 && overlapY <= 0;

  if (stackedVertically) {
    const side = dx >= 0 ? "right" : "left";
    return { fromSide: side, toSide: side };
  }
  return dx >= 0 ? { fromSide: "right", toSide: "left" } : { fromSide: "left", toSide: "right" };
}

function ProjectEditor(props: {
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
  const [fontScale, setFontScale] = useState(loadFontScale);
  const [highlightLinks, setHighlightLinks] = useState(loadHighlightLinks);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);

  const handleHighlightLinksChange = (val: boolean) => {
    setHighlightLinks(val);
    saveHighlightLinks(val);
  };

  useEffect(() => {
    localStorage.setItem(FONT_SCALE_KEY, String(fontScale));
  }, [fontScale]);

  const adjustFontScale = (delta: number) => {
    setFontScale((v) => Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, Math.round((v + delta) * 100) / 100)));
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

    const palette = liveProject.paletteColors ?? DEFAULT_PALETTE;
    const onPaletteChange = (next: string[]) => {
      getMetaMap(doc).set("paletteColors", next);
    };

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
        palette,
        onPaletteChange,
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
        highlightLinks,
        currentUser: user,
        palette,
        onPaletteChange,
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
        onAddComment: (text: string, fieldId?: string) => {
          const tables = getTablesMap(doc);
          const current = tables.get(table.id);
          if (!current) return;
          const comment: Comment = { id: crypto.randomUUID(), author: user, text, createdAt: new Date().toISOString(), fieldId };
          tables.set(table.id, { ...current, comments: [...(current.comments ?? []), comment] });
        },
        onDeleteComment: (commentId: string) => {
          const tables = getTablesMap(doc);
          const current = tables.get(table.id);
          if (!current) return;
          tables.set(table.id, { ...current, comments: (current.comments ?? []).filter((c) => c.id !== commentId) });
        },
        onUpdateField: (fieldId: string, updates: Partial<Field>) => {
          const tables = getTablesMap(doc);
          const current = tables.get(table.id);
          if (!current) return;
          const updatedFields = current.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f));
          tables.set(table.id, { ...current, fields: updatedFields });
        },
        onAddField: (fieldData: Omit<Field, "id">) => {
          const tables = getTablesMap(doc);
          const current = tables.get(table.id);
          if (!current) return;
          const newField: Field = { id: crypto.randomUUID(), ...fieldData };
          tables.set(table.id, { ...current, fields: [...current.fields, newField] });
        },
        onDeleteField: (fieldId: string) => {
          const tables = getTablesMap(doc);
          const current = tables.get(table.id);
          if (!current) return;
          const updatedFields = current.fields.filter((f) => f.id !== fieldId);
          const refs = getRefsMap(doc);
          doc.transact(() => {
            for (const [refId, ref] of refs.entries()) {
              if (
                (ref.from.tableId === table.id && ref.from.fieldId === fieldId) ||
                (ref.to.tableId === table.id && ref.to.fieldId === fieldId)
              ) {
                refs.delete(refId);
              }
            }
            tables.set(table.id, { ...current, fields: updatedFields });
          });
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
        palette,
        onPaletteChange,
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
  }, [liveProject, doc, refFieldIdsByTable, user, highlightLinks]);

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
    (changes: NodeChange<CanvasNode | CursorNodeType>[]) => {
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
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        Boolean(target.closest(".monaco-editor, .cm-editor, .nokey, [contenteditable='true']"))
      ) {
        return;
      }
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

  const onEdgesDelete = useCallback(
    (deletedEdges: RefEdgeType[]) => {
      if (!doc) return;
      const refs = getRefsMap(doc);
      doc.transact(() => {
        for (const edge of deletedEdges) {
          if (refs.has(edge.id)) {
            refs.delete(edge.id);
          }
        }
      });
    },
    [doc],
  );

  // A handle id is either `${fieldId}-left|right-source|target` for a field
  // row, or `header-left|right-source|target` for the table-header handle
  // (the only one rendered when the table is collapsed to "compact"). The
  // header handle has no specific field behind it, so it resolves to the
  // table's primary key — falling back to its first field — as the ref's
  // actual endpoint.
  const resolveConnectionField = useCallback(
    (tableId: string, handleId: string): string | null => {
      const table = liveProject?.tables.find((t) => t.id === tableId);
      if (!table) return null;
      const fieldId = handleId.replace(/-(left|right)-(source|target)$/, "");
      if (fieldId !== "header") return fieldId;
      return (table.fields.find((f) => f.pk) ?? table.fields[0])?.id ?? null;
    },
    [liveProject],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!doc || !connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
        return;
      }
      const fromFieldId = resolveConnectionField(connection.source, connection.sourceHandle);
      const toFieldId = resolveConnectionField(connection.target, connection.targetHandle);
      if (!fromFieldId || !toFieldId) return;
      // A field can't be its own foreign key.
      if (connection.source === connection.target && fromFieldId === toFieldId) return;

      const refs = getRefsMap(doc);
      const id = crypto.randomUUID();
      refs.set(id, {
        id,
        from: { tableId: connection.source, fieldId: fromFieldId },
        to: { tableId: connection.target, fieldId: toFieldId },
        cardinality: "one-to-many",
      });
    },
    [doc, resolveConnectionField],
  );

  const edges: RefEdgeType[] = useMemo(() => {
    if (!liveProject) return [];
    const tablesById = new Map(liveProject.tables.map((t) => [t.id, t]));
    const nodesById = new Map(nodes.map((n) => [n.id, n]));

    return liveProject.refs.map((ref) => {
      const fromTable = tablesById.get(ref.from.tableId);
      const toTable = tablesById.get(ref.to.tableId);

      const fromNode = nodesById.get(ref.from.tableId);
      const toNode = nodesById.get(ref.to.tableId);

      const connectedHighlight =
        hoveredTableId === ref.from.tableId ||
        hoveredTableId === ref.to.tableId ||
        Boolean(fromNode?.selected) ||
        Boolean(toNode?.selected);

      const fromBox: TableBox = {
        x: fromNode?.position.x ?? fromTable?.position.x ?? 0,
        y: fromNode?.position.y ?? fromTable?.position.y ?? 0,
        width: fromNode?.measured?.width ?? DEFAULT_TABLE_WIDTH,
        height: fromNode?.measured?.height ?? DEFAULT_TABLE_HEIGHT,
      };
      const toBox: TableBox = {
        x: toNode?.position.x ?? toTable?.position.x ?? 0,
        y: toNode?.position.y ?? toTable?.position.y ?? 0,
        width: toNode?.measured?.width ?? DEFAULT_TABLE_WIDTH,
        height: toNode?.measured?.height ?? DEFAULT_TABLE_HEIGHT,
      };

      const isSelfRef = ref.from.tableId === ref.to.tableId;
      const { fromSide, toSide } = pickHandleSides(fromBox, toBox);

      const fromCompact = fromTable?.detailLevel === "compact";
      const toCompact = toTable?.detailLevel === "compact";

      let sourceHandle: string;
      let targetHandle: string;

      if (isSelfRef) {
        sourceHandle = fromCompact ? "header-right-source" : `${ref.from.fieldId}-right-source`;
        targetHandle = toCompact ? "header-right-target" : `${ref.to.fieldId}-right-target`;
      } else {
        sourceHandle = fromCompact ? `header-${fromSide}-source` : `${ref.from.fieldId}-${fromSide}-source`;
        targetHandle = toCompact ? `header-${toSide}-target` : `${ref.to.fieldId}-${toSide}-target`;
      }

      return {
        id: ref.id,
        source: ref.from.tableId,
        target: ref.to.tableId,
        sourceHandle,
        targetHandle,
        type: "ref",
        data: {
          cardinality: ref.cardinality,
          routingPoints: ref.routingPoints,
          highlightLinks,
          connectedHighlight,
          onRoutingPointsChange: (routingPoints: RoutingPoint[] | undefined) => {
            if (!doc) return;
            const refs = getRefsMap(doc);
            const current = refs.get(ref.id);
            if (current) refs.set(ref.id, { ...current, routingPoints });
          },
          onDeleteRef: () => {
            if (!doc) return;
            const refs = getRefsMap(doc);
            refs.delete(ref.id);
          },
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: CARDINALITY_STYLE[ref.cardinality].stroke },
      };
    });
  }, [liveProject, doc, nodes, highlightLinks, hoveredTableId]);

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

  // Highlights a detail-level button only when every table currently shares that
  // level — once tables diverge (e.g. per-table override), no button is "active".
  const activeDetailLevel: DetailLevel | null = useMemo(() => {
    const tables = liveProject?.tables ?? [];
    if (tables.length === 0) return null;
    const [first, ...rest] = tables;
    return rest.every((t) => t.detailLevel === first.detailLevel) ? first.detailLevel : null;
  }, [liveProject]);

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
        {project.permission === "view" && <span className="badge-viewonly">View only</span>}
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
          <button
            className={`btn btn-sm${activeDetailLevel === "compact" ? " btn-active" : ""}`}
            onClick={() => setAllDetailLevels("compact")}
            title="Show only key fields"
          >
            Compact
          </button>
          <button
            className={`btn btn-sm${activeDetailLevel === "standard" ? " btn-active" : ""}`}
            onClick={() => setAllDetailLevels("standard")}
            title="Show primary/foreign keys"
          >
            Standard
          </button>
          <button
            className={`btn btn-sm${activeDetailLevel === "full" ? " btn-active" : ""}`}
            onClick={() => setAllDetailLevels("full")}
            title="Show all fields"
          >
            Full
          </button>
        </div>
        <span className="toolbar-divider" />
        <div className="toolbar-group font-scale-group" title="Canvas text size">
          <button
            className="btn btn-icon"
            onClick={() => adjustFontScale(-FONT_SCALE_STEP)}
            disabled={fontScale <= FONT_SCALE_MIN}
            title="Decrease canvas text size"
          >
            <span className="font-scale-label font-scale-label-sm">A</span>
          </button>
          <span className="font-scale-value">{Math.round(fontScale * 100)}%</span>
          <button
            className="btn btn-icon"
            onClick={() => adjustFontScale(FONT_SCALE_STEP)}
            disabled={fontScale >= FONT_SCALE_MAX}
            title="Increase canvas text size"
          >
            <span className="font-scale-label font-scale-label-lg">A</span>
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
        <DisplayNameField value={user} onCommit={props.onDisplayNameChange} />
        {!liveProject && <span className="status-pill">connecting…</span>}
      </header>
      <div className="canvas-container">
        {dbmlOpen && liveProject ? (
          <Suspense fallback={<div className="side-panel" style={{ width: 440 }} />}>
            <DbmlPanel project={liveProject} projectId={project.id} onClose={() => setDbmlOpen(false)} />
          </Suspense>
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
