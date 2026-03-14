export default async function globalTeardown() {
  const backend = global.__E2E_BACKEND__;
  if (backend && !backend.killed) {
    backend.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      backend.once("exit", () => resolve());
      setTimeout(resolve, 2000); // fallback
    });
  }
}
