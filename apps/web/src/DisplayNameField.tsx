import { useState } from "react";
import { INPUT_SM_CLASS } from "./ui/inputStyles.js";

/** The display-name input shared by the project-list header and the in-project toolbar — local draft, committed via PATCH /api/users/me on blur/Enter rather than firing a network call per keystroke. */
export function DisplayNameField(props: { value: string; onCommit: (name: string) => void }) {
  const [draft, setDraft] = useState(props.value);
  // Adjust state during render (React's documented pattern for "reset state
  // when a prop changes") rather than in an effect — same idiom already used
  // for `builtNodes`/`prevBuiltNodes` in useCanvasNodes — avoids an extra render pass.
  const [prevValue, setPrevValue] = useState(props.value);
  if (props.value !== prevValue) {
    setPrevValue(props.value);
    setDraft(props.value);
  }
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== props.value) props.onCommit(trimmed);
    else setDraft(props.value);
  };
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-muted">
      <input
        className={`${INPUT_SM_CLASS} w-[130px]`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        size={10}
        data-tooltip="Your display name"
        data-tooltip-pos="bottom"
      />
    </label>
  );
}
