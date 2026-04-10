import React from 'react';
import { Users, FileText, Video, Bell, MessageSquare, ArrowRight, Calendar, Clock, CheckSquare } from 'lucide-react';
import { useSettings } from '../hooks/SettingsContext';
import { isUserOnline, formatLastSeen } from '../utils/presenceUtils';

export default function DashboardView({ 
  profile, 
  activities = [], 
  submissions = [], 
  events = [], 
  notifications = [], 
  setActiveTab, 
  users = [], 
  news = [] 
}) {
  const { language } = useSettings();
  
  if (!profile) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 font-bold animate-pulse">{language === 'es' ? 'Cargando datos...' : 'Loading data...'}</p>
    </div>
  );

  // Seguridad extra: si el perfil existe pero no tiene rol, forzamos redirección indirecta o estado seguro
  const role = profile?.role || 'estudiante';
  const isTeacher = role === 'profesor';
  
  const upcomingEvents = [...(events || [])]
    .filter(e => 
      e.assignedTo?.includes('all') || 
      e.assignedTo?.includes(profile.id) || 
      e.authorId === profile.id ||
      isTeacher
    )
    .sort((a,b) => new Date(a.date || a.startDate) - new Date(b.date || b.startDate))
    .filter(e => new Date(e.date || e.startDate) >= new Date())
    .slice(0, 3);
  
  const myNotifications = (notifications || []).filter(n => !n.targetUserIds || n.targetUserIds.includes(profile.id));

  const myActivities = isTeacher ? (activities || []) : (activities || []).filter(a => 
    !a.assignedTo || a.assignedTo.length === 0 || a.assignedTo.includes('all') || a.assignedTo.includes(profile.id)
  );

  const studentCount = (users || []).filter(u => u.role === 'estudiante').length;
  const latestNews = [...(news || [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 2);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header Welcome Card */}
      <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-[2.5rem] p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-700"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full -ml-32 -mb-32 blur-3xl"></div>
        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black mb-3 tracking-tighter leading-tight animate-slide-up">
             {language === 'es' ? '¡Hola' : 'Hello'},<br/>
             {profile.name?.split(' ')[0] || (language === 'es' ? 'Colega' : 'Mate')}! 👋
          </h1>
          <p className="text-indigo-100 text-lg sm:text-xl max-w-2xl leading-relaxed font-medium animate-slide-up opacity-90" style={{ animationDelay: '100ms' }}>
            {isTeacher 
              ? (language === 'es' ? 'Bienvenido al centro de mando. Gestiona tus alumnos y actividades con precisión.' : 'Welcome to the command center. Manage your students and activities with precision.')
              : (language === 'es' ? 'Tu viaje en Python continúa hoy. Revisa tus pendientes y prepárate para brillar.' : 'Your Python journey continues today. Check your tasks and get ready to shine.')}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Core Stat Card */}
        <div className="glass-card rounded-[2rem] p-8 hover-spring border border-white/20 shadow-xl overflow-hidden relative group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex items-center gap-5 mb-6">
            <div className={`p-4 rounded-2xl shadow-lg transform transition-all group-hover:rotate-12 ${isTeacher ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'}`}>
              {isTeacher ? <FileText size={32} /> : <CheckSquare size={32} />}
            </div>
            <h3 className="font-black text-xl text-gray-800 dark:text-gray-100 uppercase tracking-tighter">{isTeacher ? (language === 'es' ? 'Revisión' : 'To Grade') : (language === 'es' ? 'Tareas' : 'Tasks')}</h3>
          </div>
          <div className="space-y-1">
            <p className="text-6xl font-black text-gray-900 dark:text-white tracking-widest">
              {isTeacher ? submissions.filter(s => s.status === 'entregado').length : (myActivities.length - (submissions.filter(s => s.studentId === profile.id).length))}
            </p>
            <p className="text-gray-400 dark:text-slate-500 text-xs font-black uppercase tracking-[0.2em]">{isTeacher ? (language === 'es' ? 'Entregas' : 'Submissions') : (language === 'es' ? 'Pendientes' : 'Pending')}</p>
          </div>
        </div>

        {/* Members/Students Card */}
        <div className="glass-card rounded-[2rem] p-8 hover-spring border border-white/20 shadow-xl relative group cursor-pointer" onClick={() => setActiveTab('forum')}>
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex items-center gap-5 mb-6">
            <div className="p-4 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-2xl shadow-lg transform transition-all group-hover:rotate-12">
              <Users size={32} />
            </div>
            <h3 className="font-black text-xl text-gray-800 dark:text-gray-100 uppercase tracking-tighter">{language === 'es' ? 'Comunidad' : 'Community'}</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-6xl font-black text-gray-900 dark:text-white tracking-widest">{studentCount}</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs font-black uppercase tracking-[0.2em]">{language === 'es' ? 'Estudiantes Registrados' : 'Registered Students'}</p>
            </div>
            
            {/* Small list of online users */}
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
               {users
                 .filter(u => u.id !== profile.id && isUserOnline(u))
                 .slice(0, 3)
                 .map(u => (
                    <div key={u.id} className="flex items-center gap-2">
                       <span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
                       <span className="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase truncate">{u.name}</span>
                       <span className="text-[9px] font-bold text-green-500 uppercase ml-auto">ONLINE</span>
                    </div>
                 ))}
               {users.filter(u => u.id !== profile.id && isUserOnline(u)).length === 0 && (
                  <p className="text-[10px] font-bold text-gray-400 italic">
                    {language === 'es' ? 'Nadie en línea ahora' : 'No one online now'}
                  </p>
               )}
            </div>
          </div>
        </div>

        {/* Next Session Card */}
        <div className="glass-card rounded-[2rem] p-8 hover-spring border border-white/20 shadow-xl relative group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
          <div className="flex items-center gap-5 mb-6">
            <div className="p-4 bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 rounded-2xl shadow-lg transform transition-all group-hover:rotate-12">
              <Video size={32} />
            </div>
            <h3 className="font-black text-xl text-gray-800 dark:text-gray-100 uppercase tracking-tighter">{language === 'es' ? 'Siguiente' : 'Next'}</h3>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-hidden">
                 <p className="font-black text-lg text-gray-900 dark:text-white truncate" title={upcomingEvents[0].title}>{upcomingEvents[0].title}</p>
                 <div className="flex items-center gap-2 mt-2">
                    <span className="p-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-lg"><Clock size={12}/></span>
                    <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                       {new Date(upcomingEvents[0].date || upcomingEvents[0].startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                 </div>
              </div>
              <button onClick={() => setActiveTab('calendar')} className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 transition-all focus-visible:ring-inset">
                {language === 'es' ? 'Ir al Calendario' : 'View Schedule'} <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-6">
              <p className="text-gray-400 text-sm font-black uppercase tracking-widest italic">{language === 'es' ? 'Sin sesiones' : 'No sessions'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* News Section */}
        <div className="glass-card rounded-[2.5rem] p-8 md:p-10 flex flex-col border border-white/20 shadow-xl">
          <div className="flex items-center justify-between mb-8 border-b border-gray-100 dark:border-slate-800 pb-6">
            <h3 className="font-black text-2xl flex items-center gap-3 text-gray-900 dark:text-white tracking-tighter">
              <Bell size={24} className="text-indigo-600" /> 
              {language === 'es' ? 'Avisos del Campus' : 'Campus News'}
            </h3>
            <button onClick={() => setActiveTab('news')} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 uppercase tracking-[0.2em] bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-full transition-all">{language === 'es' ? 'Ver todos' : 'View all'}</button>
          </div>
          
          {latestNews.length > 0 ? (
            <div className="space-y-6">
              {latestNews.map(item => (
                <div key={item.id} className="p-6 bg-gray-50/50 dark:bg-slate-900/20 rounded-[1.75rem] border border-gray-100 dark:border-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 relative group">
                  <h4 className="font-black text-lg mb-2 flex items-center gap-3 text-gray-900 dark:text-gray-100 leading-tight">
                    <span className="truncate">{item.title}</span>
                    {!item.readBy?.includes(profile.id) && <span className="bg-red-500 text-white text-[10px] px-3 py-1 rounded-full animate-pulse shadow-lg shadow-red-500/30">NUEVO</span>}
                  </h4>
                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex justify-between">
                    <span className="flex items-center gap-1.5"><Users size={12} className="text-indigo-400"/> {item.authorName}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: item.content }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-16 opacity-30">
              <Bell size={64} className="mb-4 text-indigo-500" />
              <p className="text-xs font-black uppercase tracking-[0.2em]">{language === 'es' ? 'Sin avisos recientes' : 'No recent news'}</p>
            </div>
          )}
        </div>

        {/* Forum/Community Section */}
        <div className="glass-card rounded-[2.5rem] p-8 md:p-10 flex flex-col items-center justify-center text-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-950 border border-white/20 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
          
          <div className="z-10 space-y-6">
            <div className="w-24 h-24 bg-purple-600 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-purple-500/40 transform -rotate-6 group-hover:rotate-0 transition-transform">
              <MessageSquare size={48} />
            </div>
            <h3 className="font-black text-3xl text-gray-900 dark:text-white tracking-widest uppercase">{language === 'es' ? 'Comunidad' : 'Community'}</h3>
            <p className="text-gray-500 dark:text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
              {language === 'es' ? 'Comparte tus logros, resuelve tus dudas y crece junto a tus compañeros.' : 'Share your achievements, solve your doubts, and grow along with your peers.'}
            </p>
            <button onClick={() => setActiveTab('forum')} className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.25em] hover:bg-indigo-700 shadow-xl shadow-indigo-500/30 transition-all hover-spring active:scale-95">
              {language === 'es' ? 'Explorar Foro' : 'Explore Forum'}
            </button>
          </div>
        </div>
      </div>

      {/* Activity Timeline Section */}
      <div className="glass-card rounded-[2.5rem] p-8 md:p-10 border border-white/20 shadow-xl">
        <div className="flex items-center gap-3 mb-10 border-b border-gray-100 dark:border-slate-800 pb-6">
           <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600"><Clock size={24} /></div>
           <h3 className="font-black text-2xl text-gray-900 dark:text-white tracking-tighter uppercase">{language === 'es' ? 'Línea de Vida' : 'Life Line'}</h3>
        </div>
        
        {myNotifications.length > 0 ? (
          <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-1 before:bg-gray-100 dark:before:bg-slate-800">
            {myNotifications.slice(0, 4).map(n => (
              <div key={n.id} className="flex gap-8 relative items-start group">
                <div className={`w-10 h-10 rounded-[1.25rem] flex items-center justify-center shrink-0 z-10 shadow-lg border-4 border-white dark:border-slate-800 transition-all group-hover:scale-110 ${
                   n.type === 'meeting' ? 'bg-blue-500 text-white shadow-blue-500/20' :
                   n.type === 'news' ? 'bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-emerald-500 text-white shadow-emerald-500/20'
                }`}>
                   {n.type === 'meeting' ? <Video size={16}/> : n.type === 'news' ? <Bell size={16}/> : <FileText size={16}/>}
                </div>
                <div className="flex-1 space-y-2 pb-6">
                  <p className="text-base text-gray-800 dark:text-gray-200 font-bold leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{n.message}</p>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                     {new Date(n.createdAt).toLocaleDateString()} • {n.authorName}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 opacity-30">
            <Clock size={64} className="mx-auto text-gray-300 dark:text-slate-600 mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">{language === 'es' ? 'No hay actividad registrada' : 'No recorded activity'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
