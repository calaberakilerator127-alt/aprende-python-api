import React, { useState, useEffect, useRef } from 'react';
import { Play, Copy, RotateCcw, Terminal, Code2, Sparkles, Loader2, AlertCircle, Cpu, Zap, Share2, Info, XCircle, Save, FolderOpen, Download, Upload, Trash2, Edit2, ChevronRight, TerminalSquare } from 'lucide-react';
import { useSettings } from '../../hooks/SettingsContext';
import api from '../../config/api';
import ShareModal from './ShareModal';

// --- Syntax Highlighting Engine (Aura Theme) ---
const highlightPython = (code) => {
  if (!code) return '';
  
  const rules = [
    { type: 'comment', regex: /#.*$/gm },
    { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g },
    { type: 'keyword', regex: /\b(def|class|if|else|elif|for|while|try|except|finally|import|from|as|return|yield|pass|break|continue|in|is|not|and|or|with|lambda|global|nonlocal|async|await|assert|del|raise)\b/g },
    { type: 'builtin', regex: /\b(print|input|len|range|enumerate|zip|map|filter|int|str|float|bool|list|dict|set|tuple|min|max|sum|abs|round|sorted|any|all|getattr|setattr|hasattr|type|id|dir|vars|super|isinstance)\b/g },
    { type: 'number', regex: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g },
    { type: 'operator', regex: /[\+\-\*\/\%\|\&\^\~\!\=\>\<]=?|[\/\*]{2}=?/g },
    { type: 'brace', regex: /[\(\)\[\]\{\}]/g },
  ];

  let tokens = [{ content: code, type: 'plain' }];
  rules.forEach(rule => {
    let newTokens = [];
    tokens.forEach(token => {
      if (token.type !== 'plain') { newTokens.push(token); return; }
      let lastIndex = 0; let match;
      rule.regex.lastIndex = 0;
      while ((match = rule.regex.exec(token.content)) !== null) {
        if (match.index > lastIndex) newTokens.push({ content: token.content.substring(lastIndex, match.index), type: 'plain' });
        newTokens.push({ content: match[0], type: rule.type });
        lastIndex = match.index + match[0].length;
        if (!rule.regex.global) break;
      }
      if (lastIndex < token.content.length) newTokens.push({ content: token.content.substring(lastIndex), type: 'plain' });
    });
    tokens = newTokens;
  });

  return tokens.map(t => {
    const escaped = t.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return t.type === 'plain' ? escaped : `<span class="token-${t.type}">${escaped}</span>`;
  }).join('');
};

const checkPythonErrors = (code) => {
  const lines = code.split('\n');
  const errors = [];
  const stack = [];
  const openers = { '(': ')', '[': ']', '{': '}' };
  const closers = { ')': '(', ']': '[', '}': '{' };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const lineNum = i + 1;
    const controlKeywords = ['def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with'];
    for (const kw of controlKeywords) {
      if (trimmed.startsWith(kw + ' ') || trimmed === kw || (kw === 'else' && trimmed.startsWith('else:')) || (kw === 'finally' && trimmed.startsWith('finally:'))) {
        if (!trimmed.endsWith(':') && !trimmed.includes('#')) {
          errors.push({ line: lineNum, col: line.length, message: `Falta ':' al final de la sentencia '${kw}'`, type: 'syntax' });
        }
        break;
      }
    }
    if (trimmed.startsWith('print ') && !trimmed.startsWith('print(') && !trimmed.endsWith(')')) {
      errors.push({ line: lineNum, col: 1, message: "Python 3 requiere paréntesis en 'print()'", type: 'syntax', suggestion: 'print("tu mensaje")' });
    }
    for (let charIndex = 0; charIndex < line.length; charIndex++) {
      const char = line[charIndex];
      if (openers[char]) stack.push({ char, line: lineNum, col: charIndex + 1 });
      else if (closers[char]) {
        if (stack.length === 0 || stack[stack.length - 1].char !== closers[char]) errors.push({ line: lineNum, col: charIndex + 1, message: `Cierre inesperado: '${char}'`, type: 'brace' });
        else stack.pop();
      }
    }
    if (line.startsWith('\t') && line.includes('    ')) errors.push({ line: lineNum, col: 1, message: "Indentación inconsistente: evita mezclar Tabs y Espacios", type: 'indent' });
  });
  stack.forEach(unclosed => errors.push({ line: unclosed.line, col: unclosed.col, message: `Sin cerrar: '${unclosed.char}'`, type: 'brace' }));
  return errors;
};

