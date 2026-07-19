/**
 * ChatBot — Komponen chatbot asisten LSAR untuk membantu guru mencari data akademik.
 * ================================================================================
 *
 * Cara Kerja:
 * 1. Komponen berupa floating button di pojok kanan bawah yang membuka panel chat.
 * 2. Menggunakan streaming API (`/api/chatbot/stream`) untuk mendapatkan response real-time.
 * 3. Pesan dikirim sebagai array history (10 pesan terakhir) untuk menjaga konteks.
 * 4. Response dari server berupa Server-Sent Events (SSE) — teks dikirim per-chunk.
 * 5. Setiap chunk di-parse dari format `data: {...}\n` dan di-append ke pesan assistant.
 * 6. Jika ada error, pesan terakhir diganti dengan pesan error.
 *
 * Alur:
 * - State `open` mengontrol visibilitas panel chat.
 * - State `messages` menyimpan array ChatMessage (role + content).
 * - User mengetik → submit → handleSubmit(e):
 *   a. Tambahkan pesan user + placeholder kosong untuk assistant ke messages.
 *   b. Panggil api.requestStream("/chatbot/stream", { message, history }).
 *   c. Baca ReadableStream dengan reader, parse SSE chunks.
 *   d. Setiap chunk valid: update pesan assistant terakhir di state messages.
 *   e. Jika error: timpa pesan assistant dengan pesan error.
 * - Auto-scroll ke bottom setiap messages berubah (useEffect).
 * - Auto-focus input saat panel dibuka (useEffect + setTimeout).
 *
 * @module ChatBot
 */

"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import { api } from "@/lib/api";
import type { ChatMessage } from "@/types";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  Loader2,
  User,
  ChevronDown,
} from "lucide-react";
import { logger } from "@/lib/logger";

/** Response dari API chatbot — berisi teks balasan */
interface ChatResponse {
  reply: string;
}

/**
 * ChatBot — floating chatbot button + panel untuk asisten LSAR.
 * Menggunakan streaming SSE untuk response real-time.
 */
