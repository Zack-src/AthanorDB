import { useRef, useState } from "react";
import { UploadIcon } from "./Icons.js";
import { Modal, FormatSelect } from "./Modal.js";
import { Button } from "./ui/Button.js";
import { ErrorText, Hint } from "./ui/Alert.js";
import { TEXTAREA_CODE_CLASS } from "./ui/inputStyles.js";
import type { ExportFormat, SqlDialect } from "./types.js";

function ImportDialog(props: { projectId: string; onClose: () => void }) {
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
      const res = await fetch(`/api/projects/${props.projectId}/import`, {
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
      <Hint>
        Matches tables/fields by name — existing positions and detail levels are kept; anything no longer in the source
        is removed.
      </Hint>
      <div className="mb-2.5 flex items-center gap-2">
        <FormatSelect value={format} onChange={setFormat} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".dbml,.sql,.txt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        <Button onClick={() => fileInputRef.current?.click()}>
          <UploadIcon size={13} /> {fileName ?? "Choose file…"}
        </Button>
        <span className="flex-1" />
        <Button variant="primary" onClick={submit} disabled={busy || !source.trim()}>
          {busy ? "Importing…" : "Import"}
        </Button>
      </div>
      <textarea
        className={`${TEXTAREA_CODE_CLASS} h-80 w-full`}
        value={source}
        onChange={(e) => {
          setSource(e.target.value);
          setFileName(null);
        }}
        placeholder={format === "dbml" ? "Paste DBML, or choose a .dbml/.sql file…" : "Paste SQL DDL, or choose a .dbml/.sql file…"}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </Modal>
  );
}

export { ImportDialog };
export default ImportDialog;
