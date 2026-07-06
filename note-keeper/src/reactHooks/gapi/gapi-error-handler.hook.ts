import { useCallback } from "react";
import { useGoogleAuth } from "reactHooks/gis/googleAuth.hook";
import { useActiveFile } from "reactHooks/fileManager/activeFile/activeFile.hook";
import { GoogleAuthError } from "reactHooks/gis/dto/error.dto";

import { log } from "services/log/log.service";

import { GapiError } from "dtos/googleDrive/error.dto";

export const useGapiErrorHandler = () => {
  const { ensureFreshAccessToken } = useGoogleAuth();
  const { setActiveFileInfo } = useActiveFile();

  const handleError = useCallback((source: string, error: GapiError & GoogleAuthError, message?: string) => {
    const errorMessage = error.result?.error?.message || error.error;
    const errorDetails = error.body || error.details;
    const errorStatusCode = error.status;

    setActiveFileInfo({ error: errorMessage, isFileDownloadingFromRemoteStorage: false });

    if (errorMessage && errorDetails) {
      if (message) {
        log.error(`${source}:`, message, '|', errorMessage);
      } else {
        log.error(`${source}:`, errorMessage);
      }
    } else {
      log.error(`${source}:`, error);
    }

    // Fire-and-forget safety net for call sites that don't implement their own
    // retry-after-refresh; the CRUD layer's own 401 handling covers the common paths.
    if (errorStatusCode === 401) {
      ensureFreshAccessToken().catch(() => {
        log.appEvent('GoogleAuth: background refresh triggered by a 401 failed.');
      });
    }

    return errorMessage;
  }, [ensureFreshAccessToken, setActiveFileInfo]);

  return {
    handleError,
  }
}
