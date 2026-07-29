import { useCallback, useEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type MutableRefObject } from "react";
import { ReactFlow, useReactFlow, Background, Controls, MiniMap, type NodeChange } from "@xyflow/react";
import type { Awareness } from "y-protocols/awareness.js";
import { TableNode } from "./TableNode.js";
import { RefEdge, type RefEdgeType } from "./RefEdge.js";
import { ZoneNode } from "./ZoneNode.js";
import { StickyNoteNode } from "./StickyNoteNode.js";
import { CursorNode, type CursorNodeType } from "./CursorNode.js";
import { FrameIcon, NoteIcon, TableIcon } from "./Icons.js";
import { loadViewport, viewportKey } from "./localPrefs.js";
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
  awareness: Awareness | null;
  onAddTable: (position: { x: number; y: number }) => void;
  onAddZone: (position: { x: number; y: number }) => void;
  onAddNote: (position: { x: number; y: number }) => void;
  fontScale: number;
  projectId: string;
  user: string;
  exportRef: MutableRefObject<CanvasExportHandle | null>;
}) {
  const { screenToFlowPosition, fitView, getViewport, setViewport } = useReactFlow();
  const [menu, setMenu] = useState<CanvasContextMenuState | null>(null);
  // Lazy initializer: read once at mount, not on every render — this decides
  // whether the very first render asks React Flow to `fitView` or restore
  // exactly where this user left the canvas last time.
  const [initialViewport] = useState(() => loadViewport(props.projectId, props.user));

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
        onPaneContextMenu={handlePaneContextMenu}
        onMoveStart={closeMenu}
        onMoveEnd={(_, viewport) => localStorage.setItem(viewportKey(props.projectId, props.user), JSON.stringify(viewport))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={["Backspace", "Delete"]}
        snapToGrid
        snapGrid={[10, 10]}
        fitView={!initialViewport}
        defaultViewport={initialViewport ?? undefined}
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
