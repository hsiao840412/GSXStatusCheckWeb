import React, { useState, useMemo, useCallback } from 'react';

// -------------------------------------------------------------------------
// 核心圖示 (內嵌 SVG)
// -------------------------------------------------------------------------
const Icons = {
  Sparkles: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
  ),
  File: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
  ),
  External: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
  ),
  Check: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
  ),
  Alert: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
  ),
  Download: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
  )
};

// -------------------------------------------------------------------------
// 固定常數定義
// -------------------------------------------------------------------------
const VERSION = "v1.1";

// 精簡後的固定狀態
const SA_READY_STATUS = ["抵達門市", "工程師完成"];
const SA_CLOSED_STATUS = ["顧客領回"];

/**
 * 強大的 CSV 行解析器，支援處理引號內的逗號
 */
const splitCsvLine = (line, delimiter) => {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result.map(s => s.replace(/^"|"$/g, '').trim());
};

const parseCSV = (text) => {
  if (!text) return { data: [], headers: [] };
  const lines = text.replace(/^\uFEFF/, "").replace(/\r/g, "").split("\n").filter(l => l.trim());
  if (!lines.length) return { data: [], headers: [] };

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map(h => h.replace(/[^\x20-\x7E\u4E00-\u9FFF]/g, ''));

  const data = lines.slice(1).map(line => {
    const vals = splitCsvLine(line, delimiter);
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = vals[i] || ""; });
    return obj;
  });
  return { data, headers };
};

