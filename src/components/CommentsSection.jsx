import React, { useState } from 'react';
import { Clock, Edit2, Trash2, ThumbsUp, ThumbsDown, MessageCircle, Send, Check, CornerDownRight } from 'lucide-react';
import api from '../config/api';
import { useSettings } from '../hooks/SettingsContext';

export default function CommentsSection({ parentId, parentType, profile, comments, showToast }) {
  const { language } = useSettings();
  const [newComment, setNewComment] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Labels localizados
  const t = {
    title: language === 'es' ? 'Comentarios' : 'Comments',
    placeholder: language === 'es' ? 'Escribe un comentario...' : 'Write a comment...',
    replyPlaceholder: (name) => language === 'es' ? `Responder a ${name}...` : `Reply to ${name}...`,
    empty: language === 'es' ? 'Sé el primero en comentar.' : 'Be the first to comment.',
    edit: language === 'es' ? 'Editar' : 'Edit',
    delete: language === 'es' ? 'Eliminar' : 'Delete',
    reply: language === 'es' ? 'Responder' : 'Reply',
    update: language === 'es' ? 'Actualizar' : 'Update',
    cancel: language === 'es' ? 'Cancelar' : 'Cancel',
    edited: language === 'es' ? '(Editado)' : '(Edited)',
    confirmDelete: language === 'es' ? '¿Seguro que quieres eliminar este comentario?' : 'Are you sure you want to delete this comment?',
    errorComment: language === 'es' ? 'Error al comentar' : 'Error commenting',
    errorReply: language === 'es' ? 'Error al responder' : 'Error replying',
    errorEdit: language === 'es' ? 'Error al editar' : 'Error editing',
    errorDelete: language === 'es' ? 'Error al eliminar' : 'Error deleting'
  };

  const rootComments = comments
    .filter(c => c.parent_id === parentId && c.parent_type === parentType && !c.reply_to_id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const getReplies = (commentId) => {
    return comments
      .filter(c => c.reply_to_id === commentId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    const nowISO = new Date().toISOString();
    const tempId = `temp-${Date.now()}`;
    const commentData = {
      id: tempId,
      parent_id: parentId, 
      parent_type: parentType, 
      content: newComment,
      author_id: profile.id, 
      author_name: profile.name,
      created_at: nowISO, 
      likes: [], 
      dislikes: [], 
      reply_to_id: null,
      is_optimistic: true
    };

    // UI Optimista
    if (comments && Array.isArray(comments)) {
      // Nota: Aquí dependemos de que el padre maneje el estado de 'comments'
      // Si no podemos inyectar optimismo directamente, al menos limpiamos el input rápido
    }

    setIsSubmitting(true);
    try {
      setNewComment(''); // Limpiar input de inmediato para Ultra Speed
      await api.post('/data/comments', {
        parent_id: parentId, 
        parent_type: parentType, 
        content: newComment,
        author_id: profile.id, 
        author_name: profile.name,
        created_at: nowISO, 
        likes: [], 
        dislikes: [], 
        reply_to_id: null
      });
    } catch (e) { 
      console.error(e); 
      setNewComment(newComment); // Restaurar si falla
      showToast(t.errorComment, 'error'); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleAddReply = async (e, commentId) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post('/data/comments', {
        parent_id: parentId, 
        parent_type: parentType, 
        content: replyText,
        author_id: profile.id, 
        author_name: profile.name,
        created_at: new Date().toISOString(), 
        likes: [], 
        dislikes: [], 
        reply_to_id: commentId
      });
      setReplyingTo(null);
      setReplyText('');
    } catch (e) { console.error(e); showToast(t.errorReply, 'error'); } finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t.confirmDelete)) {
      try {
        await api.delete(`/data/comments/${id}`);
      } catch (e) { console.error(e); showToast(t.errorDelete, 'error'); }
    }
  };

  const startEditing = (c) => {
    setEditingId(c.id);
    setEditText(c.content);
  };

  const handleEdit = async (id) => {
    if (!editText.trim()) return;
    try {
      await api.put(`/data/comments/${id}`, { 
        content: editText, 
        updated_at: new Date().toISOString() 
      });
      setEditingId(null);
      setEditText('');
    } catch (e) { console.error(e); showToast(t.errorEdit, 'error'); }
  };

  const handleLike = async (c, isLike) => {
    const fieldToAdd = isLike ? 'likes' : 'dislikes';
    const fieldToRemove = isLike ? 'dislikes' : 'likes';
    const currentAddList = Array.isArray(c[fieldToAdd]) ? c[fieldToAdd] : [];
    const currentRemoveList = Array.isArray(c[fieldToRemove]) ? c[fieldToRemove] : [];
    
    const isActive = currentAddList.includes(profile.id);
    let newAddList = isActive 
      ? currentAddList.filter(id => id !== profile.id)
      : [...currentAddList, profile.id];
    let newRemoveList = currentRemoveList.filter(id => id !== profile.id);

    try {
      await api.put(`/data/comments/${c.id}`, { 
        [fieldToAdd]: newAddList, 
        [fieldToRemove]: newRemoveList 
      });
    } catch (e) { console.error(e); }
  };

  const renderComment = (c, isReply = false) => {
    const canModify = c.author_id === profile.id || profile.role === 'profesor';

    return (
      <div key={c.id} className={`flex gap-4 mt-6 animate-fade-in ${isReply ? 'ml-12 border-l-2 border-indigo-50 dark:border-indigo-900/40 pl-6' : ''}`}>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-black shadow-sm ring-2 ring-white dark:ring-slate-800 transition-transform hover:scale-110 ${isReply ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'}`}>
           {(c.author_name || "?").charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-1 space-y-3">
          <div className={`p-5 rounded-[1.5rem] rounded-tl-none shadow-sm relative group bg-white dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/50 ${isReply ? 'border-purple-100 dark:border-purple-900/20' : ''}`}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <span className="font-black text-sm text-gray-900 dark:text-gray-100">{c.author_name}</span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                   <Clock size={10} /> {new Date(c.created_at).toLocaleDateString(language==='es'?'es-ES':'en-US', { day: 'numeric', month: 'short' })}
                </span>
                {c.updated_at && (new Date(c.updated_at) > new Date(c.created_at)) && <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 rounded-full">{t.edited}</span>}
              </div>
              
              {canModify && (
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEditing(c)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition" title={t.edit}><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition" title={t.delete}><Trash2 size={14} /></button>
                </div>
              )}
            </div>

            {editingId === c.id ? (
              <div className="space-y-4 py-2 animate-scale-in">
                <textarea 
                  value={editText} 
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-4 py-3 text-sm border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl dark:bg-slate-900 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium min-h-[100px] resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-3">
                   <button onClick={() => setEditingId(null)} className="px-5 py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600">{t.cancel}</button>
                   <button onClick={() => handleEdit(c.id)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2"><Check size={14}/> {t.update}</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-medium">{c.content}</p>
            )}
          </div>
          
          <div className="flex items-center gap-6 px-4">
             <div className="flex items-center gap-3">
               <button onClick={() => handleLike(c, true)} className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all p-1.5 rounded-xl hover-spring ${(Array.isArray(c.likes) ? c.likes : []).includes(profile.id) ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40' : 'text-gray-400 hover:text-indigo-500'}`}>
                  <ThumbsUp size={14} /> {Array.isArray(c.likes) ? c.likes.length : 0}
               </button>
               <button onClick={() => handleLike(c, false)} className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all p-1.5 rounded-xl hover-spring ${(Array.isArray(c.dislikes) ? c.dislikes : []).includes(profile.id) ? 'text-red-600 bg-red-50 dark:bg-red-900/40' : 'text-gray-400 hover:text-red-500'}`}>
                  <ThumbsDown size={14} /> {Array.isArray(c.dislikes) ? c.dislikes.length : 0}
               </button>
             </div>
             {!isReply && (
               <button onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)} className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition-all hover-spring ${replyingTo === c.id ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-gray-400 hover:text-purple-500 bg-gray-50 dark:bg-slate-800'}`}>
                  <MessageCircle size={14} /> {t.reply}
               </button>
             )}
          </div>
          
          {replyingTo === c.id && (
            <form onSubmit={(e) => handleAddReply(e, c.id)} className="mt-4 flex gap-3 animate-scale-in relative pl-4">
               <div className="absolute left-[-20px] top-4 text-purple-400"><CornerDownRight size={24} /></div>
               <div className="flex-1 relative group">
                  <input 
                    value={replyText} onChange={e => setReplyText(e.target.value)} 
                    placeholder={t.replyPlaceholder(c.author_name)}
                    className="w-full pl-6 pr-14 py-4 border-2 border-transparent bg-white dark:bg-slate-800 rounded-2xl outline-none focus:border-purple-500/50 shadow-sm focus:shadow-xl focus:shadow-purple-500/5 transition-all text-sm font-bold"
                    autoFocus
                  />
                  <button type="submit" disabled={isSubmitting} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50">
                    <Send size={18} />
                  </button>
               </div>
            </form>
          )}

          <div className="space-y-2">
            {getReplies(c.id).map(r => renderComment(r, true))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-10 pt-10 border-t-2 border-gray-50 dark:border-slate-800/50">
       <div className="flex items-center justify-between mb-8">
          <h4 className="font-black text-base flex items-center gap-3 text-gray-900 dark:text-gray-100 uppercase tracking-tighter">
             <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600"><MessageCircle size={18} /></div>
             {t.title} <span className="text-gray-400 ml-1">({comments.filter(c => c.parent_id === parentId).length})</span>
          </h4>
       </div>
       
       <form onSubmit={handleAddComment} className="flex gap-4 mb-10 group/form">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 font-black text-xl uppercase ring-4 ring-indigo-50 dark:ring-indigo-900/20 group-focus-within/form:scale-110 transition-transform">
            {(profile.name || "?").charAt(0)}
          </div>
          <div className="flex-1 relative">
            <input 
              value={newComment} onChange={e => setNewComment(e.target.value)} 
              placeholder={t.placeholder}
              className="w-full pl-6 pr-16 py-4 border-2 border-transparent bg-white dark:bg-slate-800 rounded-2xl outline-none focus:border-indigo-500/50 shadow-sm focus:shadow-2xl focus:shadow-indigo-500/5 text-base font-black transition-all placeholder-gray-300"
            />
            <button type="submit" disabled={isSubmitting} className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50">
               <Send size={22} />
            </button>
          </div>
       </form>

       <div className="space-y-6">
         {rootComments.length === 0 ? (
           <div className="py-20 text-center bg-gray-50/50 dark:bg-slate-900/20 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-slate-800/50">
              <MessageCircle size={48} className="mx-auto text-gray-200 dark:text-slate-700 mb-4" />
              <p className="text-xs font-black uppercase tracking-[0.25em] text-gray-400">{t.empty}</p>
           </div>
         ) : (
           rootComments.map(c => renderComment(c, false))
         )}
       </div>
    </div>
  );
}
