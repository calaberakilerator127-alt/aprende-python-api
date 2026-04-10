import React, { useState } from 'react';
import { Bell, Plus, X, Edit2, Trash2, Calendar, User, Clock, ThumbsUp, ThumbsDown, CheckCircle, Newspaper, Megaphone } from 'lucide-react';
import api from '../config/api';
import CommentsSection from '../components/CommentsSection';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useSettings } from '../hooks/SettingsContext';

export default function NewsView({ profile, news, showToast, comments = [], addOptimistic, updateOptimistic, removeOptimistic, replaceOptimistic, createNotification }) {
  const { language } = useSettings();
  const isTeacher = profile.role === 'profesor';
  const [showForm, setShowForm] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveNews = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    setIsSubmitting(true);
    const newsData = {
      title: title.trim(),
      content: content.trim(),
      author_id: profile?.id,
      author_name: profile?.name || 'Profesor',
      updated_at: new Date().toISOString()
    };

    let tempIdStr = null;

    // UI Optimista para nueva noticia
    if (!editingNews) {
      tempIdStr = `temp-news-${Date.now()}`;
      const optimisticNews = {
        ...newsData,
        id: tempIdStr,
        created_at: new Date().toISOString(),
        read_by: [],
        likes: [],
        dislikes: [],
        is_optimistic: true
      };
      addOptimistic('news', optimisticNews);
      setShowForm(false); // Cerramos el formulario de inmediato
    }

    try {
      if (editingNews) {
        updateOptimistic('news', editingNews.id, newsData);
        await api.put(`/data/news/${editingNews.id}`, newsData);
        showToast(language === 'es' ? 'Noticia actualizada' : 'News updated');
      } else {
        const { data: res } = await api.post('/data/news', newsData);
        if (tempIdStr) replaceOptimistic('news', tempIdStr, res);
        showToast(language === 'es' ? 'Noticia publicada' : 'News published');
        createNotification(language === 'es' ? `Nueva noticia: ${title}` : `New announcement: ${title}`, null, 'news', res.id);
      }
      
      setShowForm(false);
      setEditingNews(null);
      setTitle('');
      setContent('');
    } catch (e) {
      console.error(e);
      showToast(language === 'es' ? 'Error al guardar' : 'Error saving', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (item) => {
    setEditingNews(item);
    setTitle(item.title);
    setContent(item.content);
    setShowForm(true);
  };

  const handleDeleteNews = async (id) => {
    if (window.confirm(language === 'es' ? '¿Eliminar esta noticia?' : 'Delete this news?')) {
      removeOptimistic('news', id);
      try {
        await api.delete(`/data/news/${id}`);
        showToast(language === 'es' ? 'Noticia eliminada' : 'News deleted');
      } catch (e) {
        console.error(e);
        showToast(language === 'es' ? 'Error al eliminar' : 'Error deleting', 'error');
      }
    }
  };

  const handleLike = async (item, isLike) => {
    const fieldToAdd = isLike ? 'likes' : 'dislikes';
    const fieldToRemove = isLike ? 'dislikes' : 'likes';
    
    const currentAddList = item[fieldToAdd] || [];
    const currentRemoveList = item[fieldToRemove] || [];
    
    const isActive = currentAddList.includes(profile.id);
    let newAddList = isActive 
      ? currentAddList.filter(id => id !== profile.id)
      : [...currentAddList, profile.id];
    let newRemoveList = currentRemoveList.filter(id => id !== profile.id);

    // Vuelo Optimista: Actualizamos la UI inmediatamente
    updateOptimistic('news', item.id, { [fieldToAdd]: newAddList, [fieldToRemove]: newRemoveList });

    try {
      await api.put(`/data/news/${item.id}`, { [fieldToAdd]: newAddList, [fieldToRemove]: newRemoveList });
    } catch (e) { console.error(e); }
  };

  const handleRead = async (id) => {
    try {
      const item = news.find(n => n.id === id);
      const currentReadBy = item?.read_by || [];
      if (!currentReadBy.includes(profile.id)) {
        const newReadBy = [...currentReadBy, profile.id];
        updateOptimistic('news', id, { read_by: newReadBy });
        await api.put(`/data/news/${id}`, { read_by: newReadBy });
      }
    } catch (e) { console.error(e); }
  };

  const sortedNews = [...news].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unreadCount = sortedNews.filter(n => !n.read_by?.includes(profile.id)).length;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="glass-card p-6 md:p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              <Megaphone className="text-indigo-600" size={32} />
              {language === 'es' ? 'Avisos y Noticias' : 'Announcements'}
            </h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-sm font-black px-3 py-1 rounded-full animate-pulse shadow-md shadow-red-500/30">
                {unreadCount} {language === 'es' ? 'nuevos' : 'new'}
              </span>
            )}
          </div>
          <p className="text-gray-500 font-medium">{language === 'es' ? 'Información importante compartida por el profesor.' : 'Important information shared by the teacher.'}</p>
        </div>
        {isTeacher && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-3 w-full md:w-auto bg-indigo-600 text-white px-6 py-4 rounded-2xl hover:bg-indigo-700 transition-all hover-spring shadow-lg shadow-indigo-500/30 font-bold focus-visible:ring-inset"
          >
            <Plus size={22} /> {language === 'es' ? 'Publicar Aviso' : 'Post Announcement'}
          </button>
        )}
      </div>

      {showForm && isTeacher && (
        <div className="glass-card p-6 md:p-10 rounded-[2.5rem] shadow-xl border border-indigo-100 dark:border-slate-700/50 animate-scale-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          <button onClick={() => { setShowForm(false); setEditingNews(null); }} className="absolute top-6 right-6 p-3 bg-white dark:bg-slate-800 rounded-2xl text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm focus-visible:ring-inset"><X size={24}/></button>
          
          <form onSubmit={handleSaveNews} className="space-y-8 mt-4">
            <div>
               <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                 <Bell className="text-indigo-500" />
                 {editingNews ? (language === 'es' ? 'Editar Aviso' : 'Edit Announcement') : (language === 'es' ? 'Nuevo Aviso Importante' : 'New Important Announcement')}
               </h2>
               <p className="text-sm text-gray-500 mt-2 font-medium">{language === 'es' ? 'Será visible inmediatamente para todos los estudiantes.' : 'Will be immediately visible to all students.'}</p>
            </div>

            <div className="space-y-6">
              <div>
                <label htmlFor="newsTitle" className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-3">{language === 'es' ? 'Título del Aviso' : 'Announcement Title'}</label>
                <input
                  id="newsTitle"
                  name="newsTitle"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'es' ? "Ej. Cambio en la fecha del examen final" : "e.g. Change in final exam date"}
                  className="w-full px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-100 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-inner font-bold text-lg"
                />
              </div>
              <div>
                <label htmlFor="newsContent" className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-3">{language === 'es' ? 'Contenido' : 'Content'}</label>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-100 dark:border-slate-700 overflow-hidden shadow-inner">
                  <ReactQuill
                    id="newsContent"
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    className="min-h-[200px] bg-white dark:bg-slate-900"
                    placeholder={language === 'es' ? "Describe los detalles del aviso aquí..." : "Describe the announcement details here..."}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t dark:border-slate-700/50">
              <button type="button" onClick={() => { setShowForm(false); setEditingNews(null); }} className="px-8 py-4 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-50 border border-gray-200 dark:border-slate-700 transition-all shadow-sm focus-visible:ring-inset w-full sm:w-auto uppercase tracking-wider text-sm">
                 {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl hover-spring disabled:opacity-70 focus-visible:ring-inset w-full sm:w-auto uppercase tracking-wide">
                {isSubmitting ? (language === 'es' ? 'Guardando...' : 'Saving...') : (editingNews ? (language === 'es' ? 'Actualizar Aviso' : 'Update') : (language === 'es' ? 'Publicar Ahora' : 'Publish Now'))}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-5">
        {sortedNews.length === 0 ? (
          <div className="text-center py-32 bg-gray-50/50 dark:bg-slate-900/20 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-slate-700">
             <Newspaper size={64} className="mx-auto text-gray-300 dark:text-slate-600 mb-6" />
             <p className="text-xl font-bold text-gray-500 dark:text-slate-400">{language === 'es' ? 'No hay avisos publicados en este momento.' : 'No announcements published at this time.'}</p>
          </div>
        ) : (
          sortedNews.map(item => {
            const isUnread = !item.read_by?.includes(profile.id);
            const hasLiked = item.likes?.includes(profile.id);
            const hasDisliked = item.dislikes?.includes(profile.id);
            return (
              <div key={item.id} className={`glass-card p-6 md:p-8 rounded-[2.5rem] shadow-sm border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden group ${isUnread ? 'border-indigo-200 dark:border-indigo-800/60' : 'border-gray-100 dark:border-slate-700/50'}`}>
                <div className={`absolute top-0 left-0 w-1.5 h-full transition-all group-hover:w-2.5 ${isUnread ? 'bg-gradient-to-b from-indigo-500 to-purple-600' : 'bg-gray-200 dark:bg-slate-700'}`}></div>
                
                <div className="pl-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight">{item.title}</h3>
                        {isUnread && <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full animate-pulse font-black uppercase tracking-widest shadow-sm">{language === 'es' ? 'NUEVO' : 'NEW'}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm"><User size={13} /> {item.author_name}</span>
                        <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm"><Calendar size={13} /> {new Date(item.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium' })}</span>
                        <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm"><Clock size={13} /> {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {new Date(item.updated_at) > new Date(item.created_at) && (
                           <span className="italic text-indigo-500 font-bold">{language === 'es' ? `Editado ${new Date(item.updated_at).toLocaleDateString()}` : `Edited ${new Date(item.updated_at).toLocaleDateString()}`}</span>
                        )}
                      </div>
                    </div>
                    {isTeacher && item.author_id === profile.id && (
                      <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => startEditing(item)} className="p-3 text-gray-500 hover:text-indigo-600 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-indigo-200 transition-all focus-visible:ring-inset" aria-label={language === 'es' ? 'Editar' : 'Edit'}><Edit2 size={18}/></button>
                        <button onClick={() => handleDeleteNews(item.id)} className="p-3 text-gray-500 hover:text-red-500 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-red-200 transition-all focus-visible:ring-inset" aria-label={language === 'es' ? 'Eliminar' : 'Delete'}><Trash2 size={18}/></button>
                      </div>
                    )}
                  </div>

                  <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 text-base leading-relaxed ql-editor !p-0 !h-auto overflow-visible mb-6" dangerouslySetInnerHTML={{ __html: item.content }} />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-gray-100 dark:border-slate-700/50 pt-5">
                     <div className="flex items-center gap-3">
                        <button onClick={() => handleLike(item, true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all shadow-sm border focus-visible:ring-inset hover-spring ${hasLiked ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-500/20' : 'text-gray-500 hover:text-indigo-600 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-indigo-300'}`}>
                          <ThumbsUp size={16} /> {item.likes?.length || 0}
                        </button>
                        <button onClick={() => handleLike(item, false)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all shadow-sm border focus-visible:ring-inset hover-spring ${hasDisliked ? 'bg-red-500 text-white border-red-600 shadow-red-500/20' : 'text-gray-500 hover:text-red-500 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-red-300'}`}>
                          <ThumbsDown size={16} /> {item.dislikes?.length || 0}
                        </button>
                     </div>
                     {isUnread && (
                       <button onClick={() => handleRead(item.id)} className="flex items-center gap-2 px-5 py-2.5 text-sm font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 rounded-xl hover:bg-indigo-100 transition-all focus-visible:ring-inset hover-spring">
                         <CheckCircle size={18} className="shrink-0" /> {language === 'es' ? 'Marcar como leído' : 'Mark as read'}
                       </button>
                     )}
                  </div>
                  <CommentsSection parentId={item.id} parentType="news" profile={profile} comments={comments} showToast={showToast} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
