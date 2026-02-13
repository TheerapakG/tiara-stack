import { getDb, schema } from "../db/index";
import { eq } from "drizzle-orm";

export interface SessionValidationResult {
  session: typeof schema.session.$inferSelect | null;
  error: string | null;
}

export async function getValidSessionByThreadId(
  threadId: string,
): Promise<SessionValidationResult> {
  const db = getDb();

  const session = await db
    .select()
    .from(schema.session)
    .where(eq(schema.session.threadId, threadId))
    .get();

  if (!session) {
    return { session: null, error: "No session found for this thread." };
  }

  if (session.deletedAt) {
    return { session: null, error: "This session has been deleted." };
  }

  return { session, error: null };
}

export async function getSessionByAcpSessionId(acpSessionId: string) {
  const db = getDb();

  return await db
    .select()
    .from(schema.session)
    .where(eq(schema.session.acpSessionId, acpSessionId))
    .get();
}

export async function getWorkspaceById(workspaceId: number) {
  const db = getDb();

  return await db.select().from(schema.workspace).where(eq(schema.workspace.id, workspaceId)).get();
}
