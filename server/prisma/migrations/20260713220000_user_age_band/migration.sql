-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN IF NOT EXISTS "ageBand" TEXT NOT NULL DEFAULT 'moyens';
