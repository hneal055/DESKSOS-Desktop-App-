// Fixes made before the pilot (findings from writing the technician guide)
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Stand-ins ────────────────────────────────────────────────────────────────
const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...a: unknown[]) => invokeMock(...a) }));

// Fake socket: records emits and lets a test fire server events
type Handler = (...a: any[]) => any;
const sockets: { handlers: Record<string, Handler>; emits: [string, any][] }[] = [];
vi.mock("socket.io-client", () => ({
  io: () => {
    const s = { handlers: {} as Record<string, Handler>, emits: [] as [string, any][] };
    sockets.push(s);
    return {
      on: (ev: string, h: Handler) => { s.handlers[ev] = h; },
      emit: (ev: string, d: any) => { s.emits.push([ev, d]); },
      disconnect: () => {},
    };
  },
}));

// Fake WebRTC peer connection: records calls
const peers: any[] = [];
class FakePeer {
  remoteDescription: any = null;
  added: any[] = [];
  onicecandidate: any; ontrack: any;
  constructor() { peers.push(this); }
  async setRemoteDescription(d: any) { this.remoteDescription = d; }
  async setLocalDescription() {}
  async createAnswer() { return { type: "answer", sdp: "a" }; }
  async createOffer() { return { type: "offer", sdp: "o" }; }
  async addIceCandidate(c: any) { if (!this.remoteDescription) throw new Error("no remote description"); this.added.push(c); }
  addTrack() {}
  close() {}
}
(globalThis as any).RTCPeerConnection = FakePeer;
(globalThis as any).RTCSessionDescription = function (d: any) { return d; };
(globalThis as any).RTCIceCandidate = function (c: any) { return c; };

import { formatResult, ConfirmButton, FixItModule, ProcessModule } from "../App";
import TicketBuilder from "../components/modules/TicketBuilder";
import RemoteSession from "../components/modules/RemoteSession";
import { AuthProvider } from "../contexts/AuthContext";
import { api, setApiToken, setSessionExpiredHandler } from "../api";

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

beforeEach(() => {
  invokeMock.mockReset();
  sockets.length = 0;
  peers.length = 0;
  setApiToken(null);
  setSessionExpiredHandler(null);
});

describe("Fix It results", () => {
  it("show plain text, not JSON quotes", () => {
    expect(formatResult("Successfully flushed the DNS Resolver Cache.\r\n")).toBe("Successfully flushed the DNS Resolver Cache.");
    expect(formatResult(null)).toBe("done");
    expect(formatResult({ ok: true })).toBe('{"ok":true}');
  });
});

describe("ConfirmButton", () => {
  it("needs a second click to run, and Cancel backs out", () => {
    const run = vi.fn();
    render(<ConfirmButton label="Clear Queue" warning="Deletes every job." onConfirm={run} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear Queue" }));
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByText("Deletes every job.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(run).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Clear Queue" }));
    fireEvent.click(screen.getByRole("button", { name: "⚠️ Confirm Clear Queue" }));
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("Fix It page", () => {
  it("doesn't clear the print queue on the first click", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "run_custom_powershell" ? "True" : "ok"));
    render(<FixItModule />);
    fireEvent.click(screen.getByRole("button", { name: "Clear Queue" }));
    expect(invokeMock).not.toHaveBeenCalledWith("clear_print_queue");
    fireEvent.click(screen.getByRole("button", { name: "⚠️ Confirm Clear Queue" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("clear_print_queue"));
  });

  it("warns when DeskSOS isn't running as administrator", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "run_custom_powershell" ? "False\r\n" : "ok"));
    render(<FixItModule />);
    expect(await screen.findByRole("note")).toHaveTextContent("isn't running as administrator");
  });

  it("shows no warning when it is", async () => {
    invokeMock.mockImplementation(async (cmd: string) => (cmd === "run_custom_powershell" ? "True" : "ok"));
    render(<FixItModule />);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("run_custom_powershell", expect.anything()));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

describe("Processes page", () => {
  it("asks before killing a process", async () => {
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "get_top_processes") return [{ pid: 42, name: "notepad.exe", cpu_percent: 1, memory_mb: 20 }];
      if (cmd === "run_custom_powershell") return "True";
      return null;
    });
    render(<ProcessModule />);
    fireEvent.click(await screen.findByRole("button", { name: "Kill" }));
    expect(invokeMock).not.toHaveBeenCalledWith("kill_process", expect.anything());
    expect(screen.getByText(/End notepad.exe\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "⚠️ Confirm Kill" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("kill_process", { pid: 42 }));
  });
});

