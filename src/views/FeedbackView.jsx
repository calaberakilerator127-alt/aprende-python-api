import React, { useState, useMemo } from 'react';
import { 
  MessageSquare, Plus, Send, ThumbsUp, Filter, SortAsc, 
  SortDesc, Clock, AlertCircle, Lightbulb, Wrench, X, 
  Paperclip, User as UserIcon, Loader2, MessageCircle, ChevronRight, CheckCircle
} from 'lucide-react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import api from '../config/api';
import { useSettings } from '../hooks/SettingsContext';
import { logAdminAction } from '../utils/auditUtils';
import { Shield, Trash2, Edit3, Settings as SettingsIcon } from 'lucide-react';

export default function FeedbackView({ profile, feedback = [], users = [], showToast, createNotification, comments = [], addOptimistic, updateOptimistic, removeOptimistic, replaceOptimistic }) {
  const { t, language } = useSettings();
  const [isCreating, setIsCreating] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('recent'); // recent, voted
  const [selectedReport, setSelectedReport] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('error');
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Comment State
  const [newComment, setNewComment] = useState('');

  // Dev Moderation State
  const [isEditingReport, setIsEditingReport] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [editingCategory, setEditingCategory] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const isDeveloper = profile?.role === 'developer';
  const isAdmin = profile?.role === 'admin';
  const canModerate = isDeveloper || isAdmin;

  const filteredReports = useMemo(() => {
    let result = [...feedback];
    if (filterCategory !== 'all') result = result.filter(r => r.category === filterCategory);
    if (filterStatus !== 'all') result = result.filter(r => r.status === filterStatus);
    
    if (sortBy === 'recent') {
      result.sort((a, b) => (new Date(b.created_at || 0)) - (new Date(a.created_at || 0)));
    } else {
      result.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
    }
    return result;
  }, [feedback, filterCategory, filterStatus, sortBy]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload/feedback', formData);
      setAttachments(prev => [...prev, { name: file.name, url: data.url }]);
      showToast(language === 'es' ? 'Archivo cargado' : 'File uploaded', 'success');
    } catch (e) {
      console.error(e);
      showToast(t('error'), 'error');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsSubmitting(true);
    const nowISO = new Date().toISOString();
    const data = {
      title,
      content,
      category,
      status: 'no solucionado',
      author_id: profile.id,
      author_name: profile.name,
      author_photo: profile.photo_url || '',
      created_at: nowISO,
      likes: [],
      attachments
    };

    const tempId = `temp-fb-${Date.now()}`;
    addOptimistic('feedback', { ...data, id: tempId, is_optimistic: true });
    setIsCreating(false);

    try {
      const { data: realRecord } = await api.post('/data/feedback', data);
      replaceOptimistic('feedback', tempId, realRecord);
      showToast(language === 'es' ? 'Reporte enviado con éxito' : 'Report submitted successfully');
      setTitle(''); setContent(''); setAttachments([]);
    } catch (e) {
      console.error(e);
      showToast(t('error'), 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleLike = async (report) => {
    const isLiked = report.likes?.includes(profile.id);
    const newLikes = isLiked 
      ? report.likes.filter(id => id !== profile.id)
      : [...(report.likes || []), profile.id];

    updateOptimistic('feedback', report.id, { likes: newLikes });

    try {
      await api.put(`/data/feedback/${report.id}/like`, { likes: newLikes });
    } catch (e) { console.error(e); }
  };

  const handleAddComment = async (reportId) => {
    if (!newComment.trim()) return;
    const nowISO = new Date().toISOString();
    const data = {
      parent_id: reportId,
      author_id: profile.id,
      author_name: profile.name,
      author_photo: profile.photo_url || '',
      content: newComment,
      created_at: nowISO
    };

    const tempId = `temp-c-${Date.now()}`;
    addOptimistic('comments', { ...data, id: tempId, is_optimistic: true });
    setNewComment('');

    try {
      const { data: realRecord } = await api.post('/data/comments', data);
      replaceOptimistic('comments', tempId, realRecord);
    } catch (e) { console.error(e); }
  };

  const handleUpdateReport = async (e) => {
    e.preventDefault();
    if (!isEditingReport) return;
    setIsUpdating(true);
    const changes = { 
        title: editingTitle, 
        content: editingContent, 
        category: editingCategory 
      };
      
      updateOptimistic('feedback', isEditingReport.id, changes);
      setIsEditingReport(null);
      if (selectedReport?.id === isEditingReport.id) setSelectedReport({ ...selectedReport, ...changes });

      try {
        await api.put(`/data/feedback/${isEditingReport.id}`, changes);
        await logAdminAction(profile, 'edit_report', isEditingReport.id, isEditingReport, { ...isEditingReport, ...changes });
        showToast(language === 'es' ? 'Reporte actualizado' : 'Report updated');
      } catch (e) { 
        console.error(e);
        showToast("Error al actualizar", "error");
      }
      finally { setIsUpdating(false); }
  };

  const handleDeleteReport = async (report) => {
    if (window.confirm(language === 'es' ? '¿ELIMINAR este reporte permanentemente?' : 'DELETE this report permanently?')) {
      removeOptimistic('feedback', report.id);
      setSelectedReport(null);

      try {
        await api.delete(`/data/feedback/${report.id}`);
        await logAdminAction(profile, 'delete_report', report.id, report);
        showToast(language === 'es' ? 'Reporte eliminado' : 'Report deleted');
      } catch (e) { console.error(e); }
    }
  };

  const handleUpdateStatus = async (report, newStatus) => {
    updateOptimistic('feedback', report.id, { status: newStatus });
    if (selectedReport?.id === report.id) setSelectedReport({ ...selectedReport, status: newStatus });

    try {
      await api.put(`/data/feedback/${report.id}/status`, { status: newStatus });
      await logAdminAction(profile, 'update_status', report.id, { status: report.status }, { status: newStatus });
      showToast(language === 'es' ? `Reporte marcado como ${newStatus}` : `Report marked as ${newStatus}`);
    } catch (e) { console.error(e); }
  };

  const handleDeleteComment = async (comment) => {
    if (window.confirm(language === 'es' ? '¿Eliminar este comentario?' : 'Delete this comment?')) {
      removeOptimistic('comments', comment.id);

      try {
        await api.delete(`/data/comments/${comment.id}`);
        await logAdminAction(profile, 'delete_comment', comment.id, comment);
        showToast(language === 'es' ? 'Comentario eliminado' : 'Comment deleted');
      } catch (e) { console.error(e); }
    }
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}],
      ['link', 'code-block'],
      ['clean']
    ],
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'no solucionado': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      case 'en proceso': return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
      case 'solucionado': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getCategoryIcon = (cat) => {
    switch(cat) {
      case 'error': return <AlertCircle size={14} />;
      case 'mejora': return <Wrench size={14} />;
      case 'ideas': return <Lightbulb size={14} />;
      case 'problemas': return <AlertCircle size={14} />;
      default: return <MessageSquare size={14} />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{t('feedback_title')}</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Ayúdanos a mejorar la plataforma con tus reportes e ideas.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg hover-spring"
        >
          <Plus size={20} /> {t('new_report')}
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-800 p-4 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select 
            value={filterCategory} 
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-gray-50 dark:bg-slate-900 border-none text-xs font-black rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-widest"
          >
            <option value="all">{language === 'es' ? 'Todas las Categorías' : 'All Categories'}</option>
            <option value="error">{t('cat_error')}</option>
            <option value="mejora">{t('cat_improvement')}</option>
            <option value="ideas">{t('cat_ideas')}</option>
            <option value="problemas">{t('cat_problems')}</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-gray-50 dark:bg-slate-900 border-none text-xs font-black rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 uppercase tracking-widest"
          >
            <option value="all">{language === 'es' ? 'Todos los Estados' : 'All Status'}</option>
            <option value="no solucionado">{t('status_unsolved')}</option>
            <option value="en proceso">{t('status_process')}</option>
            <option value="solucionado">{t('status_solved')}</option>
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button 
            onClick={() => setSortBy(sortBy === 'recent' ? 'voted' : 'recent')}
            className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline"
          >
            {sortBy === 'recent' ? <SortDesc size={14} /> : <ThumbsUp size={14} />}
            {sortBy === 'recent' ? (language === 'es' ? 'Más Recientes' : 'Recent') : (language === 'es' ? 'Más Votados' : 'Top Voted')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredReports.map(report => (
          <div 
            key={report.id} 
            onClick={() => setSelectedReport(report)}
            className="glass-card p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700/50 hover:shadow-2xl hover:-translate-y-1 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(report.status)}`}>
                {t(`status_${report.status.replace(' ', '_')}`)}
              </span>
              <span className="text-[10px] font-black text-gray-400 uppercase">[{report.report_id}]</span>
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">{report.title}</h3>
            <div className="flex items-center gap-3 mb-6">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                {getCategoryIcon(report.category)} {t(`cat_${report.category}`)}
              </span>
              <span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
                <Clock size={12} /> {new Date(report.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-700">
               <div className="flex items-center gap-2">
                 {report.author_photo ? <img src={report.author_photo} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">{report.author_name?.charAt(0)}</div>}
                 <span className="text-xs font-bold text-gray-500">{report.author_name}</span>
               </div>
               <div className="flex items-center gap-2">
                 {canModerate && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={(e) => { e.stopPropagation(); setIsEditingReport(report); setEditingTitle(report.title); setEditingContent(report.content); setEditingCategory(report.category); }} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg"><Edit3 size={14} /></button>
                       <button onClick={(e) => { e.stopPropagation(); handleDeleteReport(report); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                 )}
                 <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <ThumbsUp size={14} className={report.likes?.includes(profile.id) ? 'text-indigo-600' : ''} />
                    <span className="text-xs font-black">{report.likes?.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <MessageCircle size={14} />
                    <span className="text-xs font-black">{comments.filter(c => c.parent_id === report.id).length}</span>
                  </div>
                 </div>
               </div>
            </div>
          </div>
        ))}
        {filteredReports.length === 0 && (
          <div className="md:col-span-2 py-20 text-center opacity-40">
            <MessageSquare size={64} className="mx-auto mb-4 text-gray-300" />
            <p className="font-black uppercase tracking-widest">{t('no_reports')}</p>
          </div>
        )}
      </div>

      {/* Report Creation Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-[3rem] shadow-2xl border dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden animate-scale-in">
            <div className="p-8 border-b dark:border-slate-700 flex justify-between items-center bg-indigo-50/30 dark:bg-indigo-900/10">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{t('new_report')}</h2>
              <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSubmitReport} className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="feedbackTitle" className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">{t('report_title')}</label>
                  <input 
                    id="feedbackTitle"
                    name="feedbackTitle"
                    required 
                    value={title} 
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Resumen corto del problema..."
                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500 transition-all font-bold shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="feedbackCategory" className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">{t('category')}</label>
                  <select 
                    id="feedbackCategory"
                    name="feedbackCategory"
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 outline-none focus:border-indigo-500 transition-all font-bold shadow-inner uppercase tracking-widest"
                  >
                    <option value="error">{t('cat_error')}</option>
                    <option value="mejora">{t('cat_improvement')}</option>
                    <option value="ideas">{t('cat_ideas')}</option>
                    <option value="problemas">{t('cat_problems')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="feedbackContent" className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Descripción Detallada</label>
                <div className="rich-editor-container rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-slate-700 shadow-inner">
                  <ReactQuill 
                    id="feedbackContent"
                    theme="snow" 
                    value={content} 
                    onChange={setContent} 
                    modules={quillModules}
                    placeholder="Describe el reporte con lujo de detalles..."
                    className="bg-white dark:bg-slate-900 min-h-[200px]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label htmlFor="attachment-upload" className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest ml-2 cursor-pointer hover:text-indigo-600 transition-colors">
                  <Paperclip size={16} /> {t('attachment_label')}
                  <input id="attachment-upload" name="attachment-upload" type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                  {uploadingFile && <Loader2 size={16} className="animate-spin" />}
                </label>
                <div className="flex flex-wrap gap-2">
                   {attachments.map((file, idx) => (
                     <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl">
                        <span className="text-xs font-medium truncate max-w-[150px]">{file.name}</span>
                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700"><X size={14}/></button>
                     </div>
                   ))}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting || !content || !title}
                className="w-full py-5 bg-indigo-600 text-white rounded-[1.25rem] font-black text-lg uppercase tracking-widest shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <Send size={24} />}
                {t('save_report')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
           <div className="bg-white dark:bg-slate-800 w-full max-w-4xl rounded-[3rem] shadow-2xl border dark:border-slate-700 flex flex-col max-h-[90vh] overflow-hidden animate-scale-in">
              <div className="p-8 border-b dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/20">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusColor(selectedReport.status)}`}>
                      {t(`status_${selectedReport.status.replace(' ', '_')}`)}
                    </span>
                    <span className="text-[10px] font-black text-gray-400">[{selectedReport.report_id}]</span>
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{selectedReport.title}</h2>
                </div>
                <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors"><X size={24} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3">
                <div className="lg:col-span-2 p-8 space-y-8 border-r dark:border-slate-700">
                  <div className="flex items-center gap-4 border-b dark:border-slate-700 pb-6">
                    {selectedReport.author_photo ? <img src={selectedReport.author_photo} className="w-12 h-12 rounded-2xl object-cover border-2 border-indigo-100" /> : <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">{selectedReport.author_name?.charAt(0)}</div>}
                    <div>
                      <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">{selectedReport.author_name}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{new Date(selectedReport.created_at).toLocaleString()}</p>
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-2">
                       <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest">
                        {getCategoryIcon(selectedReport.category)} {t(`cat_${selectedReport.category}`)}
                       </span>
                       {canModerate && (
                         <select 
                           value={selectedReport.status} 
                           onChange={(e) => handleUpdateStatus(selectedReport, e.target.value)}
                           className="text-[9px] font-black uppercase bg-white dark:bg-slate-800 border dark:border-slate-700 rounded px-2 py-1 outline-none ring-indigo-500 focus:ring-1"
                         >
                            <option value="no solucionado">{t('status_unsolved')}</option>
                            <option value="en proceso">{t('status_process')}</option>
                            <option value="solucionado">{t('status_solved')}</option>
                         </select>
                       )}
                    </div>
                  </div>

                  <div className="prose prose-indigo dark:prose-invert max-w-none text-gray-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: selectedReport.content }} />

                  {selectedReport.attachments?.length > 0 && (
                    <div className="space-y-3 pt-6 border-t dark:border-slate-700">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'es' ? 'Archivos Adjuntos' : 'Attachments'}</h4>
                      <div className="flex flex-wrap gap-3">
                        {selectedReport.attachments.map((file, i) => (
                           <a 
                            key={i} 
                            href={file.url} 
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-2xl hover:border-indigo-500 transition-all group"
                           >
                             <Paperclip size={18} className="text-gray-400 group-hover:text-indigo-500" />
                             <span className="text-xs font-bold text-gray-600 dark:text-slate-400 group-hover:text-indigo-600">{file.name}</span>
                           </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-6 pt-6">
                    <button 
                      onClick={() => handleLike(selectedReport)}
                      className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${selectedReport.likes?.includes(profile.id) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-100 dark:bg-slate-900 text-gray-500 hover:bg-indigo-50'}`}
                    >
                      <ThumbsUp size={18} /> {selectedReport.likes?.length || 0} {t('likes')}
                    </button>
                    <div className="flex items-center gap-2 text-gray-400 text-xs font-black uppercase tracking-widest">
                       <MessageCircle size={18} /> {comments.filter(c => c.parent_id === selectedReport.id).length} {t('comments')}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50/50 dark:bg-slate-900/30 p-8 flex flex-col h-full">
                   <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest mb-6 border-b dark:border-slate-700 pb-4">{t('comments')}</h3>
                   <div className="flex-1 space-y-6 overflow-y-auto mb-6 pr-2 custom-scrollbar">
                      {comments.filter(c => c.parent_id === selectedReport.id).sort((a,b)=>a.created_at-b.created_at).map(comment => (
                        <div key={comment.id} className="space-y-2 animate-fade-in">
                          <div className="flex items-center gap-2">
                            {comment.author_photo ? <img src={comment.author_photo} className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px]">{comment.author_name?.charAt(0)}</div>}
                            <span className="text-[10px] font-black text-gray-700 dark:text-slate-300 uppercase">{comment.author_name}</span>
                            <div className="ml-auto flex items-center gap-2">
                               {isDeveloper && (
                                 <button onClick={() => handleDeleteComment(comment)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 size={12} /></button>
                               )}
                               <span className="text-[9px] text-gray-400 font-medium">{new Date(comment.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl rounded-tl-none border dark:border-slate-700 shadow-sm">
                             <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                      {comments.filter(c => c.parent_id === selectedReport.id).length === 0 && (
                        <p className="text-center text-xs text-gray-400 italic py-10">{language === 'es' ? 'Sé el primero en comentar...' : 'Be the first to comment...'}</p>
                      )}
                   </div>
                   <div className="relative">
                      <textarea 
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder={t('write_comment')}
                        className="w-full bg-white dark:bg-slate-800 border-2 dark:border-slate-700 rounded-[1.5rem] px-5 py-4 text-sm outline-none focus:border-indigo-500 transition-all shadow-lg resize-none pr-14"
                        rows="3"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(selectedReport.id); } }}
                      />
                      <button 
                        onClick={() => handleAddComment(selectedReport.id)}
                        disabled={!newComment.trim()}
                        className="absolute bottom-4 right-4 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-md transition-all active:scale-95"
                      >
                         <Send size={18} />
                      </button>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Dev Moderation EDIT Modal */}
      {isEditingReport && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-8 border-b dark:border-slate-700 flex justify-between items-center bg-amber-500/10">
               <div className="flex items-center gap-3">
                  <Shield size={24} className="text-amber-600" />
                  <h2 className="text-xl font-black text-amber-600 uppercase tracking-tight">Editar Reporte (Admin)</h2>
               </div>
               <button onClick={() => setIsEditingReport(null)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleUpdateReport} className="flex-1 overflow-y-auto p-8 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Título</label>
                  <input 
                    required 
                    value={editingTitle} 
                    onChange={e => setEditingTitle(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 dark:bg-slate-900 outline-none focus:border-amber-500 transition-all font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Categoría</label>
                  <select 
                    value={editingCategory} 
                    onChange={e => setEditingCategory(e.target.value)}
                    className="w-full px-6 py-4 rounded-2xl border-2 dark:bg-slate-900 outline-none focus:border-amber-500 transition-all font-bold uppercase tracking-widest"
                  >
                    <option value="error">Error</option>
                    <option value="mejora">Mejora</option>
                    <option value="ideas">Ideas</option>
                    <option value="problemas">Problemas</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Contenido</label>
                <div className="rounded-2xl overflow-hidden border-2 dark:border-slate-700 shadow-inner">
                  <ReactQuill theme="snow" value={editingContent} onChange={setEditingContent} modules={quillModules} className="bg-white dark:bg-slate-900 min-h-[200px]" />
                </div>
              </div>
              <button disabled={isUpdating} type="submit" className="w-full py-5 bg-amber-600 text-white rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl shadow-amber-500/30 hover:bg-amber-700 transition-all flex items-center justify-center gap-3">
                {isUpdating ? <Loader2 className="animate-spin" /> : <CheckCircle size={24} />}
                Guardar Cambios
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
