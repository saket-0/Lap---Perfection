const express = require('express');
const router = express.Router();

// Import blockchain utilities
const { 
    createBlock, 
    createGenesisBlock, 
    isChainValid,
    validateTransaction,
    rebuildStateAt
} = require('../chain-utils');

// Middleware to check authentication (copied from server.js)
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
};

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

// *** NEW ***
// Define transaction types that bypass inventory validation
const ADMIN_TRANSACTION_TYPES = [
    'ADMIN_CREATE_USER',
    'ADMIN_EDIT_ROLE',
    'ADMIN_EDIT_EMAIL',
    'ADMIN_DELETE_USER',
    'USER_UPDATE_PROFILE', // <-- ADDED
    'USER_CHANGE_PASSWORD' // <-- ADDED
];

module.exports = (pool) => {

    // Helper function to get or create the Genesis block
    async function getGenesisBlock() {
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
                return genesisBlock; 
            } catch (e) {
                if (e.code === '23505') { 
                    console.log('Race condition: Genesis block already created by another process.');
                    return (await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} WHERE index = 0`)).rows[0];
                }
                throw e;
            }
        }
        return result.rows[0];
    }

    // GET /api/blockchain - Fetches the entire blockchain
    router.get('/', isAuthenticated, async (req, res) => {
        console.log('🔗 Fetching entire blockchain');
        try {
            await getGenesisBlock(); 
            const result = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
            res.status(200).json(result.rows);
        } catch (e) {
            console.error('❌ Error fetching blockchain:', e);
            res.status(500).json({ message: e.message });
        }
    });

    // POST /api/blockchain - Adds a new transaction (and creates a block)
    router.post('/', isAuthenticated, async (req, res) => {
        console.log('📦 Adding new block');
        const transaction = req.body;
        
        // Inject user details from the session
        // This is the ADMIN/USER performing the action
        transaction.adminUserId = req.session.user.id;
        transaction.adminUserName = req.session.user.name;
        transaction.adminEmployeeId = req.session.user.employee_id;

        try {
            await getGenesisBlock();
            
            const chainResult = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
            const currentChain = chainResult.rows;

            // *** MODIFIED VALIDATION STEP ***
            if (ADMIN_TRANSACTION_TYPES.includes(transaction.txType)) {
                // This is an admin or user profile action.
                // It doesn't affect inventory, so we don't validate it
                // against the inventory state. We just trust it and log it.
                console.log(`✅ Admin/Profile action detected (${transaction.txType}). Bypassing inventory validation.`);
            } else {
                // This is an inventory transaction. Validate it.
                console.log('🔬 Validating inventory transaction...');
                const { success, error } = validateTransaction(transaction, currentChain);
                if (!success) {
                    console.log('❌ Validation failed:', error);
                    return res.status(400).json({ message: error });
                }
                console.log('✅ Transaction is valid.');
            }
            // *** END MODIFICATION ***

            const lastBlock = currentChain[currentChain.length - 1];

            if (!lastBlock.hash) {
                console.error('❌ CRITICAL: Last block (Genesis) is missing a hash!');
                return res.status(500).json({ message: 'CRITICAL: Chain is corrupt. Please clear database.' });
            }

            const newIndex = lastBlock.index + 1;
            const newBlock = await createBlock(newIndex, transaction, lastBlock.hash);

            await pool.query(
                'INSERT INTO blockchain (index, timestamp, transaction, previous_hash, hash) VALUES ($1, $2, $3, $4, $5)',
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
    router.get('/verify', isAuthenticated, async (req, res) => {
        console.log('🛡️ Verifying chain integrity...');
        if (req.session.user.role !== 'Admin' && req.session.user.role !== 'Auditor') {
            return res.status(403).json({ message: 'Forbidden: Admin or Auditor access required' });
        }

        try {
            await getGenesisBlock();
            
            const result = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
            const blocks = result.rows;
            
            const isValid = await isChainValid(blocks);
            
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

    // GET /api/blockchain/state-at?timestamp=... - Gets a snapshot of the inventory
    router.get('/state-at', isAuthenticated, async (req, res) => {
        console.log('⏳ Generating historical state snapshot...');
        
        if (req.session.user.role !== 'Admin' && req.session.user.role !== 'Auditor') {
            return res.status(403).json({ message: 'Forbidden: Admin or Auditor access required' });
        }

        const { timestamp } = req.query;
        if (!timestamp) {
            return res.status(400).json({ message: 'A valid "timestamp" query parameter is required.' });
        }
        
        try {
            await getGenesisBlock();
            const chainResult = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
            const currentChain = chainResult.rows;

            const { inventory, transactionCount } = rebuildStateAt(currentChain, timestamp);

            let totalValue = 0;
            let totalUnits = 0;
            const serializableInventory = [];

            inventory.forEach((product, sku) => {
                let totalStock = 0;
                product.locations.forEach(qty => totalStock += qty);
                
                totalUnits += totalStock;
                totalValue += (product.price || 0) * totalStock;

                serializableInventory.push([
                    sku,
                    {
                        productName: product.productName,
                        price: product.price,
                        category: product.category,
                        locations: Array.from(product.locations.entries())
                    }
                ]);
            });

            console.log(`✅ Snapshot generated for ${timestamp}.`);
            
            res.status(200).json({
                snapshotTime: timestamp,
                kpis: {
                    totalValue,
                    totalUnits,
                    transactionCount
                },
                inventory: serializableInventory
            });

        } catch (e) {
            console.error('❌ Error generating snapshot:', e);
            res.status(500).json({ message: e.message });
        }
    });

    // DELETE /api/blockchain - Clears the chain (Admin only)
    router.delete('/', isAuthenticated, async (req, res) => {
        console.log('🗑️ Clearing blockchain');
        if (req.session.user.role !== 'Admin') {
            console.log('❌ Forbidden: Not an admin');
            return res.status(403).json({ message: 'Forbidden: Admin access required' });
        }
        
        try {
            await pool.query('DELETE FROM blockchain');
            console.log('✅ Entire chain wiped.');
            
            const genesisBlock = await getGenesisBlock(); // This will re-create it
            
            res.status(200).json({ message: 'Blockchain cleared', chain: [genesisBlock] });
            
        } catch (e) {
            console.error('❌ Error clearing chain:', e);
            res.status(500).json({ message: e.message });
        }
    });

    return router;
};