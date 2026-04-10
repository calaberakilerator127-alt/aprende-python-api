import { useState, useEffect } from 'react';
import api from '../config/api';
import socket from '../config/socket';

const CHAT_LIMIT_MS = 5 * 60 * 1000; // 5 minutos

// Helper hook customizado para manejar los Grupos
export function useGroups(userId) {
  const [groups, setGroups] = useState([]);
  
  useEffect(() => {
    if (!userId) return;

    // Obtener grupos iniciales
    const fetchGroups = async () => {
      try {
        const { data } = await api.get('/data/groups');
        // Filtrar localmente si el backend no lo hace aún
        if (data) setGroups(data.filter(g => g.members?.includes(userId)));
      } catch (e) {
        console.error("Error fetching groups:", e);
      }
    };

    fetchGroups();

    // Socket listener para cambios en grupos
    const handleGroupChange = (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      if (payload.table !== 'groups') return;

      if (eventType === 'INSERT') {
        if (newRecord.members?.includes(userId)) {
          setGroups(prev => [...prev, newRecord]);
        }
      } else if (eventType === 'UPDATE') {
        if (newRecord.members?.includes(userId)) {
          setGroups(prev => prev.map(g => g.id === newRecord.id ? newRecord : g));
        } else {
          setGroups(prev => prev.filter(g => g.id !== newRecord.id));
        }
      } else if (eventType === 'DELETE') {
        setGroups(prev => prev.filter(g => g.id !== oldRecord.id));
      }
    };

    socket.on('db_change', handleGroupChange);

    return () => {
      socket.off('db_change', handleGroupChange);
    };
  }, [userId]);

  const createGroup = async (name, memberIds) => {
    if (!name.trim() || memberIds.length === 0) return null;
    try {
      const { data } = await api.post('/data/groups', {
        name, 
        members: [userId, ...memberIds], 
        created_by: userId,
        permissions: {
          canSendMessages: 'all',
          allowFiles: true,
          allowEditInfo: true,
          allowInvite: true
        }
      });
      return { id: data.id, name, type: 'group' };
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      await api.delete(`/data/groups/${groupId}`);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const updateGroup = async (groupId, updates) => {
    try {
      await api.put(`/data/groups/${groupId}`, updates);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  return { groups, createGroup, deleteGroup, updateGroup };
}

// Typing hook con Sockets
export function useTyping(chatId, userId, userName) {
  const [typingUsers, setTypingUsers] = useState([]);

  useEffect(() => {
    if (!chatId || !userId) return;

    const handleTyping = (data) => {
      if (data.userId === userId) return;
      
      setTypingUsers(prev => {
        if (data.isTyping) {
          if (prev.some(u => u.userId === data.userId)) return prev;
          return [...prev, { userId: data.userId, userName: data.userName }];
        } else {
          return prev.filter(u => u.userId !== data.userId);
        }
      });
    };

    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('user_typing', handleTyping);
    };
  }, [chatId, userId]);

  const setTyping = (isTyping) => {
    socket.emit(isTyping ? 'typing_start' : 'typing_stop', { chatId, userId, userName });
  };

  return { typingUsers, setTyping };
}

export function useChat(userId, activeChatId = 'general') {
  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(true);

  useEffect(() => {
    if (!activeChatId) return;
    setLoadingChat(true);

    const fetchMessages = async () => {
      try {
        const { data } = await api.get('/data/messages');
        if (data) {
          const filtered = data.filter(m => m.chat_id === activeChatId);
          const now = new Date();
          const valid = filtered.filter(m => !m.expires_at || new Date(m.expires_at) > now);
          setMessages(valid.reverse()); // Supabase devolvía DESC, nosotros necesitamos ASC para UI
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        setLoadingChat(false);
      }
    };

    fetchMessages();
    socket.emit('join_chat', activeChatId);

    const handleMessageChange = (payload) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      if (payload.table !== 'messages' || (newRecord && newRecord.chat_id !== activeChatId) || (oldRecord && oldRecord.chat_id && oldRecord.chat_id !== activeChatId)) return;

      if (eventType === 'INSERT') {
        setMessages(prev => {
          if (prev.some(m => m.id === newRecord.id)) return prev;
          return [...prev, newRecord];
        });
      } else if (eventType === 'UPDATE') {
        setMessages(prev => prev.map(m => m.id === newRecord.id ? newRecord : m));
      } else if (eventType === 'DELETE') {
        setMessages(prev => prev.filter(m => m.id !== oldRecord.id));
      }
    };

    socket.on('db_change', handleMessageChange);

    return () => {
      socket.off('db_change', handleMessageChange);
    };
  }, [activeChatId]);

  const sendMessage = async (text, senderName, recipientId = null, attachedFile = null, options = {}) => {
    if (!text.trim() && !attachedFile) return false;
    
    // Optimista
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      text,
      sender_id: userId,
      sender_name: senderName,
      recipient_id: recipientId,
      chat_id: activeChatId,
      created_at_iso: new Date().toISOString(),
      attached_file: attachedFile,
      is_optimistic: true
    };
    setMessages(prev => [...prev, optimisticMsg]);
    
    try {
      const msgData = {
        text,
        sender_id: userId,
        sender_name: senderName,
        recipient_id: recipientId,
        chat_id: activeChatId,
        attached_file: attachedFile
      };

      if (options.isEphemeral) {
        msgData.expires_at = new Date(Date.now() + (options.duration || 24 * 60 * 60 * 1000)).toISOString();
      }

      const { data: newRecord } = await api.post('/data/messages', msgData);
      
      // Actualizar último mensaje del grupo si aplica
      if (!activeChatId.startsWith('private_')) {
        api.put(`/data/groups/${activeChatId}`, {
          last_message: text || 'Fichero adjunto',
          last_message_at: new Date().toISOString()
        });
      }

      setMessages(prev => prev.map(m => m.id === tempId ? newRecord : m));
      return true;
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      console.error("Error enviando mensaje:", e);
      return false;
    }
  };

  const deleteMessage = async (msgId) => {
    try {
      await api.delete(`/data/messages/${msgId}`);
      return true;
    } catch (e) {
      console.error("Error al eliminar mensaje: ", e);
      return false;
    }
  };

  const updateMessage = async (msgId, newText) => {
    try {
      await api.put(`/data/messages/${msgId}`, {
        text: newText,
        updated_at: new Date().toISOString(),
        is_edited: true
      });
      return true;
    } catch (e) {
      console.error("Error al actualizar mensaje:", e);
      return false;
    }
  };

  const togglePinMessage = async (msgId, isPinned) => {
    try {
      await api.put(`/data/messages/${msgId}`, { is_pinned: !isPinned });
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  return { messages, sendMessage, deleteMessage, updateMessage, togglePinMessage, loadingChat };
}

// Global typing usando el mismo socket
export const useGlobalTyping = () => {
  const [typingMap, setTypingMap] = useState({});

  useEffect(() => {
    const handleTyping = (data) => {
      setTypingMap(prev => {
        const chatTypers = prev[data.chatId] || [];
        if (data.isTyping) {
          if (chatTypers.some(u => u.userId === data.userId)) return prev;
          return { ...prev, [data.chatId]: [...chatTypers, { userId: data.userId, userName: data.userName }] };
        } else {
          return { ...prev, [data.chatId]: chatTypers.filter(u => u.userId !== data.userId) };
        }
      });
    };

    socket.on('user_typing', handleTyping);
    return () => socket.off('user_typing', handleTyping);
  }, []);

  return typingMap;
};

export function useUserActions(profileId) {
   const toggleBlockUser = async (targetUserId, currentBlocked = []) => {
      try {
        const isBlocked = currentBlocked.includes(targetUserId);
        const newBlocked = isBlocked 
          ? currentBlocked.filter(id => id !== targetUserId)
          : [...currentBlocked, targetUserId];

        await api.put(`/data/profiles/${profileId}`, { blocked_users: newBlocked });
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
   };

   const togglePinChat = async (chatId, currentPinned = []) => {
      try {
        const isPinned = currentPinned.includes(chatId);
        const newPinned = isPinned
          ? currentPinned.filter(id => id !== chatId)
          : [...currentPinned, chatId];

        await api.put(`/data/profiles/${profileId}`, { pinned_chats: newPinned });
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
   };

   return { toggleBlockUser, togglePinChat };
}
