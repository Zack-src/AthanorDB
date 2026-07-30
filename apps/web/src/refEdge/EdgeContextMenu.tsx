import type { EdgeContextMenuState } from "./useEdgeRouting.js";
import { CONTEXT_MENU_ITEM_CLASS } from "../ui/contextMenuStyles.js";

/** Right-click menu on an edge's path or a specific waypoint. */
export function EdgeContextMenu(props: {
  menu: EdgeContextMenuState;
  onDeletePoint: (index: number) => void;
  onResetRouting: () => void;
  onResetColor?: () => void;
  onDeleteRef?: () => void;
}) {
  return (
    <div
      className="fixed z-[1000] min-w-[168px] animate-modal-in rounded-md border border-border bg-surface-raised p-1 shadow-lg nodrag nopan"
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
        <button className={CONTEXT_MENU_ITEM_CLASS} style={{ color: "#ef4444" }} onClick={props.onDeleteRef}>
          Supprimer la relation
        </button>
      )}
    </div>
  );
}
