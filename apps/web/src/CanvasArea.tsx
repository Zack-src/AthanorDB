import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  useReactFlow,
  useStore,
  Background,
  MiniMap,
  Panel,
  PanOnScrollMode,
  SelectionMode,
  type Connection,
  type NodeChange,
} from "@xyflow/react";
import type { Awareness } from "y-protocols/awareness.js";
import type { DetailLevel } from "@athanordb/shared";
import { TableNode } from "./TableNode.js";
import { RefEdge, type RefEdgeType } from "./RefEdge.js";
import { ZoneNode } from "./ZoneNode.js";
import { StickyNoteNode } from "./StickyNoteNode.js";
import { EnumNode } from "./EnumNode.js";
import { TableGroupNode } from "./TableGroupNode.js";
import { CursorNode, type CursorNodeType } from "./CursorNode.js";
import {
  ChevronRightIcon,
  CloseIcon,
  FrameIcon,
  LayersIcon,
  LinkIcon,
  MinimapIcon,
  NoteIcon,
  PuzzleIcon,
  SearchIcon,
  TableIcon,
  TagIcon,
} from "./Icons.js";
import { FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP, loadShowMinimap, loadViewport, saveShowMinimap, viewportKey } from "./localPrefs.js";
import { CONTEXT_MENU_CLASS, CONTEXT_MENU_ITEM_CLASS } from "./ui/contextMenuStyles.js";
import {
  CANVAS_TOOLBAR_CLASS,
  CANVAS_TOOLBAR_DIVIDER_CLASS,
  CANVAS_TOOLBAR_ICON_BTN_CLASS,
  CANVAS_TOOLBAR_SEGMENT_ACTIVE_CLASS,
  CANVAS_TOOLBAR_SEGMENT_CLASS,
  CANVAS_TOOLBAR_TOGGLE_ACTIVE_CLASS,
} from "./ui/canvasToolbarStyles.js";
import { SWATCH_CELL_CLASS } from "./ColorSwatchPicker.js";
import type { CanvasCommandContribution, ResolvedContribution } from "./plugins/types.js";
import type { AllNodes, CanvasExportHandle, CanvasNode } from "./types.js";
import { DEFAULT_TABLE_HEIGHT, DEFAULT_TABLE_WIDTH } from "./refGeometry.js";

const nodeTypes = {
  table: TableNode,
  zone: ZoneNode,
  sticky: StickyNoteNode,
  enum: EnumNode,
  tablegroup: TableGroupNode,
  cursor: CursorNode,
};
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

