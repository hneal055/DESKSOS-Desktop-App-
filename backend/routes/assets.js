const router = require('express').Router();
const auth = require('../middleware/auth');
const { assets } = require('../data/store');

router.get('/:code', auth, (req, res) => {
  const asset = assets[req.params.code.toUpperCase()];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  res.json(asset);
});

module.exports = router;
