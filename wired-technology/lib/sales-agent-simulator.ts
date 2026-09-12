import { enrichAgentTextFromContext } from "@/lib/sales-agent-context";
import { enforceOriginalSalesStrategy, type StrategicDecision } from "@/lib/sales-strategy-enforcer";
import {
  evaluateSalesAgent,
  SALES_AGENT_VERSION,
  type SalesAgentState,
} from "@/lib/sales-agent-core";

export const SALES_AGENT_SIMULATOR_VERSION = SALES_AGENT_VERSION;
export type SalesAgentSimulationState = SalesAgentState;
export type SalesAgentSimulationDecision = StrategicDecision;

export async function simulateSalesAgent(input: { text: string; state?: SalesAgentSimulationState }) {
  const state = input.state || {};
  const effectiveText = enrichAgentTextFromContext(input.text, state);
  const evaluated = await evaluateSalesAgent({
    text: effectiveText,
    state,
    lead: { status: "NEW", name: "Cliente de prueba" },
  });
  const decision = await enforceOriginalSalesStrategy(input.text, evaluated.decision);

  return {
    version: evaluated.version,
    decision,
    originalText: input.text,
    effectiveText,
  };
}
