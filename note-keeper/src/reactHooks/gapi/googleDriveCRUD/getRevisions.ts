import { log } from "services/log/log.service";

type GetRevisionListParams = {
  fileId: string;
};

export const getGDRevisions = ({ handleError, ensureFreshAccessToken }) => (params: GetRevisionListParams, _retriedAfter401 = false): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    window.gapi.client.drive.revisions.list({
      fileId: params.fileId,
      pageSize: 100,
      fields: "revisions(id,modifiedTime,keepForever,size,lastModifyingUser(displayName,emailAddress,photoLink))",
    }).then((response) => {
      const revisions = response?.result?.revisions || [];

      revisions.sort((a, b) => {
        const aTime = a?.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
        const bTime = b?.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;

        return bTime - aTime;
      });

      log.appEvent('Downloaded revisions list from GD:', revisions.length);
      resolve(revisions);
    }).catch(async (error) => {
      if (error?.status === 401 && !_retriedAfter401) {
        try {
          const freshToken = await ensureFreshAccessToken();
          window.gapi.client.setToken({ access_token: freshToken });
          const resp = await getGDRevisions({ handleError, ensureFreshAccessToken })(params, true);
          resolve(resp);
          return;
        } catch {
          // refresh or retry failed — fall through and surface the original 401
        }
      }

      handleError('getGDRevisions', error);
      reject(error);
    });
  });
};