const App = () => {
  const [saData, setSaData] = useState([]);
  const [gsxData, setGsxData] = useState([]);
  const [saHeaders, setSaHeaders] = useState([]);
  const [gsxHeaders, setGsxHeaders] = useState([]);
  const [saFileName, setSaFileName] = useState("");
  const [gsxFileName, setGsxFileName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("等待選擇檔案...");
  const [results, setResults] = useState({ unclosed: [], notReady: [], all: [] });
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedIDs, setSelectedIDs] = useState(new Set());
  const [toast, setToast] = useState({ show: false, message: "" });

  const triggerToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => triggerToast(`已複製：${text}`));
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    type === 'SA' ? setSaFileName(file.name) : setGsxFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target.result;
      let decoder = new TextDecoder("utf-8");
      let content = decoder.decode(buffer);
      
      const isUtf8 = content.includes("單號") || content.includes("維修") || content.includes("採購");
      if (!isUtf8 && buffer.byteLength > 10) {
        content = new TextDecoder("big5").decode(buffer);
      }

      const res = parseCSV(content);
      if (type === 'SA') {
        setSaData(res.data);
        setSaHeaders(res.headers);
      } else {
        setGsxData(res.data);
        setGsxHeaders(res.headers);
      }
      setStatusMessage(`${type} 載入成功 (${res.data.length} 筆)`);
    };
    reader.readAsArrayBuffer(file);
  };

  const analyze = () => {
    if (!saData.length || !gsxData.length) return setStatusMessage("❌ 請載入檔案");
    setIsAnalyzing(true);
    setStatusMessage("分析中...");
    setSelectedIDs(new Set());

    setTimeout(() => {
      const poH = gsxHeaders.find(h => h === "採購訂單");
      const idH = gsxHeaders.find(h => h === "維修" || h === "維修 ID");
      const statusH = gsxHeaders.find(h => h === "維修狀態");

      if (!poH) {
        setIsAnalyzing(false);
        return setStatusMessage("❌ GSX 找不到「採購訂單」欄位，請檢查檔案是否正確");
      }

      const gsxMap = {};
      gsxData.forEach(row => {
        const po = row[poH];
        if (po) {
          const key = po.toUpperCase().split('-')[0].trim();
          gsxMap[key] = row;
        }
      });

      const rKey = saHeaders.find(h => h === "單號");
      const sKey = saHeaders.find(h => h === "狀態");

      if (!rKey || !sKey) {
        setIsAnalyzing(false);
        return setStatusMessage(`❌ SA 報表格式錯誤 (偵測到 單號:[${rKey || "找不到"}] 狀態:[${sKey || "找不到"}])`);
      }

      let un = [], nr = [], all = [], matches = 0;
      saData.forEach(sa => {
        const rma = sa[rKey], saS = sa[sKey];
        if (!rma || !saS) return;
        const key = rma.toUpperCase().split('-')[0].trim();
        const gsx = gsxMap[key];

        if (gsx) {
          matches++;
          const gsxS = (statusH ? gsx[statusH] : "N/A").trim();
          const gID = (idH ? gsx[idH] : "-") || "-";
          let record = { id: Math.random().toString(36), gsxID: gID, rmaID: rma, saStatus: saS, gsxStatus: gsxS, isAnomaly: false };

          const isGsxClosed = gsxS.includes("已由系統關閉");
          const isGsxReady = gsxS.includes("待取件");

          if (SA_CLOSED_STATUS.includes(saS) && !isGsxClosed) {
            record.isAnomaly = true; un.push(record);
          }
          if (SA_READY_STATUS.includes(saS) && !isGsxReady && !isGsxClosed) {
            record.isAnomaly = true; nr.push(record);
          }

          all.push(record);
        }
      });

      setResults({ unclosed: un, notReady: nr, all });
      setIsAnalyzing(false);
      setStatusMessage(`✅ 分析完成：成功匹配 ${matches} 筆數據`);
      setSelectedIDs(new Set(un.map(r => r.id)));
    }, 400);
  };

  const exportCSV = () => {
    const list = results.unclosed.filter(r => selectedIDs.has(r.id));
    if (!list.length) return;
    const csv = "\uFEFFStatus,Repair ID,Repair Status,Technician ID,Part Details,Error Message\n,repairId,repairStatus,technicianId,\"parts[number, kgbDeviceDetail.id]\",\n" + 
                list.map(r => `,${r.gsxID},SPCM,,,`).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `GSX_Upload_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const currentList = selectedTab === 0 ? results.unclosed : (selectedTab === 1 ? results.notReady : results.all);

  return (
    <div className="min-h-screen bg-[#0F2027] text-white p-4 md:p-10 font-sans relative overflow-x-hidden selection:bg-cyan-500/30">
      <div className="fixed -top-40 -left-40 w-[500px] h-[500px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed top-1/2 -right-40 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-6 relative z-10">
        <div className="backdrop-blur-3xl bg-white/[0.06] border border-white/[0.12] rounded-[32px] p-8 shadow-2xl relative group">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-500/20 rotate-3 transition-transform">
                <Icons.Sparkles />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">GSX 狀態檢查 WEB</h1>
                <p className="text-[10px] opacity-40 font-bold uppercase tracking-[0.3em] mt-1">{VERSION}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
            <FileBox title="SA 報表 (Report...)" fileName={saFileName} onChange={(e) => handleFileUpload(e, 'SA')} icon={<Icons.File />} />
            <FileBox title="GSX 報表 (repair_data...)" fileName={gsxFileName} onChange={(e) => handleFileUpload(e, 'GSX')} icon={<Icons.File />} />
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <button 
              onClick={analyze} disabled={isAnalyzing}
              className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl font-black text-sm shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 tracking-widest"
            >
              {isAnalyzing ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Icons.Sparkles />}
              開始分析數據
            </button>
            <div className="flex-[2] bg-black/40 border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-3 text-sm font-mono text-cyan-200/70 shadow-inner">
               {statusMessage}
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md shadow-lg">
            <button onClick={() => setSelectedTab(0)} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedTab === 0 ? 'bg-white/10 text-white shadow-xl' : 'text-white/30 hover:text-white/50'}`}>未關單 ({results.unclosed.length})</button>
            <button onClick={() => setSelectedTab(1)} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedTab === 1 ? 'bg-white/10 text-white shadow-xl' : 'text-white/30 hover:text-white/50'}`}>未改待取 ({results.notReady.length})</button>
            <button onClick={() => setSelectedTab(2)} className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${selectedTab === 2 ? 'bg-white/10 text-white shadow-xl' : 'text-white/30 hover:text-white/50'}`}>所有 ({results.all.length})</button>
          </div>
        </div>

        <div className="backdrop-blur-2xl bg-black/40 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
          {selectedTab === 0 && currentList.length > 0 && (
            <div className="p-5 flex justify-end border-b border-white/5 bg-white/5">
              <button onClick={exportCSV} className="px-6 py-3 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-black flex items-center gap-3 hover:bg-emerald-500/30 transition-all active:scale-95">
                <Icons.Download /> 匯出清單 ({selectedIDs.size})
              </button>
            </div>
          )}

          <div className="flex-1 overflow-auto custom-scrollbar">
            {currentList.length === 0 ? (
              <div className="h-[400px] flex flex-col items-center justify-center opacity-10">
                <Icons.File />
                <p className="mt-4 font-black tracking-widest uppercase">這裡什麼都沒有</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] bg-white/[0.03] sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    {selectedTab === 0 && <th className="p-6 w-16 text-center">勾選</th>}
                    <th className="p-6">GSX 單號</th>
                    <th className="p-6">RMA 單號</th>
                    <th className="p-6">GSX 狀態</th>
                    <th className="p-6">SA 狀態</th>
                    <th className="p-6 text-center w-24">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {currentList.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.04] transition-all group">
                      {selectedTab === 0 && (
                        <td className="p-6 text-center">
                          <input type="checkbox" checked={selectedIDs.has(r.id)} 
                            onChange={() => {
                              const next = new Set(selectedIDs);
                              next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                              setSelectedIDs(next);
                            }}
                            className="w-5 h-5 accent-cyan-500 rounded-lg cursor-pointer border-white/20 bg-transparent"
                          />
                        </td>
                      )}
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold cursor-pointer hover:text-cyan-400" onClick={() => copyToClipboard(r.gsxID)}>{r.gsxID}</span>
                          <a href={`https://gsx2.apple.com/repairs/${r.gsxID}`} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 p-1.5 bg-white/10 rounded-lg"><Icons.External /></a>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <span className="text-white/60 text-sm font-medium cursor-pointer hover:text-cyan-400" onClick={() => copyToClipboard(r.rmaID)}>{r.rmaID}</span>
                          <a href={`https://rma0.studioarma.com/rma/?m=ticket-common&op=view&id=${r.rmaID}`} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 p-1.5 bg-white/10 rounded-lg"><Icons.External /></a>
                        </div>
                      </td>
                      <td className="p-6 text-xs opacity-40 font-medium italic">{r.gsxStatus}</td>
                      <td className="p-6">
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${r.isAnomaly ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-white/5 text-white/50 border-white/5'}`}>{r.saStatus}</span>
                      </td>
                      <td className="p-6 text-center">
                        <div className="flex justify-center">
                          {r.isAnomaly ? (
                            <div className="text-red-500 animate-pulse"><Icons.Alert /></div>
                          ) : (
                            <div className="text-emerald-500/40"><Icons.Check /></div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {toast.show && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white text-black px-8 py-3 rounded-full font-black text-sm shadow-2xl flex items-center gap-3">
            <Icons.Check /> {toast.message}
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </div>
  );
};

const FileBox = ({ title, fileName, onChange, icon }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onChange({ target: { files: files } });
    }
  };

  return (
    <div className="space-y-3 group">
      <div className="flex items-center gap-2 text-[10px] font-black opacity-30 uppercase tracking-[0.2em] ml-2">
        {icon} {title}
      </div>
      <div 
        className="relative h-16"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input type="file" onChange={onChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
        <div className={`h-full border-2 border-dashed rounded-[20px] flex items-center justify-between px-6 transition-all duration-300
          ${isDragging 
            ? 'bg-cyan-500/20 border-cyan-400 scale-[1.02] shadow-xl' 
            : (fileName ? 'bg-cyan-500/5 border-cyan-500/30 shadow-inner' : 'bg-white/[0.03] border-white/10 group-hover:border-white/30 group-hover:bg-white/[0.05]')
          }`}>
          <span className={`text-sm font-semibold truncate pr-4 ${fileName ? 'text-white' : 'opacity-20'}`}>
            {isDragging ? "放開以載入檔案" : (fileName || "選擇或拖放報表檔案")}
          </span>
          <div className={`text-[10px] font-black px-4 py-2 rounded-xl border shadow-sm uppercase tracking-widest transition-colors
            ${isDragging ? 'bg-cyan-500 text-white border-cyan-400' : 'bg-white/10 border-white/10'}`}>
            {isDragging ? 'Drop' : 'Browse'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;