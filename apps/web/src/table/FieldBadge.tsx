import type { Field } from "@athanordb/shared";
import { DiamondIcon, KeyIcon, LinkIcon } from "../Icons.js";

/** The leading per-row icon: key (PK) > diamond (unique) > link (FK) > blank. */
export function FieldBadge({ field, isForeignKey, isPk }: { field: Field; isForeignKey: boolean; isPk: boolean }) {
  if (isPk) return <KeyIcon size={16} className="h-4 w-4 shrink-0 text-warning" />;
  if (field.unique) return <DiamondIcon size={16} className="h-4 w-4 shrink-0 text-primary" />;
  if (isForeignKey) return <LinkIcon size={16} className="h-4 w-4 shrink-0 text-text-muted" />;
  return <span className="flex h-4 w-4 shrink-0" />;
}
