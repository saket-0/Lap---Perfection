// Lap/bims-backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const { 
    createBlock, 
    createGenesisBlock, 
    isChainValid,
    validateTransaction 
} = require('./chain-utils');

const app = express();
const port = 3000;

// --- 1. Database Connection ---
const pool = new Pool({
    user: 'deep',
    host: 'localhost',
    database: 'bims',
    password: 'password',
    port: 5432,
});

// CRITICAL: Set trust proxy
app.set('trust proxy', 1);

// --- 2. CORS Setup ---
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

// --- 3. Body Parser ---
app.use(express.json());

// --- 4. Session Setup ---
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

// Debug middleware to log every request
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

// A quick middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    console.log('Auth Check - User:', req.session.user ? req.session.user.email : 'MISSING');
    
    if (req.session.user) {
        next(); // User is logged in, continue
    } else {
        console.log('❌ Authentication failed - no user in session');
        res.status(401).json({ message: 'Not authenticated' });
    }
};

// --- 5. API Endpoints (Auth & Users) ---

// (All Auth and User endpoints are unchanged)
// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    console.log('\n🔐 LOGIN ATTEMPT');
    const { email, password } = req.body;
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            console.log('❌ Invalid password for:', email);
            return res.status(400).json({ message: 'Invalid password' });
        }
        
        const userForSession = {
            id: user.id,
            employee_id: user.employee_id,
            name: user.name,
            email: user.email,
            role: user.role
        };
        
        req.session.user = userForSession;
        
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ message: 'Failed to save session' });
            }
            console.log('✅ Login successful');
            console.log('Session ID:', req.sessionID);
            console.log('User:', userForSession.email);
            console.log('Role:', userForSession.role);
            
            res.status(200).json({ 
                message: 'Login successful', 
                user: userForSession 
            });
        });
        
    } catch (e) {
        console.error('❌ Login error:', e);
        res.status(500).json({ message: e.message });
    }
});

// GET /api/auth/me (Check session)
app.get('/api/auth/me', isAuthenticated, (req, res) => {
    console.log('✅ Session valid for:', req.session.user.name);
    res.status(200).json(req.session.user);
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req, res) => {
    console.log('🚪 Logout request');
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Logout error:', err);
            return res.status(500).json({ message: 'Could not log out' });
        }
        res.clearCookie('bims.sid');
        console.log('✅ Logout successful');
        res.status(200).json({ message: 'Logout successful' });
    });
});

// GET /api/users (For Admin Panel & Login Dropdown)
app.get('/api/users', async (req, res) => {
    console.log('📋 Fetching users list');
    try {
        const result = await pool.query('SELECT id, employee_id, name, email, role FROM users ORDER BY id');
        console.log(`✅ Found ${result.rows.length} users`);
        res.status(200).json(result.rows);
    } catch (e) {
        console.error('❌ Error fetching users:', e);
        res.status(500).json({ message: e.message });
    }
});

// PUT /api/users/:id/role (For Admin Panel)
app.put('/api/users/:id/role', isAuthenticated, async (req, res) => {
    console.log('👤 Role change request');
    console.log('Requester:', req.session.user.email, 'Role:', req.session.user.role);
    
    if (req.session.user.role !== 'Admin') {
        console.log('❌ Forbidden: Not an admin');
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    
    const { id } = req.params;
    const { role } = req.body;

    if (String(id) === String(req.session.user.id)) {
        console.log('❌ Cannot change own role');
        return res.status(400).json({ message: 'Cannot change your own role' });
    }

    try {
        const result = await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, employee_id, name, email, role',
            [role, id]
        );
        
        if (result.rows.length === 0) {
            console.log('❌ User not found:', id);
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('✅ Role updated:', result.rows[0].name, '→', role);
        res.status(200).json({ message: 'Role updated', user: result.rows[0] });
    } catch (e) {
        console.error('❌ Role update error:', e);
        res.status(500).json({ message: e.message });
    }
});

// POST /api/users (For Admin Panel - Add User)
app.post('/api/users', isAuthenticated, async (req, res) => {
    console.log('➕ Add user request');
    console.log('Requester:', req.session.user.email, 'Role:', req.session.user.role);
    
    if (req.session.user.role !== 'Admin') {
        console.log('❌ Forbidden: Not an admin');
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const { name, email, employeeId, role, password } = req.body;

    if (!name || !email || !employeeId || !role || !password) {
        console.log('❌ Missing required fields');
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const result = await pool.query(
            `INSERT INTO users (employee_id, name, email, role, password_hash)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, employee_id, name, email, role`,
            [employeeId, name, email, role, passwordHash]
        );
        
        console.log('✅ User created:', result.rows[0].name);
        res.status(201).json({ message: 'User created', user: result.rows[0] });
    
    } catch (e) {
        if (e.code === '23505') {
            console.log('❌ Duplicate email/employee ID');
            return res.status(409).json({ message: 'Email or Employee ID already exists' });
        }
        console.error('❌ User creation error:', e);
        res.status(500).json({ message: e.message });
    }
});


// --- 6. Blockchain Endpoints ---

// SQL query to select columns and alias them to camelCase
const SELECT_BLOCKCHAIN_FIELDS = `
    SELECT 
        index, 
        timestamp, 
        transaction, 
        previous_hash AS "previousHash", 
        hash 
    FROM blockchain
`;

// Helper function to get or create the Genesis block
async function getGenesisBlock() {
    // FIX 1: Use aliased SELECT
    let result = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} WHERE index = 0`);
    if (result.rows.length === 0) {
        console.log('🌱 No Genesis block found. Creating one...');
        try {
            const genesisBlock = await createGenesisBlock();
            await pool.query(
                'INSERT INTO blockchain (index, timestamp, transaction, previous_hash, hash) VALUES ($1, $2, $3, $4, $5)',
                [genesisBlock.index, genesisBlock.timestamp, genesisBlock.transaction, genesisBlock.previousHash, genesisBlock.hash]
            );
            console.log('🌱 Genesis block created.');
            // Return the newly created block (which is already in camelCase)
            return genesisBlock; 
        } catch (e) {
            if (e.code === '23505') { 
                console.log('Race condition: Genesis block already created by another process.');
                // FIX 2: Use aliased SELECT
                return (await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} WHERE index = 0`)).rows[0];
            }
            throw e;
        }
    }
    return result.rows[0]; // Return the existing block (now in camelCase)
}

