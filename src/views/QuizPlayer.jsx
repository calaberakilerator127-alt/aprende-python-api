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

         if (error) throw error;

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
         <div className="fixed inset-0 bg-gray-50 dark:bg-slate-900 z-[210] flex flex-col items-center justify-center p-6 animate-scale-in">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl text-center border-4 border-indigo-500/20">
               <div className="w-24 h-24 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-500/30">
                  <ClipboardCheck size={48} />
               </div>
               <h2 className="text-4xl font-black mb-4 text-gray-900 dark:text-white">Resumen Final</h2>
               <p className="text-gray-500 dark:text-gray-500 mb-10 text-lg">Has completado tu revisión. Asegúrate de que todas tus respuestas sean las correctas antes de realizar el envío definitivo.</p>

               <div className="grid grid-cols-2 gap-6 mb-10">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/50">
                     <p className="text-3xl font-black text-indigo-600">{answeredCount}</p>
                     <p className="text-xs font-bold uppercase tracking-widest text-indigo-400">Respondidas</p>
                  </div>
                  <div className={`p-6 rounded-3xl border ${missingCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-600' : 'bg-green-50 dark:bg-green-900/20 border-green-200 text-green-600'}`}>
                     <p className="text-3xl font-black">{missingCount}</p>
                     <p className="text-xs font-bold uppercase tracking-widest opacity-70">Pendientes</p>
                  </div>
               </div>

               {missingCount > 0 && (
                  <div className="flex items-center gap-3 bg-amber-100 text-amber-700 px-6 py-4 rounded-2xl mb-8 border border-amber-200 text-sm font-bold">
                     <AlertTriangle size={20} />
                     <span>Atención: Tienes {missingCount} pregunta(s) sin responder.</span>
                  </div>
               )}

               <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => setShowSummary(false)} className="flex-1 py-4 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 font-bold rounded-2xl hover:bg-gray-200 transition text-lg flex items-center justify-center gap-2">
                     <ArrowLeft size={20} /> Volver al Examen
                  </button>
                  <button onClick={() => handleSubmitQuiz(false)} className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition text-lg flex items-center justify-center gap-2 transform hover:-translate-y-1">
                     <Send size={20} /> Enviar Respuestas
                  </button>
               </div>
            </div>
         </div>
      );
   }

   return (
      <div className="fixed inset-0 bg-gray-50 dark:bg-slate-900 z-[200] flex flex-col animate-fade-in overflow-hidden">
         {/* Header Info */}
         <div className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 p-4 md:p-6 shadow-sm z-10">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black shadow-lg transform -rotate-6">
                     {currentQuestionIndex + 1}
                  </div>
                  <div>
                     <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[200px] md:max-w-md">{quiz.title}</h2>
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-0.5">Pregunta {currentQuestionIndex + 1} de {quiz.questions.length}</p>
                  </div>
               </div>

               <div className="flex items-center gap-4 md:gap-8">
                  <div className={`flex items-center gap-3 px-6 py-2 rounded-2xl border-2 font-black text-xl transition-all ${timeLeft !== null && timeLeft < 60 ? 'bg-red-50 text-red-500 border-red-200 animate-pulse' : 'bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-gray-200 border-transparent'}`}>
                     <Clock size={20} className={timeLeft !== null && timeLeft < 60 ? 'text-red-500' : 'text-indigo-500'} />
                     {formatTime(timeLeft)}
                  </div>
                  <button
                     onClick={() => setShowSummary(true)}
                     className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition shadow-xl shadow-indigo-500/20"
                  >Finalizar</button>
               </div>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/20 via-transparent to-transparent">
            <div className="max-w-3xl mx-auto space-y-10">
               {/* Question Container */}
               <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 md:p-14 shadow-2xl border-b-8 border-indigo-600 dark:border-indigo-500 relative transition-all">
                  <div className="flex justify-between items-start mb-10">
                     <div className="space-y-2">
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-black text-indigo-500 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 rounded">Enunciado</span>
                           {currentQuestion.required && <span className="text-xs font-black text-red-500 uppercase tracking-widest px-2 py-0.5 bg-red-50 dark:bg-red-900/30 rounded">Obligatorio</span>}
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 leading-tight">{currentQuestion.text}</h3>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-2xl text-xs font-black shadow-sm">
                           {currentQuestion.points} {currentQuestion.points === 1 ? 'Punto' : 'Puntos'}
                        </span>
                     </div>
                  </div>

                  <div className="space-y-4">
                     {currentQuestion.type === 'multiple' ? (
                        <div className="grid grid-cols-1 gap-4">
                           {currentQuestion.options.map((opt, i) => (
                              <button
                                 key={i}
                                 onClick={() => handleAnswer(i)}
                                 className={`flex items-center gap-5 p-6 rounded-[1.5rem] border-2 text-left transition-all transform active:scale-[0.98] ${answers[currentQuestion.id] === i
                                       ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 ring-8 ring-indigo-500/5'
                                       : 'border-gray-50 dark:border-slate-700/50 hover:border-indigo-100 dark:hover:border-slate-600 bg-gray-50 dark:bg-slate-900/40'
                                    }`}
                              >
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm transition-colors ${answers[currentQuestion.id] === i ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-700 text-gray-500 border border-gray-200 dark:border-slate-600'
                                    }`}>
                                    {String.fromCharCode(65 + i)}
                                 </div>
                                 <span className={`text-base md:text-lg font-bold transition-colors ${answers[currentQuestion.id] === i ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-600 dark:text-gray-500'}`}>{opt}</span>
                              </button>
                           ))}
                        </div>
                     ) : (
                        <div className="relative group">
                           <textarea
                              value={answers[currentQuestion.id] || ''}
                              onChange={e => handleAnswer(e.target.value)}
                              className="w-full h-80 p-8 rounded-[2rem] border-2 border-gray-100 dark:border-slate-700 dark:bg-slate-900/50 outline-none focus:border-indigo-500 text-lg transition-all shadow-inner font-medium leading-relaxed"
                              placeholder="Escribe tu respuesta detallada aquí..."
                           />
                           <div className="absolute top-4 right-4 text-gray-400 dark:text-slate-700 group-focus-within:text-indigo-400 transition-colors">
                              <Save size={24} />
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
