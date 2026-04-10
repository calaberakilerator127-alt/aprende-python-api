import React, { useState } from 'react';
import { Upload, X, File, CheckCircle, Loader2, Download, AlertCircle } from 'lucide-react';
import { supabase } from '../config/supabase';
import { uploadFileWithProgress } from '../utils/fileUpload';

export default function FileUploader({ files = [], onUploadComplete, onRemoveFile, onStatusChange, language = 'es' }) {
  const [activeUploads, setActiveUploads] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const updateUploadingStatus = (count) => {
    setActiveUploads(count);
    if (onStatusChange) onStatusChange(count > 0);
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setError(null);
    const totalToUpload = selectedFiles.length;
    updateUploadingStatus(totalToUpload);
    
    // Seguimiento individual para progreso consolidado
    const fileProgress = {};
    
    const calculateTotalProgress = () => {
      const values = Object.values(fileProgress);
      if (values.length === 0) return 0;
      return values.reduce((a, b) => a + b, 0) / totalToUpload;
    };

    // Subir todos los archivos en paralelo real
    try {
      await Promise.all(selectedFiles.map(async (file, idx) => {
        try {
          fileProgress[idx] = 0;
          const result = await uploadFileWithProgress(file, 'submissions', (p) => {
            fileProgress[idx] = p;
            setProgress(calculateTotalProgress());
          });

          if (result) {
            onUploadComplete({
              name: result.name,
              url: result.data,
              size: result.size,
              type: result.type,
              path: result.path
            });
          }
        } catch (err) {
          console.error(`Error uploading ${file.name}:`, err);
          throw err;
        } finally {
          setActiveUploads(prev => Math.max(0, prev - 1));
        }
      }));
    } catch (err) {
      setError(language === 'es' ? 'Error al subir archivos a Supabase' : 'Error uploading files to Supabase');
    } finally {
      updateUploadingStatus(0);
      setProgress(0);
    }
  };

  const removeFile = async (file) => {
    if (file.path) {
      try {
        // En Supabase la eliminación es por path dentro de un bucket
        const { error } = await supabase.storage
          .from('submissions')
          .remove([file.path]);
          
        if (error) throw error;
      } catch (e) {
        console.error("Error deleting file from Supabase storage:", e);
      }
    }
    onRemoveFile(file.url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {files.map((file, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-700 rounded-xl group relative pr-10 shadow-sm animate-fade-in hover:border-indigo-200 dark:hover:border-slate-600 transition-all">
            <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg flex items-center justify-center">
              <File size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate max-w-[150px]">{file.name}</p>
              <p className="text-[10px] text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <a href={file.url} target="_blank" rel="noreferrer" className="p-1.5 text-gray-400 hover:text-indigo-600 transition" title={language === 'es' ? 'Descargar' : 'Download'}><Download size={14}/></a>
              <button 
                onClick={() => removeFile(file)} 
                className="p-1.5 text-gray-400 hover:text-red-500 transition"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}

        {activeUploads === 0 && (
          <label className="flex flex-col items-center justify-center w-32 h-20 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all group">
            <Upload className="text-gray-400 group-hover:text-indigo-500 mb-1" size={20} />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{language === 'es' ? 'Adjuntar' : 'Attach'}</span>
            <input type="file" className="hidden" onChange={handleFileChange} multiple />
          </label>
        )}

        {activeUploads > 0 && (
          <div className="flex flex-col items-center justify-center w-32 h-20 bg-indigo-50 dark:bg-slate-900/50 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/30 animate-pulse relative">
            <Loader2 className="animate-spin text-indigo-500 mb-1" size={20} />
            <span className="text-[10px] font-black text-indigo-500">{Math.round(progress)}%</span>
            <div className="w-20 h-1 bg-gray-200 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
               <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">{activeUploads}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl border border-red-100 dark:border-red-900/50 animate-shake">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto underline">{language === 'es' ? 'Cerrar' : 'Close'}</button>
        </div>
      )}
    </div>
  );
}
