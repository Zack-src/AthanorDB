import { StreamLanguage } from "@codemirror/language";
import { autocompletion, type CompletionContext, type CompletionResult, snippetCompletion } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";

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

// DBML Lexer and syntax highlighting rules
export const dbmlLanguage = StreamLanguage.define({
  name: "dbml",
  startState() {
    return { inCommentBlock: false };
  },
  token(stream, state) {
    if (state.inCommentBlock) {
      if (stream.match("*/")) {
        state.inCommentBlock = false;
      } else {
        stream.next();
      }
      return "comment";
    }

    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }

    if (stream.match("/*")) {
      state.inCommentBlock = true;
      return "comment";
    }

    if (stream.match("'''")) {
      while (!stream.eol()) {
        if (stream.match("'''")) break;
        stream.next();
      }
      return "string";
    }

    if (stream.match("'") || stream.match('"')) {
      const quote = stream.current();
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === quote && stream.string.charAt(stream.pos - 2) !== "\\") break;
      }
      return "string";
    }

    if (stream.match(/[{}\[\]()]/)) {
      return "bracket";
    }

    if (stream.match(/[<>-]+|[:=]/)) {
      return "operator";
    }

    if (stream.match(/\b\d+(\.\d+)?\b/)) {
      return "number";
    }

    if (stream.match(/[A-Za-z_][A-Za-z0-9_]*/)) {
      const word = stream.current();
      if (["Table", "Ref", "Enum", "Note", "Project", "TableGroup", "indexes", "as"].includes(word)) {
        return "keyword";
      }
      if (["pk", "primary key", "unique", "not", "null", "increment", "default", "note", "name", "ref", "headercolor", "delete", "update"].includes(word)) {
        return "annotation";
      }
      if (DBML_TYPES.includes(word)) {
        return "typeName";
      }
      return "variableName";
    }

    stream.next();
    return null;
  },
});

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

// CodeMirror Autocompletion extension
export function dbmlCompletion(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[\w".:>[-]+/);
  if (!word && !context.explicit) return null;

  const line = context.state.doc.lineAt(context.pos);
  const linePrefix = line.text.slice(0, context.pos - line.from);
  const docText = context.state.doc.toString();

  // 1. Settings inside `[...]`
  if (/\[[^\]]*$/.test(linePrefix)) {
    if (/(delete|update):\s*$/.test(linePrefix)) {
      return {
        from: word ? word.from : context.pos,
        options: [
          { label: "cascade", type: "keyword", detail: "Cascade deletion / update" },
          { label: "restrict", type: "keyword", detail: "Restrict deletion / update" },
          { label: "set null", type: "keyword", detail: "Set field to NULL" },
          { label: "set default", type: "keyword", detail: "Set field to DEFAULT" },
          { label: "no action", type: "keyword", detail: "No action" },
        ],
      };
    }
    return {
      from: word ? word.from : context.pos,
      options: [
        { label: "pk", type: "keyword", detail: "Primary Key constraint" },
        { label: "primary key", type: "keyword", detail: "Primary Key constraint" },
        { label: "unique", type: "keyword", detail: "Unique constraint" },
        { label: "not null", type: "keyword", detail: "Disallow NULL values" },
        { label: "null", type: "keyword", detail: "Allow NULL values" },
        { label: "increment", type: "keyword", detail: "Auto-increment field" },
        snippetCompletion("default: ${value}", { label: "default", type: "snippet", detail: "Default value" }),
        snippetCompletion("note: '${text}'", { label: "note", type: "snippet", detail: "Column note" }),
        snippetCompletion("ref: > ${table.column}", { label: "ref", type: "snippet", detail: "Inline foreign key" }),
        snippetCompletion("headercolor: '#${3b82f6}'", { label: "headercolor", type: "snippet", detail: "Header color" }),
      ],
    };
  }

  const { tables, enums } = parseDocumentSymbols(docText);

  // 2. Foreign Key Table.Column autocompletion
  if (/(Ref:?|ref:?|>|<|-)\s*([A-Za-z0-9_"]+)?$/.test(linePrefix) || linePrefix.includes(".")) {
    const options: Array<{ label: string; type: string; detail: string }> = [];
    for (const t of tables) {
      options.push({ label: t.name, type: "class", detail: `Table (${t.fields.length} fields)` });
      for (const f of t.fields) {
        options.push({ label: `${t.name}.${f}`, type: "property", detail: `Field in ${t.name}` });
      }
    }
    return {
      from: word ? word.from : context.pos,
      options,
    };
  }

  // 3. Top-level keywords & snippets
  const options = [
    snippetCompletion("Table ${name} {\n  ${id} integer [pk, increment]\n  ${name} varchar [not null]\n  ${created_at} timestamp [default: `now()`]\n}", {
      label: "Table",
      type: "snippet",
      detail: "Define table block",
    }),
    snippetCompletion("Ref: ${table1}.${col1} > ${table2}.${col2}", {
      label: "Ref",
      type: "snippet",
      detail: "Define relationship",
    }),
    snippetCompletion("Enum ${name} {\n  ${active}\n  ${inactive}\n}", {
      label: "Enum",
      type: "snippet",
      detail: "Define enum type",
    }),
    snippetCompletion("TableGroup ${group_name} {\n  ${table1}\n  ${table2}\n}", {
      label: "TableGroup",
      type: "snippet",
      detail: "Define table group",
    }),
    snippetCompletion("Project ${name} {\n  database_type: '${PostgreSQL}'\n  Note: '${Schema description}'\n}", {
      label: "Project",
      type: "snippet",
      detail: "Define project metadata",
    }),
    snippetCompletion("Note ${name} {\n  '${Text}'\n}", {
      label: "Note",
      type: "snippet",
      detail: "Define note block",
    }),
    ...DBML_TYPES.map((t) => ({ label: t, type: "type", detail: "Column type" })),
    ...enums.map((e) => ({ label: e, type: "enum", detail: "Custom Enum type" })),
    ...["Table", "Ref", "Enum", "Note", "Project", "TableGroup", "indexes", "as"].map((k) => ({ label: k, type: "keyword", detail: "DBML Keyword" })),
  ];

  return {
    from: word ? word.from : context.pos,
    options,
  };
}

export const athanorEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "13px",
      fontFamily: "'Fira Code', 'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
      backgroundColor: "#17181B",
      color: "#E2E8F0",
    },
    ".cm-content": {
      caretColor: "#6366F1",
      paddingTop: "10px",
      paddingBottom: "10px",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#6366F1",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "#334155 !important",
    },
    ".cm-gutters": {
      backgroundColor: "#17181B",
      color: "#475569",
      borderRight: "1px solid #27272A",
    },
    ".cm-activeLine": {
      backgroundColor: "#1E2024",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "#1E2024",
      color: "#94A3B8",
    },
    ".cm-tooltip-autocomplete": {
      backgroundColor: "#1E2024",
      border: "1px solid #3F3F46",
      borderRadius: "6px",
      boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      padding: "4px 8px",
      color: "#E2E8F0",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "#6366F1",
      color: "#FFFFFF",
    },
  },
  { dark: true },
);