describe("Ticket Builder", () => {
  it("can't submit the same ticket twice, and starts over on request", async () => {
    invokeMock.mockResolvedValue(JSON.stringify({ name: "WS-042", user: "jane", gwPing: true, dnsPing: true, inetPing: true }));
    const fetchMock = vi.fn(async () => jsonResponse(201, { id: "T-12345678" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketBuilder />);
    fireEvent.change(screen.getByPlaceholderText(/User unable to connect/), { target: { value: "Outlook not syncing" } });
    fireEvent.click(screen.getByRole("button", { name: /Gather Diagnostics/ }));
    const submit = await screen.findByRole("button", { name: /Submit to DeskSOS/ });
    fireEvent.click(submit);
    expect(await screen.findByText(/created successfully/)).toBeInTheDocument();
    const done = screen.getByRole("button", { name: /Submitted!/ });
    expect(done).toBeDisabled();
    fireEvent.click(done);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The report labels the network lines as pings
    expect(screen.getByText(/Ping 8\.8\.8\.8 \(Google\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Start a new ticket/ }));
    expect(screen.queryByText(/created successfully/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit to DeskSOS/ })).toBeDisabled(); // description cleared
    vi.unstubAllGlobals();
  });
});

describe("Session expiry", () => {
  it("a rejected token on a signed-in request triggers sign-out", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    setApiToken("old-token");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401, { error: "Invalid token" })));
    await expect(api.getTickets()).rejects.toThrow("Invalid token");
    expect(expired).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("a wrong password on the sign-in form doesn't", async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401, { error: "Invalid credentials" })));
    await expect(api.login("a@b.com", "x")).rejects.toThrow("Invalid credentials");
    expect(expired).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("Remote Session signaling", () => {
  const renderRemote = () => render(<AuthProvider><RemoteSession /></AuthProvider>);
  const fire = async (ev: string, data?: any) => { await act(async () => { await sockets[0].handlers[ev]?.(data); }); };

  it("viewer: answers to the person sharing, and adds early ICE candidates once ready", async () => {
    renderRemote();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await fire("connect");
    await fire("presence:update", { onlineUsers: [{ id: "u2", name: "Bob" }] });
    fireEvent.click(screen.getByRole("button", { name: /Remote In/ }));
    expect(sockets[0].emits.find(([e]) => e === "remote:request")?.[1]).toMatchObject({ targetUserId: "u2" });

    // A candidate arriving before the offer is held, not lost
    await fire("remote:ice-candidate", { candidate: { candidate: "early" } });
    expect(peers[0].added).toEqual([]);

    await fire("remote:offer", { sessionId: "s1", sdp: { type: "offer", sdp: "o" } });
    const answer = sockets[0].emits.find(([e]) => e === "remote:answer")?.[1];
    expect(answer.targetUserId).toBe("u2"); // was undefined before the fix
    expect(peers[0].added).toEqual([{ candidate: "early" }]);
  });

  it("sharer: Stop Sharing tells the viewer", async () => {
    (navigator as any).mediaDevices = {
      getDisplayMedia: async () => ({ getTracks: () => [], getVideoTracks: () => [{ set onended(_f: any) {} }] }),
    };
    renderRemote();
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await fire("connect");
    await fire("remote:request", { sessionId: "s9", techId: "t1", techName: "Tech" });
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(sockets[0].emits.some(([e]) => e === "remote:offer")).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: /Stop Sharing/ }));
    const end = sockets[0].emits.find(([e]) => e === "remote:end")?.[1];
    expect(end).toEqual({ sessionId: "s9", targetId: "t1" }); // targetId was "" before the fix
  });
});
