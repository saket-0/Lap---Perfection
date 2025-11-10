// bims-backend/routes/analytics.js
const express = require('express');
const router = express.Router();
const { rebuildStateAt } = require('../chain-utils');

// Middleware to check authentication
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

// Helper function for standard deviation
const getStdDev = (array) => {
    if (array.length === 0) return 0;
    const n = array.length;
    const mean = array.reduce((a, b) => a + b) / n;
    const stdDev = Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n);
    return { mean, stdDev };
};

module.exports = (pool) => {

    /**
     * *** MODIFIED ENDPOINT: Consolidated KPIs ***
     * GET /api/analytics/kpis
     * Calculates several new insightful KPIs for the main analytics page.
     */
    router.get('/kpis', isAuthenticated, async (req, res) => {
        console.log('📈 Generating new analytics KPIs...');
        try {
            const chainResult = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
            const currentChain = chainResult.rows;
            
            // --- NEW: Fetch active locations from DB ---
            const locationsResult = await pool.query('SELECT name FROM locations WHERE is_archived = false');
            const activeLocations = locationsResult.rows.map(r => r.name);
            // --- END NEW ---

            if (currentChain.length <= 1) {
                return res.status(200).json({
                    topMovers: [],
                    highValueItems: [],
                    staleInventory: [],
                    dateLabels: [],
                    txMixLineData: {},
                    locationActivityData: {}
                });
            }

            const { inventory } = rebuildStateAt(currentChain, new Date().toISOString());
            
            const now = new Date();
            const ninetyDaysAgo = new Date(new Date().setDate(now.getDate() - 90));

            // --- NEW: Generate 7-Day Labels ---
            const dateLabels = [];
            const dayMap = new Map(); // Maps 'YYYY-MM-DD' to index 0-6
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const label = d.toISOString().split('T')[0];
                dateLabels.push(label);
                dayMap.set(label, 6 - i);
            }
            const sevenDaysAgo = new Date(new Date().setDate(now.getDate() - 7));
            // --- END NEW ---
            
            // --- 2. Top Movers (30d) ---
            const thirtyDaysAgo = new Date(new Date().setDate(now.getDate() - 30));
            const topMoversMap = new Map();
            
            // --- 3. Stale Inventory (90d) ---
            const recentMovement = new Set();
            
            // --- 4. NEW: Data for Line Charts ---
            const txMixLineData = {
                'CREATE_ITEM': Array(7).fill(0),
                'STOCK_IN': Array(7).fill(0),
                'STOCK_OUT': Array(7).fill(0),
                'MOVE': Array(7).fill(0)
            };
            const locationActivityData = {};
            activeLocations.forEach(loc => {
                locationActivityData[loc] = Array(7).fill(0);
            });
            // --- END NEW ---
            
            currentChain.forEach(block => {
                if (block.index === 0) return;
                const tx = block.transaction;
                const blockDate = new Date(block.timestamp);

                // 2. Top Movers
                if (tx.txType === 'STOCK_OUT' && blockDate > thirtyDaysAgo) {
                    topMoversMap.set(tx.itemSku, (topMoversMap.get(tx.itemSku) || 0) + tx.quantity);
                }

                // 3. Stale Inventory
                if ((tx.txType === 'STOCK_OUT' || tx.txType === 'MOVE') && blockDate > ninetyDaysAgo) {
                    recentMovement.add(tx.itemSku);
                }

                // --- 4. NEW: Populate Line Chart Data ---
                if (blockDate > sevenDaysAgo) {
                    const dateStr = blockDate.toISOString().split('T')[0];
                    if (dayMap.has(dateStr)) {
                        const dayIndex = dayMap.get(dateStr);

                        // A. Populate Tx Mix Data
                        if (txMixLineData[tx.txType]) {
                            txMixLineData[tx.txType][dayIndex]++;
                        }

                        // B. Populate Location Activity Data
                        if (tx.location && locationActivityData[tx.location]) {
                            locationActivityData[tx.location][dayIndex]++;
                        }
                        if (tx.toLocation && locationActivityData[tx.toLocation]) {
                            locationActivityData[tx.toLocation][dayIndex]++;
                        }
                        if (tx.fromLocation && locationActivityData[tx.fromLocation]) {
                            locationActivityData[tx.fromLocation][dayIndex]++;
                        }
                    }
                }
                // --- END NEW ---
            });

            // --- Process KPIs ---

            // 2. Process Top Movers
            const topMovers = Array.from(topMoversMap.entries())
                .sort((a, b) => b[1] - a[1]) // Sort descending by quantity
                .slice(0, 5) // Get top 5
                .map(([sku, quantity]) => ({
                    sku,
                    name: inventory.get(sku)?.productName || 'N/A',
                    quantity
                }));
            
            // 3. Process Stale Inventory
            const staleInventory = [];
            inventory.forEach((product, sku) => {
                // *** ADDED THIS CHECK ***
                if (product.is_deleted) return; 
                
                if (!recentMovement.has(sku)) {
                    let totalStock = 0;
                    product.locations.forEach(qty => totalStock += qty);
                    if (totalStock > 0) { // Only list if it's in stock
                        staleInventory.push({
                            sku,
                            name: product.productName,
                            stock: totalStock
                        });
                    }
                }
            });

            // --- 4. High-Value Items ---
            const highValueItems = [];
            inventory.forEach((product, sku) => {
                // *** ADDED THIS CHECK ***
                if (product.is_deleted) return; 

                let totalStock = 0;
                product.locations.forEach(qty => totalStock += qty);
                if (totalStock > 0) {
                    highValueItems.push({
                        sku,
                        name: product.productName,
                        stock: totalStock,
                        value: totalStock * (product.price || 0)
                    });
                }
            });
            
            const sortedHighValue = highValueItems
                .sort((a, b) => b.value - a.value) // Sort descending by value
                .slice(0, 5); // Get top 5

            
            console.log('✅ New KPIs generated.');
            res.status(200).json({
                // txMix: (REMOVED)
                topMovers: topMovers,
                highValueItems: sortedHighValue,
                staleInventory: staleInventory.slice(0, 5),
                dateLabels: dateLabels,                 // ADDED
                txMixLineData: txMixLineData,           // ADDED
                locationActivityData: locationActivityData // ADDED
            });

        } catch (e) {
            console.error('❌ Error in KPI generation:', e);
            res.status(500).json({ message: e.message });
        }
    });


    /**
     * FEATURE 1: Predictive Low-Stock
     * GET /api/analytics/low-stock-predictions
     */
    router.get('/low-stock-predictions', isAuthenticated, async (req, res) => {
        console.log('📈 Generating low-stock predictions...');
        
        try {
            const chainResult = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
            const currentChain = chainResult.rows;

            if (currentChain.length <= 1) {
                return res.json([]);
            }

            const { inventory } = rebuildStateAt(currentChain, new Date().toISOString());
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const velocityMap = new Map();

            currentChain.forEach(block => {
                const tx = block.transaction;
                const blockDate = new Date(block.timestamp);
                
                if (tx.txType === 'STOCK_OUT' && blockDate > thirtyDaysAgo) {
                    const currentVelocity = velocityMap.get(tx.itemSku) || 0;
                    velocityMap.set(tx.itemSku, currentVelocity + tx.quantity);
                }
            });

            const predictions = [];
            const PREDICTION_THRESHOLD_DAYS = 7; 

            inventory.forEach((product, sku) => {
                
                // **********************************
                // *** THIS IS THE FIX ***
                // Skip any product that has been marked as deleted
                if (product.is_deleted) {
                    return; // Go to the next product
                }
                // **********************************
                
                let totalStock = 0;
                product.locations.forEach(qty => totalStock += qty);

                const totalStockOut = velocityMap.get(sku) || 0;
                
                if (totalStockOut > 0) {
                    const dailyVelocity = totalStockOut / 30;
                    const daysToEmpty = Math.floor(totalStock / dailyVelocity);

                    if (daysToEmpty <= PREDICTION_THRESHOLD_DAYS) {
                        predictions.push({
                            id: sku,
                            name: product.productName,
                            stock: totalStock,
                            daysToEmpty: daysToEmpty
                        });
                    }
                }
            });

            predictions.sort((a, b) => a.daysToEmpty - b.daysToEmpty);
            
            console.log(`✅ Found ${predictions.length} proactive warnings.`);
            res.status(200).json(predictions);

        } catch (e) {
            console.error('❌ Error generating predictions:', e);
            res.status(500).json({ message: e.message });
        }
    });

    /**
     * FEATURE 2: Dedicated Anomaly Report (NEW)
     * GET /api/analytics/anomalies-report
     */
    router.get('/anomalies-report', isAuthenticated, async (req, res) => {
        console.log('🛡️ Running full anomaly detection report...');
        
        if (req.session.user.role !== 'Admin' && req.session.user.role !== 'Auditor') {
            return res.status(ASAP).json({ message: 'Forbidden: Admin or Auditor access required' });
        }

        try {
            // 1. Get all users to map names to roles and track behavior
            const usersResult = await pool.query('SELECT id, name, role FROM users');
            const userRoleMap = new Map(usersResult.rows.map(u => [u.name, u.role]));
            // Map<userId, Set<txType>>
            const userBehaviorMap = new Map(usersResult.rows.map(u => [u.id, new Set()]));
            
            // 2. Get the full chain
            const chainResult = await pool.query(`${SELECT_BLOCKCHAIN_FIELDS} ORDER BY index ASC`);
            const chain = chainResult.rows;
            
            // Lists to store anomalies
            const basicAnomalies = [];
            const statisticalOutliers = [];
            const behavioralAnomalies = [];
            
            // For statistical analysis
            const quantities = {
                'CREATE_ITEM': [],
                'STOCK_IN': [],
                'STOCK_OUT': [],
                'MOVE': []
            };

            // First pass: get all quantities to calculate stats
            for (const block of chain) {
                if (block.index === 0) continue;
                const tx = block.transaction;
                if (quantities[tx.txType]) {
                    quantities[tx.txType].push(tx.quantity);
                }
            }
            
            // Calculate stats for transaction types
            const stats = {};
            for (const txType in quantities) {
                const { mean, stdDev } = getStdDev(quantities[txType]);
                stats[txType] = { mean, stdDev, threshold: mean + (3 * stdDev) }; // 3-sigma rule
            }

            // Second pass: apply all rules
            for (const block of chain) {
                if (block.index === 0) continue; 

                const tx = block.transaction;
                const reasons = [];

                // --- Rule Set 1: Business Logic ---
                const hour = new Date(block.timestamp).getUTCHours();
                if (hour < 6 || hour > 22) {
                    reasons.push(`Transaction occurred at an unusual time (${hour}:00 UTC).`);
                }
                
                const userRole = userRoleMap.get(tx.userName);
                if (tx.txType === 'MOVE' && userRole === 'Admin') {
                    reasons.push(`Logistics (MOVE) operation performed by an Admin, not a Manager.`);
                }
                
                if (tx.txType === 'MOVE' && tx.fromLocation === 'Supplier' && tx.toLocation === 'Retailer') {
                    reasons.push(`Logistics anomaly: Skipped Warehouse (Supplier -> Retailer).`);
                }

                if (reasons.length > 0) {
                    basicAnomalies.push({ block, reasons });
                }

                // --- Rule Set 2: Statistical Outlier ---
                const stat = stats[tx.txType];
                if (stat && tx.quantity > stat.threshold && tx.quantity > 10) { // Check vs threshold and a min value
                    statisticalOutliers.push({
                        block,
                        reasons: [`Quantity (${tx.quantity}) is a statistical outlier ( > 3x std. dev.) for ${tx.txType} transactions.`]
                    });
                }
                
                // --- Rule Set 3: Behavioral Anomaly ---
                const userHistory = userBehaviorMap.get(tx.userId);
                
                // First, check if this is the first time this user has EVER done this
                if (userHistory && !userHistory.has(tx.txType)) {
                    // It's the first time. Is this action unusual for their role?
                    let isUnusual = false;
                    switch (userRole) {
                        case 'Auditor':
                            isUnusual = true; // Auditors should not be performing ANY transactions
                            break;
                        case 'Inventory Manager':
                            if (tx.txType === 'CREATE_ITEM') isUnusual = true; // Managers shouldn't create items
                            break;
                        case 'Admin':
                            isUnusual = false; // Admins can do anything
                            break;
                    }

                    if (isUnusual) {
                        behavioralAnomalies.push({
                            block,
                            reasons: [`First time user '${tx.userName}' (Role: ${userRole}) performed a '${tx.txType}' action.`]
                        });
                    }
                }
                // Add this action to their history
                if (userHistory) {
                    userHistory.add(tx.txType);
                }
            }
            
            const totalTransactions = chain.length - 1;
            const allAnomalies = new Set([
                ...basicAnomalies.map(a => a.block.hash),
                ...statisticalOutliers.map(a => a.block.hash),
                ...behavioralAnomalies.map(a => a.block.hash)
            ]);
            const totalAnomalies = allAnomalies.size;

            console.log(`✅ Full anomaly scan complete. Found ${totalAnomalies} unique flags.`);
            
            res.status(200).json({
                summary: {
                    totalAnomalies: totalAnomalies,
                    totalTransactions: totalTransactions,
                    percentOfTransactionsFlagged: (totalAnomalies / totalTransactions) * 100
                },
                basicAnomalies: basicAnomalies.reverse(),
                statisticalOutliers: statisticalOutliers.reverse(),
                behavioralAnomalies: behavioralAnomalies.reverse()
            });

        } catch (e) {
            console.error('❌ Error scanning for anomalies:', e);
            res.status(500).json({ message: e.message });
        }
    });

    return router;
};