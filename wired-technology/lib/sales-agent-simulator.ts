import { enrichAgentTextFromContext } from "@/lib/sales-agent-context";
import {
  evaluateSalesAgent,
  SALES_AGENT_VERSION,
  type AgentDecision,
  type SalesAgentState,
} from "@/lib/sales-agent-core";

export const SALES_AGENT_SIMULATOR_VERSION = SALES_AGENT_VERSION;
export type SalesAgentSimulationState = SalesAgentState;
export type SalesAgentSimulationDecision = AgentDecision;

export async function simulateSalesAgent(input: { text: string; state?: SalesAgentSimulationState }) {
  const state = input.state || {};
  const effectiveText = enrichAgentTextFromContext(input.text, state);
  const result = await evaluateSalesAgent({
    text: effectiveText,
    state,
    lead: { status: "NEW", name: "Cliente de prueba" },
  });

  return {
    version: result.version,
    decision: result.decision,
    originalText: input.text,
    effectiveText,
  };
}
