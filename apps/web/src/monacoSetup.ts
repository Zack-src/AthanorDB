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
const DBML_SETTINGS = ["pk", "unique", "not", "null", "increment", "default", "note", "name", "ref"];
const DBML_TYPES = [
  "integer",
  "int",
  "bigint",
  "smallint",
  "varchar",
  "char",
  "text",
  "boolean",
  "bool",
  "timestamp",
  "timestamptz",
  "date",
  "time",
  "decimal",
  "numeric",
  "float",
  "double",
  "uuid",
  "json",
  "jsonb",
  "blob",
  "enum",
];

monaco.languages.register({ id: "dbml" });
monaco.languages.setMonarchTokensProvider("dbml", {
  keywords: DBML_KEYWORDS,
  settings: DBML_SETTINGS,
  types: DBML_TYPES,
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
            "@settings": "annotation",
            "@types": "type",
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

monaco.languages.setLanguageConfiguration("dbml", {
  comments: { lineComment: "//" },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "'", close: "'" },
    { open: '"', close: '"' },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: "'", close: "'" },
    { open: '"', close: '"' },
  ],
});

// Column-setting completions (offered inside `[ ... ]` on a field line) vs.
// top-level keyword/type completions are disjoint enough in practice — a
// bracket depth check on the current line is cheap and avoids needing a full
// parser just to decide which list to show.
const SNIPPET_RULE = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

const COLUMN_SETTINGS: Array<{ label: string; insertText: string; detail: string; snippet?: boolean }> = [
  { label: "pk", insertText: "pk", detail: "Primary key" },
  { label: "primary key", insertText: "primary key", detail: "Primary key (alias of pk)" },
  { label: "unique", insertText: "unique", detail: "Unique constraint" },
  { label: "not null", insertText: "not null", detail: "Disallow NULL values" },
  { label: "null", insertText: "null", detail: "Allow NULL values" },
  { label: "increment", insertText: "increment", detail: "Auto-increment" },
  { label: "default", insertText: "default: ${1:value}", detail: "Default value", snippet: true },
  { label: "note", insertText: "note: '${1:text}'", detail: "Column note", snippet: true },
  { label: "ref", insertText: "ref: > ${1:table.column}", detail: "Inline relationship", snippet: true },
];

const BLOCK_SNIPPETS: Array<{ label: string; insertText: string; detail: string }> = [
  {
    label: "Table",
    detail: "New table block",
    insertText: "Table ${1:name} {\n\t${2:id} integer [pk]\n\t${3:column} ${4:varchar}\n}",
  },
  { label: "Ref", detail: "Relationship between two tables", insertText: "Ref: ${1:table1.column} > ${2:table2.column}" },
  { label: "Enum", detail: "New enum block", insertText: "Enum ${1:name} {\n\t${2:value1}\n\t${3:value2}\n}" },
  { label: "TableGroup", detail: "Group of tables", insertText: "TableGroup ${1:name} {\n\t${2:table1}\n\t${3:table2}\n}" },
  { label: "Note", detail: "Standalone note", insertText: "Note ${1:name} {\n\t'${2:text}'\n}" },
  { label: "Project", detail: "Project metadata block", insertText: "Project ${1:name} {\n\tdatabase_type: '${2:PostgreSQL}'\n\tNote: '${3:description}'\n}" },
];

monaco.languages.registerCompletionItemProvider("dbml", {
  triggerCharacters: [" ", "[", ".", ":"],
  provideCompletionItems(model, position) {
    const word = model.getWordUntilPosition(position);
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
    const inColumnSettings = /\[[^\]]*$/.test(linePrefix);

    if (inColumnSettings) {
      return {
        suggestions: COLUMN_SETTINGS.map((s) => ({
          label: s.label,
          kind: monaco.languages.CompletionItemKind.Property,
          insertText: s.insertText,
          insertTextRules: s.snippet ? SNIPPET_RULE : undefined,
          detail: s.detail,
          range,
        })),
      };
    }

    const suggestions: monaco.languages.CompletionItem[] = [
      ...BLOCK_SNIPPETS.map((s) => ({
        label: s.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: s.insertText,
        insertTextRules: SNIPPET_RULE,
        detail: s.detail,
        range,
      })),
      ...DBML_TYPES.map((t) => ({
        label: t,
        kind: monaco.languages.CompletionItemKind.TypeParameter,
        insertText: t,
        detail: "Column type",
        range,
      })),
      ...DBML_KEYWORDS.filter((k) => !BLOCK_SNIPPETS.some((s) => s.label === k)).map((k) => ({
        label: k,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: k,
        range,
      })),
    ];

    return { suggestions };
  },
});

export { monaco };
