import type { EdgeContextMenuState } from "./useEdgeRouting.js";

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
      className="context-menu nodrag nopan"
      style={{ position: "fixed", left: props.menu.x, top: props.menu.y, zIndex: 1000 }}
      onClick={(e) => e.stopPropagation()}
    >
      {props.menu.pointIndex !== undefined && (
        <button className="context-menu-item" onClick={() => props.onDeletePoint(props.menu.pointIndex!)}>
          Supprimer ce point
        </button>
      )}
      <button className="context-menu-item" onClick={props.onResetRouting}>
        Réinitialiser le tracé
      </button>
      {props.onResetColor && (
        <button className="context-menu-item" onClick={props.onResetColor}>
          Réinitialiser la couleur
        </button>
      )}
      {props.onDeleteRef && (
        <button className="context-menu-item" style={{ color: "#ef4444" }} onClick={props.onDeleteRef}>
          Supprimer la relation
        </button>
      )}
    </div>
  );
}
