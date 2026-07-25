import { useExplorer } from "reactHooks/fileManager/explorer/explorer.hook";
import { useActiveFile } from "reactHooks/fileManager/activeFile/activeFile.hook";
import { useGoogleAuth } from "reactHooks/gis/googleAuth.hook";
import { createSingletonProvider } from "services/reactProvider/singletonProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { log } from "services/log/log.service";
import { appendChildToFolder, findElementInTree, getQniqueFilesAndUpdateOld, getRootId, updateTreeElement } from "services/tree/treeHelpers";

import { appSelector } from "state/localState/appState";
import { useRecoilState } from "recoil";
import { sessionSelector } from "state/sessionState/sessionState";
import { explorerSelector } from "state/localState/explorerState";
import { fileUploadingSelector } from "state/sessionState/fileUploadingState";

import { File } from "../../dtos/file.model";
import { isTokenExpired } from "reactHooks/gis/googleAuth.hook";
import { getList } from "./googleDriveCRUD/getList";
import { getGDFile } from "./googleDriveCRUD/getFile";
import { deleteFile } from "./googleDriveCRUD/deleteFile";
import { renameFile } from "./googleDriveCRUD/renameFile";
import { updateFile } from "./googleDriveCRUD/updateFile";
import { uploadFiles } from "./googleDriveCRUD/uploadFIles";
import { createGDFile } from "./googleDriveCRUD/createFile";
import { getGDFileInfo } from "./googleDriveCRUD/getFileInfo";
import { MimeTypesEnum } from "const/mimeTypes/mimeTypes.const";
import { GDStorageQuota } from "dtos/googleDrive/storageQuota.dto";
import { deleteFileForever } from "./googleDriveCRUD/deleteFIleForever";
import { openPickerForFile } from "./googleDriveCRUD/filePicker";
import { changeGDFileParent } from "./googleDriveCRUD/changeFileParent";
import { copyFile } from "./googleDriveCRUD/copyFile";
import { useGapiErrorHandler } from "./gapi-error-handler.hook";
import { getAllFromRootParams, getChildrenParams } from "const/remoteStorageProviders/googleDrive/gapi.parameters";
import googleDriveSvg from "assets/icons/google-drive.svg";
import { getGDRevisions } from "./googleDriveCRUD/getRevisions";
import { getGDRevisionContent } from "./googleDriveCRUD/getRevisionContent";

let gapiCallbacks = [];

// Every Drive operation goes through this gate. An expired browser token is rejected
// before dispatch so the UI can offer the Firebase redirect-based Reconnect action.
const authorizeGapiFunction = (ensureFreshAccessToken, request) => async (...args) => {
  const accessToken = await ensureFreshAccessToken();
  window.gapi.client.setToken({ access_token: accessToken });
  return request(...args);
};

