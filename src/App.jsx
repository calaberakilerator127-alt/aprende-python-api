import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Globe, Menu, Settings, Bell, Sun, Moon, LogOut, 
  LayoutDashboard, FileText, Award, Calendar, MessageSquare, 
  User, Code2, Trash2, MessageCircle, History, Shield, 
  ShieldCheck, Eye, X, AlertTriangle, Video, Phone, ExternalLink, Pin, Edit3, RefreshCw, HardDrive, Download
} from 'lucide-react';
import { useAppAuth } from './hooks/useAppAuth';
import { useSupabaseData } from './hooks/useSupabaseData';
import { usePresence } from './hooks/usePresence';
import { useSound } from './hooks/useSound';
import { useSettings } from './hooks/SettingsContext';
import { isUserOnline, formatLastSeen } from './utils/presenceUtils';

import Toast from './components/ui/Toast';
import DashboardView from './views/DashboardView';
import ActivitiesView from './views/ActivitiesView';
import GradesView from './views/GradesView';
import ClassSettingsView from './views/ClassSettingsView';
import CalendarView from './views/CalendarView';
import MaterialsView from './views/MaterialsView';
import ChatView from './views/ChatView';
import ProfileView from './views/ProfileView';
import CodeLabView from './views/CodeLabView';
import NewsView from './views/NewsView';
import ForumView from './views/ForumView';
import QuizPlayer from './views/QuizPlayer';
import MeetingOverlay from './components/MeetingOverlay';
import FeedbackView from './views/FeedbackView';
import ChangelogView from './views/ChangelogView';
import AdminPanelView from './views/AdminPanelView';

import api from './config/api';
import socket from './config/socket';

