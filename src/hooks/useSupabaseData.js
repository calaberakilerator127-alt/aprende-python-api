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

    // 1. Carga inicial de datos desde el nuevo Backend (Batch)
    const fetchData = async () => {
      try {
        const { data } = await api.get('/data/all');
        if (data) {
          if (data.profiles) setUsers(data.profiles);
          if (data.activities) setActivities(data.activities);
          if (data.submissions) setSubmissions(data.submissions);
          if (data.materials) setMaterials(data.materials);
          if (data.events) setEvents(data.events);
          if (data.notifications) setNotifications(data.notifications);
          if (data.call_logs) setCallLogs(data.call_logs);
          if (data.attendance) setAttendance(data.attendance);
          if (data.news) setNews(data.news);
          if (data.forum) setForum(data.forum);
          if (data.comments) setComments(data.comments);
          if (data.saved_codes) setSavedCodes(data.saved_codes);
          if (data.saved_notes) setSavedNotes(data.saved_notes);
          if (data.feedback) setFeedback(data.feedback);
          if (data.changelog) setChangelog(data.changelog);
          if (data.grading_configs) setGradingConfigs(data.grading_configs);
          if (data.messages) setGlobalMessages(data.messages);
        }
      } catch (e) {
        console.error("Error cargando datos por lote:", e);
        // Fallback or retry logic could go here
      }
    };

    fetchData();

    // 2. Suscripciones en tiempo real vía Socket.io (Reemplazo de Supabase Realtime)
    socket.on('db_change', (payload) => {
      const { table, eventType, new: newRecord, old: oldRecord } = payload;
      
      const setter = getSetter(table);
      if (!setter) return;

      setter(prev => {
        if (eventType === 'INSERT') {
          if (prev.some(item => item.id === newRecord.id)) return prev;
          return [newRecord, ...prev];
        }
        if (eventType === 'UPDATE') {
          return prev.map(item => item.id === newRecord.id ? { ...item, ...newRecord } : item);
        }
        if (eventType === 'DELETE') {
          return prev.filter(item => item.id !== (oldRecord?.id || payload.oldData?.id));
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
