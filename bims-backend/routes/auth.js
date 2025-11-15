const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Middleware just for this route file
const isAuthenticated = (req, res, next) => {
    console.log('Auth Check - User:', req.session.user ? req.session.user.email : 'MISSING');
    
    if (req.session.user) {
        next(); // User is logged in, continue
    } else {
        console.log('❌ Authentication failed - no user in session');
        res.status(401).json({ message: 'Not authenticated' });
    }
};

// Export a function that takes the db pool
module.exports = (pool) => {
    
    // POST /api/auth/login
    router.post('/login', async (req, res) => {
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
            
            // --- MODIFIED: Changed callback to async to log to permanent table ---
            req.session.save(async (err) => { 
                if (err) {
                    console.error('❌ Session save error:', err);
                    return res.status(500).json({ message: 'Failed to save session' });
                }
                
                // *** NEW: Log to permanent login_history table ***
                try {
                    await pool.query(
                        'INSERT INTO login_history (user_id, login_time) VALUES ($1, NOW())',
                        [userForSession.id]
                    );
                    console.log(`✅ Login event recorded in permanent history table for ${userForSession.email}.`);
                } catch (e) {
                    // Log but do not fail the login process
                    console.error('❌ Error recording permanent login history (Non-critical):', e);
                }
                // *** END NEW LOGIC ***
                
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
    router.get('/me', isAuthenticated, (req, res) => {
        console.log('✅ Session valid for:', req.session.user.name);
        res.status(200).json(req.session.user);
    });

    // --- THIS IS THE UPDATED LOGOUT FUNCTION ---
    // POST /api/auth/logout
    router.post('/logout', (req, res) => {
        console.log('🚪 Logout request');

        if (req.session && req.session.user) { // Check for user
            // Get user data *before* modifying session
            const userForLog = req.session.user;

            // vvv THIS IS THE FIX vvv
            // Stop this session from rolling (which would update expiry to +5min)
            req.session.cookie.rolling = false; 
            // Set maxAge to 0, forcing connect-pg-simple to update the
            // 'expire' column in the database to the current time.
            req.session.cookie.maxAge = 0; 
            // ^^^ END OF FIX ^^^
            
            // *** DO NOT SET req.session.user = null ***
            // We leave the user object attached so the query
            // (sess->'user'->>'id') can find this expired session.
            
            // Save this expired state to the database
            req.session.save((err) => { 
                if (err) {
                    console.error('❌ Logout error (session save):', err);
                    return res.status(500).json({ message: 'Could not log out' });
                }
                
                // Tell the browser to clear its cookie
                res.clearCookie('bims.sid'); 
                console.log(`✅ Logout successful (session for ${userForLog.email} expired and saved)`);
                res.status(200).json({ message: 'Logout successful' });
            });
        } else {
            // No session to begin with
            res.clearCookie('bims.sid');
            console.log('✅ Logout (no session)');
            res.status(200).json({ message: 'Logout successful' });
        }
    });
    // --- END OF UPDATE ---
    
    // Return the router
    return router;
};