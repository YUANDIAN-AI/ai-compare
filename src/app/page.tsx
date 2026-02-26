"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  StopCircle,
  CheckCircle,
  AlertCircle,
  History,
  Trash2,
  X,
  Menu,
  ChevronLeft,
  Plus,
  Download,
  Sparkles,
  Eye,
  BookOpen,
} from "lucide-react";

const MODELS = ["通义千问", "DeepSeek", "豆包"];

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ModelSession {
  messages: Message[];
  loading: boolean;
  error: string | null;
}

const getFriendlyErrorMessage = (errorMessage: string): string => {
  if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
    return "API 密钥无效，请检查配置";
  }
  if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
    return "请求过于频繁，请稍后再试";
  }
  if (errorMessage.includes("API 错误")) {
    return "服务暂时不可用，请重试";
  }
  return errorMessage || "请求失败，请重试";
};

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [sessions, setSessions] = useState<Record<string, ModelSession>>(
    Object.fromEntries(MODELS.map(model => [model, { messages: [], loading: false, error: null }]))
  );
  const [history, setHistory] = useState<{ id: string; sessions: typeof sessions; timestamp: number }[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // ✅ 默认关闭
  const [selectedReplies, setSelectedReplies] = useState<Record<string, string>>({});
  const abortControllers = useRef<Record<string, AbortController>>({});

  // 初始化历史记录（不再自动展开侧边栏）
  useEffect(() => {
    const saved = localStorage.getItem("ai_compare_history_v3");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHistory(parsed);
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
    // ✅ 移除自动展开逻辑，始终默认关闭
  }, []);

  useEffect(() => {
    localStorage.setItem("ai_compare_history_v3", JSON.stringify(history));
  }, [history]);

  const isGenerating = Object.values(sessions).some(s => s.loading);

  const handleSend = async () => {
    const question = inputValue.trim();
    if (!question || isGenerating) return;

    const newUserMessage: Message = { role: "user", content: question };
    const newSessions = { ...sessions };
    for (const model of MODELS) {
      newSessions[model] = {
        ...newSessions[model],
        messages: [...newSessions[model].messages, newUserMessage],
        loading: true,
        error: null,
      };
    }

    setSessions(newSessions);
    setInputValue("");

    Object.values(abortControllers.current).forEach(c => c.abort());
    abortControllers.current = {};

    for (const model of MODELS) {
      const controller = new AbortController();
      abortControllers.current[model] = controller;
      callApi(model, newSessions[model].messages, controller);
    }
  };

  const handleStop = (model?: string) => {
    if (model) {
      abortControllers.current[model]?.abort();
      setSessions(prev => ({
        ...prev,
        [model]: { ...prev[model], loading: false, error: "已停止" },
      }));
    } else {
      Object.values(abortControllers.current).forEach(c => c.abort());
      setSessions(prev => {
        const updated = { ...prev };
        for (const m of MODELS) {
          if (updated[m].loading) {
            updated[m] = { ...updated[m], loading: false, error: "已停止" };
          }
        }
        return updated;
      });
    }
  };

  const callApi = async (model: string, messages: Message[], controller: AbortController) => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setSessions(prev => ({
        ...prev,
        [model]: {
          ...prev[model],
          messages: [...prev[model].messages, { role: "assistant", content: data.reply }],
          loading: false,
        },
      }));
    } catch (err: any) {
      if (err.name !== "AbortError") {
        const friendlyMsg = getFriendlyErrorMessage(err.message);
        setSessions(prev => ({
          ...prev,
          [model]: { ...prev[model], loading: false, error: friendlyMsg },
        }));
      }
    }
  };

  const handleNewChat = () => {
    setSessions(
      Object.fromEntries(MODELS.map(model => [model, { messages: [], loading: false, error: null }]))
    );
    setSelectedReplies({});
  };

  const exportToMarkdown = () => {
    let md = `# AI 多模型对话对比\n\n`;
    const userMessages = sessions[MODELS[0]].messages.filter(m => m.role === "user");
    if (userMessages.length === 0) {
      alert("没有对话内容可导出");
      return;
    }

    userMessages.forEach((userMsg, idx) => {
      md += `## 第 ${idx + 1} 轮提问\n\n`;
      md += `**用户**\n> ${userMsg.content}\n\n`;

      MODELS.forEach(model => {
        const assistantMsg = sessions[model].messages.find(
          (m, i) => m.role === "assistant" && Math.floor(i / 2) === idx
        );
        md += `**${model}**\n> ${assistantMsg?.content || "无回复"}\n\n`;
      });
      md += "---\n\n";
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-compare-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleSelectReply = (model: string, content: string) => {
    setSelectedReplies(prev => {
      if (prev[model] === content) {
        const { [model]: _, ...rest } = prev;
        return rest;
      } else {
        return { ...prev, [model]: content };
      }
    });
  };

  const clearSelection = () => {
    setSelectedReplies({});
  };

  const renderMessages = (model: string, messages: Message[]) => (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-400">
          <Sparkles className="mr-2 text-purple-400" /> 开始你的 AI 对话吧
        </div>
      ) : (
        messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md rounded-br-none"
                : "bg-white text-gray-800 border border-gray-200 shadow-sm rounded-bl-none"
            }`}>
              {msg.content}
            </div>
            {msg.role === "assistant" && (
              <div className="mt-1 ml-2 flex items-center">
                <label className="flex items-center text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedReplies[model] === msg.content}
                    onChange={() => toggleSelectReply(model, msg.content)}
                    className="mr-1 accent-purple-600"
                  />
                  加入对比
                </label>
              </div>
            )}
          </div>
        ))
      )}
      {sessions[model].loading && (
        <div className="flex justify-start">
          <div className="animate-pulse flex items-center gap-2 text-gray-500 text-sm">
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span>{model} 正在思考...</span>
          </div>
        </div>
      )}
    </div>
  );

  const buttonStyle = isGenerating
    ? "bg-rose-500 hover:bg-rose-600"
    : "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700";

  const showComparisonPanel = Object.keys(selectedReplies).length >= 2;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex font-sans">
      {/* 对比面板 */}
      {showComparisonPanel && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-xl p-5 z-30 max-w-2xl w-full mx-4 shadow-xl border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-1.5">
              <Eye size={16} className="text-purple-600" /> 
              对比回顾（{Object.keys(selectedReplies).length} 个模型）
            </h3>
            <button
              onClick={clearSelection}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="清除选择"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
            {Object.entries(selectedReplies).map(([model, reply]) => (
              <div key={model} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${
                    model === '通义千问' ? 'bg-blue-500' :
                    model === 'DeepSeek' ? 'bg-emerald-500' :
                    'bg-amber-500'
                  }`}></div>
                  <span className="font-medium text-gray-800 text-sm">{model}</span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{reply}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 侧边栏 - 默认折叠 */}
      <aside className={`fixed md:relative z-20 h-full bg-white transition-all duration-300 ease-in-out ${
        isSidebarOpen ? "w-64 opacity-100" : "w-0 opacity-0"
      } overflow-hidden border-r border-gray-200`}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold flex items-center gap-2 text-gray-800">
            <BookOpen size={18} /> 历史记录
          </h2>
          {history.length > 0 && (
            <button onClick={() => setHistory([])} className="text-xs text-rose-500 hover:text-rose-700">
              清空
            </button>
          )}
        </div>
        <div className="p-2 space-y-2 overflow-y-auto h-[calc(100%-60px)]">
          {history.length === 0 ? (
            <div className="text-center text-gray-400 text-sm mt-8">暂无历史记录</div>
          ) : (
            history.map(item => (
              <div
                key={item.id}
                onClick={() => loadFromHistory(item)}
                className="p-3 rounded-lg hover:bg-gray-100 cursor-pointer relative group transition-colors"
              >
                <div className="text-sm line-clamp-2 pr-6 text-gray-700">
                  {item.sessions[MODELS[0]].messages[0]?.content?.slice(0, 30) || "新对话"}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteHistory(item.id); }}
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col">
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-4 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
            </button>
            
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center gap-2">
              <Sparkles size={24} /> AI 对话竞技场
            </h1>
            
            <div className="flex gap-2">
              <button
                onClick={exportToMarkdown}
                className="flex items-center gap-1.5 bg-white border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                <Download size={16} /> 导出
              </button>
              <button 
                onClick={handleNewChat} 
                className="flex items-center gap-1.5 bg-white border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                <Plus size={16} /> 新对话
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {MODELS.map(model => (
              <div key={model} className="bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col h-[520px] overflow-hidden transition-shadow hover:shadow-xl">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <span className="font-semibold text-gray-800">{model}</span>
                  <div className="flex gap-2">
                    {sessions[model].error && <AlertCircle className="text-rose-500" size={18} />}
                    {!sessions[model].error && sessions[model].messages.some(m => m.role === "assistant") && (
                      <CheckCircle className="text-emerald-500" size={18} />
                    )}
                    {sessions[model].loading && (
                      <button
                        onClick={() => handleStop(model)}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded"
                        title="停止生成"
                      >
                        <StopCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
                {renderMessages(model, sessions[model].messages)}
                {sessions[model].error && sessions[model].error !== "已停止" && (
                  <div className="px-4 pb-2 text-rose-500 text-sm flex items-center gap-1.5">
                    <AlertCircle size={14} /> {sessions[model].error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <footer className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200 sticky bottom-0">
          <div className="max-w-6xl mx-auto flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={isGenerating ? "生成中..." : "输入你的问题..."}
              className="flex-1 p-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
              disabled={isGenerating}
            />
            <button
              onClick={handleSend}
              className={`px-6 py-3.5 rounded-xl text-white font-medium min-w-[100px] transition-all ${buttonStyle}`}
            >
              {isGenerating ? (
                <>
                  <StopCircle size={18} className="inline mr-1" /> 停止
                </>
              ) : (
                <>
                  <Send size={18} className="inline mr-1" /> 发送
                </>
              )}
            </button>
          </div>
        </footer>
      </main>

      {isSidebarOpen && window.innerWidth < 768 && (
        <div 
          className="fixed inset-0 bg-black/40 z-10" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}
    </div>
  );

  // --- 辅助函数 ---
  const loadFromHistory = (item: typeof history[0]) => {
    setSessions(item.sessions);
    setSelectedReplies({});
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteHistory = (id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  };
}