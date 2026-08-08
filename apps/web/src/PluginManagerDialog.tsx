import { useRef, useState } from "react";
import { Modal } from "./Modal.js";
import { Button } from "./ui/Button.js";
import { Badge } from "./ui/Badge.js";
import { ErrorText, Hint } from "./ui/Alert.js";
import { TEXTAREA_CODE_CLASS } from "./ui/inputStyles.js";
import { DownloadIcon, PlusIcon, TrashIcon, UploadIcon } from "./Icons.js";
import { pluginRegistry } from "./plugins/registry.js";
import { usePlugins } from "./plugins/usePlugins.js";
import { EXAMPLE_PLUGIN_NAME, EXAMPLE_PLUGIN_SOURCE } from "./plugins/examples.js";
import { INPUT_SM_CLASS, SELECT_CLASS } from "./ui/inputStyles.js";
import type { Contribution, PluginRecord, PluginSettingDef } from "./plugins/types.js";

const KIND_LABEL: Record<Contribution["kind"], string> = {
  exporter: "export",
  importer: "import",
  canvasCommand: "canvas",
  editorCommand: "editor",
};

function ContributionList({ contributions }: { contributions: Contribution[] }) {
  if (contributions.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {contributions.map((c) => (
        <span
          key={`${c.kind}:${c.id}`}
          className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface px-1.5 py-px text-[11px] text-text-muted"
          data-tooltip={c.description}
        >
          <span className="uppercase tracking-wide text-[9.5px] text-primary">{KIND_LABEL[c.kind]}</span>
          {c.label}
          {c.shortcut && <span className="rounded-sm bg-surface-hover px-1 text-[10px]">{c.shortcut}</span>}
        </span>
      ))}
    </div>
  );
}

