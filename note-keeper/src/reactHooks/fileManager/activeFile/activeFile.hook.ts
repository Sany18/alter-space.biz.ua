import { useCallback } from "react";
import { createSingletonProvider } from "services/reactProvider/singletonProvider";

import { useRecoilState } from "recoil";
import { explorerSelector } from "state/localState/explorerState";
import { activeFileInfoSelector } from "state/localState/activeFile/activeFileInfoState";

import { File } from "dtos/file.model";
import { activeFileContentSelector } from "state/localState/activeFile/activeFileContentState";

export const _useActiveFile = () => {
  const [activeFileInfo, setActiveFileInfo] = useRecoilState(activeFileInfoSelector);
  const [activeFilesState, setActiveFilesState] = useRecoilState(explorerSelector);
  const [activeFileContent, setActiveFileContent] = useRecoilState(activeFileContentSelector);

  const setActiveFileModel = useCallback((file: File) => {
    const activeFileModel = file ? new File(file) : null;
    const openFiles = activeFileModel
      ? (activeFilesState.openFiles || []).some(openFile => openFile.id === activeFileModel.id)
        ? (activeFilesState.openFiles || []).map(openFile =>
            openFile.id === activeFileModel.id ? activeFileModel : openFile
          )
        : [...(activeFilesState.openFiles || []), activeFileModel]
      : activeFilesState.openFiles || [];

    setActiveFilesState({ activeFileModel, openFiles });
  }, [activeFilesState.openFiles, setActiveFilesState]);

  return {
    activeFileInfo,
    setActiveFileInfo,
    activeFileContent,
    setActiveFileContent,
    activeFileModel: activeFilesState.activeFileModel,
    openFiles: activeFilesState.openFiles || [],
    setActiveFileModel,
  }
};

export const {
  Provider: ActiveFileProvider,
  useValue: useActiveFile,
} = createSingletonProvider(_useActiveFile, 'ActiveFile');
