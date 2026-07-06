import { log } from "services/log/log.service";

type GetRevisionContentParams = {
  fileId: string;
  revisionId: string;
};

export const getGDRevisionContent = ({ handleError, ensureFreshAccessToken }) => (params: GetRevisionContentParams, _retriedAfter401 = false): Promise<string> => {
  return new Promise((resolve, reject) => {
    window.gapi.client.drive.revisions.get({
      fileId: params.fileId,
      revisionId: params.revisionId,
      alt: 'media',
    }).then((response) => {
      log.appEvent('Downloaded revision content from GD:', params.revisionId);
      resolve(response.body || '');
    }).catch(async (error) => {
      if (error?.status === 401 && !_retriedAfter401) {
        try {
          const freshToken = await ensureFreshAccessToken();
          window.gapi.client.setToken({ access_token: freshToken });
          const resp = await getGDRevisionContent({ handleError, ensureFreshAccessToken })(params, true);
          resolve(resp);
          return;
        } catch {
          // refresh or retry failed — fall through and surface the original 401
        }
      }

      handleError('getGDRevisionContent', error);
      reject(error);
    });
  });
};
