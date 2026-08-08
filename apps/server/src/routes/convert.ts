import type { FastifyInstance } from "fastify";
import { describeDbmlParseError, parseSql, projectToDbml, toProject, type SqlDialect } from "@athanordb/dbml-engine";
import { requireUser } from "../auth/session.js";

const SQL_DIALECTS: SqlDialect[] = ["postgres", "mysql", "mssql"];

function isSqlDialect(value: unknown): value is SqlDialect {
  return typeof value === "string" && (SQL_DIALECTS as string[]).includes(value);
}

/**
 * Stateless SQL DDL -> DBML conversion, touching no project.
 *
 * Exists so that *every* importer — the built-in SQL ones and any user plugin
 * — can hand the app plain DBML: the plugin API deliberately makes DBML the
 * single import currency (see `plugins/types.ts`), and the SQL parser lives
 * server-side in `@dbml/core`, which is far too large to ship to the browser
 * just so a built-in importer can match the plugin contract.
 */
export function registerConvertRoutes(app: FastifyInstance): void {
  app.post("/api/convert/to-dbml", async (req, reply) => {
    const user = requireUser(req, reply);
    if (!user) return;

    const body = (req.body ?? {}) as { source?: string; dialect?: string };
    if (!body.source?.trim()) {
      reply.code(400);
      return { error: "source is required" };
    }
    if (!isSqlDialect(body.dialect)) {
      reply.code(400);
      return { error: `dialect must be one of ${SQL_DIALECTS.join(", ")}` };
    }

    try {
      const database = parseSql(body.source, body.dialect);
      return { dbml: projectToDbml(toProject(database, "Imported", body.source)) };
    } catch (err) {
      const info = describeDbmlParseError(err);
      reply.code(400);
      return { error: `SQL parse error: ${info.message}`, ...info };
    }
  });
}
