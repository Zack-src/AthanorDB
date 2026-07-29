import type { ReactNode } from "react";
import type { ValidationIssue } from "@athanordb/dbml-engine";
import { AlertTriangleIcon, CheckCircleIcon, type IconProps } from "./Icons.js";
import { Modal } from "./Modal.js";

const SEVERITY_ICON: Record<ValidationIssue["severity"], (p: IconProps) => ReactNode> = {
  error: (p) => <AlertTriangleIcon {...p} />,
  warning: (p) => <AlertTriangleIcon {...p} />,
};

/** Structural check (`validateProject`, computed client-side — it's pure `Project` analysis with no `@dbml/core` dependency, safe to run on every doc change). Informational only — nothing here blocks editing. */
function ValidationPanel(props: { issues: ValidationIssue[]; onClose: () => void }) {
  return (
    <Modal title="Validation" onClose={props.onClose}>
      {props.issues.length === 0 ? (
        <div className="validation-empty">
          <CheckCircleIcon size={16} /> No issues found.
        </div>
      ) : (
        <div className="validation-list">
          {props.issues.map((issue, i) => (
            <div key={i} className={`validation-row validation-row-${issue.severity}`}>
              {SEVERITY_ICON[issue.severity]({ size: 14, style: { marginTop: 2, flexShrink: 0 } })}
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export { ValidationPanel };
export default ValidationPanel;
