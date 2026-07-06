import { log } from "services/log/log.service";

import { File } from "dtos/file.model";
import { fieldsArray } from "../../../const/remoteStorageProviders/googleDrive/gapi.parameters";

export const getGDFileInfo = ({ handleError, ensureFreshAccessToken }) => (fileInfo: File, _retriedAfter401 = false): Promise<any> => {
  return new Promise((resolve, reject) => {
    const params = {
      fileId: fileInfo.id,
      fields: fieldsArray.join(','),
    };

    window.gapi.client.drive.files.get(params).then((response) => {
      log.appEvent('Downloaded file info from GD:', response);
      resolve(response.result);
    }).catch(async (error) => {
      if (error?.status === 404) {
        reject(error);
        return;
      }

      if (error?.status === 401 && !_retriedAfter401) {
        try {
          const freshToken = await ensureFreshAccessToken();
          window.gapi.client.setToken({ access_token: freshToken });
          const resp = await getGDFileInfo({ handleError, ensureFreshAccessToken })(fileInfo, true);
          resolve(resp);
          return;
        } catch {
          // refresh or retry failed — fall through and surface the original 401
        }
      }

      handleError('getCurrentFileInfo', error, fileInfo.name);
      reject(error);
    });
  });
};
