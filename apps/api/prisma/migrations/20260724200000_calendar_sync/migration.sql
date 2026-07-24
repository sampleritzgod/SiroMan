-- CreateEnum
CREATE TYPE "CalendarProviderId" AS ENUM ('google');

-- CreateEnum
CREATE TYPE "CalendarConnectionStatus" AS ENUM ('connected', 'syncing', 'error', 'paused', 'disconnected');

-- CreateEnum
CREATE TYPE "CalendarEventSyncStatus" AS ENUM ('pending', 'synced', 'error', 'removed');

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalendarProviderId" NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'connected',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "onRemovePolicy" TEXT NOT NULL DEFAULT 'cancel',
    "accountEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventMap" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" "CalendarProviderId" NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "syncStatus" "CalendarEventSyncStatus" NOT NULL DEFAULT 'pending',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "etag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarConnection_userId_status_idx" ON "CalendarConnection"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_userId_provider_key" ON "CalendarConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "CalendarEventMap_connectionId_syncStatus_idx" ON "CalendarEventMap"("connectionId", "syncStatus");

-- CreateIndex
CREATE INDEX "CalendarEventMap_itemId_idx" ON "CalendarEventMap"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventMap_itemId_provider_key" ON "CalendarEventMap"("itemId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventMap_connectionId_externalEventId_key" ON "CalendarEventMap"("connectionId", "externalEventId");

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventMap" ADD CONSTRAINT "CalendarEventMap_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventMap" ADD CONSTRAINT "CalendarEventMap_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
