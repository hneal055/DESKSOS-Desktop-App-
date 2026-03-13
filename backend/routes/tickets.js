const router = require('express').Router();
const auth = require('../middleware/auth');
const { tickets } = require('../data/store');

// GET /tickets?status=open&assigneeId=1
router.get('/', auth, (req, res) => {
  const { status, assigneeId } = req.query;
  let result = [...tickets];
  if (status)     result = result.filter(t => t.status === status);
  if (assigneeId) result = result.filter(t => t.assigneeId === assigneeId);
  result.sort((a, b) => {
    const p = { P1: 0, P2: 1, P3: 2 };
    return (p[a.priority] - p[b.priority]) || new Date(b.createdAt) - new Date(a.createdAt);
  });
  res.json(result);
});

// GET /tickets/:id
router.get('/:id', auth, (req, res) => {
  const ticket = tickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json(ticket);
});

// PATCH /tickets/:id  { status }
router.patch('/:id', auth, (req, res) => {
  const ticket = tickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const { status } = req.body;
  if (status) {
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    if (status === 'resolved') ticket.resolvedAt = new Date().toISOString();
  }
  res.json(ticket);
});

module.exports = router;
