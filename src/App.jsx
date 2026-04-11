import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, Globe, Menu, Settings, Bell, Sun, Moon, LogOut, 
  LayoutDashboard, FileText, Award, Calendar, MessageSquare, 
  User, Code2, Trash2, MessageCircle, History, Shield, 
  ShieldCheck, Eye, X, AlertTriangle, Video, Phone, ExternalLink, Pin, Edit3, RefreshCw, HardDrive, Download
} from 'lucide-react';
import { useAppAuth } from './hooks/useAppAuth';
import { useAppData } from './hooks/useAppData';
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
import MaintenanceView from './views/MaintenanceView';

import api from './config/api';
import socket from './config/socket';

// INTERRUPTOR DE MANTENIMIENTO MANUAL (Cambiar a true para forzar mantenimiento global)
const FORCE_MAINTENANCE_MODE = false;

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
  } = useAppData(user);

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
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({ maintenanceMode: FORCE_MAINTENANCE_MODE });
  
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

  const handleClearAllNotifications = async () => {
    try {
      // Usar el nuevo endpoint de borrado masivo
      await api.delete('/data/notifications/bulk');
      if (notificationsOpen) setNotificationsOpen(false);
      showToast(language === 'es' ? 'Notificaciones limpiadas' : 'Notifications cleared');
    } catch (e) {
      console.error("Error clearing notifications:", e);
      showToast('Error al limpiar notificaciones', 'error');
    }
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

  // Maintenance Mode Screen (Blocks Public Access)
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if ((FORCE_MAINTENANCE_MODE || globalSettings.maintenanceMode) && !isDeveloper && !isLocal) {
    return <MaintenanceView handleLogout={handleLogout} />;
  }

  // stable sub-components to prevent focus loss on re-renders
  const AuthUI = () => (
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
                 handleEmailRegister(email, password).catch(err => setAuthError(err.response?.data?.error || err.message));
               } else {
                 handleEmailLogin(email, password).catch(err => setAuthError(err.response?.data?.error || err.message));
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

  if (!user || !profile || profile?.is_setup !== true) {
    return <AuthUI />;
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
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-500">
        
        {/* SIDEBAR AURA */}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-72 aura-glass border-r border-slate-200 dark:border-slate-800/50 transition-all duration-300 flex flex-col shadow-2xl lg:shadow-none`}>
          <div className="p-8 flex items-center gap-4 group cursor-pointer" onClick={() => { setActiveTab('dashboard'); playSound('click'); }}>
             <div className="p-3 aura-gradient-primary rounded-2xl shadow-xl shadow-indigo-500/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
             </div>
             <div>
                <span className="font-black text-xl tracking-tighter uppercase font-display block leading-none">Python Master</span>
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-500 opacity-60">Aura Intelligence</span>
             </div>
          </div>

          <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar pb-8">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id} onClick={() => { setActiveTab(item.id); setSelectedResourceId(null); setSidebarOpen(false); playSound('click'); }}
                  className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 relative group focus-visible:ring-inset ${isActive ? 'aura-gradient-primary text-white next-gen-shadow font-bold' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-indigo-600'}`}
                >
                  <Icon size={20} className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : ''}`} />
                  <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis text-[11px] font-black uppercase tracking-[0.15em]">{item.label}</span>
                  {item.badge > 0 && <span className="absolute right-4 bg-rose-500 shadow-lg shadow-rose-500/30 text-white text-[9px] h-5 w-5 rounded-full flex items-center justify-center font-black animate-bounce-in">{item.badge}</span>}
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
        {sidebarOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40 lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />}

        {/* MAIN CONTENT AURA */}
        <main className={`flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-500`}>
          <header className="h-24 bg-white/50 dark:bg-slate-950/50 backdrop-blur-2xl border-b border-slate-100 dark:border-slate-800/50 flex items-center justify-between px-10 z-30 shrink-0 sticky top-0">
            <div className="flex items-center gap-8">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden text-slate-500 p-3 -ml-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"><Menu size={24} /></button>
              {spectatingProfile && (
                <div className="flex items-center gap-3 px-6 py-2.5 aura-gradient-primary text-white rounded-2xl animate-pulse shadow-xl shadow-indigo-500/30">
                   <Eye size={18} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Watching: {spectatingProfile.name}</span>
                   <button onClick={() => setSpectatingProfile(null)} className="ml-3 hover:scale-125 transition-transform"><X size={16}/></button>
                </div>
              )}
              <div className="hidden sm:flex flex-col">
                <h2 className="text-2xl font-black tracking-tighter uppercase font-display text-slate-900 dark:text-white leading-none">
                  {menuItems.find(i => i.id === activeTab)?.label}
                </h2>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1.5 opacity-80">Python Master / {activeTab}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                data-tooltip="Activity Hub"
                onClick={() => { setRightPanelOpen(!rightPanelOpen); playSound('click'); }} 
                className={`p-4 rounded-2xl transition-all relative hover:scale-105 active:scale-95 shadow-lg border ${rightPanelOpen ? 'aura-gradient-primary text-white border-transparent' : 'text-indigo-600 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
              >
                {unreadMessagesCount + notifications.length > 0 ? <Bell size={20} className="animate-wiggle" /> : <MessageSquare size={20} />}
                {unreadMessagesCount + notifications.length > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse"></span>}
              </button>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden md:block"></div>
              <button onClick={() => setDarkMode(!darkMode)} className="p-4 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition shadow-lg border border-slate-100 dark:border-slate-800 active:scale-95">{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 sm:p-12 custom-scrollbar bg-slate-50/20 dark:bg-slate-900/20">
             <div className="max-w-7xl mx-auto space-y-12 pb-24">
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

        {/* RIGHT PANEL AURA (ZERO-OVERLAP) */}
        <aside className={`${rightPanelOpen ? 'translate-x-0 w-96' : 'translate-x-full lg:w-0'} fixed lg:static top-0 right-0 z-50 h-full bg-white dark:bg-slate-900 border-l border-slate-100 dark:border-slate-800 transition-all duration-500 flex flex-col shadow-2xl overflow-hidden`}>
            <div className="p-8 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50 shrink-0">
                <div>
                  <h3 className="text-lg font-black tracking-tighter uppercase font-display">Hub de Actividad</h3>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Sincronizado en tiempo real</p>
                </div>
                <button onClick={() => setRightPanelOpen(false)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all">
                  <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 w-96">
                {/* Notifications Mini-Feed */}
                <section className="space-y-4">
                   <div className="flex items-center justify-between px-2">
                     <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Notificaciones</h4>
                     {notifications.length > 0 && <button onClick={handleClearAllNotifications} className="text-[9px] font-black text-rose-500 uppercase hover:underline">Limpiar</button>}
                   </div>
                   {notifications.length === 0 ? (
                      <div className="p-10 aura-card border-dashed border-2 border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center opacity-40">
                         <Bell size={24} className="mb-2 text-slate-400" />
                         <p className="text-[10px] uppercase font-black text-slate-500">Todo al día</p>
                      </div>
                   ) : (
                      <div className="space-y-3">
                         {notifications.slice(0, 5).map(not => (
                            <div key={not.id} onClick={() => handleNotificationClick(not)} className="p-4 aura-card !rounded-2xl border-transparent bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl cursor-pointer transition-all group">
                               <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-snug">{not.message}</p>
                               <div className="flex items-center justify-between mt-3">
                                  <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{new Date(not.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteNotification(not.id); }} className="opacity-0 group-hover:opacity-100 text-rose-500 transition-all"><Trash2 size={12} /></button>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </section>

                <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2"></div>

                {/* Presence / Quick Chat Hook */}
                <section className="space-y-6">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 px-2">Comunidad Online</h4>
                   <div className="space-y-4">
                      {users.filter(u => u.id !== profile.id && isUserOnline(u)).slice(0, 6).map(u => (
                         <div key={u.id} className="flex items-center gap-4 p-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all cursor-pointer group" onClick={() => { setActiveTab('chat'); setRightPanelOpen(false); }}>
                            <div className="relative">
                               {u.photoURL ? <img src={u.photoURL} alt="P" className="w-10 h-10 rounded-[1.25rem] object-cover shadow-md" /> : <div className="w-10 h-10 rounded-[1.25rem] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center font-black text-xs uppercase">{u.name?.charAt(0) || '?'}</div>}
                               <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                            </div>
                            <div className="flex-1">
                               <p className="text-[10px] font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">{u.name}</p>
                               <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">En Línea</span>
                            </div>
                            <MessageCircle size={14} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                         </div>
                      ))}
                      {users.filter(u => u.id !== profile.id && isUserOnline(u)).length === 0 && (
                         <p className="text-center py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">No hay nadie más conectado</p>
                      )}
                   </div>
                </section>

                <button onClick={() => { setActiveTab('chat'); setRightPanelOpen(false); }} className="w-full py-4 aura-gradient-primary text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.25em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] transition-all">
                   Abrir Mensajería Completa
                </button>
            </div>
        </aside>

        {/* OVERLAYS */}
        {activeQuiz && <QuizPlayer quiz={activeQuiz} profile={profile} showToast={showToast} onFinish={() => setActiveQuiz(null)} />}
        {activeCall && <MeetingOverlay call={activeCall} profile={profile} onClose={() => setActiveCall(null)} />}
        <Toast toast={toast} />
    </div>
  );
}
