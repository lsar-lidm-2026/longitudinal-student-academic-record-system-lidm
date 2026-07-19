"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/types";
import { MessageCircle, X, Send, Bot, Loader2, User, ChevronDown } from "lucide-react";

interface ChatResponse {
  reply: string;
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Halo! Saya asisten LSAR. Saya bisa membantu Anda mencari data siswa, nilai, kelas, dan informasi lainnya. Ada yang bisa saya bantu?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    
    // Tambahkan pesan user dan placeholder untuk assistant
    setMessages((prev) => [
      ...prev, 
      { role: "user", content: userMsg },
      { role: "assistant", content: "" }
    ]);
    setLoading(true);

    try {
      const history = messages.slice(1).map((m) => ({ role: m.role, content: m.content }));
      
      const res = await api.requestStream("/chatbot/stream", {
        message: userMsg,
        history: history.slice(-10), // keep context manageable
      });

      if (!res.body) throw new Error("Stream body is null");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let doneReading = false;
      let buffer = "";
      
      // Matikan indikator loading karena response pertama sudah masuk
      setLoading(false);

      while (!doneReading) {
        const { value, done } = await reader.read();
        if (done) {
          doneReading = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          
          if (trimmed === "data: [DONE]") {
            doneReading = true;
            break;
          }

          try {
            const chunkStr = trimmed.slice(6);
            const chunk = JSON.parse(chunkStr);

            if (chunk.error) {
              throw new Error(chunk.error);
            }

            // Append chunk text ke pesan terakhir
            setMessages((prev) => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1].content += chunk;
              return newMsgs;
            });
          } catch (e) {
            // ignore JSON parse error untuk chunk individual jika terpotong
          }
        }
      }
    } catch (err: any) {
      setLoading(false);
      setMessages((prev) => {
        const newMsgs = [...prev];
        // Jika belum ada isinya, timpa dengan pesan error
        if (!newMsgs[newMsgs.length - 1].content) {
          newMsgs[newMsgs.length - 1].content = err.message || "Maaf, terjadi kesalahan. Silakan coba lagi.";
        }
        return newMsgs;
      });
    }
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-2xl hover:shadow-blue-500/30 hover:scale-105 transition-all duration-200 flex items-center justify-center"
        aria-label={open ? "Tutup chatbot" : "Buka chatbot"}
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Asisten LSAR</h3>
              <p className="text-xs text-blue-100">Online • Bertanya tentang data akademik</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === "assistant"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "assistant"
                      ? "bg-white border border-gray-200/60 text-gray-800 rounded-tl-sm"
                      : "bg-blue-600 text-white rounded-tr-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-gray-200/60 rounded-2xl rounded-tl-sm px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="shrink-0 border-t border-gray-200/80 bg-white">
            <div className="flex items-center gap-2 px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanya sesuatu..."
                disabled={loading}
                className="flex-1 bg-gray-100/80 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all placeholder:text-gray-400 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
