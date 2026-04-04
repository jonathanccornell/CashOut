const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '8d5ae191caf7b9ba029e90f6c538f3008e51037ea658995ac844ae814c616bbb';

const TIERS = {
  sharp: ['lock', 'chat', 'history'],
  elite: ['lock', 'chat', 'history', 'live_alerts'],
};

function generateToken(email, tier, stripeCustomerId) {
  return jwt.sign(
    { email, tier, stripeCustomerId },
    JWT_SECRET,
    { expiresIn: '90d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function hasAccess(token, feature) {
  const payload = verifyToken(token);
  if (!payload) return false;
  return TIERS[payload.tier]?.includes(feature) || false;
}

module.exports = { generateToken, verifyToken, hasAccess, TIERS };
