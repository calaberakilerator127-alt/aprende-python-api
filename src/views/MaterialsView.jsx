import React, { useState, useEffect } from 'react';
import { 
  Plus, X, Search, Filter, BookOpen, Download, ExternalLink, 
  Clock, Calendar, User, FileText, Video, Link as LinkIcon, 
  Trash2, Edit2, Play, Eye, MessageSquare, Info, Shield, 
  Settings, Award, CheckCircle, ChevronRight, DownloadCloud, 
  Grid, List as ListIcon, Type, FileUp, Save, Loader2, ArrowLeft, File as FileIcon, PenTool, Folder, Layers
} from 'lucide-react';
import api from '../config/api';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useSound } from '../hooks/useSound';
import { uploadFileWithProgress } from '../utils/fileUpload';
import { useSettings } from '../hooks/SettingsContext';
import { useContentRead } from '../hooks/useContentRead';

function MaterialViewerWrapper({ material, profile, onClose, language }) {
  // Track read status automatically when opened
  useContentRead(profile.id, material.id, 'material');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-10 animate-fade-in">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="aura-card w-full max-w-6xl h-full flex flex-col overflow-hidden relative border-none shadow-3xl animate-scale-in">
        <div className="aura-gradient-primary px-8 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 text-white shrink-0">
          <div className="flex items-center gap-6">
             <div className="p-4 bg-white/20 rounded-[1.5rem] shadow-xl">
               {material.content_type === 'file' ? <FileIcon size={32} /> : <Type size={32} />}
             </div>
             <div>
               <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none">{material.title}</h2>
               <p className="text-[10px] opacity-70 font-black uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
                 <Shield size={12}/> {language === 'es' ? 'Acceso Seguro a Bóveda' : 'Secure Vault Access'}
               </p>
             </div>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            {material.attached_file && (
              <a href={material.attached_file.data} download className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-white/20 hover:bg-white/40 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest">
                <Download size={20} /> {language === 'es' ? 'Descargar' : 'Download'}
              </a>
            )}
            <button onClick={onClose} className="p-4 bg-white/20 hover:bg-rose-500 rounded-2xl transition-all shadow-lg"><X size={24}/></button>
          </div>
        </div>
        
        <div className="flex-1 bg-slate-100 dark:bg-slate-900 p-4 md:p-10 flex flex-col items-center justify-center overflow-hidden custom-scrollbar">
          <div className="w-full max-w-5xl h-full overflow-y-auto">
            {material.content_type === 'html' ? (
              <div dangerouslySetInnerHTML={{ __html: material.content }} className="aura-card p-10 md:p-16 rich-content prose dark:prose-invert max-w-none text-xl leading-relaxed text-slate-700 dark:text-slate-300 shadow-none border-none" />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-full py-12">
                {material.attached_file?.type?.includes('pdf') ? (
                  <div className="w-full h-full min-h-[700px] aura-card p-0 overflow-hidden shadow-2xl border-none">
                     <iframe src={material.attached_file.data} className="w-full h-full border-none" title="PDF Preview" />
                  </div>
                ) : (
                  <div className="aura-card p-16 text-center max-w-2xl bg-white dark:bg-slate-900/50">
                    <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                      <FileIcon size={48} />
                    </div>
                    <p className="text-2xl font-black mb-4 text-slate-900 dark:text-white uppercase tracking-tight">{language === 'es' ? 'Objeto Binario Detectado' : 'Binary Object Detected'}</p>
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-10">{material.attached_file?.name}</p>
                    
                    <a href={material.attached_file?.data} download className="inline-flex items-center gap-4 px-10 py-5 aura-gradient-primary text-white rounded-2xl shadow-xl font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 transition-all">
                      <Download size={20} /> {language === 'es' ? 'Sincronizar Localmente' : 'Sync Locally'}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MaterialsView({ profile, materials, showToast, createNotification }) {
  const { language } = useSettings();
  const isTeacher = profile.role === 'profesor';
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const { playSound } = useSound();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState('html'); 
  const [richContent, setRichContent] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setAttachedFile(file);
  };

  const uploadFile = (file) => {
    const uploadPromise = uploadFileWithProgress(file, 'materials', (p) => setUploadProgress(p));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT: La subida tardó demasiado. Verifica tu conexión e intenta de nuevo.')), 30000)
    );
    return Promise.race([uploadPromise, timeoutPromise]);
  };

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalFile = editingMaterial?.attached_file || null;
      if (contentType === 'file' && attachedFile && attachedFile.size) {
        finalFile = await uploadFile(attachedFile);
      }

      const materialData = {
        title, 
        description, 
        content_type: contentType, 
        content: contentType === 'html' ? richContent : '',
        attached_file: finalFile,
        author_id: profile.id,
        updated_at: Date.now()
      };

      if (editingMaterial) {
        await api.put(`/data/materials/${editingMaterial.id}`, materialData);
        playSound('success');
        showToast(language === 'es' ? 'Material actualizado' : 'Material updated');
      } else {
        const { data: res } = await api.post('/data/materials', materialData);
        playSound('success');
        showToast(language === 'es' ? 'Material publicado' : 'Material published');
        createNotification(language === 'es' ? `Nuevo material: ${title}` : `New material: ${title}`, null, 'materials', res.id);
      }

      setShowForm(false);
      setEditingMaterial(null);
      resetForm();
    } catch(e) { 
      console.error(e);
      showToast(language === 'es' ? 'Error al guardar' : 'Error saving', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [contentReadData, setContentReadData] = useState([]);

  const fetchReadStats = async () => {
    if (!isTeacher) return;
    try {
      const { data } = await api.get('/data/content_reads');
      setContentReadData(data?.filter(r => r.content_type === 'material') || []);
    } catch (e) {
      console.error("Error fetching read stats:", e);
    }
  };

  React.useEffect(() => {
    fetchReadStats();
  }, [materials, isTeacher]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setContentType('html'); 
    setRichContent(''); setAttachedFile(null); setUploadProgress(0);
  };

  const startEditing = (mat) => {
    setEditingMaterial(mat);
    setTitle(mat.title);
    setDescription(mat.description);
    setContentType(mat.content_type || 'html');
    setRichContent(mat.content || '');
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if(window.confirm(language === 'es' ? '¿Eliminar este material?' : 'Delete this material?')) {
      try {
        await api.delete(`/data/materials/${id}`);
        showToast(language === 'es' ? 'Material eliminado' : 'Material deleted');
      } catch (err) {
        console.error("Error deleting material:", err);
        showToast(language === 'es' ? 'Error al eliminar' : 'Error deleting', 'error');
      }
    }
  };

  const filteredMaterials = materials.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* HEADER SECTION */}
      <div className="aura-card p-0 overflow-hidden shadow-2xl">
        <div className="aura-gradient-primary px-10 py-12 text-white flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="space-y-4 text-center md:text-left">
            <h1 className="text-5xl font-black uppercase tracking-tighter flex items-center justify-center md:justify-start gap-4">
              <Folder className="text-white" size={56} /> 
              {language === 'es' ? 'Biblioteca Central' : 'Central Library'}
            </h1>
            <p className="text-white/60 font-black text-xs uppercase tracking-[0.3em]">{language === 'es' ? 'Repositorio de Datos e Inteligencia' : 'Data & Intelligence Repository'}</p>
          </div>
          
          {isTeacher && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="group flex items-center justify-center gap-6 px-10 py-6 bg-white text-indigo-600 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-3xl hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={24} className="group-hover:rotate-90 transition-transform"/> 
              {language === 'es' ? 'Inyectar Recurso' : 'Inject Resource'}
            </button>
          )}
        </div>
      </div>

      {!showForm && (
        <div className="aura-card p-4 rounded-[2.5rem] flex flex-col lg:flex-row gap-6 items-center shadow-xl border-none">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={24} />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={language === 'es' ? "Escanear por título o palabra clave..." : "Scan by title or keyword..."}
              className="w-full pl-16 pr-8 py-5 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 rounded-[1.8rem] outline-none transition-all shadow-inner font-black placeholder:text-slate-300"
            />
          </div>
          <div className="px-8 py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-4">
            <Grid size={16} /> {filteredMaterials.length} {language === 'es' ? 'Recursos Identiﬁcados' : 'Resources Identified'}
          </div>
        </div>
      )}

      {showForm && isTeacher && (
        <div className="aura-card p-0 border-none shadow-2xl animate-scale-in relative overflow-hidden">
          <div className="aura-gradient-primary px-8 py-6 flex justify-between items-center text-white">
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-4">
              <Plus size={24} />
              {editingMaterial ? (language === 'es' ? 'Modificar Recurso' : 'Modify Resource') : (language === 'es' ? 'Nuevo Recurso de Bóveda' : 'New Vault Resource')}
            </h2>
            <button onClick={() => { setShowForm(false); setEditingMaterial(null); }} className="p-3 bg-white/20 hover:bg-white/40 rounded-2xl transition-all shadow-lg"><X size={24}/></button>
          </div>
          
          <form onSubmit={handleSaveMaterial} className="p-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="md:col-span-2 space-y-8">
                <div>
                  <label htmlFor="materialTitle" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{language === 'es' ? 'Identificador de Recurso' : 'Resource Identifier'}</label>
                  <input id="materialTitle" name="materialTitle" required value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all shadow-inner font-black text-xl placeholder:text-slate-300" placeholder={language === 'es' ? "Ej. Matriz de Algoritmos" : "e.g. Algorithm Matrix"} />
                </div>
                <div>
                  <label htmlFor="materialDescription" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{language === 'es' ? 'Resumen Ejecutivo' : 'Executive Summary'}</label>
                  <input id="materialDescription" name="materialDescription" required value={description} onChange={e=>setDescription(e.target.value)} className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all shadow-inner font-black placeholder:text-slate-300" placeholder={language === 'es' ? "Describe brevemente la utilidad de este objeto" : "Briefly describe the utility of this object"} />
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">{language === 'es' ? 'Modo de Distribución' : 'Distribution Mode'}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <button type="button" onClick={() => setContentType('html')} className={`flex items-center justify-center gap-4 py-8 rounded-[2rem] border-2 transition-all font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 ${contentType === 'html' ? 'aura-gradient-primary text-white border-transparent' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:border-indigo-100'}`}>
                    <Type size={32} /> {language === 'es' ? 'Codificación Online' : 'Online Encoding'}
                  </button>
                  <button type="button" onClick={() => setContentType('file')} className={`flex items-center justify-center gap-4 py-8 rounded-[2rem] border-2 transition-all font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 ${contentType === 'file' ? 'aura-gradient-primary text-white border-transparent' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 hover:border-indigo-100'}`}>
                    <FileUp size={32} /> {language === 'es' ? 'Carga Binaria' : 'Binary Upload'}
                  </button>
                </div>
              </div>

              {contentType === 'html' ? (
                <div className="md:col-span-2 space-y-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{language === 'es' ? 'Cuerpo de Conocimiento' : 'Knowledge Body'}</label>
                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-transparent focus-within:border-indigo-500 overflow-hidden shadow-inner transition-all">
                    <ReactQuill 
                      theme="snow" 
                      value={richContent} 
                      onChange={setRichContent} 
                      className="min-h-[300px] aura-quill"
                      placeholder={language === 'es' ? "Codifica aquí el contenido completo..." : "Encode the full content here..."}
                    />
                  </div>
                </div>
              ) : (
                <div className="md:col-span-2 border-4 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 p-16 rounded-[3rem] text-center hover:bg-white dark:hover:bg-slate-800 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 aura-gradient-primary opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none"></div>
                  <FileUp className="mx-auto mb-6 text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-500" size={64} />
                  <p className="text-2xl font-black mb-4 text-slate-900 dark:text-white uppercase tracking-tight">{language === 'es' ? 'Subir Objeto a la Nube' : 'Upload Object to Cloud'}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10">{language === 'es' ? 'Formatos soportados (< 50MB)' : 'Supported formats (< 50MB)'}</p>
                  <div className="relative inline-block w-full max-sm mx-auto">
                     <input type="file" onChange={handleFileSelect} className="block w-full text-[10px] font-black uppercase tracking-widest text-slate-400 file:mr-6 file:py-4 file:px-8 file:rounded-2xl file:border-0 file:text-[10px] file:font-black file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer shadow-xl relative z-20" />
                  </div>
                  {uploadProgress > 0 && (
                    <div className="mt-10 w-full max-w-lg mx-auto bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner relative z-20">
                      <div className="aura-gradient-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-6 pt-10 border-t-2 border-slate-50 dark:border-slate-800">
              <button type="button" onClick={() => { setShowForm(false); setEditingMaterial(null); }} className="px-10 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all w-full sm:w-auto">
                 {language === 'es' ? 'Abortar' : 'Abort'}
              </button>
              <button type="submit" disabled={isSubmitting} className="aura-gradient-primary text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all w-full sm:w-auto flex items-center justify-center gap-4">
                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                {editingMaterial ? (language === 'es' ? 'Sincronizar' : 'Sync') : (language === 'es' ? 'Materializar Ahora' : 'Materialize Now')}
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedMaterial ? (
        <MaterialViewerWrapper 
          material={selectedMaterial} 
          profile={profile} 
          onClose={() => setSelectedMaterial(null)} 
          language={language}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredMaterials.length === 0 ? (
            <div className="col-span-full py-40 text-center aura-card shadow-none border-2 border-dashed border-slate-200 dark:border-slate-800">
               <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                 <Layers size={40} className="text-slate-300 dark:text-slate-700" />
               </div>
               <p className="text-xl font-black text-slate-400 uppercase tracking-widest">{language === 'es' ? 'Bóveda Desértica' : 'Deserted Vault'}</p>
            </div>
          ) : (
            filteredMaterials.map(mat => (
              <div key={mat.id} className="group aura-card p-0 overflow-hidden flex flex-col hover:shadow-2xl hover:-translate-y-3 transition-all duration-500 border-none shadow-xl bg-white dark:bg-slate-800 relative">
                <div className="absolute top-0 right-0 w-40 h-40 aura-gradient-primary opacity-0 group-hover:opacity-10 rounded-full -mr-20 -mt-20 transition-all duration-700 ease-out z-0"></div>
                
                <div className="p-8 pb-4 relative z-10">
                   <div className="w-16 h-16 aura-gradient-primary text-white rounded-2xl flex items-center justify-center mb-10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-12 shadow-2xl shadow-indigo-500/30">
                     {mat.content_type === 'file' ? <FileIcon size={32} /> : <Type size={32} />}
                   </div>
                   <h3 className="font-black text-xl mb-4 text-slate-900 dark:text-white line-clamp-2 uppercase leading-tight tracking-tight">{mat.title}</h3>
                   <p className="text-slate-400 dark:text-slate-500 text-xs mb-10 line-clamp-3 font-black uppercase tracking-widest leading-relaxed">{mat.description}</p>
                </div>
                
                <div className="mt-auto px-8 pb-8 pt-4 flex items-center justify-between relative z-10">
                  <button onClick={() => setSelectedMaterial(mat)} className="flex items-center gap-3 px-6 py-3 aura-gradient-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-90 transition-all">
                    <Eye size={18} /> {language === 'es' ? 'Descifrar' : 'Decrypt'}
                  </button>
                  <div className="flex gap-2">
                    {isTeacher && (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 text-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-100 dark:border-slate-800" title={language === 'es' ? 'Impacto de Lectura' : 'Reading Impact'}>
                           <Eye size={12} className="text-indigo-500" /> {contentReadData.filter(r => r.content_id === mat.id).length}
                        </div>
                        <button onClick={() => startEditing(mat)} className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-indigo-100 transition-all"><PenTool size={18} /></button>
                        <button onClick={() => handleDelete(mat.id)} className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl shadow-sm border border-transparent hover:border-rose-100 transition-all"><Trash2 size={18}/></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
