const router = require('express').Router();
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const { channels, messages } = require('../data/store');

router.get('/channels', auth, (req, res) => {
  res.json(channels);
});

router.get('/channels/:id/messages', auth, (req, res) => {
  const msgs = messages[req.params.id] || [];
  res.json(msgs);
});

router.post('/channels/:id/messages', auth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const msg = {
    id: uuidv4(),
    channelId: req.params.id,
    userId: req.user.id,
    userName: req.user.name || req.user.email,
    text,
    timestamp: new Date().toISOString(),
  };
  if (!messages[req.params.id]) messages[req.params.id] = [];
  messages[req.params.id].push(msg);

  // Emit via Socket.IO (attached in server.js)
  if (req.app.get('io')) {
    req.app.get('io').to(req.params.id).emit('message', msg);
  }
  res.status(201).json(msg);
});

module.exports = router;
