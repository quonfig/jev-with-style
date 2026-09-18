import type { QuonfigTypesafeNode } from "../generated/quonfig-server";
import type { TriageResult, TriageUser } from "./jev";

export type InboundEmail = { id: string; user: TriageUser; body: string };
export type UserRecord = TriageUser & { frustration?: number };

export type WorkerDeps = {
  users: Map<string, UserRecord>;
  pageOnCall: (email: InboundEmail, result: TriageResult) => void;
  log: (event: string, data: Record<string, unknown>) => void;
};

/**
 * Runs when a message arrives, off the request path. Jev's judgment happens
 * here, once, and is stored as a plain number on the user. Every later flag
 * check is a synchronous in-memory read.
 */
export function createSupportWorker(
  config: QuonfigTypesafeNode,
  triage: (email: string, user: TriageUser) => Promise<TriageResult | null>,
  deps: WorkerDeps,
) {
  return {
    async handleInbound(email: InboundEmail): Promise<{ paged: boolean; result: TriageResult | null }> {
      const result = await triage(email.body, email.user);
      if (!result) return { paged: false, result: null };

      const record: UserRecord = { ...(deps.users.get(email.user.key) ?? email.user), frustration: result.answers.frustration.score };
      deps.users.set(email.user.key, record);

      const paged = result.answers.urgent.noul >= result.thresholds.urgent;
      if (paged) deps.pageOnCall(email, result);

      deps.log("jev.triage", {
        email: email.id,
        variant: result.variant,
        model: result.model,
        urgent: result.answers.urgent.noul,
        frustration: result.answers.frustration.score,
        paged,
      });
      return { paged, result };
    },

    /** Anywhere, synchronous, microseconds. The threshold lives in the flag rule. */
    showRetentionOffer(user: UserRecord): boolean {
      return config.promoRetention10Pct({
        user: { key: user.key, plan: user.plan, frustration: user.frustration ?? 0 },
      });
    },
  };
}
