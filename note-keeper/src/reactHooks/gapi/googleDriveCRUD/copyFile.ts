import { log } from "services/log/log.service";

import { File } from "dtos/file.model";
import { fieldsArray } from "../../../const/remoteStorageProviders/googleDrive/gapi.parameters";

export const copyFile = ({ handleError, ensureFreshAccessToken }) => (fileInfo: File, parentId?: string, _retriedAfter401 = false): Promise<any> => {
  return new Promise(async (resolve, reject) => {
    try {
      const targetParentId = parentId || fileInfo.parents?.[0];
      const copiedName = `${fileInfo.name} (copy)`;
      const resource = targetParentId
        ? { name: copiedName, parents: [targetParentId] }
        : { name: copiedName };

      const response = await window.gapi.client.drive.files.copy({
        fileId: fileInfo.id,
        fields: fieldsArray.join(','),
        resource,
      });

      log.appEvent('File copied:', response);
      resolve(response);
    } catch (error) {
      if (error?.status === 401 && !_retriedAfter401) {
        try {
          const freshToken = await ensureFreshAccessToken();
          window.gapi.client.setToken({ access_token: freshToken });
          const resp = await copyFile({ handleError, ensureFreshAccessToken })(fileInfo, parentId, true);
          resolve(resp);
          return;
        } catch {
          // refresh or retry failed — fall through and surface the original 401
        }
      }

      handleError('copyGDFile', error, fileInfo.name);
      reject(error);
    }
  });
};