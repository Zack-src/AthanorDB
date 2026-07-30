import { Modal } from "../Modal.js";
import { Button } from "../ui/Button.js";
import { ErrorText, Hint } from "../ui/Alert.js";
import type { ProjectSummary } from "../types.js";

/** Confirms permanently deleting one trashed project (and its revision history). */
export function DeleteProjectModal(props: {
  target: ProjectSummary;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Delete project forever" onClose={props.onClose}>
      <Hint>
        Permanently delete <strong>{props.target.name}</strong>? This removes its whole revision history too, and
        can't be undone.
      </Hint>
      <div className="flex justify-end gap-2">
        <Button onClick={props.onClose} disabled={props.busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={props.onConfirm} disabled={props.busy}>
          {props.busy ? "Deleting…" : "Delete forever"}
        </Button>
      </div>
      {props.error && <ErrorText>{props.error}</ErrorText>}
    </Modal>
  );
}
