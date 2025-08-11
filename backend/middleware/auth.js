const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Verify JWT token middleware
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if user exists and is active
        const [users] = await pool.execute(
            'SELECT id, email, subscription_status, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expired'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        console.error('Token verification error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

// Optional token verification (for routes that can work with or without auth)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(); // Continue without user data
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [users] = await pool.execute(
            'SELECT id, email, subscription_status, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (users.length > 0 && users[0].is_active) {
            req.user = users[0];
        }

        next();
    } catch (error) {
        // Continue without user data if token is invalid
        next();
    }
};

// Check subscription level middleware
const requireSubscription = (requiredLevel = 'premium') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const subscriptionLevels = {
            'free': 0,
            'premium': 1,
            'pro': 2
        };

        const userLevel = subscriptionLevels[req.user.subscription_status] || 0;
        const requiredLevelValue = subscriptionLevels[requiredLevel] || 0;

        if (userLevel < requiredLevelValue) {
            return res.status(403).json({
                success: false,
                error: `${requiredLevel} subscription required`
            });
        }

        next();
    };
};

// Rate limiting helper
const createRateLimiter = (maxRequests, windowMs) => {
    const requests = new Map();

    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old requests
        if (requests.has(key)) {
            requests.set(key, requests.get(key).filter(timestamp => timestamp > windowStart));
        } else {
            requests.set(key, []);
        }

        const userRequests = requests.get(key);

        if (userRequests.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: 'Too many requests, please try again later'
            });
        }

        userRequests.push(now);
        next();
    };
};

module.exports = {
    verifyToken,
    optionalAuth,
    requireSubscription,
    createRateLimiter
}; 