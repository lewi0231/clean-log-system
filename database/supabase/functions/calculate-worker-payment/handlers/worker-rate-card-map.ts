import { createLogger } from "../../_utils/logger.ts";
import type { RateCardModifierType, WorkerRateCard } from "./types.ts";

type Logger = ReturnType<typeof createLogger>;

export function buildWorkerRateCardMultiMap(
  rateCards: unknown[] | null | undefined,
  logger: Logger
): Map<string, Map<RateCardModifierType, WorkerRateCard>> {
  const root = new Map<string, Map<RateCardModifierType, WorkerRateCard>>();
  for (const raw of rateCards || []) {
    const row = raw as Record<string, unknown> & {
      worker_rate_card_field?: { field_config_id: string }[] | null;
    };
    const fieldMappings = row.worker_rate_card_field;
    const rateCard: WorkerRateCard = {
      id: row.id as string,
      worker_id: row.worker_id as string,
      modifier_type: row.modifier_type as RateCardModifierType,
      modifier_value: Number(row.modifier_value),
      currency: row.currency as string,
      role_title: row.role_title as string | null,
      effective_from: row.effective_from as string,
      effective_to: row.effective_to as string | null,
      is_active: row.is_active as boolean,
      field_config_ids: fieldMappings?.map((f) => f.field_config_id) ?? [],
    };
    const workerId = rateCard.worker_id;
    const mType = rateCard.modifier_type;
    let inner = root.get(workerId);
    if (!inner) {
      inner = new Map();
      root.set(workerId, inner);
    }
    if (inner.has(mType)) {
      logger.warn(
        "Duplicate active rate card row for worker and modifier_type; using last fetched row",
        { worker_id: workerId, modifier_type: mType }
      );
    }
    inner.set(mType, rateCard);
  }
  return root;
}

export function getWorkerRateCard(
  map: Map<string, Map<RateCardModifierType, WorkerRateCard>>,
  workerId: string,
  type: RateCardModifierType
): WorkerRateCard | undefined {
  return map.get(workerId)?.get(type);
}
