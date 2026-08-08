import { useCallback, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { applyNodeChanges, type NodeChange } from "@xyflow/react";
import {
  getEnumsMap,
  getMetaMap,
  getRefsMap,
  getStickyNotesMap,
  getTablesMap,
  getZonesMap,
  type Comment,
  type EnumValue,
  type Field,
  type Project,
} from "@athanordb/shared";
import { DEFAULT_PALETTE } from "../ColorSwatchPicker.js";
import type { ZoneNodeType } from "../ZoneNode.js";
import type { TableNodeType } from "../TableNode.js";
import type { StickyNoteNodeType } from "../StickyNoteNode.js";
import type { EnumNodeType } from "../EnumNode.js";
import type { CursorNodeType } from "../CursorNode.js";
import type { CanvasNode } from "../types.js";
import { DEFAULT_TABLE_HEIGHT, DEFAULT_TABLE_WIDTH } from "../refGeometry.js";

/**
 * Builds the React Flow node array (zones, tables, sticky notes — in that
 * paint order so tables/notes drag on top of zones) from the live Yjs
 * project, wiring each node's `data` callbacks straight to doc mutations.
 * Also owns the local, controlled node state React Flow needs to show live
 * drag position: `builtNodes` (source of truth from the doc) only updates
 * once a drag commits, so without a local copy the node would visually snap
 * around mid-drag.
 */
export function useCanvasNodes(
  liveProject: Project | null,
  doc: Y.Doc | null,
  refFieldIdsByTable: Map<string, Set<string>>,
  user: string,
  highlightLinks: boolean,
  onGoToDbml: (tableName: string) => void,
) {
  const builtNodes: CanvasNode[] = useMemo(() => {
    if (!liveProject || !doc) return [];

    const palette = liveProject.paletteColors ?? DEFAULT_PALETTE;
    const onPaletteChange = (next: string[]) => {
      getMetaMap(doc).set("paletteColors", next);
    };

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
        onGoToDbml: () => onGoToDbml(table.name),
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

    const enumNodes: EnumNodeType[] = liveProject.enums.map((enumDef) => ({
      id: enumDef.id,
      position: enumDef.position,
      type: "enum",
      data: {
        enumDef,
        onRename: (name: string) => {
          const enums = getEnumsMap(doc);
          const current = enums.get(enumDef.id);
          if (current) enums.set(enumDef.id, { ...current, name });
        },
        onAddValue: () => {
          const enums = getEnumsMap(doc);
          const current = enums.get(enumDef.id);
          if (!current) return;
          const value: EnumValue = { id: crypto.randomUUID(), name: `value_${current.values.length + 1}` };
          enums.set(enumDef.id, { ...current, values: [...current.values, value] });
        },
        onRenameValue: (valueId: string, name: string) => {
          const enums = getEnumsMap(doc);
          const current = enums.get(enumDef.id);
          if (!current) return;
          enums.set(enumDef.id, { ...current, values: current.values.map((v) => (v.id === valueId ? { ...v, name } : v)) });
        },
        onDeleteValue: (valueId: string) => {
          const enums = getEnumsMap(doc);
          const current = enums.get(enumDef.id);
          if (!current) return;
          enums.set(enumDef.id, { ...current, values: current.values.filter((v) => v.id !== valueId) });
        },
        onReorderValue: (valueId: string, direction: "up" | "down") => {
          const enums = getEnumsMap(doc);
          const current = enums.get(enumDef.id);
          if (!current) return;
          const index = current.values.findIndex((v) => v.id === valueId);
          const swapWith = direction === "up" ? index - 1 : index + 1;
          if (index < 0 || swapWith < 0 || swapWith >= current.values.length) return;
          const values = [...current.values];
          [values[index], values[swapWith]] = [values[swapWith], values[index]];
          enums.set(enumDef.id, { ...current, values });
        },
      },
    }));

    return [...zoneNodes, ...tableNodes, ...stickyNodes, ...enumNodes];
  }, [liveProject, doc, refFieldIdsByTable, user, highlightLinks, onGoToDbml]);

  // Resetting during render (React's documented pattern for "adjust state
  // when an input changes") rather than in an effect avoids an extra render pass.
  const [nodes, setNodes] = useState<CanvasNode[]>(builtNodes);
  const [prevBuiltNodes, setPrevBuiltNodes] = useState(builtNodes);
  if (builtNodes !== prevBuiltNodes) {
    setPrevBuiltNodes(builtNodes);
    // `selected` is local React Flow UI state, not part of the doc — a fresh
    // `builtNodes` (any doc mutation, including e.g. a bulk color change
    // applied *from* the current selection) would otherwise wipe it,
    // dropping the selection and closing whatever UI depends on it
    // (the multi-select color toolbar) mid-use.
    setNodes((prevNodes) => {
      const selectedIds = new Set(prevNodes.filter((n) => n.selected).map((n) => n.id));
      return selectedIds.size === 0 ? builtNodes : builtNodes.map((n) => (selectedIds.has(n.id) ? { ...n, selected: true } : n));
    });
  }

  // Per zone currently being dragged: each contained table/sticky's offset
  // from the zone's position, snapshotted once at drag start (not
  // recomputed every frame) so the group moves rigidly together instead of
  // members joining/leaving as the zone sweeps over them mid-drag.
  const zoneDragMembersRef = useRef<Map<string, Map<string, { x: number; y: number }>>>(new Map());

  const onNodesChange = useCallback(
    // Typed against AllNodes since this is React Flow's nodes-prop change
    // handler and cursor nodes ride along in that same array — but cursor
    // nodes are always non-interactive (draggable/selectable/deletable:
    // false), so they never actually produce a change event; safe to narrow
    // back to CanvasNode for the part of this function that persists to the doc.
    (changes: NodeChange<CanvasNode | CursorNodeType>[]) => {
      // Dragging a zone also drags whatever table/sticky was inside it —
      // synthesize a "position" change for each member, riding along with
      // the zone's own change, so they flow through the same apply/commit
      // logic below without duplicating it.
      const memberChanges: NodeChange<CanvasNode>[] = [];
      for (const change of changes) {
        if (change.type !== "position" || !change.position) continue;
        const zoneNode = nodes.find((n) => n.id === change.id);
        if (!zoneNode || zoneNode.type !== "zone") continue;

        let offsets = zoneDragMembersRef.current.get(zoneNode.id);
        if (!offsets) {
          offsets = new Map();
          const zx = zoneNode.position.x;
          const zy = zoneNode.position.y;
          const zw = zoneNode.width ?? 0;
          const zh = zoneNode.height ?? 0;
          for (const other of nodes) {
            if (other.type !== "table" && other.type !== "sticky" && other.type !== "enum") continue;
            const w = other.measured?.width ?? (other.type === "sticky" ? other.width : undefined) ?? DEFAULT_TABLE_WIDTH;
            const h = other.measured?.height ?? (other.type === "sticky" ? other.height : undefined) ?? DEFAULT_TABLE_HEIGHT;
            const cx = other.position.x + w / 2;
            const cy = other.position.y + h / 2;
            if (cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh) {
              offsets.set(other.id, { x: other.position.x - zx, y: other.position.y - zy });
            }
          }
          zoneDragMembersRef.current.set(zoneNode.id, offsets);
        }

        for (const [memberId, offset] of offsets) {
          memberChanges.push({
            id: memberId,
            type: "position",
            position: { x: change.position.x + offset.x, y: change.position.y + offset.y },
            dragging: change.dragging,
          });
        }

        if (change.dragging === false) zoneDragMembersRef.current.delete(zoneNode.id);
      }

      const allChanges = [...(changes as NodeChange<CanvasNode>[]), ...memberChanges];
      setNodes((nds) => applyNodeChanges(allChanges, nds));
      if (!doc) return;
      const tables = getTablesMap(doc);
      const zones = getZonesMap(doc);
      const stickyNotes = getStickyNotesMap(doc);
      const enums = getEnumsMap(doc);
      for (const change of allChanges) {
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
          } else if (enums.has(change.id)) {
            const current = enums.get(change.id);
            if (current) enums.set(change.id, { ...current, position: change.position });
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
          } else if (enums.has(change.id)) {
            enums.delete(change.id);
          }
        }
      }
    },
    [doc, nodes],
  );

  return { nodes, onNodesChange };
}
