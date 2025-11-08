const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Middleware to check authentication (copied from server.js)
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'Admin') {
        next();
    } else {
        console.log('❌ Forbidden: Not an admin');
        return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }
};

module.exports = (pool) => {

    // --- UPDATED ENDPOINT: Get data for the profile page ---
    router.get('/me/profile-data', isAuthenticated, async (req, res) => {
        console.log(`📈 Fetching profile data for user ${req.session.user.id}`);
        try {
            const userId = req.session.user.id;
            
            // 1. Get user's transaction history
            // We search for the 'adminUserId' which is injected into *all* transactions by the backend
            const historyResult = await pool.query(
                `SELECT index, timestamp, transaction, previous_hash AS "previousHash", hash 
                 FROM blockchain 
                 WHERE (transaction->>'adminUserId')::integer = $1 
                 ORDER BY index DESC`,
                [userId]
            );
            
            const history = historyResult.rows;

            // 2. *** STATS CALCULATION REMOVED ***
            
            // Return user and their history
            res.status(200).json({
                user: req.session.user,
                history: history
            });

        } catch (e) {
            console.error('❌ Error fetching profile data:', e);
            res.status(500).json({ message: e.message });
        }
    });

    // --- NEW ENDPOINT: Update user's own name and email ---
    router.put('/me/profile', isAuthenticated, async (req, res) => {
        console.log(`👤 Updating profile for user ${req.session.user.id}`);
        const { name, email } = req.body;
        const { id } = req.session.user;

        if (!name || !email) {
            return res.status(400).json({ message: 'Name and email are required' });
        }

        try {
            const result = await pool.query(
                'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, employee_id, name, email, role',
                [name, email, id]
            );
            
            const updatedUser = result.rows[0];
            
            // CRITICAL: Update the session with the new user data
            req.session.user = updatedUser;
            req.session.save((err) => {
                if (err) {
                    console.error('❌ Session save error after profile update:', err);
                    return res.status(500).json({ message: 'Failed to save session' });
                }
                console.log('✅ Profile updated. Session refreshed.');
                res.status(200).json({ message: 'Profile updated', user: updatedUser });
            });

        } catch (e) {
            if (e.code === '23505') {
                console.log('❌ Duplicate email');
                return res.status(409).json({ message: 'Email already exists' });
            }
            console.error('❌ Profile update error:', e);
            res.status(500).json({ message: e.message });
        }
    });

    // --- NEW ENDPOINT: Change user's own password ---
    router.put('/me/password', isAuthenticated, async (req, res) => {
        console.log(`🔑 Changing password for user ${req.session.user.id}`);
        const { currentPassword, newPassword } = req.body;
        const { id } = req.session.user;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'All password fields are required' });
        }
        
        if (newPassword.length < 6) {
             return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        try {
            // 1. Get current password hash
            const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
            const user = result.rows[0];

            // 2. Compare current password
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) {
                console.log('❌ Incorrect current password');
                return res.status(400).json({ message: 'Incorrect current password' });
            }

            // 3. Hash and save new password
            const salt = await bcrypt.genSalt(10);
            const newPasswordHash = await bcrypt.hash(newPassword, salt);

            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, id]);
            
            console.log('✅ Password changed successfully.');
            res.status(200).json({ message: 'Password changed successfully' });

        } catch (e) {
            console.error('❌ Password change error:', e);
            res.status(500).json({ message: e.message });
        }
    });


    // --- EXISTING ADMIN ENDPOINTS ---

    // GET /api/users (For Admin Panel & Login Dropdown)
    router.get('/', async (req, res) => {
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
    router.put('/:id/role', isAuthenticated, isAdmin, async (req, res) => {
        console.log('👤 Role change request');
        
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

    // PUT /api/users/:id/email (For Admin Panel)
    router.put('/:id/email', isAuthenticated, isAdmin, async (req, res) => {
        console.log('📧 Email change request');
        
        const { id } = req.params;
        const { email } = req.body;

        if (String(id) === String(req.session.user.id)) {
            console.log('❌ Cannot change own email via this panel');
            return res.status(400).json({ message: 'Cannot change your own email' });
        }

        try {
            const result = await pool.query(
                'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, employee_id, name, email, role',
                [email, id]
            );
            
            if (result.rows.length === 0) {
                console.log('❌ User not found:', id);
                return res.status(404).json({ message: 'User not found' });
            }

            console.log('✅ Email updated for:', result.rows[0].name, '→', email);
            res.status(200).json({ message: 'Email updated', user: result.rows[0] });
        
        } catch (e) {
            if (e.code === '23505') {
                console.log('❌ Duplicate email');
                return res.status(409).json({ message: 'Email already exists' });
            }
            console.error('❌ Email update error:', e);
            res.status(500).json({ message: e.message });
        }
    });

    // *** MODIFIED ENDPOINT: POST /api/users (For Admin Panel - Add User) ***
    router.post('/', isAuthenticated, isAdmin, async (req, res) => {
        console.log('➕ Add user request');
        
        const { name, email, role, password } = req.body;

        if (!name || !email || !role || !password) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ message: 'Name, email, role, and password are required' });
        }

        try {
            // --- THIS IS THE FIXED LOGIC ---

            // 1. Get the next ID from the sequence
            // (Assuming default sequence name 'users_id_seq')
            const idResult = await pool.query("SELECT nextval('users_id_seq') as id");
            const newUserId = idResult.rows[0].id;
            
            // 2. Generate the new employee_id using this ID
            const employeeId = `EMP-${String(newUserId).padStart(4, '0')}`;
            
            // 3. Hash the password
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // 4. Insert the complete record, including the manually fetched ID
            //    and the generated employeeId.
            await pool.query(
                `INSERT INTO users (id, employee_id, name, email, role, password_hash)
                VALUES ($1, $2, $3, $4, $5, $6)`,
                [newUserId, employeeId, name, email, role, passwordHash]
            );
            
            // 5. Fetch the final, complete user record to return
            const finalResult = await pool.query(
                'SELECT id, employee_id, name, email, role FROM users WHERE id = $1',
                [newUserId]
            );
            // --- END OF FIXED LOGIC ---

            console.log('✅ User created:', finalResult.rows[0].name);
            res.status(201).json({ message: 'User created', user: finalResult.rows[0] });
        
        } catch (e) {
            if (e.code === '23505') {
                console.log('❌ Duplicate email');
                return res.status(409).json({ message: 'Email already exists' });
            }
            if (e.code === '42P01') {
                // This means the sequence name 'users_id_seq' is wrong
                console.error('Database error: Sequence "users_id_seq" not found.');
                return res.status(500).json({ message: 'Database configuration error: User ID sequence not found.' });
            }
            console.error('❌ User creation error:', e);
            res.status(500).json({ message: e.message });
        }
    });

    // DELETE /api/users/:id (For Admin Panel)
    router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
        console.log('🗑️ Delete user request');
        
        const { id } = req.params;

        if (String(id) === String(req.session.user.id)) {
            console.log('❌ Cannot delete self');
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }

        try {
            const result = await pool.query(
                'DELETE FROM users WHERE id = $1 RETURNING name, email',
                [id]
            );
            
            if (result.rows.length === 0) {
                console.log('❌ User not found:', id);
                return res.status(404).json({ message: 'User not found' });
            }

            console.log('✅ User deleted:', result.rows[0].name);
            res.status(200).json({ message: 'User deleted', user: result.rows[0] });
        
        } catch (e) {
            console.error('❌ User deletion error:', e);
            res.status(500).json({ message: e.message });
        }
    });

    return router;
};