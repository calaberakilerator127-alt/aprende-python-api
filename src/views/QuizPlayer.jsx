import React, { useState, useEffect, useRef } from 'react';
import { ClipboardCheck, AlertTriangle, ArrowLeft, ArrowRight, List, Shield, Save, Send, Clock } from 'lucide-react';
import api from '../config/api';

/**
 * QuizPlayer: Reproductor de cuestionarios y evaluaciones.
 * Migrado de Firebase a Supabase para el registro de entregas.
 */
export default function QuizPlayer({ quiz, profile, onFinish, showToast }) {
   const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
   const [answers, setAnswers] = useState({}); // { questionId: value }
   const [timeLeft, setTimeLeft] = useState(quiz.timeLimit ? quiz.timeLimit * 60 : null);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [quizStartedAt] = useState(Date.now());
   const [showSummary, setShowSummary] = useState(false);
   const timerRef = useRef(null);

   // Ref para acceder siempre a la función de envío más reciente sin reiniciar el intervalo
   const handleSubmitRef = useRef(null);
   useEffect(() => {
      handleSubmitRef.current = handleSubmitQuiz;
   });

   useEffect(() => {
      if (timeLeft === null || timeLeft <= 0) return;

      timerRef.current = setInterval(() => {
         setTimeLeft(prev => {
            if (prev <= 1) {
               clearInterval(timerRef.current);
               if (handleSubmitRef.current) handleSubmitRef.current(true);
               return 0;
            }
            return prev - 1;
         });
      }, 1000);

      return () => clearInterval(timerRef.current);
   }, []);

   const formatTime = (seconds) => {
      if (seconds === null) return "Sin límite";
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
   };

   const currentQuestion = quiz.questions[currentQuestionIndex];

   const handleAnswer = (val) => {
      setAnswers({ ...answers, [currentQuestion.id]: val });
   };

   const calculateAutoGrade = () => {
      let score = 0;
      quiz.questions.forEach(q => {
         if (q.type === 'multiple' && answers[q.id] === q.correct) {
            score += q.points || 1;
         }
      });
      return score;
   };

   const handleSubmitQuiz = async (isAuto = false) => {
      if (isSubmitting) return;
      if (!isAuto && !window.confirm('¿Deseas finalizar y enviar tu evaluación ahora?')) return;

      setIsSubmitting(true);
      try {
         const autoGrade = calculateAutoGrade();
         const needsReview = quiz.questions.some(q => q.type === 'open');

         await api.post('/data/submissions', {
            activity_id: quiz.id,
            student_id: profile.id,
            student_name: profile.name,
            answers: answers,
            auto_grade: autoGrade,
            grade: needsReview ? null : autoGrade,
            status: needsReview ? 'entregado' : 'calificado',
            submitted_at: Date.now(),
            started_at: quizStartedAt,
            duration: Math.floor((Date.now() - quizStartedAt) / 1000),
            is_auto_submitted: isAuto,
            type: 'quiz'
         });

         showToast(isAuto ? 'Tiempo agotado. Examen enviado automáticamente.' : 'Evaluación enviada con éxito.');
         onFinish();
      } catch (e) {
         console.error(e);
         showToast('Error al enviar el examen', 'error');
         setIsSubmitting(false);
      }
   };

   if (showSummary) {
      const answeredCount = Object.keys(answers).length;
      const totalCount = quiz.questions.length;
      const missingCount = totalCount - answeredCount;

      return (
         <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[210] flex flex-col items-center justify-center p-6 animate-scale-in">
            <div className="aura-card w-full max-w-2xl p-10 shadow-3xl text-center border-none bg-white dark:bg-slate-900 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 aura-gradient-primary opacity-5 rounded-full -mr-16 -mt-16"></div>
               <div className="w-24 h-24 aura-gradient-primary text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl">
                  <ClipboardCheck size={48} />
               </div>
               <h2 className="text-4xl font-black mb-4 text-slate-900 dark:text-white uppercase tracking-tighter italic">Resumen Final</h2>
               <p className="text-slate-500 dark:text-slate-400 mb-10 text-sm font-black uppercase tracking-[0.2em]">Verifica tus respuestas antes del envío definitivo.</p>

               <div className="grid grid-cols-2 gap-6 mb-10">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-inner">
                     <p className="text-4xl font-black text-indigo-600 italic leading-none mb-2">{answeredCount}</p>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Respondidas</p>
                  </div>
                  <div className={`p-8 rounded-[2.5rem] border-2 shadow-inner transition-all ${missingCount > 0 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'}`}>
                     <p className={`text-4xl font-black italic leading-none mb-2 ${missingCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{missingCount}</p>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Pendientes</p>
                  </div>
               </div>

               {missingCount > 0 && (
                  <div className="flex items-center gap-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-8 py-5 rounded-3xl mb-10 border-2 border-amber-100 dark:border-amber-900/50 text-[10px] font-black uppercase tracking-widest">
                     <AlertTriangle size={20} />
                     <span>Atención: Tienes {missingCount} pregunta(s) abiertas.</span>
                  </div>
               )}

               <div className="flex flex-col sm:flex-row gap-6">
                  <button onClick={() => setShowSummary(false)} className="group flex-1 py-6 bg-slate-50 dark:bg-slate-800 text-slate-500 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 active:scale-95 border-2 border-slate-100 dark:border-slate-800">
                     <ArrowLeft size={16} /> Volver
                  </button>
                  <button onClick={() => handleSubmitQuiz(false)} className="flex-1 py-6 aura-gradient-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
                     <Send size={16} /> Finalizar
                  </button>
               </div>
            </div>
         </div>
      );
   }

   return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[200] flex flex-col animate-fade-in overflow-hidden font-sans">
         {/* Header Info */}
         <div className="bg-white dark:bg-slate-900 border-b-4 border-slate-100 dark:border-slate-800 p-4 md:p-6 shadow-sm z-10">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 aura-gradient-primary text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-2xl transform rotate-3 hover:rotate-0 transition-transform cursor-default">
                     {currentQuestionIndex + 1}
                  </div>
                  <div>
                     <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tighter italic italic">{quiz.title}</h2>
                     <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] mt-1">Nivel {currentQuestionIndex + 1} de {quiz.questions.length}</p>
                  </div>
               </div>

               <div className="flex items-center gap-6">
                  <div className={`group flex items-center gap-4 px-8 py-4 rounded-3xl border-2 transition-all duration-500 shadow-inner ${timeLeft !== null && timeLeft < 60 ? 'bg-rose-50 text-rose-500 border-rose-200 animate-pulse' : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-transparent'}`}>
                     <Clock size={24} className={`transition-colors ${timeLeft !== null && timeLeft < 60 ? 'text-rose-500' : 'text-indigo-500'}`} />
                     <span className="text-2xl font-black tabular-nums">{formatTime(timeLeft)}</span>
                  </div>
                  <button
                     onClick={() => setShowSummary(true)}
                     className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-10 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-3xl shadow-slate-500/20"
                  >Finalizar</button>
               </div>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 md:p-12 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/10 via-transparent to-transparent">
            <div className="max-w-4xl mx-auto space-y-12">
               {/* Question Container */}
               <div className="aura-card bg-white dark:bg-slate-900 p-8 md:p-16 shadow-3xl border-none relative transition-all group overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 aura-gradient-primary opacity-[0.03] rounded-full -mr-32 -mt-32"></div>
                  
                  <div className="flex justify-between items-start mb-12 relative z-10">
                     <div className="space-y-4">
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 rounded-full border border-indigo-100/50 dark:border-indigo-900/50">Enunciado</span>
                           {currentQuestion.required && <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.3em] px-3 py-1 bg-rose-50 dark:bg-rose-900/30 rounded-full border border-rose-100/50 dark:border-rose-900/50">Mandatorio</span>}
                        </div>
                        <h3 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-[1.1] tracking-tighter">{currentQuestion.text}</h3>
                     </div>
                     <div className="flex flex-col items-end">
                        <span className="aura-gradient-primary text-white px-6 py-3 rounded-[1.5rem] text-xs font-black shadow-xl shadow-indigo-500/20 uppercase tracking-widest">
                           +{currentQuestion.points}
                        </span>
                     </div>
                  </div>

                  <div className="space-y-6 relative z-10">
                     {currentQuestion.type === 'multiple' ? (
                        <div className="grid grid-cols-1 gap-6">
                           {currentQuestion.options.map((opt, i) => (
                              <button
                                 key={i}
                                 onClick={() => handleAnswer(i)}
                                 className={`group/opt flex items-center gap-6 p-8 rounded-[2rem] border-2 text-left transition-all transform active:scale-[0.98] ${answers[currentQuestion.id] === i
                                       ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-900/20 shadow-xl'
                                       : 'border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:border-indigo-200 dark:hover:border-slate-700'
                                    }`}
                              >
                                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg transition-all duration-500 ${answers[currentQuestion.id] === i ? 'aura-gradient-primary text-white shadow-lg' : 'bg-white dark:bg-slate-800 text-slate-400 group-hover/opt:scale-110 shadow-inner'
                                    }`}>
                                    {String.fromCharCode(65 + i)}
                                 </div>
                                 <span className={`text-xl font-black transition-colors ${answers[currentQuestion.id] === i ? 'text-slate-900 dark:text-white' : 'text-slate-500 group-hover/opt:text-slate-700 dark:group-hover/opt:text-slate-300'}`}>{opt}</span>
                              </button>
                           ))}
                        </div>
                     ) : (
                        <div className="relative group">
                           <textarea
                              value={answers[currentQuestion.id] || ''}
                              onChange={e => handleAnswer(e.target.value)}
                              className="w-full h-96 p-10 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 dark:bg-slate-950/50 outline-none focus:border-indigo-500 text-xl font-medium transition-all shadow-inner placeholder:text-slate-300 dark:placeholder:text-slate-700"
                              placeholder="Describe tu solución con precisión técnica..."
                           />
                           <div className="absolute top-6 right-6 text-slate-300 dark:text-slate-800 group-focus-within:text-indigo-400 transition-colors">
                              <Save size={28} />
                           </div>
                        </div>
                     )}
                  </div>
               </div>

               <div className="flex justify-between items-center gap-6">
                  <button
                     disabled={currentQuestionIndex === 0}
                     onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                     className="flex items-center gap-2 px-8 py-4 text-gray-500 font-bold hover:bg-gray-200 dark:hover:bg-slate-800 rounded-2xl transition disabled:opacity-20"
                  >
                     <ArrowLeft size={20} /> <span className="hidden sm:inline">Anterior</span>
                  </button>

                  <div className="flex gap-2">
                     {quiz.questions.map((_, idx) => (
                        <button
                           key={idx}
                           onClick={() => setCurrentQuestionIndex(idx)}
                           className={`w-3 h-3 rounded-full transition-all duration-300 ${idx === currentQuestionIndex ? 'bg-indigo-600 ring-4 ring-indigo-500/20 w-8' : answers[quiz.questions[idx].id] !== undefined ? 'bg-green-500' : 'bg-gray-200 dark:bg-slate-700 hover:bg-gray-300'}`}
                        ></button>
                     ))}
                  </div>

                  {currentQuestionIndex < quiz.questions.length - 1 ? (
                     <button
                        onClick={() => {
                           if (currentQuestion.required && answers[currentQuestion.id] === undefined && currentQuestion.type === 'multiple') {
                              showToast('Esta pregunta es obligatoria', 'warning');
                           }
                           setCurrentQuestionIndex(prev => prev + 1);
                        }}
                        className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-2xl transition shadow-xl shadow-indigo-500/20 transform hover:-translate-y-1"
                     >
                        <span className="hidden sm:inline">Siguiente</span> <ArrowRight size={20} />
                     </button>
                  ) : (
                     <button
                        onClick={() => setShowSummary(true)}
                        className="flex items-center gap-2 px-8 py-4 bg-green-600 text-white font-bold hover:bg-green-700 rounded-2xl transition shadow-xl shadow-green-500/20 transform hover:-translate-y-1"
                     >
                        <List size={20} /> <span className="hidden sm:inline">Revisar y Terminar</span>
                     </button>
                  )}
               </div>
            </div>
         </div>

         <div className="bg-white dark:bg-slate-800 border-t dark:border-slate-700 p-4 text-center">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center justify-center gap-2">
               <Shield size={12} className="text-green-500" /> Tu progreso se guarda automáticamente. Puedes usar los botones inferiores para navegar.
            </p>
         </div>

         {isSubmitting && (
            <div className="fixed inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[300] flex-col gap-6">
               <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
               <p className="text-2xl font-black text-indigo-600 animate-pulse uppercase tracking-widest">Enviando Evaluación...</p>
            </div>
         )}
      </div>
   );
}
