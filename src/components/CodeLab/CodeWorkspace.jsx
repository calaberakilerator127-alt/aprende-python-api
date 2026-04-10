import React, { useState, useEffect, useRef } from 'react';
import { Play, Copy, RotateCcw, Terminal, Code2, Sparkles, Loader2, AlertCircle, Cpu, Zap, Share2, Info, XCircle, Save, FolderOpen, Download, Upload, Trash2, Edit2 } from 'lucide-react';
import { useSettings } from '../../hooks/SettingsContext';
import { supabase } from '../../config/supabase';
import ShareModal from './ShareModal';

// --- Syntax Highlighting Engine ---
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

  const lineCount = code.split('\n').length;

  useEffect(() => {
    setErrors(checkPythonErrors(code));
  }, [code]);

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
                setErrorHeader("Error de red cargando analizador motor.");
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
    
    setOutput(prev => prev + '\n>>> Run starting...\n');
    try {
      await py.runPythonAsync(code);
      setOutput(prev => prev + '\n>>> Exited cleanly.');
    } catch (err) {
      const match = /File "<exec>", line (\d+)/.exec(err.message);
      const lineText = match ? `(Line ${match[1]}) ` : '';
      setOutput(prev => prev + `\n❌ ERROR ${lineText}:\n` + err.message);
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
      if (currentCodeId) {
        const { error } = await supabase
          .from('saved_codes')
          .update({
             code: code,
             title: nameToSave,
             updated_at: new Date().toISOString()
          })
          .eq('id', currentCodeId);
          
        if (error) throw error;
        showToast('Código actualizado guardado');
      } else {
        const { data, error } = await supabase
          .from('saved_codes')
          .insert({
             code: code,
             title: nameToSave,
             created_at: new Date().toISOString(),
             updated_at: new Date().toISOString(),
             author_id: profile.id,
             author_name: profile.name
          })
          .select()
          .single();
          
        if (error) throw error;
        setCurrentCodeId(data.id);
        showToast('Nuevo código guardado correctamente');
      }
    } catch(e) {
      console.error(e);
      showToast('Error al guardar', 'error');
    }
  };

  const handleDeleteCode = async (id) => {
    if (!window.confirm("¿Seguro de eliminar este código?")) return;
    try {
      const { error } = await supabase.from('saved_codes').delete().eq('id', id);
      if (error) throw error;
      
      if (currentCodeId === id) {
          setCurrentCodeId(null);
          setCodeName('main.py');
          setCode('');
      }
      showToast("Código eliminado", "success");
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

  // --- UPLOAD / DOWNLOAD ---
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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <style>{`
        .editor-container { position: relative; font-family: 'JetBrains Mono', 'Fira Code', monospace; background: #0f172a; }
        .editor-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 24px; margin: 0; font-size: 14px; line-height: 24px; white-space: pre; overflow: auto; box-sizing: border-box; border: none; outline: none; }
        .editor-textarea { color: transparent; caret-color: white; background: transparent; z-index: 10; resize: none; }
        .editor-highlight { z-index: 1; color: #94a3b8; pointer-events: none; }
        .token-keyword { color: #c678dd; font-weight: bold; }
        .token-string { color: #98c379; }
        .token-builtin { color: #61afef; }
        .token-comment { color: #5c6370; font-style: italic; }
        .token-number { color: #d19a66; }
        .token-operator { color: #56b6c2; }
        .token-brace { color: #abb2bf; }
      `}</style>

      {/* COLUMNA IZQUIERDA: Lógica y Editor */}
      <div className="lg:col-span-3 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm gap-4">
             <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 md:pb-0">
                <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-indigo-100 transition whitespace-nowrap" onClick={() => {
                     const name = prompt("Renombrar archivo a:", codeName);
                     if (name) setCodeName(name);
                }}>
                   <Code2 size={18} /> {codeName}
                </div>
                {currentCodeId && <div className="text-[10px] text-gray-400 uppercase font-black bg-gray-50 dark:bg-slate-900 px-2 py-1 rounded-md">Guardado en Nube</div>}
             </div>
             
             <div className="flex items-center gap-2">
                 <input type="file" accept=".py,.txt" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                 <button onClick={() => fileInputRef.current.click()} className="p-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl" data-tooltip="Cargar script local"><Upload size={18} /></button>
                 <button onClick={handleDownloadCode} className="p-2.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl" data-tooltip="Descargar archivo"><Download size={18} /></button>
                 <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 mx-2"></div>
                 <button onClick={handleSaveCode} className="flex items-center gap-2 bg-[#27c93f] hover:bg-[#20a834] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-green-500/20">
                    <Save size={18} /> {language === 'es' ? 'Guardar' : 'Save'}
                 </button>
             </div>
          </div>

          <div className="glass-card rounded-[2.5rem] shadow-2xl border border-gray-200 dark:border-slate-700/50 overflow-hidden relative">
            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
              </div>
              <div className="flex items-center gap-4">
                 <button onClick={() => { setCode(''); setCurrentCodeId(null); setCodeName('main.py'); setOutput(''); }} className="p-2 text-gray-400 hover:text-indigo-500 transition-all"><Trash2 size={16} /></button>
                 <button onClick={() => navigator.clipboard.writeText(code)} className="p-2 text-gray-400 hover:text-indigo-500 transition-all"><Copy size={16} /></button>
                 <button onClick={handleRunCode} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-colors"><Zap size={14} /> Ejecutar</button>
              </div>
            </div>
            
            <div className="flex editor-container h-[450px] overflow-hidden">
               <div className="bg-slate-900 text-gray-500 text-right py-6 font-mono text-sm select-none border-r border-slate-800 min-w-[3.5rem] px-3 z-20">
                 {Array.from({ length: Math.max(lineCount, 1) }).map((_, i) => (
                     <div key={i} className={`h-6 leading-6 ${errors.some(e => e.line === i + 1) ? 'text-red-500 font-bold bg-red-500/10 rounded-sm' : ''}`}>{i + 1}</div>
                 ))}
               </div>
               <div className="relative flex-1 overflow-hidden">
                 <textarea ref={textareaRef} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={handleKeyDown} onScroll={handleScroll} spellCheck={false} autoCapitalize="off" autoComplete="off" className="editor-layer editor-textarea custom-scrollbar" />
                 <pre ref={highlightRef} className="editor-layer editor-highlight custom-scrollbar" dangerouslySetInnerHTML={{ __html: highlightPython(code) }} />
               </div>
            </div>
          </div>

          {errors.length > 0 && (
             <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3 text-red-500"><XCircle size={18} /><h4 className="text-xs font-black uppercase tracking-widest">Errores Detectados</h4></div>
                <div className="space-y-2">
                  {errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-4 p-3 bg-red-500/10 rounded-xl border border-red-500/10"><span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5">L {err.line}</span><div><p className="text-sm font-bold text-red-800 dark:text-red-300 leading-tight">{err.message}</p></div></div>
                  ))}
                </div>
             </div>
          )}

          <div className="bg-[#0b0f1a] rounded-[2.5rem] p-6 border-4 border-slate-800 shadow-2xl min-h-[220px] relative">
            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
              <div className="flex items-center gap-3"><Terminal size={18} className="text-green-500" /><h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Terminal Output</h3></div>
              <button onClick={() => setOutput('')} className="text-[10px] bg-slate-800 px-3 py-1 rounded-md text-gray-400 hover:text-white uppercase tracking-widest">Limpiar</button>
            </div>
            <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap leading-relaxed custom-scrollbar max-h-[300px] overflow-y-auto w-full break-all">
              {output || (isRunning ? 'Iniciando entorno base...\n' : 'Presiona Ejecutar para visualizar salidas...\n')}
              {isRunning && <span className="animate-pulse bg-green-400 w-2.5 h-4 inline-block ml-1"></span>}
            </pre>
          </div>
      </div>

      {/* COLUMNA DERECHA: Sidebar de Códigos Guardados */}
      <div className="space-y-6">
         <div className="glass-card p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm sticky top-24">
            <h3 className="font-black text-lg flex items-center gap-3 mb-6 text-gray-900 dark:text-white"><FolderOpen className="text-indigo-600" size={24} /> Códigos Guardados</h3>
            
            {savedCodes.length === 0 ? (
               <div className="text-center p-6 bg-gray-50 dark:bg-slate-900 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700">
                  <p className="text-sm text-gray-400 font-medium">Aún no tienes scripts guardados en la nube.</p>
               </div>
            ) : (
               <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                 {savedCodes.map(item => (
                    <div key={item.id} className={`group relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer ${currentCodeId === item.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-500/10' : 'border-gray-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 bg-white dark:bg-slate-800/50'}`} onClick={() => handleLoadSavedCode(item)}>
                       <div className="flex justify-between items-start mb-2">
                           <span className="font-bold text-sm text-gray-800 dark:text-gray-200 truncate pr-6">{item.title}</span>
                       </div>
                       <span className="text-[10px] text-gray-400 uppercase tracking-widest">{new Date(item.updated_at).toLocaleDateString()}</span>
                       
                       <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 bg-white dark:bg-slate-800 p-1.5 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700">
                           <button className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); handleDeleteCode(item.id); }}><Trash2 size={14}/></button>
                           <button className="text-blue-500 hover:text-blue-700 p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10" onClick={(e) => { 
                              e.stopPropagation(); 
                              setShareItem(item);
                           }}><Share2 size={14}/></button>
                       </div>
                    </div>
                 ))}
               </div>
            )}
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
