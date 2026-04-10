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
       calendarRef.current.scrollTop = Math.max(0, (hour - 1) * 64);
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
    setEndDate(ev.endDate || '');
    setLink(ev.link || '');
    setDescription(ev.description || '');
    setEditingEventId(ev.id);
    // Restore assignment
    if (ev.assignedTo && !ev.assignedTo.includes('all')) {
      setAssignMode('specific');
      setSelectedStudents(ev.assignedTo);
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
    const finalAssignedTo = assignMode === 'all' ? ['all'] : selectedStudents;
    
    // Preparar datos para inserción/actualización
    const eventData = {
      title, date, end_date: endDate || null, description: description || null, link,
      assigned_to: finalAssignedTo,
      category, is_priority: isPriority,
      type: 'meeting', author_id: profile.id, status: 'programada'
    };

    // VUELO OPTIMISTA
    const nowISO = new Date().toISOString();
    let tempIdStr = null;
    if (editingEventId) {
      updateOptimistic('events', editingEventId, eventData);
    } else {
      tempIdStr = `temp-ev-${Date.now()}`;
      addOptimistic('events', { ...eventData, id: tempIdStr, created_at: nowISO, is_optimistic: true });
    }
    
    // Cerramos el modal de inmediato para Ultra Speed
    setShowAddModal(false);

    try {
      if (editingEventId) {
        await api.put(`/data/events/${editingEventId}`, eventData);
        showToast('Clase actualizada');
      } else {
        const { data: realRecord } = await api.post('/data/events', { ...eventData, created_at: nowISO });
        if (tempIdStr) replaceOptimistic('events', tempIdStr, realRecord);
        // Notify only assigned students (null = all, or array of specific IDs)
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
    
    // UI Optimista
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
    // Vuelo Optimista para Asistencia
    const tempAtt = { event_id: eventId, student_id: studentId, is_present: isPresent, updated_at: Date.now() };
    updateOptimistic('attendance', `${eventId}_${studentId}`, tempAtt);

    try {
       // El backend maneja upsert si el id (o combinación) ya existe en algunas tablas, 
       // pero aquí usamos una tabla de asistencia. 
       // Si el backend no tiene un 'upsert' genérico, fallará si ya existe.
       // En server/index.js se usa `PUT /data/:table/:id`.
       // Necesitamos ver si podemos usar esa ruta. 
       // Attendance usualmente no tiene un 'id' único simple, sino (event_id, student_id).
       // Sin embargo, el backend genérico espera un ID.
       
       const existing = attendance.find(a => a.eventId === eventId && a.studentId === studentId);
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
     const end = (ev.end_date || ev.endDate) ? new Date(ev.end_date || ev.endDate).getTime() : start + 3600000; // 1 hour default
     if (now < start) return 'programada';
     if (now >= start && now <= end) return 'en_curso';
     return 'pasada';
  };

  const myEvents = useMemo(() => (events || []).filter(e => {
    if (isTeacher) return true; // Teachers see all events
    // Students only see events where they are specifically assigned
    const assigned = e.assigned_to || e.assignedTo;
    return assigned?.includes('all') || assigned?.includes(profile.id);
  }), [events, profile.id, isTeacher]);

  const studentCount = useMemo(() => (users || []).filter(u => u.role === 'estudiante').length, [users]);

  const getParticipantCount = useCallback((ev) => {
    if (!ev.assignedTo || ev.assignedTo.includes('all')) return studentCount;
    return Array.isArray(ev.assignedTo) ? ev.assignedTo.length : 0;
  }, [studentCount]);

  const upcomingEvents = myEvents.filter(e => new Date(e.date || e.startDate) >= new Date()).sort((a,b) => new Date(a.date || a.startDate) - new Date(b.date || b.startDate));
  const pastEvents = myEvents.filter(e => new Date(e.date || e.startDate) < new Date()).sort((a,b) => new Date(b.date || b.startDate) - new Date(a.date || a.startDate));

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
      <div className="space-y-6 animate-fade-in pb-10 flex flex-col h-[calc(100vh-100px)]">
      <div className="glass-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 p-4 sm:p-6 rounded-3xl transition-shadow">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
            <CalendarIcon className="text-indigo-600" size={32} /> {language === 'es' ? 'Calendario de Clases' : 'Class Calendar'}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{language === 'es' ? 'Organiza, visualiza y únete a las sesiones en vivo (Horario 24H).' : 'Organize, view, and join live sessions (24H Format).'}</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          <div className="flex bg-gray-100/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl p-1.5 shrink-0 shadow-inner">
             <button onClick={() => setViewMode('semana')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'semana' ? 'bg-white shadow-md text-indigo-600 dark:bg-slate-800' : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'}`}>
                <CalendarDays size={16}/> {language === 'es' ? 'Semana' : 'Week'}
             </button>
             <button onClick={() => setViewMode('agenda')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'agenda' ? 'bg-white shadow-md text-indigo-600 dark:bg-slate-800' : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'}`}>
                <ListIcon size={16}/> {language === 'es' ? 'Agenda' : 'Agenda'}
             </button>
          </div>
          <div className="h-8 w-px bg-gray-200 dark:bg-slate-700 shrink-0"></div>
          {isTeacher && (
            <button onClick={() => handleOpenAdd('')} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-md hover-spring shrink-0 focus-visible:ring-inset">
              <Plus size={18} /> {language === 'es' ? 'Programar' : 'Schedule'}
            </button>
          )}
        </div>
      </div>

      {viewMode === 'semana' ? (
        <div className="flex-1 glass-card rounded-3xl flex flex-col overflow-hidden">
           {/* Week Header */}
           <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30 shrink-0">
              <div className="flex items-center gap-2">
                 <button onClick={handlePrevWeek} className="p-2 rounded-xl text-gray-500 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 transition shadow-sm bg-gray-100/50 dark:bg-slate-900/50"><ChevronLeft size={20}/></button>
                 <button onClick={() => setCurrentWeekStart(getStartOfWeek(new Date()))} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-white dark:bg-slate-800 border-2 border-indigo-100 dark:border-slate-700 hover:border-indigo-300 text-indigo-600 transition shadow-sm">{language === 'es' ? 'Hoy' : 'Today'}</button>
                 <button onClick={handleNextWeek} className="p-2 rounded-xl text-gray-500 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 transition shadow-sm bg-gray-100/50 dark:bg-slate-900/50"><ChevronRight size={20}/></button>
                 <span className="font-bold text-gray-900 dark:text-white ml-3 capitalize w-48 truncate text-lg">
                    {new Intl.DateTimeFormat(language === 'es' ? 'es-ES' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(currentWeekStart))}
                 </span>
              </div>
           </div>
           
           {/* Grid Layout */}
           <div className="flex flex-1 overflow-hidden relative bg-white/40 dark:bg-slate-900/40 rounded-b-3xl">
              <div className="flex-1 overflow-auto relative custom-scrollbar flex" ref={calendarRef}>
                 <div className="flex min-w-[700px] flex-1">
                    
                    {/* Timeline sidebar */}
                    <div className="w-16 shrink-0 border-r border-gray-100 dark:border-slate-700/80 bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-md z-40 text-right text-xs text-gray-500 font-bold hidden md:flex flex-col sticky left-0 shadow-sm">
                       {/* Esquina superior izquierda pegajosa para evitar que text underlap the corner */}
                       <div className="sticky top-0 z-50 h-14 border-b border-gray-100 dark:border-slate-700/80 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-xl w-full"></div>
                       
                       <div className="pr-2 w-full relative">
                          {hours.map(h => (
                            <div key={h} className="h-16 relative">
                              <span className="absolute -top-2 right-2 px-1 rounded-sm bg-gray-50/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">{h.toString().padStart(2, '0')}:00</span>
                            </div>
                          ))}
                       </div>
                    </div>

                    {/* Days Columns */}
                    <div className="flex-1 flex relative">
                       {weekDays.map((day, i) => {
                       const isToday = new Date().toDateString() === day.toDateString();
                       const isLast = i === weekDays.length - 1;
                       return (
                       <div key={day.toISOString()} className={`flex-1 min-w-[100px] border-gray-100 dark:border-slate-700/50 relative ${!isLast ? 'border-r' : ''}`}>
                          {/* Day Header */}
                          <div className={`sticky top-0 z-30 h-14 flex flex-col items-center justify-center border-b border-gray-100 dark:border-slate-700/80 backdrop-blur-xl bg-white/90 dark:bg-slate-800/90 shadow-sm transition-colors ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-slate-400'}`}>
                             <span className="text-xs font-black uppercase tracking-widest">{day.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                             <span className={`text-sm font-black ${isToday ? 'bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center mt-0.5 shadow-md shadow-indigo-500/30' : ''}`}>{day.getDate()}</span>
                          </div>

                          <div className="relative h-[1536px]"> {/* 24h * 64px = 1536px */}
                             {/* Hour grid lines */}
                             {hours.map(h => (
                               <div key={h} className="h-16 border-b border-gray-100/50 dark:border-slate-700/30 transition-colors hover:bg-indigo-50/50 dark:hover:bg-slate-800/50 cursor-pointer" 
                                 title={language === 'es' ? 'Doble clic para agendar' : 'Double click to schedule'}
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
                               <div className="absolute left-0 right-0 border-t-2 border-red-500 z-30 pointer-events-none" style={{ top: `${(currentTime.getHours() + currentTime.getMinutes() / 60) * 64}px` }}>
                                  <div className="absolute -left-1.5 -top-2 w-3.5 h-3.5 border-2 border-red-500 bg-white dark:bg-slate-900 rounded-full shadow-md shadow-red-500/20"></div>
                               </div>
                             )}

                             {myEvents.filter(ev => new Date(ev.date || ev.startDate || Date.now()).toDateString() === day.toDateString()).map((ev, idx) => {
                                const evStartTime = new Date(ev.date || ev.startDate || Date.now());
                                const startHour = evStartTime.getHours() + evStartTime.getMinutes() / 60;
                                const endHour = ev.endDate ? new Date(ev.endDate).getHours() + new Date(ev.endDate).getMinutes() / 60 : startHour + 1;
                                const duration = Math.max(0.8, endHour - startHour); // Asegurar tamaño mínimo visual
                                const status = getEventStatus(ev);
                                const getCategoryStyles = (c, priority) => {
                                    if (priority) return 'bg-red-500 text-white border-red-600 shadow-red-500/50 z-20';
                                    switch(c) {
                                       case 'importante': return 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-900/40 dark:border-rose-700 dark:text-rose-100';
                                       case 'recuperacion': return 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-100';
                                       case 'tutoria': return 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-100';
                                       default: return 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:border-indigo-700 dark:text-indigo-100';
                                    }
                                 };

                                 const categoryStyles = getCategoryStyles(ev.category, ev.is_priority);
                                
                                return (
                                <div key={ev.id} className={`absolute right-1 rounded-xl p-2 shadow border overflow-hidden flex flex-col transition hover:z-30 hover:scale-[1.02] cursor-pointer ${
                                   status === 'finalizada' ? 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-slate-800 dark:border-slate-600' :
                                   status === 'en_curso' ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-600/50 z-10' :
                                   categoryStyles
                                }`} style={{ top: `${startHour * 64}px`, height: `${Math.max(duration * 64, 52)}px`, left: `${(idx % 3) * 6 + 4}px`, zIndex: (status === 'en_curso' || ev.is_priority) ? 20 : 10 }}
                                onClick={() => { setSelectedEvent(ev); setShowAttendanceModal(true); }}
                                >
                                    <div className="flex justify-between items-start mb-0.5">
                                        <p className="text-[10px] font-black uppercase tracking-tighter opacity-70">{evStartTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}</p>
                                        {ev.is_priority && <span className="text-[10px]">🚨</span>}
                                    </div>
                                    <p className="text-xs font-bold leading-tight truncate">{ev.title}</p>
                                    {ev.description && duration >= 1.2 && (
                                       <p className="text-[10px] line-clamp-2 mt-1 opacity-80 leading-tight">{ev.description}</p>
                                    )}
                                    
                                    <div className="mt-auto pt-1 flex flex-wrap items-center justify-between gap-1 border-t border-black/5 dark:border-white/5">
                                       <div className="flex items-center gap-1 opacity-70">
                                          <User size={8} />
                                          <span className="text-[8px] font-bold truncate max-w-[60px]">
                                             {(users?.find(u => u.id === (ev.author_id || ev.authorId)))?.name || (language === 'es' ? 'Admin' : 'Admin')}
                                          </span>
                                       </div>
                                       <div className="flex items-center gap-1 opacity-70">
                                          <Users size={8} />
                                          <span className="text-[8px] font-bold">{getParticipantCount(ev)}</span>
                                       </div>
                                      {status === 'en_curso' && ev.link && (
                                         <a href={ev.link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="bg-white text-indigo-600 px-2 py-0.5 rounded text-xs font-black uppercase hover:bg-indigo-50">Unirse</a>
                                      )}
                                      {status === 'programada' && (
                                         <span className="bg-white/50 text-xs px-1.5 rounded-sm font-bold truncate">Aún no inicia</span>
                                      )}
                                      {status === 'finalizada' && (
                                         <span className="bg-gray-200 dark:bg-slate-700 px-1.5 rounded-sm text-xs font-bold">Finalizada</span>
                                      )}
                                      
                                      {isTeacher && status === 'en_curso' && (
                                        <button onClick={(e) => { e.stopPropagation(); handleEndMeeting(ev.id); }} className="bg-red-500 text-white px-2 py-0.5 rounded text-xs font-black uppercase hover:bg-red-600 flex items-center gap-1" data-tooltip="Finalizar Clase">
                                           <PowerOff size={10}/> Fin
                                        </button>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          {/* Agenda View (Classic) */}
          <section className="glass-card p-6 sm:p-8 rounded-3xl">
             <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-indigo-600">
                <Clock size={24} /> {language === 'es' ? 'Próximas Clases' : 'Upcoming Classes'}
             </h2>
             <div className="grid grid-cols-1 gap-5">
                {upcomingEvents.map(ev => {
                  const status = getEventStatus(ev);
                  return (
                  <div key={ev.id} className={`p-5 sm:p-6 rounded-3xl shadow-sm border flex flex-col group transition-all relative overflow-hidden ${
                    ev.is_priority ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-700' : 
                    ev.category === 'tutoria' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700' :
                    ev.category === 'recuperacion' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700' :
                    'bg-gray-50/50 dark:bg-slate-900/30 border-gray-100 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                  }`}>
                     {ev.is_priority && <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-bl-xl shadow-lg shadow-rose-500/20">Prioritario</div>}
                     <div className="flex items-start justify-between mb-3 gap-2">
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg sm:text-xl leading-tight flex items-center gap-2.5">
                           <Video size={20} className={ev.is_priority ? 'text-rose-500' : 'text-indigo-500'}/> <span className="truncate">{ev.title}</span>
                        </h3>
                        {status === 'en_curso' && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse font-bold tracking-widest uppercase mt-1">En Vivo</span>}
                        {status === 'finalizada' && <span className="bg-gray-200 text-gray-500 text-xs px-2 py-1 rounded-full font-bold uppercase mt-1">Finalizada</span>}
                     </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-1">{new Date(ev.date || ev.startDate || Date.now()).toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short', hour12: false })}</p>
                      
                      {ev.description && (
                        <div className="mb-4 p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700/50">
                           <p className="text-sm text-gray-600 dark:text-slate-400 italic line-clamp-3">{ev.description}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mb-4">
                         <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <User size={14} />
                         </div>
                         <div className="overflow-hidden">
                            <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">{language === 'es' ? 'Organizado por' : 'Organized by'}</p>
                            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">
                               {(users?.find(u => u.id === ev.authorId))?.name || (language === 'es' ? 'Administrador' : 'Administrator')}
                            </p>
                         </div>
                         <div className="ml-auto flex flex-col items-end">
                            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                               <Users size={14} className="text-indigo-500" />
                               <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                  {getParticipantCount(ev)} {language === 'es' ? 'Integrantes' : 'Members'}
                                </span>
                            </div>
                         </div>
                      </div>
                     
                     <div className="flex flex-wrap items-center gap-2 mt-auto">
                        {status === 'en_curso' && ev.link && (
                           <a href={ev.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-md hover-spring focus-visible:ring-inset">{language === 'es' ? 'Unirse Ahora' : 'Join Now'}</a>
                        )}
                        {status === 'programada' && (
                           <button disabled className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-500 rounded-xl text-sm font-bold cursor-not-allowed opacity-70">{language === 'es' ? 'Esperando inicio...' : 'Waiting to start'}</button>
                        )}
                        {isTeacher && (
                          <div className="ml-0 sm:ml-auto flex gap-1 mt-3 sm:mt-0 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                             <button onClick={() => { setSelectedEvent(ev); setShowAttendanceModal(true); }} className="p-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl hover:bg-purple-100 transition shadow-sm" data-tooltip={language === 'es' ? "Auditar Asistencia" : "Audit Attendance"}><Users size={18}/></button>
                             {status !== 'finalizada' && <button onClick={() => handleEndMeeting(ev.id)} className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-100 transition shadow-sm" data-tooltip={language === 'es' ? "Finalizar" : "End Class"}><PowerOff size={18}/></button>}
                             <button onClick={() => handleEditClick(ev)} className="p-2.5 text-gray-500 hover:text-indigo-600 bg-white dark:bg-slate-800 rounded-xl hover:bg-indigo-50 transition shadow-sm" data-tooltip={language === 'es' ? "Editar evento" : "Edit"}><Edit2 size={18}/></button>
                             <button onClick={() => handleDeleteEvent(ev.id)} className="p-2.5 text-gray-500 hover:text-red-500 bg-white dark:bg-slate-800 rounded-xl hover:bg-red-50 transition shadow-sm" data-tooltip={language === 'es' ? "Eliminar evento" : "Delete"}><Trash2 size={18}/></button>
                          </div>
                        )}
                     </div>
                  </div>
                )})}
                {upcomingEvents.length === 0 && <p className="text-center text-gray-500 dark:text-slate-400 font-medium py-10 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-3xl">{language === 'es' ? 'Vaya, no hay eventos próximos.' : 'No upcoming events.'}</p>}
             </div>
          </section>

          <section className="glass-card p-6 sm:p-8 rounded-3xl">
             <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-gray-500 dark:text-slate-400">
                <History size={24} /> {language === 'es' ? 'Historial' : 'History'}
             </h2>
             <div className="grid grid-cols-1 gap-4">
                {pastEvents.map(ev => (
                   <div key={ev.id} className="p-5 rounded-2xl border border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/30 opacity-80 hover:opacity-100 transition-opacity">
                      <div>
                         <h3 className="font-bold text-gray-700 dark:text-gray-300 text-base">{ev.title}</h3>
                         <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-1">{new Date(ev.date || ev.startDate || Date.now()).toLocaleString(language === 'es' ? 'es-ES' : 'en-US', { dateStyle: 'long', timeStyle: 'short', hour12: false })}</p>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="flex items-center gap-1.5 opacity-70">
                            <Users size={14} className="text-indigo-500" />
                            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                               {getParticipantCount(ev)} {language === 'es' ? 'Integrantes' : 'Members'}
                            </span>
                         </div>
                         <button onClick={() => { setSelectedEvent(ev); setShowAttendanceModal(true); }} className="px-4 py-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition ml-4 shrink-0"><Users size={16} className="inline mr-1.5"/> {language === 'es' ? 'Lista' : 'List'}</button>
                      </div>
                   </div>
                ))}
             </div>
          </section>
        </div>
      )}
      </div>

      {/* Programar/Editar Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" aria-modal="true" role="dialog">
          <form onSubmit={handleSaveEvent} className="glass-card w-full max-w-lg rounded-3xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 sm:p-8 border-b border-gray-100 dark:border-slate-700/50 shrink-0">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{editingEventId ? (language === 'es' ? 'Editar Clase' : 'Edit Class') : (language === 'es' ? 'Programar Nueva Clase' : 'Schedule New Class')}</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-500 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition focus-visible:ring-inset" aria-label="Close"><X size={28}/></button>
            </div>
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <label htmlFor="sessionTitle" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Título de la Sesión' : 'Session Title'}</label>
                <input id="sessionTitle" name="sessionTitle" required value={title} onChange={e=>setTitle(e.target.value)} type="text" className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow shadow-sm font-medium" placeholder={language === 'es' ? "Ej. Laboratorio de Física" : "e.g. Physics Lab"} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                 <div>
                   <label htmlFor="sessionStart" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Inicio de Clase' : 'Start Time'}</label>
                   <input id="sessionStart" name="sessionStart" required value={date} onChange={e=>setDate(e.target.value)} type="datetime-local" className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow shadow-sm dark:[color-scheme:dark]" />
                 </div>
                 <div>
                   <label htmlFor="sessionEnd" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Fin / Cierre' : 'End Time'}</label>
                   <input id="sessionEnd" name="sessionEnd" value={endDate} onChange={e=>setEndDate(e.target.value)} type="datetime-local" className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow shadow-sm dark:[color-scheme:dark]" />
                 </div>
              </div>
              <div>
                <label htmlFor="sessionDescription" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Descripción' : 'Description'}</label>
                <textarea id="sessionDescription" name="sessionDescription" value={description} onChange={e=>setDescription(e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-shadow shadow-sm text-sm" placeholder={language === 'es' ? "Tema de la clase o instrucciones previas..." : "Subject or instructions..."} rows="3" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-slate-700">
                <div>
                   <label htmlFor="sessionCategory" className="block text-xs font-black uppercase text-gray-500 mb-2 tracking-widest">{language === 'es' ? 'Categoría' : 'Category'}</label>
                   <select id="sessionCategory" name="sessionCategory" value={category} onChange={e=>setCategory(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm">
                      <option value="normal">📅 {language === 'es' ? 'Clase Normal' : 'Normal Class'}</option>
                      <option value="importante">🚨 {language === 'es' ? 'Importante' : 'Important'}</option>
                      <option value="recuperacion">🔄 {language === 'es' ? 'Recuperación' : 'Recovery'}</option>
                      <option value="tutoria">🤝 {language === 'es' ? 'Tutoría' : 'Tutoring'}</option>
                   </select>
                </div>
                <div className="flex flex-col justify-center">
                   <label htmlFor="isPriority" className="flex items-center gap-3 cursor-pointer group">
                      <div className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isPriority ? 'bg-red-500' : 'bg-gray-300 dark:bg-slate-700'}`}>
                         <input id="isPriority" name="isPriority" type="checkbox" className="hidden" checked={isPriority} onChange={e=>setIsPriority(e.target.checked)} />
                         <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-300 ${isPriority ? 'left-7' : 'left-1'}`}></div>
                      </div>
                      <span className={`text-xs font-black uppercase tracking-widest ${isPriority ? 'text-red-500' : 'text-gray-500'}`}>{language === 'es' ? 'Prioridad Alta' : 'High Priority'}</span>
                   </label>
                </div>
              </div>

              {/* ── Student Assignment Section ── */}
              <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800/50 overflow-hidden">
                <div className="p-4 bg-indigo-50/60 dark:bg-indigo-900/10 flex items-center gap-3">
                  <UserCheck size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-sm font-bold text-indigo-800 dark:text-indigo-300">{language === 'es' ? 'Acceso a la reunión' : 'Meeting Access'}</span>
                </div>
                {/* Toggle: All / Specific */}
                <div className="grid grid-cols-2 gap-2 p-4 bg-white/60 dark:bg-slate-900/30">
                  <button type="button"
                    onClick={() => { setAssignMode('all'); setSelectedStudents([]); }}
                    className={`py-2.5 px-4 rounded-xl text-sm font-black uppercase tracking-wide transition-all border-2 ${
                      assignMode === 'all'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                        : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <Users size={14} className="inline mr-1.5 mb-0.5" />
                    {language === 'es' ? 'Todos' : 'All Students'}
                  </button>
                  <button type="button"
                    onClick={() => setAssignMode('specific')}
                    className={`py-2.5 px-4 rounded-xl text-sm font-black uppercase tracking-wide transition-all border-2 ${
                      assignMode === 'specific'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20'
                        : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-slate-700 hover:border-indigo-300'
                    }`}
                  >
                    <UserCheck size={14} className="inline mr-1.5 mb-0.5" />
                    {language === 'es' ? 'Seleccionar' : 'Select'}
                  </button>
                </div>

                {assignMode === 'specific' && (() => {
                  const students = (users || []).filter(u => u.role === 'estudiante');
                  const filtered = students.filter(u =>
                    u.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                    u.email?.toLowerCase().includes(studentSearch.toLowerCase())
                  );
                  return (
                    <div className="px-4 pb-4 bg-white/60 dark:bg-slate-900/30 space-y-3">
                      {/* Quick actions */}
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => setSelectedStudents(students.map(s => s.id))}
                          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >{language === 'es' ? 'Seleccionar todos' : 'Select all'}</button>
                        <span className="text-gray-300 dark:text-slate-600">|</span>
                        <button type="button"
                          onClick={() => setSelectedStudents([])}
                          className="text-xs font-bold text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:underline"
                        >{language === 'es' ? 'Limpiar selección' : 'Clear'}</button>
                        {selectedStudents.length > 0 && (
                          <span className="ml-auto text-[10px] font-black uppercase tracking-widest bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                            {selectedStudents.length} {language === 'es' ? 'seleccionados' : 'selected'}
                          </span>
                        )}
                      </div>
                      {/* Search */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={e => setStudentSearch(e.target.value)}
                          placeholder={language === 'es' ? 'Buscar estudiante...' : 'Search student...'}
                          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      {/* Student list */}
                      <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                        {filtered.length === 0 && (
                          <p className="text-center text-sm text-gray-400 py-4">
                            {language === 'es' ? 'No hay estudiantes' : 'No students found'}
                          </p>
                        )}
                        {filtered.map(student => {
                          const isSelected = selectedStudents.includes(student.id);
                          return (
                            <label key={student.id}
                              className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700'
                                  : 'bg-gray-50/50 dark:bg-slate-800/50 border-transparent hover:border-gray-200 dark:hover:border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudent(student.id)}
                                className="w-4 h-4 accent-indigo-600 rounded"
                              />
                              <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black uppercase shrink-0">
                                {student.name?.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{student.name}</p>
                                <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{student.email}</p>
                              </div>
                              {isSelected && <CheckCircle size={16} className="ml-auto shrink-0 text-indigo-600 dark:text-indigo-400" />}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <label className="flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm font-medium mb-3 gap-2">
                   <span className="text-indigo-800 dark:text-indigo-300 font-bold">{language === 'es' ? 'Enlace de Reunión' : 'Meeting Link'}</span>
                   <button type="button" onClick={handleAutoGenerateLink} className="text-[10px] w-full sm:w-auto text-center uppercase font-black tracking-widest text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 shadow-sm px-3 py-2 rounded-lg transition active:scale-95 hover:bg-gray-50 focus-visible:ring-inset">Generar Jitsi Link</button>
                </label>
                <input value={link} onChange={e=>setLink(e.target.value)} type="url" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-shadow shadow-sm" placeholder="URL Meet/Zoom/Teams" />
              </div>
            </div>
            <div className="p-6 sm:p-8 border-t border-gray-100 dark:border-slate-700/50 shrink-0 bg-gray-50/50 dark:bg-slate-900/30">
               <button disabled={isSubmitting} type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 disabled:opacity-50 transition transform hover-spring active:scale-95 uppercase tracking-widest focus-visible:ring-inset">{editingEventId ? (language === 'es' ? 'Guardar Cambios' : 'Save Changes') : (language === 'es' ? 'Agendar Sesión' : 'Schedule')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Asistencia Modal */}
      {showAttendanceModal && selectedEvent && (
         <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4 animate-fade-in" aria-modal="true" role="dialog">
            <div className="glass-card w-full max-w-2xl rounded-3xl shadow-2xl animate-scale-in flex flex-col max-h-[95vh] sm:max-h-[90vh]">
               <div className="p-6 sm:p-8 border-b border-purple-100 dark:border-purple-900/30 flex justify-between items-center bg-purple-50 shrink-0 rounded-t-3xl dark:bg-slate-800">
                  <div className="flex-1">
                     <h3 className="text-2xl font-black text-purple-900 dark:text-white leading-tight">{language === 'es' ? 'Control de Asistencia' : 'Attendance Control'}</h3>
                     <p className="text-sm text-purple-600 dark:text-purple-400 font-bold mt-1 uppercase tracking-widest truncate max-w-md">
                        {selectedEvent.title} | {new Date(selectedEvent.date || selectedEvent.startDate || Date.now()).toLocaleDateString()}
                     </p>
                     {selectedEvent.assignedTo && !selectedEvent.assignedTo.includes('all') ? (
                       <div className="mt-2 flex items-center gap-2">
                         <span className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                           <UserCheck size={11}/> {selectedEvent.assignedTo.length} {language === 'es' ? 'estudiantes invitados' : 'invited students'}
                         </span>
                       </div>
                     ) : (
                       <div className="mt-2">
                         <span className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                           <Users size={11}/> {language === 'es' ? 'Todos los estudiantes' : 'All students'}
                         </span>
                       </div>
                     )}
                  </div>
                  <div className="flex items-center gap-2">
                     {isTeacher && (
                        <button 
                          onClick={() => { if(window.confirm(language === 'es' ? '¿Eliminar esta clase permanentemente?' : 'Delete this class permanently?')) { handleDeleteEvent(selectedEvent.id); setShowAttendanceModal(false); } }} 
                          className="p-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 transition shadow-sm"
                          title={language === 'es' ? "Eliminar Clase" : "Delete Class"}
                        >
                           <Trash2 size={24}/>
                        </button>
                     )}
                     <button onClick={() => {setShowAttendanceModal(false); setSelectedEvent(null);}} className="bg-white/50 dark:bg-slate-700/50 p-2.5 rounded-xl text-purple-900 dark:text-purple-100 hover:bg-white transition focus-visible:ring-inset"><X size={24}/></button>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                  <table className="w-full block">
                     <thead className="block w-full">
                        <tr className="flex justify-between text-left text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 uppercase tracking-widest border-b dark:border-slate-700/50 px-4">
                           <th className="pb-3 flex-1">{language === 'es' ? 'Estudiante Regular' : 'Student'}</th>
                           <th className="pb-3 text-right w-40 sm:w-48">{language === 'es' ? 'Registro de Presencia' : 'Attendance Record'}</th>
                        </tr>
                     </thead>
                     <tbody className="block w-full divide-y divide-gray-100 dark:divide-slate-700/50">
                        {users.filter(u => u.role === 'estudiante').map(student => {
                           const attRecord = attendance.find(a => (a.event_id === selectedEvent.id || a.eventId === selectedEvent.id) && (a.student_id === student.id || a.studentId === student.id));
                           const isPresent = attRecord?.is_present ?? attRecord?.isPresent;
                           const assigned = selectedEvent.assigned_to || selectedEvent.assignedTo;
                           const isInvited = !assigned || assigned.includes('all') || assigned.includes(student.id);
                           return (
                              <tr key={student.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center transition-colors p-4 rounded-2xl gap-4 sm:gap-0 ${isInvited ? "hover:bg-gray-50/50 dark:hover:bg-slate-700/30" : "opacity-50 hover:opacity-80"}`}>
                                 <td className="flex-1 min-w-0 pr-0 sm:pr-4 w-full">
                                    <div className="flex items-center gap-4">
                                       <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black uppercase shrink-0 shadow-inner ${isInvited ? "bg-indigo-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400" : "bg-gray-100 dark:bg-slate-800 text-gray-400"}`}>{student.name.charAt(0)}</div>
                                       <div className="truncate w-full relative">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-bold truncate text-gray-900 dark:text-white pr-2" data-tooltip={student.name}>{student.name}</p>
                                            {selectedEvent.assignedTo && !selectedEvent.assignedTo.includes("all") && (
                                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${isInvited ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400" : "bg-gray-100 dark:bg-slate-700 text-gray-400"}`}>
                                                {isInvited ? (language === "es" ? "? Invitado" : "? Invited") : (language === "es" ? "No invitado" : "Not invited")}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 truncate uppercase tracking-widest pr-2">{student.email}</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="text-right shrink-0 w-full sm:w-auto">
                                    {isTeacher ? (
                                       <div className="flex items-center sm:justify-end gap-1.5 bg-gray-100/50 dark:bg-slate-900/50 p-1.5 rounded-xl w-full sm:w-auto">
                                          <button 
                                             onClick={() => handleToggleAttendance(selectedEvent.id, student.id, true)}
                                             className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-black transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isPresent === true ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'}`}
                                          >{language === 'es' ? 'Firma' : 'Present'}</button>
                                          <button 
                                             onClick={() => handleToggleAttendance(selectedEvent.id, student.id, false)}
                                             className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-black transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isPresent === false ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'}`}
                                          >{language === 'es' ? 'Falta' : 'Absent'}</button>
                                       </div>
                                    ) : (
                                       <div className={`inline-flex items-center justify-center w-full sm:w-auto gap-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-sm ${isPresent === true ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/50' : isPresent === false ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-300'}`}>
                                          {isPresent === true ? (language === 'es' ? 'Asistió' : 'Attended') : isPresent === false ? (language === 'es' ? 'Ausente' : 'Absent') : (language === 'es' ? 'Sin lista' : 'Unmarked')}
                                       </div>
                                    )}
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
               <div className="p-6 border-t border-gray-100 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30 shrink-0 text-center rounded-b-3xl">
                  <button onClick={() => setShowAttendanceModal(false)} className="w-full sm:w-auto px-10 py-3 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl font-black uppercase tracking-widest shadow-sm border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition active:scale-95 focus-visible:ring-inset">{language === 'es' ? 'Guardar y Cerrar' : 'Save & Close'}</button>
               </div>
            </div>
         </div>
      )}

    </>
  );
}