/** Floating swatch row shown above the canvas once 2+ tables are selected — picking a color applies it to every selected table's header at once, "Group" bundles them into a named TableGroup. */
function SelectionColorToolbar(props: { count: number; palette: string[]; onPick: (color: string) => void; onGroup: () => void }) {
  return (
    <Panel position="top-center" className="nodrag nopan">
      <div className="flex flex-col items-start gap-1.5 rounded-md border border-border bg-surface-raised px-2.5 py-2 shadow-lg">
        <div className="flex w-full items-center justify-between gap-3">
          <span className="whitespace-nowrap text-xs text-text-muted">{props.count} tables selected</span>
          <button
            type="button"
            className="flex items-center gap-1 whitespace-nowrap rounded-md border border-border-strong/80 px-1.5 py-0.5 text-[11px] font-semibold text-text-secondary hover:border-primary/60 hover:text-text"
            onClick={props.onGroup}
            data-tooltip="Group into a TableGroup"
          >
            <LayersIcon size={12} /> Group
          </button>
        </div>
        <div className="grid grid-cols-10 gap-1.5">
          {props.palette.map((c) => (
            <button
              key={c}
              type="button"
              className={SWATCH_CELL_CLASS}
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
  onAddEnum: (position: { x: number; y: number }) => void;
  onClose: () => void;
}) {
  const { menu } = props;
  const run = (fn: (position: { x: number; y: number }) => void) => {
    fn(menu.flowPosition);
    props.onClose();
  };
  return (
    <div className={CONTEXT_MENU_CLASS} style={{ left: menu.screenX, top: menu.screenY }} onClick={(e) => e.stopPropagation()}>
      <button className={CONTEXT_MENU_ITEM_CLASS} onClick={() => run(props.onAddTable)}>
        <TableIcon size={14} /> Add table
      </button>
      <button className={CONTEXT_MENU_ITEM_CLASS} onClick={() => run(props.onAddZone)}>
        <FrameIcon size={14} /> Add zone
      </button>
      <button className={CONTEXT_MENU_ITEM_CLASS} onClick={() => run(props.onAddNote)}>
        <NoteIcon size={14} /> Add sticky note
      </button>
      <button className={CONTEXT_MENU_ITEM_CLASS} onClick={() => run(props.onAddEnum)}>
        <TagIcon size={14} /> Add enum
      </button>
    </div>
  );
}

/** Ctrl/Cmd+F floating search box — find a table by name and jump the viewport to it, Figma/dbdiagram-style. */
function CanvasSearchPanel(props: {
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  return (
    <Panel position="top-right" className="nodrag nopan">
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1.5 shadow-lg">
        <SearchIcon size={13} className="shrink-0 text-text-muted" />
        <input
          autoFocus
          value={props.query}
          onChange={(e) => props.onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) props.onPrev();
              else props.onNext();
            } else if (e.key === "Escape") {
              e.preventDefault();
              props.onClose();
            }
          }}
          placeholder="Find a table…"
          className="w-40 border-none bg-transparent text-xs text-text placeholder:text-text-muted focus:outline-none"
        />
        {props.query.trim() !== "" && (
          <span className="shrink-0 whitespace-nowrap text-[11px] text-text-muted">
            {props.matchCount > 0 ? `${props.activeIndex + 1}/${props.matchCount}` : "0/0"}
          </span>
        )}
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-text-muted enabled:hover:bg-surface-hover enabled:hover:text-text disabled:opacity-30"
          onClick={props.onPrev}
          disabled={props.matchCount === 0}
          data-tooltip="Previous match (Shift+Enter)"
        >
          ▲
        </button>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-text-muted enabled:hover:bg-surface-hover enabled:hover:text-text disabled:opacity-30"
          onClick={props.onNext}
          disabled={props.matchCount === 0}
          data-tooltip="Next match (Enter)"
        >
          ▼
        </button>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-text-muted hover:bg-surface-hover hover:text-text"
          onClick={props.onClose}
          data-tooltip="Close (Esc)"
        >
          <CloseIcon size={12} />
        </button>
      </div>
    </Panel>
  );
}

const DETAIL_LEVEL_LABEL: Record<DetailLevel, string> = { compact: "Compact", standard: "Standard", full: "Full" };
const DETAIL_LEVEL_HINT: Record<DetailLevel, string> = {
  compact: "Show only key fields",
  standard: "Show primary/foreign keys",
  full: "Show all fields",
};

/**
 * Popover behaviour shared by every dropdown in the floating toolbar (detail
 * level, zoom, plugins). The menu is portalled to `document.body` and anchored
 * *above* its trigger, since the toolbar sits at the bottom of the canvas.
 */
function ToolbarMenu(props: {
  /** Classes for the trigger button itself — it must be a real box, since the menu is anchored off its rect. */
  triggerClassName: (open: boolean) => string;
  triggerContent: ReactNode;
  tooltip: string;
  minWidth?: number;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; bottom: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // "click", not "mousedown": see ColorSwatchPicker — React Flow's pane
    // stops mousedown propagation for its own pan/drag handling.
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("click", handleOutsideClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", handleOutsideClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const width = props.minWidth ?? 180;
      setMenuPos({
        x: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
        bottom: window.innerHeight - rect.top + 8,
      });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={props.triggerClassName(open)}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        data-tooltip={props.tooltip}
        data-tooltip-pos="bottom"
      >
        {props.triggerContent}
      </button>
      {open &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className={CONTEXT_MENU_CLASS}
            style={{ left: menuPos.x, bottom: menuPos.bottom, minWidth: props.minWidth ?? 180 }}
          >
            {props.children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Detail-level toolbar control — a single button opening a popover list instead of three always-visible segments, so the floating toolbar stays compact. */
function DetailLevelDropdown(props: { value: DetailLevel | null; onChange: (level: DetailLevel) => void }) {
  return (
    <ToolbarMenu
      tooltip="Detail level"
      triggerClassName={(open) => `${CANVAS_TOOLBAR_SEGMENT_CLASS} gap-1 ${open ? CANVAS_TOOLBAR_SEGMENT_ACTIVE_CLASS : ""}`}
      triggerContent={
        <>
          {props.value ? DETAIL_LEVEL_LABEL[props.value] : "Detail"}
          <ChevronRightIcon size={11} className="-rotate-90" />
        </>
      }
    >
      {(close) =>
        (["compact", "standard", "full"] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={`${CONTEXT_MENU_ITEM_CLASS} justify-between ${level === props.value ? "text-text" : ""}`}
            onClick={() => {
              props.onChange(level);
              close();
            }}
            data-tooltip={DETAIL_LEVEL_HINT[level]}
          >
            {DETAIL_LEVEL_LABEL[level]}
            {level === props.value && <span className="text-primary">✓</span>}
          </button>
        ))
      }
    </ToolbarMenu>
  );
}

const ZOOM_PRESETS = [0.5, 1, 2] as const;

/** Zoom cluster: −, a percentage button opening fit/preset choices, +. Mirrors Figma's bottom-right zoom control. */
function ZoomControls(props: { selectedIds: string[] }) {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);

  return (
    <>
      <button
        type="button"
        className={CANVAS_TOOLBAR_ICON_BTN_CLASS}
        onClick={() => zoomOut({ duration: 120 })}
        data-tooltip="Zoom out"
        data-tooltip-pos="bottom"
        aria-label="Zoom out"
      >
        <span className="text-[15px] leading-none">−</span>
      </button>
      <ToolbarMenu
        tooltip="Zoom"
        minWidth={170}
        triggerClassName={(open) =>
          `${CANVAS_TOOLBAR_SEGMENT_CLASS} min-w-[52px] justify-center ${open ? CANVAS_TOOLBAR_SEGMENT_ACTIVE_CLASS : ""}`
        }
        triggerContent={`${Math.round(zoom * 100)}%`}
      >
        {(close) => (
          <>
            <button
              type="button"
              className={`${CONTEXT_MENU_ITEM_CLASS} justify-between`}
              onClick={() => {
                fitView({ padding: 0.15, duration: 200 });
                close();
              }}
            >
              Zoom to fit <span className="text-text-muted">Shift+1</span>
            </button>
            <button
              type="button"
              className={`${CONTEXT_MENU_ITEM_CLASS} justify-between disabled:opacity-40`}
              disabled={props.selectedIds.length === 0}
              onClick={() => {
                fitView({ padding: 0.3, duration: 200, nodes: props.selectedIds.map((id) => ({ id })) });
                close();
              }}
            >
              Zoom to selection
            </button>
            {ZOOM_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={CONTEXT_MENU_ITEM_CLASS}
                onClick={() => {
                  zoomTo(preset, { duration: 200 });
                  close();
                }}
              >
                {preset * 100}%
              </button>
            ))}
          </>
        )}
      </ToolbarMenu>
      <button
        type="button"
        className={CANVAS_TOOLBAR_ICON_BTN_CLASS}
        onClick={() => zoomIn({ duration: 120 })}
        data-tooltip="Zoom in"
        data-tooltip-pos="bottom"
        aria-label="Zoom in"
      >
        <span className="text-[15px] leading-none">+</span>
      </button>
    </>
  );
}

/** Plugin menu — every canvas command contributed by a plugin, plus a way into the manager. */
function PluginMenu(props: {
  commands: ResolvedContribution<CanvasCommandContribution>[];
  onRun: (command: ResolvedContribution<CanvasCommandContribution>) => void;
  onOpenPlugins: () => void;
}) {
  return (
    <ToolbarMenu
      tooltip="Plugin commands"
      minWidth={240}
      triggerClassName={(open) => `${CANVAS_TOOLBAR_ICON_BTN_CLASS} ${open ? CANVAS_TOOLBAR_SEGMENT_ACTIVE_CLASS : ""}`}
      triggerContent={<PuzzleIcon size={14} />}
    >
      {(close) => (
        <>
          {props.commands.length === 0 && (
            <span className="block px-2.5 py-1.5 text-[12px] text-text-muted">No canvas command installed</span>
          )}
          {props.commands.map((command) => (
            <button
              key={command.key}
              type="button"
              className={`${CONTEXT_MENU_ITEM_CLASS} justify-between`}
              onClick={() => {
                props.onRun(command);
                close();
              }}
              data-tooltip={command.contribution.description}
            >
              {command.contribution.label}
              <span className="ml-2 shrink-0 text-[10px] text-text-muted">
                {command.contribution.shortcut ?? (command.source === "user" ? command.plugin.name : "")}
              </span>
            </button>
          ))}
          <span className="my-1 block h-px bg-border" />
          <button
            type="button"
            className={CONTEXT_MENU_ITEM_CLASS}
            onClick={() => {
              props.onOpenPlugins();
              close();
            }}
          >
            Manage plugins…
          </button>
        </>
      )}
    </ToolbarMenu>
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
  onAddEnum: (position: { x: number; y: number }) => void;
  /** Applies a header color to every currently-selected table at once — shown by the selection toolbar once 2+ tables are selected. */
  onSetTablesColor: (tableIds: string[], color: string) => void;
  /** Bundles the currently-selected tables into a named TableGroup — same selection toolbar. */
  onGroupTables: (tableIds: string[]) => void;
  palette: string[];
  fontScale: number;
  onAdjustFontScale: (delta: number) => void;
  activeDetailLevel: DetailLevel | null;
  onSetDetailLevel: (level: DetailLevel) => void;
  highlightLinks: boolean;
  onHighlightLinksChange: (highlight: boolean) => void;
  /** Fires on table hover start/end (null on leave) — lets the parent highlight that table's refs. */
  onTableHoverChange: (tableId: string | null) => void;
  projectId: string;
  /** Session's stable user id — only used to namespace the saved-viewport localStorage key, not an identity/authorship field. */
  viewportUserId: string;
  exportRef: MutableRefObject<CanvasExportHandle | null>;
  /** Canvas commands contributed by plugins, shown in the toolbar's plugin menu. */
  canvasCommands: ResolvedContribution<CanvasCommandContribution>[];
  onRunCanvasCommand: (command: ResolvedContribution<CanvasCommandContribution>) => void;
  onOpenPlugins: () => void;
  /** Transient feedback from the last plugin command, shown above the toolbar. */
  statusMessage: string | null;
}) {
  const { screenToFlowPosition, fitView, getViewport, setViewport, setCenter } = useReactFlow();
  const [menu, setMenu] = useState<CanvasContextMenuState | null>(null);
  const [showMinimap, setShowMinimap] = useState(loadShowMinimap);
  // Lazy initializer: read once at mount, not on every render — this decides
  // whether the very first render asks React Flow to `fitView` or restore
  // exactly where this user left the canvas last time.
  const [initialViewport] = useState(() => loadViewport(props.projectId, props.viewportUserId));

  // Exposed imperatively (not via props/state) because the Export dialog
  // that triggers this lives outside the ReactFlowProvider this component is
  // rendered inside — it has no other way to reach `fitView`/`getViewport`.
  // Published from an effect rather than during render: writing to someone
  // else's ref mid-render is exactly the kind of side effect React's rules
  // forbid, and the handle is only ever needed later, on a user action.
  const { exportRef } = props;
  useEffect(() => {
    exportRef.current = {
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
    return () => {
      exportRef.current = null;
    };
  }, [exportRef, fitView, getViewport, setViewport]);

  const handleMouseMove = (e: ReactMouseEvent) => {
    props.awareness?.setLocalStateField("cursor", screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  };
  const handleMouseLeave = () => {
    props.awareness?.setLocalStateField("cursor", null);
  };

  const closeMenu = useCallback(() => setMenu(null), []);

  // Find-a-table-by-name (Ctrl/Cmd+F). Kept independent of the `nodes` prop
  // identity — reads a ref updated in its own effect instead of depending on
  // `props.nodes` directly — so a remote collaborator's edit elsewhere on the
  // canvas can't yank the viewport back to the active match mid-search.
  const nodesRef = useRef<CanvasNode[]>(props.nodes);
  useEffect(() => {
    nodesRef.current = props.nodes;
  }, [props.nodes]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIds, setSearchMatchIds] = useState<string[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const { onNodesChange } = props;

  const jumpToTable = useCallback(
    (id: string) => {
      const node = nodesRef.current.find((n) => n.id === id);
      if (!node) return;
      const width = node.measured?.width ?? DEFAULT_TABLE_WIDTH;
      const height = node.measured?.height ?? DEFAULT_TABLE_HEIGHT;
      setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom: 1, duration: 300 });
      // Reuses the same select-change path a real click goes through, so the
      // match gets the ordinary selection outline instead of a bespoke
      // "found" style — one less visual language for a table to be in.
      const changes: NodeChange<CanvasNode>[] = nodesRef.current
        .filter((n) => n.type === "table")
        .map((n) => ({ id: n.id, type: "select" as const, selected: n.id === id }));
      onNodesChange(changes);
    },
    [setCenter, onNodesChange],
  );

  const runSearch = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      const matches = q
        ? nodesRef.current.filter((n) => n.type === "table" && n.data.table.name.toLowerCase().includes(q)).map((n) => n.id)
        : [];
      setSearchMatchIds(matches);
      setSearchIndex(0);
      if (matches.length > 0) jumpToTable(matches[0]);
    },
    [jumpToTable],
  );

  const handleSearchQueryChange = useCallback(
    (q: string) => {
      setSearchQuery(q);
      runSearch(q);
    },
    [runSearch],
  );

  const stepSearch = useCallback(
    (delta: 1 | -1) => {
      if (searchMatchIds.length === 0) return;
      const next = (searchIndex + delta + searchMatchIds.length) % searchMatchIds.length;
      setSearchIndex(next);
      jumpToTable(searchMatchIds[next]);
    },
    [searchMatchIds, searchIndex, jumpToTable],
  );

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchMatchIds([]);
    setSearchIndex(0);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable ||
            target.closest(".cm-editor, .nokey, [contenteditable='true']")),
      );
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape" && searchOpen) {
        closeSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, closeSearch]);

  const toggleMinimap = useCallback(() => {
    setShowMinimap((v) => {
      const next = !v;
      saveShowMinimap(next);
      return next;
    });
  }, []);

  const { onTableHoverChange } = props;
  const handleNodeMouseEnter = useCallback(
    (_e: ReactMouseEvent, node: AllNodes) => {
      if (node.type === "table") onTableHoverChange(node.id);
    },
    [onTableHoverChange],
  );
  const handleNodeMouseLeave = useCallback(
    (_e: ReactMouseEvent, node: AllNodes) => {
      if (node.type === "table") onTableHoverChange(null);
    },
    [onTableHoverChange],
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

  /**
   * Where the toolbar's insert buttons drop a new node: the centre of the
   * visible pane, so it lands where the user is looking rather than at a fixed
   * flow coordinate they may have panned away from.
   */
  const paneCenter = useCallback(() => {
    const pane = document.querySelector(".react-flow__pane") as HTMLElement | null;
    const rect = pane?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    return screenToFlowPosition({ x, y });
  }, [screenToFlowPosition]);

  const nodes: AllNodes[] = [...props.nodes, ...props.cursorNodes];
  const selectedTableIds = props.nodes.filter((n) => n.type === "table" && n.selected).map((n) => n.id);

  return (
    <div
      className="min-w-0 flex-1 bg-bg-canvas"
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
        <Panel position="bottom-center" className="nodrag nopan pointer-events-none !bottom-4 flex flex-col items-center gap-2">
          {props.statusMessage && (
            <span className="pointer-events-auto rounded-full border border-border bg-surface-raised/95 px-3 py-1 text-[11.5px] text-text-secondary shadow-lg backdrop-blur-md">
              {props.statusMessage}
            </span>
          )}
          <div className={CANVAS_TOOLBAR_CLASS}>
            <button
              type="button"
              className={CANVAS_TOOLBAR_ICON_BTN_CLASS}
              onClick={() => props.onAddTable(paneCenter())}
              data-tooltip="Add table"
              data-tooltip-pos="bottom"
              aria-label="Add table"
            >
              <TableIcon size={15} />
            </button>
            <button
              type="button"
              className={CANVAS_TOOLBAR_ICON_BTN_CLASS}
              onClick={() => props.onAddZone(paneCenter())}
              data-tooltip="Add zone"
              data-tooltip-pos="bottom"
              aria-label="Add zone"
            >
              <FrameIcon size={15} />
            </button>
            <button
              type="button"
              className={CANVAS_TOOLBAR_ICON_BTN_CLASS}
              onClick={() => props.onAddNote(paneCenter())}
              data-tooltip="Add sticky note"
              data-tooltip-pos="bottom"
              aria-label="Add sticky note"
            >
              <NoteIcon size={15} />
            </button>
            <button
              type="button"
              className={CANVAS_TOOLBAR_ICON_BTN_CLASS}
              onClick={() => props.onAddEnum(paneCenter())}
              data-tooltip="Add enum"
              data-tooltip-pos="bottom"
              aria-label="Add enum"
            >
              <TagIcon size={15} />
            </button>

            <span className={CANVAS_TOOLBAR_DIVIDER_CLASS} />
            <DetailLevelDropdown value={props.activeDetailLevel} onChange={props.onSetDetailLevel} />
            <span className={CANVAS_TOOLBAR_DIVIDER_CLASS} />
            <div className="flex items-center" data-tooltip="Canvas text size" data-tooltip-pos="bottom">
              <button
                type="button"
                className={`${CANVAS_TOOLBAR_SEGMENT_CLASS} !px-1.5 hover:text-text`}
                onClick={() => props.onAdjustFontScale(-FONT_SCALE_STEP)}
                disabled={props.fontScale <= FONT_SCALE_MIN}
                data-tooltip="Réduire la taille du texte"
                data-tooltip-pos="bottom"
              >
                <span className="text-[11px] font-bold leading-none">A⁻</span>
              </button>
              <span className="min-w-[34px] text-center text-[11.5px] font-mono font-medium text-text-muted">{Math.round(props.fontScale * 100)}%</span>
              <button
                type="button"
                className={`${CANVAS_TOOLBAR_SEGMENT_CLASS} !px-1.5 hover:text-text`}
                onClick={() => props.onAdjustFontScale(FONT_SCALE_STEP)}
                disabled={props.fontScale >= FONT_SCALE_MAX}
                data-tooltip="Augmenter la taille du texte"
                data-tooltip-pos="bottom"
              >
                <span className="text-[13px] font-bold leading-none">A⁺</span>
              </button>

            </div>

            <span className={CANVAS_TOOLBAR_DIVIDER_CLASS} />
            <button
              type="button"
              className={`${CANVAS_TOOLBAR_ICON_BTN_CLASS} ${props.highlightLinks ? CANVAS_TOOLBAR_TOGGLE_ACTIVE_CLASS : ""}`}
              onClick={() => props.onHighlightLinksChange(!props.highlightLinks)}
              data-tooltip={props.highlightLinks ? "Hide link and cardinality highlighting" : "Highlight links and cardinalities"}
              data-tooltip-pos="bottom"
              aria-label="Toggle link highlight"
            >
              <LinkIcon size={14} />
            </button>
            <button
              type="button"
              className={`${CANVAS_TOOLBAR_ICON_BTN_CLASS} ${showMinimap ? CANVAS_TOOLBAR_TOGGLE_ACTIVE_CLASS : ""}`}
              onClick={toggleMinimap}
              data-tooltip={showMinimap ? "Hide minimap" : "Show minimap"}
              data-tooltip-pos="bottom"
              aria-label="Toggle minimap"
            >
              <MinimapIcon size={14} />
            </button>
            <button
              type="button"
              className={`${CANVAS_TOOLBAR_ICON_BTN_CLASS} ${searchOpen ? CANVAS_TOOLBAR_TOGGLE_ACTIVE_CLASS : ""}`}
              onClick={() => setSearchOpen(true)}
              data-tooltip="Find a table (Ctrl+F)"
              data-tooltip-pos="bottom"
              aria-label="Find a table"
            >
              <SearchIcon size={14} />
            </button>

            <span className={CANVAS_TOOLBAR_DIVIDER_CLASS} />
            <ZoomControls selectedIds={selectedTableIds} />

            <span className={CANVAS_TOOLBAR_DIVIDER_CLASS} />
            <PluginMenu
              commands={props.canvasCommands}
              onRun={props.onRunCanvasCommand}
              onOpenPlugins={props.onOpenPlugins}
            />
          </div>
        </Panel>
        {showMinimap && (
          <MiniMap pannable zoomable bgColor="#1f2024" nodeColor="#4b4d8a" maskColor="rgba(23,24,27,0.75)" />
        )}
        {selectedTableIds.length > 1 && (
          <SelectionColorToolbar
            count={selectedTableIds.length}
            palette={props.palette}
            onPick={(color) => props.onSetTablesColor(selectedTableIds, color)}
            onGroup={() => props.onGroupTables(selectedTableIds)}
          />
        )}
        {searchOpen && (
          <CanvasSearchPanel
            query={searchQuery}
            onQueryChange={handleSearchQueryChange}
            matchCount={searchMatchIds.length}
            activeIndex={searchIndex}
            onNext={() => stepSearch(1)}
            onPrev={() => stepSearch(-1)}
            onClose={closeSearch}
          />
        )}
      </ReactFlow>
      {menu && (
        <CanvasContextMenu
          menu={menu}
          onAddTable={props.onAddTable}
          onAddZone={props.onAddZone}
          onAddNote={props.onAddNote}
          onAddEnum={props.onAddEnum}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
