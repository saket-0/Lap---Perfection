// seed.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// WARNING: Use environment variables in a real app
const pool = new Pool({
    user: 'deep',
    host: 'localhost',
    database: 'bims',
    password: 'password',
    port: 5432,
});

const MOCK_USERS = [
    { employeeId: 'EMP-20251029-0001', name: 'Dr. Admin Ji', email: 'admin@bims.com', role: 'Admin' },
    { employeeId: 'EMP-20251029-0002', name: 'Manager Babu', email: 'manager@bims.com', role: 'Inventory Manager' },
    { employeeId: 'EMP-20251029-0003', name: 'Auditor Saabji', email: 'auditor@bims.com', role: 'Auditor' }
];

async function seedDatabase() {
    console.log('Seeding database...');
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN'); // Start transaction
        
        // Hash the default password 'password'
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('password', salt);

        for (const user of MOCK_USERS) {
            // await client.query(
            //     `INSERT INTO users (employee_id, name, email, role, password_hash)
            //      VALUES ($1, $2, $3, $4, $5)
            //      ON CONFLICT (email) DO NOTHING;`, // Prevents errors if already run
            //     [user.employeeId, user.name, user.email, user.role, passwordHash]
            // );
        



                    // New code for seed.js
            await client.query(
                `INSERT INTO users (employee_id, name, email, role, password_hash)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (email) DO UPDATE SET
                name = EXCLUDED.name,
                employee_id = EXCLUDED.employee_id,
                role = EXCLUDED.role;`, // This line is now fixed
                [user.employeeId, user.name, user.email, user.role, passwordHash]
            );

        }

        
        await client.query('COMMIT'); // Commit transaction
        console.log('Database seeded successfully!');
    } catch (e) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Error seeding database:', e);
    } finally {
        client.release();
        pool.end();
    }
}

seedDatabase();