const router = require("express").Router();
const auth   = require("../middleware/auth");
const db     = require("../db");

router.get("/:code", auth, (req, res) => {
  const asset = db.prepare("SELECT * FROM assets WHERE code = ?").get(req.params.code.toUpperCase());
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  const maintenance = db.prepare(
    "SELECT id, date, description, technician FROM asset_maintenance WHERE asset_id = ? ORDER BY date DESC"
  ).all(asset.id);
  res.json({
    id: asset.id, code: asset.code, type: asset.type, status: asset.status,
    serialNumber: asset.serial_number, location: asset.location,
    assignedUser: asset.assigned_user, maintenanceHistory: maintenance,
  });
});

module.exports = router;
