import { log } from "services/log/log.service";

import { File } from "dtos/file.model";
import { openPickerForFile } from "./filePicker";

export const deleteFileForever = ({ handleError, ensureFreshAccessToken }) => (fileInfo: File, _retriedAfter401 = false): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    const params = {
      fileId: fileInfo.id,
    };

    try {
      const response = await window.gapi.client.drive.files.delete(params)
      log.appEvent('File deleted forever:', response);
      resolve(response);
    } catch (error) {
      try {
        if (error.status === 403) {
          await openPickerForFile(fileInfo.name);
          const resp = await deleteFileForever({ handleError, ensureFreshAccessToken })(fileInfo);
          resolve(resp);
        } else if (error.status === 401 && !_retriedAfter401) {
          const freshToken = await ensureFreshAccessToken();
          window.gapi.client.setToken({ access_token: freshToken });
          const resp = await deleteFileForever({ handleError, ensureFreshAccessToken })(fileInfo, true);
          resolve(resp);
        } else {
          handleError('deleteGDFileForever', error, fileInfo.name);
          reject(error);
        }
      } catch {
        reject(error);
      }
    }
  });
};
