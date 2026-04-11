import React, { useState, useMemo } from 'react';
import { Plus, X, Calendar, User, FileText, CheckCircle, Clock, Trash2, Edit2, Send, Link as LinkIcon, ClipboardList, Info, Shield, Settings, AlertTriangle, Copy, Award, Users, UserCheck, Search, Paperclip, MessageSquare, Eye, ArrowRight } from 'lucide-react';
import api from '../config/api';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useSettings } from '../hooks/SettingsContext';
import { useContentRead } from '../hooks/useContentRead';
import CommentsSection from '../components/CommentsSection';
import DocumentEditor from '../components/DocumentEditor';
import FileUploader from '../components/FileUploader';

export default function ActivitiesView({ type, profile, activities, submissions, users, showToast, createNotification, playSound, comments, fetchFullRecord, addOptimistic, updateOptimistic, replaceOptimistic }) {
  const { language } = useSettings();
  const isTeacher = profile.role === 'profesor';
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [activityType, setActivityType] = useState('tareas'); // 'tareas', 'actividades', 'evaluaciones', 'examenes', 'proyectos'
  const [evalMethod, setEvalMethod] = useState('archivo'); 
  const [points, setPoints] = useState(10);
  const [scale] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assignment State
  const [assignedToType, setAssignedToType] = useState('all'); // 'all' | 'manual'
  const [assignedToUsers, setAssignedToUsers] = useState([]); // array of user IDs
  const [studentSearch, setStudentSearch] = useState('');

  // Advanced Quiz State
  const [questions, setQuestions] = useState([]);
  const [timeLimit, setTimeLimit] = useState(0);
  const [quizPassword, setQuizPassword] = useState('');
  const [manualAccess, setManualAccess] = useState('auto'); // 'auto', 'open', 'closed'

  // Student Submission State
  const [submissionText, setSubmissionText] = useState('');
  const [submissionHtml, setSubmissionHtml] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [submissionAttachments, setSubmissionAttachments] = useState([]);
  const [submissionComment, setSubmissionComment] = useState('');
  const [rubricCriteria, setRubricCriteria] = useState([]); // {id, name, points}
  const [isFileUploading, setIsFileUploading] = useState(false);
  const [showQuizGate, setShowQuizGate] = useState(null);
  const [gatePassword, setGatePassword] = useState('');

  // Students list (only estudiantes)
  const studentUsers = useMemo(() => (users || []).filter(u => u.role === 'estudiante'), [users]);

  // Filter activities by assignedTo for students
  const visibleActivities = useMemo(() => {
    if (isTeacher) return activities;
    return activities.filter(act => {
      const assigned = act.assignedTo;
      if (!assigned || assigned.includes('all')) return true;
      return assigned.includes(profile.id);
    });
  }, [activities, isTeacher, profile.id]);

  const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'scheduled', 'finished'

  const filteredActivitiesByStatus = useMemo(() => {
    const now = Date.now();
    return visibleActivities.filter(act => {
      const start = new Date(act.startDate).getTime();
      const due = new Date(act.dueDate).getTime();
      const mySub = submissions.find(s => s.activityId === act.id && s.studentId === profile.id);

      if (statusFilter === 'scheduled') {
        return start > now;
      }
      if (statusFilter === 'finished') {
        return (mySub && mySub.status === 'calificado') || (due < now && !isTeacher);
      }
      if (statusFilter === 'pending') {
        return start <= now && (!mySub || mySub.status !== 'calificado') && (isTeacher || due >= now);
      }
      return true;
    });
  }, [visibleActivities, statusFilter, submissions, profile.id, isTeacher]);

  const filteredStudents = useMemo(() =>
    studentUsers.filter(u => u.name?.toLowerCase().includes(studentSearch.toLowerCase()) || u.email?.toLowerCase().includes(studentSearch.toLowerCase())),
    [studentUsers, studentSearch]
  );

  const toggleStudent = (id) => {
    setAssignedToUsers(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!title || !startDate || !dueDate) return;
    if (assignedToType === 'manual' && assignedToUsers.length === 0) {
      showToast(language === 'es' ? 'Selecciona al menos un estudiante' : 'Select at least one student', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const assignedTo = assignedToType === 'all' ? ['all'] : assignedToUsers;
      const nowISO = new Date().toISOString();
      const currentEvalMethod = (activityType === 'evaluaciones' || activityType === 'examenes') ? evalMethod : 'archivo';
      
      const data = {
        title, 
        description, 
        start_date: startDate, 
        due_date: dueDate, 
        points: Number(points),
        scale: Number(scale),
        type: activityType,
        eval_method: currentEvalMethod,
        author_id: profile.id,
        created_at: nowISO,
        status: 'abierto',
        assigned_to: assignedTo,
        rubric: rubricCriteria.length > 0 ? { criteria: rubricCriteria } : null,
        // Advanced settings
        questions: currentEvalMethod === 'cuestionario' ? questions : [],
        time_limit: currentEvalMethod === 'cuestionario' ? Number(timeLimit) : 0,
        password: currentEvalMethod === 'cuestionario' ? quizPassword : '',
        manual_access: currentEvalMethod === 'cuestionario' ? manualAccess : 'auto'
      };

      if (editingActivity) {
        await api.put(`/data/activities/${editingActivity.id}`, data);
        showToast(language === 'es' ? 'Actividad actualizada' : 'Activity updated');
      } else {
        await api.post('/data/activities', data);
        const notifTargets = assignedToType === 'all' ? null : assignedToUsers;
        createNotification(`Nueva ${activityType}: ${title}`, notifTargets, activityType);
        showToast(`${activityType === 'tarea' ? 'Tarea' : 'Evaluación'} creada`);
      }
      setShowAddModal(false);
      resetForm();
    } catch (e) {
      console.error(e);
      showToast(language === 'es' ? 'Error al guardar' : 'Error saving', 'error');
    } finally { setIsSubmitting(false); }
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setStartDate(''); setDueDate('');
    setActivityType(type); setEvalMethod('archivo'); setPoints(10); setEditingActivity(null);
    setQuestions([]); setTimeLimit(0); setQuizPassword(''); setManualAccess('auto');
    setAssignedToType('all'); setAssignedToUsers([]); setStudentSearch('');
  };

  const [contentReadData, setContentReadData] = useState([]);

  // Load read stats for teacher
  const fetchReadStats = async () => {
    if (!isTeacher) return;
    try {
      const { data } = await api.get('/data/content_reads');
      setContentReadData(data?.filter(r => r.content_type === 'actividad') || []);
    } catch (e) { console.error(e); }
  };

  React.useEffect(() => {
    fetchReadStats();
  }, [activities, isTeacher, fetchReadStats]);

  const startEditing = (act) => {
    setEditingActivity(act);
    setTitle(act.title);
    setDescription(act.description || '');
    setStartDate(act.start_date || act.startDate);
    setDueDate(act.due_date || act.dueDate);
    setActivityType(act.type);
    setEvalMethod(act.eval_method || act.evalMethod || 'archivo');
    setPoints(act.points || 10);
    setQuestions(act.questions || []);
    setTimeLimit(act.time_limit || act.timeLimit || 0);
    setQuizPassword(act.password || '');
    setManualAccess(act.manual_access || act.manualAccess || 'auto');
    // Load assignment
    const assigned = act.assigned_to || act.assignedTo;
    if (!assigned || assigned.includes('all')) {
      setAssignedToType('all');
      setAssignedToUsers([]);
    } else {
      setAssignedToType('manual');
      setAssignedToUsers(assigned);
    }
    setStudentSearch('');
    setShowAddModal(true);
  };

  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now(), text: '', type: 'multiple', options: ['', ''], correct: 0, points: 1, required: true }]);
  };

  const duplicateQuestion = (q) => {
    setQuestions([...questions, { ...q, id: Date.now() }]);
  };

  const updateQuestion = (id, field, value) => {
    setQuestions(questions.map(q => {
      if (q.id === id) {
        if (field === 'type' && value === 'true_false') {
          return { ...q, type: value, options: ['Verdadero', 'Falso'], correct: 0 };
        }
        return { ...q, [field]: value };
      }
      return q;
    }));
  };

  const removeQuestion = (id) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const addOption = (questionId) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options.length < 6) {
        return { ...q, options: [...q.options, ''] };
      }
      return q;
    }));
  };

  const removeOption = (questionId, optIdx) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId && q.options.length > 2) {
        const newOpts = q.options.filter((_, i) => i !== optIdx);
        let newCorrect = q.correct;
        if (q.correct === optIdx) newCorrect = 0;
        else if (q.correct > optIdx) newCorrect -= 1;
        return { ...q, options: newOpts, correct: newCorrect };
      }
      return q;
    }));
  };

  const handleDeleteActivity = async (id) => {
    if (!window.confirm(language === 'es' ? '¿Eliminar actividad definitivamente?' : 'Delete activity permanently?')) return;
    try {
      await api.delete(`/data/activities/${id}`);
      showToast(language === 'es' ? 'Eliminado' : 'Deleted');
    } catch (e) { console.error(e); }
  };

  const handleSubmitWork = async (activityId) => {
    // Basic validation
    if (showSubmissionModal.evalMethod === 'enlace' && !submissionLink.trim()) return;
    if (isFileUploading) {
      showToast(language === 'es' ? 'Espera a que terminen las subidas' : 'Wait for uploads to finish', 'error');
      return;
    }
    if (showSubmissionModal.evalMethod === 'archivo' && !submissionHtml.trim() && submissionAttachments.length === 0) {
       showToast(language === 'es' ? 'Agrega contenido o archivos' : 'Add content or files', 'error');
       return;
    }

    // UI Optimista: Marcamos como entregado de inmediato
    const tempId = `temp-sub-${Date.now()}`;
    const submissionData = {
      activityId,
      studentId: profile.id,
      studentName: profile.name,
      text: submissionText,
      htmlContent: submissionHtml,
      link: submissionLink,
      attachments: submissionAttachments,
      comment: submissionComment,
      status: 'entregado',
      submittedAt: Date.now(),
      lastEditedAt: Date.now(),
      is_optimistic: true
    };

    const mySub = getMySubmission(activityId);
    if (mySub) {
      updateOptimistic('submissions', mySub.id, submissionData);
    } else {
      submissionData.id = tempId;
      addOptimistic('submissions', submissionData);
    }
    
    setShowSubmissionModal(null);
    resetSubmissionState();
    showToast(language === 'es' ? 'Entrega enviada (procesando...)' : 'Work sent (processing...)');

    try {
      if (mySub) {
        // Update existing submission
        await api.put(`/data/submissions/${mySub.id}`, {
          ...submissionData,
          activity_id: activityId,
          student_id: profile.id,
          student_name: profile.name,
          html_content: submissionHtml, // ensure snake_case
          submitted_at: Date.now()
        });
      } else {
        // Create new submission
        const { data: realRecord } = await api.post('/data/submissions', {
          ...submissionData,
          activity_id: activityId,
          student_id: profile.id,
          student_name: profile.name,
          html_content: submissionHtml,
          is_optimistic: undefined,
          id: undefined
        });
        replaceOptimistic('submissions', tempId, realRecord);
      }
      showToast(language === 'es' ? '¡Entrega confirmada!' : 'Submission confirmed!');
    } catch (e) { 
      console.error(e); 
      showToast(language === 'es' ? 'Error al enviar' : 'Error submitting', 'error');
    }
  };

  const resetSubmissionState = () => {
    setSubmissionText('');
    setSubmissionHtml('');
    setSubmissionLink('');
    setSubmissionAttachments([]);
    setSubmissionComment('');
  };

  const getMySubmission = (activityId) => submissions.find(s => s.activityId === activityId && s.studentId === profile.id);

  // Helper: get assigned label for teacher view
  const getAssignedLabel = (act) => {
    if (!act.assignedTo || act.assignedTo.includes('all')) {
      return { label: language === 'es' ? 'Todos' : 'Everyone', icon: <Users size={12} />, color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' };
    }
    const count = act.assignedTo.length;
    return { label: `${count} ${language === 'es' ? 'estudiante(s)' : 'student(s)'}`, icon: <UserCheck size={12} />, color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' };
  };

  return (
    <div className="space-y-12 animate-fade-in pb-16">
      {/* Header */}
      <div className="aura-card p-10 lg:p-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 aura-gradient-primary opacity-5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:opacity-10 transition-opacity"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black flex items-center gap-4 tracking-tighter uppercase font-display">
            <div className={`p-4 rounded-[1.5rem] shadow-xl ${type === 'tarea' ? 'aura-gradient-primary text-white' : 'bg-amber-500 text-white'}`}>
              {type === 'tarea' ? <FileText size={32} /> : <ClipboardList size={32} />}
            </div>
            {type === 'tarea' ? (language === 'es' ? 'Misiones' : 'Missions') : (language === 'es' ? 'Evaluaciones' : 'Evaluations')}
          </h1>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-4 ml-2 opacity-70">
            {language === 'es' ? 'Entrenamiento de campo / Sincronizado' : 'Field training / Synchronized'}
          </p>
        </div>
        
        {isTeacher && (
          <button onClick={() => { setActivityType(type); resetForm(); setShowAddModal(true); }} className="w-full md:w-auto px-8 py-5 aura-gradient-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-indigo-500/30 hover:scale-[1.05] active:scale-95 transition-all flex items-center justify-center gap-4">
            <Plus size={20} /> {language === 'es' ? 'Nueva' : 'New'} {type === 'tarea' ? (language === 'es' ? 'Misión' : 'Mission') : (language === 'es' ? 'Evaluación' : 'Evaluation')}
          </button>
        )}
      </div>

      {/* Status Tabs (Next-Gen Hub style) */}
      <div className="flex flex-col items-center">
        <div className="inline-flex p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-[2rem] shadow-inner backdrop-blur-md">
          {[
            { id: 'pending', label: language === 'es' ? 'Pendientes' : 'Pending', icon: Clock, activeColor: 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' },
            { id: 'scheduled', label: language === 'es' ? 'Próximas' : 'Upcoming', icon: Calendar, activeColor: 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' },
            { id: 'finished', label: language === 'es' ? 'Logros' : 'Achievements', icon: CheckCircle, activeColor: 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' }
          ].map(tab => {
            const TabIcon = tab.icon;
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); playSound('click'); }}
                className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all whitespace-nowrap ${isActive ? tab.activeColor : 'text-slate-500 hover:text-indigo-600'}`}
              >
                <TabIcon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {filteredActivitiesByStatus.length === 0 ? (
          <div className="col-span-full py-40 text-center aura-card border-dashed border-2">
            <div className="bg-slate-100 dark:bg-slate-800 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner">
              <ClipboardList size={48} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{language === 'es' ? 'Silencio en este sector' : 'Silence in this sector'}</p>
          </div>
        ) : (
          filteredActivitiesByStatus.map(act => {
            const mySub = getMySubmission(act.id);
            const isLate = new Date(act.dueDate).getTime() < Date.now();
            const isFuture = new Date(act.startDate).getTime() > Date.now();
            const isAvailable = !isFuture || isTeacher;
            
            const typeGradient = 
              act.type === 'examenes' ? 'from-rose-500 to-red-600' : 
              act.type === 'evaluaciones' ? 'from-amber-400 to-orange-500' : 
              act.type === 'proyectos' ? 'from-emerald-400 to-teal-500' : 'aura-gradient-primary';

            return (
              <div key={act.id} className="aura-card p-10 flex flex-col group transition-all duration-500 hover:-translate-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className={`px-4 py-1.5 text-[9px] font-black uppercase text-white rounded-xl shadow-lg shadow-indigo-500/10 bg-gradient-to-r ${typeGradient}`}>
                         {act.type}
                      </span>
                      {act.rubric && <span className="px-4 py-1.5 text-[9px] font-black uppercase rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center gap-2 border dark:border-slate-700"><Award size={12} /> Rúbrica</span>}
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tighter leading-tight group-hover:text-indigo-600 transition-colors">{act.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[10px] font-black uppercase tracking-widest">
                      <span className="flex items-center gap-2 text-slate-400"><Calendar size={14} className="text-indigo-500" /> {new Date(act.startDate).toLocaleDateString()}</span>
                      <span className={`flex items-center gap-2 ${isLate ? 'text-rose-500' : 'text-slate-400'}`}><Clock size={14} className={isLate ? '' : 'text-indigo-500'} /> {new Date(act.dueDate).toLocaleString()}</span>
                      <span className="flex items-center gap-2 text-slate-400"><Award size={14} className="text-emerald-500" /> {act.points} pts</span>
                    </div>
                  </div>
                  {isTeacher && (
                    <div className="flex gap-3 shrink-0">
                      <button
                        onClick={async () => {
                          const newStatus = act.manualAccess === 'open' ? 'closed' : 'open';
                          try {
                            await api.put(`/data/activities/${act.id}`, { manual_access: newStatus });
                            showToast(language === 'es' ? `Acceso ${newStatus === 'open' ? 'Abierto' : 'Cerrado'}` : `Access ${newStatus === 'open' ? 'Opened' : 'Closed'}`);
                          } catch (error) {
                            console.error(error);
                          }
                        }}
                        className={`p-3.5 rounded-2xl transition-all shadow-xl ${act.manualAccess === 'open' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-slate-400 bg-slate-50 dark:bg-slate-800'}`}
                      >
                        <Shield size={20} />
                      </button>
                      <button onClick={() => startEditing(act)} className="p-3.5 text-slate-400 hover:text-indigo-600 bg-slate-50 dark:bg-slate-800 rounded-2xl transition-all shadow-xl hover:shadow-indigo-500/10"><Edit2 size={20} /></button>
                      <button onClick={() => handleDeleteActivity(act.id)} className="p-3.5 text-slate-400 hover:text-rose-500 bg-slate-50 dark:bg-slate-800 rounded-2xl transition-all shadow-xl hover:shadow-rose-500/10"><Trash2 size={20} /></button>
                    </div>
                  )}
                </div>

                <div className="prose dark:prose-invert max-w-none text-slate-500 dark:text-slate-400 text-sm mb-10 ql-editor !p-0 !h-auto leading-relaxed line-clamp-3 overflow-hidden group-hover:line-clamp-none transition-all" dangerouslySetInnerHTML={{ __html: act.description }} />

                <div className="flex flex-col sm:flex-row items-center justify-between pt-8 mt-auto border-t dark:border-slate-800 gap-6">
                  {isTeacher ? (
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="flex items-center gap-3 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/5">
                        <CheckCircle size={16} /> {submissions.filter(s => s.activityId === act.id && s.status === 'entregado').length} Pendientes
                      </div>
                      <div className="flex items-center gap-3 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">
                        <Eye size={16} /> {contentReadData.filter(r => r.content_id === act.id).length} Vistos
                      </div>
                    </div>
                  ) : mySub ? (
                    <div className="flex items-center justify-between w-full bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700/50 shadow-inner">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20"><CheckCircle size={20} /></div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{language === 'es' ? 'Completado' : 'Completed'}</p>
                          <p className="text-xs font-bold text-slate-400">{new Date(mySub.submittedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {mySub.grade !== undefined && (
                        <div className="text-right">
                          <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{mySub.grade}<span className="text-xs text-slate-400">/{act.points}</span></p>
                        </div>
                      )}
                    </div>
                  ) : !isAvailable ? (
                    <div className="w-full flex items-center justify-center p-5 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-900/40 text-rose-500 text-[10px] font-black uppercase tracking-[0.2em] gap-3">
                      <AlertTriangle size={18} /> {language === 'es' ? 'Acceso Restringido' : 'Restricted Access'}
                    </div>
                  ) : isLate ? (
                    <div className="w-full flex items-center justify-center p-5 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] gap-3 italic">
                      <Clock size={18} /> {language === 'es' ? 'Misión Finalizada' : 'Mission Ended'}
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        if (act.evalMethod === 'cuestionario') {
                          setShowQuizGate(act);
                        } else {
                          let existingSub = getMySubmission(act.id);
                          if (existingSub) {
                            if (existingSub.id && !existingSub.html_content && !existingSub.htmlContent && !existingSub.attachments) {
                              const fullSub = await fetchFullRecord('submissions', existingSub.id);
                              if (fullSub) existingSub = fullSub;
                            }
                            setSubmissionHtml(existingSub.html_content || existingSub.htmlContent || '');
                            setSubmissionText(existingSub.text || '');
                            setSubmissionLink(existingSub.link || '');
                            setSubmissionAttachments(existingSub.attachments || []);
                            setSubmissionComment(existingSub.comment || '');
                          } else {
                            resetSubmissionState();
                          }
                          setShowSubmissionModal(act);
                        }
                      }}
                      className="w-full py-5 aura-gradient-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                    >
                      {act.evalMethod === 'cuestionario' ? 'Iniciar Simulación' : 'Cargar Entrega'} <ArrowRight size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] overflow-y-auto flex justify-center items-start py-8 px-4 animate-fade-in" aria-modal="true" role="dialog">
          <form onSubmit={handleSaveActivity} className="aura-card w-full max-w-5xl rounded-[2.5rem] shadow-3xl animate-scale-in flex flex-col p-0 overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-10 py-8 border-b dark:border-slate-800 aura-gradient-primary text-white shrink-0">
              <h3 className="text-3xl font-black uppercase tracking-tighter">
                {editingActivity
                  ? (language === 'es' ? 'Modificar Misión' : 'Modify Mission')
                  : (language === 'es'
                    ? `Nueva ${activityType === 'tarea' ? 'Misión' : 'Evaluación'}`
                    : `New ${activityType === 'tarea' ? 'Mission' : 'Evaluation'}`)}
              </h3>
              <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="text-white/60 hover:text-white hover:bg-white/10 p-3 rounded-2xl transition-all"><X size={32} /></button>
            </div>
            
            {/* Body */}
            <div className="p-10 space-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Title */}
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 block">{language === 'es' ? 'Nombre en clave de la misión' : 'Mission Code Name'}</label>
                  <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-8 py-5 text-xl font-black outline-none transition-all shadow-inner" placeholder="..." />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block">{language === 'es' ? 'Tipo de Operación' : 'Operation Type'}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['tareas', 'actividades', 'evaluaciones', 'examenes', 'proyectos'].map(t => (
                      <button key={t} type="button" onClick={() => setActivityType(t)} className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activityType === t ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                   {/* Points & Scale */}
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 block">{language === 'es' ? 'Potencial de Recompensa (Pts)' : 'Reward Potential (Pts)'}</label>
                  <div className="relative">
                    <input type="number" value={points} onChange={e => setPoints(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-8 py-5 text-2xl font-black outline-none transition-all shadow-inner" />
                    <Award className="absolute right-6 top-1/2 -translate-y-1/2 text-indigo-500" size={24} />
                  </div>
                </div>

                {/* Dates */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block">{language === 'es' ? 'Ventana de Lanzamiento' : 'Launch Window'}</label>
                  <div className="flex gap-4">
                    <input required value={startDate} onChange={e => setStartDate(e.target.value)} type="datetime-local" className="flex-1 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-6 py-4 text-xs font-bold outline-none transition-all dark:[color-scheme:dark]" />
                    <div className="flex items-center text-slate-300"><ArrowRight size={20} /></div>
                    <input required value={dueDate} onChange={e => setDueDate(e.target.value)} type="datetime-local" className="flex-1 bg-slate-50 dark:bg-slate-900/50 border-2 border-transparent focus:border-indigo-500 rounded-2xl px-6 py-4 text-xs font-bold outline-none transition-all dark:[color-scheme:dark]" />
                  </div>
                </div>

                {/* Assignees */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block">{language === 'es' ? 'Personal Asignado' : 'Assigned Personnel'}</label>
                  <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button type="button" onClick={() => { setAssignedToType('all'); setAssignedToUsers([]); }} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${assignedToType === 'all' ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600' : 'text-slate-500'}`}>
                      {language === 'es' ? 'Toda la Unidad' : 'Entire Unit'}
                    </button>
                    <button type="button" onClick={() => setAssignedToType('manual')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-lg transition-all ${assignedToType === 'manual' ? 'bg-white dark:bg-slate-700 shadow-md text-amber-500' : 'text-slate-500'}`}>
                      {language === 'es' ? 'Selección Manual' : 'Manual Select'}
                    </button>
                  </div>
                </div>

                {assignedToType === 'manual' && (
                  <div className="md:col-span-2 aura-card p-6 bg-slate-50/50">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="..." className="w-full bg-white dark:bg-slate-900 border-2 border-transparent focus:border-amber-500 rounded-xl pl-12 pr-4 py-3 text-sm outline-none shadow-sm" />
                      </div>
                      <button type="button" onClick={() => setAssignedToUsers(studentUsers.map(u => u.id))} className="px-4 py-3 text-[10px] font-black uppercase text-amber-600 bg-amber-50 rounded-xl">{language === 'es' ? 'Vincular todos' : 'Link all'}</button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {filteredStudents.map(student => {
                        const isSelected = assignedToUsers.includes(student.id);
                        return (
                          <button key={student.id} type="button" onClick={() => toggleStudent(student.id)} className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${isSelected ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-transparent bg-white dark:bg-slate-800'}`}>
                            <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-black uppercase overflow-hidden shrink-0">
                                {student.photoURL ? <img src={student.photoURL} className="w-full h-full object-cover" /> : student.name?.charAt(0)}
                            </div>
                            <div className="text-left min-w-0">
                              <p className="text-[10px] font-bold truncate leading-tight">{student.name}</p>
                            </div>
                            {isSelected && <CheckCircle size={14} className="text-amber-500 ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {activityType !== 'tarea' && (
                  <div className="md:col-span-2 space-y-12 animate-fade-in pt-10 border-t dark:border-slate-800">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div>
                        <h4 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-slate-100 flex items-center gap-4">
                          <Shield size={28} className="text-indigo-600" /> {language === 'es' ? 'Protocolo de Evaluación' : 'Evaluation Protocol'}
                        </h4>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">{language === 'es' ? 'Configuración de reactivos y parámetros de validación' : 'Reagent configuration and validation parameters'}</p>
                      </div>
                      <button type="button" onClick={addQuestion} className="w-full md:w-auto px-8 py-4 aura-gradient-primary text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-3">
                        <Plus size={20} /> {language === 'es' ? 'Añadir Reactivo' : 'Add Reagent'}
                      </button>
                    </div>

                    <div className="space-y-10">
                      {(questions || []).map((q, idx) => (
                        <div key={q.id} className="aura-card p-10 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800/50 hover:border-indigo-400 transition-all group/q relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600 opacity-20 group-hover/q:opacity-100 transition-all"></div>
                          <div className="flex flex-col md:flex-row gap-8 mb-10">
                            <div className="flex-1 space-y-4">
                              <div className="flex items-center gap-4">
                                <span className="w-10 h-10 rounded-xl aura-gradient-primary text-white flex items-center justify-center font-black text-xs">{idx + 1}</span>
                                <input required value={q.text} onChange={e => updateQuestion(q.id, 'text', e.target.value)} className="flex-1 bg-transparent border-none text-2xl outline-none font-black text-slate-900 dark:text-white placeholder:text-slate-200" placeholder={language === 'es' ? 'Enunciado de la pregunta...' : 'Question statement...'} />
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                              <select value={q.type} onChange={e => updateQuestion(q.id, 'type', e.target.value)} className="w-full sm:w-auto px-6 py-4 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-black text-[10px] uppercase tracking-widest outline-none text-slate-600 dark:text-slate-300">
                                <option value="multiple">{language === 'es' ? 'Múltiple Opc.' : 'Multiple Choice'}</option>
                                <option value="true_false">{language === 'es' ? 'Verdad/Falso' : 'True/False'}</option>
                                <option value="text">{language === 'es' ? 'Respuesta Libre' : 'Free Response'}</option>
                              </select>
                              <button type="button" onClick={() => removeQuestion(idx)} className="p-4 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"><Trash2 size={24}/></button>
                            </div>
                          </div>

                          {q.type === 'multiple' && (
                            <div className="space-y-8">
                              <div className="flex items-center justify-between px-2">
                                {q.options.length < 6 && (
                                  <button type="button" onClick={() => addOption(q.id)} className="text-white bg-indigo-600 px-4 py-2 rounded-xl text-xs font-black uppercase transition hover:bg-indigo-700 shadow-md shadow-indigo-500/10 flex items-center gap-2">
                                    <Plus size={14} /> {language === 'es' ? 'Añadir Opción' : 'Add Option'}
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {q.options.map((opt, oIdx) => (
                                  <div key={oIdx} className={`group/opt flex items-center gap-4 p-5 rounded-[1.5rem] border-2 transition-all duration-300 ${q.correct === oIdx ? 'bg-green-50 dark:bg-green-900/10 border-green-500 ring-8 ring-green-500/5' : 'bg-gray-50/50 dark:bg-slate-900/50 border-transparent hover:border-indigo-200'}`}>
                                    <div className="relative">
                                      <input type="radio" name={`correct_${q.id}`} checked={q.correct === oIdx} onChange={() => updateQuestion(q.id, 'correct', oIdx)} className="peer w-6 h-6 text-green-600 focus:ring-0 border-2 border-gray-300 dark:border-slate-600 rounded-full cursor-pointer appearance-none checked:bg-green-600 checked:border-transparent transition-all" title={language === 'es' ? "Marcar como correcta" : "Mark as correct"} />
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity">
                                        <CheckCircle size={14} className="text-white font-bold" />
                                      </div>
                                    </div>
                                    <input required value={opt} onChange={e => {
                                      const newOpts = [...q.options];
                                      newOpts[oIdx] = e.target.value;
                                      updateQuestion(q.id, 'options', newOpts);
                                    }} className="flex-1 bg-transparent border-none text-lg outline-none font-black text-gray-700 dark:text-gray-100 placeholder:text-gray-500 placeholder:font-medium" placeholder={`${language === 'es' ? 'Opción' : 'Option'} ${oIdx + 1}...`} />
                                    {q.options.length > 2 && (
                                      <button type="button" onClick={() => removeOption(q.id, oIdx)} className="p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover/opt:opacity-100 transition-all rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"><X size={16} /></button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {q.type === 'true_false' && (
                            <div className="space-y-6">
                              <p className="text-xs font-black text-indigo-600 uppercase tracking-widest px-2">{language === 'es' ? 'Seleccionar Respuesta Correcta' : 'Select Correct Answer'}</p>
                              <div className="grid grid-cols-2 gap-5">
                                {q.options.slice(0, 2).map((opt, oIdx) => (
                                  <div key={oIdx} onClick={() => updateQuestion(q.id, 'correct', oIdx)} className={`group/opt flex items-center justify-center gap-4 py-8 rounded-[1.5rem] border-2 transition-all duration-300 cursor-pointer ${q.correct === oIdx ? 'bg-green-50 dark:bg-green-900/10 border-green-500 ring-8 ring-green-500/5' : 'bg-gray-50/50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-700 hover:border-indigo-300'}`}>
                                    <p className={`text-2xl font-black uppercase tracking-widest ${q.correct === oIdx ? 'text-green-600' : 'text-gray-500'}`}>{opt}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-10 pt-8 border-t dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-6">
                            <label className="flex items-center gap-4 cursor-pointer group">
                              <div className={`w-14 h-7 rounded-full relative transition-all duration-500 ${q.required ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-slate-700'}`}>
                                <input type="checkbox" className="hidden" checked={q.required} onChange={e => updateQuestion(q.id, 'required', e.target.checked)} />
                                <div className={`absolute top-1.5 w-4 h-4 bg-white rounded-full shadow-xl transition-all duration-500 transform ${q.required ? 'left-8 scale-110' : 'left-1.5'}`}></div>
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-xs font-black uppercase tracking-tighter ${q.required ? 'text-indigo-600' : 'text-gray-500'}`}>{language === 'es' ? 'Pregunta Obligatoria' : 'Required Question'}</span>
                                <span className="text-xs text-gray-500 font-medium text-left">{language === 'es' ? 'El paso por esta pregunta será requerido' : 'This question must be answered'}</span>
                              </div>
                            </label>

                            {(q.type === 'multiple' || q.type === 'true_false') && (
                              <div className={`px-6 py-3 rounded-2xl flex items-center gap-3 transition-all ${q.correct !== undefined ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-red-50 dark:bg-red-900/20 text-red-500 animate-pulse'}`}>
                                <div className={`w-2 h-2 rounded-full ${q.correct !== undefined ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                <span className="text-xs font-black uppercase tracking-widest">{q.correct !== undefined ? (language === 'es' ? 'Respuesta definida' : 'Answer set') : (language === 'es' ? 'Definir respuesta correcta' : 'Set correct answer')}</span>
                                {q.correct === undefined && <AlertTriangle size={14} />}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Description (rich text) */}
              <div className="md:col-span-2 text-left">
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Instrucciones Detalladas' : 'Detailed Instructions'}</label>
                <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <ReactQuill theme="snow" value={description} onChange={setDescription} />
                </div>
              </div>
            </div>

            </div>{/* ── End Scrollable Body ── */}

            {/* ── Footer ── */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-6 sm:px-8 py-4 border-t border-gray-100 dark:border-slate-700">
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {assignedToType === 'all'
                  ? (language === 'es' ? '📢 Se publicará para todos los estudiantes' : '📢 Will be published for all students')
                  : (language === 'es' ? `🎯 Se asignará a ${assignedToUsers.length} estudiante(s) específico(s)` : `🎯 Will be assigned to ${assignedToUsers.length} specific student(s)`)}
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="px-6 py-2.5 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition">{language === 'es' ? 'Cancelar' : 'Cancel'}</button>
                <button
                  disabled={isSubmitting}
                  type="submit"
                  className={`px-10 py-3 text-white rounded-2xl font-bold shadow-xl transition transform active:scale-95 disabled:opacity-50 ${activityType === 'tarea' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
                >
                  {editingActivity
                    ? (language === 'es' ? 'Actualizar Cambios' : 'Update Changes')
                    : activityType === 'tarea'
                      ? (language === 'es' ? 'Publicar Tarea' : 'Publish Task')
                      : (language === 'es' ? 'Publicar Evaluación' : 'Publish Evaluation')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Quiz Access Gate */}
      {showQuizGate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl animate-scale-in text-center border dark:border-slate-700">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 transform rotate-12">
              <Shield size={40} />
            </div>
            <h3 className="text-3xl font-black mb-3 text-gray-900 dark:text-white leading-tight">{showQuizGate.title}</h3>
            <p className="text-sm text-gray-500 mb-10 leading-relaxed px-4">{language === 'es' ? 'Estás a punto de iniciar un cuestionario. Una vez que comiences, el tiempo empezará a correr si hay un límite establecido.' : 'You are about to start a quiz. Once you begin, the timer will start if a time limit is set.'}</p>

            <div className="space-y-8">
              {showQuizGate.password && (
                <div className="text-left">
                  <label className="block text-xs font-bold uppercase text-gray-500 mb-3 tracking-widest text-center">{language === 'es' ? 'Ingresar Contraseña de Examen' : 'Enter Exam Password'}</label>
                  <input type="password" value={gatePassword} onChange={e => setGatePassword(e.target.value)} className="w-full px-6 py-4 rounded-2xl border-2 dark:border-slate-700 dark:bg-slate-900 outline-none focus:border-indigo-500 text-center text-xl tracking-[0.5em] font-black" placeholder="••••" />
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => { setShowQuizGate(null); setGatePassword(''); }} className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 dark:hover:bg-slate-700 rounded-2xl transition">{language === 'es' ? 'Cerrar' : 'Close'}</button>
                <button
                  onClick={() => {
                    if (showQuizGate.password && gatePassword !== showQuizGate.password) {
                      showToast(language === 'es' ? 'Contraseña de examen incorrecta' : 'Incorrect exam password', 'error');
                      return;
                    }
                    window.dispatchEvent(new CustomEvent('start-quiz', { detail: { quiz: showQuizGate, studentId: profile.id } }));
                    setShowQuizGate(null);
                    setGatePassword('');
                  }}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transform hover:-translate-y-1 transition-all active:scale-95"
                >{language === 'es' ? 'Comenzar Ahora' : 'Start Now'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generic Submission Modal */}
      {showSubmissionModal && (
        <SubmissionModalWrapper 
          activity={showSubmissionModal} 
          userId={profile.id} 
          onClose={() => { setShowSubmissionModal(null); resetSubmissionState(); }}
          submissions={submissions}
          profile={profile}
          language={language}
          comments={comments}
          showToast={showToast}
          submissionHtml={submissionHtml}
          setSubmissionHtml={setSubmissionHtml}
          submissionLink={submissionLink}
          setSubmissionLink={setSubmissionLink}
          submissionAttachments={submissionAttachments}
          setSubmissionAttachments={setSubmissionAttachments}
          submissionComment={submissionComment}
          setSubmissionComment={setSubmissionComment}
          isSubmitting={isSubmitting}
          isFileUploading={isFileUploading}
          setIsFileUploading={setIsFileUploading}
          handleSubmitWork={handleSubmitWork}
          getMySubmission={getMySubmission}
        />
      )}
    </div>
  );
}

// HELPER COMPONENT FOR READ TRACKING & CLEANER MODAL
function SubmissionModalWrapper({ 
  activity, userId, onClose, profile, language,
  submissionHtml, setSubmissionHtml, 
  submissionLink, setSubmissionLink, 
  submissionAttachments, setSubmissionAttachments,
  submissionComment, setSubmissionComment,
  isSubmitting, isFileUploading, setIsFileUploading,
  handleSubmitWork, getMySubmission,
  comments, showToast
}) {
  
  // Track read status automatically when opened
  useContentRead(userId, activity.id, 'actividad');

  const mySub = getMySubmission(activity.id);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="aura-card w-full max-w-4xl rounded-[2.5rem] p-0 shadow-3xl animate-scale-in border dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-10 py-8 aura-gradient-primary text-white flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70 mb-1">{language === 'es' ? 'Carga de Datos' : 'Data Upload'}</p>
            <h3 className="text-2xl font-black uppercase tracking-tighter">
              {mySub ? (language === 'es' ? 'Sincronizar Entrega' : 'Sync Submission') : (language === 'es' ? 'Enviar Reporte' : 'Send Report')}
            </h3>
          </div>
          <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><X size={32} /></button>
        </div>

        <div className="p-10 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-10">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 space-y-8">
               {/* Rich Editor */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                  <FileText size={16} className="text-indigo-500" /> 
                  {language === 'es' ? 'Cuerpo del informe' : 'Report body'}
                </label>
                <div className="rounded-2xl border-2 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-inner">
                  <DocumentEditor value={submissionHtml} onChange={setSubmissionHtml} placeholder="..." />
                </div>
              </div>

              {activity.evalMethod === 'enlace' && (
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3"><LinkIcon size={16} /> URL Host</label>
                  <input value={submissionLink} onChange={e => setSubmissionLink(e.target.value)} type="url" className="w-full bg-slate-100 dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-xl px-6 py-4 text-sm font-bold outline-none transition-all" />
                </div>
              )}
            </div>

            <div className="w-full lg:w-80 space-y-8">
               {/* Files */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3"><Paperclip size={16} /> Adjuntos</label>
                <FileUploader 
                  files={submissionAttachments}
                  onUploadComplete={(file) => setSubmissionAttachments(prev => [...prev, file])}
                  onRemoveFile={(url) => setSubmissionAttachments(prev => prev.filter(f => f.url !== url))}
                  onStatusChange={setIsFileUploading}
                  language={language}
                />
              </div>

               {/* Comment */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3"><MessageSquare size={16} /> Nota</label>
                <textarea 
                  value={submissionComment} 
                  onChange={e => setSubmissionComment(e.target.value)} 
                  className="w-full h-32 bg-slate-100 dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-xl px-6 py-4 text-sm font-bold outline-none transition-all resize-none" 
                  placeholder="..." 
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSubmitWork(activity.id)}
            disabled={isSubmitting || isFileUploading || ((activity.eval_method || activity.evalMethod) === 'enlace' ? !submissionLink.trim() : (!submissionHtml.trim() && submissionAttachments.length === 0))}
            className="w-full py-6 aura-gradient-primary text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl shadow-indigo-500/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
          >
            {mySub ? (language === 'es' ? 'Actualizar Datos' : 'Update Data') : (language === 'es' ? 'Confirmar Entrega' : 'Confirm Submission')}
            <ArrowRight size={20} />
          </button>

          {mySub && (
            <div className="pt-10 border-t dark:border-slate-800">
              <CommentsSection 
                parentId={mySub.id}
                parentType="submission"
                profile={profile}
                comments={comments || []}
                showToast={showToast}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
