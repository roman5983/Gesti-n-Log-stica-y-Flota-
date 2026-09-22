-- Uploaded files move from the local disk (uploads/) into the database.
-- Hosting platforms like Render's free tier wipe the disk on every deploy or
-- restart; files are small (<= 1 MB, F-9), so MEDIUMBLOB (<= 16 MB) fits.
--
-- `content` is nullable only because rows uploaded before this migration
-- have no bytes in the DB (their files stayed on the old disk). The API
-- reports those as "file no longer available"; every new upload stores it.

-- AlterTable
ALTER TABLE `driver_documents` DROP COLUMN `file_path`,
    ADD COLUMN `content` MEDIUMBLOB NULL;

-- AlterTable
ALTER TABLE `maintenance_attachments` DROP COLUMN `file_path`,
    ADD COLUMN `content` MEDIUMBLOB NULL;
