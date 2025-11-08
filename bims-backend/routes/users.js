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

    // *** NEW ENDPOINT ***
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

    // POST /api/users (For Admin Panel - Add User)
    router.post('/', isAuthenticated, isAdmin, async (req, res) => {
        console.log('➕ Add user request');
        
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

    // *** NEW ENDPOINT ***
    // DELETE /api/users/:id (For Admin Panel)
    router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
        console.log('🗑️ Delete user request');
        
        const { id } = req.params;

        if (String(id) === String(req.session.user.id)) {
            console.log('❌ Cannot delete self');
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }

        try {
            // Note: In a real system, we'd also check if this user has
            // associated transactions and perhaps "archive" instead.
            // For this project, a hard delete is acceptable.
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