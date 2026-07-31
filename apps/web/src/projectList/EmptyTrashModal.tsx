import { useState } from "react";
import { Modal } from "../Modal.js";
import { Button } from "../ui/Button.js";
import { ErrorText, Hint } from "../ui/Alert.js";
import { INPUT_CLASS } from "../ui/inputStyles.js";

// Typing the exact word is the guard against "misclick nukes everything" —
// a click-through confirm modal is not enough friction for an action this
// destructive and irreversible.
const CONFIRM_WORD = "SUPPRIMER";

/** Confirms permanently emptying the trash — requires typing a confirm word, not just a click. */
export function EmptyTrashModal(props: { count: number; busy: boolean; error: string | null; onConfirm: () => void; onClose: () => void }) {
  const [confirmWord, setConfirmWord] = useState("");

  return (
    <Modal title="Empty trash" onClose={() => !props.busy && props.onClose()}>
      <Hint>
        Permanently delete <strong>{props.count}</strong> project(s) in the trash, including their whole revision
        history. This can't be undone.
      </Hint>
      <Hint>
        Type <strong>{CONFIRM_WORD}</strong> to confirm.
      </Hint>
      <input
        autoFocus
        className={`${INPUT_CLASS} w-full`}
        value={confirmWord}
        onChange={(e) => setConfirmWord(e.target.value)}
        placeholder={CONFIRM_WORD}
        disabled={props.busy}
      />
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={props.onClose} disabled={props.busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={props.onConfirm} disabled={props.busy || confirmWord !== CONFIRM_WORD}>
          {props.busy ? "Deleting…" : "Empty trash"}
        </Button>
      </div>
      {props.error && <ErrorText>{props.error}</ErrorText>}
    </Modal>
  );
}
