-- Add AI recommended action
ALTER TABLE "Deal" ADD COLUMN "recommendedAction" TEXT;

-- Add hygiene tracking columns
ALTER TABLE "Deal" ADD COLUMN "hygieneStatus" TEXT NOT NULL DEFAULT 'UNCHECKED';
ALTER TABLE "Deal" ADD COLUMN "missingFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Deal" ADD COLUMN "lastHygieneAt" TIMESTAMP(3);

-- Add MEDDICC qualification fields
ALTER TABLE "Deal" ADD COLUMN "meddiccMetrics"          TEXT;
ALTER TABLE "Deal" ADD COLUMN "meddiccEconomicBuyer"    TEXT;
ALTER TABLE "Deal" ADD COLUMN "meddiccDecisionCriteria" TEXT;
ALTER TABLE "Deal" ADD COLUMN "meddiccDecisionProcess"  TEXT;
ALTER TABLE "Deal" ADD COLUMN "meddiccIdentifyPain"     TEXT;
ALTER TABLE "Deal" ADD COLUMN "meddiccChampion"         TEXT;
ALTER TABLE "Deal" ADD COLUMN "meddiccCompetition"      TEXT;