export const _useGapi = () => {
  const [sessionState] = useRecoilState(sessionSelector);
  const [filesListState] = useRecoilState(explorerSelector);
  const [appState, setAppState] = useRecoilState(appSelector);
  const [fileUploading, setFileUploading] = useRecoilState(fileUploadingSelector);

  const [gapiInitialized, setGapiInitialized] = useState(false);

  const { handleError } = useGapiErrorHandler();
  const { currentUser, ensureFreshAccessToken } = useGoogleAuth();
  const { fileTree, explorerState, setTree, setExplorerInProgress, setExplorerState } = useExplorer();

  const fileTreeRef = useRef(fileTree);
  useEffect(() => { fileTreeRef.current = fileTree; }, [fileTree]);
  const { setActiveFileInfo } = useActiveFile();

  const rootId = useMemo(() => getRootId(fileTree), [fileTree?.length]);

  // Initialize gapi
  useEffect(() => {
    log.appEvent('Initializing gapi...');

    const initGapi = () => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: import.meta.env.VITE_GOOGLE_WEB_API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
          });

          window.gapi.load('picker');

          log.appEvent('Gapi initialized');
          setGapiInitialized(true);
        } catch (error) {
          handleError('initGapi', error);
        }
      });
    }

    // @ts-ignore
    window.initGapi = initGapi;

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.onload = initGapi;
    document.body.appendChild(script);
  }, [setGapiInitialized]);

  useEffect(() => {
    if (gapiInitialized && gapiCallbacks.length) {
      gapiCallbacks.forEach(cb => cb());
      gapiCallbacks = [];
    }
  }, [gapiInitialized, gapiCallbacks]);

  const executeAfterGapiInit = useCallback((callback: () => void) => {
    if (gapiInitialized) {
      callback();
    } else {
      gapiCallbacks.push(callback);
    }
  }, [gapiInitialized, gapiCallbacks]);

  // Forward the Google OAuth token returned by Firebase to gapi.
  useEffect(() => {
    const token = currentUser.googleAccessTokenToGD?.access_token;
    if (gapiInitialized && token) {
      window.gapi.client.setToken({ access_token: token });
    }
  }, [gapiInitialized, currentUser.googleAccessTokenToGD?.access_token]);

  const getGDInfo = useCallback(async (_retriedAfter401 = false): Promise<any> => {
    try {
      const accessToken = await ensureFreshAccessToken({
        forceRefresh: _retriedAfter401,
      });
      window.gapi.client.setToken({ access_token: accessToken });

      return await window.gapi.client.drive.about.get({
        fields: 'storageQuota'
      });
    } catch (error: any) {
      if (error?.status === 401 && !_retriedAfter401) {
        try {
          return await getGDInfo(true);
        } catch {
          handleError('getGDInfo', error);
          return;
        }
      }

      handleError('getGDInfo', error);
    }
  }, [gapiInitialized, handleError, ensureFreshAccessToken]);

  // Get quota info only after a usable token exists. This avoids turning gapi
  // initialization itself into an unauthenticated Drive request.
  useEffect(() => {
    const accessToken = currentUser.googleAccessTokenToGD?.access_token;
    const tokenValid = accessToken && !isTokenExpired(currentUser.googleAccessTokenToGD);
    if (!gapiInitialized || !currentUser.loggedIn || !tokenValid) return;

    getGDInfo().then(response => {
      if (!response?.result?.storageQuota) return;

      const storageQuota = new GDStorageQuota(response.result.storageQuota);
      setAppState({ storageQuota });
    });
  }, [
    gapiInitialized,
    currentUser.loggedIn,
    currentUser.googleAccessTokenToGD?.access_token,
    getGDInfo,
    setAppState,
  ]);

  const getGDList = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      getList({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const getFile = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      getGDFile({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const getFileInfo = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      getGDFileInfo({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const updateGDFile = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      updateFile({
        setCurrentFile: setActiveFileInfo,
        handleError,
        ensureFreshAccessToken,
      }),
    ),
    [handleError, ensureFreshAccessToken, setActiveFileInfo],
  );

  const changeFileParent = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      changeGDFileParent({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const deleteGDFile = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      deleteFile({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const deleteGDFileForever = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      deleteFileForever({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const renameGDFile = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      renameFile({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const copyGDFile = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      copyFile({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const createFile = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      createGDFile({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const getGDRevisionsList = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      getGDRevisions({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const getGDFileRevisionContent = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      getGDRevisionContent({ handleError, ensureFreshAccessToken }),
    ),
    [handleError, ensureFreshAccessToken],
  );

  const uploadFileToGD = useCallback(
    authorizeGapiFunction(
      ensureFreshAccessToken,
      uploadFiles({ ensureFreshAccessToken }),
    ),
    [ensureFreshAccessToken],
  );

  const openAuthorizedPickerForFile = useCallback(
    authorizeGapiFunction(ensureFreshAccessToken, openPickerForFile),
    [ensureFreshAccessToken],
  );

  const fetchChildrenList = useCallback(async (fileFromList: File) => {
    try {
      const currentFileChildrenList = await getGDList(getChildrenParams(fileFromList.id));

      // Read latest tree via ref — avoids stale closure and respects folder state changes during fetch
      const latestTree = fileTreeRef.current;
      const currentFile = findElementInTree(latestTree, fileFromList.id);

      // Discard result if user closed the folder while it was loading
      if (!currentFile?.folderOpen) return;

      const newTree = updateTreeElement(
        latestTree,
        fileFromList.id,
        {
          ...fileFromList,
          children: getQniqueFilesAndUpdateOld(fileFromList.children || [], currentFileChildrenList),
          folderOpen: true,
        }
      );

      setTree(newTree);
      return newTree;
    } catch (error) {
      log.error('App: Error getting children list', error);
      setExplorerState({ error });
    }
  }, [getGDList, setTree, setExplorerState]);

  const _GDStorageQuota = useMemo(() => {
    const { usagePercent, limitStr, usageStr } = appState.storageQuota;

    if (!usagePercent) return null;

    return `Google Drive: ${usagePercent || 0}% used | ${usageStr || 0} of ${limitStr || 0}`;
  }, [appState.storageQuota]);

  const createGDWrapperFolder = useCallback((children) => {
    return new File({
      ...children[0],
      id: children[0].parents[0] || 'root',
      name: 'Google Drive',
      title: _GDStorageQuota,
      parents: [],
      children,
      mimeType: MimeTypesEnum.Folder,
      iconLink: googleDriveSvg,
      draggable: false,
    });
  }, [_GDStorageQuota]);

  const fetchRootFilesList = useCallback(async () => {
    log.appEvent('App: fetching root files list');
    setExplorerInProgress(true);

    try {
      const freshListOfRootEntities = await getGDList(getAllFromRootParams);
      freshListOfRootEntities.forEach(e => e.root = true);
      const wrappedRootFolder = [createGDWrapperFolder(freshListOfRootEntities)];

      const allUniqueEntities = getQniqueFilesAndUpdateOld(fileTree, wrappedRootFolder);

      setTree(allUniqueEntities);
    } catch (error) {
      log.error('App: Error getting root files list', error);
      setExplorerState({ error });
    } finally {
      setExplorerInProgress(false);
    }
  }, [getGDList, createGDWrapperFolder, fileTree, setTree, setExplorerState, setExplorerInProgress]);

  /////////////////////////////////////////////
  // Upload batch of files to Google Drive
  /////////////////////////////////////////////
  useEffect(() => {
    if (fileUploading.filesToUpload.length) {
      let latestFileTree = fileTree;

      fileUploading.filesToUpload.forEach(file => {
        uploadFileToGD(file.file, [file.parentId])
          .then(response => {
            const newFile = new File(response.result);
            const finished = fileUploading.totalFiles ===
              fileUploading.successfulUploads.length + fileUploading.failedUploads.length;

            setFileUploading({
              progress: fileUploading.progress + 1,
              inProgress: finished ? false : true,
              totalFiles: finished ? 0 : fileUploading.totalFiles,
              successfulUploads: finished ? [] : [...fileUploading.successfulUploads, file],
              finished
            });

            latestFileTree = appendChildToFolder(latestFileTree, file.parentId, newFile, true);

            setTree(latestFileTree);
          })
          .catch(error => {
            const finished = fileUploading.totalFiles ===
              fileUploading.successfulUploads.length + fileUploading.failedUploads.length;

            setFileUploading({
              progress: fileUploading.progress + 1,
              inProgress: finished ? false : true,
              totalFiles: finished ? 0 : fileUploading.totalFiles,
              failedUploads: finished ? [] : [...fileUploading.failedUploads, file],
              finished
            });
          });
      });

      setFileUploading({
        totalFiles: fileUploading.totalFiles + fileUploading.filesToUpload.length,
        finished: false,
        inProgress: true,
        filesToUpload: [],
      });
    }
  }, [filesListState.fileTree, fileUploading, uploadFileToGD]);

    //////////////////////////////////////////
  // Get root files list when token is valid
  //////////////////////////////////////////
  useEffect(() => {
    const accessToken = currentUser.googleAccessTokenToGD?.access_token;
    const tokenValid = accessToken && !isTokenExpired(currentUser.googleAccessTokenToGD);

    if (sessionState.isAppLoaded && gapiInitialized && currentUser.loggedIn && tokenValid) {
      fetchRootFilesList();
    }
  }, [sessionState.isAppLoaded, gapiInitialized, currentUser.loggedIn, currentUser.googleAccessTokenToGD?.access_token]);

  return {
    rootId,
    gapiInitialized,
    getFile,
    getGDList,
    getGDInfo,
    createFile,
    getFileInfo,
    renameGDFile,
    copyGDFile,
    getGDRevisionsList,
    getGDFileRevisionContent,
    updateGDFile,
    deleteGDFile,
    uploadFileToGD,
    changeFileParent,
    fetchChildrenList,
    openPickerForFile: openAuthorizedPickerForFile,
    fetchRootFilesList,
    deleteGDFileForever,
    executeAfterGapiInit,
  }
}

export const {
  Provider: GapiProvider,
  useValue: useGapi,
} = createSingletonProvider(_useGapi, 'Gapi');
