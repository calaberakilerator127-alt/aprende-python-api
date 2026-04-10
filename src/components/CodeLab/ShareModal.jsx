import React, { useState } from 'react';
import { Share2, Copy, MessageSquare, X, CheckCircle } from 'lucide-react';
import api from '../../config/api';

/**
 * ShareModal: Permite compartir códigos o notas en el foro.
 * Migrado de Firebase a Supabase.
 */
export default function ShareModal({ isOpen, onClose, item, type, profile, showToast }) {
  const [isCopied, setIsCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  if (!isOpen || !item) return null;

  const handleCopyToClipboard = () => {
     let textToShare = '';
     if (type === 'code') {
         textToShare = `¡Mira mi código Python '${item.name || item.title}'!\n\n${item.code || item.content}`;
     } else {
         const tempDiv = document.createElement("div");
         tempDiv.innerHTML = item.content;
         const plainText = tempDiv.textContent || tempDiv.innerText || "";
         textToShare = `¡Lee mi apunte '${item.title || item.name}'!\n\n${plainText}`;
     }
     navigator.clipboard.writeText(textToShare);
     setIsCopied(true);
     showToast("Copiado al portapapeles correctamente", "success");
     setTimeout(() => setIsCopied(false), 2000);
  };

  const handlePublishToForum = async () => {
       setIsPublishing(true);
       try {
           let postContent = '';
           if (type === 'code') {
               const codeToEscape = item.code || item.content;
               const escapedCode = codeToEscape.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
               postContent = `<p>He compartido un fragmento de código desde CodeLab:</p><br/><pre style="background:#0f172a; color:#f8fafc; padding:15px; border-radius:10px; overflow-x:auto; font-family: monospace;"><code>${escapedCode}</code></pre>`;
           } else {
               postContent = `<p>He compartido un apunte desde CodeLab:</p><br/>` + item.content;
           }

           await api.post('/data/forum', {
               title: `Compartido desde CodeLab: ${item.title || item.name}`,
               content: postContent,
               category: 'proyecto',
               author_id: profile.id,
               author_name: profile.name,
               likes: [],
               dislikes: [],
               read_by: []
           });

           showToast("¡Publicado en el foro de la comunidad con éxito!", "success");
           onClose();
       } catch (e) {
           console.error(e);
           showToast("Hubo un error al publicar en el foro", "error");
       } finally {
           setIsPublishing(false);
       }
  };

  return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-700 animate-scale-in" onClick={e => e.stopPropagation()}>
              
              <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/50">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                      <Share2 className="text-indigo-500" /> Compartir {type === 'code' ? 'Código' : 'Apunte'}
                  </h3>
                  <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition"><X size={20}/></button>
              </div>

              <div className="p-8 space-y-6">
                  <div className="text-center">
                     <p className="text-gray-500 dark:text-slate-400 font-medium mb-1">Has seleccionado:</p>
                     <p className="text-lg font-bold text-gray-900 dark:text-gray-100 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl inline-block border border-indigo-100 dark:border-indigo-800/30">
                        {item.title || item.name}
                     </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                     <button 
                        onClick={handleCopyToClipboard}
                        className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${isCopied ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-gray-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:shadow-md'}`}
                     >
                        <div className={`p-3 rounded-xl ${isCopied ? 'bg-green-100 dark:bg-green-800/40 text-green-600' : 'bg-gray-100 dark:bg-slate-700 text-gray-500'}`}>
                           {isCopied ? <CheckCircle size={24} /> : <Copy size={24} />}
                        </div>
                        <div className="text-left">
                           <p className="font-bold">{isCopied ? '¡Copiado!' : 'Copiar Texto'}</p>
                           <p className="text-xs opacity-70">Llévalo a Whatsapp, Discord, etc.</p>
                        </div>
                     </button>

                     <button 
                        onClick={handlePublishToForum}
                        disabled={isPublishing}
                        className="flex items-center gap-4 p-4 rounded-2xl border-2 border-purple-100 dark:border-purple-900/30 bg-purple-50 dark:bg-purple-900/10 hover:border-purple-300 dark:hover:border-purple-500 transition-all text-purple-900 dark:text-purple-100 hover:shadow-md text-left"
                     >
                        <div className="p-3 rounded-xl bg-purple-200 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300">
                           <MessageSquare size={24} />
                        </div>
                        <div className="flex-1">
                           <p className="font-bold">{isPublishing ? 'Publicando...' : 'Publicar en el Foro'}</p>
                           <p className="text-xs opacity-70 border-purple-200">Toda la clase podrá verlo y comentarlo.</p>
                        </div>
                     </button>
                  </div>
              </div>
          </div>
      </div>
  );
}