export default function CodeWorkspace({ profile, showToast, savedCodes, fetchFullRecord }) {
  const { language } = useSettings();
  const initialCode = 'def saludar(nombre):\n    return f"Hola, {nombre}! Bienvenido a CodeLab"\n\nprint(saludar("' + (profile?.name || "Dev") + '"))';
  
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isPyodideReady, setIsPyodideReady] = useState(false);
  const [errorHeader, setErrorHeader] = useState(null);
  const [errors, setErrors] = useState([]);
  
  // Persistence state
  const [currentCodeId, setCurrentCodeId] = useState(null);
  const [codeName, setCodeName] = useState('main.py');
  
  // Share Modal State
  const [shareItem, setShareItem] = useState(null);
  
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const pyodideRef = useRef(null);
  const fileInputRef = useRef(null);
  const terminalBottomRef = useRef(null);

  const lineCount = code.split('\n').length;

  useEffect(() => {
    setErrors(checkPythonErrors(code));
  }, [code]);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  const handleRunCode = async () => {
    setIsRunning(true);
    let py = pyodideRef.current;
    
    if (!py) {
      setOutput(language === 'es' ? 'Localizando entorno Python local...\n' : 'Locating local Python env...\n');
      try {
        if (!window.loadPyodide) {
          await new Promise((resolve, reject) => {
             const script = document.createElement('script');
             script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
             script.onload = resolve;
             script.onerror = () => {
                setErrorHeader("Error de red cargando motor.");
                reject(new Error("Failed to load script"));
             };
             document.body.appendChild(script);
          });
        }
        if (window.pyodideInstance) {
          py = window.pyodideInstance;
        } else {
          py = await window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/" });
          window.pyodideInstance = py;
        }
        py.setStdout({ batched: (text) => setOutput(prev => prev + text + '\n') });
        pyodideRef.current = py;
        setIsPyodideReady(true);
      } catch (err) {
        setErrorHeader("Error al inicializar Python.");
        setIsRunning(false);
        return;
      }
    }
    
    setOutput(prev => prev + '\n>>> [STARTING MISSION] ' + codeName + '...\n');
    try {
      await py.runPythonAsync(code);
      setOutput(prev => prev + '\n>>> [MISSION SUCCESS] Exited cleanly.');
    } catch (err) {
      const match = /File "<exec>", line (\d+)/.exec(err.message);
      const lineText = match ? `(Line ${match[1]}) ` : '';
      setOutput(prev => prev + `\n❌ [MISSION FAILURE] ERROR ${lineText}:\n` + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e) => {
    const { key, shiftKey, target } = e;
    const { selectionStart, selectionEnd, value } = target;

    if (key === 'Tab') {
      e.preventDefault();
      const tabSize = 4;
      const spaces = ' '.repeat(tabSize);

      if (!shiftKey) {
        const newValue = value.substring(0, selectionStart) + spaces + value.substring(selectionEnd);
        setCode(newValue);
        setTimeout(() => target.selectionStart = target.selectionEnd = selectionStart + tabSize, 0);
      } else {
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const currentLine = value.substring(lineStart, selectionStart);
        if (currentLine.startsWith(spaces)) {
          const newValue = value.substring(0, lineStart) + value.substring(lineStart + tabSize);
          setCode(newValue);
          setTimeout(() => target.selectionStart = target.selectionEnd = Math.max(lineStart, selectionStart - tabSize), 0);
        }
      }
    }

    if (key === 'Enter') {
      e.preventDefault();
      const beforeCursor = value.substring(0, selectionStart);
      const lines = beforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];
      const match = currentLine.match(/^\s*/);
      let indent = match ? match[0] : '';
      if (currentLine.trim().endsWith(':')) indent += '    ';
      const newValue = value.substring(0, selectionStart) + '\n' + indent + value.substring(selectionEnd);
      setCode(newValue);
      setTimeout(() => target.selectionStart = target.selectionEnd = selectionStart + 1 + indent.length, 0);
    }
  };

  const handleScroll = (e) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = e.target.scrollTop;
      highlightRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // --- PERSISTENCE ---
  const handleSaveCode = async () => {
    if (!code.trim()) {
        showToast("Código vacío", 'error'); return;
    }
    
    let nameToSave = codeName;
    if (nameToSave === 'main.py' && !currentCodeId) {
       nameToSave = prompt("Asigna un nombre a tu código:", "mi_script.py");
       if (!nameToSave) return;
       if (!nameToSave.endsWith('.py')) nameToSave += '.py';
       setCodeName(nameToSave);
    }

    try {
      const codeData = {
         code: code,
         title: nameToSave,
         updated_at: new Date().toISOString()
      };

      if (currentCodeId) {
        await api.put(`/data/saved_codes/${currentCodeId}`, codeData);
        showToast('Código actualizado');
      } else {
        const { data } = await api.post('/data/saved_codes', {
           ...codeData,
           created_at: new Date().toISOString(),
           author_id: profile.id,
           author_name: profile.name
        });
        
        setCurrentCodeId(data.id);
        showToast('Nuevo código guardado');
      }
    } catch(e) {
      console.error(e);
      showToast('Error al guardar', 'error');
    }
  };

  const handleDeleteCode = async (id) => {
    if (!window.confirm("¿Seguro de eliminar este código?")) return;
    try {
      await api.delete(`/data/saved_codes/${id}`);
      
      if (currentCodeId === id) {
          setCurrentCodeId(null);
          setCodeName('main.py');
          setCode('');
      }
      showToast("Código eliminado");
    } catch(e) { 
      console.error(e);
      showToast("Error al eliminar", "error");
    }
  };

  const handleLoadSavedCode = async (item) => {
      let targetItem = item;
      if (!item.code && fetchFullRecord) {
        const full = await fetchFullRecord('saved_codes', item.id);
        if (full) targetItem = full;
      }
      
      setCode(targetItem.code || '');
      setCodeName(targetItem.title || 'script.py');
      setCurrentCodeId(targetItem.id);
      showToast(`Cargado: ${targetItem.title}`);
  };

  const handleDownloadCode = () => {
      const element = document.createElement("a");
      const file = new Blob([code], {type: 'text/plain'});
      element.href = URL.createObjectURL(file);
      element.download = codeName || 'script.py';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
  };

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          setCode(evt.target.result);
          setCodeName(file.name);
          setCurrentCodeId(null);
          showToast("Archivo cargado con éxito");
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
      <style>{`
        .editor-container { position: relative; font-family: 'JetBrains Mono', 'Fira Code', monospace; background: #0b0f1a; }
        .editor-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 40px; margin: 0; font-size: 15px; line-height: 26px; white-space: pre; overflow: auto; box-sizing: border-box; border: none; outline: none; }
        .editor-textarea { color: transparent; caret-color: #6366f1; background: transparent; z-index: 10; resize: none; }
        .editor-highlight { z-index: 1; color: #475569; pointer-events: none; }
        .token-keyword { color: #c678dd; font-weight: bold; }
        .token-string { color: #98c379; }
        .token-builtin { color: #61afef; }
        .token-comment { color: #5c6370; font-style: italic; }
        .token-number { color: #d19a66; }
        .token-operator { color: #56b6c2; }
        .token-brace { color: #abb2bf; }
      `}</style>

      {/* COLUMNA IZQUIERDA: Lógica y Editor */}
      <div className="lg:col-span-3 space-y-8 min-w-0">
          <div className="aura-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
             <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-inner cursor-pointer hover:scale-105 transition-all" onClick={() => {
                     const name = prompt("Renombrar misión a:", codeName);
                     if (name) setCodeName(name);
                }}>
                   <Code2 size={24} />
                </div>
                <div>
                   <h2 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">{language === 'es' ? 'Archivo Activo' : 'Active File'}</h2>
                   <p className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-tighter">{codeName}</p>
                </div>
                {currentCodeId && <div className="ml-4 px-4 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">Sync Active</div>}
             </div>
             
             <div className="flex items-center gap-4">
                 <input type="file" accept=".py,.txt" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                 <div className="flex bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl shadow-inner border border-slate-100 dark:border-slate-800">
                    <button onClick={() => fileInputRef.current.click()} className="p-3 text-slate-400 hover:text-indigo-600 transition-all outline-none" data-tooltip="Ingresar Datos (Upload)"><Upload size={20} /></button>
                    <button onClick={handleDownloadCode} className="p-3 text-slate-400 hover:text-indigo-600 transition-all outline-none" data-tooltip="Extraer Datos (Download)"><Download size={20} /></button>
                    <button onClick={() => navigator.clipboard.writeText(code)} className="p-3 text-slate-400 hover:text-indigo-600 transition-all outline-none" data-tooltip="Duplicar (Copy)"><Copy size={20} /></button>
                 </div>
                 <button onClick={handleSaveCode} className="flex items-center gap-3 aura-gradient-primary text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/20 active:scale-95 transition-all outline-none">
                    <Save size={20} /> {language === 'es' ? 'Indexar' : 'Index'}
                 </button>
             </div>
          </div>

          <div className="aura-card p-0 rounded-[3rem] shadow-3xl overflow-hidden relative border-none bg-[#0b0f1a]">
            <div className="bg-[#1a1f2e] px-8 py-4 border-b border-white/5 flex justify-between items-center">
              <div className="flex gap-3">
                <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-pulse"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-amber-500"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500"></div>
              </div>
              <div className="flex items-center gap-6">
                 <button onClick={() => { setCode(''); setCurrentCodeId(null); setCodeName('main.py'); setOutput(''); }} className="p-2 text-white/20 hover:text-rose-500 transition-all outline-none"><Trash2 size={20} /></button>
                 <button onClick={handleRunCode} disabled={isRunning} className="flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-500/20 active:scale-95 disabled:opacity-50 outline-none">
                   {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} 
                   {language === 'es' ? 'Ejecutar' : 'Deploy'}
                 </button>
              </div>
            </div>
            
            <div className="flex editor-container h-[500px] overflow-hidden">
               <div className="bg-[#0b0f1a] text-slate-700 text-right py-10 font-mono text-sm select-none border-r border-white/5 min-w-[4rem] px-5 z-20">
                 {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
                     <div key={i} className={`h-[26px] leading-[26px] transition-colors ${errors.some(e => e.line === i + 1) ? 'text-rose-500 font-black bg-rose-500/10 rounded-lg px-2 shadow-sm' : ''}`}>{i + 1}</div>
                 ))}
               </div>
               <div className="relative flex-1 overflow-hidden">
                 <textarea ref={textareaRef} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={handleKeyDown} onScroll={handleScroll} spellCheck={false} autoCapitalize="off" autoComplete="off" className="editor-layer editor-textarea custom-scrollbar" />
                 <pre ref={highlightRef} className="editor-layer editor-highlight custom-scrollbar" dangerouslySetInnerHTML={{ __html: highlightPython(code) }} />
               </div>
            </div>
          </div>

          {errors.length > 0 && (
             <div className="aura-card p-6 border-none bg-rose-500/10 shadow-none ring-2 ring-rose-500/20">
                <div className="flex items-center gap-4 mb-4 text-rose-500">
                  <AlertCircle size={24} />
                  <h4 className="font-black text-xs uppercase tracking-[0.3em]">{language === 'es' ? 'Inconsistencias Detectadas' : 'Inconsistencies Detected'}</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 bg-white/5 dark:bg-rose-950/20 rounded-2xl border border-rose-500/20 backdrop-blur-md">
                      <span className="bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded-full mt-0.5 shadow-lg shadow-rose-500/20">L{err.line}</span>
                      <p className="text-sm font-bold text-rose-800 dark:text-rose-200 leading-tight">{err.message}</p>
                    </div>
                  ))}
                </div>
             </div>
          )}

          <div className="bg-[#0b0f1a] rounded-[3rem] p-8 border-4 border-slate-900 shadow-3xl min-h-[250px] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
              <TerminalSquare size={120} className="text-emerald-500" />
            </div>
            <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                  <Terminal size={24} />
                </div>
                <div>
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{language === 'es' ? 'Terminal de Salida' : 'Output Terminal'}</h3>
                   <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1">Status: Operational</p>
                </div>
              </div>
              <button onClick={() => setOutput('')} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all outline-none">Flush Console</button>
            </div>
            <pre className="font-mono text-sm text-emerald-400 whitespace-pre-wrap leading-loose custom-scrollbar max-h-[400px] overflow-y-auto w-full break-all selection:bg-emerald-500/30">
              {output || (isRunning ? 'Initializing operational environment...\n' : 'Waiting for deployment instructions...\n')}
              {isRunning && <span className="animate-pulse bg-emerald-400 w-3 h-5 inline-block ml-2 align-middle"></span>}
              <div ref={terminalBottomRef} />
            </pre>
          </div>
      </div>

      {/* COLUMNA DERECHA: Sidebar de Códigos Guardados */}
      <div className="space-y-8">
         <div className="aura-card p-8 rounded-[3rem] sticky top-24">
            <h3 className="font-black text-xl flex items-center gap-4 mb-8 text-slate-900 dark:text-white tracking-tighter uppercase">
              <FolderOpen className="text-indigo-600" size={28} /> 
              {language === 'es' ? 'Repositorio' : 'Repository'}
            </h3>
            
            {savedCodes.length === 0 ? (
               <div className="text-center p-10 bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-400 font-black uppercase tracking-widest leading-relaxed">No se han detectado registros en la nube.</p>
               </div>
            ) : (
               <div className="space-y-4 max-h-[650px] overflow-y-auto custom-scrollbar pr-3">
                 {savedCodes.map(item => (
                    <div key={item.id} className={`group relative flex flex-col p-6 rounded-[2rem] border-2 transition-all duration-300 cursor-pointer ${currentCodeId === item.id ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-600/10 shadow-xl shadow-indigo-500/10 scale-[1.02]' : 'border-slate-100 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/50 bg-white dark:bg-slate-800/50 hover:shadow-lg'}`} onClick={() => handleLoadSavedCode(item)}>
                       <div className="flex justify-between items-start mb-3">
                           <span className="font-black text-sm text-slate-800 dark:text-slate-100 uppercase tracking-tight truncate pr-8">{item.title}</span>
                           <ChevronRight size={16} className={`transition-transform duration-300 ${currentCodeId === item.id ? 'translate-x-1 text-indigo-600' : 'text-slate-300 group-hover:translate-x-1'}`} />
                       </div>
                       <div className="flex items-center justify-between">
                         <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{new Date(item.updated_at).toLocaleDateString()}</span>
                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all" onClick={(e) => { e.stopPropagation(); handleDeleteCode(item.id); }}><Trash2 size={16}/></button>
                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all" onClick={(e) => { 
                               e.stopPropagation(); 
                               setShareItem(item);
                            }}><Share2 size={16}/></button>
                         </div>
                       </div>
                    </div>
                 ))}
               </div>
            )}
            
            <button onClick={() => { setCode(''); setCurrentCodeId(null); setCodeName('new_module.py'); }} className="w-full mt-8 py-4 border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all flex items-center justify-center gap-3 active:scale-95 outline-none">
               <RotateCcw size={16} /> {language === 'es' ? 'Nuevo Proyecto' : 'New Project'}
            </button>
         </div>
      </div>
      
      {/* Share Modal */}
      <ShareModal 
         isOpen={!!shareItem} 
         onClose={() => setShareItem(null)} 
         item={shareItem} 
         type="code" 
         profile={profile} 
         showToast={showToast} 
      />
    </div>
  );
}
