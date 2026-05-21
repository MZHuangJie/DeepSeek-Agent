import React, { useRef, useState } from 'react';
import Editor, { loader, OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editor';

// 配置 Monaco 从本地 public/vs 加载
try {
  loader.config({ paths: { vs: '/vs' } });
} catch (e) {
  console.error('[Monaco] loader.config failed:', e);
}

interface Props {
  content: string;
  language: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
}

export default function CodeEditor({ content, language, onChange, readOnly = false }: Props) {
  const storeRef = useRef(useEditorStore);
  const [monacoError, setMonacoError] = useState<string | null>(null);

  // 检测 Monaco 是否加载成功
  React.useEffect(() => {
    loader.init().then(() => {
      console.log('[Monaco] loaded successfully');
    }).catch((err) => {
      console.error('[Monaco] failed to load:', err);
      const detail = err ? (err.stack || err.message || String(err)) : '未知错误';
      setMonacoError(detail);
    });
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    // Disable semantic errors in editor (Monaco doesn't have node_modules types)
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: false,
    });
    const store = storeRef.current.getState();

    const updateCursor = () => {
      const pos = editor.getPosition();
      if (pos) {
        store.setCursor(pos.lineNumber, pos.column);
      }
    };

    const updateIndent = () => {
      const model = editor.getModel();
      if (model) {
        const opts = model.getOptions();
        store.setIndent(opts.insertSpaces, opts.tabSize);
        store.setEol(model.getEOL() === '\r\n' ? 'CRLF' : 'LF');
      }
    };

    const updateDiagnostics = () => {
      const markers = monaco.editor.getModelMarkers({});
      let errors = 0;
      let warnings = 0;
      for (const m of markers) {
        if (m.severity === monaco.MarkerSeverity.Error) errors++;
        else if (m.severity === monaco.MarkerSeverity.Warning) warnings++;
      }
      store.setDiagnostics(errors, warnings);
    };

    editor.onDidChangeCursorPosition(updateCursor);
    editor.onDidChangeModel(updateIndent);
    editor.onDidChangeModelOptions(updateIndent);
    monaco.editor.onDidChangeMarkers(updateDiagnostics);

    updateCursor();
    updateIndent();
    updateDiagnostics();
  };

  if (monacoError) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '6px 12px', background: 'rgba(239,68,68,0.1)',
          color: '#ef4444', fontSize: 11, borderBottom: '1px solid rgba(239,68,68,0.2)',
        }}>
          ⚠️ Monaco 编辑器加载失败，已回退到文本模式
        </div>
        <textarea
          value={content}
          onChange={e => onChange?.(e.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          style={{
            flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)',
            border: 'none', outline: 'none',
            fontFamily: "'Fira Code', 'Consolas', monospace",
            fontSize: 13, lineHeight: 1.6,
            padding: '8px 12px',
            resize: 'none',
            whiteSpace: 'pre',
            overflow: 'auto',
          }}
        />
      </div>
    );
  }

  return (
    <Editor
      value={content}
      language={language}
      onChange={onChange}
      onMount={handleMount}
      theme="vs-dark"
      loading={
        <div style={{
          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', fontSize: 12,
        }}>
          正在加载编辑器...
        </div>
      }
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        padding: { top: 8 },
        automaticLayout: true,
      }}
      height="100%"
    />
  );
}
