// Import the core editor API directly rather than the `monaco-editor` barrel:
// the barrel auto-registers all ~70 bundled languages (full TS/CSS/HTML/JSON
// language services, workers included) we don't use, which balloons the
// bundle by several MB for nothing. The core module is the same typed
// `monaco` namespace, just without those contributions pre-loaded.
import * as monaco from "monaco-editor/editor/editor.api";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import { loader } from "@monaco-editor/react";

// AthanorDB is explicitly self-hosted/local-first — @monaco-editor/react
// defaults to fetching Monaco from a CDN at runtime, which would break that. Point
// its loader at the copy Vite already bundled instead, and supply the editor's
// web worker the same way so nothing reaches out to the network.
(globalThis as unknown as { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });

const DBML_KEYWORDS = ["Table", "Ref", "Enum", "Note", "Project", "TableGroup", "indexes", "as"];
const DBML_SETTINGS = ["pk", "primary key", "unique", "not", "null", "increment", "default", "note", "name", "ref", "headercolor", "delete", "update"];
const DBML_TYPES = [
  "integer",
  "int",
  "bigint",
  "smallint",
  "tinyint",
  "serial",
  "bigserial",
  "smallserial",
  "varchar",
  "char",
  "character",
  "text",
  "boolean",
  "bool",
  "timestamp",
  "timestamptz",
  "datetime",
  "date",
  "time",
  "timetz",
  "decimal",
  "numeric",
  "float",
  "double",
  "real",
  "uuid",
  "json",
  "jsonb",
  "blob",
  "binary",
  "varbinary",
  "enum",
];

monaco.languages.register({ id: "dbml" });

// Custom dark theme tailored for AthanorDB
monaco.editor.defineTheme("dbml-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "C084FC", fontStyle: "bold" },
    { token: "type", foreground: "38BDF8" },
    { token: "annotation", foreground: "F59E0B" },
    { token: "string", foreground: "4ADE80" },
    { token: "comment", foreground: "64748B", fontStyle: "italic" },
    { token: "operator", foreground: "F43F5E" },
    { token: "number", foreground: "FB923C" },
    { token: "identifier", foreground: "E2E8F0" },
  ],
  colors: {
    "editor.background": "#17181B",
    "editor.foreground": "#E2E8F0",
    "editorCursor.foreground": "#6366F1",
    "editor.lineHighlightBackground": "#1E2024",
    "editorLineNumber.foreground": "#475569",
    "editorLineNumber.activeForeground": "#94A3B8",
    "editor.selectionBackground": "#33415580",
    "editor.inactiveSelectionBackground": "#1E293B80",
  },
});

monaco.languages.setMonarchTokensProvider("dbml", {
  keywords: DBML_KEYWORDS,
  settings: DBML_SETTINGS,
  types: DBML_TYPES,
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/\/\*[\s\S]*?\*\//, "comment"],
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
      [/[<>-]+|[:=]/, "operator"],
      [/\d+/, "number"],
    ],
  },
});

monaco.languages.setLanguageConfiguration("dbml", {
  comments: { lineComment: "//", blockComment: ["/*", "*/"] },
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
  indentationRules: {
    increaseIndentPattern: /^.*\{[^}]*$/,
    decreaseIndentPattern: /^\s*\}.*$/,
  },
});

const SNIPPET_RULE = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

const COLUMN_SETTINGS: Array<{ label: string; insertText: string; detail: string; snippet?: boolean }> = [
  { label: "pk", insertText: "pk", detail: "Primary Key constraint" },
  { label: "primary key", insertText: "primary key", detail: "Primary Key constraint" },
  { label: "unique", insertText: "unique", detail: "Unique constraint" },
  { label: "not null", insertText: "not null", detail: "Disallow NULL values" },
  { label: "null", insertText: "null", detail: "Allow NULL values" },
  { label: "increment", insertText: "increment", detail: "Auto-incrementing field" },
  { label: "default", insertText: "default: ${1:value}", detail: "Default column value", snippet: true },
  { label: "note", insertText: "note: '${1:text}'", detail: "Column documentation note", snippet: true },
  { label: "ref", insertText: "ref: > ${1:table.column}", detail: "Inline foreign key relationship", snippet: true },
  { label: "headercolor", insertText: "headercolor: '#${1:3b82f6}'", detail: "Table header color in ERD", snippet: true },
];

