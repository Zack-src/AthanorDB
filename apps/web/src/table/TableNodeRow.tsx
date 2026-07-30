import { Handle, Position } from "@xyflow/react";
import type { Comment, Field } from "@athanordb/shared";
import { CommentThread } from "../CommentThread.js";
import { AsteriskIcon, DiamondIcon, IncrementIcon, KeyIcon, NoteIcon } from "../Icons.js";
import { FieldBadge } from "./FieldBadge.js";
import { FieldEditorPopover } from "./FieldEditorPopover.js";

export interface TableNodeRowProps {
  field: Field;
  comments: Comment[];
  isPk: boolean;
  isForeignKey: boolean;
  isLinked: boolean;
  isSelected: boolean;
  currentUser: string;
  onSelect: () => void;
  onAddComment: (text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onUpdateField?: (fieldId: string, updates: Partial<Field>) => void;
  onDeleteField?: (fieldId: string) => void;
}

/** One field row: side handles, badge/name/type, PK/UQ/NN/AI/note badges, and the edit + comment popovers. */
export function TableNodeRow({
  field,
  comments,
  isPk,
  isForeignKey,
  isLinked,
  isSelected,
  currentUser,
  onSelect,
  onAddComment,
  onDeleteComment,
  onUpdateField,
  onDeleteField,
}: TableNodeRowProps) {
  return (
    <div
      className={`table-node-row${isLinked ? " table-node-row-linked" : ""}${isSelected ? " table-node-row-selected" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Handle type="target" position={Position.Left} id={`${field.id}-left-target`} className="table-row-handle" />
      <Handle type="source" position={Position.Left} id={`${field.id}-left-source`} className="table-row-handle" />
      <span className="table-node-row-name" data-tooltip={`${field.name} (${field.type})`}>
        {field.name}
      </span>
      <FieldBadge field={field} isForeignKey={isForeignKey} isPk={isPk} />

      <div className="table-node-row-badges">
        {isPk && (
          <span className="field-kw-badge field-kw-badge-pk" data-tooltip="Primary Key">
            <KeyIcon size={11} />
          </span>
        )}
        {field.unique && (
          <span className="field-kw-badge field-kw-badge-unique" data-tooltip="Unique">
            <DiamondIcon size={11} />
          </span>
        )}
        {field.notNull && (
          <span className="field-kw-badge field-kw-badge-notnull" data-tooltip="Not Null">
            <AsteriskIcon size={11} />
          </span>
        )}
        {field.increment && (
          <span className="field-kw-badge field-kw-badge-increment" data-tooltip="Auto Increment">
            <IncrementIcon size={11} />
          </span>
        )}
        {field.note && (
          <span className="field-kw-badge field-kw-badge-note" data-tooltip={field.note}>
            <NoteIcon size={11} />
          </span>
        )}
      </div>

      <div className="table-node-row-actions">
        <FieldEditorPopover
          field={field}
          onUpdateField={onUpdateField}
          onDeleteField={onDeleteField}
          triggerClassName="table-node-row-action-btn table-node-row-edit"
        />
        <CommentThread
          comments={comments}
          currentUser={currentUser}
          onAdd={onAddComment}
          onDelete={onDeleteComment}
          triggerClassName="table-node-row-action-btn table-node-row-comment"
          tooltip={`Comments on ${field.name}`}
        />
      </div>

      <span className="table-node-row-type">{field.type}</span>

      <Handle type="target" position={Position.Right} id={`${field.id}-right-target`} className="table-row-handle" />
      <Handle type="source" position={Position.Right} id={`${field.id}-right-source`} className="table-row-handle" />
    </div>
  );
}