/** Renders a plugin's declared settings as a form — the plugin supplies data, never markup. */
function SettingsForm({ pluginId, settings }: { pluginId: string; settings: PluginSettingDef[] }) {
  const values = pluginRegistry.settingsFor(pluginId);
  return (
    <div className="mt-1.5 flex flex-col gap-1.5 rounded-sm border border-border p-2">
      {settings.map((setting) => (
        <label key={setting.key} className="flex items-center gap-2 text-[11.5px] text-text-secondary" data-tooltip={setting.description}>
          <span className="min-w-[220px]">{setting.label}</span>
          {setting.type === "boolean" && (
            <input
              type="checkbox"
              checked={Boolean(values[setting.key])}
              onChange={(e) => pluginRegistry.setSetting(pluginId, setting.key, e.target.checked)}
            />
          )}
          {setting.type === "select" && (
            <select
              className={SELECT_CLASS}
              value={String(values[setting.key] ?? "")}
              onChange={(e) => pluginRegistry.setSetting(pluginId, setting.key, e.target.value)}
            >
              {setting.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          )}
          {setting.type === "string" && (
            <input
              className={INPUT_SM_CLASS}
              value={String(values[setting.key] ?? "")}
              onChange={(e) => pluginRegistry.setSetting(pluginId, setting.key, e.target.value)}
            />
          )}
          {setting.type === "number" && (
            <input
              type="number"
              className={INPUT_SM_CLASS}
              value={Number(values[setting.key] ?? 0)}
              onChange={(e) => pluginRegistry.setSetting(pluginId, setting.key, Number(e.target.value))}
            />
          )}
        </label>
      ))}
    </div>
  );
}

function downloadSource(record: PluginRecord): void {
  const blob = new Blob([record.code ?? ""], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${record.manifest.id}.js`;
  a.click();
  URL.revokeObjectURL(url);
}

function PluginRow({ record }: { record: PluginRecord }) {
  const [showLogs, setShowLogs] = useState(false);
  const logs = pluginRegistry.logsFor(record.manifest.id);

  return (
    <div className="flex flex-col gap-1 border-b border-border px-1 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold text-text">{record.manifest.name}</span>
        {record.manifest.version && <span className="text-[11px] text-text-muted">v{record.manifest.version}</span>}
        <Badge tone="muted">{record.source === "builtin" ? "Built-in" : "Installed"}</Badge>
        <span className="flex-1" />
        <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-text-muted">
          <input
            type="checkbox"
            checked={record.enabled}
            onChange={(e) => pluginRegistry.setEnabled(record.manifest.id, e.target.checked)}
          />
          Enabled
        </label>
        {record.source === "user" && record.code && (
          <Button variant="ghost" size="icon-sm" onClick={() => downloadSource(record)} data-tooltip="Download source (.js)">
            <DownloadIcon size={13} />
          </Button>
        )}
        {record.source === "user" && (
          <Button
            variant="danger-ghost"
            size="icon-sm"
            onClick={() => pluginRegistry.uninstall(record.manifest.id)}
            data-tooltip="Uninstall"
          >
            <TrashIcon size={13} />
          </Button>
        )}
      </div>
      {record.manifest.description && <span className="text-[11.5px] text-text-muted">{record.manifest.description}</span>}
      <ContributionList contributions={record.contributions} />
      {record.enabled && record.manifest.settings && record.manifest.settings.length > 0 && (
        <SettingsForm pluginId={record.manifest.id} settings={record.manifest.settings} />
      )}
      {record.error && <ErrorText>{record.error}</ErrorText>}
      {logs.length > 0 && (
        <div>
          <button
            type="button"
            className="text-[11px] text-text-muted underline decoration-dotted"
            onClick={() => setShowLogs((v) => !v)}
          >
            {showLogs ? "Hide" : "Show"} console ({logs.length})
          </button>
          {showLogs && (
            <pre className="mt-1 max-h-32 overflow-auto rounded-sm border border-border bg-surface p-2 text-[11px] text-text-muted">
              {logs.join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Install/enable/remove plugins. Plugins are stored per browser, never sent to
 * the server — the dialog says so, because installing one means running that
 * author's code in your session.
 */
function PluginManagerDialog(props: { onClose: () => void }) {
  const records = usePlugins();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const install = async (source: string) => {
    setBusy(true);
    setError(null);
    try {
      await pluginRegistry.install(source);
      setCode("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Plugins" onClose={props.onClose} wide>
      <Hint>
        Plugins run in a sandboxed Web Worker with no DOM and no network access, and are stored in this browser only —
        nothing is uploaded or shared with your team. Installing a plugin still runs its author&apos;s code, so only
        install sources you trust.
      </Hint>

      <div className="mb-2 mt-3 flex items-center gap-2">
        <Button variant="primary" onClick={() => setAdding((v) => !v)}>
          <PlusIcon size={13} /> Add plugin
        </Button>
        <Button onClick={() => install(EXAMPLE_PLUGIN_SOURCE)} disabled={busy}>
          Install example: {EXAMPLE_PLUGIN_NAME}
        </Button>
      </div>

      {adding && (
        <div className="mb-3 flex flex-col gap-2 rounded-sm border border-border p-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".js,.txt"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) setCode(await file.text());
              }}
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <UploadIcon size={13} /> Choose .js file…
            </Button>
            <span className="flex-1" />
            <Button variant="primary" onClick={() => install(code)} disabled={busy || !code.trim()}>
              {busy ? "Loading…" : "Install"}
            </Button>
          </div>
          <textarea
            className={`${TEXTAREA_CODE_CLASS} h-56 w-full`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={'athanor.plugin({ id: "me.my-plugin", name: "My plugin" });\n\nathanor.registerExporter({\n  id: "json",\n  label: "JSON",\n  extension: "json",\n  run: function (project) {\n    return JSON.stringify(project, null, 2);\n  },\n});'}
          />
          <span className="text-[11px] text-text-muted">
            API: <code>athanor.plugin</code>, <code>registerExporter(project → text)</code>,{" "}
            <code>registerImporter(text → DBML)</code>, <code>registerCanvasCommand(project → project)</code>,{" "}
            <code>registerEditorCommand({"{ text, selection, selectedText }"} → text)</code>. Each call is cancelled
            after 10s.
          </span>
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <div className="mt-2 rounded-sm border border-border px-2">
        {records.map((record) => (
          <PluginRow key={record.manifest.id} record={record} />
        ))}
      </div>
    </Modal>
  );
}

export { PluginManagerDialog };
export default PluginManagerDialog;
