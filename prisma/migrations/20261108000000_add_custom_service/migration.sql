-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "Booking" ADD COLUMN "customServiceTitle" TEXT;
