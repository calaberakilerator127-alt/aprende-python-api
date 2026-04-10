import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { FileText, Save, Download, FileUp, Trash2, Plus, X, Share2, Bold, Type } from 'lucide-react';
import api from '../../config/api';
import { useSettings } from '../../hooks/SettingsContext';
import ShareModal from './ShareModal';

export default function NotesWorkspace({ profile, showToast, savedNotes }) {
  const { language } = useSettings();
  
  const [openTabs, setOpenTabs] = useState([]); // Arreglo de tabs abiertas: { id, tempId, name, content }
  const [activeTabId, setActiveTabId] = useState(null); // ID del tab que estamos viendo
  
  // Share Modal State
  const [shareItem, setShareItem] = useState(null);

  const editorRef = useRef(null);
  const hasInitialized = useRef(false);

  // Inicializa al menos un tab si está vacío al abrir
  useEffect(() => {
     if (!hasInitialized.current && openTabs.length === 0) {
        hasInitialized.current = true;
        handleNewNote();
     }
  }, []);

  const handleNewNote = () => {
     const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
     const newTab = { id: null, tempId, name: 'Nueva Nota', content: '' };
     setOpenTabs(prev => [...prev, newTab]);
     setActiveTabId(tempId);
  };

  const activeTab = openTabs.find(t => (t.id && t.id === activeTabId) || (t.tempId && t.tempId === activeTabId));

  const handleUpdateActiveTab = (field, value) => {
     setOpenTabs(prev => prev.map(tab => {
        const isTarget = (tab.id && tab.id === activeTabId) || (tab.tempId && tab.tempId === activeTabId);
        if (isTarget) return { ...tab, [field]: value };
        return tab;
     }));
  };

  // PERSISTENCIA
  const handleSaveNote = async () => {
      if (!activeTab) return;
      if (!activeTab.content || activeTab.content === '<p><br></p>') {
          showToast('La nota está vacía', 'warning'); return;
      }
      
      let noteName = activeTab.name || 'Sin Título';
      if (noteName === 'Nueva Nota') {
          const res = prompt("Ponle un nombre a tu nota:", "Apuntes de Clase");
          if (res) { noteName = res; handleUpdateActiveTab('name', res); }
      }

      try {
          const noteData = {
             title: noteName,
             content: activeTab.content,
             updated_at: new Date().toISOString()
          };

          if (activeTab.id) {
             await api.put(`/data/saved_notes/${activeTab.id}`, noteData);
             showToast("Nota actualizada correctamente");
          } else {
             const { data } = await api.post('/data/saved_notes', {
                ...noteData,
                created_at: new Date().toISOString(),
                author_id: profile.id,
                author_name: profile.name
             });
             
             // Actualizar tab list con el ID real
             setOpenTabs(prev => prev.map(t => t.tempId === activeTab.tempId ? { ...t, id: data.id } : t));
             setActiveTabId(data.id);
             showToast("Nota guardada en la nube");
          }
      } catch(e) {
          console.error(e);
          showToast("Error al guardar la nota", "error");
      }
  };

  const handleLoadNote = (note) => {
      // Chequear si ya está abierta
      const existingTab = openTabs.find(t => t.id === note.id);
      if (existingTab) {
          setActiveTabId(existingTab.id);
      } else {
          setOpenTabs(prev => [...prev, { id: note.id, tempId: null, name: note.name, content: note.content }]);
          setActiveTabId(note.id);
      }
  };

  const handleCloseTab = (idToClose, e) => {
      e.stopPropagation();
      const filtered = openTabs.filter(t => (t.id || t.tempId) !== idToClose);
      setOpenTabs(filtered);
      if (activeTabId === idToClose) {
         if (filtered.length > 0) {
            const el = filtered[filtered.length - 1];
            setActiveTabId(el.id || el.tempId);
         } else {
            setActiveTabId(null);
         }
      }
  };

  const handleDeleteDbNote = async (id) => {
      if (!window.confirm("¿Estás seguro de eliminar esta nota de la nube defintivamente?")) return;
      try {
          await api.delete(`/data/saved_notes/${id}`);
          
          // Quitar de los tabs si está abierta
          const filtered = openTabs.filter(t => t.id !== id);
          setOpenTabs(filtered);
          if (activeTabId === id) setActiveTabId(filtered.length > 0 ? (filtered[0].id || filtered[0].tempId) : null);
          showToast("Nota eliminada con éxito", "success");
      } catch (e) { 
        console.error(e);
        showToast("Error al eliminar", "error");
      }
  };

  // EXPORTS
  const handleExportPDF = () => {
      if (!activeTab || !activeTab.content) return;
      showToast("Preparando documento para PDF...", "info");
      
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${activeTab.name || 'Nota'}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; color: #000; background: #fff; }
              hr { border: 0; border-top: 1px solid #eaeaea; margin: 20px 0; }
              h2 { font-size: 24px; margin-bottom: 10px; }
              p { line-height: 1.6; margin-bottom: 10px; }
              img { max-width: 100%; height: auto; border-radius: 8px; }
              blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; color: #4b5563; font-style: italic; }
              pre, code { background: #f3f4f6; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
              pre code { padding: 0; }
              pre { padding: 10px; overflow-x: auto; }
              @media print {
                  body { padding: 0; }
                  @page { margin: 2cm; }
              }
            </style>
          </head>
          <body>
            <h2>${activeTab.name || 'Nota Documentada'}</h2>
            <hr />
            ${activeTab.content}
          </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
          try {
             iframe.contentWindow.focus();
             iframe.contentWindow.print();
             showToast("Diálogo de generación completado", "success");
          } catch(e) {
             console.error("Error nativo al imprimir:", e);
             showToast("Error al invocar generación de PDF", "error");
          } finally {
             setTimeout(() => document.body.removeChild(iframe), 2000);
          }
      }, 500);
  };

  const handleExportDOCX = () => {
      if (!activeTab || !activeTab.content) return;
      showToast("Generando Documento de Word...", "info");
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML to Word</title></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + `<h1>${activeTab.name}</h1>` + activeTab.content + footer;
      
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `${activeTab.name || 'Nota'}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
      showToast("DOC descargado", "success");
  };

  // QUILL MODULES SETUP
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }]
    ],
  };
  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list', 'indent', 'link', 'image', 'color', 'background', 'align'
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
       {/* BARRA LATERAL (Mis Notas) */}
       <div className="space-y-6">
          <div className="glass-card p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm sticky top-24">
             <div className="flex items-center justify-between mb-6">
                 <h3 className="font-black text-lg flex items-center gap-3 text-gray-900 dark:text-white"><FileText className="text-blue-600" size={24} /> Bloc de Notas</h3>
                 <button onClick={handleNewNote} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 rounded-xl transition shadow-sm"><Plus size={18}/></button>
             </div>

             {savedNotes.length === 0 ? (
                 <div className="text-center p-6 bg-gray-50 dark:bg-slate-900 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700">
                    <p className="text-sm text-gray-400 font-medium">Crea tu primer apunte y regístralo aquí.</p>
                 </div>
             ) : (
                 <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    {savedNotes.map(note => (
                        <div key={note.id} className="group flex items-center justify-between p-3 rounded-2xl border border-gray-100 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50 bg-white dark:bg-slate-800/50 cursor-pointer transition-all" onClick={() => handleLoadNote(note)}>
                            <div className="flex-1 truncate">
                                <p className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate pr-2">{note.title}</p>
                                <p className="text-[10px] text-gray-400 mt-1 uppercase">{new Date(note.updated_at).toLocaleDateString()}</p>
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:hover:bg-red-500/20" onClick={(e) => { e.stopPropagation(); handleDeleteDbNote(note.id); }}><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))}
                 </div>
             )}
          </div>
       </div>

       {/* ESPACIO PRINCIPAL (Editor) */}
       <div className="lg:col-span-3 space-y-4">
           {openTabs.length > 0 && (
             <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-2">
                 {openTabs.map(tab => {
                     const tId = tab.id || tab.tempId;
                     const isActive = activeTabId === tId;
                     return (
                         <div key={tId} onClick={() => setActiveTabId(tId)} className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all border whitespace-nowrap min-w-max ${isActive ? 'bg-white dark:bg-slate-800 border-blue-500 text-blue-700 dark:text-blue-400 shadow-md transform scale-[1.02]' : 'bg-gray-50/80 dark:bg-slate-900/50 border-gray-200 dark:border-slate-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800'}`}>
                            <Type size={14} className={isActive ? 'text-blue-500' : ''} />
                            <span>{tab.title}</span>
                            <button className={`ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 ${isActive ? 'opacity-100' : 'opacity-60'}`} onClick={(e) => handleCloseTab(tId, e)}>
                               <X size={12} />
                            </button>
                         </div>
                     )
                 })}
             </div>
           )}

           {activeTab ? (
               <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-700/50 shadow-xl overflow-hidden flex flex-col" style={{ minHeight: '600px' }}>
                  <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/20">
                      <div className="flex flex-col">
                          <input 
                             type="text" 
                             className="bg-transparent font-black text-xl text-gray-800 dark:text-white outline-none placeholder-gray-300 dark:placeholder-slate-700" 
                             value={activeTab.title || activeTab.name || ''}
                             onChange={(e) => handleUpdateActiveTab('title', e.target.value)}
                             placeholder="Título de la Nota..."
                          />
                          {!activeTab.id && <span className="text-[10px] uppercase font-bold text-orange-500 mt-1">Sin guardar en nube</span>}
                      </div>
                      
                      <div className="flex items-center gap-2">
                           <button onClick={() => setShareItem(activeTab)} className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl" data-tooltip="Compartir (Copiar / Foro)"><Share2 size={20}/></button>
                           <button onClick={handleExportPDF} className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl" data-tooltip="Exportar a PDF"><FileText size={20}/></button>
                           <button onClick={handleExportDOCX} className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl" data-tooltip="Exportar a Word"><Download size={20}/></button>
                           <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 mx-2"></div>
                           <button onClick={handleSaveNote} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-blue-500/20">
                               <Save size={18} /> {language === 'es' ? 'Guardar Cambios' : 'Save'}
                           </button>
                      </div>
                  </div>

                  <div className="flex-1 overflow-hidden" id="rich-text-editor-container">
                     <style>{`
                        #rich-text-editor-container .quill { display: flex; flex-direction: column; height: 100%; border:none; }
                        #rich-text-editor-container .ql-toolbar { border:none; border-bottom: 1px solid #f3f4f6; background: #fff; padding: 12px; }
                        #rich-text-editor-container .ql-container { display:flex; flex-direction: column; height: 500px; flex: 1; border: none; font-family: 'Inter', sans-serif; font-size: 16px; background: transparent; }
                        #rich-text-editor-container .ql-editor { padding: 30px 40px; }
                        .dark #rich-text-editor-container .ql-toolbar { background: #0f172a; border-bottom-color: #334155; }
                        .dark #rich-text-editor-container .ql-container { color: #f8fafc; }
                        .dark #rich-text-editor-container .ql-stroke { stroke: #cbd5e1; }
                        .dark #rich-text-editor-container .ql-fill { fill: #cbd5e1; }
                        .dark #rich-text-editor-container .ql-picker { color: #cbd5e1; }
                     `}</style>
                     <ReactQuill 
                        theme="snow"
                        value={activeTab.content}
                        onChange={(val) => handleUpdateActiveTab('content', val)}
                        modules={modules}
                        formats={formats}
                        placeholder={language === 'es' ? "Comienza a redactar tu nota aquí..." : "Start drafting your note here..."}
                     />
                  </div>
               </div>
           ) : (
               <div className="h-[600px] flex flex-col items-center justify-center bg-gray-50/50 dark:bg-slate-900/30 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                   <div className="p-6 bg-white dark:bg-slate-800 rounded-full shadow-lg mb-6"><FileText size={48} className="text-gray-300" /></div>
                   <h3 className="text-xl font-bold text-gray-500">Ninguna nota abierta</h3>
                   <p className="text-gray-400 mt-2">Abre una de la barra lateral o crea una nueva.</p>
                   <button onClick={handleNewNote} className="mt-6 px-6 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold rounded-xl transition">Crear Nota</button>
               </div>
           )}
       </div>

       {/* Share Modal */}
       <ShareModal 
          isOpen={!!shareItem} 
          onClose={() => setShareItem(null)} 
          item={shareItem} 
          type="note" 
          profile={profile} 
          showToast={showToast} 
       />
    </div>
  );
}
