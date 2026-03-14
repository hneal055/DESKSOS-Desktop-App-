/**
 * Smoke tests: verify every Tauri-dependent module renders without crashing.
 * invoke() is mocked to return a pending promise (loading state).
 */
import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => new Promise(() => {})),
}));

import DiskSpace        from "../components/modules/DiskSpace";
import DiskHealth       from "../components/modules/DiskHealth";
import MemoryConsumers  from "../components/modules/MemoryConsumers";
import NetworkAdapters  from "../components/modules/NetworkAdapters";
import RecentErrors     from "../components/modules/RecentErrors";
import RunningServices  from "../components/modules/RunningServices";
import InstalledSoftware from "../components/modules/InstalledSoftware";
import EventLog         from "../components/modules/EventLog";
import WindowsUpdate    from "../components/modules/WindowsUpdate";

describe("Module smoke tests (render without crash)", () => {
  it("DiskSpace renders",        () => { const { container } = render(<DiskSpace />);        expect(container).not.toBeEmptyDOMElement(); });
  it("DiskHealth renders",       () => { const { container } = render(<DiskHealth />);       expect(container).not.toBeEmptyDOMElement(); });
  it("MemoryConsumers renders",  () => { const { container } = render(<MemoryConsumers />);  expect(container).not.toBeEmptyDOMElement(); });
  it("NetworkAdapters renders",  () => { const { container } = render(<NetworkAdapters />);  expect(container).not.toBeEmptyDOMElement(); });
  it("RecentErrors renders",     () => { const { container } = render(<RecentErrors />);     expect(container).not.toBeEmptyDOMElement(); });
  it("RunningServices renders",  () => { const { container } = render(<RunningServices />);  expect(container).not.toBeEmptyDOMElement(); });
  it("InstalledSoftware renders",() => { const { container } = render(<InstalledSoftware />);expect(container).not.toBeEmptyDOMElement(); });
  it("EventLog renders",         () => { const { container } = render(<EventLog />);         expect(container).not.toBeEmptyDOMElement(); });
  it("WindowsUpdate renders",    () => { const { container } = render(<WindowsUpdate />);    expect(container).not.toBeEmptyDOMElement(); });
});