export function ChatBot() {
  /** State visibilitas panel chat — true = terbuka */
  const [open, setOpen] = useState(false);

  /** Array riwayat pesan chat — diawali dengan sambutan asisten */
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Halo! Saya asisten LSAR. Saya bisa membantu Anda mencari data siswa, nilai, kelas, dan informasi lainnya. Ada yang bisa saya bantu?",
    },
  ]);

  /** State input text pengguna */
  const [input, setInput] = useState("");
  /** State indikator loading — true saat menunggu response streaming */
  const [loading, setLoading] = useState(false);

  /** Ref untuk auto-scroll ke pesan terbaru */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  /** Ref untuk auto-focus input chat */
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Effect: auto-scroll ke bawah setiap kali ada pesan baru.
   * Memanfaatkan scrollIntoView dengan behavior smooth.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /**
   * Effect: auto-focus input chat saat panel dibuka.
   * Delay 300ms menunggu animasi panel selesai.
   */
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
      logger.info("ChatBot", "Panel chat dibuka");
    }
  }, [open]);

  /**
   * Handle submit form chat — mengirim pesan user dan memproses response streaming.
   * @param e - FormEvent dari form submit
   */
  async function handleSubmit(e: FormEvent): Promise<void> {
    // Cegah reload halaman
    e.preventDefault();

    // Validasi: jangan kirim jika input kosong atau masih loading
    if (!input.trim() || loading) return;

    // Simpan pesan user sebelum clearing input
    const userMsg = input.trim();
    setInput("");

    logger.info("ChatBot", "Mengirim pesan", { message: userMsg });

    // Tambahkan pesan user + placeholder kosong untuk response assistant
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg },
      { role: "assistant", content: "" },
    ]);
    setLoading(true);

    try {
      // Ambil history chat (tanpa pesan sambutan pertama) untuk dikirim ke API
      // Ini menjaga konteks percakapan
      const history = messages.slice(1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Panggil API streaming chatbot
      const res = await api.requestStream("/chatbot/stream", {
        message: userMsg,
        history: history.slice(-10), // Batasi 10 pesan terakhir agar konteks manageable
      });

      // Validasi: response harus memiliki body stream
      if (!res.body) {
        throw new Error("Stream body is null");
      }

      // Setup reader untuk membaca ReadableStream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let doneReading = false;
      let buffer = ""; // Buffer untuk menampung data yang terpotong antar chunk

      // Matikan indikator loading — response pertama sudah masuk
      setLoading(false);

      // Loop baca stream hingga selesai
      while (!doneReading) {
        const { value, done } = await reader.read();

        // Jika stream selesai, set flag exit
        if (done) {
          doneReading = true;
          break;
        }

        // Decode byte chunk ke string, stream:true untuk menangani multi-byte characters
        buffer += decoder.decode(value, { stream: true });

        // Split buffer per newline untuk memproses setiap line SSE
        const lines = buffer.split("\n");
        // Simpan sisa buffer yang belum lengkap (tidak diakhiri newline)
        buffer = lines.pop() || "";

        // Proses setiap line SSE
        for (const line of lines) {
          const trimmed = line.trim();
          // SSE format: "data: <payload>" — skip line yang tidak sesuai
          if (!trimmed.startsWith("data: ")) continue;

          // Tanda selesai streaming dari server
          if (trimmed === "data: [DONE]") {
            doneReading = true;
            break;
          }

          try {
            // Ambil konten JSON setelah prefix "data: "
            const chunkStr = trimmed.slice(6);
            const chunk = JSON.parse(chunkStr);

            // Jika server mengirim error, throw
            if (chunk.error) {
              throw new Error(chunk.error);
            }

            // Append chunk text ke pesan assistant terakhir di state
            // Menggunakan callback form setState untuk menghindari race condition
            setMessages((prev) => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1].content += chunk;
              return newMsgs;
            });
          } catch (e) {
            // Abaikan JSON parse error — chunk mungkin terpotong
            logger.warn("ChatBot", "Gagal parse chunk SSE", {
              chunk: trimmed.slice(6),
              err: e,
            });
          }
        }
      }

      logger.info("ChatBot", "Streaming selesai");
    } catch (err: any) {
      // Tangani error: set loading false, timpa pesan assistant dengan pesan error
      setLoading(false);

      logger.error("ChatBot", "Error streaming chat", {
        message: userMsg,
        err: err.message,
      });

      setMessages((prev) => {
        const newMsgs = [...prev];
        // Jika pesan assistant masih kosong, timpa dengan pesan error
        if (!newMsgs[newMsgs.length - 1].content) {
          newMsgs[newMsgs.length - 1].content =
            err.message || "Maaf, terjadi kesalahan. Silakan coba lagi.";
        }
        return newMsgs;
      });
    }
  }

  return (
    <>
      {/* ========== Toggle Button ========== */}
      {/* Floating button pojok kanan bawah untuk membuka/menutup panel chat */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-2xl hover:shadow-blue-500/30 hover:scale-105 transition-all duration-200 flex items-center justify-center"
        aria-label={open ? "Tutup chatbot" : "Buka chatbot"}
      >
        {open ? (
          <X className="w-6 h-6" /> // Icon X saat panel terbuka
        ) : (
          <MessageCircle className="w-6 h-6" /> // Icon chat saat panel tertutup
        )}
      </button>

      {/* ========== Chat Panel ========== */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-2xl border border-gray-200/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 zoom-in-95 duration-200">
          {/* --- Header --- */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shrink-0">
            {/* Avatar bot */}
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>

            {/* Info header */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">Asisten LSAR</h3>
              <p className="text-xs text-blue-100">
                Online &bull; Bertanya tentang data akademik
              </p>
            </div>

            {/* Tombol minimize — menutup panel */}
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* --- Messages Area --- */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50/50">
            {/* Render setiap pesan di state messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                {/* Avatar — bot (biru) atau user (indigo) */}
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

                {/* Bubble chat — asisten (putih), user (biru) */}
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

            {/* Typing indicator — animasi loading saat menunggu response */}
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

            {/* Invisible div untuk anchor auto-scroll */}
            <div ref={messagesEndRef} />
          </div>

          {/* --- Input Form --- */}
          <form
            onSubmit={handleSubmit}
            className="shrink-0 border-t border-gray-200/80 bg-white"
          >
            <div className="flex items-center gap-2 px-4 py-3">
              {/* Text input — auto-focus via ref, disabled saat loading */}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanya sesuatu..."
                disabled={loading}
                className="flex-1 bg-gray-100/80 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all placeholder:text-gray-400 disabled:opacity-50"
              />

              {/* Tombol kirim — disabled jika kosong atau loading */}
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
