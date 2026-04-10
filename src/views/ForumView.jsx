import React, { useState } from 'react';
import { 
  MessageSquare, Plus, Search, X, Tag, User, Calendar, 
  Edit2, Trash2, ThumbsUp, ThumbsDown, CheckCircle, 
  ChevronUp, ChevronDown, Filter, Clock, Eye, Send, 
  MessageCircle, Hash, AlertTriangle, Shield, Flag
} from 'lucide-react';
import api from '../config/api';
import CommentsSection from '../components/CommentsSection';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useSettings } from '../hooks/SettingsContext';

const CATEGORIES = {
  all:       { es: 'Todas', en: 'All',          color: 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300 border-gray-200 dark:border-slate-700' },
  académico: { es: 'Académico', en: 'Academic', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40' },
  proyecto:  { es: 'Proyecto', en: 'Project',   color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/40' },
  duda:      { es: 'Duda', en: 'Question',      color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40' },
};

export default function ForumView({ profile, users, forum, showToast, comments = [], fetchFullRecord, addOptimistic, updateOptimistic, removeOptimistic, replaceOptimistic }) {
  const { language } = useSettings();
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [expandedPosts, setExpandedPosts] = useState({});
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('académico');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    
    setIsSubmitting(true);
    try {
      const postData = { 
        title, 
        content, 
        category, 
        author_id: profile.id, 
        author_name: profile.name, 
        updated_at: new Date().toISOString() 
      };

      let tempIdStr = null;

      // UI Optimista para nueva publicación
      if (!editingPost) {
        tempIdStr = `temp-${Date.now()}`;
        const optimisticPost = {
          ...postData,
          id: tempIdStr,
          created_at: new Date().toISOString(),
          read_by: [],
          likes: [],
          dislikes: [],
          is_optimistic: true
        };
        addOptimistic('forum', optimisticPost);
        setShowForm(false); // Cerramos el formulario de inmediato para Ultra Speed
      }

      if (editingPost) {
        updateOptimistic('forum', editingPost.id, postData);
        await api.put(`/data/forum/${editingPost.id}`, postData);
        showToast(language === 'es' ? 'Publicación actualizada' : 'Post updated');
      } else {
        const { data: realRecord } = await api.post('/data/forum', {
          ...postData,
          is_pinned: false,
        });
        
        if (tempIdStr) replaceOptimistic('forum', tempIdStr, realRecord);
        showToast(language === 'es' ? 'Publicado en el foro' : 'Posted to the forum');
      }
      
      setShowForm(false);
      setEditingPost(null);
      setTitle('');
      setContent('');
      setCategory('académico');
    } catch (e) {
      console.error(e);
      showToast(language === 'es' ? 'Error al guardar' : 'Error saving', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = async (post) => {
    let targetPost = post;
    if (!post.content && fetchFullRecord) {
      const full = await fetchFullRecord('forum', post.id);
      if (full) targetPost = full;
    }
    setEditingPost(targetPost);
    setTitle(targetPost.title);
    setContent(targetPost.content || '');
    setCategory(targetPost.category || 'académico');
    setShowForm(true);
  };

  const handleDeletePost = async (id) => {
    if (window.confirm(language === 'es' ? '¿Eliminar esta publicación?' : 'Delete this post?')) {
      removeOptimistic('forum', id);
      try {
        await api.delete(`/data/forum/${id}`);
        showToast(language === 'es' ? 'Publicación eliminada' : 'Post deleted');
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

    // Salto Optimista: Actualizamos el contador/estado de inmediato en la UI global
    updateOptimistic('forum', item.id, { [fieldToAdd]: newAddList, [fieldToRemove]: newRemoveList });

    try {
      await api.put(`/data/forum/${item.id}`, { [fieldToAdd]: newAddList, [fieldToRemove]: newRemoveList });
    } catch (e) { 
      console.error(e); 
    }
  };

  const handleRead = async (id) => {
    try {
      const post = forum.find(p => p.id === id);
      const currentReadBy = post?.read_by || [];
      if (!currentReadBy.includes(profile.id)) {
        const newReadBy = [...currentReadBy, profile.id];
        updateOptimistic('forum', id, { read_by: newReadBy });
        await api.put(`/data/forum/${id}`, { read_by: newReadBy });
      }
    } catch (e) { console.error(e); }
  };

  const toggleExpand = async (id) => {
    const post = forum.find(p => p.id === id);
    if (post && !post.content && fetchFullRecord) {
      await fetchFullRecord('forum', id);
    }
    setExpandedPosts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredPosts = forum.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (post.author_name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || post.category === filterCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="glass-card p-6 md:p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <MessageSquare className="text-purple-600" size={32} />
            {language === 'es' ? 'Foro de la Comunidad' : 'Community Forum'}
          </h1>
          <p className="text-gray-500 font-medium text-sm md:text-base mt-2">{language === 'es' ? 'Discusiones académicas y proyectos estudiantiles.' : 'Academic discussions and student projects.'}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center justify-center gap-3 w-full md:w-auto bg-purple-600 text-white px-6 py-4 rounded-2xl hover:bg-purple-700 transition-all hover-spring shadow-lg shadow-purple-500/30 font-bold focus-visible:ring-inset"
          >
            <Plus size={22} /> {language === 'es' ? 'Nueva Publicación' : 'New Post'}
          </button>
        )}
      </div>

      {!showForm && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
             <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-500 transition-colors" size={20} />
             <input
               type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
               placeholder={language === 'es' ? "Buscar por título o autor..." : "Search by title or author..."}
               className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-purple-500 transition-all shadow-sm font-medium placeholder-gray-400"
             />
          </div>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(CATEGORIES).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setFilterCategory(key)}
                className={`px-5 py-3 rounded-2xl text-sm font-black transition-all border shadow-sm focus-visible:ring-inset hover-spring ${filterCategory === key ? 'ring-2 ring-offset-1 ring-purple-500 ' + val.color : val.color + ' opacity-60 hover:opacity-100'}`}
              >
                {language === 'es' ? val.es : val.en}
              </button>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="glass-card p-6 md:p-10 rounded-[2.5rem] shadow-xl border border-purple-100 dark:border-slate-700/50 animate-scale-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
          <button onClick={() => { setShowForm(false); setEditingPost(null); }} className="absolute top-6 right-6 p-3 bg-white dark:bg-slate-800 rounded-2xl text-gray-500 hover:text-red-500 hover:bg-red-50 transition-all shadow-sm focus-visible:ring-inset"><X size={24}/></button>

          <form onSubmit={handleSavePost} className="space-y-8 mt-4">
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                <MessageSquare className="text-purple-500" />
                {editingPost ? (language === 'es' ? 'Editar Publicación' : 'Edit Post') : (language === 'es' ? 'Crear Nueva Publicación' : 'Create New Post')}
              </h2>
              <p className="text-sm text-gray-500 mt-2 font-medium">{language === 'es' ? 'Tu publicación será visible para toda la clase.' : 'Your post will be visible to the whole class.'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label htmlFor="forumTitle" className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-3">{language === 'es' ? 'Título' : 'Title'}</label>
                <input
                  id="forumTitle"
                  name="forumTitle"
                  required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'es' ? "¿Sobre qué quieres hablar?" : "What do you want to talk about?"}
                  className="w-full px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-100 dark:border-slate-700 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all shadow-inner font-bold text-lg"
                />
              </div>
              <div>
                <label htmlFor="forumCategory" className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-3">{language === 'es' ? 'Categoría' : 'Category'}</label>
                <select
                  id="forumCategory"
                  name="forumCategory"
                  value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full px-6 py-4 bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-100 dark:border-slate-700 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all shadow-inner font-bold"
                >
                  <option value="académico">{language === 'es' ? 'Académico' : 'Academic'}</option>
                  <option value="proyecto">{language === 'es' ? 'Proyecto Estudiantil' : 'Student Project'}</option>
                  <option value="duda">{language === 'es' ? 'Duda / Consulta' : 'Question'}</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label htmlFor="forumContent" className="block text-sm font-black text-gray-500 uppercase tracking-widest mb-3">{language === 'es' ? 'Contenido Detallado' : 'Detailed Content'}</label>
                <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-100 dark:border-slate-700 overflow-hidden shadow-inner">
                  <ReactQuill
                    id="forumContent"
                    theme="snow" value={content} onChange={setContent}
                    className="min-h-[220px] bg-white dark:bg-slate-900"
                    placeholder={language === 'es' ? "Escribe tu publicación aquí..." : "Write your post here..."}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4 border-t dark:border-slate-700/50">
              <button type="button" onClick={() => { setShowForm(false); setEditingPost(null); }} className="px-8 py-4 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-50 border border-gray-200 dark:border-slate-700 transition-all shadow-sm w-full sm:w-auto uppercase tracking-wider text-sm">
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-3 px-10 py-4 bg-purple-600 text-white rounded-2xl font-black text-lg hover:bg-purple-700 transition-all shadow-xl hover-spring disabled:opacity-70 w-full sm:w-auto uppercase tracking-wide">
                {isSubmitting ? (language === 'es' ? 'Publicando...' : 'Posting...') : (editingPost ? (language === 'es' ? 'Guardar' : 'Save') : (language === 'es' ? 'Publicar en el Foro' : 'Post to Forum'))}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-5">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-32 bg-gray-50/50 dark:bg-slate-900/20 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-slate-700">
             <MessageSquare size={64} className="mx-auto text-gray-300 dark:text-slate-600 mb-6" />
             <p className="text-xl font-bold text-gray-500 dark:text-slate-400">{language === 'es' ? 'No hay publicaciones que coincidan.' : 'No posts match your search.'}</p>
          </div>
        ) : (
          filteredPosts.map(post => {
            const isUnread = !post.read_by?.includes(profile.id);
            const isExpanded = expandedPosts[post.id];
            const catInfo = CATEGORIES[post.category] || CATEGORIES.académico;
            return (
              <div key={post.id} className={`glass-card p-6 md:p-8 rounded-[2.5rem] shadow-sm border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden group ${isUnread ? 'border-purple-200 dark:border-purple-800/60' : 'border-gray-100 dark:border-slate-700/50'}`}>
                <div className={`absolute top-0 left-0 w-1.5 h-full transition-all group-hover:w-2.5 ${isUnread ? 'bg-gradient-to-b from-purple-500 to-indigo-600' : 'bg-gray-200 dark:bg-slate-700'}`}></div>
                
                <div className="pl-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-5">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className={`px-3 py-1.5 text-xs font-black uppercase rounded-xl flex items-center gap-2 border shadow-sm ${catInfo.color}`}>
                          <Tag size={12} /> {language === 'es' ? catInfo.es : catInfo.en}
                        </span>
                        <h3 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 flex-wrap">
                           {post.title}
                           {isUnread && <span className="bg-red-500 text-white text-xs px-3 py-1 rounded-full animate-pulse font-black uppercase tracking-widest">{language === 'es' ? 'NUEVO' : 'NEW'}</span>}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm"><User size={13} /> {post.author_name}</span>
                        <span className="flex items-center gap-1.5 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm"><Calendar size={13} /> {new Date(post.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium' })}</span>
                        {new Date(post.updated_at) > new Date(post.created_at) && (
                           <span className="italic text-purple-500 font-medium">{language === 'es' ? `Modificado: ${new Date(post.updated_at).toLocaleDateString()}` : `Modified: ${new Date(post.updated_at).toLocaleDateString()}`}</span>
                        )}
                      </div>
                    </div>
                    {(profile.id === post.author_id || profile.role === 'profesor') && (
                      <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                        {profile.id === post.author_id && (
                          <button onClick={() => startEditing(post)} className="p-3 text-gray-500 hover:text-purple-600 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-purple-200 transition-all focus-visible:ring-inset" aria-label="Edit"><Edit2 size={18}/></button>
                        )}
                        <button onClick={() => handleDeletePost(post.id)} className="p-3 text-gray-500 hover:text-red-500 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-red-200 transition-all focus-visible:ring-inset" aria-label="Delete"><Trash2 size={18}/></button>
                      </div>
                    )}
                  </div>

                  <div className={`relative overflow-hidden transition-all duration-500 ${isExpanded ? '' : 'max-h-36'}`}>
                    <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 text-base leading-relaxed ql-editor !p-0 !h-auto overflow-visible" dangerouslySetInnerHTML={{ __html: post.content }} />
                    {!isExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none"></div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-gray-100 dark:border-slate-700/50 pt-5 mt-5">
                    <div className="flex items-center gap-3 flex-wrap">
                       <button onClick={() => handleLike(post, true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all shadow-sm border hover-spring focus-visible:ring-inset ${post.likes?.includes(profile.id) ? 'bg-purple-600 text-white border-purple-700 shadow-purple-500/20' : 'text-gray-500 hover:text-purple-600 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-purple-300'}`}>
                         <ThumbsUp size={16} /> {post.likes?.length || 0}
                       </button>
                       <button onClick={() => handleLike(post, false)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all shadow-sm border hover-spring focus-visible:ring-inset ${post.dislikes?.includes(profile.id) ? 'bg-red-500 text-white border-red-600 shadow-red-500/20' : 'text-gray-500 hover:text-red-500 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-red-300'}`}>
                         <ThumbsDown size={16} /> {post.dislikes?.length || 0}
                       </button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {isUnread && (
                        <button onClick={() => handleRead(post.id)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-black text-gray-500 hover:text-purple-600 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:border-purple-300 transition-all focus-visible:ring-inset shadow-sm">
                          <CheckCircle size={16} className="shrink-0" /> {language === 'es' ? 'Marcar leído' : 'Mark read'}
                        </button>
                      )}
                      <button onClick={() => { toggleExpand(post.id); if (isUnread) handleRead(post.id); }} className="flex items-center gap-2 px-5 py-2.5 text-sm font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-900/40 rounded-xl hover:bg-purple-100 transition-all focus-visible:ring-inset hover-spring shadow-sm">
                        {isExpanded ? <><ChevronUp size={16}/> {language === 'es' ? 'Mostrar menos' : 'Show less'}</> : <><ChevronDown size={16}/> {language === 'es' ? 'Leer completo' : 'Read more'}</>}
                      </button>
                    </div>
                  </div>
                  <CommentsSection parentId={post.id} parentType="forum" profile={profile} comments={comments} showToast={showToast} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
