import { log } from "services/log/log.service";

import { fieldsArray } from "../../../const/remoteStorageProviders/googleDrive/gapi.parameters";

export const createGDFile = ({ handleError, ensureFreshAccessToken }) => (name: string, mimeType: string, parents: string[], _retriedAfter401 = false): Promise<any> => {
  return new Promise((resolve, reject) => {
    window.gapi.client.drive.files.create({
      fields: fieldsArray.join(','),
      resource: {
        name,
        mimeType,
        parents,
      },
    }).then((response) => {
      log.appEvent('File created:', response);
      resolve(response);
    }).catch(async (error) => {
      if (error?.status === 401 && !_retriedAfter401) {
        try {
          const freshToken = await ensureFreshAccessToken();
          window.gapi.client.setToken({ access_token: freshToken });
          const resp = await createGDFile({ handleError, ensureFreshAccessToken })(name, mimeType, parents, true);
          resolve(resp);
          return;
        } catch {
          // refresh or retry failed — fall through and surface the original 401
        }
      }

      handleError('createFile', error, name);
      reject(error);
    });
  });
};
