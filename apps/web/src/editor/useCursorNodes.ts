import { useMemo } from "react";
import type { CursorNodeType } from "../CursorNode.js";
import type { AwarenessState } from "../yjsClient.js";

/** Turns remote peers' awareness state into React Flow nodes for their live cursors. */
export function useCursorNodes(remoteAwareness: Map<number, AwarenessState>): CursorNodeType[] {
  return useMemo(() => {
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
}
