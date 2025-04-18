const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Get token from cookie
  let token=null;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // Option 2: Check for token in Authorization header (Bearer token)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  // console.log(`token recieved in backend: ${token}`)
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Add user id to request
    // console.log(`decoded :${decoded.userId}`)
    req.user = { id: decoded.userId };
    next();
  } catch (error) {
    console.error("JWT verification error:", error);
    res.status(401).json({ message: 'Invalid authentication token' });
  }
};