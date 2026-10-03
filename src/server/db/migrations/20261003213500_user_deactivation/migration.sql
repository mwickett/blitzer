-- AlterTable
ALTER TABLE "User" ADD COLUMN     "anonymized_at" TIMESTAMP(3),
ADD COLUMN     "deactivated_at" TIMESTAMP(3);
