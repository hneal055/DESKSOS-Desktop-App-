const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { users } = require('../data/store');

const sign = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = users.find(u => u.email === email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const { password: _, ...safeUser } = user;
  res.json({ token: sign(user), user: safeUser });
});

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });
  if (users.find(u => u.email === email.toLowerCase().trim())) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const newUser = {
    id: uuidv4(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: bcrypt.hashSync(password, 10),
    role: 'technician',
  };
  users.push(newUser);
  const { password: _, ...safeUser } = newUser;
  res.status(201).json({ token: sign(newUser), user: safeUser });
});

module.exports = router;
