import type { SystemStyleObject } from '@chakra-ui/react';
import { Box, useColorMode, Flex } from '@chakra-ui/react';
import type { EditorProps } from '@monaco-editor/react';
import MonacoEditor from '@monaco-editor/react';
import type * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import React from 'react';

import type { File, Monaco } from './types';

import useClientRect from 'lib/hooks/useClientRect';
import useIsMobile from 'lib/hooks/useIsMobile';
import isMetaKey from 'lib/isMetaKey';

import CodeEditorBreadcrumbs from './CodeEditorBreadcrumbs';
import CodeEditorLoading from './CodeEditorLoading';
import CodeEditorSideBar, { CONTAINER_WIDTH as SIDE_BAR_WIDTH } from './CodeEditorSideBar';
import CodeEditorTabs from './CodeEditorTabs';
import addFileImportDecorations from './utils/addFileImportDecorations';
import getFullPathOfImportedFile from './utils/getFullPathOfImportedFile';
import * as themes from './utils/themes';
import useThemeColors from './utils/useThemeColors';

const EDITOR_OPTIONS: EditorProps['options'] = {
  readOnly: true,
  minimap: { enabled: false },
  scrollbar: {
    alwaysConsumeMouseWheel: true,
  },
  dragAndDrop: false,
};

const TABS_HEIGHT = 35;
const BREADCRUMBS_HEIGHT = 22;
const EDITOR_HEIGHT = 500;

interface Props {
  data: Array<File>;
}

const CodeEditor = ({ data }: Props) => {
  const [ instance, setInstance ] = React.useState<Monaco | undefined>();
  const [ index, setIndex ] = React.useState(0);
  const [ tabs, setTabs ] = React.useState([ data[index].file_path ]);
  const [ isMetaPressed, setIsMetaPressed ] = React.useState(false);

  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor>();
  const [ containerRect, containerNodeRef ] = useClientRect<HTMLDivElement>();

  const { colorMode } = useColorMode();
  const isMobile = useIsMobile();
  const themeColors = useThemeColors();

  const editorWidth = containerRect ? containerRect.width - (isMobile ? 0 : SIDE_BAR_WIDTH) : 0;

  React.useEffect(() => {
    instance?.editor.setTheme(colorMode === 'light' ? 'blockscout-light' : 'blockscout-dark');
  }, [ colorMode, instance?.editor ]);

  const handleEditorDidMount = React.useCallback((editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    setInstance(monaco);
    editorRef.current = editor;

    monaco.editor.defineTheme('blockscout-light', themes.light);
    monaco.editor.defineTheme('blockscout-dark', themes.dark);
    monaco.editor.setTheme(colorMode === 'light' ? 'blockscout-light' : 'blockscout-dark');

    const loadedModels = monaco.editor.getModels();
    const loadedModelsPaths = loadedModels.map((model) => model.uri.path);
    const newModels = data.slice(1)
      .filter((file) => !loadedModelsPaths.includes(file.file_path))
      .map((file) => monaco.editor.createModel(file.source_code, 'sol', monaco.Uri.parse(file.file_path)));

    loadedModels.concat(newModels).forEach(addFileImportDecorations);
  // componentDidMount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ ]);

  const handleSelectFile = React.useCallback((index: number, lineNumber?: number) => {
    setIndex(index);
    setTabs((prev) => prev.some((item) => item === data[index].file_path) ? prev : ([ ...prev, data[index].file_path ]));
    if (lineNumber !== undefined && !Object.is(lineNumber, NaN)) {
      window.setTimeout(() => {
        editorRef.current?.revealLineInCenter(lineNumber);
      }, 0);
    }
    editorRef.current?.focus();
  }, [ data ]);

  const handleTabSelect = React.useCallback((path: string) => {
    const index = data.findIndex((item) => item.file_path === path);
    if (index > -1) {
      setIndex(index);
    }
  }, [ data ]);

  const handleTabClose = React.useCallback((path: string) => {
    setTabs((prev) => {
      if (prev.length > 1) {
        const tabIndex = prev.findIndex((item) => item === path);
        const isActive = data[index].file_path === path;

        if (isActive) {
          const nextActiveIndex = data.findIndex((item) => item.file_path === prev[Math.max(0, tabIndex - 1)]);
          setIndex(nextActiveIndex);
        }

        return prev.filter((item) => item !== path);
      }

      return prev;
    });
  }, [ data, index ]);

  const handleClick = React.useCallback((event: React.MouseEvent) => {
    if (!isMetaPressed && !isMobile) {
      return;
    }

    const target = event.target as HTMLSpanElement;
    const isImportLink = target.classList.contains('import-link');
    if (isImportLink) {
      const path = target.innerText;
      const fullPath = getFullPathOfImportedFile(data[index].file_path, path);
      const fileIndex = data.findIndex((file) => file.file_path === fullPath);
      if (fileIndex > -1) {
        event.stopPropagation();
        handleSelectFile(fileIndex);
      }
    }
  }, [ data, handleSelectFile, index, isMetaPressed, isMobile ]);

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    isMetaKey(event) && setIsMetaPressed(true);
  }, []);

  const handleKeyUp = React.useCallback(() => {
    setIsMetaPressed(false);
  }, []);

  const containerSx: SystemStyleObject = React.useMemo(() => ({
    '.editor-container': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: `${ editorWidth }px`,
      height: '100%',
    },
    '.highlight': {
      backgroundColor: themeColors['custom.findMatchHighlightBackground'],
    },
    '&&.meta-pressed .import-link': {
      _hover: {
        color: themeColors['custom.fileLink.hoverForeground'],
        textDecoration: 'underline',
        cursor: 'pointer',
      },
    },
  }), [ editorWidth, themeColors ]);

  if (data.length === 1) {
    return (
      <Box overflow="hidden" borderRadius="md" height={ `${ EDITOR_HEIGHT }px` }>
        <MonacoEditor
          language="sol"
          path={ data[index].file_path }
          defaultValue={ data[index].source_code }
          options={ EDITOR_OPTIONS }
          onMount={ handleEditorDidMount }
          loading={ <CodeEditorLoading/> }
        />
      </Box>
    );
  }

  return (
    <Flex
      className={ isMetaPressed ? 'meta-pressed' : undefined }
      overflow="hidden"
      borderRadius="md"
      width="100%"
      height={ `${ EDITOR_HEIGHT + TABS_HEIGHT + BREADCRUMBS_HEIGHT }px` }
      position="relative"
      ref={ containerNodeRef }
      sx={ containerSx }
      onClick={ handleClick }
      onKeyDown={ handleKeyDown }
      onKeyUp={ handleKeyUp }
    >
      <Box flexGrow={ 1 }>
        <CodeEditorTabs tabs={ tabs } activeTab={ data[index].file_path } onTabSelect={ handleTabSelect } onTabClose={ handleTabClose }/>
        <CodeEditorBreadcrumbs path={ data[index].file_path }/>
        <MonacoEditor
          className="editor-container"
          height={ `${ EDITOR_HEIGHT }px` }
          language="sol"
          path={ data[index].file_path }
          defaultValue={ data[index].source_code }
          options={ EDITOR_OPTIONS }
          onMount={ handleEditorDidMount }
          loading={ <CodeEditorLoading/> }
        />
      </Box>
      <CodeEditorSideBar data={ data } onFileSelect={ handleSelectFile } monaco={ instance } selectedFile={ data[index].file_path }/>
    </Flex>
  );
};

export default React.memo(CodeEditor);