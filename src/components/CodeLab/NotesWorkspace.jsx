import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { FileText, Save, Download, FileUp, Trash2, Plus, X, Share2, Bold, Type, BookOpen, ChevronRight, PenTool } from 'lucide-react';
import api from '../../config/api';
import { useSettings } from '../../hooks/SettingsContext';
import ShareModal from './ShareModal';

export default function NotesWorkspace({ profile, showToast, savedNotes }) {
  const { language } = useSettings();
  
  const [openTabs, setOpenTabs] = useState([]); // Array of open tabs: { id, tempId, title, content }
  const [activeTabId, setActiveTabId] = useState(null); // ID of active tab
  
  // Share Modal State
  const [shareItem, setShareItem] = useState(null);

  const hasInitialized = useRef(false);

  // Initialize at least one tab if empty on mount
  useEffect(() => {
     if (!hasInitialized.current && openTabs.length === 0) {
        hasInitialized.current = true;
        handleNewNote();
     }
  }, []);

  const handleNewNote = () => {
     const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
     const newTab = { id: null, tempId, title: language === 'es' ? 'Nueva Nota' : 'New Note', content: '' };
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

  // PERSISTENCE
  const handleSaveNote = async () => {
      if (!activeTab) return;
      if (!activeTab.content || activeTab.content === '<p><br></p>') {
          showToast(language === 'es' ? 'La nota está vacía' : 'Note is empty', 'warning'); return;
      }
      
      let noteName = activeTab.title || (language === 'es' ? 'Sin Título' : 'Untitled');
      if (noteName === 'Nueva Nota' || noteName === 'New Note') {
          const res = prompt(language === 'es' ? "Ponle un nombre a tu nota:" : "Name your note:", language === 'es' ? "Apuntes de Clase" : "Class Notes");
          if (res) { noteName = res; handleUpdateActiveTab('title', res); }
          else return;
      }

      try {
          const noteData = {
             title: noteName,
             content: activeTab.content,
             updated_at: new Date().toISOString()
          };

          if (activeTab.id) {
             await api.put(`/data/saved_notes/${activeTab.id}`, noteData);
             showToast(language === 'es' ? "Nota actualizada" : "Note updated");
          } else {
             const { data } = await api.post('/data/saved_notes', {
                ...noteData,
                created_at: new Date().toISOString(),
                author_id: profile.id,
                author_name: profile.name
             });
             
             setOpenTabs(prev => prev.map(t => t.tempId === activeTab.tempId ? { ...t, id: data.id } : t));
             setActiveTabId(data.id);
             showToast(language === 'es' ? "Nota guardada en la nube" : "Note saved to cloud");
          }
      } catch(e) {
          console.error(e);
          showToast(language === 'es' ? "Error al guardar" : "Error saving", "error");
      }
  };

  const handleLoadNote = (note) => {
      const existingTab = openTabs.find(t => t.id === note.id);
      if (existingTab) {
          setActiveTabId(existingTab.id);
      } else {
          setOpenTabs(prev => [...prev, { id: note.id, tempId: null, title: note.title, content: note.content }]);
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
      if (!window.confirm(language === 'es' ? "¿Eliminar definitivamente de la nube?" : "Delete permanently from cloud?")) return;
      try {
          await api.delete(`/data/saved_notes/${id}`);
          const filtered = openTabs.filter(t => t.id !== id);
          setOpenTabs(filtered);
          if (activeTabId === id) setActiveTabId(filtered.length > 0 ? (filtered[0].id || filtered[0].tempId) : null);
          showToast(language === 'es' ? "Nota eliminada" : "Note deleted");
      } catch (e) { 
        console.error(e);
        showToast("Error al eliminar", "error");
      }
  };

  const handleExportPDF = () => {
      if (!activeTab || !activeTab.content) return;
      showToast(language === 'es' ? "Generando PDF..." : "Generating PDF...", "info");
      
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px'; iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${activeTab.title || 'Nota'}</title>
            <style>
              body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; background: #fff; }
              hr { border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0; }
              h1 { font-size: 32px; font-weight: 800; color: #0f172a; margin-bottom: 5px; }
              p { line-height: 1.8; margin-bottom: 15px; }
              img { max-width: 100%; height: auto; border-radius: 20px; box-shadow: 0 10px 20px -5px rgba(0,0,0,0.1); }
              blockquote { border-left: 6px solid #4f46e5; padding-left: 1.5rem; color: #475569; font-style: italic; margin: 20px 0; }
              pre, code { background: #f8fafc; padding: 4px 8px; border-radius: 8px; font-family: monospace; border: 1px solid #e2e8f0; }
              pre { padding: 20px; overflow-x: auto; margin: 20px 0; }
            </style>
          </head>
          <body>
            <h1>${activeTab.title || 'Nota Documentada'}</h1>
            <p style="color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em;">Aura Intelligent Notes System</p>
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
          } catch(e) {
             console.error(e);
             showToast("Error PDF", "error");
          } finally {
             setTimeout(() => document.body.removeChild(iframe), 2000);
          }
      }, 500);
  };

  const handleExportDOCX = () => {
      if (!activeTab || !activeTab.content) return;
      showToast(language === 'es' ? "Generando Word..." : "Generating Word...", "info");
      const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
      const footer = "</body></html>";
      const sourceHTML = header + `<h1>${activeTab.title}</h1>` + activeTab.content + footer;
      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `${activeTab.title || 'Nota'}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);
      showToast("DOCX Ready");
  };

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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
       {/* BARRA LATERAL (Notebook) */}
       <div className="space-y-8">
          <div className="aura-card p-8 rounded-[3rem] sticky top-24">
             <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-xl flex items-center gap-4 text-slate-900 dark:text-white tracking-tighter uppercase">
                    <BookOpen className="text-blue-600" size={28} /> 
                    {language === 'es' ? 'Bitácora' : 'Logbook'}
                  </h3>
                  <button onClick={handleNewNote} className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white dark:bg-blue-900/30 dark:hover:bg-blue-800 rounded-2xl transition-all shadow-sm active:scale-95 outline-none">
                    <Plus size={20}/>
                  </button>
             </div>

             {savedNotes.length === 0 ? (
                  <div className="text-center p-10 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                     <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">No se han detectado apuntes en el sistema.</p>
                  </div>
             ) : (
                  <div className="space-y-4 max-h-[650px] overflow-y-auto custom-scrollbar pr-3">
                     {savedNotes.map(note => (
                         <div key={note.id} className={`group flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all duration-300 cursor-pointer ${activeTabId === note.id ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-600/10 shadow-xl shadow-blue-500/10 scale-[1.02]' : 'border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/50 bg-white dark:bg-slate-800/50 hover:shadow-lg'}`} onClick={() => handleLoadNote(note)}>
                             <div className="flex-1 truncate">
                                 <p className="font-black text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight truncate pr-4">{note.title}</p>
                                 <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{new Date(note.updated_at).toLocaleDateString()}</p>
                             </div>
                             <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all" onClick={(e) => { e.stopPropagation(); handleDeleteDbNote(note.id); }}><Trash2 size={18} /></button>
                             </div>
                         </div>
                     ))}
                  </div>
             )}
          </div>
       </div>

       {/* ESPACIO PRINCIPAL (Editor) */}
       <div className="lg:col-span-3 space-y-6 min-w-0">
           {openTabs.length > 0 && (
             <div className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-4 selection:bg-transparent">
                 {openTabs.map(tab => {
                     const tId = tab.id || tab.tempId;
                     const isActive = activeTabId === tId;
                     return (
                         <div key={tId} onClick={() => setActiveTabId(tId)} className={`flex items-center gap-4 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all duration-300 border-2 whitespace-nowrap ${isActive ? 'bg-white dark:bg-slate-800 border-blue-600 text-blue-600 shadow-xl scale-105' : 'bg-slate-50 dark:bg-slate-900/50 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}>
                            <Type size={14} className={isActive ? 'text-blue-500' : ''} />
                            <span>{tab.title}</span>
                            <button className={`ml-2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${isActive ? 'opacity-100' : 'opacity-40'}`} onClick={(e) => handleCloseTab(tId, e)}>
                               <X size={14} />
                            </button>
                         </div>
                     )
                 })}
             </div>
           )}

           {activeTab ? (
               <div className="aura-card p-0 rounded-[3rem] shadow-3xl overflow-hidden flex flex-col border-none" style={{ minHeight: '700px' }}>
                  <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-50/50 dark:bg-slate-900/30 gap-6">
                      <div className="flex items-center gap-6 w-full md:w-auto">
                          <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-inner text-blue-600 border border-slate-100 dark:border-slate-700">
                             <PenTool size={24} />
                          </div>
                          <div className="flex-1">
                             <input 
                                type="text" 
                                className="w-full bg-transparent font-black text-2xl text-slate-900 dark:text-white outline-none placeholder-slate-200 dark:placeholder-slate-800 uppercase tracking-tighter" 
                                value={activeTab.title || ''}
                                onChange={(e) => handleUpdateActiveTab('title', e.target.value)}
                                placeholder={language === 'es' ? "Identificador de Nota..." : "Note Identifier..."}
                             />
                             {!activeTab.id && <p className="text-[10px] uppercase font-black tracking-widest text-amber-500 mt-1">Status: Offline / Local Only</p>}
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full md:w-auto">
                           <div className="flex bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800">
                              <button onClick={() => setShareItem(activeTab)} className="p-3 text-slate-400 hover:text-blue-600 transition-all outline-none" data-tooltip={language === 'es' ? "Transmitir (Compartir)" : "Broadcast (Share)"}><Share2 size={22}/></button>
                              <button onClick={handleExportPDF} className="p-3 text-slate-400 hover:text-blue-600 transition-all outline-none" data-tooltip="Generate PDF"><FileText size={22}/></button>
                              <button onClick={handleExportDOCX} className="p-3 text-slate-400 hover:text-blue-600 transition-all outline-none" data-tooltip="Export Word"><Download size={22}/></button>
                           </div>
                           <button onClick={handleSaveNote} className="flex-1 md:flex-none flex items-center justify-center gap-3 aura-gradient-secondary text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all outline-none">
                               <Save size={20} /> {language === 'es' ? 'Archivar' : 'Archive'}
                           </button>
                      </div>
                  </div>

                  <div className="flex-1 aura-quill overflow-hidden">
                     <ReactQuill 
                        theme="snow"
                        value={activeTab.content}
                        onChange={(val) => handleUpdateActiveTab('content', val)}
                        modules={modules}
                        formats={formats}
                        placeholder={language === 'es' ? "Inicie el registro estratégico aquí..." : "Initialize strategic logging here..."}
                     />
                  </div>
               </div>
           ) : (
               <div className="h-[700px] flex flex-col items-center justify-center aura-card shadow-none border-4 border-dashed border-slate-100 dark:border-slate-800 bg-transparent">
                   <div className="p-10 bg-slate-50 dark:bg-slate-900/50 rounded-full shadow-inner mb-8"><FileText size={72} className="text-slate-200 dark:text-slate-800" /></div>
                   <h3 className="text-2xl font-black text-slate-400 uppercase tracking-tighter">Acceso Denegado: No Open Log</h3>
                   <p className="text-xs font-black text-slate-300 uppercase tracking-widest mt-4">Inicialice una nueva nota o abra una del repositorio lateral.</p>
                   <button onClick={handleNewNote} className="mt-10 px-10 py-5 aura-gradient-secondary text-white font-black text-xs uppercase tracking-[0.3em] rounded-[1.5rem] shadow-xl shadow-blue-500/20 active:scale-95 transition-all outline-none">Crear Nueva Nota</button>
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
