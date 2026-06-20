"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, Sparkles, Square } from "lucide-react";

import { useGameState } from "@/components/providers/GameStateProvider";
import { Button } from "@/components/ui/Button";
import { PanelGlass } from "@/components/ui/PanelGlass";

interface TutorChatProps {
  taskId: string;
  task: { title: string; description: string; sectionId: string };
}

const INTRO = 'Napiš, s čím si nevíš rady — třeba „Jak mám rozsvítit LED?" nebo „Proč mi to nefunguje?"';

/**
 * AI mentor v detailu úkolu. Vede dítě, neprozradí řešení.
 *
 * Kontext (úkol + aktuální kód dítěte) se posílá serveru per-request přes
 * `body` v `sendMessage` — čte se ze stavu až v event handleru (ne během
 * renderu), takže je vždy aktuální a nehrozí stale closure.
 */
export function TutorChat({ taskId, task }: TutorChatProps) {
  const { state } = useGameState();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  // Trailing slash kvůli next.config `trailingSlash: true` — jinak POST dostane 308 redirect.
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat/" }), []);
  const { messages, sendMessage, status, error, stop } = useChat({ transport });

  const busy = status === "submitted" || status === "streaming";

  function send() {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage(
      { text },
      { body: { task, code: state.codeDrafts[taskId] ?? "" } },
    );
    setInput("");
  }

  if (!open) {
    return (
      <PanelGlass>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--theme-accent)]/15 text-[color:var(--theme-accent)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Zaseknul ses? Zeptej se AI mentora</span>
            <span className="block text-sm text-[color:var(--theme-muted)]">
              Poradí ti, ale nechá tě na to přijít. Řešení neprozradí.
            </span>
          </span>
        </button>
      </PanelGlass>
    );
  }

  return (
    <PanelGlass>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-[color:var(--theme-accent)]" />
        <h3 className="font-semibold text-base">AI mentor</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto text-sm text-[color:var(--theme-muted)] hover:text-[color:var(--theme-text)]"
        >
          Skrýt
        </button>
      </div>

      <div className="mb-4 max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-[color:var(--theme-muted)]">{INTRO}</p>
        )}

        {messages.map((message) => {
          const text = message.parts
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("");
          const isUser = message.role === "user";
          return (
            <div key={message.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  isUser
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[color:var(--theme-accent)] px-4 py-2 text-sm text-[#0d1427]"
                    : "max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-white/5 px-4 py-2 text-sm text-[color:var(--theme-text)]"
                }
              >
                {text}
              </div>
            </div>
          );
        })}

        {status === "submitted" && (
          <p className="text-sm text-[color:var(--theme-muted)]">Mentor přemýšlí…</p>
        )}

        {status === "error" && (
          <p className="text-sm text-red-300">
            {error?.message?.trim()
              ? error.message
              : "Něco se pokazilo. Zkus to prosím za chvíli znovu."}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder="Zeptej se mentora…"
          className="flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-[color:var(--theme-text)] outline-none focus:border-[color:var(--theme-accent)]"
        />
        {busy ? (
          <Button type="button" variant="secondary" size="md" onClick={() => stop()}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" variant="primary" size="md" disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </PanelGlass>
  );
}
