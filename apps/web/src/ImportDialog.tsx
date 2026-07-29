import { useRef, useState } from "react";
import { UploadIcon } from "./Icons.js";
import { Modal, FormatSelect } from "./Modal.js";
import type { ExportFormat, SqlDialect } from "./types.js";

function ImportDialog(props: { projectId: string; user: string; onClose: () => void }) {
  const [source, setSource] = useState("");
  const [format, setFormat] = useState<ExportFormat>("dbml");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setSource(await file.text());
    setFileName(file.name);
    setError(null);
    if (/\.sql$/i.test(file.name)) {
      if (format === "dbml") setFormat("postgres");
    } else {
      setFormat("dbml");
    }
  };

  const submit = async () => {
    if (!source.trim()) return;
    setBusy(true);
    setError(null);
    const body: { source: string; dialect?: SqlDialect } = { source };
    if (format === "postgres" || format === "mysql" || format === "mssql") body.dialect = format;
    try {
      const res = await fetch(`/api/projects/${props.projectId}/import?user=${encodeURIComponent(props.user)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        props.onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Import failed (${res.status})`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Import schema" onClose={props.onClose}>
      <p className="modal-hint">
        Matches tables/fields by name — existing positions and detail levels are kept; anything no longer in the source
        is removed.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <FormatSelect value={format} onChange={setFormat} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".dbml,.sql,.txt"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <button className="btn" onClick={() => fileInputRef.current?.click()}>
          <UploadIcon size={13} /> {fileName ?? "Choose file…"}
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={submit} disabled={busy || !source.trim()}>
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
      <textarea
        className="textarea textarea-code"
        value={source}
        onChange={(e) => {
          setSource(e.target.value);
          setFileName(null);
        }}
        placeholder={format === "dbml" ? "Paste DBML, or choose a .dbml/.sql file…" : "Paste SQL DDL, or choose a .dbml/.sql file…"}
        style={{ width: "100%", height: 320 }}
      />
      {error && <div className="modal-error">{error}</div>}
    </Modal>
  );
}

export { ImportDialog };
export default ImportDialog;