// GET /api/blockchain - Fetches the entire blockchain
app.get('/api/blockchain', isAuthenticated, async (req, res) => {
    console.log('🔗 Fetching entire blockchain');
    try {
        await getGenesisBlock(); 
        // FIX 3: Use aliased SELECT
        const result = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
        res.status(200).json(result.rows);
    } catch (e) {
        console.error('❌ Error fetching blockchain:', e);
        res.status(500).json({ message: e.message });
    }
});

// POST /api/blockchain - Adds a new transaction (and creates a block)
app.post('/api/blockchain', isAuthenticated, async (req, res) => {
    console.log('📦 Adding new block');
    const transaction = req.body;
    
    transaction.userId = req.session.user.id;
    transaction.userName = req.session.user.name;
    transaction.employeeId = req.session.user.employee_id;

    try {
        await getGenesisBlock();
        
        // FIX 4: Use aliased SELECT
        const chainResult = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
        const currentChain = chainResult.rows;

        console.log('🔬 Validating transaction...');
        const { success, error } = validateTransaction(transaction, currentChain);
        if (!success) {
            console.log('❌ Validation failed:', error);
            return res.status(400).json({ message: error });
        }
        console.log('✅ Transaction is valid.');

        const lastBlock = currentChain[currentChain.length - 1];

        // This check now works because lastBlock.hash is correctly populated
        if (!lastBlock.hash) {
            console.error('❌ CRITICAL: Last block (Genesis) is missing a hash!');
            return res.status(500).json({ message: 'CRITICAL: Chain is corrupt. Please clear database.' });
        }

        const newIndex = lastBlock.index + 1;
        // lastBlock.hash is now correctly read from the aliased query
        const newBlock = await createBlock(newIndex, transaction, lastBlock.hash);

        await pool.query(
            'INSERT INTO blockchain (index, timestamp, transaction, previous_hash, hash) VALUES ($1, $2, $3, $4, $5)',
            // newBlock properties are already camelCase, which match the values
            [newBlock.index, newBlock.timestamp, newBlock.transaction, newBlock.previousHash, newBlock.hash]
        );
        
        console.log(`✅ Block ${newBlock.index} added to chain.`);
        res.status(201).json(newBlock);

    } catch (e) {
        console.error('❌ Error adding block:', e);
        res.status(500).json({ message: e.message });
    }
});

// GET /api/blockchain/verify - Verifies chain integrity
app.get('/api/blockchain/verify', isAuthenticated, async (req, res) => {
    console.log('🛡️ Verifying chain integrity...');
    if (req.session.user.role !== 'Admin' && req.session.user.role !== 'Auditor') {
        return res.status(403).json({ message: 'Forbidden: Admin or Auditor access required' });
    }

    try {
        await getGenesisBlock();
        
        // FIX 5: Use aliased SELECT
        const result = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
        const blocks = result.rows; // blocks now have camelCase properties
        
        const isValid = await isChainValid(blocks); // This will now work!
        
        if (isValid) {
            console.log('✅ Chain is valid.');
            res.status(200).json({ isValid: true, message: 'Blockchain integrity verified.' });
        } else {
            console.log('❌ CHAIN IS INVALID!');
            res.status(500).json({ isValid: false, message: 'CRITICAL: Chain has been tampered with!' });
        }
    } catch (e) {
        console.error('❌ Error verifying chain:', e);
        res.status(500).json({ message: e.message });
    }
});

// DELETE /api/blockchain - Clears the chain (Admin only)
app.delete('/api/blockchain', isAuthenticated, async (req, res) => {
    console.log('🗑️ Clearing blockchain');
    if (req.session.user.role !== 'Admin') {
        console.log('❌ Forbidden: Not an admin');
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
    
    try {
        // This logic is correct: wipe everything, then create a new Genesis.
        await pool.query('DELETE FROM blockchain');
        console.log('✅ Entire chain wiped.');
        
        const genesisBlock = await getGenesisBlock(); // This will run the create logic
        
        // Return the new chain (genesisBlock is already camelCase)
        res.status(200).json({ message: 'Blockchain cleared', chain: [genesisBlock] });
        
    } catch (e) {
        console.error('❌ Error clearing chain:', e);
        res.status(500).json({ message: e.message });
    }
});


// --- 7. Start Server ---
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