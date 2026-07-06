import { log } from "services/log/log.service";

import { File } from "dtos/file.model";
import { fieldsArray } from "../../../const/remoteStorageProviders/googleDrive/gapi.parameters";
import { openPickerForFile } from "./filePicker";

export const updateFile = ({
  handleError,
  setCurrentFile,
  ensureFreshAccessToken,
}) => (fileInfo: File, content: string, _retriedAfter401 = false): Promise<any> => {
  log.appEvent(`useGapi: Update file...: ${fileInfo.name}`);
  setCurrentFile({
    error: null,
    isFileSavingToRemoteStorage: true,
  });

  return new Promise(async (resolve, reject) => {
    const contentType = fileInfo.mimeType || 'text/plain';

    const params = {
      path: `https://www.googleapis.com/upload/drive/v3/files/${fileInfo.id}`,
      method: 'PATCH',
      params: {
        uploadType: 'media',
        fields: fieldsArray.join(','),
      },
      headers: {
        'Content-Type': `${contentType}; charset=UTF-8`,
      },
      body: content,
    };

    const failSave = (saveError) => {
      setCurrentFile({
        isFileSavedToRemoteStorage: false,
        isFileSavingToRemoteStorage: false,
        isFileUpdatedFromRemoteStorage: false,
        error: saveError,
      });
      handleError('getGDFile', saveError, fileInfo.name);
      reject(saveError);
    };

    try {
      const response = await window.gapi.client.request(params);
      log.appEvent(`useGapi: File updated: ${fileInfo.name}`, response);
      setCurrentFile({
        error: null,
        contentUpdatedLocalyAt: new Date().toISOString(), // To fix GD version became always newer
        isFileSavedToRemoteStorage: true,
        isFileSavingToRemoteStorage: false,
        isFileUpdatedFromRemoteStorage: false,
        isFileChangedLocaly: false,
      });
      resolve(response);
    } catch (error) {
      try {
        if (error.status === 403) {
          await openPickerForFile(fileInfo.name);
          const resp = await updateFile({ handleError, setCurrentFile, ensureFreshAccessToken })(fileInfo, content);
          resolve(resp);
        } else if (error.status === 401 && !_retriedAfter401) {
          const freshToken = await ensureFreshAccessToken();
          window.gapi.client.setToken({ access_token: freshToken });
          const resp = await updateFile({ handleError, setCurrentFile, ensureFreshAccessToken })(fileInfo, content, true);
          resolve(resp);
        } else {
          failSave(error);
        }
      } catch {
        failSave(error);
      }
    }
  });
};
