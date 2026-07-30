import { useEffect, useState } from "react";
import { DownloadIcon } from "./Icons.js";
import { Modal, FormatSelect } from "./Modal.js";
import { Button } from "./ui/Button.js";
import { ErrorText, Hint } from "./ui/Alert.js";
import { TEXTAREA_CODE_CLASS } from "./ui/inputStyles.js";
import type { CanvasImageCapture, ExportFormat } from "./types.js";

/** JPEG has no alpha channel, so the background must be painted in explicitly before drawing the (possibly-transparent) source image on top. */
function pngDataUrlToJpeg(pngDataUrl: string, width: number, height: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2D canvas context unavailable"));
        return;
      }
      ctx.fillStyle = "#17181b";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Failed to prepare the canvas snapshot for PDF export"));
    img.src = pngDataUrl;
  });
}

const IMAGE_FORMATS = new Set<ExportFormat>(["png", "svg", "pdf"]);

function ExportDialog(props: {
  projectId: string;
  projectName: string;
  captureCanvasImage: (format: "png" | "svg") => Promise<CanvasImageCapture>;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("dbml");
  const [text, setText] = useState("");
  const [image, setImage] = useState<CanvasImageCapture | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isImage = IMAGE_FORMATS.has(format);

  useEffect(() => {
    if (isImage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the fetch this same effect kicks off
    setBusy(true);
    setError(null);
    const url =
      format === "dbml"
        ? `/api/projects/${props.projectId}/export/dbml?visual=1`
        : `/api/projects/${props.projectId}/export/sql?dialect=${format}`;
    fetch(url)
      .then(async (res) => setText(res.ok ? await res.text() : `Error: ${res.status}`))
      .finally(() => setBusy(false));
  }, [format, isImage, props.projectId]);

  useEffect(() => {
    if (!isImage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the capture this same effect kicks off
    setBusy(true);
    setError(null);
    props.captureCanvasImage(format === "svg" ? "svg" : "png")
      .then(setImage)
      .catch((err) => setError((err as Error).message))
      .finally(() => setBusy(false));
    // props.captureCanvasImage is a useCallback with an empty dep array in
    // the parent, so it's stable — omitting it here (rather than in the
    // caller) avoids re-capturing every time the parent re-renders for
    // unrelated reasons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, isImage]);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  const download = async () => {
    if (format === "png" || format === "svg") {
      if (image) downloadDataUrl(image.dataUrl, `${props.projectName}.${format}`);
      return;
    }
    if (format === "pdf") {
      if (!image) return;
      // jsPDF is only needed for this one branch — dynamic import keeps it
      // out of the bundle everyone else loads.
      const { jsPDF } = await import("jspdf");
      // jsPDF's addImage embeds a PNG essentially uncompressed — a two-table
      // diagram came out over 10MB. Re-encoding to JPEG first (this is a
      // decorative snapshot, not something needing lossless fidelity) brings
      // that down by roughly two orders of magnitude.
      const jpeg = await pngDataUrlToJpeg(image.dataUrl, image.width, image.height);
      const orientation = image.width >= image.height ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [image.width, image.height] });
      pdf.addImage(jpeg, "JPEG", 0, 0, image.width, image.height);
      pdf.save(`${props.projectName}.pdf`);
      return;
    }
    const ext = format === "dbml" ? "dbml" : "sql";
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    downloadDataUrl(url, `${props.projectName}.${ext}`);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Export schema" onClose={props.onClose}>
      <div className="mb-2.5 flex items-center gap-2">
        <FormatSelect value={format} onChange={setFormat} includeImageFormats />
        {!isImage && (
          <Button onClick={copy} disabled={busy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
        <Button variant="primary" onClick={download} disabled={busy || (isImage && !image)}>
          <DownloadIcon size={13} /> Download
        </Button>
      </div>
      {isImage ? (
        <div className="flex min-h-80 flex-col items-center justify-center rounded-sm border border-border bg-[var(--color-bg-canvas)] p-3">
          {busy && <span className="text-text-muted">Rendering canvas…</span>}
          {!busy && image && <img src={image.dataUrl} alt="Canvas snapshot preview" className="max-h-[296px] max-w-full rounded-sm shadow-sm" />}
          {format === "pdf" && !busy && image && <Hint>Downloads as a single-page PDF with this snapshot filling the page.</Hint>}
        </div>
      ) : (
        <textarea readOnly className={`${TEXTAREA_CODE_CLASS} h-80 w-full`} value={busy ? "Loading…" : text} />
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Modal>
  );
}

export { ExportDialog };
export default ExportDialog;
