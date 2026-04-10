import React, { useState, useMemo } from 'react';
import { Award, Search, User, FileText, CheckCircle, X, ExternalLink, Calendar, Mail, AlertCircle, Clock, Check, Filter, AlertTriangle, Save, ArrowRight, Info, ShieldCheck, Paperclip, MessageSquare, Download, Settings } from 'lucide-react';
import { supabase } from '../config/supabase';
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
      const { error } = await supabase
        .from('grading_configs')
        .upsert({
          teacher_id: profile.id,
          weights: newWeights,
          grade_scale: Number(newScale),
          attendance_weight: Number(attWeight),
          include_attendance: incAtt
        });
      if (error) throw error;
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
      const { error } = await supabase
        .from('submissions')
        .update({
          grade: Number(grade),
          rubric_scores: gradingSubmission.rubric_scores_draft || {},
          teacher_feedback: teacherFeedback,
          status: 'calificado',
          graded_at: Date.now(),
          graded_by: profile.id
        })
        .eq('id', gradingSubmission.id);
      
      if (error) throw error;
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
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="glass-card p-6 md:p-8 rounded-3xl pb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3 text-gray-900 dark:text-white tracking-tight">
            <Award className="text-amber-500" size={32} /> 
            {isTeacher ? (language === 'es' ? 'Centro de Calificaciones' : 'Grade Center') : (language === 'es' ? 'Mis Calificaciones' : 'My Grades')}
          </h1>
          <p className="text-gray-500 font-medium text-sm md:text-base mt-2">{language === 'es' ? 'Gestiona y revisa el rendimiento académico en tiempo real.' : 'Manage and review academic performance in real time.'}</p>
        </div>
        
        {isTeacher && (
          <div className="flex gap-4 w-full md:w-auto">
             <div className="flex-1 md:flex-none glass-card bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 px-6 py-4 rounded-2xl text-center hover-spring shadow-sm">
                <p className="text-xs font-black text-amber-600 uppercase tracking-widest">{language === 'es' ? 'Pendientes' : 'Pending'}</p>
                <p className="text-3xl font-black text-amber-700 dark:text-amber-400 mt-1">{totalPending}</p>
             </div>
             <div className="flex-1 md:flex-none glass-card bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 px-6 py-4 rounded-2xl text-center hover-spring shadow-sm">
                <p className="text-xs font-black text-green-600 uppercase tracking-widest">{language === 'es' ? 'Calificados' : 'Graded'}</p>
                <p className="text-3xl font-black text-green-700 dark:text-green-400 mt-1">{totalGraded}</p>
             </div>
          </div>
        )}
      </div>

      {isTeacher ? (
        <div className="glass-card rounded-3xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700/50">
          <div className="p-6 md:p-8 border-b dark:border-slate-700/50 flex flex-col lg:flex-row gap-6 justify-between items-center bg-gray-50/30 dark:bg-slate-900/20">
             <div className="relative w-full lg:w-96 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input id="studentSearch" name="studentSearch" type="text" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} placeholder={language === 'es' ? "Buscar por nombre o correo..." : "Search by name or email..."} className="w-full pl-14 pr-6 py-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm focus:shadow-md font-medium placeholder-gray-400" />
             </div>
             
             <div className="flex items-center gap-2 w-full lg:w-auto">
                 <button 
                   onClick={() => setShowConfigModal(true)}
                   className="flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm"
                 >
                    <Settings size={20} className="text-gray-400" />
                    {language === 'es' ? 'Ponderaciones' : 'Weights'}
                 </button>
                 <button 
                   onClick={() => setFilterPending(!filterPending)}
                   className={`flex-1 lg:flex-none flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all shadow-sm focus-visible:ring-inset hover-spring ${filterPending ? 'bg-amber-500 text-white shadow-amber-500/20' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:text-indigo-600 border border-gray-200 dark:border-slate-700'}`}
                 >
                    <Filter size={20} className={filterPending ? 'text-amber-100' : 'text-gray-400'} />
                    {filterPending ? (language === 'es' ? 'Viendo: Pendientes' : 'Viewing: Pending') : (language === 'es' ? 'Todos los Alumnos' : 'All Students')}
                 </button>
              </div>
          </div>
          
          <div className="overflow-x-auto custom-scrollbar">
             <table className="w-full text-left">
               <thead>
                 <tr className="text-xs font-black text-gray-500 uppercase tracking-widest bg-gray-50/50 dark:bg-slate-900/20 border-b dark:border-slate-700/50">
                   <th className="px-8 py-6">{language === 'es' ? 'Estudiante' : 'Student'}</th>
                   <th className="px-8 py-6">{language === 'es' ? 'Estado' : 'Status'}</th>
                   <th className="px-8 py-6">{language === 'es' ? 'Progreso' : 'Progress'}</th>
                   <th className="px-8 py-6 text-right">{language === 'es' ? 'Acción' : 'Action'}</th>
                 </tr>
               </thead>
               <tbody className="divide-y dark:divide-slate-700/50">
                 {filteredStudents.length === 0 ? (
                   <tr>
                     <td colSpan="4" className="px-8 py-32 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-50">
                           <Search size={64} className="text-gray-300" />
                           <p className="text-lg font-bold text-gray-500">{language === 'es' ? 'No se encontraron estudiantes.' : 'No students found.'}</p>
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
                       <tr key={student.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/20 transition-all group">
                         <td className="px-8 py-6">
                           <div className="flex items-center gap-5">
                              <div className="relative">
                                 <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-xl shadow-md uppercase">
                                   {student.name.charAt(0)}
                                 </div>
                                 {pendingCount > 0 && <span className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 border-4 border-white dark:border-slate-800 rounded-full flex items-center justify-center text-xs font-black text-white shadow-sm ring-2 ring-amber-500/20 animate-pulse">{pendingCount}</span>}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-base dark:text-white group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{student.name}</p>
                                <p className="text-sm text-gray-500 font-medium">{student.email}</p>
                              </div>
                           </div>
                         </td>
                         <td className="px-8 py-6">
                            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                {weightedAvg.toFixed(2)}
                                <span className="text-xs text-gray-400 ml-1 font-bold">/ {myConfig.grade_scale}</span>
                             </span>
                         </td>
                         <td className="px-8 py-6">
                            <div className="flex flex-wrap gap-2">
                               <span className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-900 text-xs font-bold text-gray-600 dark:text-gray-400 flex items-center gap-1.5 shadow-sm border border-gray-200 dark:border-slate-700">
                                  <FileText size={14}/> {studentSubs.length} {language === 'es' ? 'Entregas' : 'Submissions'}
                               </span>
                               {pendingCount > 0 && (
                                 <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-700 text-xs font-bold flex items-center gap-1.5 shadow-sm border border-amber-200">
                                    <AlertTriangle size={14}/> {pendingCount} {language === 'es' ? 'Pendiente' : 'Pending'}
                                 </span>
                               )}
                            </div>
                         </td>
                         <td className="px-8 py-6">
                            <div className="max-w-[150px]">
                               <div className="flex justify-between items-center mb-2 text-xs font-black text-gray-500 uppercase tracking-wider">
                                  <span>{language === 'es' ? 'Completado' : 'Completed'}</span>
                                  <span className={progress === 100 ? 'text-green-600' : 'text-indigo-600'}>{progress}%</span>
                               </div>
                               <div className="h-2 w-full bg-gray-100 dark:bg-slate-900 rounded-full overflow-hidden shadow-inner">
                                  <div className={`h-full transition-all duration-1000 ${progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }}></div>
                               </div>
                            </div>
                         </td>
                         <td className="px-8 py-6 text-right">
                           <button 
                             onClick={() => setSelectedStudent(student)} 
                             className="px-6 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 rounded-xl text-sm font-bold hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition shadow-sm hover-spring focus-visible:ring-inset"
                           >{language === 'es' ? 'Perfil' : 'Profile'}</button>
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
        <div className="space-y-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-8 sm:p-10 rounded-3xl relative overflow-hidden group hover-spring">
                 <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700 ease-out"></div>
                 <p className="text-sm font-black text-gray-500 uppercase mb-4 tracking-widest">{language === 'es' ? 'Promedio General' : 'GPA'}</p>
                 <div className="flex items-end gap-3">
                    <p className="text-6xl font-black text-indigo-600 tracking-tighter">
                      {studentSubmissions.filter(s => s.status === 'calificado').length > 0 
                       ? (studentSubmissions.filter(s => s.status === 'calificado').reduce((acc, s) => acc + (s.grade || 0), 0) / studentSubmissions.filter(s => s.status === 'calificado').length).toFixed(1)
                       : '0.0'}
                    </p>
                    <span className="text-gray-400 font-bold mb-2 text-xl">/ 10.0</span>
                 </div>
              </div>
              <div className="glass-card p-8 sm:p-10 rounded-3xl relative overflow-hidden group hover-spring">
                 <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/10 rounded-full -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-700 ease-out"></div>
                 <p className="text-sm font-black text-gray-500 uppercase mb-4 tracking-widest">{language === 'es' ? 'Actividades Entregadas' : 'Submitted Tasks'}</p>
                 <p className="text-6xl font-black text-purple-600 tracking-tighter">{studentSubmissions.length}</p>
              </div>
           </div>

           <div className="glass-card rounded-3xl overflow-hidden border border-gray-100 dark:border-slate-700/50 shadow-sm">
              <div className="overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left">
                   <thead className="text-xs font-black text-gray-500 uppercase tracking-widest bg-gray-50/50 dark:bg-slate-900/30 border-b dark:border-slate-700/50">
                     <tr>
                       <th className="px-8 py-6">{language === 'es' ? 'Evaluación' : 'Assessment'}</th>
                       <th className="px-8 py-6">{language === 'es' ? 'Estado' : 'Status'}</th>
                       <th className="px-8 py-6 text-right">{language === 'es' ? 'Resultado' : 'Result'}</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y dark:divide-slate-700/50">
                     {activities.map(act => {
                       const sub = getSubmissionForActivity(act.id, profile.id);
                       return (
                          <tr key={act.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/10 transition-colors">
                             <td className="px-8 py-6">
                                <p className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1">{act.title}</p>
                                <p className="text-xs text-gray-500 font-black uppercase tracking-widest">{act.type}</p>
                             </td>
                             <td className="px-8 py-6">
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm border ${
                                  sub?.status === 'calificado' ? 'bg-green-50 text-green-700 border-green-200' :
                                  sub?.status === 'entregado' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:border-slate-700'
                                }`}>
                                   <div className={`w-2 h-2 rounded-full ${sub?.status === 'calificado' ? 'bg-green-500' : sub?.status === 'entregado' ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`}></div>
                                   {sub?.status || (language === 'es' ? 'Pendiente' : 'Pending')}
                                </div>
                             </td>
                             <td className="px-8 py-6 text-right">
                                {sub?.grade !== undefined ? (
                                  <div className="flex items-end justify-end gap-1">
                                    <span className="text-2xl font-black text-indigo-600">{sub.grade}</span> 
                                    <span className="text-sm font-bold text-gray-400 mb-1">/ {act.points}</span>
                                  </div>
                                ) : <span className="text-gray-300 font-black text-2xl">--</span>}
                             </td>
                          </tr>
                       )
                     })}
                     {activities.length === 0 && (
                        <tr>
                           <td colSpan="3" className="px-8 py-20 text-center text-gray-500 font-medium">
                              {language === 'es' ? 'No hay evaluaciones disponibles.' : 'No assessments available.'}
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
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-[3rem] shadow-2xl animate-scale-in flex flex-col border border-white/20 relative">
             
             {/* Floating Close Button */}
             <button 
                onClick={() => setSelectedStudent(null)} 
                className="absolute top-6 right-6 md:top-10 md:right-10 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-xl z-50 text-gray-500 hover:text-red-500 hover:scale-110 transition-all border border-gray-100 dark:border-slate-700"
             >
                <X size={28}/>
             </button>

             <div className="p-8 md:p-12 border-b dark:border-slate-800/50 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 dark:bg-slate-900/40 shrink-0 gap-8">
               <div className="flex flex-col md:flex-row items-center gap-8 w-full md:w-auto">
                  <div className="w-28 h-28 md:w-32 md:h-32 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center font-black text-5xl uppercase shadow-2xl shadow-indigo-500/40 transform -rotate-3 hover:rotate-0 transition-all shrink-0 border-4 border-white dark:border-slate-800">
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <div className="text-center md:text-left">
                    <h3 className="text-4xl md:text-5xl font-black tracking-tighter text-gray-900 dark:text-white leading-tight mb-2 uppercase">{selectedStudent.name}</h3>
                    <div className="flex flex-wrap justify-center md:justify-start gap-3">
                       <span className="text-sm text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 shadow-sm"><Mail size={16}/> {selectedStudent.email}</span>
                       <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 opacity-60 flex items-center gap-2">
                          <ShieldCheck size={14} /> Estudiante
                       </span>
                    </div>
                  </div>
               </div>
             </div>

             <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12 custom-scrollbar modal-scroll-area">
                <style>{`
                  .modal-scroll-area::-webkit-scrollbar { width: 6px; }
                  .modal-scroll-area::-webkit-scrollbar-track { background: transparent; }
                  .modal-scroll-area::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
                  .modal-scroll-area::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
                  .dark .modal-scroll-area::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); }
                `}</style>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                   <div className="p-8 bg-gray-50 dark:bg-slate-900/50 rounded-3xl border border-gray-100 dark:border-slate-700/50 group hover-spring">
                      <p className="text-xs font-black text-gray-500 uppercase mb-3 tracking-widest">{language === 'es' ? 'Entregas' : 'Submissions'}</p>
                      <p className="text-5xl font-black text-gray-900 dark:text-white">{submissions.filter(s => s.studentId === selectedStudent.id).length}</p>
                   </div>
                   <div className="p-8 bg-amber-50/50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30 hover-spring">
                      <p className="text-xs font-black text-amber-600 uppercase mb-3 tracking-widest">{language === 'es' ? 'Pendientes' : 'Pending'}</p>
                      <p className="text-5xl font-black text-amber-600">{submissions.filter(s => s.studentId === selectedStudent.id && s.status === 'entregado').length}</p>
                   </div>
                   <div className="p-8 bg-green-50/50 dark:bg-green-900/10 rounded-3xl border border-green-100 dark:border-green-900/30 hover-spring">
                      <p className="text-xs font-black text-green-600 uppercase mb-3 tracking-widest">{language === 'es' ? 'Asistencias' : 'Attendance'}</p>
                      <p className="text-5xl font-black text-green-600">{attendance.filter(a => a.studentId === selectedStudent.id && a.isPresent).length}</p>
                   </div>
                   <div className="p-8 bg-indigo-600 dark:bg-indigo-500 text-white rounded-3xl shadow-xl shadow-indigo-500/20 hover-spring transform hover:-translate-y-1 transition-all">
                      <p className="text-xs font-black text-indigo-200 uppercase mb-3 tracking-widest">{language === 'es' ? 'Estado' : 'Status'}</p>
                      <p className="text-4xl font-black">{language === 'es' ? 'ACTIVO' : 'ACTIVE'}</p>
                   </div>
                </div>

                <div className="glass-card rounded-[2.5rem] border border-gray-100 dark:border-slate-700/50 overflow-hidden shadow-sm">
                   <div className="p-8 md:p-10 border-b dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30 font-black text-sm uppercase tracking-widest flex items-center gap-4 text-gray-700 dark:text-gray-300">
                      <FileText size={24} className="text-indigo-500" /> {language === 'es' ? 'Historial de Evaluaciones' : 'Assessment History'}
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                           <tr className="text-xs font-black text-gray-500 uppercase tracking-widest border-b dark:border-slate-700/50">
                              <th className="px-10 py-6">{language === 'es' ? 'Actividad' : 'Activity'}</th>
                              <th className="px-10 py-6">{language === 'es' ? 'Resultado' : 'Result'}</th>
                              <th className="px-10 py-6 text-right">{language === 'es' ? 'Revisión' : 'Review'}</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700/50">
                           {activities.map(act => {
                              const sub = getSubmissionForActivity(act.id, selectedStudent.id);
                              return (
                                 <tr key={act.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/20 transition-colors">
                                    <td className="px-10 py-8">
                                       <div className="flex items-center gap-4">
                                          <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border ${act.type==='tarea' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{act.type}</span>
                                          <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{act.title}</span>
                                       </div>
                                    </td>
                                    <td className="px-10 py-8">
                                       {sub ? (
                                          <div className="flex items-center gap-3">
                                             <div className={`w-3 h-3 rounded-full shadow-sm ${sub.status==='calificado' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                             <span className="font-black text-2xl text-gray-800 dark:text-gray-200">{sub.grade !== undefined ? `${sub.grade}` : `--`} <span className="text-sm text-gray-400 font-bold ml-1">/ {act.points}</span></span>
                                          </div>
                                       ) : <span className="text-xs text-gray-400 font-bold uppercase bg-gray-100 dark:bg-slate-800 px-4 py-2 rounded-xl">{language === 'es' ? 'No Enviado' : 'Not Submitted'}</span>}
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                       {sub ? (
                                          <button 
                                            onClick={async () => { 
                                              // Hidratación bajo demanda si falta el contenido pesado
                                              let targetSub = sub;
                                              if (sub.id && !sub.html_content && !sub.htmlContent && !sub.attachments) {
                                                const fullSub = await fetchFullRecord('submissions', sub.id);
                                                if (fullSub) targetSub = fullSub;
                                              }
                                              
                                              setGradingSubmission(targetSub); 
                                              setGrade(targetSub.grade !== undefined ? targetSub.grade.toString() : ''); 
                                              setEditedHtml(targetSub.html_content || targetSub.htmlContent || '');
                                            }}
                                            className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md hover-spring focus-visible:ring-inset ${sub.status === 'entregado' ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20' : 'bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-slate-700 text-gray-700 dark:text-gray-300 hover:text-indigo-600'}`}
                                          >
                                             {sub.status === 'entregado' ? (language === 'es' ? 'Calificar' : 'Grade') : (language === 'es' ? 'Modificar' : 'Modify')}
                                          </button>
                                       ) : <span className="text-gray-300 font-black">--</span>}
                                    </td>
                                 </tr>
                              )
                           })}
                        </tbody>
                      </table>
                   </div>
                </div>

                <div className="glass-card rounded-[2.5rem] border border-gray-100 dark:border-slate-700/50 overflow-hidden shadow-sm mt-12 mb-10">
                   <div className="p-8 md:p-10 border-b dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-900/30 font-black text-sm uppercase tracking-widest flex items-center gap-4 text-gray-700 dark:text-gray-300">
                      <Calendar size={24} className="text-green-500" /> {language === 'es' ? 'Registro de Asistencia' : 'Attendance Log'}
                   </div>
                   <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md z-10 border-b dark:border-slate-700">
                           <tr className="text-xs font-black text-gray-500 uppercase tracking-widest">
                              <th className="px-10 py-6">{language === 'es' ? 'Clase' : 'Class'}</th>
                              <th className="px-10 py-6 text-right">{language === 'es' ? 'Estatus' : 'Status'}</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-slate-700/50">
                           {events.filter(e => {
                                 const isAssigned = e.assignedTo?.includes('all') || e.assignedTo?.includes(selectedStudent.id);
                                 const isPast = e.status === 'finalizada' || new Date(e.date || e.startDate) < new Date();
                                 return isAssigned && isPast;
                           }).sort((a,b)=>new Date(b.date || b.startDate)-new Date(a.date || a.startDate)).map(ev => {
                              const att = attendance.find(a => a.eventId === ev.id && a.studentId === selectedStudent.id);
                              const eventDate = ev.date || ev.startDate || Date.now();
                              return (
                                 <tr key={ev.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/20 transition-colors">
                                    <td className="px-10 py-8">
                                       <div className="flex flex-col gap-1">
                                          <span className="font-bold text-lg text-gray-900 dark:text-gray-100 uppercase">{ev.title}</span>
                                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{new Date(eventDate).toLocaleDateString((language === 'es' ? 'es-ES' : 'en-US'), { dateStyle: 'full' })}</span>
                                       </div>
                                    </td>
                                    <td className="px-10 py-8 text-right">
                                       {att?.isPresent === true ? (
                                          <span className="inline-flex px-5 py-2.5 bg-green-50 text-green-700 border-2 border-green-100 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm">{language === 'es' ? 'Asistió' : 'Present'}</span>
                                       ) : att?.isPresent === false ? (
                                          <span className="inline-flex px-5 py-2.5 bg-red-50 text-red-700 border-2 border-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm">{language === 'es' ? 'Falta' : 'Absent'}</span>
                                       ) : (
                                          <span className="inline-flex px-5 py-2.5 bg-gray-100 dark:bg-slate-800 text-gray-500 border-2 border-gray-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm">{language === 'es' ? 'Sin firmar' : 'Unsigned'}</span>
                                       )}
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

      {/* UNIVERSAL REVIEW MODAL (TEACHER & STUDENT) */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-fade-in shadow-2xl">
           <div className="bg-white dark:bg-slate-900 w-full max-w-6xl h-[95vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col border border-gray-100 dark:border-slate-800">
              
              {/* Header */}
              <div className="p-8 border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
                 <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 lowercase">
                       <Award className="text-amber-500" size={24} /> 
                       {isTeacher ? (language === 'es' ? 'Módulo de Calificación' : 'Grading Module') : (language === 'es' ? 'Detalle de Calificación' : 'Grade Details')}
                    </h3>
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">
                       {activities.find(a => a.id === gradingSubmission.activityId)?.title}
                    </p>
                 </div>
                 <button onClick={() => setGradingSubmission(null)} className="p-3 bg-white dark:bg-slate-800 shadow-sm border dark:border-slate-700 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all focus-visible:ring-inset">
                    <X size={24}/>
                 </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                 
                 {/* LEFT: Submission Context & Content */}
                 <div className="flex-1 overflow-y-auto p-8 border-r dark:border-slate-800 custom-scrollbar space-y-10">
                    
                    {/* Activity Context */}
                    <div className="bg-indigo-50/50 dark:bg-indigo-500/5 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-500/20">
                       <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2"><Info size={14}/> {language === 'es' ? 'Consigna' : 'Instruction'}</h4>
                       <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: activities.find(a => a.id === gradingSubmission.activityId)?.description }} />
                    </div>

                    {/* Submission Payload */}
                    <div className="space-y-8">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                          <FileText size={14}/> {language === 'es' ? 'Entrega del Estudiante' : 'Student Submission'}
                       </h4>

                       {/* CASE 1: QUIZ / EXAM */}
                       {gradingSubmission.type === 'quiz' ? (
                          <div className="space-y-6">
                             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
                                   <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{language === 'es' ? 'Auto-Nota' : 'Auto-Grade'}</p>
                                   <p className="text-lg font-black text-gray-900 dark:text-white">{gradingSubmission.autoGrade || 0} pts</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
                                   <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{language === 'es' ? 'Duración' : 'Duration'}</p>
                                   <p className="text-lg font-black text-gray-900 dark:text-white">{Math.floor(gradingSubmission.duration / 60)} min</p>
                                </div>
                             </div>
                             
                             {/* Question Breakdown */}
                             <div className="space-y-4">
                                {activities.find(a => a.id === gradingSubmission.activityId)?.questions?.map((q, idx) => {
                                   const ans = gradingSubmission.answers?.[q.id];
                                   const isCorrect = q.type === 'multiple' && ans === q.correct;
                                   return (
                                      <div key={q.id} className={`p-6 rounded-2xl border-2 ${q.type === 'open' ? 'border-amber-100 bg-amber-50/20' : isCorrect ? 'border-green-100 bg-green-50/20' : 'border-red-100 bg-red-50/20'}`}>
                                         <p className="text-xs font-bold text-gray-400 mb-2">Q{idx+1}: {q.text}</p>
                                         <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            <span className="font-black uppercase text-[10px] mr-2">{language === 'es' ? 'Respuesta:' : 'Answer:'}</span>
                                            {q.type === 'multiple' ? (q.options[ans] || 'N/A') : (ans || '...')}
                                         </p>
                                      </div>
                                   )
                                })}
                             </div>
                          </div>
                       ) : (
                          /* CASE 2: FILE / LINK / EDITOR */
                          <div className="space-y-6">
                             {gradingSubmission.html_content ? (
                                <div className="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 shadow-sm" dangerouslySetInnerHTML={{ __html: gradingSubmission.html_content }} />
                             ) : gradingSubmission.text && (
                                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border dark:border-slate-700 shadow-sm text-gray-700 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed">
                                   {gradingSubmission.text}
                                </div>
                             )}

                             {gradingSubmission.link && (
                                <a href={gradingSubmission.link} target="_blank" rel="noreferrer" className="flex items-center gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800 group hover:bg-indigo-600 hover:text-white transition-all">
                                   <ExternalLink size={20}/>
                                   <span className="font-black text-sm uppercase tracking-widest">{language === 'es' ? 'Ver Trabajo en Línea' : 'View Online Work'}</span>
                                   <ArrowRight className="ml-auto opacity-0 group-hover:opacity-100 transition-all" size={20}/>
                                </a>
                             )}

                             {gradingSubmission.attachments?.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                   {gradingSubmission.attachments.map((file, idx) => {
                                       return (
                                          <a key={idx} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 group hover:border-indigo-400 transition-all">
                                             <Paperclip className="text-gray-400 group-hover:text-indigo-500" size={18}/>
                                             <span className="text-xs font-bold text-gray-600 dark:text-gray-300 truncate">{file.name}</span>
                                             <Download className="ml-auto opacity-0 group-hover:opacity-100 transition-all text-indigo-500" size={16}/>
                                          </a>
                                       );
                                    })}
                                </div>
                             )}

                             {/* Student Comment */}
                             {gradingSubmission.comment && (
                                <div className="p-6 bg-amber-50/50 dark:bg-amber-900/10 border-2 border-amber-100 dark:border-amber-900/30 rounded-3xl italic text-sm text-amber-900/80 dark:text-amber-200/80 flex items-start gap-4">
                                   <MessageSquare className="text-amber-500 shrink-0" size={20}/>
                                   <span>"{gradingSubmission.comment}"</span>
                                </div>
                             )}

                             {/* Comment Threads Section */}
                             <CommentsSection 
                                parentId={gradingSubmission.id}
                                parentType="submission"
                                profile={profile}
                                comments={comments || []}
                                showToast={showToast}
                             />
                          </div>
                       )}
                    </div>
                 </div>
 
                 <div className="w-full lg:w-96 bg-gray-50/30 dark:bg-slate-900/50 p-8 overflow-y-auto custom-scrollbar shrink-0">
                    <form onSubmit={isTeacher ? handleGradeSubmission : (e) => e.preventDefault()} className="space-y-8">
                       
                       {activities.find(a => a.id === gradingSubmission.activityId)?.rubric?.criteria ? (
                          <div className="space-y-6">
                             <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <CheckCircle size={14}/> {language === 'es' ? 'Evaluación por Rúbrica' : 'Rubric Breakdown'}
                             </h4>
                             {activities.find(a => a.id === gradingSubmission.activityId).rubric.criteria.map(criterion => {
                                const currentScore = (isTeacher ? gradingSubmission.rubric_scores_draft?.[criterion.id] : gradingSubmission.rubric_scores?.[criterion.id]) || 0;
                                return (
                                   <div key={criterion.id} className="space-y-3">
                                      <p className="text-xs font-black text-gray-600 dark:text-gray-400 uppercase tracking-tight">{criterion.name}</p>
                                      <div className={`flex bg-white dark:bg-slate-800 p-1 rounded-xl border dark:border-slate-700 ${!isTeacher ? 'opacity-70 pointer-events-none' : ''}`}>
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
                                               className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${currentScore === val ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-indigo-500'}`}
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
                          /* Manual Grade Input (Only Teacher) */
                          isTeacher && (
                             <div className="space-y-4">
                                <label htmlFor="numericGrade" className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Calificación Manual' : 'Manual Score'}</label>
                                <div className="relative">
                                   <input id="numericGrade" name="numericGrade" required type="number" step="0.1" value={grade} onChange={e => setGrade(e.target.value)} className="w-full px-6 py-4 text-3xl font-black rounded-2xl border-2 border-gray-100 dark:border-slate-700 dark:bg-slate-800 text-indigo-600 outline-none focus:border-indigo-500 transition-all shadow-inner" />
                                   <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-xs text-gray-400">PTS</span>
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest">
                                   {language === 'es' ? 'Escala Máxima:' : 'Max Scale:'} {activities.find(a => a.id === gradingSubmission.activityId)?.scale || 10}
                                </p>
                             </div>
                          )
                       )}

                       {/* Score Summary Card */}
                       <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-500/20 text-center relative overflow-hidden group">
                          <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-[0.2em] mb-1 relative z-10">{language === 'es' ? 'Nota Final' : 'Final Grade'}</p>
                          <div className="text-5xl font-black relative z-10">
                             {isTeacher ? (grade || 0) : (gradingSubmission.grade || 0)}
                          </div>
                          <p className="text-[10px] font-black text-indigo-100/50 mt-2 uppercase tracking-widest relative z-10">
                             {language === 'es' ? 'Escala' : 'Scale'} {activities.find(a => a.id === gradingSubmission.activityId)?.scale || 10}
                          </p>
                          <Award className="absolute -right-4 -bottom-4 text-white/10 group-hover:scale-110 transition-transform" size={100} />
                       </div>

                       {/* Teacher Feedback Section */}
                       <div className="space-y-4">
                          <label htmlFor="teacherFeedback" className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{language === 'es' ? 'Retroalimentación' : 'Feedback'}</label>
                          {isTeacher ? (
                             <textarea 
                                id="teacherFeedback"
                                name="teacherFeedback"
                                value={teacherFeedback} 
                                onChange={e => setTeacherFeedback(e.target.value)}
                                rows={5}
                                placeholder={language === 'es' ? "Escribe tus observaciones..." : "Write observations..."}
                                className="w-full px-5 py-4 rounded-2xl border-2 border-gray-100 dark:border-slate-700 dark:bg-slate-800 outline-none focus:border-indigo-500 text-sm font-medium resize-none shadow-sm transition-all"
                             />
                          ) : (
                             <div className="p-5 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-100 dark:border-amber-900/30 rounded-2xl text-sm font-medium italic text-gray-700 dark:text-gray-200 min-h-[100px] leading-relaxed">
                                {gradingSubmission.teacher_feedback || (language === 'es' ? 'Sin comentarios del profesor.' : 'No teacher feedback yet.')}
                             </div>
                          )}
                       </div>

                       {/* Action Button (Teacher only) */}
                       {isTeacher && (
                          <button type="submit" className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                             <Save size={20}/> {language === 'es' ? 'Guardar Cambios' : 'Save Changes'}
                          </button>
                       )}
                    </form>
                 </div>
              </div>
           </div>
        </div>
      )}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
           <div className="glass-card w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-scale-in overflow-hidden border border-white/20">
              <div className="p-8 border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                 <h3 className="text-xl font-black text-gray-900 dark:white uppercase tracking-tight flex items-center gap-3">
                    <Settings size={20} className="text-indigo-500"/> {language === 'es' ? 'Configurar Sistema' : 'System Config'}
                 </h3>
                 <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-red-500 transition-colors"><X size={24}/></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'es' ? 'Pesos por Categoría (%)' : 'Category Weights (%)'}</label>
                       <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800">
                          <span className="text-[10px] font-bold text-indigo-600">{Object.values(weights).reduce((a,b)=>a+b, 0) + (incAtt ? attWeight : 0)}%</span>
                       </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                       {['tarea', 'actividades', 'evaluaciones', 'examenes', 'proyectos'].map(cat => (
                          <div key={cat} className="flex items-center gap-4 bg-gray-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
                             <label htmlFor={`weight_${cat}`} className="flex-1 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{cat === 'tarea' ? (language === 'es' ? 'Tareas' : 'Tasks') : cat}</label>
                             <input 
                                id={`weight_${cat}`}
                                name={`weight_${cat}`}
                                type="number" 
                                value={weights[cat] || 0} 
                                onChange={e => setWeights({...weights, [cat]: Number(e.target.value)})}
                                className="w-20 px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl text-right font-black text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                             />
                             <span className="text-[10px] font-bold text-gray-400">%</span>
                          </div>
                       ))}
                       
                       {/* New Attendance Weight Control */}
                       <div className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all ${incAtt ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-gray-50/50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800 opacity-60'}`}>
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <Check size={18} className={incAtt ? 'text-amber-500' : 'text-gray-400'} />
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{language === 'es' ? 'Asistencia' : 'Attendance'}</span>
                             </div>
                             <button 
                                onClick={() => setIncAtt(!incAtt)}
                                className={`w-10 h-6 rounded-full relative transition-all ${incAtt ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-700'}`}
                             >
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${incAtt ? 'left-5' : 'left-1'}`}></div>
                             </button>
                          </div>
                          {incAtt && (
                             <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-100 dark:border-amber-800/50">
                                <span className="text-[10px] font-bold text-amber-600 uppercase">{language === 'es' ? 'Peso en promedio:' : 'Weight in GPA:'}</span>
                                <div className="flex items-center gap-2">
                                   <input 
                                      type="number" 
                                      value={attWeight} 
                                      onChange={e => setAttWeight(Number(e.target.value))}
                                      className="w-16 px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-200 rounded-lg text-right font-black text-amber-600 outline-none"
                                   />
                                   <span className="text-[10px] font-bold text-amber-400">%</span>
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <label htmlFor="globalScale" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{language === 'es' ? 'Escala de Nota Máxima' : 'Maximum Grade Scale'}</label>
                    <div className="relative">
                       <input 
                          id="globalScale"
                          name="globalScale"
                          type="number" 
                          value={globalScale} 
                          onChange={e => setGlobalScale(e.target.value)}
                          className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-800 border rounded-2xl font-black text-2xl text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                       />
                       <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">PTS</span>
                    </div>
                 </div>

                 <button 
                    onClick={() => handleSaveConfig(weights, globalScale, attWeight, incAtt)}
                    disabled={isSavingConfig}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                 >
                    {isSavingConfig ? <Clock className="animate-spin" /> : <Save />} {language === 'es' ? 'Guardar Configuración' : 'Save Configuration'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
