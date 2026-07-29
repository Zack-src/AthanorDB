import { useEffect, type ReactNode } from "react";
import { CloseIcon } from "./Icons.js";
import type { ExportFormat } from "./types.js";

export function Modal(props: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const { onClose } = props;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal${props.wide ? " modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">{props.title}</span>
          <button className="btn btn-icon btn-ghost" onClick={onClose} title="Close">
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
      </div>
    </div>
  );
}

export function FormatSelect(props: { value: ExportFormat; onChange: (v: ExportFormat) => void; includeImageFormats?: boolean }) {
  return (
    <select className="select" value={props.value} onChange={(e) => props.onChange(e.target.value as ExportFormat)}>
      <option value="dbml">DBML</option>
      <option value="postgres">SQL — Postgres</option>
      <option value="mysql">SQL — MySQL</option>
      <option value="mssql">SQL — SQL Server</option>
      {props.includeImageFormats && (
        <>
          <option value="png">Image — PNG</option>
          <option value="svg">Image — SVG</option>
          <option value="pdf">PDF</option>
        </>
      )}
    </select>
  );
}
