import {
  emitUploadProgress,
  emitUploadComplete,
  emitUploadError,
} from "./socketService";

// Map to store upload progress data
const uploadProgressMap = new Map<
  string,
  {
    bytesReceived: number;
    bytesExpected: number;
    percent: number;
    completed: boolean;
    error?: string;
    // Add a timestamp of when this was created
    createdAt: number;
    // Add result data for completed uploads
    resultData?: any;
  }
>();

/**
 * Initialize a new upload progress tracker
 * @param uploadId Unique ID for the upload
 */
export const initUploadProgress = (uploadId: string): void => {
  const initialProgress = {
    bytesReceived: 0,
    bytesExpected: 0,
    percent: 0,
    completed: false,
    createdAt: Date.now(),
  };

  uploadProgressMap.set(uploadId, initialProgress);
  // Don't emit immediately - client hasn't joined the room yet
  // We'll emit when they join instead
};

/**
 * Update upload progress
 * @param uploadId Unique ID for the upload
 * @param bytesReceived Bytes received so far
 * @param bytesExpected Total bytes expected
 */
export const updateUploadProgress = (
  uploadId: string,
  bytesReceived: number,
  bytesExpected: number,
): void => {
  const percent =
    bytesExpected > 0 ? Math.round((bytesReceived / bytesExpected) * 100) : 0;

  const currentData = uploadProgressMap.get(uploadId);

  const progressData = {
    bytesReceived,
    bytesExpected,
    percent,
    completed: bytesReceived === bytesExpected && bytesExpected > 0,
    createdAt: currentData?.createdAt || Date.now(),
  };

  uploadProgressMap.set(uploadId, progressData);
  emitUploadProgress(uploadId, progressData);
};

/**
 * Mark upload as completed
 * @param uploadId Unique ID for the upload
 * @param resultData Optional result data to include
 */
export const completeUpload = (uploadId: string, resultData?: any): void => {
  const progress = uploadProgressMap.get(uploadId);
  if (progress) {
    const completeData = {
      ...progress,
      completed: true,
      percent: 100,
      resultData, // Store the result data
    };

    uploadProgressMap.set(uploadId, completeData);
    emitUploadComplete(uploadId, { ...completeData, ...resultData });
  }
};

/**
 * Mark upload as failed
 * @param uploadId Unique ID for the upload
 * @param errorMessage Error message
 */
export const failUpload = (uploadId: string, errorMessage: string): void => {
  const progress = uploadProgressMap.get(uploadId);
  if (progress) {
    const errorData = {
      ...progress,
      error: errorMessage,
    };

    uploadProgressMap.set(uploadId, errorData);
    emitUploadError(uploadId, errorMessage);
  }
};

/**
 * Get upload progress
 * @param uploadId Unique ID for the upload
 * @returns Progress data or undefined if not found
 */
export const getUploadProgress = (uploadId: string) => {
  return uploadProgressMap.get(uploadId) || undefined;
};

/**
 * Remove upload progress data after it's no longer needed
 * @param uploadId Unique ID for the upload
 */
export const cleanupUploadProgress = (uploadId: string): void => {
  // Only remove after some time to ensure clients can get final status
  setTimeout(() => {
    uploadProgressMap.delete(uploadId);
  }, 3600000); // Keep for 1 hour
};
