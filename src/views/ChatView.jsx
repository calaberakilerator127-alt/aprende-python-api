import React, { useState, useRef, useEffect } from 'react';
import { Send, Users, User, MessageCircle, ArrowLeft, Loader2, Plus, Paperclip, X, Trash2, Image as ImageIcon, Shield, Pin, MoreVertical, Phone, Video, Edit3, ExternalLink, History, Search, Clock, ShieldAlert, FileText, Info, Trash, Settings, UserPlus, UserMinus, PinOff } from 'lucide-react';
import { useChat, useGroups, useUserActions, useTyping, useGlobalTyping } from '../hooks/useChat';
import { supabase } from '../config/supabase';
import { uploadFileWithProgress } from '../utils/fileUpload';
import { useSettings } from '../hooks/SettingsContext';
// Eliminado isUserOnline y formatLastSeen por falta de uso


export default function ChatView({ profile, users, createNotification, onOpenCall, callLogs = [], onOpenProfile, showToast, globalMessages }) {
  const { language } = useSettings();
  const [activeChat, setActiveChat] = useState({ id: 'general', name: language === 'es' ? 'Chat General' : 'General Chat', type: 'general' });
  const [mobileView, setMobileView] = useState('list'); // 'list' o 'chat'
  
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [ephemeralDuration, setEphemeralDuration] = useState(24 * 60 * 60 * 1000); // 24h default
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  // viewingMedia eliminado por falta de uso

  const { messages, sendMessage, deleteMessage, updateMessage, togglePinMessage, loadingChat } = useChat(profile.id, activeChat.id);
  const { groups, createGroup, deleteGroup, updateGroup } = useGroups(profile.id);
  const { toggleBlockUser, togglePinChat } = useUserActions(profile.id);
  const { typingUsers, setTyping } = useTyping(activeChat.id, profile.id, profile.name);
  const globalTypingMap = useGlobalTyping();

  const [showUserInfo, setShowUserInfo] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editText, setEditText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [showCallLogs, setShowCallLogs] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const [activePrivateChats, setActivePrivateChats] = useState(() => {
    const saved = localStorage.getItem(`aprende_python_chats_${profile.id}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [inputText, setInputText] = useState('');
  const [fileAttached, setFileAttached] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef(null);

  // Modal States
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);

  useEffect(() => {
    localStorage.setItem(`aprende_python_chats_${profile.id}`, JSON.stringify(activePrivateChats));
  }, [activePrivateChats, profile.id]);

  useEffect(() => {
    if (activeChat?.id) {
       const lastRead = JSON.parse(localStorage.getItem('lastReadAt') || '{}');
       lastRead[activeChat.id] = Date.now();
       localStorage.setItem('lastReadAt', JSON.stringify(lastRead));
    }
  }, [activeChat, globalMessages]);

  const getUnreadCount = (chatId) => {
    if (!globalMessages) return 0;
    const lastRead = JSON.parse(localStorage.getItem('lastReadAt') || '{}');
    const lastReadTime = lastRead[chatId] || 0;
    return globalMessages.filter(m => (m.chat_id === chatId || m.chatId === chatId) && (m.sender_id !== profile.id && m.senderId !== profile.id) && (new Date(m.created_at || m.createdAt).getTime()) > lastReadTime).length;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!showCallLogs) scrollToBottom();
  }, [messages, activeChat, showCallLogs]);

  const pinnedMessage = (messages || []).find(m => m.isPinned);

  const filteredMessages = (messages || []).filter(m => {
     if (profile.blockedUsers?.includes(m.sender_id || m.senderId)) return false;
     const lastCleared = JSON.parse(localStorage.getItem(`clearedAt_${profile.id}`) || '{}');
     const clearedAt = lastCleared[activeChat.id] || 0;
     const mTime = new Date(m.created_at || m.createdAt).getTime();
     return mTime > clearedAt;
  });

  const handleVaciarChat = async (permanent = false) => {
    try {
      if (permanent && profile.role === 'profesor') {
         // Borrar mensajes permanentemente en DB
         const { error } = await supabase
           .from('messages')
           .delete()
           .eq('chat_id', activeChat.id);
         
         if (error) throw error;
      }

      const lastCleared = JSON.parse(localStorage.getItem(`clearedAt_${profile.id}`) || '{}');
      lastCleared[activeChat.id] = Date.now();
      localStorage.setItem(`clearedAt_${profile.id}`, JSON.stringify(lastCleared));
      
      setShowOptions(false);
      setConfirmClear(false);
    } catch (e) {
      console.error("Error vaciando chat:", e);
    }
  };

  const handleStartCall = async (type = 'video') => {
    try {
      const roomName = `AprendePython-${profile.id.substring(0,8)}-${activeChat.id}`;
      const meetUrl = `https://meet.jit.si/${roomName}`;
      
      const participants = activeChat.type === 'private' 
        ? [profile.id, activeChat.otherUserId] 
        : (activeChat.members && activeChat.members.length > 0 ? activeChat.members : ['all']);
        
      const { data: eventData, error: eventErr } = await supabase
        .from('events')
        .insert({
           title: language === 'es' ? `Llamada rápida: ${activeChat.name}` : `Quick call: ${activeChat.name}`,
           date: new Date().toISOString(),
           start_date: new Date().toISOString(),
           link: meetUrl,
           assigned_to: participants,
           type: 'meeting',
           author_id: profile.id,
           status: 'en_curso'
        })
        .select()
        .single();

      if (eventErr) throw eventErr;

      // Registrar en Call Logs
      await supabase.from('call_logs').insert({
         caller_id: profile.id,
         caller_name: profile.name,
         receiver_id: activeChat.type === 'private' ? activeChat.otherUserId : null,
         receiver_name: activeChat.name,
         chat_id: activeChat.id,
         created_at: Date.now(),
         type: type,
         meet_url: meetUrl,
         participants: participants,
         event_id: eventData.id
      });

      // Enviar mensaje especial de llamada
      await sendMessage(
        language === 'es' ? `📞 Llamada de ${type === 'video' ? 'video' : 'voz'} iniciada` : `📞 ${type === 'video' ? 'Video' : 'Voice'} call started`, 
        profile.name, 
        activeChat.type === 'private' ? activeChat.otherUserId : null, 
        { type: 'call', url: meetUrl, startedAt: Date.now(), eventId: eventData.id }
      );
      
      if (activeChat.type === 'private' && createNotification) {
         createNotification(language === 'es' ? `📞 ${profile.name} te está llamando...` : `📞 ${profile.name} is calling you...`, [activeChat.otherUserId], 'chat', activeChat.id);
      } else if (activeChat.type !== 'private' && createNotification) {
         const notifyIds = activeChat.type === 'group' ? activeChat.members.filter(m => m !== profile.id) : null;
         createNotification(language === 'es' ? `📞 Llamada iniciada en ${activeChat.name}` : `📞 Call started in ${activeChat.name}`, notifyIds, 'chat', activeChat.id);
      }

      if (onOpenCall) {
         onOpenCall({ roomName, url: meetUrl, msgId: null, eventId: eventData.id });
      } else {
         window.open(meetUrl, '_blank');
      }
    } catch (err) {
      console.error("Error starting call:", err);
    }
  };

  const handleEndCall = async (msgId, eventId) => {
     const now = Date.now();
     await supabase.from('messages').update({ 'attached_file.endedAt': now }).eq('id', msgId);
     if (eventId) {
        await supabase.from('events').update({ end_date: new Date().toISOString() }).eq('id', eventId);
     }
  };

  const handleDeleteCallLog = async (logId) => {
    if (!window.confirm(language === 'es' ? '¿Borrar este registro?' : 'Delete this record?')) return;
    const log = myCallLogs.find(l => l.id === logId);
    try {
      if (log?.event_id) {
        await supabase.from('events').delete().eq('id', log.event_id);
      }
      const { error } = await supabase.from('call_logs').delete().eq('id', logId);
      if (error) throw error;
      showToast?.(language === 'es' ? 'Registro eliminado' : 'Record deleted');
    } catch (e) { 
      console.error(e);
      showToast?.(language === 'es' ? 'Error al eliminar' : 'Delete error', 'error');
    }
  };

  const handleClearCallHistory = async () => {
    if (!window.confirm(language === 'es' ? '¿Vaciar historial por completo? Esto también lo eliminará del calendario.' : 'Clear history completely? This will also remove it from the calendar.')) return;
    try {
      for (const log of myCallLogs) {
        if (log.event_id) {
          await supabase.from('events').delete().eq('id', log.event_id);
        }
        await supabase.from('call_logs').delete().eq('id', log.id);
      }
    } catch (e) {
      console.error("Error al vaciar historial:", e);
    }
  };

  const myCallLogs = callLogs.filter(log => 
    log.caller_id === profile.id || log.receiver_id === profile.id || log.participants?.includes(profile.id)
  ).sort((a,b) => b.created_at - a.created_at);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !fileAttached) || isUploading) return;
    setIsUploading(true);
    let uploadedFile = null;
    try {
      if (fileAttached) {
        setUploadProgress(0);
        uploadedFile = await uploadFileWithProgress(fileAttached, 'chat_uploads', (p) => setUploadProgress(p));
      }
      
      const options = {
        isEphemeral,
        duration: ephemeralDuration
      };

      await sendMessage(inputText, profile.name, activeChat.type === 'private' ? activeChat.otherUserId : null, uploadedFile, options);
      
      if (activeChat.type === 'private' && createNotification) {
         createNotification(language === 'es' ? `Nuevo mensaje de ${profile.name}` : `New message from ${profile.name}`, [activeChat.otherUserId], 'chat', activeChat.id);
      } else if (activeChat.type === 'group' && createNotification) {
         const others = activeChat.members?.filter(m => m !== profile.id);
         if (others?.length > 0) {
            createNotification(language === 'es' ? `Mensaje en grupo: ${activeChat.name}` : `Group message: ${activeChat.name}`, others, 'chat', activeChat.id);
         }
      }
      setInputText('');
      setFileAttached(null);
      setTyping(false);
    } catch (err) { console.error(err); } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSendMessage(e);
    } else {
      setTyping(true);
      // Optional: debouncing/timeout for setTyping(false) is handled by useTyping hook's timeout
    }
  };

  const startPrivateChat = (otherUser) => {
    const sortedIds = [profile.id, otherUser.id].sort();
    const chatId = `private_${sortedIds[0]}_${sortedIds[1]}`;
    const newChatRaw = { id: chatId, name: otherUser.name, type: 'private', otherUserId: otherUser.id };
    if (!activePrivateChats.find(c => c.otherUserId === otherUser.id)) {
       setActivePrivateChats(prev => [...prev, newChatRaw]);
    }
    setActiveChat(newChatRaw);
    setMobileView('chat');
    setShowNewChatModal(false);
    setShowCallLogs(false);
  };

  const removePrivateChat = (e, targetUserId) => {
    e.stopPropagation();
    setActivePrivateChats(prev => prev.filter(c => c.otherUserId !== targetUserId));
    if (activeChat.otherUserId === targetUserId) {
        setActiveChat({ id: 'general', name: language === 'es' ? 'Chat General' : 'General Chat', type: 'general' });
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim() || groupMembers.length === 0) return;
    const res = await createGroup(newGroupName, groupMembers);
    if (res) {
       setActiveChat({...res, members: [...groupMembers, profile.id], createdBy: profile.id, permissions: { canSendMessages: 'all', allowFiles: true, allowEditInfo: true, allowInvite: true }});
       setMobileView('chat');
       setShowNewGroupModal(false);
       setNewGroupName('');
       setGroupMembers([]);
       setShowCallLogs(false);
    }
  };

  const currentChatGroup = groups.find(g => g.id === activeChat.id);
  const isOwner = currentChatGroup?.createdBy === profile.id || profile.role === 'profesor';
  
  const canSendMessages = () => {
    if (activeChat.type !== 'group' || !currentChatGroup) return true;
    const p = currentChatGroup.permissions?.canSendMessages || 'all';
    if (p === 'owner') return isOwner;
    if (p === 'selected') return currentChatGroup.members?.includes(profile.id); // Defaulting to all members if selected for now
    return true;
  };

  const sharedMedia = messages.filter(m => m.attachedFile && m.attachedFile.type !== 'call');

  // Sorting Sidebar
  const sortedPinnedChats = (chats) => {
    return chats.sort((a, b) => {
      const aPinned = profile.pinnedChats?.includes(a.id);
      const bPinned = profile.pinnedChats?.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return (b.lastMessageAt || 0) - (a.lastMessageAt || 0);
    });
  };

  return (
    <div className="flex h-[calc(100vh-140px)] glass-card rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-slate-700/50 overflow-hidden animate-fade-in relative">
      
      {/* Sidebar de Chats */}
      <div className={`w-full md:w-80 lg:w-96 border-r dark:border-slate-700/50 flex flex-col bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl shrink-0 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b dark:border-slate-700/50 flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              <MessageCircle className="text-indigo-600" size={24} />
              {language === 'es' ? 'Mensajes' : 'Messages'}
            </h2>
            <div className="flex gap-1">
               <button onClick={() => { setShowCallLogs(!showCallLogs); if (!showCallLogs) setMobileView('chat'); }} className={`p-2 rounded-xl transition-all hover-spring ${showCallLogs ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`} title={language === 'es' ? "Historial" : "History"}>
                  <History size={18} />
               </button>
               <button onClick={() => setShowNewGroupModal(true)} className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 rounded-xl transition-all hover-spring" title={language === 'es' ? "Grupo" : "Group"}>
                  <Users size={18} />
               </button>
               <button onClick={() => setShowNewChatModal(true)} className="p-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all hover-spring shadow-lg shadow-indigo-500/20" title={language === 'es' ? "Nuevo" : "New"}>
                  <Plus size={18} />
               </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <button 
            onClick={() => { setActiveChat({ id: 'general', name: language === 'es' ? 'Chat General' : 'General Chat', type: 'general' }); setShowCallLogs(false); setMobileView('chat'); }}
            className={`w-full text-left px-5 py-4 rounded-3xl flex items-center gap-4 transition-all ${activeChat.id === 'general' && !showCallLogs ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 -translate-y-1' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
          >
            <div className={`p-3 rounded-2xl ${activeChat.id === 'general' && !showCallLogs ? 'bg-white/20' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'}`}><Users size={22} /></div>
            <div className="flex-1 overflow-hidden">
               <div className="flex justify-between items-center">
                 <p className="font-black text-sm">{language === 'es' ? 'Chat General' : 'General Chat'}</p>
                 {profile.pinnedChats?.includes('general') && <Pin size={12} className="text-indigo-200" />}
               </div>
               <p className={`text-[10px] truncate ${activeChat.id === 'general' ? 'text-indigo-100' : 'text-gray-400 font-medium'}`}>
                 {language === 'es' ? 'Toda la clase' : 'Entire class'}
               </p>
            </div>
            {getUnreadCount('general') > 0 && (
               <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full border-2 border-white dark:border-slate-800 shadow-sm animate-bounce">{getUnreadCount('general')}</span>
            )}
          </button>

          {groups.length > 0 && (
             <>
               <div className="mt-8 mb-3 px-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Mis Grupos' : 'My Groups'}</div>
               {sortedPinnedChats(groups).map(group => (
                 <button 
                   key={group.id}
                   onClick={() => { setActiveChat({...group, type: 'group'}); setShowCallLogs(false); setMobileView('chat'); }}
                   className={`w-full text-left px-5 py-4 rounded-3xl flex items-center gap-4 transition-all ${activeChat.id === group.id && !showCallLogs ? 'bg-purple-600 text-white shadow-xl shadow-purple-500/30 -translate-y-1' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
                 >
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 ${activeChat.id === group.id ? 'bg-white/20' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-black uppercase text-sm'}`}>
                      {group.imageUrl ? <img src={group.imageUrl} alt="" className="w-full h-full object-cover" /> : <Shield size={22} />}
                   </div>
                   <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center gap-2">
                        <p className="font-black text-sm truncate">{group.name}</p>
                        {profile.pinnedChats?.includes(group.id) && <Pin size={12} className="text-purple-100 shrink-0" />}
                      </div>
                      {globalTypingMap[group.id]?.length > 0 ? (
                         <p className="text-[10px] font-black text-purple-200 animate-pulse tracking-widest uppercase">{language === 'es' ? 'Escribiendo...' : 'Typing...'}</p>
                      ) : (
                         <p className={`text-[10px] truncate ${activeChat.id === group.id ? 'text-purple-100' : 'text-gray-400 font-medium'}`}>
                           {group.lastMessage || `${group.members.length} ${language === 'es' ? 'miembros' : 'members'}`}
                         </p>
                      )}
                   </div>
                   {getUnreadCount(group.id) > 0 && (
                       <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full border-2 border-white dark:border-slate-800 shadow-sm animate-bounce">{getUnreadCount(group.id)}</span>
                    )}
                 </button>
               ))}
             </>
          )}

          <div className="mt-8 mb-3 px-2 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Directos' : 'Direct Messages'}</div>
          {activePrivateChats.length === 0 && <p className="px-5 py-8 text-center text-xs text-gray-400 font-medium italic select-none">{language === 'es' ? 'No hay chats activos.' : 'No active chats.'}</p>}
          
          {sortedPinnedChats(activePrivateChats).filter(chat => users.some(u => u.id === chat.otherUserId)).map(chat => (
            <div key={chat.id} className="relative group">
               <button 
                 onClick={() => { setActiveChat(chat); setShowCallLogs(false); setMobileView('chat'); }}
                 className={`w-full text-left px-5 py-4 rounded-3xl flex items-center gap-4 transition-all ${activeChat.otherUserId === chat.otherUserId && !showCallLogs ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 -translate-y-1' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'}`}
               >
                 <div className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-black text-sm relative ${activeChat.otherUserId === chat.otherUserId ? 'bg-white/20 border-white/20 text-white' : 'bg-gray-100 dark:bg-slate-700 border-gray-100 dark:border-slate-600 text-gray-500'}`}>
                   {chat.name.charAt(0)}
                   {(() => {
                     const otherUser = users.find(u => u.id === chat.otherUserId);
                     const isOnline = otherUser?.status === 'online';
                     return (
                       <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 ${isOnline ? 'bg-green-500' : 'bg-gray-400'} rounded-full border-2 ${activeChat.otherUserId === chat.otherUserId ? 'border-indigo-600' : 'border-white dark:border-slate-800 shadow-sm'}`}></div>
                     );
                   })()}
                 </div>
                 <div className="flex-1 overflow-hidden pr-6">
                    <div className="flex justify-between items-center gap-2">
                       <p className="font-black text-sm truncate">{chat.name}</p>
                       {profile.pinnedChats?.includes(chat.id) && <Pin size={12} className="text-indigo-200 shrink-0" />}
                    </div>
                    {globalTypingMap[chat.id]?.length > 0 ? (
                       <p className="text-[10px] font-black text-indigo-200 animate-pulse tracking-widest uppercase">{language === 'es' ? 'Escribiendo...' : 'Typing...'}</p>
                    ) : (
                       <p className={`text-[10px] truncate ${activeChat.otherUserId === chat.otherUserId ? 'text-indigo-100' : 'text-gray-400 font-medium'}`}>
                         {chat.lastMessage || (language === 'es' ? 'Sin mensajes' : 'No messages')}
                       </p>
                    )}
                 </div>
                 {getUnreadCount(chat.id) > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full border-2 border-white dark:border-slate-800 shadow-sm animate-bounce">{getUnreadCount(chat.id)}</span>
                 )}
               </button>
               <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                  <button 
                    onClick={(e) => { e.stopPropagation(); togglePinChat(chat.id, profile.pinnedChats); }}
                    className={`p-2 rounded-xl border dark:border-slate-600 transition-all ${profile.pinnedChats?.includes(chat.id) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-400 hover:text-indigo-500'}`}
                  >
                    {profile.pinnedChats?.includes(chat.id) ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button 
                    onClick={(e) => removePrivateChat(e, chat.otherUserId)}
                    className="p-2 bg-white dark:bg-slate-700 rounded-xl text-gray-400 hover:text-red-500 border dark:border-slate-600"
                  >
                    <X size={14} />
                  </button>
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* Área del Chat / Registro de Llamadas */}
      <div className={`flex-1 flex flex-col bg-white/30 dark:bg-slate-900/10 backdrop-blur-sm ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
        
        {showCallLogs ? (
          /* Registro de Llamadas Premium */
          <div className="flex flex-col h-full animate-fade-in">
             <div className="p-6 md:p-8 border-b dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                   <button onClick={() => setShowCallLogs(false)} className="p-3 bg-gray-50 dark:bg-slate-700 hover:bg-white rounded-2xl transition-all shadow-sm focus-visible:ring-inset"><ArrowLeft size={24}/></button>
                   <div>
                      <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{language === 'es' ? 'Historial de Llamadas' : 'Call History'}</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{myCallLogs.length} {language === 'es' ? 'registros encontrados' : 'records found'}</p>
                   </div>
                </div>
                <button onClick={handleClearCallHistory} className="px-5 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-600 hover:text-white transition-all border border-red-100 dark:border-red-900/30">{language === 'es' ? 'Vaciar' : 'Clear'}</button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-4 custom-scrollbar">
                {myCallLogs.length === 0 ? (
                   <div className="flex flex-col items-center justify-center h-full opacity-30 text-gray-400 space-y-4">
                      <History size={64} />
                      <p className="text-sm font-black uppercase tracking-[0.25em]">{language === 'es' ? 'Historial vacío' : 'History empty'}</p>
                   </div>
                ) : (
                   myCallLogs.map(log => {
                      const isCaller = log.callerId === profile.id;
                      return (
                         <div key={log.id} className="glass-card p-5 md:p-6 rounded-[2rem] border border-gray-100 dark:border-slate-700 hover:shadow-xl transition-all duration-300 flex items-center justify-between group bg-white/50 dark:bg-slate-800/40">
                            <div className="flex items-center gap-5">
                               <div className={`p-4 rounded-[1.25rem] shadow-sm transform transition-transform group-hover:rotate-12 ${log.type === 'video' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'}`}>
                                  {log.type === 'video' ? <Video size={24}/> : <Phone size={24}/>}
                               </div>
                               <div>
                                  <p className="font-black text-lg text-gray-800 dark:text-gray-100 leading-tight">{isCaller ? `${language === 'es' ? 'A' : 'To'}: ${log.receiverName}` : `${language === 'es' ? 'De' : 'From'}: ${log.callerName}`}</p>
                                  <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">{new Date(log.timestamp).toLocaleString(language === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                               </div>
                            </div>
                            <div className="flex items-center gap-4">
                               <a href={log.meetUrl} target="_blank" rel="noreferrer" className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all hover-spring">{language === 'es' ? 'Reunirme' : 'Join'}</a>
                               <button onClick={() => handleDeleteCallLog(log.id)} className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all opacity-0 group-hover:opacity-100" title={language === 'es' ? 'Borrar' : 'Delete'}><Trash2 size={18}/></button>
                            </div>
                         </div>
                      );
                   })
                )}
             </div>
          </div>
        ) : (
          /* Mensajería Premium */
          <>
            <div className="p-4 md:p-8 border-b dark:border-slate-700/50 flex items-center justify-between bg-white/60 dark:bg-slate-800/60 backdrop-blur-md shrink-0 z-40">
                <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                  <button 
                    onClick={() => setMobileView('list')} 
                    className="md:hidden p-3 bg-indigo-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all active:scale-90 shadow-sm border border-indigo-100 dark:border-slate-600 z-[60] shrink-0"
                    aria-label="Volver a la lista"
                  >
                    <ArrowLeft size={24}/>
                  </button>
                  <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                     <div onClick={() => activeChat.type === 'group' && setShowGroupInfo(true)} className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xl shadow-inner uppercase shrink-0 overflow-hidden ${activeChat.type === 'group' ? 'cursor-pointer hover:ring-4 ring-indigo-500/20 transition-all' : ''}`}>
                        {activeChat.type === 'group' && currentChatGroup?.imageUrl ? (
                           <img src={currentChatGroup.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                           activeChat.name.charAt(0)
                        )}
                     </div>
                     <div className="overflow-hidden">
                         <h3 onClick={() => activeChat.type === 'group' && setShowGroupInfo(true)} className={`text-lg md:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 tracking-tighter truncate ${activeChat.type === 'group' ? 'cursor-pointer hover:text-indigo-600 transition-colors' : ''}`}>
                            {activeChat.name}
                            {activeChat.type === 'group' && <span className="text-[9px] font-black bg-purple-100 text-purple-600 px-3 py-1 rounded-full uppercase tracking-widest shadow-sm hidden sm:inline-block">GROUP</span>}
                         </h3>
                         {typingUsers.length > 0 ? (
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2 mt-1 animate-pulse">
                               <span className="flex gap-0.5">
                                  <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce"></span>
                                  <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                  <span className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                               </span>
                               {typingUsers.length === 1 ? (language === 'es' ? `${typingUsers[0].userName} está escribiendo...` : `${typingUsers[0].userName} is typing...`) : (language === 'es' ? 'Varios están escribiendo...' : 'Several are typing...')}
                            </p>
                         ) : (
                            <p className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em] flex items-center gap-2 mt-0.5 md:mt-1">
                               <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span> 
                               {(() => {
                                  const isPrivate = activeChat.type === 'private';
                                  const otherUser = isPrivate ? users.find(u => u.id === activeChat.otherUserId) : null;
                                  const isOnline = !isPrivate || otherUser?.status === 'online';
                                  return isPrivate ? (
                                    isOnline ? (language === 'es' ? 'En línea' : 'Online') : (
                                      otherUser?.lastSeen 
                                        ? `${language === 'es' ? 'Últ. vez:' : 'Last seen:'} ${new Date(otherUser.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                        : (language === 'es' ? 'Desconectado' : 'Offline')
                                    )
                                  ) : (language === 'es' ? 'Sesión en vivo' : 'Live session');
                                })()}
                            </p>
                         )}
                       </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 md:gap-3">
                  {activeChat.type === 'group' && (
                    <button onClick={() => setShowGroupInfo(true)} className="p-2.5 md:p-3.5 text-gray-500 hover:text-indigo-600 bg-white/50 dark:bg-slate-800/50 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-indigo-200 focus-visible:ring-inset" title={language === 'es' ? "Info del Grupo" : "Group Info"}>
                      <Info size={20}/>
                    </button>
                  )}
                  <button onClick={() => handleStartCall('video')} className="p-2.5 md:p-3.5 text-gray-500 hover:text-blue-500 bg-white/50 dark:bg-slate-800/50 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-blue-200 focus-visible:ring-inset" title={language === 'es' ? "Videollamada" : "Video Call"}><Video size={20}/></button>
                  <button onClick={() => handleStartCall('voice')} className="p-2.5 md:p-3.5 text-gray-500 hover:text-green-500 bg-white/50 dark:bg-slate-800/50 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-green-200 focus-visible:ring-inset" title={language === 'es' ? "Llamada" : "Voice Call"}><Phone size={20}/></button>
                  
                  <div className="relative group/opt">
                    <button onClick={() => setShowOptions(!showOptions)} className={`p-2.5 md:p-3.5 transition-all rounded-2xl border border-transparent focus-visible:ring-inset ${showOptions ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 bg-white/50 dark:bg-slate-800/50 hover:bg-white'}`}><MoreVertical size={20}/></button>
                    {showOptions && (
                      <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-[0_32px_120px_-20px_rgba(0,0,0,0.5)] border border-gray-100 dark:border-slate-700 z-[100] animate-scale-in p-4 overflow-hidden backdrop-blur-xl">
                        {!confirmClear ? (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setConfirmClear(true); }} 
                              className="w-full text-left px-5 py-4 text-sm font-black text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all flex items-center justify-between group/item"
                            >
                               <span className="flex items-center gap-3"><Trash2 size={18} className="text-gray-400 group-hover/item:text-red-500" /> {language === 'es' ? 'Vaciar Chat' : 'Clear Chat'}</span>
                               <ArrowLeft size={16} className="rotate-180 opacity-0 group-hover/item:opacity-100" />
                            </button>
                            {activeChat.type === 'private' && (
                              <button onClick={(e) => { e.stopPropagation(); toggleBlockUser(activeChat.otherUserId, profile.blockedUsers?.includes(activeChat.otherUserId)); setShowOptions(false); }} className="w-full text-left px-5 py-4 text-sm font-black text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all flex items-center gap-3">
                                 <Shield size={18} /> {profile.blockedUsers?.includes(activeChat.otherUserId) ? (language === 'es' ? 'Desbloquear' : 'Unblock') : (language === 'es' ? 'Bloquear' : 'Block')}
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="p-2 space-y-4 animate-fade-in">
                             <div className="text-center space-y-2">
                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">{language === 'es' ? '¿Estás seguro?' : 'Are you sure?'}</p>
                                <p className="text-[10px] text-gray-400 leading-tight">{language === 'es' ? 'Esta acción ocultará los mensajes para ti.' : 'This will hide messages for you.'}</p>
                             </div>
                             <div className="flex flex-col gap-2">
                                <button onClick={(e) => { e.stopPropagation(); handleVaciarChat(false); }} className="w-full py-3 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/20">{language === 'es' ? 'Sí, Vaciar' : 'Yes, Clear'}</button>
                                {profile.role === 'profesor' && (
                                   <button onClick={(e) => { e.stopPropagation(); handleVaciarChat(true); }} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">{language === 'es' ? 'Borrar para TODOS' : 'Delete for ALL'}</button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); setConfirmClear(false); }} className="w-full py-3 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all">{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                             </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
            </div>

            {/* Pinned Message */}
            {pinnedMessage && (
               <div className="bg-indigo-600/10 dark:bg-indigo-900/30 p-4 px-8 border-b border-indigo-500/20 flex items-center justify-between animate-fade-in group/pin backdrop-blur-sm z-10 shrink-0">
                  <div className="flex items-center gap-4 overflow-hidden">
                     <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg rotate-12 group-hover:rotate-0 transition-transform">
                        <Pin size={16} />
                     </div>
                     <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest mb-0.5">{language === 'es' ? 'Mensaje Fijado' : 'Pinned Message'}</p>
                        <p className="text-sm text-indigo-600 dark:text-indigo-300 truncate font-medium">{pinnedMessage.text}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 pl-4">
                     <button onClick={() => document.getElementById(`msg-${pinnedMessage.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline px-4 py-2 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-xl shadow-sm transition-all active:scale-95 uppercase tracking-widest">{language === 'es' ? 'Ir al mensaje' : 'View'}</button>
                     {profile.role === 'profesor' && <button onClick={() => togglePinMessage(pinnedMessage.id, true)} className="p-2.5 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-xl border-2 border-transparent hover:border-red-100 transition-all active:scale-90 shadow-sm"><X size={14}/></button>}
                  </div>
               </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar relative">
               {loadingChat ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
                     <Loader2 size={48} className="animate-spin text-indigo-600" />
                     <p className="text-xs font-black uppercase tracking-widest">{language === 'es' ? 'Cargando mensajes...' : 'Loading messages...'}</p>
                  </div>
               ) : filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-6 opacity-30 select-none">
                     <div className="w-24 h-24 bg-gray-100 dark:bg-slate-800 rounded-[2.5rem] flex items-center justify-center -rotate-6 transition-transform hover:rotate-0">
                        <MessageCircle size={48} className="text-gray-400" />
                     </div>
                     <div className="text-center">
                        <p className="text-base font-black uppercase tracking-[0.25em] text-gray-500">{language === 'es' ? 'Sin mensajes aún' : 'No messages yet'}</p>
                        <p className="text-xs font-bold text-gray-400 mt-2">{language === 'es' ? 'Sé el primero en saludar' : 'Be the first to say hi'}</p>
                     </div>
                  </div>
               ) : (
                  <>
                  {filteredMessages.map((msg, idx) => {
                    const msgSenderId = msg.sender_id || msg.senderId;
                    const isMe = msgSenderId === profile.id;
                    const prevMsgSenderId = idx > 0 ? (filteredMessages[idx - 1].sender_id || filteredMessages[idx - 1].senderId) : null;
                    const showAvatar = idx === 0 || prevMsgSenderId !== msgSenderId;
                    
                    return (
                      <React.Fragment key={msg.id}>
                        <div id={`msg-${msg.id}`} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} gap-1.5 animate-message-in group/msg relative`}>
                           {!isMe && showAvatar && (
                              <div className="flex items-center gap-2 mb-1 ml-1 scale-95 origin-left">
                                 <div 
                                   onClick={() => { setSelectedUserId(msgSenderId); setShowUserInfo(true); }}
                                   className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-black text-xs shadow-md uppercase cursor-pointer hover:scale-110 transition-transform"
                                 >
                                   {(msg.sender_name || msg.senderName)?.charAt(0)}
                                 </div>
                                 <span 
                                   onClick={() => { setSelectedUserId(msgSenderId); setShowUserInfo(true); }}
                                   className="text-[11px] font-black text-gray-500 uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                                 >
                                   {msg.senderName}
                                 </span>
                              </div>
                           )}
                           
                           <div className={`relative max-w-[85%] md:max-w-[70%] p-5 md:p-6 rounded-[2rem] shadow-sm transition-all duration-300 border ${
                             isMe 
                               ? 'bg-indigo-600 text-white rounded-tr-none border-indigo-500 shadow-indigo-500/10' 
                               : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-200 rounded-tl-none border-gray-100 dark:border-slate-700 shadow-gray-200/50'
                           } ${msg.is_optimistic ? 'opacity-70 animate-pulse' : ''}`}>
                             
                             {msg.attachedFile?.type === 'call' ? (
                                <div className="space-y-4 min-w-[200px] md:min-w-[280px]">
                                   <div className="flex items-center gap-4">
                                      <div className={`p-3 rounded-2xl ${isMe ? 'bg-white/20' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600'}`}>
                                         {msg.attachedFile.type === 'video' ? <Video size={24}/> : <Phone size={24}/>}
                                      </div>
                                      <div>
                                         <p className="font-black text-lg leading-tight uppercase tracking-tighter">{language === 'es' ? 'Sesión Iniciada' : 'Session Started'}</p>
                                         <p className={`text-[10px] font-bold uppercase tracking-widest ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>{new Date(msg.attachedFile.startedAt).toLocaleTimeString()}</p>
                                      </div>
                                   </div>
                                   {!msg.attachedFile.endedAt ? (
                                      <div className="flex flex-col gap-3">
                                         <a href={msg.attachedFile.url} target="_blank" rel="noreferrer" className={`w-full py-4 rounded-xl text-center text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3 ${isMe ? 'bg-white text-indigo-600 hover:bg-gray-100 shadow-white/10' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/20'}`}>
                                            <ExternalLink size={16}/> {language === 'es' ? 'Entrar ahora' : 'Join now'}
                                         </a>
                                         {isMe && <button onClick={() => handleEndCall(msg.id, msg.attachedFile.eventId)} className="w-full py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95 shadow-md shadow-red-500/20">{language === 'es' ? 'Finalizar Llamada' : 'End Call'}</button>}
                                      </div>
                                   ) : <div className="w-full py-3 px-6 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{language === 'es' ? 'Conversación finalizada' : 'Call ended'}</div>}
                                </div>
                             ) : (
                               <>
                                 {msg.attachedFile && (
                                   <div className="mb-3">
                                      {msg.attachedFile.type?.startsWith('image/') ? (
                                        <img src={msg.attachedFile.data} alt="Adjunto" className="max-w-full rounded-2xl max-h-[400px] object-contain cursor-pointer border-4 border-white/10 dark:border-slate-700/50 hover:opacity-90 transition shadow-xl" onClick={() => window.open(msg.attachedFile.data, '_blank')} /> 
                                      ) : (
                                        <div className={`p-4 rounded-2xl border-2 flex items-center gap-4 shadow-inner ${isMe ? 'bg-indigo-700/40 border-indigo-500/30' : 'bg-gray-100 dark:bg-slate-900/50 border-gray-200 dark:border-slate-700'}`}>
                                          <div className={`p-3 rounded-xl ${isMe ? 'bg-indigo-500' : 'bg-white dark:bg-slate-700 shadow-sm'}`}>
                                             <Paperclip size={20} className={isMe ? 'text-white' : 'text-indigo-600'} />
                                          </div>
                                          <div className="flex-1 overflow-hidden">
                                            <a href={msg.attachedFile.data} target="_blank" rel="noreferrer" className={`text-sm font-black hover:underline truncate block ${isMe ? 'text-white' : 'text-indigo-600 dark:text-indigo-400 uppercase tracking-wide'}`}>{msg.attachedFile.name}</a>
                                            <p className={`text-[10px] font-bold uppercase ${isMe ? 'text-indigo-200' : 'text-gray-400'}`}>FILE ATTACHMENT</p>
                                          </div>
                                        </div>
                                      )}
                                   </div>
                                 )}
                                 {editingMsgId === msg.id ? (
                                    <div className="space-y-4 min-w-[300px]">
                                       <textarea autoFocus value={editText} onChange={e=>setEditText(e.target.value)} className="w-full bg-indigo-700/50 dark:bg-slate-900 border-2 border-indigo-400 dark:border-indigo-900 rounded-2xl text-white text-base p-4 outline-none selection:bg-indigo-400/30 custom-scrollbar focus:ring-4 focus:ring-indigo-500/10" rows="4" />
                                       <div className="flex justify-end gap-3">
                                         <button onClick={() => setEditingMsgId(null)} className="px-5 py-2.5 rounded-xl border border-white/20 text-xs font-black uppercase tracking-widest hover:bg-white/10 transition">Cancel</button>
                                         <button onClick={() => { updateMessage(msg.id, editText); setEditingMsgId(null); }} className="px-6 py-2.5 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 shadow-xl transition active:scale-95">Save</button>
                                       </div>
                                    </div>
                                 ) : (
                                   <p className="text-base md:text-lg leading-relaxed font-medium break-words">
                                     {(msg.text || '').split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
                                       if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
                                       if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
                                       return <span key={i}>{part}</span>;
                                     })}
                                   </p>
                                 )}
                               </>
                             )}
                             <div className={`flex items-center justify-end gap-3 text-[10px] font-black uppercase tracking-widest mt-3 ${isMe ? 'text-indigo-200/60' : 'text-gray-400'}`}>
                                {msg.isEdited && <span className="flex items-center gap-1 italic"><Edit3 size={10}/> Edited</span>}
                                {new Date(msg.created_at || msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </div>

                             {/* Modern Actions Overlay - Responsive Positioning */}
                             <div className={`absolute ${isMe ? 'md:-left-12 right-0 md:right-auto -top-12 flex-row md:flex-col' : 'md:-right-12 left-0 md:left-auto -top-12 flex-row md:flex-col'} flex gap-2 opacity-0 group-hover/msg:opacity-100 transition-all duration-300 scale-90 group-hover/msg:scale-100 z-50 pointer-events-auto`}>
                               {isMe && Date.now() - new Date(msg.created_at || msg.createdAt).getTime() < 600000 && editingMsgId !== msg.id && (
                                 <>
                                   <button onClick={() => { setEditingMsgId(msg.id); setEditText(msg.text); }} className="p-2.5 bg-white dark:bg-slate-800 text-gray-500 hover:text-indigo-600 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 hover-spring focus-visible:ring-inset shadow-indigo-500/20" title="Edit"><Edit3 size={16} /></button>
                                   <button onClick={() => deleteMessage(msg.id)} className="p-2.5 bg-white dark:bg-slate-800 text-gray-500 hover:text-red-500 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 hover-spring focus-visible:ring-inset shadow-red-500/20" title="Delete"><Trash2 size={16} /></button>
                                 </>
                               )}
                               {profile.role === 'profesor' && (
                                 <button onClick={() => togglePinMessage(msg.id, msg.isPinned)} className={`p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 hover-spring focus-visible:ring-inset ${msg.isPinned ? 'text-indigo-600 ring-2 ring-indigo-500' : 'text-gray-500 hover:text-indigo-500'}`} title={msg.isPinned ? "Unpin" : "Pin"}><Pin size={16} /></button>
                               )}
                             </div>
                           </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  <div ref={messagesEndRef} />
                  </>
               )}
            </div>

            {/* Input Form Premium */}
            <div className="p-6 md:p-8 bg-white/60 dark:bg-slate-800/80 backdrop-blur-xl border-t dark:border-slate-700/50 relative shrink-0">
              {fileAttached && (
                <div className="absolute -top-16 left-6 right-6 px-5 py-3 bg-indigo-600 text-white rounded-[1.25rem] shadow-2xl flex items-center justify-between animate-scale-in z-30">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                      {fileAttached.type?.startsWith('image/') ? <ImageIcon size={18} /> : <Paperclip size={18} />}
                    </div>
                    <p className="truncate text-xs font-black uppercase tracking-widest">{fileAttached.name}</p>
                  </div>
                  <button onClick={() => setFileAttached(null)} className="p-1.5 bg-red-500 rounded-lg hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"><X size={16} /></button>
                </div>
              )}
              
              {isUploading && (
                <div className="absolute -top-1 left-0 right-0 px-6 z-40">
                  <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden shadow-inner">
                    <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 bg-[length:200%_auto] animate-gradient-x h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-4 items-center">
                <div className="flex gap-1">
                  <label htmlFor="chat-file-upload" className="cursor-pointer p-3.5 md:p-4 text-gray-500 hover:text-indigo-600 bg-gray-100 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-700 rounded-2xl transition-all shadow-sm border border-transparent hover:border-indigo-200 focus-visible:ring-inset hover-spring">
                    <input id="chat-file-upload" type="file" onChange={e => setFileAttached(e.target.files[0])} className="hidden" />
                    <Paperclip size={22} />
                  </label>
                </div>
                
                <div className="flex-1 relative group">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder={canSendMessages() ? (language === 'es' ? "Escribe un mensaje aquí..." : "Write a message here...") : (language === 'es' ? "Solo administradores pueden escribir" : "Only admins can write")}
                    className="w-full bg-gray-100 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500/50 dark:focus:border-indigo-500/30 rounded-[1.5rem] px-6 py-4 text-base md:text-lg font-medium outline-none transition-all shadow-inner placeholder-gray-400 group-focus-within:bg-white dark:group-focus-within:bg-slate-900 group-focus-within:shadow-xl group-focus-within:shadow-indigo-500/5 disabled:opacity-50"
                    disabled={isUploading || !canSendMessages()}
                  />
                  {!inputText && !fileAttached && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity pointer-events-none hidden sm:flex">
                      {isEphemeral && (
                        <select 
                          value={ephemeralDuration} 
                          onChange={(e) => setEphemeralDuration(Number(e.target.value))}
                          className="bg-indigo-600 text-white text-[10px] font-black py-1 px-2 rounded-lg outline-none pointer-events-auto shadow-lg animate-scale-in"
                        >
                          <option value={3600000}>1H</option>
                          <option value={43200000}>12H</option>
                          <option value={86400000}>24H</option>
                          <option value={604800000}>7D</option>
                        </select>
                      )}
                      <button onClick={(e) => { e.preventDefault(); setIsEphemeral(!isEphemeral); }} className={`p-1.5 rounded-lg transition-all pointer-events-auto ${isEphemeral ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 dark:bg-slate-700 text-gray-500'}`} title={language === 'es' ? "Mensaje Temporal" : "Temporary Message"}>
                        <Clock size={14} />
                      </button>
                      <code className="text-[10px] font-black bg-gray-200 dark:bg-slate-700 px-2 py-1 rounded-md">CMD + ENTER</code>
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={isUploading || (!inputText.trim() && !fileAttached)} 
                  className="bg-indigo-600 text-white p-4 md:p-5 rounded-[1.5rem] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/30 hover-spring disabled:opacity-50 disabled:grayscale flex items-center justify-center shrink-0 min-w-[56px] focus-visible:ring-inset active:scale-95"
                >
                  {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                </button>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Modals con Glassmorphism */}
      {(showNewChatModal || showNewGroupModal) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="glass-card bg-white/90 dark:bg-slate-800/90 rounded-[2.5rem] w-full max-w-lg shadow-[0_32px_120px_-20px_rgba(0,0,0,0.5)] p-10 relative overflow-hidden animate-scale-in border border-white/20">
            <button onClick={() => { setShowNewChatModal(false); setShowNewGroupModal(false); setNewGroupName(''); setGroupMembers([]); }} className="absolute top-8 right-8 p-3 bg-gray-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-2xl transition-all"><X size={24} /></button>
            
            <div className="mb-8">
              <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-2">{showNewChatModal ? (language === 'es' ? 'Mensaje Directo' : 'Direct Message') : (language === 'es' ? 'Nuevo Grupo' : 'New Group')}</h3>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{showNewChatModal ? (language === 'es' ? 'Busca un compañero para chatear' : 'Find a classmate to chat') : (language === 'es' ? 'Reúne a tu equipo de trabajo' : 'Bring your team together')}</p>
            </div>

            {showNewGroupModal && (
              <div className="mb-8 space-y-3">
                <label htmlFor="newGroupNameInput" className="block text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-2">{language === 'es' ? 'Nombre del Grupo' : 'Group Name'}</label>
                <input id="newGroupNameInput" type="text" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} className="w-full bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-700 rounded-2xl px-6 py-4 text-base font-black outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 placeholder-gray-300 transition-all shadow-inner" placeholder={language === 'es' ? "Ej. Proyecto Final Python" : "e.g. Final Python Project"} />
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] ml-2">{language === 'es' ? 'Seleccionar Estudiantes' : 'Select Classmates'}</label>
                {showNewGroupModal && <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-full">{groupMembers.length} {language === 'es' ? 'seleccionados' : 'selected'}</span>}
              </div>
              
              <div className="max-h-72 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                 {users.filter(u => u.id !== profile.id).map(u => (
                    <label key={u.id} className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all cursor-pointer group hover-spring ${groupMembers.includes(u.id) ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800' : 'bg-gray-50 dark:bg-slate-900/50 border-transparent hover:bg-white dark:hover:bg-slate-800'}`}>
                      {showNewGroupModal ? (
                         <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${groupMembers.includes(u.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
                           {groupMembers.includes(u.id) && <div className="w-2 h-2 bg-white rounded-full"></div>}
                           <input type="checkbox" checked={groupMembers.includes(u.id)} onChange={e => e.target.checked ? setGroupMembers([...groupMembers, u.id]) : setGroupMembers(groupMembers.filter(id => id !== u.id))} className="hidden" />
                         </div>
                      ) : null}
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg uppercase shadow-sm group-hover:scale-110 transition-transform">{u.name.charAt(0)}</div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-black text-base truncate text-gray-900 dark:text-gray-100">{u.name}</p>
                        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{u.role || 'Estudiante'}</p>
                      </div>
                      {showNewChatModal && (
                        <button onClick={() => startPrivateChat(u)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 hover-spring active:scale-95">{language === 'es' ? 'Iniciar' : 'Start'}</button>
                      )}
                    </label>
                 ))}
                 {users.length <= 1 && (
                   <div className="py-12 text-center opacity-40">
                      <Users size={48} className="mx-auto mb-4" />
                      <p className="text-xs font-black uppercase tracking-[0.2em]">{language === 'es' ? 'No hay compañeros en línea' : 'No classmates online'}</p>
                   </div>
                 )}
              </div>
            </div>

            {showNewGroupModal && (
              <button onClick={handleCreateGroup} disabled={!newGroupName.trim() || groupMembers.length === 0} className="w-full mt-10 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-5 rounded-2xl font-black text-lg uppercase tracking-widest hover:shadow-2xl hover:shadow-purple-500/40 transition-all hover-spring disabled:opacity-50 active:scale-95">
                {language === 'es' ? 'Crear Grupo de Trabajo' : 'Create Team Group'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Group Info Panel */}
      {showGroupInfo && currentChatGroup && (
        <GroupInfoPanel 
          group={currentChatGroup}
          isOwner={isOwner}
          users={users}
          profile={profile}
          language={language}
          sharedMedia={sharedMedia}
          onClose={() => setShowGroupInfo(false)}
          onUpdateGroup={updateGroup}
          onDeleteGroup={deleteGroup}
          onOpenMemberInfo={(id) => { setSelectedUserId(id); setShowUserInfo(true); }}
          onOpenProfile={onOpenProfile}
        />
      )}

      {showUserInfo && (
         <UserInfoPanel 
           user={users.find(u => u.id === selectedUserId)}
           onClose={() => setShowUserInfo(false)}
           onMessage={() => {
              const u = users.find(u => u.id === selectedUserId);
              if (u) {
                 startPrivateChat(u);
                 setShowUserInfo(false);
              }
           }}
           isBlocked={profile.blockedUsers?.includes(selectedUserId)}
           onToggleBlock={() => toggleBlockUser(selectedUserId, profile.blockedUsers?.includes(selectedUserId))}
           language={language}
           onOpenProfile={onOpenProfile}
         />
       )}
    </div>
  );
}

function UserInfoPanel({ user, onClose, onMessage, isBlocked, onToggleBlock, language, onOpenProfile }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white dark:bg-slate-800 shadow-2xl animate-fade-in-right flex flex-col border-l dark:border-slate-700" onClick={e => e.stopPropagation()}>
         {/* Header */}
         <div className="p-10 border-b dark:border-slate-700 relative shrink-0 bg-indigo-600 text-white overflow-hidden text-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>
            <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"><X size={20}/></button>
            
            <div className="flex flex-col items-center gap-4 relative z-10">
               <div className="w-28 h-28 rounded-[2.5rem] bg-white text-indigo-600 flex items-center justify-center font-black text-4xl shadow-2xl border-4 border-white/30 truncate">
                  {user.name.charAt(0)}
               </div>
               <div>
                  <h2 className="text-3xl font-black tracking-tighter">{user.name}</h2>
                  <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mt-1">{user.role === 'profesor' ? (language === 'es' ? 'Profesor' : 'Instructor') : (language === 'es' ? 'Alumno' : 'Student')}</p>
               </div>
            </div>
         </div>

         {/* Actions */}
         <div className="p-8 flex flex-col gap-4">
            <button 
              onClick={onMessage}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"
            >
               <MessageCircle size={20} />
               {language === 'es' ? 'Enviar Mensaje' : 'Send Message'}
            </button>
            
            <button 
              onClick={onToggleBlock}
              className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border ${isBlocked ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-200'}`}
            >
               <Shield size={20} />
               {isBlocked ? (language === 'es' ? 'Desbloquear Usuario' : 'Unblock User') : (language === 'es' ? 'Bloquear Usuario' : 'Block User')}
            </button>
         </div>

         <div className="px-8 flex-1 overflow-y-auto custom-scrollbar space-y-8">
            <section className="space-y-4">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Sobre el usuario' : 'About User'}</h4>
               <div className="p-6 bg-gray-50 dark:bg-slate-900/50 rounded-3xl border dark:border-slate-700">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300 italic">
                     {language === 'es' ? 'Este usuario es parte de la comunidad de Aprende Python.' : 'This user is part of the Aprende Python community.'}
                  </p>
               </div>
            </section>
            
            <section className="space-y-4">
               <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Perfil Completo' : 'Full Profile'}</h4>
               <button 
                 onClick={() => { onOpenProfile?.(user.id); onClose(); }}
                 className="w-full py-3 px-6 bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all"
               >
                  <ExternalLink size={14} />
                  {language === 'es' ? 'Ver Perfil Público' : 'View Public Profile'}
               </button>
            </section>
         </div>
      </div>
    </div>
  );
}

function GroupInfoPanel({ group, isOwner, users, onClose, onUpdateGroup, onDeleteGroup, profile, language, sharedMedia, onOpenMemberInfo }) {
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'settings', 'media'
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(group.name);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const groupMembers = users.filter(u => group.members?.includes(u.id));
  const availableUsers = users.filter(u => !group.members?.includes(u.id));
  
  const handleTogglePermission = (key, value) => {
    onUpdateGroup(group.id, {
      permissions: {
        ...group.permissions,
        [key]: value
      }
    });
  };

  const handleRemoveMember = (memberId) => {
    if (!window.confirm(language === 'es' ? '¿Quitar este miembro?' : 'Remove this member?')) return;
    onUpdateGroup(group.id, {
      members: group.members.filter(id => id !== memberId)
    });
  };

  const handleAddMember = (memberId) => {
    onUpdateGroup(group.id, {
      members: [...group.members, memberId]
    });
  };

  const handleUploadPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file || !isOwner) return;
    setIsUploadingPhoto(true);
    try {
      const url = await uploadFileWithProgress(file, 'group_avatars', () => {});
      onUpdateGroup(group.id, { imageUrl: url.data });
    } catch (err) { console.error(err); } 
    finally { setIsUploadingPhoto(false); }
  };

  const handleSaveName = () => {
    if (!tempName.trim()) return;
    onUpdateGroup(group.id, { name: tempName });
    setIsEditingName(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-end" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-white dark:bg-slate-800 shadow-2xl animate-fade-in-right flex flex-col border-l dark:border-slate-700" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-8 border-b dark:border-slate-700 relative shrink-0 bg-indigo-600 text-white overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>
           <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"><X size={20}/></button>
           
           <div className="flex flex-col items-center gap-4 relative z-10">
              <div className="w-24 h-24 rounded-[2rem] bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-4xl shadow-xl uppercase border-4 border-white/20 relative group/icon overflow-hidden">
                 {group.imageUrl ? (
                    <img src={group.imageUrl} alt={group.name} className="w-full h-full object-cover" />
                 ) : (
                    group.name.charAt(0)
                 )}
                 {isOwner && (
                    <label className="absolute inset-0 bg-black/40 opacity-0 group-hover/icon:opacity-100 flex items-center justify-center transition-all rounded-[2rem] cursor-pointer">
                       {isUploadingPhoto ? <Loader2 size={24} className="text-white animate-spin" /> : <ImageIcon size={24} className="text-white" />}
                       <input type="file" onChange={handleUploadPhoto} className="hidden" accept="image/*" disabled={isUploadingPhoto} />
                    </label>
                 )}
              </div>
              <div className="text-center w-full px-4">
                 {isEditingName ? (
                    <div className="flex flex-col gap-2 scale-in">
                       <input 
                         autoFocus
                         value={tempName}
                         onChange={e => setTempName(e.target.value)}
                         className="bg-white/20 border-2 border-white/30 rounded-xl px-4 py-2 text-center text-xl font-black outline-none focus:border-white w-full shadow-inner"
                       />
                       <div className="flex justify-center gap-2">
                          <button onClick={handleSaveName} className="px-4 py-1.5 bg-white text-indigo-600 rounded-lg text-xs font-black uppercase hover:bg-gray-100 shadow-lg">{language === 'es' ? 'Guardar' : 'Save'}</button>
                          <button onClick={() => { setIsEditingName(false); setTempName(group.name); }} className="px-4 py-1.5 bg-white/20 text-white rounded-lg text-xs font-black uppercase hover:bg-white/30">{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                       </div>
                    </div>
                 ) : (
                    <h2 onClick={() => isOwner && setIsEditingName(true)} className={`text-2xl font-black tracking-tighter ${isOwner ? 'cursor-pointer hover:underline' : ''}`}>{group.name}</h2>
                 )}
                 <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mt-1">{group.members?.length} {language === 'es' ? 'Integrantes' : 'Members'}</p>
              </div>
           </div>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-gray-50 dark:bg-slate-900 shrink-0">
           {[
             { id: 'members', label: language === 'es' ? 'Miembros' : 'Members', icon: Users },
             { id: 'media', label: language === 'es' ? 'Media' : 'Media', icon: ImageIcon },
             { id: 'settings', label: language === 'es' ? 'Ajustes' : 'Settings', icon: Settings }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
             >
               <tab.icon size={16} />
               <span className="hidden sm:inline">{tab.label}</span>
             </button>
           ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
           {activeTab === 'members' && (
              <div className="space-y-4">
                 <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Lista de Miembros' : 'Member List'}</h4>
                    {(isOwner || group.permissions?.allowInvite) && (
                       <button 
                         onClick={() => setShowAddMembers(!showAddMembers)}
                         className={`text-[10px] font-black flex items-center gap-1 hover:underline ${showAddMembers ? 'text-red-500' : 'text-indigo-600'}`}
                       >
                         {showAddMembers ? <X size={12}/> : <Plus size={12}/>} 
                         {showAddMembers ? (language === 'es' ? 'Cerrar' : 'Close') : (language === 'es' ? 'Invitar' : 'Invite')}
                       </button>
                    )}
                 </div>

                 {showAddMembers && (
                    <div className="bg-gray-50 dark:bg-slate-900/50 rounded-2xl p-4 mb-4 border-2 border-dashed border-indigo-200 dark:border-indigo-900/30 animate-scale-in">
                       <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-3">{language === 'es' ? 'Seleccionar alumnos' : 'Select students'}</p>
                       <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {availableUsers.map(u => (
                             <div key={u.id} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700">
                                <div className="flex items-center gap-2 overflow-hidden">
                                   <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center font-black text-xs uppercase">{u.name.charAt(0)}</div>
                                   <p className="text-xs font-black truncate text-gray-700 dark:text-gray-200">{u.name}</p>
                                </div>
                                <button 
                                  onClick={() => handleAddMember(u.id)}
                                  className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/20"
                                >
                                   <Plus size={14}/>
                                </button>
                             </div>
                          ))}
                          {availableUsers.length === 0 && <p className="text-[10px] text-center text-gray-400 font-bold py-4 uppercase tracking-widest">{language === 'es' ? 'Todos están en el grupo' : 'Everyone is already here'}</p>}
                       </div>
                    </div>
                 )}
                 {groupMembers.map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all group">
                       <div onClick={() => onOpenMemberInfo?.(member.id)} className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center font-black text-sm uppercase cursor-pointer transition-transform hover:scale-110">
                          {member.name.charAt(0)}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p onClick={() => onOpenMemberInfo?.(member.id)} className="font-black text-sm text-gray-800 dark:text-white truncate cursor-pointer hover:text-indigo-600">{member.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                             {member.id === group.createdBy ? <Shield size={10} className="text-amber-500" /> : <User size={10} />}
                             {member.id === group.createdBy ? (language === 'es' ? 'Propietario' : 'Owner') : (language === 'es' ? 'Estudiante' : 'Student')}
                          </p>
                       </div>
                       {isOwner && member.id !== profile.id && (
                          <button onClick={() => handleRemoveMember(member.id)} className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><UserMinus size={18}/></button>
                       )}
                    </div>
                 ))}
              </div>
           )}

           {activeTab === 'media' && (
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Archivos Compartidos' : 'Shared Media'}</h4>
                 <div className="grid grid-cols-2 gap-3">
                    {sharedMedia.map(m => (
                       <div key={m.id} className="aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-slate-900 border dark:border-slate-700 group relative cursor-pointer" onClick={() => window.open(m.attachedFile.data, '_blank')}>
                          {m.attachedFile.type?.startsWith('image/') ? (
                             <img src={m.attachedFile.data} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Shared" />
                          ) : (
                             <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm"><FileText size={24} className="text-indigo-600"/></div>
                                <p className="text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase truncate w-full">{m.attachedFile.name}</p>
                             </div>
                          )}
                       </div>
                    ))}
                    {sharedMedia.length === 0 && (
                       <div className="col-span-2 py-12 text-center opacity-30">
                          <FileText size={48} className="mx-auto mb-4" />
                          <p className="text-xs font-black uppercase tracking-widest">{language === 'es' ? 'Sin archivos' : 'No files shared'}</p>
                       </div>
                    )}
                 </div>
              </div>
           )}

           {activeTab === 'settings' && (
              <div className="space-y-8">
                 <section className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Permisos del Grupo' : 'Group Permissions'}</h4>
                    <div className="space-y-2">
                       <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700">
                          <div>
                             <p className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-wide">{language === 'es' ? 'Quién puede chatear' : 'Who can chat'}</p>
                             <p className="text-[10px] text-gray-400">{language === 'es' ? 'Definir quién envía mensajes' : 'Define who can send messages'}</p>
                          </div>
                          <select 
                            disabled={!isOwner}
                            value={group.permissions?.canSendMessages || 'all'}
                            onChange={(e) => handleTogglePermission('canSendMessages', e.target.value)}
                            className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-[10px] font-black p-1 outline-none"
                          >
                             <option value="all">{language === 'es' ? 'Todos' : 'All'}</option>
                             <option value="owner">{language === 'es' ? 'Sólo Yo' : 'Owner Only'}</option>
                          </select>
                       </div>

                       {[
                         { id: 'allowFiles', label: language === 'es' ? 'Permitir Adjuntos' : 'Allow Files', icon: Paperclip },
                         { id: 'allowEditInfo', label: language === 'es' ? 'Editar Info' : 'Edit Info', icon: Edit3 },
                         { id: 'allowInvite', label: language === 'es' ? 'Invitar Miembros' : 'Invite Members', icon: UserPlus }
                       ].map(perm => (
                          <div key={perm.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border dark:border-slate-700">
                             <div className="flex items-center gap-3">
                                <perm.icon size={16} className="text-gray-400" />
                                <span className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-wide">{perm.label}</span>
                             </div>
                             <button 
                               disabled={!isOwner}
                               onClick={() => handleTogglePermission(perm.id, !group.permissions?.[perm.id])}
                               className={`w-10 h-6 rounded-full transition-all relative ${group.permissions?.[perm.id] ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-slate-700'}`}
                             >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${group.permissions?.[perm.id] ? 'left-5' : 'left-1'}`}></div>
                             </button>
                          </div>
                       ))}
                    </div>
                 </section>

                 {isOwner && (
                    <section className="space-y-4">
                       <h4 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">{language === 'es' ? 'Zona Peligrosa' : 'Danger Zone'}</h4>
                       <button 
                         onClick={() => { if(window.confirm(language === 'es' ? '¿Eliminar grupo permanentemente?' : 'Delete group permanently?')) { onDeleteGroup(group.id); onClose(); } } }
                         className="w-full flex items-center justify-center gap-2 py-4 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all border border-red-100 dark:border-red-900/30"
                       >
                          <Trash size={16} />
                          {language === 'es' ? 'Eliminar Grupo' : 'Delete Group'}
                       </button>
                    </section>
                 )}
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
