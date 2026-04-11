import React, { useState } from 'react';
import { 
  MessageSquare, Plus, Search, X, Tag, User, Calendar, 
  Edit2, Trash2, ThumbsUp, ThumbsDown, CheckCircle, 
  ChevronUp, ChevronDown, Filter, Clock, Eye, Send, 
  MessageCircle, Hash, AlertTriangle, Shield, Flag, BookOpen, Cpu
} from 'lucide-react';
import api from '../config/api';
import CommentsSection from '../components/CommentsSection';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useSettings } from '../hooks/SettingsContext';

const CATEGORIES = {
  all:       { es: 'Global', en: 'Global',       color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700', icon: <Hash size={16}/> },
  académico: { es: 'Académico', en: 'Academic', color: 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800', icon: <BookOpen size={16}/> },
  proyecto:  { es: 'Proyectos', en: 'Projects',  color: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', icon: <Cpu size={16}/> },
  duda:      { es: 'Consultas', en: 'Support',   color: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', icon: <AlertTriangle size={16}/> },
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
        setShowForm(false);
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
    const currentAddList = Array.isArray(item[fieldToAdd]) ? item[fieldToAdd] : [];
    const currentRemoveList = Array.isArray(item[fieldToRemove]) ? item[fieldToRemove] : [];
    
    const isActive = currentAddList.includes(profile.id);
    let newAddList = isActive 
      ? currentAddList.filter(id => id !== profile.id)
      : [...currentAddList, profile.id];
    let newRemoveList = currentRemoveList.filter(id => id !== profile.id);

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
      const currentReadBy = Array.isArray(post?.read_by) ? post.read_by : [];
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
    <div className="space-y-8 animate-fade-in pb-12">
      {/* HEADER SECTION */}
      <div className="aura-card p-0 overflow-hidden shadow-2xl">
        <div className="aura-gradient-primary px-10 py-12 text-white flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="space-y-4 text-center md:text-left">
            <h1 className="text-5xl font-black uppercase tracking-tighter flex items-center justify-center md:justify-start gap-4">
              <MessageSquare className="text-white" size={56} /> 
              {language === 'es' ? 'Nexo de Discusión' : 'Discussion Nexus'}
            </h1>
            <p className="text-white/60 font-black text-xs uppercase tracking-[0.3em]">{language === 'es' ? 'Inteligencia Colectiva y Colaboración' : 'Collective Intelligence & Collaboration'}</p>
          </div>
          
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="group flex items-center justify-center gap-6 px-10 py-6 bg-white text-indigo-600 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-3xl hover:scale-105 active:scale-95 transition-all"
            >
              <Plus size={24} className="group-hover:rotate-90 transition-transform"/> 
              {language === 'es' ? 'Transmitir' : 'Broadcast'}
            </button>
          )}
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="aura-card p-4 rounded-[2.5rem] flex flex-col lg:flex-row gap-6 items-center shadow-xl border-none">
        <div className="relative flex-1 group w-full">
           <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={24} />
           <input
             id="forumSearch"
             name="forumSearch"
             type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
             placeholder={language === 'es' ? "Escanear por título o remitente..." : "Scan by title or sender..."}
             className="w-full pl-16 pr-8 py-5 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 rounded-[1.8rem] outline-none transition-all shadow-inner font-black placeholder:text-slate-300"
           />
        </div>
        <div className="flex gap-3 flex-wrap justify-center overflow-x-auto pb-2 lg:pb-0 w-full lg:w-auto">
          {Object.entries(CATEGORIES).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setFilterCategory(key)}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 shadow-sm active:scale-95 ${filterCategory === key ? 'aura-gradient-primary text-white border-transparent shadow-indigo-500/30' : val.color + ' opacity-50 hover:opacity-100 hover:scale-105'}`}
            >
              {val.icon}
              {language === 'es' ? val.es : val.en}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="aura-card p-0 border-none shadow-2xl animate-scale-in relative overflow-hidden">
          <div className="aura-gradient-primary px-8 py-6 flex justify-between items-center text-white">
            <h2 className="text-xl font-black uppercase tracking-widest flex items-center gap-4">
              <Plus size={24} />
              {editingPost ? (language === 'es' ? 'Modificar Transmisión' : 'Modify Broadcast') : (language === 'es' ? 'Nueva Transmisión' : 'New Broadcast')}
            </h2>
            <button onClick={() => { setShowForm(false); setEditingPost(null); }} className="p-3 bg-white/20 hover:bg-white/40 rounded-2xl transition-all shadow-lg"><X size={24}/></button>
          </div>

          <form onSubmit={handleSavePost} className="p-10 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2">
                <label htmlFor="forumTitle" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{language === 'es' ? 'Asunto del Nexo' : 'Nexus Subject'}</label>
                <input
                  id="forumTitle"
                  name="forumTitle"
                  required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder={language === 'es' ? "Define el núcleo de la discusión..." : "Define the discussion core..."}
                  className="w-full px-8 py-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all shadow-inner font-black text-xl placeholder:text-slate-300"
                />
              </div>
              <div>
                <label htmlFor="forumCategory" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{language === 'es' ? 'Fila de Datos' : 'Data Row'}</label>
                <select
                  id="forumCategory"
                  name="forumCategory"
                  value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-transparent focus:border-indigo-500 outline-none transition-all shadow-inner font-black"
                >
                  <option value="académico">{language === 'es' ? 'Académico' : 'Academic'}</option>
                  <option value="proyecto">{language === 'es' ? 'Proyecto' : 'Project'}</option>
                  <option value="duda">{language === 'es' ? 'Consultas' : 'Support'}</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label htmlFor="forumContent" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{language === 'es' ? 'Codificación de Mensaje' : 'Message Encoding'}</label>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-transparent focus-within:border-indigo-500 overflow-hidden shadow-inner transition-all">
                  <ReactQuill
                    id="forumContent"
                    theme="snow" value={content} onChange={setContent}
                    className="min-h-[250px] aura-quill"
                    placeholder={language === 'es' ? "Distribuye tu conocimiento aquí..." : "Distribute your knowledge here..."}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-6 pt-6 ">
              <button type="button" onClick={() => { setShowForm(false); setEditingPost(null); }} className="px-10 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all w-full sm:w-auto">
                {language === 'es' ? 'Abortar' : 'Abort'}
              </button>
              <button type="submit" disabled={isSubmitting} className="aura-gradient-primary text-white px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all w-full sm:w-auto">
                {isSubmitting ? (language === 'es' ? 'Transmitiendo...' : 'Broadcasting...') : (editingPost ? (language === 'es' ? 'Sincronizar' : 'Sync') : (language === 'es' ? 'Iniciar Transmisión' : 'Start Broadcast'))}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8">
        {filteredPosts.length === 0 ? (
          <div className="aura-card py-40 text-center shadow-none border-2 border-dashed border-slate-200 dark:border-slate-800">
             <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
               <MessageSquare size={40} className="text-slate-300 dark:text-slate-700" />
             </div>
             <p className="text-xl font-black text-slate-400 uppercase tracking-widest">{language === 'es' ? 'Sin señales de nexo' : 'No nexus signals'}</p>
          </div>
        ) : (
          filteredPosts.map(post => {
            const isUnread = !(Array.isArray(post.read_by) ? post.read_by : []).includes(profile.id);
            const isExpanded = expandedPosts[post.id];
            const catInfo = CATEGORIES[post.category] || CATEGORIES.académico;
            return (
              <div key={post.id} className={`aura-card p-0 overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 group ${isUnread ? 'ring-2 ring-indigo-500' : ''}`}>
                <div className="p-8 md:p-10">
                  <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 border-2 ${catInfo.color}`}>
                          {catInfo.icon} {language === 'es' ? catInfo.es : catInfo.en}
                        </span>
                        {isUnread && <span className="aura-gradient-primary text-white text-[9px] px-4 py-1.5 rounded-full animate-pulse font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/30">{language === 'es' ? 'Prioritario' : 'Priority'}</span>}
                      </div>
                      
                      <h3 className="text-3xl font-black text-slate-900 dark:text-white leading-tight tracking-tighter group-hover:text-indigo-600 transition-colors">
                         {post.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
                        <span className="flex items-center gap-2 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors"><User size={16} className="text-indigo-500" /> {post.author_name}</span>
                        <span className="flex items-center gap-2"><Calendar size={16} className="text-slate-400" /> {new Date(post.created_at).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        {new Date(post.updated_at) > new Date(post.created_at) && (
                           <span className="text-indigo-400 font-black">{language === 'es' ? '[Dato Actualizado]' : '[Data Updated]'}</span>
                        )}
                      </div>
                    </div>

                    {(profile.id === post.author_id || profile.role === 'profesor') && (
                      <div className="flex gap-3 shrink-0">
                        {profile.id === post.author_id && (
                          <button onClick={(e) => { e.stopPropagation(); startEditing(post); }} className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-indigo-100 transition-all"><Edit2 size={20}/></button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl shadow-sm border-2 border-transparent hover:border-rose-100 transition-all"><Trash2 size={20}/></button>
                      </div>
                    )}
                  </div>

                  <div className={`relative overflow-hidden transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[2000px]' : 'max-h-[160px]'}`}>
                    <div className="prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400 text-lg leading-relaxed ql-editor !p-0" dangerouslySetInnerHTML={{ __html: post.content }} />
                    {!isExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-slate-800 via-white/80 dark:via-slate-800/80 to-transparent pointer-events-none"></div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-t-2 border-slate-50 dark:border-slate-800 pt-8 mt-8">
                    <div className="flex items-center gap-4">
                       <button onClick={() => handleLike(post, true)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border-2 active:scale-90 ${(Array.isArray(post.likes) ? post.likes : []).includes(profile.id) ? 'aura-gradient-primary text-white border-transparent' : 'text-slate-400 hover:text-indigo-600 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-indigo-100'}`}>
                         <ThumbsUp size={18} /> {Array.isArray(post.likes) ? post.likes.length : 0}
                       </button>
                       <button onClick={() => handleLike(post, false)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border-2 active:scale-90 ${(Array.isArray(post.dislikes) ? post.dislikes : []).includes(profile.id) ? 'bg-rose-600 text-white border-transparent' : 'text-slate-400 hover:text-rose-600 bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-rose-100'}`}>
                         <ThumbsDown size={18} /> {Array.isArray(post.dislikes) ? post.dislikes.length : 0}
                       </button>
                    </div>
                    
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      {isUnread && (
                        <button onClick={() => handleRead(post.id)} className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl hover:border-indigo-100 transition-all shadow-sm">
                           {language === 'es' ? 'Confirmar Lectura' : 'Confirm Read'}
                        </button>
                      )}
                      <button onClick={() => { toggleExpand(post.id); if (isUnread) handleRead(post.id); }} className="flex-1 sm:flex-none flex items-center justify-center gap-4 px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] aura-gradient-primary text-white rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">
                        {isExpanded ? <><ChevronUp size={20}/> {language === 'es' ? 'Colapsar' : 'Collapse'}</> : <><ChevronDown size={20}/> {language === 'es' ? 'Descifrar' : 'Decrypt'}</>}
                      </button>
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="bg-slate-50/50 dark:bg-slate-900/30 p-8 md:p-10 border-t-2 border-slate-100 dark:border-slate-800 animate-fade-in">
                    <CommentsSection parentId={post.id} parentType="forum" profile={profile} comments={comments} showToast={showToast} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