const REF_ACTIONS = [
  { label: "cascade", insertText: "cascade", detail: "Cascade deletion / update" },
  { label: "restrict", insertText: "restrict", detail: "Restrict deletion / update" },
  { label: "set null", insertText: "set null", detail: "Set field to NULL on change" },
  { label: "set default", insertText: "set default", detail: "Set field to DEFAULT on change" },
  { label: "no action", insertText: "no action", detail: "No action on change" },
];

const BLOCK_SNIPPETS: Array<{ label: string; insertText: string; detail: string }> = [
  {
    label: "Table",
    detail: "Define a new database table",
    insertText: "Table ${1:users} {\n  ${2:id} integer [pk, increment]\n  ${3:name} varchar [not null]\n  ${4:created_at} timestamp [default: `now()`]\n}",
  },
  { label: "Ref", detail: "Define a foreign key relationship", insertText: "Ref: ${1:table1}.${2:col1} > ${3:table2}.${4:col2}" },
  { label: "Enum", detail: "Define an enumerated type", insertText: "Enum ${1:status_type} {\n  ${2:active}\n  ${3:inactive}\n}" },
  { label: "TableGroup", detail: "Group related tables together", insertText: "TableGroup ${1:group_name} {\n  ${2:table1}\n  ${3:table2}\n}" },
  { label: "Note", detail: "Standalone note", insertText: "Note ${1:note_name} {\n  '${2:Description here}'\n}" },
  { label: "Project", detail: "Project metadata definition", insertText: "Project ${1:project_name} {\n  database_type: '${2:PostgreSQL}'\n  Note: '${3:Schema documentation}'\n}" },
];

