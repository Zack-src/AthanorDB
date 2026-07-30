import type { Field } from "@athanordb/shared";
import { DiamondIcon, KeyIcon, LinkIcon } from "../Icons.js";

/** The leading per-row icon: key (PK) > diamond (unique) > link (FK) > blank. */
export function FieldBadge({ field, isForeignKey, isPk }: { field: Field; isForeignKey: boolean; isPk: boolean }) {
  if (isPk) return <KeyIcon className="table-node-row-icon table-node-row-icon-pk" />;
  if (field.unique) return <DiamondIcon className="table-node-row-icon table-node-row-icon-unique" />;
  if (isForeignKey) return <LinkIcon className="table-node-row-icon" />;
  return <span className="table-node-row-icon" />;
}
