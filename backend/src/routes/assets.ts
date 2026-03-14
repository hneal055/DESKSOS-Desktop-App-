import { Router, Request, Response } from "express";
import auth from "../middleware/auth.js";
import db from "../db.js";
import { AssetRow, MaintenanceRecord } from "../types/index.js";

const router = Router();

router.get("/:code", auth, (req: Request, res: Response): void => {
  const asset = db.prepare("SELECT * FROM assets WHERE code = ?").get(
    (req.params.code as string).toUpperCase()
  ) as AssetRow | undefined;
  if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  const maintenance = db.prepare(
    "SELECT id, date, description, technician FROM asset_maintenance WHERE asset_id = ? ORDER BY date DESC"
  ).all(asset.id) as MaintenanceRecord[];
  res.json({
    id: asset.id, code: asset.code, type: asset.type, status: asset.status,
    serialNumber: asset.serial_number, location: asset.location,
    assignedUser: asset.assigned_user, maintenanceHistory: maintenance,
  });
});

export default router;

