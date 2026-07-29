import { db } from "./db.js";
import { hashPassword } from "./auth/password.js";

/**
 * Creates the first global-admin account, bypassing invitations entirely —
 * every other account can only be created by accepting an admin-issued
 * invitation, so there has to be one way in that doesn't depend on an
 * account already existing.
 *
 * Usage: `npm run bootstrap-admin -w apps/server -- <email> <password>`.
 * Respects `ATHANORDB_DB_PATH` the same as the server itself.
 */
async function main(): Promise<void> {
  const [, , emailArg, passwordArg] = process.argv;
  if (!emailArg || !passwordArg) {
    console.error("Usage: npm run bootstrap-admin -w apps/server -- <email> <password>");
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  if (!email.includes("@")) {
    console.error("invalid email");
    process.exit(1);
  }
  if (passwordArg.length < 8) {
    console.error("password must be at least 8 characters");
    process.exit(1);
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    console.error(`a user with email ${email} already exists`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(passwordArg);
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO users (id, email, password_hash, is_admin) VALUES (?, ?, ?, 1)").run(id, email, passwordHash);
  console.log(`created global admin ${email} (id ${id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
