import { useCallback, useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type MutableRefObject } from "react";
import {
  ReactFlow,
  useReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Panel,
  PanOnScrollMode,
  SelectionMode,
  type Connection,
  type NodeChange,
} from "@xyflow/react";
import type { Awareness } from "y-protocols/awareness.js";
import { TableNode } from "./TableNode.js";
import { RefEdge, type RefEdgeType } from "./RefEdge.js";
import { ZoneNode } from "./ZoneNode.js";
import { StickyNoteNode } from "./StickyNoteNode.js";
import { CursorNode, type CursorNodeType } from "./CursorNode.js";
import { FrameIcon, LinkIcon, MinimapIcon, NoteIcon, TableIcon } from "./Icons.js";
import { loadShowMinimap, loadViewport, saveShowMinimap, viewportKey } from "./localPrefs.js";
import type { AllNodes, CanvasExportHandle, CanvasNode } from "./types.js";

const nodeTypes = { table: TableNode, zone: ZoneNode, sticky: StickyNoteNode, cursor: CursorNode };
const edgeTypes = { ref: RefEdge };

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

/** Floating swatch row shown above the canvas once 2+ tables are selected — picking a color applies it to every selected table's header at once. */
function SelectionColorToolbar(props: { count: number; palette: string[]; onPick: (color: string) => void }) {
  return (
    <Panel position="top-center" className="nodrag nopan">
      <div className="selection-color-toolbar">
        <span className="selection-color-toolbar-label">{props.count} tables selected</span>
        <div className="color-popover-grid selection-color-toolbar-grid">
          {props.palette.map((c) => (
            <button
              key={c}
              type="button"
              className="color-swatch-cell"
              style={{ background: c }}
              onClick={() => props.onPick(c)}
              data-tooltip={c}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
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

export function CanvasArea(props: {
  nodes: CanvasNode[];
  cursorNodes: CursorNodeType[];
  edges: RefEdgeType[];
  onNodesChange: (changes: NodeChange<AllNodes>[]) => void;
  onEdgesDelete?: (edges: RefEdgeType[]) => void;
  /** Fires when the user drags a field handle to another field handle — creates a new ref (FK). */
  onConnect?: (connection: Connection) => void;
  awareness: Awareness | null;
  onAddTable: (position: { x: number; y: number }) => void;
  onAddZone: (position: { x: number; y: number }) => void;
  onAddNote: (position: { x: number; y: number }) => void;
  /** Applies a header color to every currently-selected table at once — shown by the selection toolbar once 2+ tables are selected. */
  onSetTablesColor: (tableIds: string[], color: string) => void;
  palette: string[];
  fontScale: number;
  highlightLinks: boolean;
  onHighlightLinksChange: (highlight: boolean) => void;
  /** Fires on table hover start/end (null on leave) — lets the parent highlight that table's refs. */
  onTableHoverChange: (tableId: string | null) => void;
  projectId: string;
  /** Session's stable user id — only used to namespace the saved-viewport localStorage key, not an identity/authorship field. */
  viewportUserId: string;
  exportRef: MutableRefObject<CanvasExportHandle | null>;
}) {
  const { screenToFlowPosition, fitView, getViewport, setViewport } = useReactFlow();
  const [menu, setMenu] = useState<CanvasContextMenuState | null>(null);
  const [showMinimap, setShowMinimap] = useState(loadShowMinimap);
  // Lazy initializer: read once at mount, not on every render — this decides
  // whether the very first render asks React Flow to `fitView` or restore
  // exactly where this user left the canvas last time.
  const [initialViewport] = useState(() => loadViewport(props.projectId, props.viewportUserId));

  // Exposed imperatively (not via props/state) because the Export dialog
  // that triggers this lives outside the ReactFlowProvider this component is
  // rendered inside — it has no other way to reach `fitView`/`getViewport`.
  // Cheap to reassign every render: pure closure construction, no DOM/side
  // effects until actually invoked.
  props.exportRef.current = {
    capture: async (format) => {
      const paneEl = document.querySelector(".react-flow__pane") as HTMLElement | null;
      if (!paneEl) throw new Error("Canvas is not ready yet");
      const prevViewport = getViewport();
      // Fit the *entire* diagram into the current pane size first — reuses
      // React Flow's own (already correct) fit logic instead of hand-rolling
      // bounds/zoom math, and means the export isn't just whatever happens
      // to be on-screen from the user's last pan/zoom.
      fitView({ padding: 0.15, duration: 0 });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const width = paneEl.clientWidth;
      const height = paneEl.clientHeight;
      try {
        // html-to-image is only needed for this one action — dynamic import
        // keeps it out of the bundle everyone loads just to view a diagram.
        const { toPng, toSvg } = await import("html-to-image");
        const options = { backgroundColor: "#17181b", width, height, pixelRatio: format === "png" ? 2 : 1 };
        const dataUrl = format === "png" ? await toPng(paneEl, options) : await toSvg(paneEl, options);
        return { dataUrl, width, height };
      } finally {
        setViewport(prevViewport, { duration: 0 });
      }
    },
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    props.awareness?.setLocalStateField("cursor", screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };
  const handleMouseLeave = () => {
    props.awareness?.setLocalStateField("cursor", null);
  };

  const closeMenu = useCallback(() => setMenu(null), []);

  const toggleMinimap = useCallback(() => {
    setShowMinimap((v) => {
      const next = !v;
      saveShowMinimap(next);
      return next;
    });
  }, []);

  const handleNodeMouseEnter = useCallback(
    (_e: ReactMouseEvent, node: AllNodes) => {
      if (node.type === "table") props.onTableHoverChange(node.id);
    },
    [props.onTableHoverChange],
  );
  const handleNodeMouseLeave = useCallback(
    (_e: ReactMouseEvent, node: AllNodes) => {
      if (node.type === "table") props.onTableHoverChange(null);
    },
    [props.onTableHoverChange],
  );

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

  // React Flow's built-in Controls buttons (fit view, toggle interactivity)
  // set their own native `title`, which reads inconsistently with the rest
  // of the app's themed tooltips — relabel them to `data-tooltip` so
  // <GlobalTooltip> picks them up instead. Runs once after mount; these
  // buttons don't change identity afterwards.
  useEffect(() => {
    const buttons = document.querySelectorAll<HTMLElement>(".react-flow__controls-button[title]");
    for (const btn of buttons) {
      const title = btn.getAttribute("title");
      if (!title) continue;
      btn.removeAttribute("title");
      btn.setAttribute("data-tooltip", title);
    }
  }, []);

  const nodes: AllNodes[] = [...props.nodes, ...props.cursorNodes];
  const selectedTableIds = props.nodes.filter((n) => n.type === "table" && n.selected).map((n) => n.id);

  return (
    <div
      className="canvas-pane"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ "--canvas-font-scale": props.fontScale } as CSSProperties}
    >
      <ReactFlow
        nodes={nodes}
        edges={props.edges}
        onNodesChange={props.onNodesChange}
        onEdgesDelete={props.onEdgesDelete}
        onConnect={props.onConnect}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onMoveStart={closeMenu}
        onMoveEnd={(_, viewport) =>
          localStorage.setItem(viewportKey(props.projectId, props.viewportUserId), JSON.stringify(viewport))
        }
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={["Backspace", "Delete"]}
        snapToGrid
        snapGrid={[10, 10]}
        fitView={!initialViewport}
        defaultViewport={initialViewport ?? undefined}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll={false}
        zoomActivationKeyCode="Control"
        minZoom={0.05}
      >
        <Background color="#33353c" gap={20} />
        <Controls showZoom={false}>
          <ControlButton
            onClick={() => props.onHighlightLinksChange(!props.highlightLinks)}
            data-tooltip={props.highlightLinks ? "Masquer la mise en évidence des liens et cardinalités" : "Mettre en évidence les liens et cardinalités"}
            aria-label="Toggle link highlight"
            style={{
              color: props.highlightLinks ? "#818cf8" : undefined,
              borderColor: props.highlightLinks ? "#6366f1" : undefined,
              background: props.highlightLinks ? "rgba(99, 102, 241, 0.25)" : undefined,
            }}
          >
            <LinkIcon size={14} />
          </ControlButton>
          <ControlButton
            onClick={toggleMinimap}
            data-tooltip={showMinimap ? "Masquer la minimap" : "Afficher la minimap"}
            aria-label="Toggle minimap"
            style={{
              color: showMinimap ? "#818cf8" : undefined,
              borderColor: showMinimap ? "#6366f1" : undefined,
              background: showMinimap ? "rgba(99, 102, 241, 0.25)" : undefined,
            }}
          >
            <MinimapIcon size={14} />
          </ControlButton>
        </Controls>
        {showMinimap && (
          <MiniMap pannable zoomable bgColor="#1f2024" nodeColor="#4b4d8a" maskColor="rgba(23,24,27,0.75)" />
        )}
        {selectedTableIds.length > 1 && (
          <SelectionColorToolbar
            count={selectedTableIds.length}
            palette={props.palette}
            onPick={(color) => props.onSetTablesColor(selectedTableIds, color)}
          />
        )}
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
