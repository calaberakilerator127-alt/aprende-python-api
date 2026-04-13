import { useState, useEffect } from 'react';
import api from '../config/api';
import socket from '../config/socket';

export function useAppData(user) {
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
          if (data) {
            // Mapping logic for compatibility
            const mappedData = data.map(item => ({
              ...item,
              authorId: item.author_id || item.authorId,
              createdAt: item.created_at || item.createdAt,
              updatedAt: item.updated_at || item.updatedAt,
              startDate: item.start_date || item.startDate,
              dueDate: item.due_date || item.dueDate,
              activityId: item.activity_id || item.activityId,
              studentId: item.student_id || item.studentId,
              eventId: item.event_id || item.eventId,
              assignedTo: item.assigned_to || item.assignedTo,
              htmlContent: item.html_content || item.htmlContent,
              targetId: item.target_id || item.targetId,
              targetType: item.target_type || item.targetType,
              parentId: item.parent_id || item.parentId
            }));
            setter(mappedData);
          }
        } catch (e) {
          console.error(`[API ERROR] Error cargando tabla ${table}:`, {
            status: e.response?.status,
            message: e.response?.data?.message || e.message,
            details: e.response?.data?.details
          });
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

    // 2. Suscripciones en tiempo real vía Socket.io
    socket.on('db_change', (payload) => {
      const { table, eventType, new: newRecord, old: oldRecord } = payload;
      
      const setter = getSetter(table);
      if (!setter) return;

      const mapRecord = (rec) => rec ? ({
        ...rec,
        authorId: rec.author_id || rec.authorId,
        createdAt: rec.created_at || rec.createdAt,
        updatedAt: rec.updated_at || rec.updatedAt,
        startDate: rec.start_date || rec.startDate,
        dueDate: rec.due_date || rec.dueDate,
        activityId: rec.activity_id || rec.activityId,
        studentId: rec.student_id || rec.studentId,
        eventId: rec.event_id || rec.eventId,
        assignedTo: rec.assigned_to || rec.assignedTo,
        htmlContent: rec.html_content || rec.htmlContent,
        targetId: rec.target_id || rec.targetId,
        targetType: rec.target_type || rec.targetType,
        parentId: rec.parent_id || rec.parentId
      }) : null;

      setter(prev => {
        if (eventType === 'INSERT') {
          const mapped = mapRecord(newRecord);
          if (prev.some(item => item.id === mapped.id)) return prev;
          return [mapped, ...prev];
        }
        if (eventType === 'UPDATE') {
          const mapped = mapRecord(newRecord);
          return prev.map(item => item.id === mapped.id ? { ...item, ...mapped } : item);
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
      const { data: record } = await api.get(`/data/${table}/${id}`);
      
      const setter = getSetter(table);
      if (setter && record) {
        setter(prev => {
          const exists = prev.some(item => item.id === id);
          if (exists) {
            return prev.map(item => item.id === id ? record : item);
          }
          return [record, ...prev];
        });
      }
      return record;
    } catch (err) {
      console.error(`[API ERROR] Error hidratando registro de ${table}/${id}:`, {
        status: err.response?.status,
        message: err.response?.data?.message || err.message
      });
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
