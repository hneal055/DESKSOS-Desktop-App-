require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const authRoute      = require('./routes/auth');
const dashboardRoute = require('./routes/dashboard');
const chatRoute      = require('./routes/chat');
const assetsRoute    = require('./routes/assets');
const networkRoute   = require('./routes/network');
const ticketsRoute   = require('./routes/tickets');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.set('io', io);

app.use('/auth',      authRoute);
app.use('/dashboard', dashboardRoute);
app.use('/chat',      chatRoute);
app.use('/assets',    assetsRoute);
app.use('/network',   networkRoute);
app.use('/tickets',   ticketsRoute);
app.get('/health', (_, res) => res.json({ status: 'ok' }));

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const jwt = require('jsonwebtoken');
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { next(new Error('Invalid token')); }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.user?.email);
  socket.on('join',  (ch) => socket.join(ch));
  socket.on('leave', (ch) => socket.leave(ch));
  socket.on('disconnect', () => console.log('Socket disconnected:', socket.user?.email));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`DeskSOS API running on http://0.0.0.0:${PORT}`);
  console.log('  admin@desksos.com / password123');
  console.log('  tech@desksos.com  / password123');
});
