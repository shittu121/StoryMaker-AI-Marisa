const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { verifyToken, createRateLimiter } = require('../middleware/auth');
const { ref } = require('process');

const router = express.Router();

// Rate limiting
const authRateLimiter = createRateLimiter(50, 15 * 60 * 1000); // 50 requests per 15 minutes

// Validation rules
const registerValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('password').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const loginValidation = [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
];

// Helper function to generate tokens
const generateTokens = (userId) => {
    const accessToken = jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    return { accessToken, refreshToken };
};

// Register new user
router.post('/register', authRateLimiter, registerValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: errors.array()[0].msg
            });
        }

        const { email, password } = req.body;

        // Check if user already exists
        const [existingUsers] = await pool.execute(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        console.log(existingUsers)
        if (existingUsers.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Hash password
        const saltRounds = 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const [result] = await pool.execute(
            'INSERT INTO users (email, password_hash) VALUES (?, ?)',
            [email, passwordHash]
        );
        console.log(result)
        const userId = result.insertId;

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(userId);
        console.log(accessToken, refreshToken)
        // Store refresh token
        const refreshExpiresAt = new Date();
        refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);

        await pool.execute(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [userId, refreshToken, refreshExpiresAt]
        );

        // Get user data
        const [users] = await pool.execute(
            'SELECT id, email, subscription_status, created_at, updated_at FROM users WHERE id = ?',
            [userId]
        );

        const user = users[0];
        console.log(user)
        res.status(201).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    subscriptionStatus: user.subscription_status,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                },
                token: accessToken
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Login user
router.post('/login', authRateLimiter, loginValidation, async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: errors.array()[0].msg
            });
        }

        const { email, password } = req.body;

        // Find user
        const [users] = await pool.execute(
            'SELECT id, email, password_hash, subscription_status, is_active, created_at, updated_at FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        const user = users[0];

        // Check if account is active
        if (!user.is_active) {
            return res.status(401).json({
                success: false,
                error: 'Account is deactivated'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(user.id);

        // Store refresh token
        const refreshExpiresAt = new Date();
        refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);

        await pool.execute(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
            [user.id, refreshToken, refreshExpiresAt]
        );

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    subscriptionStatus: user.subscription_status,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                },
                token: accessToken
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token is required'
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

        if (decoded.type !== 'refresh') {
            return res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }

        // Check if refresh token exists in database
        const [tokens] = await pool.execute(
            'SELECT user_id, expires_at FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
            [refreshToken]
        );

        if (tokens.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired refresh token'
            });
        }

        const tokenData = tokens[0];

        // Check if user exists and is active
        const [users] = await pool.execute(
            'SELECT id, is_active FROM users WHERE id = ?',
            [tokenData.user_id]
        );

        if (users.length === 0 || !users[0].is_active) {
            return res.status(401).json({
                success: false,
                error: 'User not found or account deactivated'
            });
        }

        // Generate new tokens
        const newTokens = generateTokens(tokenData.user_id);

        // Update refresh token in database
        const newRefreshExpiresAt = new Date();
        newRefreshExpiresAt.setDate(newRefreshExpiresAt.getDate() + 30);

        await pool.execute(
            'UPDATE refresh_tokens SET token = ?, expires_at = ? WHERE token = ?',
            [newTokens.refreshToken, newRefreshExpiresAt, refreshToken]
        );

        res.json({
            success: true,
            data: {
                token: newTokens.accessToken
            }
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Refresh token expired'
            });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }

        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Token refresh failed'
        });
    }
});

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, subscription_status, created_at, updated_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = users[0];

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    subscriptionStatus: user.subscription_status,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get profile'
        });
    }
});

// Update user profile
router.put('/profile', verifyToken, [
    body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('subscription_status').optional().isIn(['free', 'premium', 'pro']).withMessage('Invalid subscription status')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: errors.array()[0].msg
            });
        }

        const { email, subscription_status } = req.body;
        const updates = {};
        const values = [];

        if (email !== undefined) {
            // Check if email is already taken by another user
            const [existingUsers] = await pool.execute(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, req.user.id]
            );

            if (existingUsers.length > 0) {
                return res.status(409).json({
                    success: false,
                    error: 'Email is already taken'
                });
            }

            updates.email = email;
            values.push(email);
        }

        if (subscription_status !== undefined) {
            updates.subscription_status = subscription_status;
            values.push(subscription_status);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }

        // Build update query
        const updateFields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
        values.push(req.user.id);

        await pool.execute(
            `UPDATE users SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            values
        );

        // Get updated user data
        const [users] = await pool.execute(
            'SELECT id, email, subscription_status, created_at, updated_at FROM users WHERE id = ?',
            [req.user.id]
        );

        const user = users[0];

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    subscriptionStatus: user.subscription_status,
                    createdAt: user.created_at,
                    updatedAt: user.updated_at
                }
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile'
        });
    }
});

// Logout user
router.post('/logout', verifyToken, async (req, res) => {
    try {
        // Delete all refresh tokens for this user
        await pool.execute(
            'DELETE FROM refresh_tokens WHERE user_id = ?',
            [req.user.id]
        );

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

module.exports = router; 