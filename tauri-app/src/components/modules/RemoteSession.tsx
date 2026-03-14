import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { io, Socket } from "socket.io-client";

interface OnlineUser {
  id: string;
  name: string;
}

interface IncomingRequest {
  sessionId: string;
  techId: string;
  techName: string;
}

type SessionRole = "tech" | "user";
type SessionState = "idle" | "requesting" | "waiting_offer" | "connected" | "sharing";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export default function RemoteSession() {
  // ─── Config ───────────────────────────────────────────────────────────────
  const { user, token } = useAuth();
  const myId = user?.id ?? "";
  const [serverUrl, setServerUrl] = useState(import.meta.env.VITE_API_URL ?? "http://localhost:5000");
  const [myName, setMyName] = useState(user?.name ?? user?.email ?? "Desktop User");

  // ─── Connection ───────────────────────────────────────────────────────────
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // ─── Session ──────────────────────────────────────────────────────────────
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sessionRole, setSessionRole] = useState<SessionRole>("tech");
  const [sessionTarget, setSessionTarget] = useState<OnlineUser | null>(null);
  const [incomingReq, setIncomingReq] = useState<IncomingRequest | null>(null);
  const [sessionId, setSessionId] = useState("");

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // ─── Cleanup helper ───────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setSessionState("idle");
    setSessionTarget(null);
    setIncomingReq(null);
    setSessionId("");
  }, []);

  // ─── Connect to signaling server ──────────────────────────────────────────
  const connect = () => {
    if (socket) { socket.disconnect(); }

    const s = io(serverUrl, { auth: { token } });
    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      s.emit("user:join", { id: myId, name: myName, role: "user" });
    });

    s.on("disconnect", () => {
      setConnected(false);
      endSession();
    });

    s.on("presence:update", ({ onlineUsers: users }: { onlineUsers: OnlineUser[] }) => {
      setOnlineUsers(users.filter((u) => u.id !== myId));
    });

    // ─── Incoming request (this machine is being remoted into) ────────────
    s.on("remote:request", (data: IncomingRequest) => {
      setIncomingReq(data);
    });

    // ─── Tech accepted our request — now wait for the offer ──────────────
    s.on("remote:accepted", ({ sessionId: sid }: { sessionId: string }) => {
      setSessionId(sid);
      setSessionState("waiting_offer");
    });

    s.on("remote:declined", () => {
      endSession();
    });

    // ─── Receive WebRTC offer (tech side: user sent an offer) ─────────────
    s.on("remote:offer", async ({ sessionId: sid, sdp }: { sessionId: string; sdp: RTCSessionDescriptionInit }) => {
      if (!peerRef.current) return;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      s.emit("remote:answer", { sessionId: sid, targetUserId: sessionTarget?.id, sdp: answer });
    });

    // ─── Receive WebRTC answer (user side: tech replied with answer) ──────
    s.on("remote:answer", async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
      await peerRef.current?.setRemoteDescription(new RTCSessionDescription(sdp));
    });

    // ─── ICE candidates ───────────────────────────────────────────────────
    s.on("remote:ice-candidate", async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try { await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
    });

    // ─── Session ended by other party ─────────────────────────────────────
    s.on("remote:end", () => endSession());

    setSocket(s);
  };

  const disconnect = () => {
    socket?.disconnect();
    setSocket(null);
    setConnected(false);
    endSession();
  };

  // ─── Initiate remote-in as technician ────────────────────────────────────
  const requestRemote = (target: OnlineUser) => {
    if (!socket) return;
    const sid = `sess-${Date.now()}`;
    setSessionId(sid);
    setSessionTarget(target);
    setSessionRole("tech");
    setSessionState("requesting");

    // Create PeerConnection now, ready to receive offer
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("remote:ice-candidate", { sessionId: sid, targetId: target.id, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      setSessionState("connected");
    };

    socket.emit("remote:request", {
      targetUserId: target.id,
      techId: myId,
      techName: myName,
      sessionId: sid,
    });
  };

  // ─── Accept incoming request (this machine shares its screen) ────────────
  const acceptRequest = async () => {
    if (!incomingReq || !socket) return;
    const req = incomingReq;
    setIncomingReq(null);
    setSessionRole("user");
    setSessionState("sharing");

    socket.emit("remote:accept", { sessionId: req.sessionId, techId: req.techId });

    const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
    localStreamRef.current = stream;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerRef.current = pc;

    stream.getTracks().forEach((track: MediaStreamTrack) => pc.addTrack(track, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("remote:ice-candidate", { sessionId: req.sessionId, targetId: req.techId, candidate: e.candidate });
      }
    };

    stream.getVideoTracks()[0].onended = () => {
      socket.emit("remote:end", { sessionId: req.sessionId, targetId: req.techId });
      endSession();
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("remote:offer", { sessionId: req.sessionId, techId: req.techId, sdp: offer });
  };

  const declineRequest = () => {
    if (!incomingReq || !socket) return;
    socket.emit("remote:decline", { sessionId: incomingReq.sessionId, techId: incomingReq.techId });
    setIncomingReq(null);
  };

  const stopSession = () => {
    if (!socket) return;
    const targetId = sessionRole === "tech" ? sessionTarget?.id : (incomingReq?.techId ?? "");
    socket.emit("remote:end", { sessionId, targetId });
    endSession();
  };

  useEffect(() => {
    return () => { socketRef.current?.disconnect(); };
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Server Config ── */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-blue-400 mb-4">🖥️ Remote Sessions</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Display Name</label>
            <input
              type="text"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              disabled={connected}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Server URL</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              disabled={connected}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 text-sm disabled:opacity-50"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!connected ? (
            <button
              type="button"
              onClick={connect}
              className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
            >
              Connect
            </button>
          ) : (
            <button
              type="button"
              onClick={disconnect}
              className="px-5 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
            >
              Disconnect
            </button>
          )}
          <span className={`text-sm font-medium ${connected ? "text-green-400" : "text-gray-500"}`}>
            {connected ? "● Connected" : "○ Disconnected"}
          </span>
        </div>
      </div>

      {/* ── Online Users ── */}
      {connected && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-bold text-green-400 mb-4">
            👥 Online Users ({onlineUsers.length})
          </h3>
          {onlineUsers.length === 0 ? (
            <p className="text-gray-500 text-sm">No other users online.</p>
          ) : (
            <div className="space-y-2">
              {onlineUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between bg-gray-700 px-4 py-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {user.name[0]}
                    </div>
                    <div>
                      <div className="text-white font-medium text-sm">{user.name}</div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-gray-400 text-xs">Online</span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestRemote(user)}
                    disabled={sessionState !== "idle"}
                    className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold"
                  >
                    Remote In
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Session Status ── */}
      {sessionState === "requesting" && (
        <div className="bg-gray-800 rounded-lg p-6 border border-yellow-600">
          <h3 className="text-lg font-bold text-yellow-400 mb-2">⏳ Requesting Session</h3>
          <p className="text-gray-300 text-sm mb-4">
            Waiting for <span className="text-white font-semibold">{sessionTarget?.name}</span> to accept…
          </p>
          <button type="button" onClick={stopSession} className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm">
            Cancel
          </button>
        </div>
      )}

      {sessionState === "waiting_offer" && (
        <div className="bg-gray-800 rounded-lg p-6 border border-blue-600">
          <h3 className="text-lg font-bold text-blue-400 mb-2">📡 Establishing Connection</h3>
          <p className="text-gray-400 text-sm">Negotiating WebRTC connection…</p>
        </div>
      )}

      {/* ── Tech View: Remote Stream ── */}
      {sessionState === "connected" && sessionRole === "tech" && (
        <div className="bg-gray-800 rounded-lg p-6 border border-green-600">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-green-400">
              📺 Viewing: {sessionTarget?.name}
            </h3>
            <button
              type="button"
              onClick={stopSession}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
            >
              End Session
            </button>
          </div>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg bg-black border border-gray-700"
            style={{ maxHeight: "60vh" }}
          />
        </div>
      )}

      {/* ── User View: Sharing Screen ── */}
      {sessionState === "sharing" && (
        <div className="bg-gray-800 rounded-lg p-4 border border-purple-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white font-semibold text-sm">Screen sharing active</span>
            </div>
            <button
              type="button"
              onClick={stopSession}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold text-sm"
            >
              Stop Sharing
            </button>
          </div>
        </div>
      )}

      {/* ── This Machine Info ── */}
      {connected && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-400 mb-3">💻 This Machine</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-gray-400 text-xs mb-1">Display Name</div>
              <div className="text-white text-sm font-mono">{myName}</div>
            </div>
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-gray-400 text-xs mb-1">Session ID</div>
              <div className="text-white text-sm font-mono">{myId}</div>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-3">
            Other technicians can see this machine in their online users list and request remote access.
          </p>
        </div>
      )}

      {/* ── Incoming Request Modal ── */}
      {incomingReq && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-8 max-w-sm w-full mx-4 border border-blue-500 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔔</div>
              <h3 className="text-xl font-bold text-white mb-2">Remote Access Request</h3>
              <p className="text-gray-300 text-sm">
                <span className="text-blue-400 font-semibold">{incomingReq.techName}</span> is requesting
                to view your screen
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={declineRequest}
                className="flex-1 py-3 rounded-lg bg-gray-600 hover:bg-gray-500 text-white font-semibold"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={acceptRequest}
                className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
