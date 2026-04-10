import React from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link', 'image', 'video'],
    ['clean']
  ],
};

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list',
  'align',
  'link', 'image', 'video'
];

export default function DocumentEditor({ value, onChange, readOnly = false, placeholder = '' }) {
  return (
    <div className="document-editor bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700">
      <style>{`
        .document-editor .ql-toolbar {
          border-top: none;
          border-left: none;
          border-right: none;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .dark .document-editor .ql-toolbar {
          background: rgba(30, 41, 59, 0.8);
          border-bottom-color: #334155;
        }
        .document-editor .ql-container {
          border: none;
          min-height: 400px;
          font-family: 'Inter', sans-serif;
          font-size: 16px;
        }
        .dark .document-editor .ql-editor {
          color: #f8fafc !important;
          background: rgba(15, 23, 42, 0.4);
        }
        .document-editor .ql-editor.ql-blank::before {
          color: #94a3b8;
          font-style: italic;
        }
        .dark .document-editor .ql-stroke {
          stroke: #cbd5e1;
        }
        .dark .document-editor .ql-fill {
          fill: #cbd5e1;
        }
        .dark .document-editor .ql-picker {
          color: #cbd5e1;
        }
      `}</style>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
      />
    </div>
  );
}
