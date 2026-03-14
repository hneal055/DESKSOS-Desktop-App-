import { Router, Request, Response } from "express";
import os from "os";

const router = Router();

router.get("/info", (_req: Request, res: Response): void => {
  const nets = os.networkInterfaces();
  let ipv4 = "N/A", ipv6 = "N/A", mac = "N/A";
  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (!addr.internal) {
        if (addr.family === "IPv4" && ipv4 === "N/A") { ipv4 = addr.address; mac = addr.mac; }
        if (addr.family === "IPv6" && ipv6 === "N/A")   ipv6 = addr.address;
      }
    }
  }
  res.json({ ipv4, ipv6, gateway: "10.0.2.2", dns: ["8.8.8.8", "8.8.4.4"], mac });
});

export default router;
