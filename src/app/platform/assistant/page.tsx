"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Plus, Trash2, MessageSquare, Loader2 } from "lucide-react";
import type { ChatMessage } from "@/types/ai";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages?: { content: string; role: string }[];
}

function formatMarkdown(text: string): string {
  // Escape ALL HTML first so raw model output can never inject markup,
  // then apply a light markdown -> HTML conversion for chat display.
  return escapeHtml(text)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre class="code-block-body" style="background:#0d1117;border-radius:8px;padding:0.75rem;margin:0.5rem 0;overflow-x:auto;"><code>${code.trim()}</code></pre>`
    )
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Load conversations list
  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []));
  }, []);

  async function createConversation(): Promise<string> {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Conversation" }),
    });
    const data = await res.json();
    const conv = data.conversation;
    setConversations((prev) => [conv, ...prev]);
    setActiveConversationId(conv.id);
    setMessages([]);
    return conv.id;
  }

  async function loadConversation(id: string) {
    setActiveConversationId(id);
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    const msgs: ChatMessage[] = (data.conversation?.messages ?? []).map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );
    setMessages(msgs);
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setMessages([]);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    let convId = activeConversationId;
    if (!convId) {
      convId = await createConversation();
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError("");

    // Update conversation title if it's the first message
    if (messages.length === 0) {
      const title = text.slice(0, 60);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title } : c))
      );
    }

    const res = await fetch("/api/ai/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: updatedMessages,
        conversationId: convId,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setError(data.error || "Failed to get a response.");
      return;
    }

    setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Conversations sidebar */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <button
            onClick={createConversation}
            className="btn btn-primary btn-sm w-full"
            style={{ justifyContent: "center" }}
          >
            <Plus size={15} />
            New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
          {conversations.length === 0 && (
            <div className="empty-state" style={{ padding: "2rem 1rem" }}>
              <MessageSquare size={24} style={{ opacity: 0.3 }} />
              <div className="empty-state-description">No conversations yet</div>
            </div>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.5rem 0.625rem",
                borderRadius: "var(--radius-sm)",
                background: activeConversationId === conv.id ? "var(--bg-hover)" : "transparent",
                cursor: "pointer",
                marginBottom: "1px",
              }}
              onClick={() => loadConversation(conv.id)}
            >
              <MessageSquare size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span
                style={{
                  flex: 1,
                  fontSize: "0.8125rem",
                  color: activeConversationId === conv.id ? "var(--text-primary)" : "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {conv.title}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                style={{
                  background: "none",
                  border: "none",
                  padding: "2px",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="page-header" style={{ padding: "1.25rem 1.5rem 1rem", flexShrink: 0 }}>
          <h1 className="page-title" style={{ fontSize: "1.125rem" }}>AI Assistant</h1>
          <p className="page-description">Ask anything about software engineering</p>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {messages.length === 0 && (
            <div className="empty-state" style={{ height: "100%", minHeight: 300 }}>
              <div style={{ fontSize: "2.5rem" }}>💬</div>
              <div className="empty-state-title">Start a conversation</div>
              <div className="empty-state-description">
                Ask me to explain code, help with debugging, suggest architecture, or answer any software engineering question.
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                className={msg.role === "user" ? "chat-bubble chat-bubble-user" : "chat-bubble chat-bubble-assistant"}
                dangerouslySetInnerHTML={{
                  __html: msg.role === "assistant" ? formatMarkdown(msg.content) : escapeHtml(msg.content).replace(/\n/g, "<br/>"),
                }}
              />
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div className="chat-bubble chat-bubble-assistant">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
                  <span className="text-muted text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error" style={{ maxWidth: 500 }}>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="chat-input-bar">
          <textarea
            className="chat-input"
            placeholder="Ask a software engineering question... (Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            style={{ height: "auto" }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 200) + "px";
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="btn btn-primary"
            style={{ flexShrink: 0, height: 44 }}
            aria-label="Send message"
          >
            <Send size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
