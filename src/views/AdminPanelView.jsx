import React, { useState, useMemo } from 'react';
import { 
  Users, MessageSquare, Shield, Settings, Search, 
  Trash2, UserX, UserCheck, Power, History, 
  Edit3, CheckCircle, AlertOctagon, ChevronRight, 
  MoreVertical, RefreshCw, Eye, Download, LogOut,
  AlertTriangle, Filter, HardDrive, Clock, X, Plus
} from 'lucide-react';
import { useSettings } from '../hooks/SettingsContext';
import { logAdminAction } from '../utils/auditUtils';
import api from '../config/api';

export default function AdminPanelView({ 
  profile: devProfile, 
  allUsers = [], 
  feedback = [], 
  changelog = [], 
  comments = [],
  showToast,
  handleKickUser,
  handleBanUser,
  updateAnyUserProfile,
  globalSettings,
  handleLogout,
  setSpectatingProfile,
  spectatingProfile,
  setActiveTab,
  addOptimistic,
  updateOptimistic,
  replaceOptimistic
}) {
  const { t, language } = useSettings();
  const [activeSubTab, setActiveSubTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  
  // Advanced Dev State
  const [securityLists, setSecurityLists] = useState({ whitelist: [], blacklist: [] });
  const [isEditingUserData, setIsEditingUserData] = useState(null);
  const [userDataJson, setUserDataJson] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Pagination/Filter State
  const [userFilter, setUserFilter] = useState('all'); // all, professors, students, banned

  // Load Audit Logs
  React.useEffect(() => {
    if (activeSubTab === 'security') {
       // Suscribirse a logs de auditoría
        const fetchAuditLogs = async () => {
          try {
            const { data } = await api.get('/data/audit_logs?_limit=100&_sort=created_at:desc');
            if (data) setAuditLogs(data);
          } catch (e) { console.error(e); }
        };

        const fetchSecurityLists = async () => {
          try {
            const { data: white } = await api.get('/data/settings?key=security_whitelist');
            const { data: black } = await api.get('/data/settings?key=security_blacklist');
            
            setSecurityLists({
              whitelist: white?.[0]?.value?.emails || [],
              blacklist: black?.[0]?.value?.emails || []
            });
          } catch (e) { console.error(e); }
        };

        fetchAuditLogs();
        fetchSecurityLists();

        return () => {};
    }
  }, [activeSubTab]);

  const filteredUsers = useMemo(() => {
    let result = allUsers.filter(u => 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (userFilter === 'professors') result = result.filter(u => u.role === 'profesor');
    if (userFilter === 'students') result = result.filter(u => u.role === 'estudiante');
    if (userFilter === 'banned') result = result.filter(u => u.is_banned);
    return result;
  }, [allUsers, searchTerm, userFilter]);

  const handleMaintenanceToggle = async () => {
    const newVal = !globalSettings.maintenanceMode;
    const ok = window.confirm(`¿Estás seguro de ${newVal ? 'ACTIVAR' : 'DESACTIVAR'} el modo mantenimiento?`);
    if (!ok) return;
    
    // UI Optimista: Cambiamos el toggle de inmediato
    const optimisticSettings = { ...globalSettings, maintenanceMode: newVal };
    updateOptimistic('settings', 'global', { value: optimisticSettings });

    try {
      await api.post('/data/settings', { 
          key: 'global', 
          value: optimisticSettings
      });
      
      await logAdminAction(devProfile, 'toggle_maintenance', 'global_settings', { mode: !newVal }, { mode: newVal });
      showToast(newVal ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado');
    } catch (e) { 
      console.error(e); 
      // Revertir si falla (opcional, Supabase Realtime lo corregirá eventualmente)
    }
  };

  const handleUserAction = async (user, actionType) => {
    let confirmMsg = '';
    let actionFn = null;

    if (actionType === 'kick') {
      confirmMsg = `¿Cerrar sesión forzosamente para ${user.name}?`;
      actionFn = () => handleKickUser(user.id);
    } else if (actionType === 'ban') {
      confirmMsg = `¿BANEAR permanentemente a ${user.name}?`;
      actionFn = () => handleBanUser(user.id, true);
    } else if (actionType === 'unban') {
      confirmMsg = `¿Remover ban de ${user.name}?`;
      actionFn = () => handleBanUser(user.id, false);
    } else if (actionType === 'delete') {
      confirmMsg = `⚠️ ADVERTENCIA: ¿ELIMINAR COMPLETAMENTE a ${user.name}? Esta acción es irreversible.`;
      actionFn = async () => {
        await api.delete(`/data/profiles/${user.id}`);
        return true;
        return true;
      };
    }

    if (window.confirm(confirmMsg)) {
       const ok = await actionFn();
       if (ok) {
         await logAdminAction(devProfile, actionType, user.id, user, { ...user, action: actionType });
         showToast(`Acción ${actionType} completada con éxito`);
       }
    }
  };

  const handleUpdateSecurityList = async (type, email, action) => {
    try {
      const dbKey = `security_${type}`;
      const currentList = securityLists[type];
      let newList = [...currentList];
      
      if (action === 'add') {
        if (!email || newList.includes(email)) return;
        newList.push(email);
      } else {
        newList = newList.filter(e => e !== email);
      }

      await api.post('/data/settings', { 
          key: dbKey, 
          value: { emails: newList } 
      });
      
      setSecurityLists(prev => ({ ...prev, [type]: newList }));
      await logAdminAction(devProfile, `update_${type}`, 'global_security', { emails: currentList }, { emails: newList });
      showToast(`${type} actualizada`);
    } catch (e) { console.error(e); }
  };

  const handleSaveUserData = async () => {
    if (!isEditingUserData) return;
    setIsSavingUser(true);
    try {
      const parsedData = JSON.parse(userDataJson);
      await updateAnyUserProfile(isEditingUserData.id, parsedData);
      await logAdminAction(devProfile, 'master_edit_user', isEditingUserData.id, isEditingUserData, parsedData);
      showToast('Datos de usuario modificados');
      setIsEditingUserData(null);
    } catch (e) {
      showToast('Error en formato JSON', 'error');
    } finally {
      setIsSavingUser(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] animate-fade-in gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <Shield className="text-indigo-600" size={32} /> {language === 'es' ? 'GOD MODE (Developer)' : 'GOD MODE (Developer)'}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Control total sobre la arquitectura, usuarios y seguridad de la plataforma.</p>
        </div>
        <div className="flex items-center gap-2 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
           {['users', 'feedback', 'system', 'security'].map(tab => (
             <button 
              key={tab} 
              onClick={() => setActiveSubTab(tab)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
             >
               {tab}
             </button>
           ))}
        </div>
         {spectatingProfile && (
           <button 
            onClick={() => { setSpectatingProfile(null); showToast('Modo Inspector finalizado'); }}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg"
           >
              <Eye size={16} /> Salir del Modo Inspector
           </button>
         )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col glass-card border-none rounded-[3rem] shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
        
        {/* TAB: USERS MANAGEMENT */}
        {activeSubTab === 'users' && (
          <div className="flex flex-col h-full">
            <div className="p-8 border-b dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between">
               <div className="relative max-w-md w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre o email..."
                    className="w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
               </div>
               <div className="flex gap-2">
                 {['all', 'professors', 'students', 'banned'].map(f => (
                   <button 
                    key={f}
                    onClick={() => setUserFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${userFilter === f ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-gray-400'}`}
                   >
                     {f}
                   </button>
                 ))}
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map(user => (
                    <div key={user.id} className="p-6 bg-white dark:bg-slate-800/50 rounded-[2rem] border border-gray-50 dark:border-slate-700/50 hover:shadow-xl transition-all group relative">
                       <div className="flex items-center gap-4 mb-4">
                          {user.photoURL || user.photo_url ? <img src={user.photoURL || user.photo_url} className="w-12 h-12 rounded-2xl object-cover" /> : <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-black">{user.name?.charAt(0)}</div>}
                          <div className="flex-1 overflow-hidden">
                             <h3 className="text-sm font-black text-gray-900 dark:text-white truncate">{user.name}</h3>
                             <p className="text-[10px] text-gray-400 font-bold truncate">{user.email}</p>
                          </div>
                          <div className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${user.role === 'profesor' ? 'bg-purple-100 text-purple-600' : 'bg-emerald-100 text-emerald-600'}`}>
                             {user.role}
                          </div>
                       </div>
                       
                       <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700">
                          <div className="flex gap-1">
                             <button onClick={() => handleUserAction(user, 'kick')} className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 rounded-lg transition-colors" title="Expulsar Sesión"><Power size={14} /></button>
                             <button onClick={() => handleUserAction(user, user.is_banned ? 'unban' : 'ban')} className={`p-2 ${user.is_banned ? 'text-emerald-500 hover:bg-emerald-50' : 'text-red-500 hover:bg-red-50'} dark:hover:bg-opacity-10 rounded-lg transition-colors`} title={user.is_banned ? 'Desbanear' : 'Banear'}>{user.is_banned ? <UserCheck size={14} /> : <UserX size={14} />}</button>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => { setSpectatingProfile(user); showToast(`Inspeccionando a ${user.name}`); }} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:underline"><Eye size={12} className="inline mr-1" /> Inspect</button>
                              <button onClick={() => { setIsEditingUserData(user); setUserDataJson(JSON.stringify(user, null, 2)); }} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:underline"><Edit3 size={12} className="inline mr-1" /> Editar Datos</button>
                           </div>
                        </div>

                        { user.is_banned && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white px-2 py-0.5 rounded-md text-[8px] font-black uppercase">
                             <AlertOctagon size={10} /> BANNED
                          </div>
                       )}
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* TAB: FEEDBACK MODERATION */}
        {activeSubTab === 'feedback' && (
          <div className="flex flex-col h-full p-8 overflow-y-auto">
             <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600"><MessageSquare size={32}/></div>
                <div>
                   <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Moderación de Feedback</h2>
                   <p className="text-xs text-gray-400 font-medium">Gestiona reportes, comentarios y visibilidad del sistema.</p>
                </div>
             </div>
             
             <div className="space-y-4">
                {feedback.map(report => (
                   <div key={report.id} className="flex flex-col md:flex-row md:items-center gap-6 p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border dark:border-slate-800">
                      <div className="flex-1">
                         <div className="flex items-center gap-3 mb-2">
                            <span className="text-[10px] font-black text-gray-400">[{report.reportId}]</span>
                            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded">{report.status}</span>
                         </div>
                         <h4 className="text-sm font-black dark:text-white">{report.title}</h4>
                         <p className="text-xs text-slate-500 font-medium">{report.authorName} • {new Date(report.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                         <button className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Cambiar Estado</button>
                         <button onClick={async () => {
                           if (window.confirm('¿Eliminar este reporte definitivamente?')) {
                             await api.delete(`/data/feedback/${report.id}`);
                             await logAdminAction(devProfile, 'delete_report', report.id, report);
                             showToast('Reporte eliminado');
                           }
                         }} className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16}/></button>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {/* TAB: SYSTEM SETTINGS */}
        {activeSubTab === 'system' && (
          <div className="flex flex-col h-full p-8 overflow-y-auto space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* MANTENIMIENTO */}
                <div className="glass-card p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 space-y-6">
                   <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl ${globalSettings.maintenanceMode ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                         <Power size={32} />
                      </div>
                      <div className="flex-1">
                         <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Modo Mantenimiento</h3>
                         <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                            Estado: {globalSettings.maintenanceMode ? 'ACTIVO (Acceso normal bloqueado)' : 'INACTIVO'}
                         </p>
                      </div>
                      <button 
                        onClick={handleMaintenanceToggle}
                        className={`w-14 h-8 rounded-full relative transition-colors ${globalSettings.maintenanceMode ? 'bg-red-500' : 'bg-gray-300 dark:bg-slate-700'}`}
                      >
                         <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${globalSettings.maintenanceMode ? 'right-1' : 'left-1'} shadow-md`}></div>
                      </button>
                   </div>
                   <p className="text-xs text-gray-500 dark:text-slate-400 italic">
                      Activa esto solo cuando necesites realizar cambios estructurales profundos o corregir fallos críticos. Los desarrolladores mantendrán su acceso.
                   </p>
                </div>

                {/* CHANGELOG CRUD PREVIEW */}
                <div className="glass-card p-8 rounded-[3rem] border border-gray-100 dark:border-slate-800 space-y-6">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl text-indigo-600"><History size={32}/></div>
                          <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">Changelog Manager</h3>
                      </div>
                       <button onClick={() => setActiveSubTab('feedback')} className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/30 hover-spring"><MessageSquare size={20}/></button>
                   </div>
                    <p className="text-xs text-gray-500 italic">Aquí podrás gestionar todas las versiones y cambios publicados en la plataforma.</p>
                    <button 
                      onClick={async () => {
                        try {
                          const nowISO = new Date().toISOString();
                          const data = {
                            version: '0.2.0v',
                            date: '2026-04-08',
                            new: ['Sistema de Presencia Real-time', 'Gestión Granular de Reuniones', 'Lista de Asistencia'],
                            improvements: ['Optimización de Asignaciones', 'Enriquecimiento de Calendario', 'Rendimiento de Inicio de Sesión'],
                            fixes: ['Sincronización Atómica', 'Precisión de Logs', 'Estabilidad Visual'],
                            created_at: nowISO
                          };

                          // Salto Optimista
                          const tempIdStr = `temp-${Date.now()}`;
                          addOptimistic('changelog', { ...data, id: tempIdStr, is_optimistic: true });

                          const { data: realRecord } = await api.post('/data/changelog', data);
                          replaceOptimistic('changelog', tempIdStr, realRecord);
                          showToast('Changelog inicializado con éxito');
                        } catch (e) { console.error(e); showToast('Error al inicializar'); }
                      }}
                      className="w-full mt-4 py-3 bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                    >
                      <RefreshCw size={14} className="inline mr-2" /> Forzar Inicialización de Datos
                    </button>
                </div>
             </div>

             <div className="p-8 bg-slate-900 rounded-[3rem] text-white space-y-6 border border-slate-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity"><HardDrive size={120}/></div>
                <h3 className="text-xl font-black uppercase tracking-tight">Acciones Masivas y Datos</h3>
                <div className="flex flex-wrap gap-4">
                   <button className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-sm font-bold transition-all border border-white/10 uppercase tracking-widest">
                      <Download size={18}/> Exportar DB Completa (JSON)
                   </button>
                   <button className="flex items-center gap-2 px-6 py-3 border-2 border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white rounded-2xl text-sm font-bold transition-all uppercase tracking-widest">
                      <AlertTriangle size={18}/> Invalidar TODAS las sesiones
                   </button>
                </div>
             </div>
          </div>
        )}

        {/* TAB: AUDIT LOGS / SECURITY */}
        {activeSubTab === 'security' && (
          <div className="flex flex-col h-full overflow-hidden">
             <div className="p-8 border-b dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-600 font-black"><AlertTriangle size={32}/></div>
                   <div>
                      <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Auditoría del Sistema</h2>
                      <p className="text-xs text-gray-400 font-medium">Registros críticos de acciones administrativas realizadas por devs y admins.</p>
                   </div>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="p-3 bg-gray-100 dark:bg-slate-800 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all" title="Refrescar logs"
                >
                  <RefreshCw size={20} />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <table className="w-full text-left">
                   <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b dark:border-slate-800">
                         <th className="px-6 py-4">Admin</th>
                         <th className="px-6 py-4">Acción</th>
                         <th className="px-6 py-4">Entidad</th>
                         <th className="px-6 py-4 text-right">Fecha</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                      {auditLogs.map(log => (
                        <tr 
                          key={log.id} 
                          onClick={() => setSelectedLog(log)}
                          className="hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        >
                           <td className="px-6 py-4">
                              <div className="flex flex-col">
                                 <span className="text-xs font-black text-gray-800 dark:text-white">{log.admin_name}</span>
                                 <span className="text-[9px] text-gray-400 uppercase font-black tracking-widest leading-none">{log.admin_role}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${log.action.includes('delete') || log.action.includes('ban') ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                 {log.action}
                              </span>
                           </td>
                           <td className="px-6 py-4">
                              <span className="text-[9px] font-mono text-gray-400">{log.entity_id}</span>
                           </td>
                           <td className="px-6 py-4 text-right text-[10px] font-medium text-gray-500">
               {new Date(log.created_at).toLocaleString()}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                 </table>
              </div>

              {/* LIST MANAGEMENT SECTIONS */}
              <div className="p-8 border-t dark:border-slate-700 bg-gray-50/30 dark:bg-slate-900/10 grid grid-cols-1 md:grid-cols-2 gap-8">
                 {['whitelist', 'blacklist'].map(type => (
                   <div key={type} className="space-y-4">
                      <div className="flex items-center justify-between">
                         <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                           {type === 'whitelist' ? <CheckCircle size={16} className="text-emerald-500"/> : <AlertTriangle size={16} className="text-red-500"/>}
                           {type}
                         </h3>
                         <span className="text-[10px] font-bold text-gray-400">{securityLists[type].length} emails</span>
                      </div>
                      <div className="flex gap-2">
                         <input 
                           id={`new-${type}-email`}
                           placeholder="Añadir email..."
                           className="flex-1 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                           onKeyDown={(e) => { if (e.key === 'Enter') { handleUpdateSecurityList(type, e.target.value, 'add'); e.target.value = ''; } }}
                         />
                         <button onClick={() => { const el = document.getElementById(`new-${type}-email`); handleUpdateSecurityList(type, el.value, 'add'); el.value = ''; }} className="p-2 bg-indigo-600 text-white rounded-xl"><Plus size={16}/></button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                         {securityLists[type].map(email => (
                           <div key={email} className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg text-[10px] font-medium group">
                              {email}
                              <button onClick={() => handleUpdateSecurityList(type, email, 'remove')} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"><X size={12}/></button>
                           </div>
                         ))}
                      </div>
                   </div>
                 ))}
              </div>
          </div>
        )}
      </div>

      {/* MODAL: MASTER USER DATA EDITOR */}
      {isEditingUserData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
           <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl relative flex flex-col max-h-[90vh]">
              <div className="absolute top-0 left-0 w-full h-2 bg-purple-600"></div>
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-2xl font-black uppercase tracking-tighter">Master Data Editor</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Editando a: {isEditingUserData.name}</p>
                 </div>
                 <button onClick={() => setIsEditingUserData(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={24}/></button>
              </div>
              
              <div className="flex-1 overflow-hidden flex flex-col space-y-4">
                 <div className="flex-1 bg-slate-900 rounded-2xl p-4 overflow-hidden flex flex-col">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">RAW JSON (慎重に編集してください)</p>
                    <textarea 
                      value={userDataJson}
                      onChange={e => setUserDataJson(e.target.value)}
                      className="flex-1 bg-transparent text-emerald-400 font-mono text-xs outline-none resize-none custom-scrollbar"
                    />
                 </div>
                 <div className="bg-amber-100 dark:bg-amber-900/20 p-4 rounded-xl flex gap-3 items-start">
                    <AlertTriangle size={24} className="text-amber-600 shrink-0" />
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold leading-tight">
                       ADVERTENCIA: Estás modificando directamente el documento de Supabase. 
                       Asegúrate de que el JSON sea válido y que los campos coincidan con la estructura esperada por la App.
                    </p>
                 </div>
              </div>

              <div className="pt-6 grid grid-cols-2 gap-4">
                 <button onClick={() => setIsEditingUserData(null)} className="py-4 border-2 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all">Cancelar</button>
                 <button 
                  onClick={handleSaveUserData}
                  disabled={isSavingUser}
                  className="py-4 bg-purple-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2"
                 >
                    {isSavingUser ? <RefreshCw className="animate-spin" size={16}/> : <HardDrive size={16}/>}
                    Guardar Cambios Maestros
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in" onClick={() => setSelectedLog(null)}>
           <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
              <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter">Detalles del Log</h2>
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl">
                       <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Admin</p>
                       <p className="font-bold">{selectedLog.admin_name} ({selectedLog.admin_role})</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl">
                       <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Fecha</p>
                       <p className="font-bold">{new Date(selectedLog.created_at).toLocaleString()}</p>
                    </div>
                 </div>
                 
                 <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-2xl">
                    <p className="text-[9px] font-black text-gray-400 uppercase mb-2">Acción Realizada</p>
                    <p className="font-mono text-indigo-600 font-bold">{selectedLog.action}</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4 h-64">
                    <div className="flex flex-col space-y-2">
                       <p className="text-[9px] font-black text-gray-400 uppercase">Antes (Previo)</p>
                       <pre className="flex-1 bg-gray-100 dark:bg-slate-900 p-4 rounded-xl text-[9px] overflow-auto font-mono text-gray-500">
                          {JSON.stringify(selectedLog.before, null, 2)}
                       </pre>
                    </div>
                    <div className="flex flex-col space-y-2">
                       <p className="text-[9px] font-black text-gray-400 uppercase">Después (Nuevo)</p>
                       <pre className="flex-1 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl text-[9px] overflow-auto font-mono text-indigo-600">
                          {JSON.stringify(selectedLog.after, null, 2)}
                       </pre>
                    </div>
                 </div>

                 <button onClick={() => setSelectedLog(null)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">Cerrar Detalle</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
