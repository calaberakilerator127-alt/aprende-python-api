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

  const handleNotifClick = (n) => {
    const type = n.type || '';
    if (type.includes('meeting') || type.includes('calendario') || type.includes('event')) setActiveTab('calendar');
    else if (type.includes('tarea') || type.includes('entregas') || type.includes('evaluacion')) setActiveTab('activities');
    else if (type.includes('material')) setActiveTab('materiales');
    else if (type.includes('news')) setActiveTab('news');
    else if (type.includes('forum')) setActiveTab('forum');
    else if (type.includes('profile')) setActiveTab('profile');
    else setActiveTab('activities');
  };

  return (
    <div className="space-y-12 animate-fade-in pb-16">
      {/* Header Welcome Card */}
      <div className="relative rounded-[3rem] p-12 lg:p-16 text-white overflow-hidden group shadow-2xl shadow-indigo-500/20">
        <div className="absolute inset-0 aura-gradient-primary opacity-90 transition-transform duration-700 group-hover:scale-105"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full -mr-32 -mt-32 blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-indigo-400/20 rounded-full -ml-20 -mb-20 blur-[80px]"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-6">
            <h1 className="text-5xl sm:text-7xl font-black mb-4 tracking-tighter leading-tight animate-slide-up">
               {language === 'es' ? '¡Hola' : 'Hello'},<br/>
               <span className="text-indigo-200">{profile.name?.split(' ')[0] || (language === 'es' ? 'Colega' : 'Mate')}</span>! 👋
            </h1>
            <p className="text-indigo-50/80 text-lg sm:text-xl max-w-2xl leading-relaxed font-bold animate-slide-up" style={{ animationDelay: '100ms' }}>
              {isTeacher 
                ? (language === 'es' ? 'Gestiona tu aula con herramientas de última generación.' : 'Manage your classroom with next-gen tools.')
                : (language === 'es' ? 'Tu camino hacia la maestría en Python continúa aquí.' : 'Your path to Python mastery continues here.')}
            </p>
          </div>
          <div className="flex -space-x-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
             {users.filter(u => isUserOnline(u)).slice(0, 5).map(u => (
               <div key={u.id} className="w-14 h-14 rounded-2xl border-4 border-indigo-900/50 overflow-hidden shadow-xl" title={u.name}>
                 {u.photoURL ? <img src={u.photoURL} alt="P" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-indigo-800 flex items-center justify-center font-black text-xs">{u.name?.charAt(0) || '?'}</div>}
               </div>
             ))}
             {users.filter(u => isUserOnline(u)).length > 5 && (
               <div className="w-14 h-14 rounded-2xl border-4 border-indigo-900/50 bg-indigo-700 flex items-center justify-center font-black text-xs shadow-xl">
                 +{users.filter(u => isUserOnline(u)).length - 5}
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Core Stat Card */}
        <div className="aura-card p-10 group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <FileText size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 aura-gradient-primary rounded-2xl text-white shadow-xl rotate-3 group-hover:rotate-12 transition-all">
                {isTeacher ? <FileText size={24} /> : <CheckSquare size={24} />}
              </div>
              <h3 className="font-black text-xs text-slate-400 uppercase tracking-[0.2em]">{isTeacher ? (language === 'es' ? 'Por Calificar' : 'To Grade') : (language === 'es' ? 'Tareas Pendientes' : 'Pending Tasks')}</h3>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-7xl font-black tracking-tighter text-slate-900 dark:text-white">
                {isTeacher ? submissions.filter(s => s.status === 'entregado').length : (myActivities.length - (submissions.filter(s => s.studentId === profile.id).length))}
              </span>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{language === 'es' ? 'Items' : 'Items'}</span>
            </div>
          </div>
        </div>

        {/* Community Card */}
        <div className="aura-card p-10 group relative overflow-hidden cursor-pointer" onClick={() => setActiveTab('forum')}>
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-emerald-500 rounded-2xl text-white shadow-xl -rotate-3 group-hover:rotate-0 transition-all">
                <Users size={24} />
              </div>
              <h3 className="font-black text-xs text-slate-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Comunidad' : 'Community'}</h3>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-7xl font-black tracking-tighter text-slate-900 dark:text-white">{studentCount}</span>
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{language === 'es' ? 'Miembros' : 'Members'}</span>
            </div>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="aura-card p-10 group relative overflow-hidden cursor-pointer" onClick={() => setActiveTab('calendar')}>
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Calendar size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-rose-500 rounded-2xl text-white shadow-xl rotate-6 group-hover:rotate-0 transition-all">
                <Video size={24} />
              </div>
              <h3 className="font-black text-xs text-slate-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Próxima Sesión' : 'Next Session'}</h3>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                <p className="font-black text-2xl text-slate-900 dark:text-white truncate">{upcomingEvents[0].title}</p>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-rose-500" />
                  <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest">
                    {new Date(upcomingEvents[0].date || upcomingEvents[0].startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ) : (
              <p className="font-black text-2xl text-slate-400 uppercase tracking-widest">{language === 'es' ? 'Sin eventos' : 'No events'}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* News Section */}
        <section className="space-y-8">
          <div className="flex items-center justify-between px-4">
             <div className="flex items-center gap-4">
               <div className="w-2 h-8 aura-gradient-primary rounded-full"></div>
               <h2 className="text-2xl font-black uppercase tracking-tighter">{language === 'es' ? 'Campus News' : 'Campus News'}</h2>
             </div>
             <button onClick={() => setActiveTab('news')} className="text-[10px] font-black text-indigo-500 border-b-2 border-indigo-500 hover:text-indigo-600 transition-all uppercase tracking-[0.2em]">{language === 'es' ? 'Ver todo' : 'See more'}</button>
          </div>
          
          <div className="space-y-6">
            {latestNews.length > 0 ? (
              latestNews.map(item => (
                <div key={item.id} onClick={() => setActiveTab('news')} className="aura-card p-8 group hover:-translate-y-1 transition-all cursor-pointer">
                   <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] font-black bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 px-3 py-1 rounded-full uppercase tracking-widest">Global Announcement</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(item.createdAt).toLocaleDateString()}</span>
                   </div>
                   <h4 className="font-black text-xl mb-3 text-slate-900 dark:text-white leading-tight">{item.title}</h4>
                   <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: item.content }} />
                   <div className="flex items-center justify-between pt-6 border-t dark:border-slate-800">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-[10px]">{item.authorName?.charAt(0) || '?'}</div>
                         <span className="text-[10px] font-black uppercase text-slate-600">{item.authorName || (language === 'es' ? 'Desconocido' : 'Anónimo')}</span>
                      </div>
                      <ArrowRight size={16} className="text-indigo-500 transform group-hover:translate-x-2 transition-transform" />
                   </div>
                </div>
              ))
            ) : (
              <div className="p-20 aura-card border-dashed border-2 flex flex-col items-center justify-center opacity-30">
                 <Bell size={48} className="mb-4" />
                 <p className="text-xs font-black uppercase tracking-widest">{language === 'es' ? 'Silencio en el campus' : 'Quiet campus'}</p>
              </div>
            )}
          </div>
        </section>

        {/* Forum Preview */}
        <section className="space-y-8">
          <div className="flex items-center gap-4 px-4">
             <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
             <h2 className="text-2xl font-black uppercase tracking-tighter">{language === 'es' ? 'Comunidad' : 'Community'}</h2>
          </div>

          <div className="aura-card p-12 flex flex-col items-center text-center space-y-8 relative overflow-hidden">
             <div className="absolute inset-0 bg-emerald-500/5 rotate-12 scale-150"></div>
             <div className="relative p-8 aura-gradient-primary rounded-[2.5rem] text-white shadow-2xl shadow-indigo-500/30 transform transition-transform group-hover:scale-110">
               <MessageSquare size={48} />
             </div>
             <div className="space-y-4 relative">
               <h3 className="text-3xl font-black tracking-tighter uppercase">{language === 'es' ? 'Impulso Social' : 'Social Boost'}</h3>
               <p className="text-slate-500 max-w-xs mx-auto text-sm font-medium leading-relaxed">
                 {language === 'es' ? 'Conecta con otros ninjas de Python y resuelve desafíos juntos.' : 'Connect with other Python ninjas and solve challenges together.'}
               </p>
             </div>
             <button onClick={() => setActiveTab('forum')} className="relative w-full py-5 aura-gradient-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">
               {language === 'es' ? 'Entrar al Forum' : 'Enter Forum'}
             </button>
          </div>
        </section>
      </div>

      {/* Timeline Section */}
      <section className="space-y-8">
        <div className="flex items-center gap-4 px-4">
           <div className="w-2 h-8 bg-rose-500 rounded-full"></div>
           <h2 className="text-2xl font-black uppercase tracking-tighter">{language === 'es' ? 'Línea de Actividad' : 'Activity Stream'}</h2>
        </div>
        <div className="aura-card p-10">
           {myNotifications.length > 0 ? (
             <div className="divide-y dark:divide-slate-800">
               {myNotifications.slice(0, 5).map(n => (
                 <div key={n.id} onClick={() => handleNotifClick(n)} className="py-6 flex items-center justify-between group cursor-pointer hover:px-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-2xl">
                    <div className="flex items-center gap-6">
                       <div className="p-3 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl shadow-sm text-indigo-500 group-hover:aura-gradient-primary group-hover:text-white transition-all">
                          {n.type === 'meeting' ? <Video size={18}/> : n.type === 'news' ? <Bell size={18}/> : <FileText size={18}/>}
                       </div>
                       <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight text-sm">{n.message}</p>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(n.createdAt).toLocaleDateString()} • {n.authorName}</span>
                       </div>
                    </div>
                    <ArrowRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                 </div>
               ))}
             </div>
           ) : (
             <div className="py-20 flex flex-col items-center justify-center opacity-30 text-center">
                <Clock size={48} className="mb-4" />
                <p className="text-xs font-black uppercase tracking-widest">{language === 'es' ? 'Sin rastro de actividad' : 'No activity trace'}</p>
             </div>
           )}
        </div>
      </section>
    </div>
  );
}
