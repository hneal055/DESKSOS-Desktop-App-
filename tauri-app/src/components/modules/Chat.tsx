import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../api";
import { io, Socket } from "socket.io-client";

interface Channel {
  id: string;
  name: string;
  unreadCount: number;
}

interface Message {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export default function Chat() {
  const { token, user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load channels on mount
  useEffect(() => {
    api.getChannels()
      .then(setChannels)
      .catch((e) => setError(e.message));
  }, []);

  // Open first channel automatically
  useEffect(() => {
    if (channels.length > 0 && !activeChannel) {
      setActiveChannel(channels[0]);
    }
  }, [channels, activeChannel]);

  // Connect socket and join room when channel changes
  useEffect(() => {
    if (!token || !activeChannel) return;

    const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
    const sock = io(baseUrl, { auth: { token } });
    socketRef.current = sock;

    sock.emit("join", activeChannel.id);

    sock.on("message", (msg: Message) => {
      if (msg.channelId === activeChannel.id) {
        setMessages((prev) => [...prev, msg]);
      }
    });

    // Load history
    api.getMessages(activeChannel.id)
      .then(setMessages)
      .catch((e) => setError(e.message));

    return () => {
      sock.emit("leave", activeChannel.id);
      sock.disconnect();
      socketRef.current = null;
    };
  }, [token, activeChannel]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!draft.trim() || !activeChannel || sending) return;
    setSending(true);
    setError(null);
    try {
      await api.sendMessage(activeChannel.id, draft.trim());
      setDraft("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }, [draft, activeChannel, sending]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full gap-0 bg-gray-900 rounded-lg overflow-hidden" style={{ minHeight: "600px" }}>
      {/* Channel list */}
      <div className="w-48 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Channels</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => setActiveChannel(ch)}
              className={`w-full text-left px-4 py-2 text-sm transition ${
                activeChannel?.id === ch.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:bg-gray-700"
              }`}
            >
              # {ch.name}
              {ch.unreadCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5">{ch.unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-800 border-b border-gray-700">
          <h3 className="font-semibold text-white">
            {activeChannel ? `# ${activeChannel.name}` : "Select a channel"}
          </h3>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 rounded p-3">{error}</div>
          )}
          {messages.map((msg) => {
            const isMe = msg.userId === user?.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className="text-xs text-gray-500 mb-1">
                  {isMe ? "You" : msg.userName} ·{" "}
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                    isMe
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-700 text-gray-100 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 bg-gray-800 border-t border-gray-700">
          <div className="flex gap-3 items-end">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder={activeChannel ? `Message #${activeChannel.name}` : "Select a channel first"}
              disabled={!activeChannel}
              rows={1}
              className="flex-1 bg-gray-700 text-white placeholder-gray-500 px-4 py-2 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!draft.trim() || !activeChannel || sending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition"
            >
              {sending ? "..." : "Send"}
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">Enter to send · Shift+Enter for newline</p>
        </div>
      </div>
    </div>
  );
}
