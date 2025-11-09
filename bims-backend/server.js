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
const analyticsRoutes = require('./routes/analytics');
const locationRoutes = require('./routes/locations'); 
const categoryRoutes = require('./routes/categories'); 

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

// --- ** NEW: SSE Client Storage ** ---
let sseClients = [];

/**
 * ** NEW: Broadcasts a message to all connected SSE clients
 * @param {string} eventName The name of the event (e.g., 'new-block')
 * @param {object} data The data object to send
 */
const broadcastToClients = (eventName, data) => {
    console.log(`Broadcasting event '${eventName}' to ${sseClients.length} clients...`);
    
    // Format the SSE message
    const message = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    
    sseClients.forEach(client => {
        client.res.write(message);
    });
};
// --- ** END NEW ** ---

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
// ** MODIFIED: Store session middleware in a variable **
const sessionMiddleware = session({
    store: new PgSession({
        pool: pool,
        tableName: 'user_sessions'
    }),
    secret: 'your_very_strong_secret_key_here', // <-- IMPORTANT: Change this to a real secret
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        maxAge: 5 * 60 * 1000, // 5 minutes
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        domain: undefined
    },
    name: 'bims.sid',
    rolling: true
});
app.use(sessionMiddleware); // Use the middleware

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
// *** MODIFIED: Pass broadcastToClients to blockchain routes ***
app.use('/api/blockchain', blockchainRoutes(pool, broadcastToClients));
app.use('/api/analytics', analyticsRoutes(pool));
app.use('/api/locations', locationRoutes(pool)); 
app.use('/api/categories', categoryRoutes(pool)); 

// --- ** 8. NEW: Server-Sent Events (SSE) Endpoint ** ---
const isAuthenticatedSSE = (req, res, next) => {
    // This middleware re-checks authentication for the persistent SSE connection
    if (req.session.user) {
        next();
    } else {
        // Don't send JSON, just end the request for SSE
        console.log('❌ SSE connection blocked: Not authenticated');
        res.status(401).end('Not authenticated');
    }
};

app.get('/api/events', sessionMiddleware, isAuthenticatedSSE, (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Send headers immediately

    const clientId = req.session.user.id;
    const clientEmail = req.session.user.email;
    const newClient = { id: clientId, res: res };
    sseClients.push(newClient);
    console.log(`Client ${clientEmail} (ID: ${clientId}) connected to SSE.`);

    // Send a connection confirmation
    res.write('event: connected\ndata: Session established\n\n');

    // Handle client disconnect
    req.on('close', () => {
        console.log(`Client ${clientEmail} (ID: ${clientId}) disconnected from SSE.`);
        sseClients = sseClients.filter(client => client.res !== res);
    });
});
// --- ** END NEW SSE SECTION ** ---


// --- 9. Start Server ---
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