import React from 'react';
import { DiffEditor, loader } from '@monaco-editor/react';

loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });

interface Props {
  original: string;
  modified: string;
  language: string;
}

export default function DiffView({ original, modified, language }: Props) {
  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      theme="vs-dark"
      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
      height="100%"
    />
  );
}
