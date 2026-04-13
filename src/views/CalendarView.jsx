import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Calendar as CalendarIcon, Clock, Video, Plus, X, Trash2, Edit2, User, CheckCircle, Users, History, ChevronLeft, ChevronRight, List as ListIcon, CalendarDays, PowerOff, Search, UserCheck } from 'lucide-react';
import api from '../config/api';
import { useSettings } from '../hooks/SettingsContext';

export default function CalendarView({ profile, events, users, showToast, createNotification, attendance = [], addOptimistic, updateOptimistic, removeOptimistic, replaceOptimistic }) {
  const { language } = useSettings();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const isTeacher = profile.role === 'profesor';

  const [viewMode, setViewMode] = useState('semana'); // 'semana', 'agenda'
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [currentTime, setCurrentTime] = useState(new Date());

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [category, setCategory] = useState('normal'); // 'normal', 'importante', 'recuperacion', 'tutoria'
  const [isPriority, setIsPriority] = useState(false);

  // Student assignment state
  const [assignMode, setAssignMode] = useState('all'); // 'all' | 'specific'
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');

  // Auto-scroll to current time on mount in week view
  const calendarRef = useRef(null);
  useEffect(() => {
    if (viewMode === 'semana' && calendarRef.current) {
       const hour = currentTime.getHours();
       calendarRef.current.scrollTop = Math.max(0, (hour - 1) * 80);
    }
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, [viewMode]);

  function getStartOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday
    return new Date(date.setDate(diff)).setHours(0,0,0,0);
  }

  const handlePrevWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() - 7);
    setCurrentWeekStart(next.getTime());
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next.getTime());
  };

  const handleOpenAdd = (defaultDate = '') => {
    setTitle(''); setDate(defaultDate); setEndDate(''); setLink(''); setDescription(''); setEditingEventId(null);
    setCategory('normal'); setIsPriority(false);
    setAssignMode('all'); setSelectedStudents([]); setStudentSearch('');
    setShowAddModal(true);
  };

  const handleEditClick = (ev) => {
    setTitle(ev.title || '');
    setDate(ev.date || '');
    setEndDate(ev.end_date || ev.endDate || '');
    setLink(ev.link || '');
    setDescription(ev.description || '');
    setEditingEventId(ev.id);
    if (ev.assigned_to && !ev.assigned_to.includes('all')) {
      setAssignMode('specific');
      setSelectedStudents(ev.assigned_to);
    } else {
      setAssignMode('all');
      setSelectedStudents([]);
    }
    setCategory(ev.category || 'normal');
    setIsPriority(ev.is_priority || false);
    setStudentSearch('');
    setShowAddModal(true);
  };

  const toggleStudent = (id) => {
    setSelectedStudents(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleAutoGenerateLink = () => {
    const randomHash = Math.random().toString(36).substring(2, 10);
    setLink(`https://meet.jit.si/Clase-${randomHash}`);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!title || !date) return;
    if (assignMode === 'specific' && selectedStudents.length === 0) {
      showToast('Selecciona al menos un estudiante o elige "Todos"', 'error');
      return;
    }
    const finalAssignedTo = assignMode === 'all' ? [] : selectedStudents;
    
    const eventData = {
      title, date, end_date: endDate || null, description: description || null, link,
      assigned_to: finalAssignedTo,
      category, is_priority: isPriority,
      type: 'meeting', author_id: profile.id, status: 'programada'
    };

    const nowISO = new Date().toISOString();
    let tempIdStr = null;
    if (editingEventId) {
      updateOptimistic('events', editingEventId, eventData);
    } else {
      tempIdStr = `temp-ev-${Date.now()}`;
      addOptimistic('events', { ...eventData, id: tempIdStr, created_at: nowISO, is_optimistic: true });
    }
    
    setShowAddModal(false);

    try {
      if (editingEventId) {
        await api.put(`/data/events/${editingEventId}`, eventData);
        showToast('Clase actualizada');
      } else {
        const { data: realRecord } = await api.post('/data/events', { ...eventData, created_at: nowISO });
        if (tempIdStr) replaceOptimistic('events', tempIdStr, realRecord);
        const notifyTargets = assignMode === 'all' ? null : selectedStudents;
        createNotification(`📅 Nueva clase programada: ${title}`, notifyTargets, 'calendar');
        showToast('Evento creado exitosamente');
      }
      
      setTitle(''); setDate(''); setEndDate(''); setDescription(''); setLink(''); setEditingEventId(null);
      setAssignMode('all'); setSelectedStudents([]); setStudentSearch('');
    } catch (e) {
      console.error(e);
      showToast('Error al guardar evento', 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('¿Deseas eliminar esta clase?')) return;
    removeOptimistic('events', id);
    try {
      await api.delete(`/data/events/${id}`);
      showToast('Clase eliminada');
    } catch (e) { console.error(e); }
  };

  const handleEndMeeting = async (id) => {
    if (!window.confirm('¿Finalizar esta clase ahora? Ya nadie podrá unirse.')) return;
    try {
      await api.put(`/data/events/${id}`, { status: 'finalizada' });
      showToast('Clase finalizada correctamente');
    } catch (e) { console.error(e); }
  };

  const handleToggleAttendance = async (eventId, studentId, isPresent) => {
    const tempAtt = { event_id: eventId, user_id: studentId, is_present: isPresent, updated_at: Date.now() };
    updateOptimistic('attendance', `${eventId}_${studentId}`, tempAtt);

    try {
       const existing = attendance.find(a => (a.event_id === eventId || a.eventId === eventId) && (a.student_id === studentId || a.studentId === studentId));
       if (existing) {
         await api.put(`/data/attendance/${existing.id}`, { is_present: isPresent, marked_by: profile.id });
       } else {
         await api.post('/data/attendance', {
           event_id: eventId,
           student_id: studentId,
           is_present: isPresent,
           marked_by: profile.id
         });
       }
    } catch (e) { console.error(e); }
  };

  const getEventStatus = (ev) => {
     if (ev.status === 'finalizada') return 'finalizada';
     const now = new Date().getTime();
     const startInput = ev.date || ev.startDate || Date.now();
     const start = new Date(startInput).getTime();
     const end = (ev.end_date || ev.endDate) ? new Date(ev.end_date || ev.endDate).getTime() : start + 3600000;
     if (now < start) return 'programada';
     if (now >= start && now <= end) return 'en_curso';
     return 'pasada';
  };

  const myEvents = useMemo(() => (events || []).filter(e => {
    if (isTeacher) return true;
    const assigned = e.assigned_to || e.assignedTo;
    return (assigned?.length === 0 || assigned?.includes('all')) || assigned?.includes(profile.id);
  }), [events, profile.id, isTeacher]);

  const studentCount = useMemo(() => (users || []).filter(u => u.role === 'estudiante').length, [users]);

  const getParticipantCount = useCallback((ev) => {
    const assigned = ev.assigned_to || ev.assignedTo;
    if (!assigned || assigned.includes('all')) return studentCount;
    return Array.isArray(assigned) ? assigned.length : 0;
  }, [studentCount]);

  const upcomingEvents = myEvents.filter(e => {
    const st = getEventStatus(e);
    return st === 'programada' || st === 'en_curso';
  }).sort((a,b) => new Date(a.date || a.startDate) - new Date(b.date || b.startDate));
  
  const pastEvents = myEvents.filter(e => {
    const st = getEventStatus(e);
    return st === 'pasada' || st === 'finalizada';
  }).sort((a,b) => new Date(b.date || b.startDate) - new Date(a.date || a.startDate));

  const weekDays = useMemo(() => {
    const days = [];
    for(let i=0; i<7; i++) {
       const d = new Date(currentWeekStart);
       d.setDate(d.getDate() + i);
       days.push(d);
    }
    return days;
  }, [currentWeekStart]);

  const hours = Array.from({length: 24}, (_, i) => i);

  return (
    <>
      <div className="space-y-8 animate-fade-in pb-12 flex flex-col h-full min-h-[85vh]">
        {/* HEADER SECTION */}
        <div className="aura-card p-0 overflow-hidden shadow-2xl shrink-0">
          <div className="aura-gradient-primary px-10 py-12 text-white flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="space-y-4 text-center md:text-left">
              <h1 className="text-5xl font-black uppercase tracking-tighter flex items-center justify-center md:justify-start gap-4 text-white">
                <CalendarIcon className="text-white" size={56} /> 
                {language === 'es' ? 'Centro de Operaciones' : 'Operations Center'}
              </h1>
              <p className="text-white/60 font-black text-xs uppercase tracking-[0.3em]">{language === 'es' ? 'Cronograma Estratégico Diário' : 'Daily Strategic Schedule'}</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="flex bg-white/10 backdrop-blur-md rounded-[1.8rem] p-2 shadow-inner border border-white/10 shrink-0">
                 <button onClick={() => setViewMode('semana')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${viewMode === 'semana' ? 'bg-white shadow-xl text-indigo-600 scale-105' : 'text-white/60 hover:text-white'}`}>
                    <CalendarDays size={18}/> {language === 'es' ? 'Planificador' : 'Planner'}
                 </button>
                 <button onClick={() => setViewMode('agenda')} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${viewMode === 'agenda' ? 'bg-white shadow-xl text-indigo-600 scale-105' : 'text-white/60 hover:text-white'}`}>
                    <ListIcon size={18}/> {language === 'es' ? 'Bitácora' : 'Logbook'}
                 </button>
              </div>
              
              {isTeacher && (
                <button onClick={() => handleOpenAdd('')} className="flex items-center gap-4 bg-white text-indigo-600 px-10 py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.3em] shadow-3xl hover:scale-105 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <Plus size={24} /> {language === 'es' ? 'Programar' : 'Schedule'}
                </button>
              )}
            </div>
          </div>
        </div>

      {viewMode === 'semana' ? (
        <div className="flex-1 aura-card p-0 rounded-[2.5rem] flex flex-col overflow-hidden shadow-xl border-none">
           {/* Week Header */}
           <div className="flex items-center justify-between p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 shrink-0">
              <div className="flex items-center gap-6">
                 <div className="flex bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <button onClick={handlePrevWeek} className="p-3 text-slate-400 hover:text-indigo-600 transition-all outline-none"><ChevronLeft size={24}/></button>
                    <button onClick={handleNextWeek} className="p-3 text-slate-400 hover:text-indigo-600 transition-all outline-none"><ChevronRight size={24}/></button>
                 </div>
                 <button onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))} className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 hover:border-indigo-300 text-indigo-600 transition-all shadow-sm outline-none">{language === 'es' ? 'Hoy' : 'Today'}</button>
                 <span className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-2xl ml-4">
                    {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(currentWeekStart))}
                 </span>
              </div>
           </div>
           
           {/* Grid Layout */}
           <div className="flex flex-1 overflow-hidden relative bg-white/40 dark:bg-slate-900/40">
              <div className="flex-1 overflow-auto relative custom-scrollbar flex" ref={calendarRef}>
                 <div className="flex min-w-[800px] flex-1">
                    
                    {/* Timeline sidebar */}
                    <div className="w-20 shrink-0 border-r border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md z-40 text-right text-[10px] text-slate-400 font-black uppercase flex flex-col sticky left-0 shadow-sm pr-4">
                       <div className="sticky top-0 z-50 h-20 bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-100 dark:border-slate-800"></div>
                       {hours.map(h => (
                         <div key={h} className="h-20 relative">
                           <span className="absolute -top-3 right-4">{h.toString().padStart(2, '0')}:00</span>
                         </div>
                       ))}
                    </div>

                    {/* Days Columns */}
                    <div className="flex-1 flex relative">
                       {weekDays.map((day, i) => {
                       const isToday = new Date().toDateString() === day.toDateString();
                       const isLast = i === weekDays.length - 1;
                       return (
                       <div key={day.toISOString()} className={`flex-1 min-w-[120px] border-slate-100 dark:border-slate-800 relative transition-colors ${!isLast ? 'border-r' : ''} ${isToday ? 'bg-indigo-50/10 dark:bg-indigo-900/5' : ''}`}>
                          {/* Day Header */}
                          <div className={`sticky top-0 z-30 h-20 flex flex-col items-center justify-center border-b border-slate-100 dark:border-slate-800 backdrop-blur-xl transition-all ${isToday ? 'bg-indigo-600 text-white' : 'bg-white/90 dark:bg-slate-900/90 text-slate-400'}`}>
                             <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{day.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                             <span className="text-xl font-black mt-1">{day.getDate()}</span>
                             {isToday && <div className="absolute bottom-2 w-1 h-1 bg-white rounded-full"></div>}
                          </div>

                          <div className="relative h-[1920px]"> {/* 24h * 80px = 1920px */}
                             {hours.map(h => (
                               <div key={h} className="h-20 border-b border-slate-50/50 dark:border-slate-800/30 transition-colors hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer" 
                                 onDoubleClick={() => {
                                    if(isTeacher) {
                                       const defaultDate = new Date(day);
                                       defaultDate.setHours(h, 0, 0, 0);
                                       const tzoffset = defaultDate.getTimezoneOffset() * 60000;
                                       const localISOTime = (new Date(defaultDate - tzoffset)).toISOString().slice(0, 16);
                                       handleOpenAdd(localISOTime);
                                    }
                                 }}
                               ></div>
                             ))}
                             
                             {/* Current Time Indicator */}
                             {isToday && (
                               <div className="absolute left-0 right-0 border-t-2 border-indigo-500 z-30 pointer-events-none" style={{ top: `${(currentTime.getHours() + currentTime.getMinutes() / 60) * 80}px` }}>
                                  <div className="absolute -left-2 -top-2.5 w-5 h-5 bg-indigo-500 rounded-full shadow-xl shadow-indigo-500/40 border-4 border-white dark:border-slate-900"></div>
                               </div>
                             )}

                             {myEvents.filter(ev => new Date(ev.date || ev.startDate || Date.now()).toDateString() === day.toDateString()).map((ev, idx) => {
                                 const evStartTime = new Date(ev.date || ev.startDate || Date.now());
                                 const startHour = evStartTime.getHours() + evStartTime.getMinutes() / 60;
                                 const endHour = (ev.end_date || ev.endDate) ? new Date(ev.end_date || ev.endDate).getHours() + new Date(ev.end_date || ev.endDate).getMinutes() / 60 : startHour + 1;
                                 const duration = Math.max(0.8, endHour - startHour);
                                 const status = getEventStatus(ev);
                                 
                                 return (
                                 <div key={ev.id} className={`absolute inset-x-2 rounded-2xl p-4 shadow-xl flex flex-col transition-all duration-300 hover:z-30 hover:scale-[1.05] cursor-pointer group ${
                                    status === 'finalizada' ? 'bg-slate-100 text-slate-400 border-none opacity-60' :
                                    status === 'en_curso' ? 'aura-gradient-primary text-white border-none shadow-indigo-500/40' :
                                    'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700'
                                 }`} style={{ top: `${startHour * 80}px`, height: `${Math.max(duration * 80, 60)}px`, zIndex: (status === 'en_curso' || ev.is_priority) ? 20 : 10 }}
                                 onClick={() => { setSelectedEvent(ev); setShowAttendanceModal(true); }}
                                 >
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{evStartTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}</p>
                                        {ev.is_priority && <span className="animate-pulse">🚨</span>}
                                    </div>
                                    <p className="text-xs font-black uppercase tracking-tight leading-tight truncate group-hover:whitespace-normal">{ev.title}</p>
                                    
                                    <div className="mt-auto flex items-center justify-between gap-1 opacity-70">
                                       <div className="flex items-center gap-2">
                                          <Users size={12} />
                                          <span className="text-[10px] font-black">{getParticipantCount(ev)}</span>
                                       </div>
                                       {status === 'en_curso' && (
                                         <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                                       )}
                                    </div>
                                 </div>
                                )})}
                          </div>
                       </div>
                       )})}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          {/* Agenda Section */}
          <section className="lg:col-span-2 space-y-8">
             <div className="flex items-center justify-between">
               <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-4 text-slate-900 dark:text-white">
                  <Clock className="text-indigo-600" size={32} /> {language === 'es' ? 'Próximas Misiones' : 'Next Missions'}
               </h2>
               <div className="px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-full font-black text-[10px] uppercase tracking-widest text-slate-400">
                 {upcomingEvents.length} {language === 'es' ? 'Total' : 'Total'}
               </div>
             </div>
             
             <div className="grid grid-cols-1 gap-6">
                {upcomingEvents.map(ev => {
                  const status = getEventStatus(ev);
                  return (
                  <div key={ev.id} className="aura-card p-0 overflow-hidden group hover:shadow-2xl transition-all duration-500 border-none shadow-xl bg-white dark:bg-slate-800">
                    <div className="flex flex-col md:flex-row">
                      <div className={`md:w-48 p-8 flex flex-col justify-center items-center text-center gap-2 shrink-0 ${status === 'en_curso' ? 'aura-gradient-primary text-white' : 'bg-slate-50 dark:bg-slate-900/50 text-slate-400'}`}>
                         <span className="text-xs font-black uppercase tracking-[0.2em]">{new Date(ev.date || ev.startDate).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' })}</span>
                         <span className="text-4xl font-black">{new Date(ev.date || ev.startDate).getDate()}</span>
                         <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{new Date(ev.date || ev.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </div>
                      
                      <div className="flex-1 p-8 flex flex-col">
                        <div className="flex justify-between items-start mb-4 gap-4">
                           <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white leading-tight">
                              {ev.title}
                           </h3>
                           <div className="flex gap-2 shrink-0">
                             {status === 'en_curso' && <span className="bg-rose-500 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest animate-pulse">En Vivo</span>}
                             {ev.is_priority && <span className="bg-indigo-600 text-white text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">Prioridad</span>}
                           </div>
                        </div>
                        
                        <p className="text-sm text-slate-400 font-medium mb-6 line-clamp-2">{ev.description || (language === 'es' ? 'Sin descripción estratégica.' : 'No strategic description.')}</p>
                        
                        <div className="flex flex-wrap items-center justify-between gap-6 pt-6 border-t border-slate-50 dark:border-slate-700/50 mt-auto">
                           <div className="flex items-center gap-8">
                             <div className="flex items-center gap-3">
                               <Users size={16} className="text-indigo-500" />
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{getParticipantCount(ev)} {language === 'es' ? 'Agentes' : 'Agents'}</span>
                             </div>
                             <div className="flex items-center gap-3">
                               <User size={16} className="text-indigo-500" />
                               <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{(users?.find(u => u.id === ev.author_id || u.id === ev.authorId))?.name || 'Admin'}</span>
                             </div>
                           </div>
                           
                           <div className="flex items-center gap-4">
                              {status === 'en_curso' && ev.link && (
                                 <a href={ev.link} target="_blank" rel="noreferrer" className="px-8 py-3 aura-gradient-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 transition-all">
                                   {language === 'es' ? 'Iniciar Conexión' : 'Start Connection'}
                                 </a>
                              )}
                              {isTeacher && (
                                <div className="flex gap-3">
                                   <button onClick={() => { setSelectedEvent(ev); setShowAttendanceModal(true); }} className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-indigo-600 rounded-xl transition-all shadow-sm outline-none"><Users size={18}/></button>
                                   <button onClick={() => handleEditClick(ev)} className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-amber-600 rounded-xl transition-all shadow-sm outline-none"><Edit2 size={18}/></button>
                                   <button onClick={() => handleDeleteEvent(ev.id)} className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:text-rose-600 rounded-xl transition-all shadow-sm outline-none"><Trash2 size={18}/></button>
                                </div>
                              )}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )})}
                {upcomingEvents.length === 0 && (
                  <div className="aura-card py-40 text-center shadow-none border-2 border-dashed border-slate-200 dark:border-slate-800">
                     <p className="text-xl font-black text-slate-400 uppercase tracking-widest">{language === 'es' ? 'No hay operaciones programadas' : 'No operations scheduled'}</p>
                  </div>
                )}
             </div>
          </section>

          {/* Past Events Section */}
          <section className="space-y-8">
             <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-4 text-slate-400">
                <History className="text-slate-300" size={32} /> {language === 'es' ? 'Archivo' : 'Archive'}
             </h2>
             <div className="grid grid-cols-1 gap-4">
                {pastEvents.slice(0, 10).map(ev => (
                   <div key={ev.id} onClick={() => { setSelectedEvent(ev); setShowAttendanceModal(true); }} className="aura-card p-6 border-none shadow-md flex justify-between items-center bg-white/50 dark:bg-slate-800/50 group cursor-pointer hover:shadow-xl transition-all">
                      <div className="flex items-center gap-6">
                         <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs uppercase shadow-inner">
                           {new Date(ev.date || ev.startDate).getDate()}
                         </div>
                         <div>
                            <h3 className="font-black text-xs uppercase tracking-widest text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{ev.title}</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase mt-1">
                              {new Date(ev.date || ev.startDate).toLocaleDateString()}
                            </p>
                         </div>
                      </div>
                      <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                   </div>
                ))}
             </div>
          </section>
        </div>
      )}
      </div>

      {/* Programar/Editar Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-fade-in" aria-modal="true" role="dialog">
          <form onSubmit={handleSaveEvent} className="aura-card w-full max-w-xl rounded-[3rem] shadow-3xl animate-scale-in flex flex-col max-h-[90vh] p-0 overflow-hidden bg-white dark:bg-slate-900">
            <div className="aura-gradient-primary p-10 text-white flex justify-between items-center shrink-0">
              <div className="space-y-2">
                <h3 className="text-3xl font-black uppercase tracking-tighter">{editingEventId ? (language === 'es' ? 'Editar Misión' : 'Edit Mission') : (language === 'es' ? 'Programar Misión' : 'Schedule Mission')}</h3>
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">{language === 'es' ? 'Configuración de Parámetros' : 'Parameter Configuration'}</p>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} className="bg-white/10 hover:bg-white/20 p-4 rounded-full transition-all outline-none" aria-label="Close"><X size={28}/></button>
            </div>
            
            <div className="p-10 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{language === 'es' ? 'Nombre de la Operación' : 'Operation Name'}</label>
                <input required value={title} onChange={e=>setTitle(e.target.value)} type="text" className="w-full px-8 py-5 rounded-3xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-black text-lg uppercase tracking-tight" placeholder={language === 'es' ? "Ej. Simulacro de Despliegue" : "e.g. Deployment Drill"} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{language === 'es' ? 'Inicio' : 'Start'}</label>
                   <input required value={date} onChange={e=>setDate(e.target.value)} type="datetime-local" className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-bold text-sm [color-scheme:dark]" />
                 </div>
                 <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{language === 'es' ? 'Finalización' : 'End'}</label>
                   <input value={endDate} onChange={e=>setEndDate(e.target.value)} type="datetime-local" className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-bold text-sm [color-scheme:dark]" />
                 </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">{language === 'es' ? 'Resumen Táctico' : 'Tactical Summary'}</label>
                <textarea value={description} onChange={e=>setDescription(e.target.value)} className="w-full px-8 py-5 rounded-3xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all text-sm font-medium resize-none min-h-[120px]" placeholder={language === 'es' ? "Instrucciones de la misión..." : "Mission instructions..."} />
              </div>

              <div className="grid grid-cols-2 gap-6 p-8 bg-slate-50 dark:bg-slate-800 rounded-[2rem]">
                <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'es' ? 'Categoría' : 'Category'}</label>
                   <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border-none outline-none font-black text-xs uppercase tracking-widest shadow-sm">
                      <option value="normal">📅 {language === 'es' ? 'Normal' : 'Normal'}</option>
                      <option value="importante">🚨 {language === 'es' ? 'Importante' : 'Important'}</option>
                      <option value="recuperacion">🔄 {language === 'es' ? 'Recuperación' : 'Recovery'}</option>
                      <option value="tutoria">🤝 {language === 'es' ? 'Tutoría' : 'Tutoring'}</option>
                   </select>
                </div>
                <div className="flex flex-col justify-end pb-2">
                   <label className="flex items-center gap-4 cursor-pointer group">
                      <div className={`w-14 h-8 rounded-full relative transition-all duration-300 ${isPriority ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                         <input type="checkbox" className="hidden" checked={isPriority} onChange={e=>setIsPriority(e.target.checked)} />
                         <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-300 ${isPriority ? 'left-7' : 'left-1'}`}></div>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isPriority ? 'text-rose-500' : 'text-slate-400'}`}>{language === 'es' ? 'Alta Prioridad' : 'High Priority'}</span>
                   </label>
                </div>
              </div>

              <div className="aura-card p-0 rounded-[2.5rem] overflow-hidden border-2 border-dashed border-indigo-100 dark:border-indigo-900/30">
                 <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 flex items-center gap-4">
                    <UserCheck className="text-indigo-600" size={20} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-800 dark:text-indigo-300">{language === 'es' ? 'Autorización de Acceso' : 'Access Authorization'}</span>
                 </div>
                 <div className="grid grid-cols-2 gap-4 p-6 bg-white dark:bg-slate-900">
                    <button type="button" onClick={() => { setAssignMode('all'); setSelectedStudents([]); }} className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${assignMode === 'all' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'text-slate-400 border-slate-100 dark:border-slate-800'}`}>
                       {language === 'es' ? 'Fuerzas Totales' : 'All Forces'}
                    </button>
                    <button type="button" onClick={() => setAssignMode('specific')} className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${assignMode === 'specific' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'text-slate-400 border-slate-100 dark:border-slate-800'}`}>
                       {language === 'es' ? 'Agentes Específicos' : 'Specific Agents'}
                    </button>
                 </div>
                 
                 {assignMode === 'specific' && (
                   <div className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 space-y-4">
                      <div className="relative">
                        <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
                        <input type="text" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder={language === 'es' ? 'Identificar agente...' : 'Identify agent...'} className="w-full pl-14 pr-8 py-4 rounded-2xl bg-white dark:bg-slate-800 border-none outline-none focus:ring-4 focus:ring-indigo-500/20 text-sm font-bold shadow-sm" />
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-2 custom-scrollbar">
                         {users.filter(u => u.role === 'estudiante').filter(u => u.name.toLowerCase().includes(studentSearch.toLowerCase())).map(student => (
                           <label key={student.id} className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${selectedStudents.includes(student.id) ? 'bg-white dark:bg-slate-800 shadow-md ring-2 ring-indigo-500/20' : 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100'}`}>
                              <input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => toggleStudent(student.id)} className="w-5 h-5 accent-indigo-600 rounded-lg" />
                              <div className="w-10 h-10 rounded-xl aura-gradient-primary flex items-center justify-center text-white font-black text-sm uppercase">{student.name?.charAt(0) || '?'}</div>
                              <span className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-300">{student.name}</span>
                              {selectedStudents.includes(student.id) && <CheckCircle size={18} className="ml-auto text-indigo-500" />}
                           </label>
                         ))}
                      </div>
                   </div>
                 )}
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center px-2">
                   <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{language === 'es' ? 'Punto de Conexión (URL)' : 'Connection Point (URL)'}</label>
                   <button type="button" onClick={handleAutoGenerateLink} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 transition-colors">Generar Jitsi Link</button>
                </div>
                <input value={link} onChange={e=>setLink(e.target.value)} type="url" className="w-full px-8 py-5 rounded-3xl bg-slate-50 dark:bg-slate-800 border-none outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all font-bold text-sm shadow-inner" placeholder="Punto de encuentro digital..." />
              </div>
            </div>

            <div className="p-10 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-4">
               <button type="submit" disabled={isSubmitting} className="flex-1 py-6 aura-gradient-primary text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 outline-none">
                 {editingEventId ? (language === 'es' ? 'Actualizar Sistema' : 'Update System') : (language === 'es' ? 'Autorizar Despliegue' : 'Authorize Deployment')}
               </button>
            </div>
          </form>
        </div>
      )}

      {/* Asistencia Modal */}
      {showAttendanceModal && selectedEvent && (
         <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-fade-in" aria-modal="true" role="dialog">
            <div className="aura-card w-full max-w-2xl rounded-[3rem] shadow-3xl animate-scale-in flex flex-col max-h-[90vh] p-0 overflow-hidden bg-white dark:bg-slate-900">
               <div className="aura-gradient-secondary p-10 text-white flex justify-between items-center shrink-0">
                  <div className="space-y-3 max-w-[70%]">
                     <h3 className="text-3xl font-black uppercase tracking-tighter leading-tight truncate">{selectedEvent.title}</h3>
                     <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">
                        {language === 'es' ? 'Verificación de Presencia Operativa' : 'Operational Presence Verification'}
                     </p>
                  </div>
                  <div className="flex gap-4">
                     {isTeacher && (
                        <button onClick={() => { if(window.confirm(language === 'es' ? '¿Eliminar esta misión?' : 'Delete mission?')) { handleDeleteEvent(selectedEvent.id); setShowAttendanceModal(false); } }} className="bg-white/10 hover:bg-rose-500/40 p-4 rounded-full transition-all outline-none"><Trash2 size={24}/></button>
                     )}
                     <button onClick={() => setShowAttendanceModal(false)} className="bg-white/10 hover:bg-white/20 p-4 rounded-full transition-all outline-none"><X size={24}/></button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                  <div className="space-y-4">
                     {users.filter(u => u.role === 'estudiante').map(student => {
                        const attRecord = attendance.find(a => (a.event_id === selectedEvent.id || a.eventId === selectedEvent.id) && (a.student_id === student.id || a.studentId === student.id));
                        const isPresent = attRecord?.is_present ?? attRecord?.isPresent;
                        const assigned = selectedEvent.assigned_to || selectedEvent.assignedTo;
                        const isInvited = !assigned || assigned.includes('all') || assigned.includes(student.id);
                        
                        return (
                           <div key={student.id} className={`flex items-center justify-between p-6 rounded-[1.8rem] transition-all duration-300 ${isInvited ? 'bg-slate-50 dark:bg-slate-800 shadow-sm' : 'opacity-40 grayscale pointer-events-none'}`}>
                              <div className="flex items-center gap-6">
                                 <div className="w-14 h-14 rounded-2xl aura-gradient-primary flex items-center justify-center text-white font-black text-lg shadow-xl shadow-indigo-500/20">{student.name?.charAt(0) || '?'}</div>
                                 <div>
                                    <h4 className="font-black text-sm uppercase tracking-tight text-slate-800 dark:text-slate-200">{student.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">{student.email}</p>
                                 </div>
                              </div>

                              <div className="flex gap-2">
                                 {isTeacher ? (
                                    <div className="flex bg-white dark:bg-slate-900 rounded-2xl p-1.5 shadow-inner border border-slate-100 dark:border-slate-700">
                                       <button onClick={() => handleToggleAttendance(selectedEvent.id, student.id, true)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isPresent === true ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-400 hover:text-emerald-500'}`}>{language === 'es' ? 'Firma' : 'Signed'}</button>
                                       <button onClick={() => handleToggleAttendance(selectedEvent.id, student.id, false)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isPresent === false ? 'bg-rose-500 text-white shadow-lg' : 'text-slate-400 hover:text-rose-500'}`}>{language === 'es' ? 'Falta' : 'Miss'}</button>
                                    </div>
                                 ) : (
                                    <div className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm ${isPresent === true ? 'bg-emerald-500 text-white' : isPresent === false ? 'bg-rose-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                       {isPresent === true ? (language === 'es' ? 'Confirmado' : 'Confirmed') : isPresent === false ? (language === 'es' ? 'Incompleto' : 'Incomplete') : (language === 'es' ? 'Pendiente' : 'Pending')}
                                    </div>
                                 )}
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>

               <div className="p-10 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                  <button onClick={() => setShowAttendanceModal(false)} className="w-full py-6 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:scale-105 active:scale-95 transition-all outline-none border border-slate-100 dark:border-slate-700">{language === 'es' ? 'Finalizar Auditoría' : 'Finalize Audit'}</button>
               </div>
            </div>
         </div>
      )}
    </>
  );
}
