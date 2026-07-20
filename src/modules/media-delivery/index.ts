/**
 * Media delivery / storage facade (SOLID boundary).
 * Re-exports R2 upload + versioned keys + live publish helpers.
 * Prefer this import path for new callers; existing service paths remain valid.
 */
export { default } from "../../service/fileUpload.service";
export { default as fileUploadService } from "../../service/fileUpload.service";
export * from "../../service/media/delivery/mediaKeys";
export * from "../../service/media/delivery/publishLive";
