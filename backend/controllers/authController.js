const User = require('../models/User');
const jwt = require('jsonwebtoken');

const getCookieOptions = () => {
  return {
    httpOnly: true,  // Preventing client-side JS from reading the cookie
    secure: process.env.NODE_ENV === 'production',  // HTTPS only when in production
    sameSite: 'strict',  // Prevents CSRF attacks
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  };
};

// Controller to Register a new user
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Checking if the user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Creating new user to the database
    user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // sending token as HTTP-only cookie
    res.cookie('token', token, getCookieOptions());

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller to Login a user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Checking if the user exists or not
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generating JWT token to send as HTTP-only cookie
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Sending token as HTTP-only cookie
    res.cookie('token', token, getCookieOptions());

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Logout user
exports.logout = (req, res) => {
  try {
    // Clear the token cookie
    res.clearCookie('token', getCookieOptions());
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};