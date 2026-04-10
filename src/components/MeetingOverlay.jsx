import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Maximize2, Minimize2, Video, Phone, Clock, CheckCircle, ExternalLink, ShieldCheck } from 'lucide-react';
import { supabase } from '../config/supabase';
import { useSettings } from '../hooks/SettingsContext';

/**
 * MeetingOverlay: Gestor de llamadas en vivo (Jitsi).
 * Migrado de Firebase a Supabase para el registro de finalización de eventos.
 */
export default function MeetingOverlay({ call, profile, onClose }) {
  const { language } = useSettings();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [finalDuration, setFinalDuration] = useState(null);
  const popupRef = useRef(null);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const t = {
    ended: language === 'es' ? 'Llamada finalizada' : 'Call ended',
    active: language === 'es' ? 'En llamada' : 'In call',
    total: language === 'es' ? 'duración total' : 'total duration',
    elapsed: language === 'es' ? 'transcurrido' : 'elapsed',
    success: language === 'es' ? 'Llamada registrada correctamente' : 'Call registered successfully',
    closing: language === 'es' ? 'Cerrando en un momento...' : 'Closing shortly...',
    open: language === 'es' ? 'Ver / Abrir Reunión' : 'View / Open Meeting',
    endBtn: language === 'es' ? 'Finalizar' : 'End Call'
  };

  const buildJitsiUrl = useCallback(() => {
    return `https://meet.jit.si/${call.roomName}`;
  }, [call.roomName]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleEndCall = useCallback(async (durationSec) => {
    if (isEnded) return;
    const now = Date.now();
    setIsEnded(true);
    setFinalDuration(durationSec ?? elapsed);
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);

    try {
      if (call.msgId) {
        // En Supabase actualizamos la columna metadata (JSONB)
        await supabase
          .from('messages')
          .update({ 
            metadata: { 
              ended_at: now,
              duration: durationSec ?? elapsed 
            } 
          })
          .eq('id', call.msgId);
      }
      
      if (call.eventId) {
        // Para eventos, usamos end_date (TIMESTAMPTZ espera ISO String o null)
        await supabase
          .from('events')
          .update({ 
            end_date: new Date(now).toISOString(), 
            status: 'finalizada' 
          })
          .eq('id', call.eventId);
      }
    } catch (e) {
      console.error('Error finalizando llamada:', e);
    }
    setTimeout(() => onClose(), 4000);
  }, [isEnded, elapsed, call, onClose]);

  const openMeeting = useCallback(() => {
    const w = 1100, h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(buildJitsiUrl(), `jitsi_${call.roomName}`, `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,toolbar=no,menubar=no,location=no`);
    popupRef.current = popup;
    return popup;
  }, [buildJitsiUrl, call.roomName]);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(sec => sec + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const startPolling = useCallback((popup) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!popup) return;
      if (popup.closed) {
        clearInterval(pollRef.current);
        setElapsed(prev => { handleEndCall(prev); return prev; });
        return;
      }
      try {
        const href = popup.location?.href || '';
        if (href && !href.includes(call.roomName)) {
          clearInterval(pollRef.current);
          popup.close();
          setElapsed(prev => { handleEndCall(prev); return prev; });
        }
      } catch (e) {}
    }, 500);
  }, [call.roomName, handleEndCall]);

  useEffect(() => {
    const popup = openMeeting();
    if (popup) startPolling(popup);
    return () => { clearInterval(pollRef.current); clearInterval(timerRef.current); };
  }, [openMeeting, startPolling]);

  const handleManualEnd = async () => {
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
    clearInterval(pollRef.current);
    await handleEndCall(elapsed);
  };

  return (
    <div className="fixed bottom-8 right-8 z-[200] animate-scale-in">
      <div className={`glass-card border shadow-2xl rounded-[2rem] overflow-hidden transition-all duration-500 ease-in-out ${
        isMinimized ? 'w-72 h-32' : 'w-80'
      } ${isEnded ? 'border-emerald-500/50' : 'border-indigo-500/30'}`}>
        
        {/* Decorative Header Bar */}
        <div className={`h-2 w-full ${isEnded ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-gradient-x'}`}></div>

        <div className="px-6 py-4 flex items-center justify-between bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-3">
             <div className={`relative ${isEnded ? 'text-emerald-500' : 'text-indigo-600 animate-pulse'}`}>
                {isEnded ? <ShieldCheck size={18} /> : <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.8)]"></div>}
             </div>
             <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isEnded ? t.ended : t.active} ${isEnded ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'}`}>
               {isEnded ? t.ended : t.active}
             </span>
          </div>
          <button onClick={() => setIsMinimized(v => !v)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm active:scale-95">
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
        </div>

        {!isMinimized && (
          <div className="p-6 pt-2 flex flex-col gap-5 animate-fade-in">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center shrink-0 shadow-lg border-2 ${isEnded ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-800' : 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800'}`}>
                {isEnded ? <CheckCircle size={28}/> : <Video size={28}/>}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-base font-black text-gray-900 dark:text-white truncate tracking-tight">{call.roomName.split('-').pop()}</p>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Jitsi Premium Engine</p>
              </div>
            </div>

            <div className={`flex items-center justify-between p-4 rounded-2xl border-2 ${isEnded ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/50' : 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-800 shadow-inner'}`}>
               <div className="flex items-center gap-2">
                 <Clock size={16} className={isEnded ? 'text-emerald-500' : 'text-indigo-500'} />
                 <span className="text-xl font-black font-mono tracking-tighter text-gray-800 dark:text-gray-100">
                    {formatTime(isEnded ? (finalDuration ?? elapsed) : elapsed)}
                 </span>
               </div>
               <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                 {isEnded ? t.total : t.elapsed}
               </span>
            </div>

            {isEnded ? (
              <div className="text-center py-2">
                <p className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest animate-fade-in">✅ {t.success}</p>
                <p className="text-gray-400 text-[9px] font-bold mt-1 italic">{t.closing}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (popupRef.current && !popupRef.current.closed) popupRef.current.focus();
                    else { const p = openMeeting(); if (p) startPolling(p); }
                  }}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 hover-spring active:scale-95"
                >
                  <ExternalLink size={16} /> {t.open}
                </button>
                <button
                  onClick={handleManualEnd}
                  className="w-full flex items-center justify-center gap-3 py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border-2 border-red-100 dark:border-red-900/30 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all active:scale-95"
                >
                  <Phone size={16} className="rotate-[135deg]" /> {t.endBtn}
                </button>
              </div>
            )}
          </div>
        )}
        
        {isMinimized && (
           <div className="px-6 py-2 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-3">
                 <div className="text-gray-800 dark:text-gray-100 font-mono font-black text-lg tracking-tighter">
                   {formatTime(isEnded ? (finalDuration ?? elapsed) : elapsed)}
                 </div>
                 <div className={`w-2 h-2 rounded-full ${isEnded ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
              </div>
              <div className="flex gap-2">
                {!isEnded && (
                  <button onClick={handleManualEnd} className="p-2 bg-red-500 text-white rounded-xl shadow-md"><Phone size={14} className="rotate-[135deg]" /></button>
                )}
              </div>
           </div>
        )}
      </div>
    </div>
  );
}
