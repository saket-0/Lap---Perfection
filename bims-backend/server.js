// Lap/bims-backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

// --- 1. Import Route Files ---
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const blockchainRoutes = require('./routes/blockchain');

const app = express();
const port = 3000;

// --- 2. Database Connection ---
const pool = new Pool({
    user: 'deep',
    host: 'localhost',
    database: 'bims',
    password: 'password',
    port: 5432,
});

// CRITICAL: Set trust proxy
app.set('trust proxy', 1);

// --- 3. CORS Setup ---
app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = [
            'http://127.0.0.1:5500', 
            'http://localhost:5500', 
            'http://127.0.0.1:5501', 
            'http://localhost:5501'
        ];
        
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie']
}));

// --- 4. Body Parser ---
app.use(express.json());

// --- 5. Session Setup ---
app.use(session({
    store: new PgSession({
        pool: pool,
        tableName: 'user_sessions'
    }),
    secret: 'your_very_strong_secret_key_here',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        domain: undefined
    },
    name: 'bims.sid',
    rolling: true
}));

// --- 6. Debug Middleware ---
app.use((req, res, next) => {
    console.log('\n--- NEW REQUEST ---');
    console.log('Method:', req.method);
    console.log('Path:', req.path);
    console.log('Origin:', req.headers.origin);
    console.log('Cookie Header:', req.headers.cookie);
    console.log('Session ID:', req.sessionID);
    console.log('Session User:', req.session.user ? req.session.user.email : 'NONE');
    next();
});

// --- 7. Mount API Endpoints ---
// Pass the 'pool' object to the route handlers
app.use('/api/auth', authRoutes(pool));
app.use('/api/users', userRoutes(pool));
app.use('/api/blockchain', blockchainRoutes(pool));


// --- 8. Start Server ---
app.listen(port, '127.0.0.1', () => {
    console.log('\n=================================');
    console.log('🚀 BIMS Server Started');
    console.log('=================================');
    console.log('URL: http://127.0.0.1:3000');
    console.log('CORS Origins:');
    console.log('  - http://127.0.0.1:5500');
    console.log('  - http://localhost:5500');
    console.log('=================================\n');
});