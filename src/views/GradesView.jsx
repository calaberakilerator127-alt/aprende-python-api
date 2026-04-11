import React, { useState, useMemo } from 'react';
import { Award, Search, User, FileText, CheckCircle, X, ExternalLink, Calendar, Mail, AlertCircle, Clock, Check, Filter, AlertTriangle, Save, ArrowRight, Info, ShieldCheck, Paperclip, MessageSquare, Download, Settings } from 'lucide-react';
import api from '../config/api';
import { useSettings } from '../hooks/SettingsContext';
import CommentsSection from '../components/CommentsSection';
import DocumentEditor from '../components/DocumentEditor';

export default function GradesView({ profile, activities, submissions, users, attendance = [], events = [], gradingConfigs = [], playSound, comments = [], showToast, fetchFullRecord }) {
  const { language } = useSettings();
  const isTeacher = profile.role === 'profesor';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [gradingSubmission, setGradingSubmission] = useState(null);
  const [grade, setGrade] = useState('');
  const [teacherFeedback, setTeacherFeedback] = useState('');
  const [editedHtml, setEditedHtml] = useState('');
  const [filterPending, setFilterPending] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Get current teacher's config
  const myConfig = useMemo(() => gradingConfigs?.find(c => c.teacher_id === profile.id) || {
    weights: { tarea: 20, actividades: 10, evaluaciones: 30, examenes: 30, proyectos: 10 },
    grade_scale: 10,
    attendance_weight: 0,
    include_attendance: false
  }, [gradingConfigs, profile.id]);

  const calculateWeightedAverage = (studentId) => {
    const studentSubs = submissions.filter(s => s.studentId === studentId && s.status === 'calificado');
    
    const categories = ['tarea', 'actividades', 'evaluaciones', 'examenes', 'proyectos'];
    let totalWeightedScore = 0;
    let totalWeightUsed = 0;

    categories.forEach(cat => {
      const catWeight = myConfig.weights?.[cat] || 0;
      const catSubs = studentSubs.filter(s => {
        const act = activities.find(a => a.id === s.activityId);
        return act?.type === cat;
      });

      if (catSubs.length > 0) {
        const catAvg = catSubs.reduce((acc, s) => {
          const act = activities.find(a => a.id === s.activityId);
          const scale = act?.scale || act?.points || 10;
          return acc + (s.grade / scale);
        }, 0) / catSubs.length;

        totalWeightedScore += (catAvg * catWeight);
        totalWeightUsed += catWeight;
      }
    });

    // Integrated Attendance Weight
    if (myConfig.include_attendance && myConfig.attendance_weight > 0) {
      const relevantEvents = events.filter(e => {
        const isAssigned = e.assignedTo?.includes('all') || e.assignedTo?.includes(studentId);
        const isPast = e.status === 'finalizada' || new Date(e.date || e.startDate) < new Date();
        return isAssigned && isPast;
      });

      if (relevantEvents.length > 0) {
        const attended = attendance.filter(a => a.studentId === studentId && a.isPresent && relevantEvents.some(e => e.id === a.eventId)).length;
        const attendanceRate = attended / relevantEvents.length;
        
        totalWeightedScore += (attendanceRate * myConfig.attendance_weight);
        totalWeightUsed += myConfig.attendance_weight;
      }
    }

    if (totalWeightUsed === 0) return 0;
    return (totalWeightedScore / totalWeightUsed) * (myConfig.grade_scale || 10);
  };

  const handleSaveConfig = async (newWeights, newScale, attWeight, incAtt) => {
    setIsSavingConfig(true);
    try {
      const configData = {
        teacher_id: profile.id,
        weights: newWeights,
        grade_scale: Number(newScale),
        attendance_weight: Number(attWeight),
        include_attendance: incAtt
      };
      
      if (myConfig.id) {
        await api.put(`/data/grading_configs/${myConfig.id}`, configData);
      } else {
        await api.post('/data/grading_configs', configData);
      }
      setShowConfigModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingConfig(false);
    }
  };
  const [weights, setWeights] = useState(myConfig.weights);
  const [globalScale, setGlobalScale] = useState(myConfig.grade_scale);
  const [attWeight, setAttWeight] = useState(myConfig.attendance_weight || 0);
  const [incAtt, setIncAtt] = useState(myConfig.include_attendance || false);

  // Sync internal modal state when config changes or modal opens
  React.useEffect(() => {
     if (showConfigModal) {
        setWeights(myConfig.weights);
        setGlobalScale(myConfig.grade_scale);
        setAttWeight(myConfig.attendance_weight || 0);
        setIncAtt(myConfig.include_attendance || false);
     }
  }, [showConfigModal, myConfig]);

  const handleGradeSubmission = async (e) => {
    e.preventDefault();
    if (!gradingSubmission || grade === '') return;
    try {
      await api.put(`/data/submissions/${gradingSubmission.id}`, {
          grade: Number(grade),
          rubric_scores: gradingSubmission.rubric_scores_draft || {},
          teacher_feedback: teacherFeedback,
          status: 'calificado',
          graded_at: Date.now(),
          graded_by: profile.id
      });
      
      setGradingSubmission(null);
      setGrade('');
      setEditedHtml('');
    } catch (e) {
      console.error(e);
    }
  };

  const studentUsers = users.filter(u => u.role === 'estudiante');
  
  const filteredStudents = studentUsers.filter(u => 
    !u.is_deleted && (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  ).filter(u => {
    if (!filterPending) return true;
    return submissions.some(s => s.studentId === u.id && s.status === 'entregado');
  });

  const studentSubmissions = submissions.filter(s => s.studentId === (selectedStudent?.id || profile.id));
  
  const getSubmissionForActivity = (activityId, studentId) => 
    submissions.find(s => s.activityId === activityId && s.studentId === studentId);

  const totalPending = submissions.filter(s => s.status === 'entregado').length;
  const totalGraded = submissions.filter(s => s.status === 'calificado').length;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="aura-card p-0 overflow-hidden shadow-2xl">
        <div className="aura-gradient-primary px-10 py-12 text-white flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="space-y-4 text-center md:text-left">
            <h1 className="text-5xl font-black uppercase tracking-tighter flex items-center justify-center md:justify-start gap-4">
              <Award className="text-amber-400" size={56} /> 
              {isTeacher ? (language === 'es' ? 'Centro de Analíticas' : 'Analytics Center') : (language === 'es' ? 'Mi Progreso' : 'My Progress')}
            </h1>
            <p className="text-white/60 font-black text-xs uppercase tracking-[0.3em]">{language === 'es' ? 'Monitorización de Desempeño en Tiempo Real' : 'Real-Time Performance Monitoring'}</p>
          </div>
          
          {isTeacher && (
            <div className="flex gap-4 w-full md:w-auto">
               <div className="flex-1 md:flex-none bg-white/10 backdrop-blur-md border border-white/20 px-8 py-6 rounded-[2rem] text-center transition-all hover:bg-white/20">
                  <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1">{language === 'es' ? 'Pendientes' : 'Pending'}</p>
                  <p className="text-4xl font-black text-white">{totalPending}</p>
               </div>
               <div className="flex-1 md:flex-none bg-white/10 backdrop-blur-md border border-white/20 px-8 py-6 rounded-[2rem] text-center transition-all hover:bg-white/20">
                  <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest mb-1">{language === 'es' ? 'Auditados' : 'Audited'}</p>
                  <p className="text-4xl font-black text-white">{totalGraded}</p>
               </div>
            </div>
          )}
        </div>
      </div>

      {isTeacher ? (
        <div className="aura-card rounded-[2.5rem] overflow-hidden shadow-2xl border-none">
          <div className="p-10 border-b dark:border-slate-800 flex flex-col lg:flex-row gap-8 justify-between items-center bg-slate-50/50 dark:bg-slate-900/40">
             <div className="relative w-full lg:w-[32rem] group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={24} />
                <input id="studentSearch" name="studentSearch" type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder="..." className="w-full pl-16 pr-8 py-5 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-3xl outline-none transition-all shadow-inner font-black placeholder:text-slate-300" />
             </div>
             
             <div className="flex items-center gap-4 w-full lg:w-auto">
                 <button 
                   onClick={() => setShowConfigModal(true)}
                   className="flex-1 lg:flex-none flex items-center justify-center gap-4 px-8 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-2 border-slate-100 dark:border-slate-700 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                 >
                    <Settings size={20} />
                    {language === 'es' ? 'Configurar' : 'Configure'}
                 </button>
                 <button 
                   onClick={() => setFilterPending(!filterPending)}
                   className={`flex-1 lg:flex-none flex items-center justify-center gap-4 px-8 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-xl hover:scale-105 active:scale-95 ${filterPending ? 'aura-gradient-primary text-white shadow-indigo-500/30' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-2 border-slate-100 dark:border-slate-700'}`}
                 >
                    <Filter size={20} />
                    {filterPending ? (language === 'es' ? 'Pendientes' : 'Pending') : (language === 'es' ? 'Todos' : 'All')}
                 </button>
              </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar p-6">
             <table className="w-full text-left border-separate border-spacing-y-4">
               <thead>
                 <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                   <th className="px-10 py-6">{language === 'es' ? 'Estudiante' : 'Student'}</th>
                   <th className="px-10 py-6">{language === 'es' ? 'Rendimiento' : 'Performance'}</th>
                   <th className="px-10 py-6">{language === 'es' ? 'Actividad' : 'Activity'}</th>
                   <th className="px-10 py-6">{language === 'es' ? 'Progreso' : 'Progress'}</th>
                   <th className="px-10 py-6 text-right">{language === 'es' ? 'Operación' : 'Operation'}</th>
                 </tr>
               </thead>
               <tbody>
                 {filteredStudents.length === 0 ? (
                   <tr>
                     <td colSpan="5" className="px-10 py-32 text-center">
                        <div className="flex flex-col items-center gap-8 opacity-20">
                           <Search size={120} strokeWidth={1} />
                           <p className="text-2xl font-black uppercase tracking-widest">{language === 'es' ? 'Sin Coincidencias' : 'No Matches'}</p>
                        </div>
                     </td>
                   </tr>
                 ) : (
                   filteredStudents.map(student => {
                     const studentSubs = submissions.filter(s => s.studentId === student.id);
                     const gradedSubs = studentSubs.filter(s => s.status === 'calificado');
                     const pendingCount = studentSubs.filter(s => s.status === 'entregado').length;
                     const progress = Math.round((gradedSubs.length / (activities.length || 1)) * 100);
                     const weightedAvg = calculateWeightedAverage(student.id);
                     
                     return (
                       <tr key={student.id} className="group/row">
                         <td className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-l-[1.5rem] border-y border-l border-transparent group-hover/row:border-indigo-100 dark:group-hover/row:border-indigo-900/50 group-hover/row:bg-white dark:group-hover/row:bg-slate-800 transition-all">
                           <div className="flex items-center gap-6">
                              <div className="relative">
                                 <div className="w-16 h-16 rounded-[1.2rem] aura-gradient-primary text-white flex items-center justify-center font-black text-2xl shadow-xl uppercase transform rotate-2 group-hover/row:rotate-0 transition-all border-4 border-white dark:border-slate-800">
                                   {student.photoURL ? <img src={student.photoURL} className="w-full h-full object-cover rounded-[1rem]" /> : (student.name?.charAt(0) || '?')}
                                 </div>
                                 {pendingCount > 0 && <span className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 border-4 border-white dark:border-slate-800 rounded-2xl flex items-center justify-center text-xs font-black text-white shadow-xl animate-bounce">{pendingCount}</span>}
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-slate-800 dark:text-white text-lg tracking-tighter uppercase truncate leading-tight">{student.name}</p>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1 opacity-60">{student.email}</p>
                              </div>
                           </div>
                         </td>
                         <td className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 border-y border-transparent group-hover/row:border-indigo-100 dark:group-hover/row:border-indigo-900/50 group-hover/row:bg-white dark:group-hover/row:bg-slate-800 transition-all">
                            <div className="flex flex-col">
                               <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                                  {weightedAvg.toFixed(2)}
                               </span>
                               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Global Score</span>
                            </div>
                         </td>
                         <td className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 border-y border-transparent group-hover/row:border-indigo-100 dark:group-hover/row:border-indigo-900/50 group-hover/row:bg-white dark:group-hover/row:bg-slate-800 transition-all">
                            <div className="flex flex-wrap gap-2">
                               <span className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-400 shadow-sm border dark:border-slate-700 flex items-center gap-2">
                                  <FileText size={16} className="text-indigo-400"/> {studentSubs.length}
                               </span>
                               {pendingCount > 0 && (
                                 <span className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm border border-rose-100 dark:border-rose-900/50">
                                    <AlertTriangle size={16}/> {pendingCount}
                                 </span>
                               )}
                            </div>
                         </td>
                         <td className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 border-y border-transparent group-hover/row:border-indigo-100 dark:group-hover/row:border-indigo-900/50 group-hover/row:bg-white dark:group-hover/row:bg-slate-800 transition-all">
                            <div className="w-32">
                               <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{progress}%</span>
                               </div>
                               <div className="h-3 w-full bg-slate-200 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner p-1">
                                  <div className={`h-full rounded-full transition-all duration-1000 ${progress === 100 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`} style={{ width: `${progress}%` }}></div>
                               </div>
                            </div>
                         </td>
                         <td className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-r-[1.5rem] border-y border-r border-transparent group-hover/row:border-indigo-100 dark:group-hover/row:border-indigo-900/50 group-hover/row:bg-white dark:group-hover/row:bg-slate-800 transition-all text-right">
                           <button 
                             onClick={() => setSelectedStudent(student)} 
                             className="px-8 py-3 aura-gradient-primary text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 hover:scale-110 active:scale-95 transition-all"
                           >{language === 'es' ? 'Detalles' : 'Details'}</button>
                         </td>
                       </tr>
                     )
                   })
                 )}
               </tbody>
             </table>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="aura-card p-10 relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                 <div className="absolute -right-20 -bottom-20 w-80 h-80 aura-gradient-primary opacity-10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity"></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.3em]">{language === 'es' ? 'Puntaje de Operaciones (GPA)' : 'Operations Score (GPA)'}</p>
                 <div className="flex items-end gap-4">
                    <p className="text-8xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                      {studentSubmissions.filter(s => s.status === 'calificado').length > 0 
                       ? (studentSubmissions.filter(s => s.status === 'calificado').reduce((acc, s) => acc + (s.grade || 0), 0) / studentSubmissions.filter(s => s.status === 'calificado').length).toFixed(1)
                       : '0.0'}
                    </p>
                    <span className="text-slate-300 font-black mb-4 text-2xl uppercase tracking-widest">Index</span>
                 </div>
              </div>
              <div className="aura-card p-10 relative overflow-hidden group hover:scale-[1.02] transition-all duration-500">
                 <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl group-hover:opacity-20 transition-opacity"></div>
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.3em]">{language === 'es' ? 'Cargas de Datos Exitosas' : 'Successful Data Loads'}</p>
                 <p className="text-8xl font-black text-emerald-500 dark:text-emerald-400 tracking-tighter">{studentSubmissions.length}</p>
              </div>
           </div>

           <div className="aura-card rounded-[2.5rem] overflow-hidden shadow-2xl border-none">
              <div className="overflow-x-auto custom-scrollbar p-6">
                 <table className="w-full text-left border-separate border-spacing-y-4">
                   <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                     <tr>
                       <th className="px-10 py-6">{language === 'es' ? 'Nomenclatura' : 'Nomenclature'}</th>
                       <th className="px-10 py-6">{language === 'es' ? 'Estado del Enlace' : 'Link Status'}</th>
                       <th className="px-10 py-6 text-right">{language === 'es' ? 'Valor Final' : 'Final Value'}</th>
                     </tr>
                   </thead>
                   <tbody>
                     {activities.map(act => {
                       const sub = getSubmissionForActivity(act.id, profile.id);
                       return (
                          <tr key={act.id} className="group/row">
                             <td className="px-10 py-8 bg-slate-50/50 dark:bg-slate-800/30 rounded-l-[1.5rem] border-y border-l border-transparent group-hover/row:border-indigo-100 dark:group-hover/row:border-indigo-900/50 group-hover/row:bg-white dark:group-hover/row:bg-slate-800 transition-all">
                                <p className="text-lg font-black text-slate-800 dark:text-white mb-1 uppercase tracking-tighter">{act.title}</p>
                                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-[0.2em]">{act.type}</p>
                             </td>
                             <td className="px-10 py-8 bg-slate-50/50 dark:bg-slate-800/30 border-y border-transparent group-hover/row:border-indigo-100 dark:group-hover/row:border-indigo-900/50 group-hover/row:bg-white dark:group-hover/row:bg-slate-800 transition-all">
                                <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 ${
                                  sub?.status === 'calificado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  sub?.status === 'entregado' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                                }`}>
                                   <div className={`w-2 h-2 rounded-full ${sub?.status === 'calificado' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : sub?.status === 'entregado' ? 'bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-400'}`}></div>
                                   {sub?.status || (language === 'es' ? 'Inactivo' : 'Inactive')}
                                </div>
                             </td>
                             <td className="px-10 py-8 bg-slate-50/50 dark:bg-slate-800/30 rounded-r-[1.5rem] border-y border-r border-transparent group-hover/row:border-indigo-100 dark:group-hover/row:border-indigo-900/50 group-hover/row:bg-white dark:group-hover/row:bg-slate-800 transition-all text-right">
                                {sub?.grade !== undefined ? (
                                  <div className="flex items-end justify-end gap-1">
                                    <span className="text-4xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{sub.grade}</span> 
                                    <span className="text-[10px] font-black text-slate-300 mb-2 uppercase tracking-widest">/ {act.points}</span>
                                  </div>
                                ) : <span className="text-slate-300 font-black text-3xl opacity-20 tracking-tighter">-- --</span>}
                             </td>
                          </tr>
                       )
                     })}
                     {activities.length === 0 && (
                        <tr>
                           <td colSpan="3" className="px-10 py-32 text-center">
                              <p className="text-2xl font-black uppercase tracking-widest opacity-20 text-slate-400">{language === 'es' ? 'Sin Registros' : 'No Records'}</p>
                           </td>
                        </tr>
                     )}
                   </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in shadow-2xl">
          <div className="aura-card w-full max-w-6xl h-[95vh] overflow-hidden rounded-[3rem] shadow-3xl flex flex-col border-none relative">
             
             {/* Floating Close Button */}
             <div className="absolute top-10 right-10 z-50">
               <button 
                  onClick={() => setSelectedStudent(null)} 
                  className="p-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-2xl transition-all"
               >
                  <X size={32}/>
               </button>
             </div>

             {/* Header Header */}
             <div className="px-12 py-16 aura-gradient-primary text-white shrink-0 relative overflow-hidden">
               <div className="absolute right-0 bottom-0 w-96 h-96 bg-white/10 rounded-full -mr-32 -mb-32 blur-3xl"></div>
               <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                  <div className="w-40 h-40 rounded-[2.5rem] bg-white text-indigo-600 flex items-center justify-center font-black text-6xl shadow-2xl transform -rotate-3 hover:rotate-0 transition-all border-[8px] border-white/20 overflow-hidden">
                    {selectedStudent.photoURL ? <img src={selectedStudent.photoURL} className="w-full h-full object-cover" /> : (selectedStudent.name?.charAt(0) || '?')}
                  </div>
                  <div className="text-center md:text-left space-y-4">
                    <h3 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-none">{selectedStudent.name}</h3>
                    <div className="flex flex-wrap justify-center md:justify-start gap-4">
                       <span className="text-xs font-black uppercase tracking-[0.2em] bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20 flex items-center gap-3"><Mail size={18}/> {selectedStudent.email}</span>
                       <span className="text-xs font-black uppercase tracking-[0.2em] bg-emerald-500/20 px-6 py-3 rounded-2xl backdrop-blur-md border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
                          <ShieldCheck size={18} /> Student Unit
                       </span>
                    </div>
                  </div>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto p-12 space-y-16 custom-scrollbar bg-white dark:bg-slate-900">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                   {[
                     { label: language === 'es' ? 'Entregas' : 'Submissions', val: submissions.filter(s => s.studentId === selectedStudent.id).length, color: 'indigo' },
                     { label: language === 'es' ? 'Pendientes' : 'Pending', val: submissions.filter(s => s.studentId === selectedStudent.id && s.status === 'entregado').length, color: 'rose' },
                     { label: language === 'es' ? 'Asistencias' : 'Attendance', val: attendance.filter(a => a.studentId === selectedStudent.id && a.isPresent).length, color: 'emerald' },
                     { label: language === 'es' ? 'Aprobación' : 'Approval', val: Math.round((submissions.filter(s => s.studentId === selectedStudent.id && s.grade >= (myConfig.grade_scale * 0.6)).length / (submissions.filter(s => s.studentId === selectedStudent.id && s.status === 'calificado').length || 1)) * 100) + '%', color: 'amber' }
                   ].map((st, i) => (
                     <div key={i} className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border-2 border-transparent hover:border-indigo-100 transition-all text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-[0.2em]">{st.label}</p>
                        <p className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter">{st.val}</p>
                     </div>
                   ))}
                </div>

                <div className="aura-card rounded-[2.5rem] border-none shadow-xl overflow-hidden">
                   <div className="p-10 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 font-black text-[10px] uppercase tracking-[0.3em] flex items-center gap-4 text-slate-500">
                      <FileText size={20} className="text-indigo-500" /> {language === 'es' ? 'Bitácora de Operaciones' : 'Operations Log'}
                   </div>
                   <div className="overflow-x-auto p-6">
                      <table className="w-full text-left border-separate border-spacing-y-3">
                        <thead>
                           <tr className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                              <th className="px-10 py-4">{language === 'es' ? 'Misión' : 'Mission'}</th>
                              <th className="px-10 py-4 text-center">{language === 'es' ? 'Resultado' : 'Result'}</th>
                              <th className="px-10 py-4 text-right">{language === 'es' ? 'Estado' : 'Status'}</th>
                           </tr>
                        </thead>
                        <tbody>
                           {activities.map(act => {
                              const sub = getSubmissionForActivity(act.id, selectedStudent.id);
                              return (
                                 <tr key={act.id} className="group/sub">
                                    <td className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-l-2xl">
                                       <div className="flex items-center gap-4">
                                          <div className={`w-2 h-2 rounded-full ${act.type==='tarea' ? 'bg-indigo-500' : 'bg-amber-500'}`}></div>
                                          <span className="font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">{act.title}</span>
                                       </div>
                                    </td>
                                    <td className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 text-center">
                                       {sub ? (
                                          <span className="font-black text-2xl text-indigo-600">{sub.grade !== undefined ? sub.grade : '--'} <span className="text-[10px] text-slate-300">/ {act.points}</span></span>
                                       ) : <span className="text-[10px] font-black text-slate-300 uppercase">--</span>}
                                    </td>
                                    <td className="px-10 py-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-r-2xl text-right">
                                       {sub ? (
                                          <button 
                                            onClick={async () => { 
                                              let targetSub = sub;
                                              if (sub.id && !sub.html_content && !sub.htmlContent && !sub.attachments) {
                                                const fullSub = await fetchFullRecord('submissions', sub.id);
                                                if (fullSub) targetSub = fullSub;
                                              }
                                              setGradingSubmission(targetSub); 
                                              setGrade(targetSub.grade !== undefined ? targetSub.grade.toString() : ''); 
                                              setEditedHtml(targetSub.html_content || targetSub.htmlContent || '');
                                            }}
                                            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub.status === 'entregado' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:bg-indigo-500 hover:text-white'}`}
                                          >
                                             {sub.status === 'entregado' ? (language === 'es' ? 'Auditar' : 'Audit') : (language === 'es' ? 'Revisar' : 'Review')}
                                          </button>
                                       ) : <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pending</span>}
                                    </td>
                                 </tr>
                              )
                           })}
                        </tbody>
                      </table>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[120] flex items-center justify-center p-4 animate-fade-in">
           <div className="aura-card w-full max-w-7xl h-[95vh] overflow-hidden rounded-[3rem] shadow-3xl flex flex-col border-none">
              
              {/* Header */}
              <div className="p-10 border-b dark:border-slate-800 aura-gradient-primary text-white flex justify-between items-center shrink-0">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">{language === 'es' ? 'Unidad de Calificación' : 'Grading Unit'}</p>
                    <h3 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-4">
                       <Award className="text-amber-400" size={32} /> 
                       {activities.find(a => a.id === gradingSubmission.activityId)?.title}
                    </h3>
                 </div>
                 <button onClick={() => setGradingSubmission(null)} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
                    <X size={32}/>
                 </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row bg-white dark:bg-slate-900">
                 
                 {/* LEFT: Submission Content */}
                 <div className="flex-1 overflow-y-auto p-12 custom-scrollbar space-y-12">
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
                       <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-3"><Info size={20}/> {language === 'es' ? 'Briefing de la Misión' : 'Mission Briefing'}</h4>
                       <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 font-bold" dangerouslySetInnerHTML={{ __html: activities.find(a => a.id === gradingSubmission.activityId)?.description }} />
                    </div>

                    <div className="space-y-10">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                          <FileText size={20}/> {language === 'es' ? 'Reporte del Estudiante' : 'Student Report'}
                       </h4>

                       {gradingSubmission.type === 'quiz' ? (
                          <div className="space-y-8">
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 dark:border-slate-700 text-center">
                                   <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Automated Score</p>
                                   <p className="text-3xl font-black text-indigo-600">{gradingSubmission.autoGrade || 0} pts</p>
                                </div>
                                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 dark:border-slate-700 text-center">
                                   <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Completion Time</p>
                                   <p className="text-3xl font-black text-indigo-600">{Math.floor(gradingSubmission.duration / 60)} min</p>
                                </div>
                             </div>
                             
                             <div className="space-y-6">
                                {activities.find(a => a.id === gradingSubmission.activityId)?.questions?.map((q, idx) => {
                                   const ans = gradingSubmission.answers?.[q.id];
                                   const isCorrect = q.type === 'multiple' && ans === q.correct;
                                   return (
                                      <div key={q.id} className={`p-8 rounded-[2rem] border-2 transition-all ${q.type === 'open' ? 'border-amber-200 bg-amber-50/50' : isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
                                         <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest">Question {idx+1}: {q.text}</p>
                                         <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-inner">
                                            <p className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                                               {q.type === 'multiple' ? (q.options[ans] || 'N/A') : (ans || '...')}
                                            </p>
                                         </div>
                                      </div>
                                   )
                                })}
                             </div>
                          </div>
                       ) : (
                          <div className="space-y-10">
                             {gradingSubmission.html_content ? (
                                <div className="prose prose-lg dark:prose-invert max-w-none bg-white dark:bg-slate-900 p-12 rounded-[2.5rem] border-2 dark:border-slate-800 shadow-inner font-bold" dangerouslySetInnerHTML={{ __html: gradingSubmission.html_content }} />
                             ) : gradingSubmission.text && (
                                <div className="bg-white dark:bg-slate-900 p-12 rounded-[2.5rem] border-2 dark:border-slate-800 shadow-inner text-slate-800 dark:text-white font-black text-xl whitespace-pre-wrap leading-relaxed tracking-tighter">
                                   {gradingSubmission.text}
                                </div>
                             )}

                             {gradingSubmission.link && (
                                <a href={gradingSubmission.link} target="_blank" rel="noreferrer" className="flex items-center gap-6 p-8 aura-gradient-primary text-white rounded-[2rem] shadow-2xl shadow-indigo-500/30 group hover:scale-[1.02] transition-all">
                                   <ExternalLink size={32}/>
                                   <span className="font-black text-xl uppercase tracking-[0.2em]">{language === 'es' ? 'Acceder al Deployment' : 'Access Deployment'}</span>
                                   <ArrowRight className="ml-auto group-hover:translate-x-4 transition-transform" size={32}/>
                                </a>
                             )}

                             {gradingSubmission.attachments?.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                   {gradingSubmission.attachments.map((file, idx) => (
                                      <a key={idx} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 dark:border-slate-700 hover:border-indigo-500 transition-all group">
                                         <Paperclip className="text-slate-400 group-hover:text-indigo-500" size={24}/>
                                         <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest truncate">{file.name}</span>
                                         <Download className="ml-auto opacity-0 group-hover:opacity-100 text-indigo-500" size={20}/>
                                      </a>
                                   ))}
                                </div>
                             )}

                             {gradingSubmission.comment && (
                                <div className="p-8 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-800/50 rounded-[2rem] flex items-start gap-6">
                                   <MessageSquare className="text-amber-500 shrink-0" size={28}/>
                                   <p className="text-lg font-black italic text-amber-950 dark:text-amber-200 leading-relaxed">"{gradingSubmission.comment}"</p>
                                </div>
                             )}

                             <div className="pt-10 border-t dark:border-slate-800">
                                <CommentsSection 
                                   parentId={gradingSubmission.id}
                                   parentType="submission"
                                   profile={profile}
                                   comments={comments || []}
                                   showToast={showToast}
                                />
                             </div>
                          </div>
                       )}
                    </div>
                 </div>
  
                 {/* RIGHT: Grading Panel */}
                 <div className="w-full lg:w-[32rem] bg-slate-50/50 dark:bg-slate-900/50 p-10 overflow-y-auto custom-scrollbar border-l dark:border-slate-800 shrink-0 space-y-12">
                    <form onSubmit={isTeacher ? handleGradeSubmission : (e) => e.preventDefault()} className="space-y-10">
                       
                       {activities.find(a => a.id === gradingSubmission.activityId)?.rubric?.criteria ? (
                          <div className="space-y-8">
                             <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
                                <CheckCircle size={20}/> Rubric Metrics
                             </h4>
                             {activities.find(a => a.id === gradingSubmission.activityId).rubric.criteria.map(criterion => {
                                const currentScore = (isTeacher ? gradingSubmission.rubric_scores_draft?.[criterion.id] : gradingSubmission.rubric_scores?.[criterion.id]) || 0;
                                return (
                                   <div key={criterion.id} className="space-y-4">
                                      <div className="flex justify-between items-center">
                                         <p className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{criterion.name}</p>
                                         <span className="text-xl font-black text-indigo-600">{currentScore} <span className="text-[10px] text-slate-300">/ {criterion.points}</span></span>
                                      </div>
                                      <div className={`flex gap-2 p-2 bg-white dark:bg-slate-800 rounded-2xl border-2 dark:border-slate-700 shadow-inner ${!isTeacher ? 'opacity-70 pointer-events-none' : ''}`}>
                                         {[...Array(criterion.points + 1).keys()].map(val => (
                                            <button 
                                               key={val}
                                               type="button"
                                               disabled={!isTeacher}
                                               onClick={() => {
                                                  const scores = gradingSubmission.rubric_scores_draft || {};
                                                  scores[criterion.id] = val;
                                                  setGradingSubmission({...gradingSubmission, rubric_scores_draft: scores});
                                                  const totalGrade = Object.values(scores).reduce((a, b) => a + b, 0);
                                                  setGrade(totalGrade.toString());
                                               }}
                                               className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${currentScore === val ? 'aura-gradient-primary text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                            >
                                               {val}
                                            </button>
                                         ))}
                                      </div>
                                   </div>
                                )
                             })}
                          </div>
                       ) : (
                          isTeacher && (
                             <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{language === 'es' ? 'Auditoría Manual' : 'Manual Audit'}</label>
                                <div className="relative">
                                   <input required type="number" step="0.1" value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-8 py-6 text-5xl font-black rounded-3xl border-2 border-transparent focus:border-indigo-500 dark:bg-slate-800 text-indigo-600 outline-none transition-all shadow-inner text-center" />
                                   <Award className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-200" size={32} />
                                </div>
                             </div>
                          )
                       )}

                       <div className="p-10 aura-gradient-primary rounded-[2.5rem] text-white shadow-3xl shadow-indigo-500/40 text-center relative overflow-hidden group">
                          <div className="absolute right-0 bottom-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mb-24 blur-2xl"></div>
                          <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em] mb-4 relative z-10">{language === 'es' ? 'Audit Score' : 'Audit Score'}</p>
                          <div className="text-8xl font-black relative z-10 tracking-tighter shadow-sm">
                             {isTeacher ? (grade || 0) : (gradingSubmission.grade || 0)}
                          </div>
                          <p className="text-[10px] font-black text-white/40 mt-4 uppercase tracking-[0.3em] relative z-10">
                             Max Scale: {activities.find(a => a.id === gradingSubmission.activityId)?.scale || 10}
                          </p>
                       </div>

                       <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{language === 'es' ? 'Instrucciones Rectificadoras (Feedback)' : 'Feedback Instructions'}</label>
                          {isTeacher ? (
                             <textarea 
                                value={teacherFeedback} 
                                onChange={e => setTeacherFeedback(e.target.value)}
                                className="w-full h-48 px-6 py-5 rounded-3xl bg-white dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-sm font-bold resize-none shadow-inner transition-all"
                                placeholder="..."
                             />
                          ) : (
                             <div className="p-8 bg-indigo-50 dark:bg-indigo-900/20 border-2 dark:border-indigo-800 rounded-[2rem] text-base font-bold italic text-slate-700 dark:text-slate-200 leading-relaxed shadow-sm">
                                {gradingSubmission.teacher_feedback || "Deployment pending review."}
                             </div>
                          )}
                       </div>

                       {isTeacher && (
                          <button type="submit" className="w-full py-6 aura-gradient-primary text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.4em] shadow-3xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4 group">
                             <Save size={24}/> {language === 'es' ? 'Commit Changes' : 'Commit Changes'}
                             <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform"/>
                          </button>
                       )}
                    </form>
                 </div>
              </div>
           </div>
        </div>
      )}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[150] flex items-center justify-center p-4 animate-fade-in shadow-2xl">
           <div className="aura-card w-full max-w-2xl rounded-[3rem] shadow-3xl overflow-hidden border-none relative">
              <div className="p-10 aura-gradient-primary text-white flex justify-between items-center">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">{language === 'es' ? 'Motor de Reglas' : 'Rule Engine'}</p>
                    <h3 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-4">
                       <Settings className="text-amber-400" size={32} /> 
                       {language === 'es' ? 'Configurar' : 'Configure'}
                    </h3>
                 </div>
                 <button onClick={() => setShowConfigModal(false)} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
                    <X size={32}/>
                 </button>
              </div>

              <div className="p-10 space-y-10 bg-white dark:bg-slate-900 overflow-y-auto max-h-[70vh] custom-scrollbar">
                 <div className="space-y-6">
                    <div className="flex justify-between items-center">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{language === 'es' ? 'Ponderación de Algoritmo (%)' : 'Algorithm Weighting (%)'}</label>
                       <div className="px-6 py-2 aura-gradient-primary rounded-xl text-white text-xs font-black shadow-lg">
                          {Object.values(weights).reduce((a,b)=>a+b, 0) + (incAtt ? attWeight : 0)}%
                       </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                       {['tarea', 'actividades', 'evaluaciones', 'examenes', 'proyectos'].map(cat => (
                          <div key={cat} className="flex items-center gap-6 bg-slate-50 dark:bg-slate-800 p-6 rounded-[1.5rem] border-2 dark:border-slate-700 hover:border-indigo-100 transition-all">
                             <label htmlFor={`weight_${cat}`} className="flex-1 text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">{cat === 'tarea' ? (language === 'es' ? 'Misiones' : 'Missions') : cat}</label>
                             <div className="flex items-center gap-4">
                               <input 
                                  id={`weight_${cat}`}
                                  name={`weight_${cat}`}
                                  type="number" 
                                  value={weights[cat] || 0} 
                                  onChange={e => setWeights({...weights, [cat]: Number(e.target.value)})}
                                  className="w-24 px-4 py-3 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-xl text-right font-black text-indigo-600 outline-none transition-all shadow-inner"
                               />
                               <span className="text-[10px] font-black text-slate-300">%</span>
                             </div>
                          </div>
                       ))}
                       
                       <div className={`p-6 rounded-[1.5rem] border-2 transition-all ${incAtt ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-slate-50 opacity-40 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800'}`}>
                          <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-4">
                                <Check size={24} className={incAtt ? 'text-amber-500' : 'text-slate-300'} />
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">{language === 'es' ? 'Asistencia' : 'Attendance'}</span>
                             </div>
                             <button 
                                onClick={() => setIncAtt(!incAtt)}
                                className={`w-14 h-8 rounded-full relative transition-all shadow-inner ${incAtt ? 'bg-amber-500' : 'bg-slate-300'}`}
                             >
                                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${incAtt ? 'left-7' : 'left-1'}`}></div>
                             </button>
                          </div>
                          {incAtt && (
                             <div className="flex items-center justify-between pt-4 border-t border-amber-100 dark:border-amber-800/50 animate-fade-in">
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{language === 'es' ? 'Peso en promedio:' : 'Weight in GPA:'}</span>
                                <div className="flex items-center gap-4">
                                   <input 
                                      type="number" 
                                      value={attWeight} 
                                      onChange={e => setAttWeight(Number(e.target.value))}
                                      className="w-24 px-4 py-3 bg-white dark:bg-slate-900 border-2 border-amber-200 rounded-xl text-right font-black text-amber-600 outline-none transition-all"
                                   />
                                   <span className="text-[10px] font-black text-amber-400">%</span>
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label htmlFor="globalScale" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{language === 'es' ? 'Escala de Nota Máxima' : 'Maximum Grade Scale'}</label>
                    <div className="relative">
                       <input 
                          id="globalScale"
                          name="globalScale"
                          type="number" 
                          value={globalScale} 
                          onChange={e => setGlobalScale(e.target.value)}
                          className="w-full px-8 py-6 bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-[1.5rem] font-black text-3xl text-indigo-600 outline-none transition-all shadow-inner"
                       />
                       <Award className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-200" size={32} />
                    </div>
                 </div>

                 <button 
                    onClick={() => handleSaveConfig(weights, globalScale, attWeight, incAtt)}
                    disabled={isSavingConfig}
                    className="w-full py-8 aura-gradient-primary text-white rounded-[1.8rem] font-black text-xs uppercase tracking-[0.4em] shadow-3xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-6 disabled:opacity-50"
                 >
                    {isSavingConfig ? <Clock className="animate-spin" size={24} /> : <Save size={24} />} 
                    {language === 'es' ? 'Confirmar Sistema' : 'Confirm System'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
