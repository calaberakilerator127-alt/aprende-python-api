import React, { useState } from 'react';
import { Plus, Trash2, File as FileIcon, Eye, Download, Book, PenTool, Type, FileUp, X, Save, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../config/supabase';
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
    <div className="glass-card rounded-[3rem] shadow-2xl border border-indigo-100 dark:border-slate-700/50 animate-scale-in overflow-hidden max-w-5xl mx-auto flex flex-col min-h-[70vh]">
      <div className="p-8 md:p-10 border-b dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full -mr-32 -mt-32 pointer-events-none"></div>
        <div className="relative z-10">
          <button onClick={onClose} className="flex items-center gap-2 text-sm font-black text-indigo-600 dark:text-indigo-400 mb-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 px-3 py-1.5 rounded-xl transition-all w-fit shadow-sm uppercase tracking-widest focus-visible:ring-inset"><ArrowLeft size={16}/> {language === 'es' ? 'Volver a Materiales' : 'Back to Materials'}</button>
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight tracking-tight">{material.title}</h2>
          <p className="text-gray-500 font-medium mt-3 text-lg flex items-center gap-2"><Book size={18}/> {material.description}</p>
        </div>
        {material.attached_file && (
          <a href={material.attached_file.data} download className="flex items-center justify-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl text-base font-black shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all hover-spring w-full sm:w-auto relative z-10 focus-visible:ring-inset uppercase tracking-widest">
            <Download size={22} /> {language === 'es' ? 'Descargar' : 'Download'}
          </a>
        )}
      </div>
      
      <div className="p-8 md:p-12 flex-1 flex flex-col custom-scrollbar overflow-y-auto">
         {material.content_type === 'html' ? (
           <div dangerouslySetInnerHTML={{ __html: material.content }} className="rich-content prose dark:prose-invert max-w-none text-lg leading-relaxed text-gray-700 dark:text-gray-300" />
         ) : (
           <div className="flex flex-col items-center justify-center flex-1 py-12 px-4">
             <div className="w-32 h-32 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-inner transform rotate-3">
                <FileIcon size={64} />
             </div>
             <p className="text-2xl font-black mb-2 text-gray-900 dark:text-gray-100">{language === 'es' ? 'Documento Adjunto' : 'Attached Document'}</p>
             <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-10 bg-gray-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">{material.attached_file?.name}</p>
             
             {material.attached_file?.type?.includes('pdf') && (
                <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2rem] p-4 shadow-xl border border-gray-200 dark:border-slate-700">
                   <div className="w-full h-8 bg-gray-100 dark:bg-slate-800 rounded-t-xl mb-4 flex items-center px-4 gap-2 border-b dark:border-slate-700">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                   </div>
                   <iframe src={material.attached_file.data} className="w-full h-[600px] rounded-xl bg-white dark:bg-gray-100" title="PDF Preview" />
                </div>
             )}
             {material.attached_file?.type?.includes('presentation') && (
                <div className="p-10 bg-amber-50 dark:bg-amber-900/10 rounded-[2.5rem] flex flex-col items-center text-center border-2 border-amber-100 dark:border-amber-900/30 max-w-2xl w-full mx-auto shadow-sm">
                   <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mb-2">{language === 'es' ? 'Presentación de PowerPoint detectada' : 'PowerPoint presentation detected'}</p>
                   <p className="text-base text-amber-600/70 dark:text-amber-400/70 mb-8 font-medium max-w-md">{language === 'es' ? 'Para visualizar transparencias y animaciones de forma nativa se recomienda descargar el archivo centralizado.' : 'To properly view slides and animations natively, it is recommended to download the file.'}</p>
                   <a href={material.attached_file?.data} download className="px-8 py-4 bg-amber-500 text-white rounded-2xl shadow-lg hover:bg-amber-600 transition-all font-black text-lg focus-visible:ring-inset hover-spring uppercase tracking-widest">{language === 'es' ? 'Descargar para ver Offline' : 'Download to view Offline'}</a>
                </div>
             )}
           </div>
         )}
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
  const [contentType, setContentType] = useState('html'); // 'html' o 'file'
  const [richContent, setRichContent] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setAttachedFile(file);
  };

  const uploadFile = (file) => {
    // Timeout de 30 segundos: si el bucket no existe o la red cuelga,
    // el spinner se libera automáticamente con un mensaje claro.
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
        const { error } = await supabase
          .from('materials')
          .update(materialData)
          .eq('id', editingMaterial.id);
        if (error) throw error;
        playSound('success');
        showToast(language === 'es' ? 'Material actualizado' : 'Material updated');
      } else {
        const { data: res, error } = await supabase
          .from('materials')
          .insert({ ...materialData, created_at: Date.now() })
          .select()
          .single();
        if (error) throw error;
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

  // Load read stats for teacher
  const fetchReadStats = async () => {
    if (!isTeacher) return;
    const { data } = await supabase.from('content_reads').select('*').eq('content_type', 'material');
    setContentReadData(data || []);
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
        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (error) throw error;
        showToast(language === 'es' ? 'Material eliminado' : 'Material deleted');
      } catch (err) {
        console.error("Error deleting material:", err);
        showToast(language === 'es' ? 'Error al eliminar' : 'Error deleting', 'error');
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="glass-card p-6 md:p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{language === 'es' ? 'Materiales de Estudio' : 'Study Materials'}</h1>
          <p className="text-gray-500 font-medium text-sm md:text-base mt-2">{language === 'es' ? 'Recursos complementarios para el aprendizaje.' : 'Complementary resources for learning.'}</p>
        </div>
        {isTeacher && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center justify-center w-full md:w-auto gap-3 bg-indigo-600 text-white px-6 py-4 rounded-2xl hover:bg-indigo-700 transition-all hover-spring shadow-lg shadow-indigo-500/30 font-bold focus-visible:ring-inset">
            <Plus size={22} /> {language === 'es' ? 'Subir Material' : 'Upload Material'}
          </button>
        )}
      </div>

      {showForm && isTeacher && (
        <div className="glass-card p-6 md:p-10 rounded-[2.5rem] shadow-xl border border-indigo-100 dark:border-slate-700/50 animate-scale-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          <button onClick={() => { setShowForm(false); setEditingMaterial(null); }} className="absolute top-6 right-6 p-3 bg-white dark:bg-slate-800 rounded-2xl text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm focus-visible:ring-inset"><X size={24}/></button>
          
          <form onSubmit={handleSaveMaterial} className="space-y-8 mt-4">
            <div>
               <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                  <PenTool className="text-indigo-500" /> 
                  {editingMaterial ? (language === 'es' ? 'Editar Material' : 'Edit Material') : (language === 'es' ? 'Nuevo Material' : 'New Material')}
               </h2>
               <p className="text-sm text-gray-500 mt-2 font-medium">{language === 'es' ? 'Completa los detalles para publicar el recurso.' : 'Fill out the details to publish the resource.'}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-gray-900 dark:text-white">
              <div className="md:col-span-2">
                <label htmlFor="materialTitle" className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-3">{language === 'es' ? 'Título' : 'Title'}</label>
                <input id="materialTitle" name="materialTitle" required value={title} onChange={e=>setTitle(e.target.value)} className="w-full px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-100 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner font-bold text-lg" placeholder={language === 'es' ? "Ej. Guía de Programación" : "e.g. Programming Guide"} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="materialDescription" className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-3">{language === 'es' ? 'Descripción corta' : 'Short Description'}</label>
                <input id="materialDescription" name="materialDescription" required value={description} onChange={e=>setDescription(e.target.value)} className="w-full px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-100 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner font-medium text-base" placeholder={language === 'es' ? "Breve resumen del contenido" : "Brief content summary"} />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-4">{language === 'es' ? 'Tipo de Contenido' : 'Content Type'}</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button type="button" onClick={() => setContentType('html')} className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl border-2 transition-all font-bold text-lg shadow-sm focus-visible:ring-inset hover-spring ${contentType === 'html' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 hover:border-indigo-300'}`}>
                    <Type size={24} /> {language === 'es' ? 'Texto Enriquecido (Online)' : 'Rich Text (Online)'}
                  </button>
                  <button type="button" onClick={() => setContentType('file')} className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl border-2 transition-all font-bold text-lg shadow-sm focus-visible:ring-inset hover-spring ${contentType === 'file' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 hover:border-indigo-300'}`}>
                    <FileUp size={24} /> {language === 'es' ? 'Archivo Adjunto (PDF/PPT)' : 'Attachment (PDF/PPT)'}
                  </button>
                </div>
              </div>

              {contentType === 'html' ? (
                <div className="md:col-span-2 space-y-3">
                  <label className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-2">{language === 'es' ? 'Contenido del Material' : 'Material Content'}</label>
                  <div className="h-80 mb-16 relative z-0">
                    <ReactQuill 
                      theme="snow" 
                      value={richContent} 
                      onChange={setRichContent} 
                      className="h-full bg-white dark:bg-slate-900 rounded-2xl relative z-10"
                      placeholder={language === 'es' ? "Escribe aquí el contenido extenso detallado..." : "Write detailed extended content here..."}
                    />
                  </div>
                </div>
              ) : (
                <div className="md:col-span-2 border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/50 p-12 rounded-3xl text-center hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group relative overflow-hidden">
                  <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  <FileUp className="mx-auto mb-4 text-indigo-500 group-hover:scale-110 transition-transform duration-300 drop-shadow-sm" size={48} />
                  <p className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">{language === 'es' ? 'Sube un Documento' : 'Upload a Document'}</p>
                  <p className="text-sm font-medium text-gray-500 mb-6">{language === 'es' ? 'Se recomiendan formatos PDF, PPT, DOCX O ZIP (< 50MB).' : 'PDF, PPT, DOCX or ZIP formats recommended (< 50MB).'}</p>
                  <div className="relative inline-block w-full max-w-xs mx-auto">
                     <input type="file" onChange={handleFileSelect} className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-slate-800 dark:file:text-indigo-400 dark:hover:file:bg-slate-700 cursor-pointer shadow-sm relative z-20" />
                  </div>
                  {uploadProgress > 0 && (
                    <div className="mt-8 w-full max-w-md mx-auto bg-gray-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden shadow-inner relative z-20">
                      <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-8 border-t dark:border-slate-700/50">
              <button type="button" onClick={() => { setShowForm(false); setEditingMaterial(null); }} className="px-8 py-4 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-50 border border-gray-200 dark:border-slate-700 transition-all shadow-sm focus-visible:ring-inset w-full sm:w-auto uppercase tracking-wider text-sm">
                 {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/30 hover-spring disabled:opacity-70 disabled:cursor-not-allowed focus-visible:ring-inset w-full sm:w-auto uppercase tracking-widest">
                {isSubmitting ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />}
                {editingMaterial ? (language === 'es' ? 'Actualizar' : 'Update') : (language === 'es' ? 'Publicar Ahora' : 'Publish Now')}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {materials.length === 0 ? (
            <div className="col-span-full py-32 text-center bg-gray-50/50 dark:bg-slate-900/20 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-slate-700">
               <Book size={64} className="mx-auto text-gray-300 dark:text-slate-600 mb-6" />
               <p className="text-xl font-bold text-gray-500 dark:text-slate-400">{language === 'es' ? 'No hay materiales publicados en este momento.' : 'No materials published at this moment.'}</p>
            </div>
          ) : (
            materials.map(mat => (
              <div key={mat.id} className="group glass-card p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 relative overflow-hidden bg-white dark:bg-slate-800">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700 ease-out z-0"></div>
                
                <div className="relative z-10">
                   <div className="w-16 h-16 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center mb-6 transition-transform group-hover:scale-110 group-hover:rotate-6 shadow-xl shadow-indigo-500/20">
                     {mat.content_type === 'file' ? <FileIcon size={32} /> : <Type size={32} />}
                   </div>
                   <h3 className="font-black text-2xl mb-3 text-gray-900 dark:text-white line-clamp-2 leading-tight">{mat.title}</h3>
                   <p className="text-gray-500 dark:text-slate-400 text-sm mb-8 line-clamp-3 font-medium leading-relaxed">{mat.description}</p>
                </div>
                
                <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-100 dark:border-slate-700/50 relative z-10 bg-white/50 dark:bg-slate-800/50 rounded-2xl -mx-2 -mb-2 px-2 pb-2">
                  <button onClick={() => setSelectedMaterial(mat)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all focus-visible:ring-inset uppercase tracking-wider">
                    <Eye size={18} /> {language === 'es' ? 'Acceder' : 'Access'}
                  </button>
                  <div className="flex gap-2">
                    {isTeacher && (
                      <>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-900/30 mr-2" title={language === 'es' ? 'Estudiantes que han leído este material' : 'Students who read this material'}>
                           <Eye size={14} /> {contentReadData.filter(r => r.content_id === mat.id).length}
                        </div>
                        <button onClick={() => startEditing(mat)} className="p-2.5 bg-white dark:bg-slate-900 text-gray-500 hover:text-indigo-600 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-indigo-200 transition-colors focus-visible:ring-inset" data-tooltip={language === 'es' ? "Editar material" : "Edit material"}><PenTool size={18} /></button>
                        <button onClick={() => handleDelete(mat.id)} className="p-2.5 bg-white dark:bg-slate-900 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-red-200 transition-colors focus-visible:ring-inset" data-tooltip={language === 'es' ? "Eliminar material" : "Delete material"}><Trash2 size={18}/></button>
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
