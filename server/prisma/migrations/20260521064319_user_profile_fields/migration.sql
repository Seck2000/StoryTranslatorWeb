-- AlterTable
ALTER TABLE "User" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT;

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN     "learningLang" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "level" TEXT NOT NULL DEFAULT 'debutant',
ADD COLUMN     "spokenLang" TEXT NOT NULL DEFAULT 'fr';
