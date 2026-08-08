import { createPortal } from "react-dom";
import type { EdgeContextMenuState } from "./useEdgeRouting.js";
import { CONTEXT_MENU_ITEM_CLASS } from "../ui/contextMenuStyles.js";

/** Right-click menu on an edge's path or a specific waypoint. Portaled to document.body for precise positioning. */
export function EdgeContextMenu(props: {
  menu: EdgeContextMenuState;
  onDeletePoint: (index: number) => void;
  onResetRouting: () => void;
  onResetColor?: () => void;
  onDeleteRef?: () => void;
}) {
  return createPortal(
    <div
      className="fixed z-[9999] min-w-[176px] animate-modal-in rounded-lg border border-border/80 bg-surface-raised/95 p-1.5 shadow-2xl glass-panel nodrag nopan text-xs font-medium"
      style={{ left: props.menu.x, top: props.menu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {props.menu.pointIndex !== undefined && (
        <button className={CONTEXT_MENU_ITEM_CLASS} onClick={() => props.onDeletePoint(props.menu.pointIndex!)}>
          Supprimer ce point
        </button>
      )}
      <button className={CONTEXT_MENU_ITEM_CLASS} onClick={props.onResetRouting}>
        Réinitialiser le tracé
      </button>
      {props.onResetColor && (
        <button className={CONTEXT_MENU_ITEM_CLASS} onClick={props.onResetColor}>
          Réinitialiser la couleur
        </button>
      )}
      {props.onDeleteRef && (
        <button className={`${CONTEXT_MENU_ITEM_CLASS} text-danger hover:bg-danger/10`} onClick={props.onDeleteRef}>
          Supprimer la relation
        </button>
      )}
    </div>,
    document.body,
  );
}
