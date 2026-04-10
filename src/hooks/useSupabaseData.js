import { useState, useEffect } from 'react';
import api from '../config/api';
import socket from '../config/socket';

export function useSupabaseData(user) {
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const [callLogs, setCallLogs] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [news, setNews] = useState([]);
  const [forum, setForum] = useState([]);
  const [comments, setComments] = useState([]);
  const [savedCodes, setSavedCodes] = useState([]);
  const [savedNotes, setSavedNotes] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [changelog, setChangelog] = useState([]);
  const [gradingConfigs, setGradingConfigs] = useState([]);
  const [globalMessages, setGlobalMessages] = useState([]);

  useEffect(() => {
    if (!user) {
      const reset = () => {
        setUsers([]); setActivities([]); setSubmissions([]); setMaterials([]); setEvents([]);
        setNotifications([]); setCallLogs([]); setAttendance([]); setNews([]);
        setForum([]); setComments([]); setSavedCodes([]); setSavedNotes([]); setFeedback([]); setChangelog([]);
        setGradingConfigs([]); setGlobalMessages([]);
      };
      reset();
      socket.disconnect();
      return;
    }

    // Connect socket if user exists
    if (!socket.connected) {
      socket.connect();
      socket.emit('user_online', { userId: user.id });
    }

    // 1. Carga inicial de datos desde el nuevo Backend
    const fetchData = async () => {
      const fetchTable = async (table, setter) => {
        try {
          const { data } = await api.get(`/data/${table}`);
          if (data) setter(data);
        } catch (e) {
          console.error(`Error cargando tabla ${table}:`, e);
        }
      };

      fetchTable('profiles', setUsers);
      fetchTable('activities', setActivities);
      fetchTable('submissions', setSubmissions);
      fetchTable('materials', setMaterials);
      fetchTable('events', setEvents);
      fetchTable('notifications', setNotifications);
      fetchTable('call_logs', setCallLogs);
      fetchTable('attendance', setAttendance);
      fetchTable('news', setNews);
      fetchTable('forum', setForum);
      fetchTable('comments', setComments);
      fetchTable('saved_codes', setSavedCodes);
      fetchTable('saved_notes', setSavedNotes);
      fetchTable('feedback', setFeedback);
      fetchTable('changelog', setChangelog);
      fetchTable('grading_configs', setGradingConfigs);
      fetchTable('messages', setGlobalMessages);
    };

    fetchData();

    // 2. Suscripciones en tiempo real vía Socket.io (Reemplazo de Supabase Realtime)
    socket.on('db_change', (payload) => {
      const { table, eventType, new: newRecord, old: oldRecord } = payload;
      
      const setter = getSetter(table);
      if (!setter) return;

      setter(prev => {
        if (eventType === 'INSERT') {
          // Evitar duplicados si el optimista ya lo insertó
          if (prev.some(item => item.id === newRecord.id)) return prev;
          return [newRecord, ...prev];
        }
        if (eventType === 'UPDATE') {
          return prev.map(item => item.id === newRecord.id ? { ...item, ...newRecord } : item);
        }
        if (eventType === 'DELETE') {
          return prev.filter(item => item.id !== oldRecord.id);
        }
        return prev;
      });
    });

    return () => {
      socket.off('db_change');
    };
  }, [user]);

  /**
   * Utilidad para cargar el registro completo bajo demanda (Hidratación)
   */
  const fetchFullRecord = async (table, id) => {
    try {
      const { data } = await api.get(`/data/${table}`); // En un backend real, haríamos GET /data/:table/:id
      // Por ahora filtramos del listado o cargamos todo (optimizable)
      const record = data.find(item => item.id === id);
      
      const setter = getSetter(table);
      if (setter && record) {
        setter(prev => prev.map(item => item.id === id ? record : item));
      }
      return record;
    } catch (err) {
      console.error(`Error hidratando registro de ${table}:`, err);
      return null;
    }
  };

  /**
   * UTILIDADES OPTIMISTAS
   */
  const getSetter = (table) => {
    const map = {
      'profiles': setUsers, 'activities': setActivities, 'submissions': setSubmissions,
      'materials': setMaterials, 'events': setEvents, 'notifications': setNotifications,
      'attendance': setAttendance, 'news': setNews, 'call_logs': setCallLogs,
      'forum': setForum, 'comments': setComments, 'saved_codes': setSavedCodes,
      'saved_notes': setSavedNotes, 'grading_configs': setGradingConfigs, 
      'feedback': setFeedback, 'changelog': setChangelog,
      'messages': setGlobalMessages
    };
    return map[table];
  };

  const addOptimistic = (table, record) => {
    const setter = getSetter(table);
    if (setter) setter(prev => [record, ...prev]);
  };

  const updateOptimistic = (table, id, updates) => {
    const setter = getSetter(table);
    if (setter) setter(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeOptimistic = (table, id) => {
    const setter = getSetter(table);
    if (setter) setter(prev => prev.filter(item => item.id !== id));
  };

  const replaceOptimistic = (table, tempId, realRecord) => {
    const setter = getSetter(table);
    if (setter) {
      setter(prev => {
        const alreadyExists = prev.some(item => item.id === realRecord.id);
        if (alreadyExists) {
          return prev.filter(item => item.id !== tempId);
        } else {
          return prev.map(item => item.id === tempId ? realRecord : item);
        }
      });
    }
  };

  return { 
    users, activities, submissions, materials, events, notifications, 
    callLogs, attendance, news, forum, 
    comments, savedCodes, savedNotes, feedback, changelog, gradingConfigs,
    fetchFullRecord,
    addOptimistic, updateOptimistic, removeOptimistic, replaceOptimistic,
    globalMessages
  };
};