export default function App() {
  const { 
    user, profile, loading, isPrivileged, isBlacklisted, 
    spectatingProfile, setSpectatingProfile, 
    handleGoogleLogin, handleEmailLogin, handleEmailRegister, 
    handleSetProfile, updateProfileData, handleDeleteAccount, 
    handleLogout, handlePasswordChange, handleAdminResetPassword, 
    updateAnyUserProfile, handleKickUser, handleBanUser 
  } = useAppAuth();

  const { 
    users: allUsers, activities, submissions, materials, events, 
    notifications, callLogs, attendance, news, forum, 
    comments, savedCodes, savedNotes, feedback, changelog, gradingConfigs, 
    fetchFullRecord, addOptimistic, updateOptimistic, removeOptimistic, replaceOptimistic,
    globalMessages
  } = useSupabaseData(user);

  const { t, language, notificationsEnabled, soundSettings, soundsEnabled } = useSettings();
  const { playSound } = useSound();
  
  const isDeveloper = user?.email === 'developer@tdsc.isgosk.com' || profile?.role === 'developer';
  const activeProfile = spectatingProfile || profile;

  // Filtrado de usuarios privilegiados de las listas públicas
  const users = useMemo(() => {
    const privilegedEmails = ['admin@tdsc.isgosk.com', 'developer@tdsc.isgosk.com'];
    return allUsers.filter(u => !privilegedEmails.includes(u.email));
  }, [allUsers]);
  
  usePresence(user, profile);
  
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [toast, setToast] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [lastNotifId, setLastNotifId] = useState(() => localStorage.getItem('lastNotifId'));
  const [activeCall, setActiveCall] = useState(null);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [globalSettings, setGlobalSettings] = useState({ maintenanceMode: false });
  
  // Global Settings Listener
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/data/settings');
        const settings = data.find(s => s.key === 'global');
        if (settings) setGlobalSettings(settings.value);
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();

    const handleSettingsChange = (payload) => {
      if (payload.table === 'settings' && payload.new?.key === 'global') {
        setGlobalSettings(payload.new.value);
      }
    };

    socket.on('db_change', handleSettingsChange);
    return () => socket.off('db_change', handleSettingsChange);
  }, []);

  // Session Security Listener
  useEffect(() => {
    if (!profile) return;
    if (profile.session_valid === false || profile.is_banned === true) {
      const reason = profile.is_banned 
        ? (language === 'es' ? 'Tu cuenta ha sido bandeada' : 'Your account has been banned') 
        : (language === 'es' ? 'Sesión invalidada por un administrador' : 'Session invalidated by an admin');
      showToast(reason, 'error');
      setTimeout(() => handleLogout(), 2000);
    }
  }, [profile?.session_valid, profile?.is_banned, language]);

  // Listen for Quiz Start Event
  useEffect(() => {
    const handleStartQuiz = (e) => {
       setActiveQuiz(e.detail.quiz);
       if (soundsEnabled) playSound('click');
    };
    window.addEventListener('start-quiz', handleStartQuiz);
    return () => window.removeEventListener('start-quiz', handleStartQuiz);
  }, [soundsEnabled, playSound]);

  // Monitoreo de Tiempos y Alarmas Basado en Eventos (Optimizado)
  useEffect(() => {
    if (!user || !notificationsEnabled) return;
    
    const timeouts = [];
    const now = Date.now();

    const scheduleAlarm = (targetTime, callback) => {
      const delay = targetTime - Date.now();
      if (delay > 0 && delay <= 2147483647) { // Max setTimeout delay
        const t = setTimeout(callback, delay);
        timeouts.push(t);
      }
    };

    // 1. Monitoreo de Reuniones
    if (events) {
      events.forEach(ev => {
        const startTime = new Date(ev.startDate || ev.date).getTime();
        const endTime = ev.endDate ? new Date(ev.endDate).getTime() : null;

        // Recordatorio 5 minutos antes
        const reminderTime = startTime - 300000;
        const reminderKey = `alarm_mtg_${ev.id}_reminder`;
        if (!localStorage.getItem(reminderKey) && reminderTime > now) {
          scheduleAlarm(reminderTime, () => {
            if (!localStorage.getItem(reminderKey)) {
               createNotification(`⏰ Recordatorio: La clase "${ev.title}" inicia en 5 minutos.`, ev.assignedTo, 'meeting', ev.id);
               localStorage.setItem(reminderKey, 'true');
               if (soundsEnabled) playSound(soundSettings.meeting);
            }
          });
        }

        // Inicio de clase
        const startKey = `alarm_mtg_${ev.id}_started`;
        if (!localStorage.getItem(startKey) && startTime > now) {
          scheduleAlarm(startTime, () => {
             if (!localStorage.getItem(startKey)) {
                createNotification(`🚨 ¡La clase "${ev.title}" está iniciando ahora!`, ev.assignedTo, 'meeting', ev.id);
                localStorage.setItem(startKey, 'true');
                if (soundsEnabled) playSound(soundSettings.meeting);
             }
          });
        }

        // Fin de clase
        if (endTime) {
          const endKey = `alarm_mtg_${ev.id}_ended`;
          if (!localStorage.getItem(endKey) && endTime > now) {
            scheduleAlarm(endTime, () => {
              if (!localStorage.getItem(endKey)) {
                 createNotification(`🏁 La reunión "${ev.title}" ha finalizado según lo programado.`, ev.assignedTo, 'meeting', ev.id);
                 localStorage.setItem(endKey, 'true');
                 if (soundsEnabled) playSound(soundSettings.meeting);
                 if (activeProfile?.role === 'profesor' && ev.status !== 'finalizada') {
                    api.put(`/data/events/${ev.id}`, { status: 'finalizada' });
                 }
              }
            });
          }
        }
      });
    }

    // 2. Monitoreo de Actividades
    if (activities) {
      activities.forEach(act => {
        const startTime = new Date(act.startDate).getTime();
        const endTime = new Date(act.dueDate).getTime();

        // Inicio de actividad
        const openKey = `alarm_act_${act.id}_opened`;
        if (!localStorage.getItem(openKey) && startTime > now) {
          scheduleAlarm(startTime, () => {
            if (!localStorage.getItem(openKey)) {
              createNotification(
                `🚀 La ${act.type || 'tarea'}: "${act.title}" ya está disponible para realizar.`,
                act.assignedTo?.includes('all') ? null : act.assignedTo,
                act.type || 'tarea', act.id
              );
              localStorage.setItem(openKey, 'true');
              if (soundsEnabled) playSound(soundSettings[act.type || 'tarea'] || 'notification');
            }
          });
        }

        // Fin de actividad
        const closeKey = `alarm_act_${act.id}_closed`;
        if (!localStorage.getItem(closeKey) && endTime > now) {
          scheduleAlarm(endTime, () => {
            if (!localStorage.getItem(closeKey)) {
              createNotification(
                `⚠️ El plazo para la ${act.type || 'tarea'}: "${act.title}" ha finalizado.`,
                act.assignedTo?.includes('all') ? null : act.assignedTo,
                act.type || 'tarea', act.id
              );
              localStorage.setItem(closeKey, 'true');
              if (soundsEnabled) playSound(soundSettings[act.type || 'tarea'] || 'notification');
              if (activeProfile?.role === 'profesor' && act.status !== 'cerrado') {
                 api.put(`/data/activities/${act.id}`, { status: 'cerrado' });
              }
            }
          });
        }
      });
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [user, events, activities, notificationsEnabled, soundsEnabled, soundSettings, activeProfile]);

  // Monitoreo de Entregas Pendientes (Solo Profesor)
  useEffect(() => {
    if (!activeProfile || activeProfile.role !== 'profesor' || !submissions || !activities || !user) return;
    const pendingSubs = submissions.filter(s => s.status === 'entregado');
    if (pendingSubs.length === 0) return;
    pendingSubs.forEach(s => {
      const act = activities.find(a => a.id === s.activity_id);
      if (act) {
        const alarmKey = `pending_alert_${s.id}`;
        if (!localStorage.getItem(alarmKey)) {
          createNotification(`📝 Nueva entrega recibida de ${s.student_id?.name || 'estudiante'} en: "${act.title}"`, [user.id], 'evaluacion', act.id);
          localStorage.setItem(alarmKey, 'true');
        }
      }
    });
  }, [activeProfile, submissions, activities, user]);

  // Sonido para nuevas notificaciones
  useEffect(() => {
    if (notifications.length > 0) {
      const newest = notifications[0];
      if (newest.id !== lastNotifId) {
        if (lastNotifId && user.id !== newest.author_id) {
           const type = newest.type || 'task';
           playSound(soundSettings[type] || 'notification');
        }
        setLastNotifId(newest.id);
        localStorage.setItem('lastNotifId', newest.id);
      }
    }
  }, [notifications, lastNotifId, soundSettings, playSound, user]);

  const unreadMessagesCount = useMemo(() => {
    if (!globalMessages || !user) return 0;
    let count = 0;
    const lastRead = JSON.parse(localStorage.getItem('lastReadAt') || '{}');
    globalMessages.forEach(m => {
       if (m.sender_id === user.id) return;
       const isDirectForMe = m.recipient_id === user.id;
       const isGeneralOrGroup = !m.recipient_id;
       if (isDirectForMe || isGeneralOrGroup) {
          const chatKey = m.chat_id;
          const lastReadTime = lastRead[chatKey] || 0;
          if (m.created_at > lastReadTime) count++;
       }
    });
    return count;
  }, [globalMessages, user]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const createNotification = async (message, targetUserIds = null, type = 'task', targetId = null) => {
    try {
      await api.post('/data/notifications', {
        message, author_id: user?.id || null,
        author_name: activeProfile?.name || 'Sistema', 
        target_user_ids: targetUserIds, type, target_id: targetId
      });
    } catch(e) { console.error(e) }
  };

  const handleNotificationClick = (notif) => {
    const type = notif.type;
    if (['meeting', 'calendar'].includes(type)) setActiveTab('calendar');
    else if (['task', 'tarea', 'evaluacion', 'evaluation'].includes(type)) setActiveTab('entregas');
    else if (type === 'chat') setActiveTab('chat');
    else if (type === 'materials') setActiveTab('materials');
    else if (type === 'news') setActiveTab('news');
    else if (type === 'forum') setActiveTab('forum');
    if (notif.target_id) setSelectedResourceId(notif.target_id);
    setNotificationsOpen(false);
    playSound('click');
    handleDeleteNotification(notif.id);
  };

  const handleDeleteNotification = async (id) => {
     try { await api.delete(`/data/notifications/${id}`); } catch (e) { console.error(e) }
  };

  // Pantalla de carga persistente
  if (loading && !profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4 animate-pulse">
           <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
           <p className="text-sm font-medium text-gray-500">{t('login_loading')}</p>
        </div>
      </div>
    );
  }

  // Blacklist Security Screen
  if (isBlacklisted) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-red-50 dark:bg-red-950 p-8 text-center space-y-6">
        <div className="p-8 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 animate-pulse">
          <AlertTriangle size={64} />
        </div>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Acceso Denegado</h1>
        <p className="text-gray-500 dark:text-slate-400 max-w-md font-medium">Esta cuenta ha sido incluida en la lista negra del sistema.</p>
        <button onClick={handleLogout} className="px-8 py-3 bg-red-600 text-white rounded-full font-black uppercase tracking-widest hover:bg-red-700 transition-all">Salir</button>
      </div>
    );
  }

  // Maintenance Mode Screen
  if (globalSettings.maintenanceMode && !isDeveloper) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 p-8 text-center space-y-6">
        <div className="p-8 bg-amber-100 dark:bg-amber-900/30 rounded-full text-amber-600 animate-bounce">
          <Settings size={64} />
        </div>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Mantenimiento</h1>
        <p className="text-gray-500 dark:text-slate-400 max-w-md font-medium italic">Estamos ajustando los engranajes. Volvemos pronto.</p>
        <button onClick={handleLogout} className="px-6 py-2 bg-indigo-600 text-white rounded-full text-xs font-black uppercase tracking-widest">Salir</button>
      </div>
    );
  }

  if (!user || !profile || profile?.is_setup !== true) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'dark bg-slate-900' : 'bg-gray-50'}`}>
        <div className="max-w-md w-full p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Python Master" className="w-16 h-16 object-contain mx-auto mb-4" />
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Python Master</h1>
            <p className="text-sm mt-2 text-gray-500 dark:text-slate-400">Aprende y domina Python</p>
          </div>
          {!user ? (
            <div className="space-y-4">
               <form onSubmit={(e) => {
                 e.preventDefault(); setAuthError(null);
                 const formData = new FormData(e.target);
                 const email = formData.get('email');
                 const password = formData.get('password');
                 if (isRegistering) {
                   const confirmPassword = formData.get('confirmPassword');
                   if (password !== confirmPassword) {
                     setAuthError('Las contraseñas no coinciden.'); return;
                   }
                   handleEmailRegister(email, password).catch(err => setAuthError(err.message));
                 } else {
                   handleEmailLogin(email, password).catch(err => setAuthError(err.message));
                 }
               }} className="space-y-4">
                 <input id="loginEmail" required name="email" type="email" placeholder="Email" className="w-full px-4 py-3 rounded-xl border dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />
                 <input id="loginPassword" required name="password" minLength={6} type="password" placeholder="Password" className="w-full px-4 py-3 rounded-xl border dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />
                 {isRegistering && <input id="confirmPassword" required name="confirmPassword" type="password" placeholder="Confirm Password" className="w-full px-4 py-3 rounded-xl border dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />}
                 <button disabled={loading} type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-md">
                   {loading ? '...' : (isRegistering ? 'Crear Cuenta' : 'Ingresar')}
                 </button>
               </form>
               <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-700 py-2.5 rounded-xl border font-semibold hover:bg-gray-50 transition shadow-sm text-sm">
                <Globe size={18} className="text-blue-500" /> Google
               </button>
               <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }} className="w-full text-center text-sm font-medium text-indigo-600 hover:underline">
                    {isRegistering ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
               </button>
               {authError && <p className="text-xs text-red-600 text-center mt-2">⚠️ {authError}</p>}
            </div>
          ) : (
            <div className="space-y-6">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSetProfile(e.target.name.value, e.target.role.value).then(res => {
                  if (res) showToast('Configurado'); else showToast('Error', 'error');
                });
              }} className="space-y-5">
                <input id="profileName" required name="name" type="text" placeholder="Nombre completo" defaultValue={user.displayName} className="w-full px-4 py-3 rounded-xl border dark:bg-slate-900" />
                <select id="profileRole" required name="role" className="w-full px-4 py-3 rounded-xl border dark:bg-slate-900">
                  <option value="">Selecciona rol</option>
                  <option value="estudiante">Estudiante</option>
                  <option value="profesor">Profesor</option>
                </select>
                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase hover:bg-indigo-700 transition shadow-lg">Finalizar</button>
                <button type="button" onClick={handleLogout} className="w-full mt-4 text-gray-400 text-xs font-bold hover:text-red-500 transition">Cancelar</button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'news', label: 'Noticias', icon: Bell },
    { id: 'forum', label: 'Foro', icon: MessageSquare },
    { id: 'entregas', label: 'Entregas', icon: FileText },
    { id: 'grades', label: 'Calificaciones', icon: Award },
    { id: 'calendar', label: 'Calendario', icon: Calendar },
    { id: 'materials', label: 'Materiales', icon: BookOpen },
    { id: 'codelab', label: 'CodeLab', icon: Code2 },
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: unreadMessagesCount },
    { id: 'feedback', label: 'Feedback', icon: MessageCircle },
    { id: 'changelog', label: 'Changelog', icon: History },
    { id: 'profile', label: 'Perfil', icon: User },
    ...(activeProfile?.role === 'profesor' ? [{ id: 'settings', label: 'Ajustes', icon: Settings }] : []),
    ...(isDeveloper ? [{ id: 'admin', label: 'Admin', icon: ShieldCheck }] : [])
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100 font-sans overflow-hidden transition-colors duration-200">
        
        {/* SIDEBAR */}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-800 border-r dark:border-slate-700 transition-transform duration-300 flex flex-col shadow-2xl md:shadow-none`}>
          <div className="p-8 flex items-center gap-4 group cursor-pointer" onClick={() => { setActiveTab('dashboard'); playSound('click'); }}>
             <div className="p-2 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform">
                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
             </div>
             <span className="font-black text-xl tracking-tight uppercase">Python Master</span>
          </div>

          <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar pb-8">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id} onClick={() => { setActiveTab(item.id); setSelectedResourceId(null); setSidebarOpen(false); playSound('click'); }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 relative group focus-visible:ring-inset ${isActive ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 font-bold' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/60 hover:text-indigo-600'}`}
                >
                  <Icon size={22} className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : ''}`} />
                  <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis text-sm uppercase tracking-wider">{item.label}</span>
                  {item.badge > 0 && <span className="bg-red-500 shadow-lg shadow-red-500/20 text-white text-[10px] h-5 w-5 rounded-full flex items-center justify-center font-black animate-bounce-in">{item.badge}</span>}
                </button>
              );
            })}
          </nav>

          <div className="p-6 border-t dark:border-slate-700 space-y-4">
              <div className="px-5 py-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl transition-all">
                 <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-2 leading-none">
                   {activeProfile?.role === 'profesor' ? 'Modo Instructor' : 'Modo Estudiante'}
                 </p>
                 <div className="flex items-center gap-2">
                   <span className="relative flex h-2.5 w-2.5">
                     <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${!isUserOnline(profile) ? 'bg-gray-400' : 'bg-green-400'} opacity-75`}></span>
                     <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${!isUserOnline(profile) ? 'bg-gray-400' : 'bg-green-500'}`}></span>
                   </span> 
                   <span className="text-[11px] font-bold dark:text-slate-300">
                     {isUserOnline(activeProfile || profile) 
                       ? 'En Línea' 
                       : `Visto: ${formatLastSeen(activeProfile?.lastSeen || profile?.lastSeen, language)}`}
                   </span>
                 </div>
              </div>
              
              <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-slate-700/50 rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 transition" onClick={() => setActiveTab('profile')}>
               {activeProfile?.photoURL ? <img src={activeProfile.photoURL} alt="P" className="w-10 h-10 rounded-xl object-cover shadow-md" /> : <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs uppercase">{activeProfile?.name?.charAt(0) || '?'}</div>}
               <div className="overflow-hidden flex-1"><p className="text-xs font-black truncate uppercase tracking-tighter">{activeProfile?.name || 'Usuario'}</p><p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{activeProfile?.role}</p></div>
              </div>

              {isPrivileged && (
                <button 
                  onClick={async () => {
                    let nextRole = activeProfile?.role === 'estudiante' ? 'profesor' : 'estudiante';
                    const ok = await updateProfileData({ role: nextRole });
                    if (ok) { showToast(`Cambio a ${nextRole}`); playSound('click'); }
                  }}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                >
                  <RefreshCw size={14} /> Switchear Rol
                </button>
              )}
             <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors font-black text-[10px] uppercase tracking-widest"><LogOut size={18} /> Cerrar Sesión</button>
          </div>
        </aside>

        {/* OVERLAY MOBILE */}
        {sidebarOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40 md:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />}

        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          <header className="h-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-gray-100 dark:border-slate-700/50 flex items-center justify-between px-8 z-30 shrink-0 sticky top-0 shadow-sm">
            <div className="flex items-center gap-6">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden text-gray-500 p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition"><Menu size={24} /></button>
              {spectatingProfile && (
                <div className="flex items-center gap-3 px-5 py-2 bg-red-600 text-white rounded-2xl animate-pulse shadow-xl shadow-red-500/30">
                   <Eye size={18} />
                   <span className="text-[11px] font-black uppercase tracking-widest">Espectando: {spectatingProfile.name}</span>
                   <button onClick={() => setSpectatingProfile(null)} className="ml-2 hover:scale-110 transition-transform"><X size={16}/></button>
                </div>
              )}
              <h2 className="text-2xl font-black tracking-tighter uppercase text-gray-900 dark:text-white hidden sm:block">
                {menuItems.find(i => i.id === activeTab)?.label}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button onClick={() => { setNotificationsOpen(!notificationsOpen); playSound('click'); }} className="p-3 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-2xl transition relative hover:scale-105 active:scale-95 shadow-md border border-indigo-100 dark:border-indigo-800/50">
                  <Bell size={22} />
                  {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full animate-pulse"></span>}
                </button>
                {notificationsOpen && (
                  <div className="absolute right-0 mt-4 w-96 bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl border dark:border-slate-700 z-50 animate-fade-in overflow-hidden">
                    <div className="p-6 border-b dark:border-slate-700 flex justify-between bg-gray-50/50 dark:bg-slate-900/20 items-center">
                      <h3 className="font-black text-xs uppercase tracking-[0.2em] text-gray-400">Notificaciones</h3>
                      <div className="flex items-center gap-3">
                        {notifications.length > 0 && <button onClick={handleClearAllNotifications} className="text-[10px] text-red-500 font-black uppercase hover:bg-red-50 px-3 py-1.5 rounded-xl transition">Limpiar</button>}
                        <button onClick={() => setNotificationsOpen(false)} className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Cerrar</button>
                      </div>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                      {notifications.length === 0 ? <p className="p-12 text-center text-gray-400 text-xs font-bold italic uppercase tracking-widest">Sin alertas</p> : [...notifications].sort((a,b)=>b.created_at-a.created_at).map(not => (
                        <div key={not.id} onClick={() => handleNotificationClick(not)} className="group/notif relative border-b dark:border-slate-700 hover:bg-indigo-50/50 dark:hover:bg-slate-700/50 transition cursor-pointer p-6">
                           <p className="text-sm font-bold text-gray-800 dark:text-white leading-snug">{not.message}</p>
                           <p className="text-[10px] text-indigo-500 mt-2 uppercase font-black tracking-widest">{new Date(not.created_at).toLocaleString()}</p>
                           <button onClick={(e) => { e.stopPropagation(); handleDeleteNotification(not.id); }} className="absolute top-6 right-4 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover/notif:opacity-100 transition-all"><X size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button onClick={() => setDarkMode(!darkMode)} className="p-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-2xl transition shadow-md border border-gray-100 dark:border-slate-700/50 active:scale-95">{darkMode ? <Sun size={22} /> : <Moon size={22} />}</button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-10 custom-scrollbar">
             <div className="max-w-7xl mx-auto space-y-10 pb-20">
               {activeTab === 'dashboard' && <DashboardView profile={activeProfile} activities={activities} submissions={submissions} events={events} notifications={notifications} setActiveTab={setActiveTab} users={users} news={news} />}
               {activeTab === 'news' && <NewsView profile={activeProfile} news={news} showToast={showToast} createNotification={createNotification} comments={comments} addOptimistic={addOptimistic} updateOptimistic={updateOptimistic} removeOptimistic={removeOptimistic} replaceOptimistic={replaceOptimistic} />}
               {activeTab === 'forum' && <ForumView profile={activeProfile} users={users} forum={forum} showToast={showToast} createNotification={createNotification} comments={comments} fetchFullRecord={fetchFullRecord} addOptimistic={addOptimistic} updateOptimistic={updateOptimistic} removeOptimistic={removeOptimistic} />}
               {activeTab === 'entregas' && <ActivitiesView profile={activeProfile} activities={activities} submissions={submissions} users={users} showToast={showToast} createNotification={createNotification} selectedResourceId={selectedResourceId} playSound={playSound} comments={comments} fetchFullRecord={fetchFullRecord} addOptimistic={addOptimistic} updateOptimistic={updateOptimistic} replaceOptimistic={replaceOptimistic} />}
               {activeTab === 'grades' && <GradesView profile={activeProfile || profile} activities={activities} submissions={submissions} users={users} attendance={attendance} events={events} gradingConfigs={gradingConfigs} playSound={playSound} comments={comments} fetchFullRecord={fetchFullRecord} updateOptimistic={updateOptimistic} />}
               {activeTab === 'settings' && <ClassSettingsView profile={activeProfile || profile} gradingConfigs={gradingConfigs} playSound={playSound} language={language} updateOptimistic={updateOptimistic} />}
               {activeTab === 'calendar' && <CalendarView profile={activeProfile} events={events} users={users} showToast={showToast} createNotification={createNotification} selectedResourceId={selectedResourceId} attendance={attendance} addOptimistic={addOptimistic} updateOptimistic={updateOptimistic} removeOptimistic={removeOptimistic} replaceOptimistic={replaceOptimistic} />}
               {activeTab === 'materials' && <MaterialsView profile={activeProfile} materials={materials} showToast={showToast} createNotification={createNotification} />}
               {activeTab === 'codelab' && <CodeLabView profile={activeProfile} showToast={showToast} savedCodes={savedCodes} savedNotes={savedNotes} fetchFullRecord={fetchFullRecord} />}
               {activeTab === 'chat' && <ChatView profile={activeProfile} users={users} createNotification={createNotification} onOpenCall={(call) => setActiveCall(call)} callLogs={callLogs} onOpenProfile={(id) => { setActiveTab('profile'); setSelectedResourceId(id); playSound('click'); }} showToast={showToast} globalMessages={globalMessages} />}
               {activeTab === 'feedback' && <FeedbackView profile={profile} feedback={feedback} users={users} showToast={showToast} createNotification={createNotification} comments={comments} addOptimistic={addOptimistic} updateOptimistic={updateOptimistic} removeOptimistic={removeOptimistic} replaceOptimistic={replaceOptimistic} />}
               {activeTab === 'changelog' && <ChangelogView profile={profile} changelog={changelog} addOptimistic={addOptimistic} updateOptimistic={updateOptimistic} removeOptimistic={removeOptimistic} replaceOptimistic={replaceOptimistic} />}
               
               {activeTab === 'admin' && isDeveloper && (
                 <AdminPanelView 
                    profile={profile} 
                    allUsers={allUsers} 
                    feedback={feedback} 
                    changelog={changelog} 
                    comments={comments} 
                    showToast={showToast} 
                    fetchFullRecord={fetchFullRecord}
                    handleKickUser={handleKickUser} 
                    handleBanUser={handleBanUser} 
                    updateAnyUserProfile={updateAnyUserProfile} 
                    globalSettings={globalSettings} 
                    handleLogout={handleLogout}
                    setSpectatingProfile={setSpectatingProfile}
                    spectatingProfile={spectatingProfile}
                    setActiveTab={setActiveTab}
                    addOptimistic={addOptimistic}
                    updateOptimistic={updateOptimistic}
                    removeOptimistic={removeOptimistic}
                    replaceOptimistic={replaceOptimistic}
                 />
               )}
               
               {activeTab === 'profile' && (() => {
                   const viewingProfile = selectedResourceId ? (users.find(u => u.id === selectedResourceId) || activeProfile) : activeProfile;
                   const isOwnProfile = viewingProfile.id === profile.id;
                   return <ProfileView 
                     profile={viewingProfile} 
                     isOwnProfile={isOwnProfile}
                     updateProfileData={updateProfileData} 
                     handleDeleteAccount={handleDeleteAccount} 
                     showToast={showToast} 
                     attendance={attendance} 
                     events={events} 
                     currentUserRole={profile.role}
                     handlePasswordChange={handlePasswordChange}
                     handleAdminResetPassword={handleAdminResetPassword}
                     users={allUsers}
                   />;
               })()}
             </div>
          </div>
        </main>
        
        {/* OVERLAYS */}
        {activeQuiz && <QuizPlayer quiz={activeQuiz} profile={profile} showToast={showToast} onFinish={() => setActiveQuiz(null)} />}
        {activeCall && <MeetingOverlay call={activeCall} profile={profile} onClose={() => setActiveCall(null)} />}
        <Toast toast={toast} />
    </div>
  );
}