// Extract defined table names, field names, and enums from text for context-aware autocompletion
function parseDocumentSymbols(text: string) {
  const tables: Array<{ name: string; fields: string[] }> = [];
  const enums: string[] = [];

  const tableRegex = /Table\s+([A-Za-z0-9_"]+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(text)) !== null) {
    const tableName = match[1].replace(/"/g, "");
    const body = match[2];
    const fields: string[] = [];
    const lineRegex = /^\s*([A-Za-z0-9_"]+)\s+([A-Za-z0-9_"]+)/gm;
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = lineRegex.exec(body)) !== null) {
      if (!["indexes", "Note"].includes(fieldMatch[1])) {
        fields.push(fieldMatch[1].replace(/"/g, ""));
      }
    }
    tables.push({ name: tableName, fields });
  }

  const enumRegex = /Enum\s+([A-Za-z0-9_"]+)/g;
  let enumMatch: RegExpExecArray | null;
  while ((enumMatch = enumRegex.exec(text)) !== null) {
    enums.push(enumMatch[1].replace(/"/g, ""));
  }

  return { tables, enums };
}

monaco.languages.registerCompletionItemProvider("dbml", {
  triggerCharacters: [" ", "[", ".", ":", ">", "<", "{", ",", "-"],
  provideCompletionItems(model, position) {
    const text = model.getValue();
    const word = model.getWordUntilPosition(position);
    const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
    const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1);

    const { tables, enums } = parseDocumentSymbols(text);

    // 1. Column settings inside `[...]`
    if (/\[[^\]]*$/.test(linePrefix)) {
      if (/(delete|update):\s*$/.test(linePrefix)) {
        return {
          suggestions: REF_ACTIONS.map((a) => ({
            label: a.label,
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: a.insertText,
            detail: a.detail,
            range,
          })),
        };
      }
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

    // 2. Table.Column reference completion after dot or `Ref:`
    if (/(Ref:?|ref:?|>|<|-)\s*([A-Za-z0-9_"]+)?$/.test(linePrefix) || linePrefix.includes(".")) {
      const suggestions: monaco.languages.CompletionItem[] = [];
      for (const t of tables) {
        suggestions.push({
          label: t.name,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: t.name,
          detail: `Table (${t.fields.length} fields)`,
          range,
        });
        for (const f of t.fields) {
          const full = `${t.name}.${f}`;
          suggestions.push({
            label: full,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: full,
            detail: `Field in ${t.name}`,
            range,
          });
        }
      }
      return { suggestions };
    }

    // 3. Top-level & Column definition completions
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
      ...enums.map((e) => ({
        label: e,
        kind: monaco.languages.CompletionItemKind.Enum,
        insertText: e,
        detail: "Custom Enum type",
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

// Hover tooltips for DBML elements
monaco.languages.registerHoverProvider("dbml", {
  provideHover(model, position) {
    const word = model.getWordAtPosition(position);
    if (!word) return null;
    const name = word.word;

    const docs: Record<string, string> = {
      Table: "**Table block**\nDefines a database table structure with fields and constraints.\n```dbml\nTable users {\n  id int [pk]\n  name varchar\n}\n```",
      Ref: "**Ref / Foreign Key**\nDefines relationships between tables.\n- `>` : one-to-many\n- `<` : many-to-one\n- `-` : one-to-one\n```dbml\nRef: orders.user_id > users.id\n```",
      Enum: "**Enum type**\nDefines an enumerated string type.\n```dbml\nEnum status {\n  active\n  inactive\n}\n```",
      TableGroup: "**TableGroup**\nGroups related tables together on the canvas.\n```dbml\nTableGroup Auth {\n  users\n  sessions\n}\n```",
      Project: "**Project metadata**\nDefines project name, database target, and top-level notes.",
      indexes: "**Indexes block**\nDefines composite or single-column indexes on a table.\n```dbml\nindexes {\n  (user_id, status) [unique]\n}\n```",
      pk: "**pk** (Primary Key)\nDesignates this column as the table's primary key.",
      unique: "**unique**\nEnsures all values in this column are distinct.",
      "not null": "**not null**\nRequires a non-null value for this field.",
      increment: "**increment**\nAuto-increments numeric primary key values.",
      varchar: "**varchar**\nVariable-length character string.",
      integer: "**integer / int**\n32-bit signed integer.",
      timestamp: "**timestamp**\nDate and time timestamp.",
      boolean: "**boolean / bool**\nTrue or false boolean flag.",
      uuid: "**uuid**\n128-bit Universally Unique Identifier.",
      jsonb: "**jsonb**\nBinary JSON storage for structured data.",
    };

    if (docs[name]) {
      return {
        contents: [{ value: docs[name] }],
      };
    }
    return null;
  },
});

// Folding provider for DBML `{ ... }` blocks
monaco.languages.registerFoldingRangeProvider("dbml", {
  provideFoldingRanges(model) {
    const ranges: monaco.languages.FoldingRange[] = [];
    const stack: number[] = [];
    const lineCount = model.getLineCount();

    for (let i = 1; i <= lineCount; i++) {
      const line = model.getLineContent(i);
      if (line.includes("{")) {
        stack.push(i);
      }
      if (line.includes("}") && stack.length > 0) {
        const start = stack.pop()!;
        if (i > start) {
          ranges.push({
            start,
            end: i,
            kind: monaco.languages.FoldingRangeKind.Region,
          });
        }
      }
    }
    return ranges;
  },
});

// Formatting provider for DBML
monaco.languages.registerDocumentFormattingEditProvider("dbml", {
  provideDocumentFormattingEdits(model) {
    const text = model.getValue();
    const lines = text.split(/\r?\n/);
    let indentLevel = 0;
    const formatted = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("}")) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      const indented = "  ".repeat(indentLevel) + trimmed;
      if (trimmed.endsWith("{") && !trimmed.startsWith("//")) {
        indentLevel++;
      }
      return indented;
    });

    return [
      {
        range: model.getFullModelRange(),
        text: formatted.join("\n"),
      },
    ];
  },
});

export { monaco };

