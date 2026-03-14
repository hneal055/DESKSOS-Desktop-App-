import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TicketBuilder from "../components/modules/TicketBuilder";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock clipboard
Object.assign(navigator, {
  clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
});

describe("TicketBuilder", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders without crashing", () => {
    render(<TicketBuilder />);
    expect(screen.getByText(/Ticket/i)).toBeInTheDocument();
  });

  it("shows gather diagnostics button", () => {
    render(<TicketBuilder />);
    expect(screen.getByRole("button", { name: /Gather Diagnostics/i })).toBeInTheDocument();
  });

  it("renders priority selector with all options", () => {
    render(<TicketBuilder />);
    const buttons = screen.getAllByRole("button");
    const labels = buttons.map(b => b.textContent);
    expect(labels).toContain("Low");
    expect(labels).toContain("Medium");
    expect(labels).toContain("High");
    expect(labels).toContain("Critical");
  });

  it("allows typing in issue description field", () => {
    render(<TicketBuilder />);
    const textarea = screen.getByPlaceholderText(/unable to connect/i);
    fireEvent.change(textarea, { target: { value: "Network is down" } });
    expect((textarea as HTMLTextAreaElement).value).toBe("Network is down");
  });

  it("allows typing in steps tried field", () => {
    render(<TicketBuilder />);
    const textarea = screen.getByPlaceholderText(/Restarted machine/i);
    fireEvent.change(textarea, { target: { value: "Restarted router" } });
    expect((textarea as HTMLTextAreaElement).value).toBe("Restarted router");
  });

  it("shows loading state when gathering diagnostics", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    (invoke as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // never resolves = stays loading
    );
    render(<TicketBuilder />);
    fireEvent.click(screen.getByRole("button", { name: /Gather Diagnostics/i }));
    expect(screen.getByText(/Gathering diagnostics/i)).toBeInTheDocument();
  });
});

