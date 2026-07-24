-- AlterTable
CREATE TYPE "ReminderFrequency" AS ENUM ('gentle', 'standard', 'intensive');

ALTER TABLE "User"
ADD COLUMN "reminderFrequency" "ReminderFrequency" NOT NULL DEFAULT 'standard',
ADD COLUMN "reminderMorningMinute" INTEGER NOT NULL DEFAULT 540,
ADD COLUMN "reminderEveningMinute" INTEGER NOT NULL DEFAULT 1080,
ADD COLUMN "browserNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable ReminderOccurrence default channel → inbox
ALTER TABLE "ReminderOccurrence" ALTER COLUMN "channel" SET DEFAULT 'inbox';
