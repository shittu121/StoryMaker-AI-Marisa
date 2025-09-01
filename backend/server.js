require('dotenv').config();
// Required environment variables:
// - OPENAI_API_KEY: OpenAI API key for story generation
// - MURF_API_KEY: Murf.ai API key for text-to-speech
// - JWT_SECRET: JWT secret for authentication
// - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME: Database configuration


const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { testConnection, initDatabase } = require('./config/database');
const path = require('path');
const https = require('https');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth');
const storiesRoutes = require('./routes/stories');
const transcriptRoutes = require('./routes/transcript');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = process.env.PORT || 5000;
const SSL_PORT = 7777;

// SSL certificate paths
// const ssl_cert = '/etc/letsencrypt/live/nocodelauncher.com/fullchain.pem';
// const ssl_key = '/etc/letsencrypt/live/nocodelauncher.com/privkey.pem';

// Security middleware with CSP configuration
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "http://localhost:5000", "https://api.openai.com", "https://api.murf.ai"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://storymaker.nocodelauncher.com', 'https://strorymaker.nocodelauncher.com']
        : ['http://localhost:5173', 'http://localhost:5000', 'http://localhost:5555'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use(limiter);

// Body parsing middleware with increased limits for image processing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/transcript', transcriptRoutes);
app.use('/api/media', mediaRoutes);

// Serve static files from the frontend build (dist)
app.use(express.static(path.join(__dirname, '../dist')));

// SPA Fallback: serve index.html for any unknown route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);

    // Don't leak error details in production
    const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message;

    res.status(error.status || 500).json({
        success: false,
        error: errorMessage
    });
});

// Initialize database and start server
const startServer = async () => {
    try {
        // Test database connection
        const isConnected = await testConnection();
        if (!isConnected) {
            console.error('❌ Failed to connect to database. Exiting...');
            process.exit(1);
        }

        // Initialize database tables
        await initDatabase();

        // SSL options
        // const sslOptions = {
        //     cert: fs.readFileSync(ssl_cert),
        //     key: fs.readFileSync(ssl_key)
        // };

        // Start HTTP server
        app.listen(PORT, () => {
            console.log(`🚀 HTTP Server running on port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/health`);
            console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
            console.log(`📚 Stories API: http://localhost:${PORT}/api/stories`);
            console.log(`🎙️ Transcript API: http://localhost:${PORT}/api/transcript`);
            console.log(`🎬 Media API: http://localhost:${PORT}/api/media`);
        });

        // Start HTTPS server
        // https.createServer(sslOptions, app).listen(SSL_PORT, () => {
        //     console.log(`🔒 HTTPS Server running on port ${SSL_PORT}`);
        //     console.log(`🔗 Health check: https://storymaker.nocodelauncher.com/health`);
        //     console.log(`🔐 Auth API: https://storymaker.nocodelauncher.com/api/auth`);
        //     console.log(`📚 Stories API: https://storymaker.nocodelauncher.com/api/stories`);
        // });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the server
startServer(); 