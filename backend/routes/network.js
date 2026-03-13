const router = require('express').Router();
const os = require('os');

router.get('/info', (req, res) => {
  const nets = os.networkInterfaces();
  let ipv4 = 'N/A', ipv6 = 'N/A', mac = 'N/A';

  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (!addr.internal) {
        if (addr.family === 'IPv4' && ipv4 === 'N/A') { ipv4 = addr.address; mac = addr.mac; }
        if (addr.family === 'IPv6' && ipv6 === 'N/A') ipv6 = addr.address;
      }
    }
  }

  res.json({ ipv4, ipv6, gateway: '10.0.2.2', dns: ['8.8.8.8', '8.8.4.4'], mac });
});

module.exports = router;
