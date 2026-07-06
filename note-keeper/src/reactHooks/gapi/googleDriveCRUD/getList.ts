import { foldersFirts } from "services/sortFiles/foldersFirst";

import { File } from "dtos/file.model";

export const getList = ({ handleError, ensureFreshAccessToken }) => (params: any, _retriedAfter401 = false): Promise<File[]> => {
  return new Promise((resolve, reject) => {
    window.gapi.client.drive.files.list(params).then((response) => {
      const files = response.result.files
        .map(f => new File(f))
        .sort(foldersFirts);

      resolve(files);
    }).catch(async (error) => {
      if (error?.status === 401 && !_retriedAfter401) {
        try {
          const freshToken = await ensureFreshAccessToken();
          window.gapi.client.setToken({ access_token: freshToken });
          const resp = await getList({ handleError, ensureFreshAccessToken })(params, true);
          resolve(resp);
          return;
        } catch {
          // refresh or retry failed — fall through and surface the original 401
        }
      }

      handleError('getGDList', error);
      reject(error);
    });
  });
};
