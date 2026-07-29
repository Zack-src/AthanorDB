// Import the core editor API directly rather than the `monaco-editor` barrel:
// the barrel auto-registers all ~70 bundled languages (full TS/CSS/HTML/JSON
// language services, workers included) we don't use, which balloons the
// bundle by several MB for nothing. The core module is the same typed
// `monaco` namespace, just without those contributions pre-loaded.
import * as monaco from "monaco-editor/editor/editor.api";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { loader } from "@monaco-editor/react";

// AthanorDB is explicitly self-hosted/local-first (see README) — @monaco-editor/react
// defaults to fetching Monaco from a CDN at runtime, which would break that. Point
// its loader at the copy Vite already bundled instead, and supply the editor's
// web worker the same way so nothing reaches out to the network.
(globalThis as unknown as { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });

const DBML_KEYWORDS = ["Table", "Ref", "Enum", "Note", "Project", "TableGroup", "indexes", "as"];
const DBML_SETTINGS = ["pk", "unique", "not", "null", "increment", "default", "note", "name"];

monaco.languages.register({ id: "dbml" });
monaco.languages.setMonarchTokensProvider("dbml", {
  keywords: DBML_KEYWORDS,
  settings: DBML_SETTINGS,
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/'''[\s\S]*?'''/, "string"],
      [/'([^'\\]|\\.)*'/, "string"],
      [/"([^"\\]|\\.)*"/, "string"],
      [
        /[A-Za-z_][A-Za-z0-9_]*/,
        {
          cases: {
            "@keywords": "keyword",
            "@settings": "type",
            "@default": "identifier",
          },
        },
      ],
      [/[{}()[\]]/, "@brackets"],
      [/[<>-]+/, "operator"],
      [/\d+/, "number"],
    ],
  },
});

export { monaco };
