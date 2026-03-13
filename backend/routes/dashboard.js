const router = require('express').Router();
const auth = require('../middleware/auth');
const { team } = require('../data/store');

router.get('/queue', auth, (req, res) => {
  res.json({ open: 12, inProgress: 7, resolved: 43, avgResponseTime: 18 });
});

router.get('/team', auth, (req, res) => {
  res.json(team);
});

module.exports = router;
