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
      setShowForm(false);
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
    
    const currentAddList = Array.isArray(item[fieldToAdd]) ? item[fieldToAdd] : [];
    const currentRemoveList = Array.isArray(item[fieldToRemove]) ? item[fieldToRemove] : [];
    
    const isActive = currentAddList.includes(profile.id);
    let newAddList = isActive 
      ? currentAddList.filter(id => id !== profile.id)
      : [...currentAddList, profile.id];
    let newRemoveList = currentRemoveList.filter(id => id !== profile.id);

    updateOptimistic('news', item.id, { [fieldToAdd]: newAddList, [fieldToRemove]: newRemoveList });

    try {
      await api.put(`/data/news/${item.id}`, { [fieldToAdd]: newAddList, [fieldToRemove]: newRemoveList });
    } catch (e) { console.error(e); }
  };

  const handleRead = async (id) => {
    try {
      const item = news.find(n => n.id === id);
      const currentReadBy = Array.isArray(item?.read_by) ? item.read_by : [];
      if (!currentReadBy.includes(profile.id)) {
        const newReadBy = [...currentReadBy, profile.id];
        updateOptimistic('news', id, { read_by: newReadBy });
        await api.put(`/data/news/${id}`, { read_by: newReadBy });
      }
    } catch (e) { console.error(e); }
  };

  const sortedNews = [...news].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unreadCount = sortedNews.filter(n => !(Array.isArray(n.read_by) ? n.read_by : []).includes(profile.id)).length;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* HEADER SECTION */}
      <div className="aura-card p-0 overflow-hidden shadow-2xl">
        <div className="aura-gradient-secondary px-10 py-12 text-white flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="space-y-4 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <h1 className="text-5xl font-black uppercase tracking-tighter flex items-center gap-4">
                <Megaphone className="text-white" size={56} /> 
                {language === 'es' ? 'Canal de Avisos' : 'Broadcast Channel'}
              </h1>
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-xs font-black px-6 py-2 rounded-full animate-pulse shadow-2xl shadow-rose-500/50 uppercase tracking-widest border-2 border-white/20">
                  {unreadCount} {language === 'es' ? 'Pendientes' : 'Pending'}
                </span>
              )}
            </div>
            <p className="text-white/60 font-black text-xs uppercase tracking-[0.3em]">{language === 'es' ? 'Comunicación Oficial Directa' : 'Direct Official Communication'}</p>
          </div>
          
          {isTeacher && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="group flex items-center justify-center gap-6 px-10 py-6 bg-white text-blue-600 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-3xl hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={24} className="group-hover:rotate-90 transition-transform"/> 
              {language === 'es' ? 'Emitir Aviso' : 'Emit News'}
            </button>
          )}
        </div>
      </div>

      {showForm && isTeacher && (
        <div className="aura-card p-0 border-none shadow-2xl animate-scale-in relative overflow-hidden">
          <div className="aura-gradient-secondary px-8 py-6 flex justify-between items-center text-white">
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-4">
              <Bell size={24} />
              {editingNews ? (language === 'es' ? 'Modificar Aviso' : 'Modify Announcement') : (language === 'es' ? 'Nuevo Aviso Crítico' : 'New Critical Announcement')}
            </h2>
            <button onClick={() => { setShowForm(false); setEditingNews(null); }} className="p-3 bg-white/20 hover:bg-white/40 rounded-2xl transition-all shadow-lg"><X size={24}/></button>
          </div>
          
          <form onSubmit={handleSaveNews} className="p-10 space-y-10">
            <div className="space-y-8">
              <div>
                <label htmlFor="newsTitle" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{language === 'es' ? 'Título del Mensaje' : 'Message Title'}</label>
                <input
                  id="newsTitle"
                  name="newsTitle"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'es' ? "Ej. Sincronización de Examen Final" : "e.g. Final Exam Synchronization"}
                  className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-transparent focus:border-blue-500 outline-none transition-all shadow-inner font-black text-xl placeholder:text-slate-300"
                />
              </div>
              <div>
                <label htmlFor="newsContent" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{language === 'es' ? 'Cuerpo del Comunicado' : 'Communique Body'}</label>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-transparent focus-within:border-blue-500 overflow-hidden shadow-inner transition-all">
                  <ReactQuill
                    id="newsContent"
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    className="min-h-[250px] aura-quill-secondary"
                    placeholder={language === 'es' ? "Describe los detalles técnicos aquí..." : "Describe the technical details here..."}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-6 pt-6">
              <button type="button" onClick={() => { setShowForm(false); setEditingNews(null); }} className="px-10 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all w-full sm:w-auto">
                 {language === 'es' ? 'Cancelar Emisión' : 'Cancel Emission'}
              </button>
              <button type="submit" disabled={isSubmitting} className="aura-gradient-secondary text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all w-full sm:w-auto">
                {isSubmitting ? (language === 'es' ? 'Sincronizando...' : 'Syncing...') : (editingNews ? (language === 'es' ? 'Actualizar' : 'Update') : (language === 'es' ? 'Emitir Ahora' : 'Emit Now'))}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {sortedNews.length === 0 ? (
          <div className="aura-card py-40 text-center shadow-none border-2 border-dashed border-slate-200 dark:border-slate-800">
             <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
               <Newspaper size={40} className="text-slate-300 dark:text-slate-700" />
             </div>
             <p className="text-xl font-black text-slate-400 uppercase tracking-widest">{language === 'es' ? 'Sin transmisiones activas' : 'No active streams'}</p>
          </div>
        ) : (
          sortedNews.map(item => {
            const isUnread = !(Array.isArray(item.read_by) ? item.read_by : []).includes(profile.id);
            const hasLiked = (Array.isArray(item.likes) ? item.likes : []).includes(profile.id);
            const hasDisliked = (Array.isArray(item.dislikes) ? item.dislikes : []).includes(profile.id);
            return (
              <div key={item.id} className={`aura-card p-0 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 group shadow-xl ${isUnread ? 'ring-2 ring-blue-500' : ''}`}>
                <div className="p-8 md:p-10 relative">
                  {isUnread && <div className="absolute top-0 left-0 w-2 h-full aura-gradient-secondary"></div>}
                  
                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight tracking-tighter group-hover:text-blue-600 transition-colors">{item.title}</h3>
                        {isUnread && <span className="aura-gradient-secondary text-white text-[9px] px-4 py-1.5 rounded-full animate-pulse font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-500/30">{language === 'es' ? 'NUEVO' : 'NEW'}</span>}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                        <span className="flex items-center gap-2 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors"><User size={16} className="text-blue-500" /> {item.author_name}</span>
                        <span className="flex items-center gap-2"><Calendar size={16} className="text-slate-400" /> {new Date(item.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="flex items-center gap-2"><Clock size={16} className="text-slate-400" /> {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {new Date(item.updated_at) > new Date(item.created_at) && (
                           <span className="text-blue-400 font-black italic">{language === 'es' ? '[Dato Modificado]' : '[Data Modified]'}</span>
                        )}
                      </div>
                    </div>
                    {isTeacher && item.author_id === profile.id && (
                      <div className="flex gap-3 shrink-0">
                        <button onClick={() => startEditing(item)} className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 hover:bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-blue-100 transition-all" aria-label={language === 'es' ? 'Editar' : 'Edit'}><Edit2 size={20}/></button>
                        <button onClick={() => handleDeleteNews(item.id)} className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl shadow-sm border-2 border-transparent hover:border-rose-100 transition-all" aria-label={language === 'es' ? 'Eliminar' : 'Delete'}><Trash2 size={20}/></button>
                      </div>
                    )}
                  </div>

                  <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 text-lg leading-relaxed ql-editor !p-0 mb-10 overflow-visible" dangerouslySetInnerHTML={{ __html: item.content }} />

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t-2 border-slate-50 dark:border-slate-800 pt-8">
                     <div className="flex items-center gap-4">
                        <button onClick={() => handleLike(item, true)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border-2 active:scale-90 ${hasLiked ? 'aura-gradient-secondary text-white border-transparent' : 'text-slate-400 hover:text-blue-600 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-blue-100'}`}>
                          <ThumbsUp size={18} /> {Array.isArray(item.likes) ? item.likes.length : 0}
                        </button>
                        <button onClick={() => handleLike(item, false)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border-2 active:scale-90 ${hasDisliked ? 'bg-rose-600 text-white border-transparent' : 'text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-rose-100'}`}>
                          <ThumbsDown size={18} /> {Array.isArray(item.dislikes) ? item.dislikes.length : 0}
                        </button>
                     </div>
                     {isUnread && (
                       <button onClick={() => handleRead(item.id)} className="w-full sm:w-auto flex items-center justify-center gap-4 px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] aura-gradient-secondary text-white rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                         <CheckCircle size={20} className="shrink-0" /> {language === 'es' ? 'Marcar como Leído' : 'Mark as Read'}
                       </button>
                     )}
                  </div>
                  <div className="mt-10 pt-10 border-t-2 border-slate-50 dark:border-slate-800">
                    <CommentsSection parentId={item.id} parentType="news" profile={profile} comments={comments} showToast={showToast} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
