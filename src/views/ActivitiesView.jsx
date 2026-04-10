import React, { useState, useMemo } from 'react';
import { Plus, X, Calendar, User, FileText, CheckCircle, Clock, Trash2, Edit2, Send, Link as LinkIcon, ClipboardList, Info, Shield, Settings, AlertTriangle, Copy, Award, Users, UserCheck, Search, Paperclip, MessageSquare, Eye } from 'lucide-react';
import { supabase } from '../config/supabase';
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
        const { error } = await supabase.from('activities').update(data).eq('id', editingActivity.id);
        if (error) throw error;
        showToast(language === 'es' ? 'Actividad actualizada' : 'Activity updated');
      } else {
        const { error } = await supabase.from('activities').insert(data);
        if (error) throw error;
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
    const { data } = await supabase.from('content_reads').select('*').eq('content_type', 'actividad');
    setContentReadData(data || []);
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
      const { error } = await supabase.from('activities').delete().eq('id', id);
      if (error) throw error;
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
        const { error } = await supabase.from('submissions').update(submissionData).eq('id', mySub.id);
        if (error) throw error;
      } else {
        // Create new submission
        const { data, error } = await supabase.from('submissions').insert({ ...submissionData, is_optimistic: undefined, id: undefined }).select().single();
        if (error) throw error;
        replaceOptimistic('submissions', tempId, data);
      }
      showToast(language === 'es' ? '¡Entrega confirmada!' : 'Submission confirmed!');
    } catch (e) { 
      console.error(e); 
      showToast(language === 'es' ? 'Error al enviar' : 'Error submitting', 'error');
      // En una versión más avanzada, revertiríamos el cambio optimista aquí.
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
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="glass-card flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 sm:p-8 rounded-3xl transition-shadow gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
            {type === 'tarea' ? <FileText className="text-blue-500" size={32} /> : <ClipboardList className="text-amber-500" size={32} />}
            {type === 'tarea' ? (language === 'es' ? 'Tareas Académicas' : 'Academic Tasks') : (language === 'es' ? 'Evaluaciones y Exámenes' : 'Evaluations and Exams')}
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{language === 'es' ? 'Gestiona tus entregas y revisa los plazos establecidos.' : 'Manage your submissions and check deadlines.'}</p>
        </div>
        {isTeacher && (
          <button onClick={() => { setActivityType(type); resetForm(); setShowAddModal(true); }} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 text-white px-5 py-3 rounded-xl hover:bg-indigo-700 transition shadow-md hover-spring focus-visible:ring-inset">
        <Plus size={20} /> {language === 'es' ? 'Crear' : 'Create'} {type === 'tarea' ? (language === 'es' ? 'Tarea' : 'Task') : (language === 'es' ? 'Evaluación' : 'Evaluation')}
          </button>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex p-1.5 bg-gray-100 dark:bg-slate-800 rounded-2xl w-full max-w-2xl mx-auto mb-8 shadow-inner overflow-x-auto no-scrollbar">
        {[
          { id: 'pending', label: language === 'es' ? 'Pendientes' : 'Pending', icon: Clock, color: 'text-amber-600 bg-white dark:bg-slate-700 shadow-sm' },
          { id: 'scheduled', label: language === 'es' ? 'Programadas' : 'Scheduled', icon: Calendar, color: 'text-indigo-600 bg-white dark:bg-slate-700 shadow-sm' },
          { id: 'finished', label: language === 'es' ? 'Finalizadas' : 'Finished', icon: CheckCircle, color: 'text-green-600 bg-white dark:bg-slate-700 shadow-sm' }
        ].map(tab => {
          const TabIcon = tab.icon;
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setStatusFilter(tab.id); playSound('click'); }}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${isActive ? tab.color : 'text-gray-500 hover:text-gray-700 dark:hover:text-slate-300'}`}
            >
              <TabIcon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {filteredActivitiesByStatus.length === 0 ? (
          <div className="col-span-full py-20 text-center glass-card rounded-3xl">
            <div className="bg-gray-50 dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={40} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">{language === 'es' ? 'No hay entregas en esta sección' : 'No submissions in this section'}</p>
          </div>
        ) : (
          filteredActivitiesByStatus.map(act => {
            const mySub = getMySubmission(act.id);
            const isLate = new Date(act.dueDate).getTime() < Date.now();
            const isFuture = new Date(act.startDate).getTime() > Date.now();
            const isAvailable = !isFuture || isTeacher;
            
            
            const typeColor = act.type === 'examenes' ? 'border-l-red-500' : act.type === 'evaluaciones' ? 'border-l-amber-500' : act.type === 'proyectos' ? 'border-l-emerald-500' : 'border-l-indigo-500';

            return (
              <div key={act.id} className={`glass-card p-6 sm:p-8 rounded-3xl flex flex-col group hover-spring shadow-sm hover:shadow-md transition-all border-l-4 ${typeColor}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg shadow-sm ${
                        act.type === 'tareas' ? 'bg-blue-100 text-blue-600' :
                        act.type === 'examenes' ? 'bg-red-100 text-red-600' :
                        act.type === 'evaluaciones' ? 'bg-amber-100 text-amber-600' :
                        act.type === 'actividades' ? 'bg-purple-100 text-purple-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                         {act.type}
                      </span>
                      {act.rubric && <span className="px-2.5 py-1 text-[10px] font-black uppercase rounded-lg bg-indigo-100 text-indigo-600 flex items-center gap-1"><Award size={10} /> Rúbrica</span>}
                      <span className="text-[10px] font-bold text-gray-400">Escala: {act.scale || act.points} pts</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">{act.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-600 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1.5"><Calendar size={16} className="text-indigo-500" /> {language === 'es' ? 'Inicio' : 'Start'}: {new Date(act.startDate).toLocaleDateString()}</span>
                      <span className={`flex items-center gap-1.5 font-bold ${isLate ? 'text-red-500' : ''}`}><Clock size={16} className={isLate ? '' : 'text-purple-500'} /> {language === 'es' ? 'Límite' : 'Due'}: {new Date(act.dueDate).toLocaleString()}</span>
                      <span className="flex items-center gap-1.5"><Award size={16} className="text-amber-500" /> {act.points} pts</span>
                    </div>
                  </div>
                  {isTeacher && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={async () => {
                          const newStatus = act.manualAccess === 'open' ? 'closed' : 'open';
                          const { error } = await supabase.from('activities').update({ manualAccess: newStatus }).eq('id', act.id);
                          if (error) {
                            console.error(error);
                            return;
                          }
                          showToast(language === 'es' ? `Acceso ${newStatus === 'open' ? 'Abierto' : 'Cerrado'}` : `Access ${newStatus === 'open' ? 'Opened' : 'Closed'}`);
                        }}
                        className={`p-2.5 rounded-xl transition shadow-sm ${act.manualAccess === 'open' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-gray-500 bg-gray-50 dark:bg-slate-700/50'}`}
                        data-tooltip={language === 'es' ? "Cambiar acceso manual" : "Toggle manual access"}
                        aria-label="Toggle Access"
                      >
                        <Shield size={18} />
                      </button>
                      <button onClick={() => startEditing(act)} className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition shadow-sm" data-tooltip={language === 'es' ? "Editar actividad" : "Edit activity"} aria-label="Edit"><Edit2 size={18} /></button>
                      <button onClick={() => handleDeleteActivity(act.id)} className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition shadow-sm" data-tooltip={language === 'es' ? "Eliminar actividad" : "Delete activity"} aria-label="Delete"><Trash2 size={18} /></button>
                    </div>
                  )}
                </div>

                <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-slate-300 text-sm mb-6 ql-editor !p-0 !h-auto leading-relaxed" dangerouslySetInnerHTML={{ __html: act.description }} />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-5 mt-auto border-t border-gray-100 dark:border-slate-700/50 gap-4">
                  {isTeacher ? (
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-300 font-bold text-sm bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-xl">
                        <CheckCircle size={16} /> {submissions.filter(s => s.activityId === act.id && s.status === 'entregado').length} {language === 'es' ? 'pendientes' : 'pending'}
                      </div>
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300 font-bold text-sm bg-amber-50 dark:bg-amber-900/30 px-3 py-2 rounded-xl" title={language === 'es' ? 'Estudiantes que han leído la actividad' : 'Students who read the activity'}>
                        <Eye size={16} /> {contentReadData.filter(r => r.content_id === act.id).length} {language === 'es' ? 'visto(s)' : 'read'}
                      </div>
                    </div>
                  ) : mySub ? (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-sm bg-green-50 dark:bg-green-900/20 px-4 py-2.5 rounded-xl w-full sm:w-auto">
                      <CheckCircle size={18} /> {language === 'es' ? 'Entregado' : 'Submitted'}
                      {mySub.grade !== undefined && <span className="ml-2 bg-green-100 dark:bg-green-800 px-2 py-0.5 rounded text-xs text-green-800 dark:text-green-100">Calificación: {mySub.grade}/{act.points}</span>}
                    </div>
                  ) : !isAvailable ? (
                    <div className="text-red-600 dark:text-red-400 font-bold text-sm flex items-center gap-2 py-2.5 px-4 bg-red-50 dark:bg-red-900/20 rounded-xl w-full sm:w-auto">
                      <X size={18} /> {language === 'es' ? 'Evaluación no disponible en este momento' : 'Evaluation currently unavailable'}
                    </div>
                  ) : isLate ? (
                    <div className="text-red-600 dark:text-red-400 font-bold text-sm w-full sm:w-auto px-4 py-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-2"><Clock size={18} /> {language === 'es' ? 'Plazo vencido' : 'Deadline passed'}</div>
                  ) : isFuture && !isTeacher ? (
                    <div className="text-gray-500 dark:text-slate-400 text-sm italic font-medium">{language === 'es' ? 'Disponible próximamente' : 'Available soon'}</div>
                  ) : (
                    <button
                      onClick={async () => {
                        if (act.evalMethod === 'cuestionario') {
                          setShowQuizGate(act);
                        } else {
                          let existingSub = getMySubmission(act.id);
                          if (existingSub) {
                            // Hidratación bajo demanda si falta el contenido pesado
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
                      className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition shadow-md hover-spring focus-visible:ring-inset"
                    >
                      {act.evalMethod === 'cuestionario' ? (language === 'es' ? 'Iniciar Evaluación' : 'Start Evaluation') : (language === 'es' ? 'Realizar Entrega' : 'Submit Work')}
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
        <div className="fixed inset-0 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm z-[100] overflow-y-auto flex justify-center items-start py-4 sm:py-8 px-2 sm:px-4 animate-fade-in" aria-modal="true" role="dialog">
          <form onSubmit={handleSaveActivity} className="glass-card w-full max-w-4xl rounded-3xl shadow-2xl animate-scale-in flex flex-col">
            {/* ── Header ── */}
            <div className="flex justify-between items-center px-6 sm:px-8 py-5 border-b border-gray-100 dark:border-slate-700/60 shrink-0">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {editingActivity
                  ? (language === 'es' ? 'Editar Actividad' : 'Edit Activity')
                  : (language === 'es'
                    ? `Crear Nueva ${activityType === 'tarea' ? 'Tarea' : 'Evaluación'}`
                    : `Create New ${activityType === 'tarea' ? 'Task' : 'Evaluation'}`)}
              </h3>
              <button type="button" onClick={() => { setShowAddModal(false); resetForm(); }} className="text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-xl transition focus-visible:ring-inset" aria-label="Close"><X size={28} /></button>
            </div>
            {/* ── Body ── */}
            <div className="px-6 sm:px-8 py-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="md:col-span-2">
                <label htmlFor="activityTitle" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Título' : 'Title'}</label>
                <input id="activityTitle" name="activityTitle" required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" placeholder={language === 'es' ? "Ej. Laboratorio de Ciclos For" : "e.g. For Loops Lab"} />
              </div>

              {/* Activity Type */}
              <div>
                <label htmlFor="activityCategory" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Categoría' : 'Category'}</label>
                <select id="activityCategory" value={activityType} onChange={e => setActivityType(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow font-bold">
                  <option value="tareas">📄 {language === 'es' ? 'Tareas' : 'Tasks'}</option>
                  <option value="actividades">🛠️ {language === 'es' ? 'Actividades' : 'Activities'}</option>
                  <option value="evaluaciones">📝 {language === 'es' ? 'Evaluaciones' : 'Evaluations'}</option>
                  <option value="examenes">🔥 {language === 'es' ? 'Exámenes' : 'Exams'}</option>
                  <option value="proyectos">🚀 {language === 'es' ? 'Proyectos' : 'Projects'}</option>
                </select>
              </div>

              {/* Rubric Section */}
              <div className="md:col-span-2 p-6 bg-gray-50 dark:bg-slate-900/30 rounded-2xl border border-gray-100 dark:border-slate-700">
                 <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                       <Award size={18} className="text-indigo-500" />
                       {language === 'es' ? 'Rúbrica de Evaluación (Opcional)' : 'Grading Rubric (Optional)'}
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => setRubricCriteria([...rubricCriteria, { id: Date.now(), name: '', points: 1 }])}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-slate-700 shadow-sm"
                    >
                       <Plus size={14} /> {language === 'es' ? 'Añadir Criterio' : 'Add Criterion'}
                    </button>
                 </div>
                 
                 {rubricCriteria.length > 0 ? (
                    <div className="space-y-3">
                       {rubricCriteria.map((c, idx) => (
                          <div key={c.id} className="flex gap-3 items-center animate-fade-in">
                             <input 
                               value={c.name} 
                               onChange={e => {
                                  const newVal = [...rubricCriteria];
                                  newVal[idx].name = e.target.value;
                                  setRubricCriteria(newVal);
                               }}
                               placeholder={language === 'es' ? "Nombre del criterio (ej: Ortografía)" : "Criterion name (e.g. Grammar)"}
                               className="flex-1 px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                             />
                             <input 
                               type="number"
                               value={c.points} 
                               onChange={e => {
                                  const newVal = [...rubricCriteria];
                                  newVal[idx].points = Number(e.target.value);
                                  setRubricCriteria(newVal);
                               }}
                               className="w-20 px-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                             />
                             <button type="button" onClick={() => setRubricCriteria(rubricCriteria.filter((_, i) => i !== idx))} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16} /></button>
                          </div>
                       ))}
                       <div className="pt-3 border-t dark:border-slate-700 flex justify-between text-xs font-bold uppercase tracking-widest">
                          <span className="text-gray-500">{language === 'es' ? 'Total Rúbrica' : 'Rubric Total'}:</span>
                          <span className={rubricCriteria.reduce((a,b)=>a+b.points, 0) == scale ? 'text-green-600' : 'text-amber-600'}>
                             {rubricCriteria.reduce((a,b)=>a+b.points, 0)} / {scale} pts
                          </span>
                       </div>
                    </div>
                 ) : (
                    <p className="text-xs text-gray-400 italic">{language === 'es' ? 'No se ha definido una rúbrica. Se calificará de forma manual.' : 'No rubric defined. Grading will be manual.'}</p>
                 )}
              </div>

              {/* Eval Method */}
              {activityType === 'evaluacion' && (
                <div>
                  <label htmlFor="evalMethod" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Método de Entrega' : 'Submission Method'}</label>
                  <select id="evalMethod" value={evalMethod} onChange={e => setEvalMethod(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow">
                    <option value="archivo">{language === 'es' ? 'Subida de Archivo' : 'File Upload'}</option>
                    <option value="enlace">{language === 'es' ? 'Enlace Externo' : 'External Link'}</option>
                    <option value="cuestionario">{language === 'es' ? 'Cuestionario en Plataforma' : 'Platform Quiz'}</option>
                  </select>
                </div>
              )}

              {/* Dates */}
              <div>
                <label htmlFor="activityStartDate" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Fecha de Apertura' : 'Start Date'}</label>
                <input id="activityStartDate" name="activityStartDate" required value={startDate} onChange={e => setStartDate(e.target.value)} type="datetime-local" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:[color-scheme:dark]" />
              </div>
              <div>
                <label htmlFor="activityDueDate" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Fecha de Entrega' : 'Due Date'}</label>
                <input id="activityDueDate" name="activityDueDate" required value={dueDate} onChange={e => setDueDate(e.target.value)} type="datetime-local" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow dark:[color-scheme:dark]" />
              </div>

              {/* Points */}
              <div>
                <label htmlFor="activityPoints" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">{language === 'es' ? 'Puntos / Valor Total' : 'Points / Total Value'}</label>
                <input id="activityPoints" name="activityPoints" type="number" value={points} onChange={e => setPoints(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" />
              </div>

              {/* ASSIGNMENT SECTION */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  {assignedToType === 'manual' ? <UserCheck size={16} className="text-amber-500" /> : <Users size={16} className="text-indigo-500" />}
                  {language === 'es' ? 'Destinatarios' : 'Recipients'}
                  <span className="text-xs text-gray-400 dark:text-slate-500 font-normal ml-1">
                    {assignedToType === 'all'
                      ? (language === 'es' ? '— Todos los estudiantes' : '— All students')
                      : (language === 'es' ? `— ${assignedToUsers.length} seleccionado(s)` : `— ${assignedToUsers.length} selected`)}
                  </span>
                </label>

                {/* Toggle inside a standard input-style row */}
                <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 transition-shadow">
                  <button
                    type="button"
                    onClick={() => { setAssignedToType('all'); setAssignedToUsers([]); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${assignedToType === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                  >
                    <Users size={13} /> {language === 'es' ? 'Todos' : 'All'}
                  </button>
                  <div className="w-px h-5 bg-gray-200 dark:bg-slate-700" />
                  <button
                    type="button"
                    onClick={() => setAssignedToType('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${assignedToType === 'manual' ? 'bg-amber-500 text-white shadow' : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}
                  >
                    <UserCheck size={13} /> {language === 'es' ? 'Manual' : 'Manual'}
                  </button>
                </div>

                {/* Manual student selector — collapses in when needed */}
                {assignedToType === 'manual' && (
                  <div className="mt-3 p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/50">
                    {/* Search + Select All */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={studentSearch}
                          onChange={e => setStudentSearch(e.target.value)}
                          placeholder={language === 'es' ? 'Buscar estudiante...' : 'Search student...'}
                          className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-amber-400 text-xs transition-shadow"
                        />
                      </div>
                      <button type="button" onClick={() => setAssignedToUsers(studentUsers.map(u => u.id))} className="px-3 py-2 text-[11px] font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition whitespace-nowrap">
                        {language === 'es' ? 'Todos' : 'All'}
                      </button>
                      <button type="button" onClick={() => setAssignedToUsers([])} className="px-3 py-2 text-[11px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition whitespace-nowrap">
                        {language === 'es' ? 'Ninguno' : 'None'}
                      </button>
                    </div>

                    {/* Students grid */}
                    {studentUsers.length === 0 ? (
                      <p className="text-center text-xs text-gray-400 dark:text-slate-500 py-4 border border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
                        {language === 'es' ? 'No hay estudiantes registrados aún.' : 'No students registered yet.'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                        {filteredStudents.map(student => {
                          const isSelected = assignedToUsers.includes(student.id);
                          return (
                            <button
                              key={student.id}
                              type="button"
                              onClick={() => toggleStudent(student.id)}
                              className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all ${isSelected
                                ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
                                : 'border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                            >
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black uppercase shrink-0 transition-colors overflow-hidden ${isSelected ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'}`}>
                                {student.photoURL
                                  ? <img src={student.photoURL} alt={student.name} className="w-7 h-7 rounded-full object-cover" />
                                  : student.name?.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold truncate ${isSelected ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-200'}`}>{student.name}</p>
                                <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate leading-none">{student.email}</p>
                              </div>
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-gray-300 dark:border-slate-600'}`}>
                                {isSelected && <CheckCircle size={10} className="text-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quiz advanced config */}
              {evalMethod === 'cuestionario' && activityType === 'evaluacion' && (
                <div className="md:col-span-2 space-y-4 p-8 bg-gray-50 dark:bg-slate-900 rounded-[2.5rem] border-2 border-indigo-100 dark:border-indigo-900/50">
                  <div className="flex items-center justify-between mb-2 text-left">
                    <h4 className="font-black flex items-center gap-3 text-indigo-600 text-xl tracking-tight"><Settings size={24} className="animate-spin-slow" /> {language === 'es' ? 'Configuración del Cuestionario' : 'Quiz Configuration'}</h4>
                    <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20">{language === 'es' ? 'Modo Avanzado' : 'Advanced'}</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-left">
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border dark:border-slate-700 shadow-sm">
                      <label className="block text-xs font-black uppercase text-gray-500 mb-2 tracking-widest">{language === 'es' ? 'Tiempo Límite' : 'Time Limit'}</label>
                      <div className="flex items-center gap-3">
                        <input type="number" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} className="w-full bg-transparent text-xl font-black outline-none" placeholder="0" />
                        <span className="text-xs font-bold text-gray-500">MIN</span>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border dark:border-slate-700 shadow-sm">
                      <label className="block text-xs font-black uppercase text-gray-500 mb-2 tracking-widest">{language === 'es' ? 'Contraseña' : 'Password'}</label>
                      <div className="flex items-center gap-3">
                        <Shield size={20} className="text-indigo-400" />
                        <input type="text" value={quizPassword} onChange={e => setQuizPassword(e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" placeholder={language === 'es' ? "Opcional" : "Optional"} />
                      </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border dark:border-slate-700 shadow-sm">
                      <label className="block text-xs font-black uppercase text-gray-500 mb-2 tracking-widest">{language === 'es' ? 'Acceso' : 'Access'}</label>
                      <select value={manualAccess} onChange={e => setManualAccess(e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none cursor-pointer">
                        <option value="auto">📅 {language === 'es' ? 'Automático' : 'Auto'}</option>
                        <option value="open">🟢 {language === 'es' ? 'Abierto' : 'Open'}</option>
                        <option value="closed">🔴 {language === 'es' ? 'Cerrado' : 'Closed'}</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-8 border-t dark:border-slate-700 space-y-6 text-left">
                    <div className="flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-3xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/40">
                      <div>
                        <h5 className="font-black text-gray-800 dark:text-gray-100 text-lg flex items-center gap-2"><ClipboardList size={20} className="text-indigo-600" /> {language === 'es' ? 'Estructura de la Evaluación' : 'Quiz Structure'}</h5>
                        <p className="text-xs text-indigo-600 font-black uppercase tracking-widest mt-1">
                          {questions.length} {language === 'es' ? 'Preguntas' : 'Questions'} • {language === 'es' ? 'Total Puntos' : 'Total Points'}: {questions.reduce((acc, q) => acc + (q.points || 0), 0)} / {points}
                        </p>
                      </div>
                      <button type="button" onClick={addQuestion} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl hover:bg-indigo-700 transition font-black shadow-xl shadow-indigo-500/20 transform hover:-translate-y-1 active:scale-95">
                        <Plus size={20} /> {language === 'es' ? 'Nueva Pregunta' : 'New Question'}
                      </button>
                    </div>

                    <div className="space-y-10 py-4">
                      {questions.map((q, idx) => (
                        <div key={q.id} className="p-8 pt-16 mt-6 bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-gray-100 dark:border-slate-700 shadow-xl relative group/q transition-all hover:border-indigo-400 dark:hover:border-indigo-500">
                          <div className="absolute -top-4 -left-4 w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black shadow-xl text-xl transform rotate-3 z-10">
                            {idx + 1}
                          </div>

                          <div className="absolute top-6 right-6 flex gap-2 z-10">
                            <button type="button" onClick={() => duplicateQuestion(q)} data-tooltip={language === 'es' ? "Duplicar pregunta" : "Duplicate"} className="text-gray-500 hover:text-indigo-600 p-2 opacity-0 group-hover/q:opacity-100 transition-all rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/40"><Copy size={20} /></button>
                            <button type="button" onClick={() => removeQuestion(q.id)} data-tooltip={language === 'es' ? "Eliminar pregunta" : "Delete"} className="text-gray-500 hover:text-red-500 p-2 opacity-0 group-hover/q:opacity-100 transition-all rounded-xl hover:bg-red-50 dark:hover:bg-red-900/40"><Trash2 size={20} /></button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 text-left">
                            <div className="lg:col-span-12 xl:col-span-7">
                              <label className="block text-xs font-black text-gray-500 uppercase mb-3 tracking-widest">{language === 'es' ? 'Enunciado de la Pregunta' : 'Question'}</label>
                              <textarea required value={q.text} onChange={e => updateQuestion(q.id, 'text', e.target.value)} className="w-full px-6 py-4 rounded-3xl border-2 border-gray-100 dark:border-slate-700 dark:bg-slate-900 font-bold text-xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-inner resize-none" placeholder={language === 'es' ? "Escribe la pregunta aquí..." : "Write the question here..."} rows="2" />
                            </div>
                            <div className="lg:col-span-6 xl:col-span-3">
                              <label className="block text-xs font-black text-gray-500 uppercase mb-3 tracking-widest">{language === 'es' ? 'Tipo' : 'Type'}</label>
                              <select value={q.type} onChange={e => updateQuestion(q.id, 'type', e.target.value)} className="w-full px-3 py-4 rounded-2xl border-2 border-gray-100 dark:border-slate-700 dark:bg-slate-900 font-black text-xs md:text-sm outline-none focus:border-indigo-500 transition-all cursor-pointer shadow-sm text-gray-900 dark:text-white">
                                <option value="multiple" className="bg-white dark:bg-slate-800">🔘 {language === 'es' ? 'Opción Múltiple' : 'Multiple Choice'}</option>
                                <option value="true_false" className="bg-white dark:bg-slate-800">⚖️ {language === 'es' ? 'Verdadero o Falso' : 'True or False'}</option>
                                <option value="open" className="bg-white dark:bg-slate-800">✍️ {language === 'es' ? 'Respuesta Abierta' : 'Open Answer'}</option>
                              </select>
                            </div>
                            <div className="lg:col-span-6 xl:col-span-2">
                              <label className="block text-xs font-black text-gray-500 uppercase mb-3 tracking-widest">{language === 'es' ? 'Puntaje' : 'Points'}</label>
                              <div className="relative">
                                <input type="number" value={q.points} onChange={e => updateQuestion(q.id, 'points', Number(e.target.value))} className="w-full px-4 py-4 rounded-2xl border-2 border-gray-100 dark:border-slate-700 dark:bg-slate-900 font-black text-2xl text-center outline-none focus:border-indigo-500 transition-all shadow-sm" />
                                <span className="absolute -top-3 -right-2 bg-amber-500 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-lg transform rotate-12">PTS</span>
                              </div>
                            </div>
                          </div>

                          {q.type === 'multiple' && (
                            <div className="space-y-6">
                              <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{language === 'es' ? 'Opciones de Respuesta' : 'Answer Options'}</p>
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse"></div>
                                </div>
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl p-8 shadow-2xl animate-scale-in border dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white uppercase tracking-tight">
              {mySub 
                ? (language === 'es' ? 'Actualizar Entrega' : 'Update Submission')
                : (language === 'es' ? 'Realizar Entrega' : 'Submit Work')
              }
            </h3>
            <p className="text-sm text-indigo-600 font-bold mt-1 uppercase tracking-widest">{activity.title}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition"
          >
            <X size={28} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar space-y-6">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex gap-3 text-left">
            <Info className="text-indigo-600 shrink-0" />
            <p className="text-xs text-indigo-800 dark:text-indigo-300">
              {language === 'es' ? 'Envía tu propuesta aquí. Recuerda revisar bien el formato solicitado por el docente antes de confirmar tu entrega final.' : 'Submit your work here. Review the required format before confirming your final submission.'}
            </p>
          </div>

          {activity.evalMethod === 'enlace' && (
            <div className="text-left">
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300 flex items-center gap-2"><LinkIcon size={16} /> {language === 'es' ? 'Enlace de la entrega' : 'Submission link'}</label>
              <input value={submissionLink} onChange={e => setSubmissionLink(e.target.value)} type="url" className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow" placeholder="https://mi-proyecto.com" />
            </div>
          )}

          {(activity.eval_method === 'archivo' || activity.evalMethod === 'archivo' || ((activity.eval_method === 'cuestionario' || activity.evalMethod === 'cuestionario') && (activity.author_id || activity.authorId) !== profile.id)) && (
            <div className="flex flex-col gap-6 text-left">
              <div>
                <label className="block text-xs font-black uppercase text-gray-500 mb-3 tracking-widest flex items-center gap-2">
                  <FileText size={16} className="text-indigo-500" /> 
                  {language === 'es' ? 'Contenido del Trabajo' : 'Work Content'}
                </label>
                <DocumentEditor 
                  value={submissionHtml} 
                  onChange={setSubmissionHtml} 
                  placeholder={language === 'es' ? 'Redacta tu tarea aquí...' : 'Write your assignment here...'}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black uppercase text-gray-500 mb-3 tracking-widest flex items-center gap-2">
                    <Paperclip size={16} className="text-indigo-500" />
                    {language === 'es' ? 'Archivos Adjuntos' : 'Attachments'}
                  </label>
                  <FileUploader 
                    files={submissionAttachments}
                    onUploadComplete={(file) => setSubmissionAttachments(prev => [...prev, file])}
                    onRemoveFile={(url) => setSubmissionAttachments(prev => prev.filter(f => f.url !== url))}
                    onStatusChange={setIsFileUploading}
                    language={language}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-gray-500 mb-3 tracking-widest flex items-center gap-2">
                    <MessageSquare size={16} className="text-indigo-500" />
                    {language === 'es' ? 'Comentario Opcional' : 'Optional Comment'}
                  </label>
                  <textarea 
                    value={submissionComment} 
                    onChange={e => setSubmissionComment(e.target.value)} 
                    className="w-full h-[150px] px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-sans text-sm transition-shadow" 
                    placeholder={language === 'es' ? "Escribe un comentario para el profesor..." : "Write a comment for the teacher..."} 
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => handleSubmitWork(activity.id)}
            disabled={isSubmitting || isFileUploading || ((activity.eval_method || activity.evalMethod) === 'enlace' ? !submissionLink.trim() : (!submissionHtml.trim() && submissionAttachments.length === 0))}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition transform active:scale-95 disabled:opacity-50 uppercase tracking-widest text-base mt-4"
          >
            {mySub
              ? (language === 'es' ? 'Actualizar mi trabajo' : 'Update My Work')
              : (language === 'es' ? 'Enviar mi trabajo' : 'Submit My Work')
            }
          </button>

          {mySub && (
            <CommentsSection 
              parentId={mySub.id}
              parentType="submission"
              profile={profile}
              comments={comments || []}
              showToast={showToast}
            />
          )}
        </div>
      </div>
    </div>
  );
}
