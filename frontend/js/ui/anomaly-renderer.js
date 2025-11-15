// frontend/js/ui/anomaly-renderer.js
import { createLedgerBlockElement } from './components/ledger-block.js';

// Main function to render the dedicated anomaly page
export const renderAnomalyPage = async () => {
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    // Show loading state
    const kpiTotal = appContent.querySelector('#kpi-total-anomalies');
    const kpiPercent = appContent.querySelector('#kpi-percent-flagged');
    
    const gridContainer = appContent.querySelector('#anomaly-grid-container');
    const fullWidthContainer = appContent.querySelector('#anomaly-fullwidth-container');
    const reportWrapper = appContent.querySelector('#anomaly-report-wrapper');
    
    kpiTotal.textContent = '...';
    kpiPercent.textContent = '...';
    gridContainer.innerHTML = '<p class="text-sm text-slate-500">Scanning blockchain for all anomalies...</p>';
    fullWidthContainer.innerHTML = '';

    try {
        const response = await fetch(`${API_BASE_URL}/api/analytics/anomalies-report`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            const err = await response.json();
            if (response.status === 403) {
                reportWrapper.innerHTML = `<p class="text-lg text-yellow-700">${err.message}</p>`;
            }
            throw new Error(err.message || 'Failed to load anomaly report');
        }
        
        const report = await response.json();
        
        // Populate KPIs
        kpiTotal.textContent = report.summary.totalAnomalies;
        kpiPercent.textContent = `${report.summary.percentOfTransactionsFlagged.toFixed(2)}%`;

        // Render the lists
        gridContainer.innerHTML = ''; // Clear loading
        
        if (report.summary.totalAnomalies === 0) {
            gridContainer.innerHTML = '<p class="text-sm text-slate-500">No anomalies found. The chain is clean.</p>';
            return;
        }

        renderAnomalyCategory(gridContainer, 'Business Logic Anomalies', 'ph-shield-warning', report.basicAnomalies);
        renderAnomalyCategory(gridContainer, 'Statistical Outliers', 'ph-chart-line', report.statisticalOutliers);
        renderAnomalyCategory(fullWidthContainer, 'Behavioral Anomalies', 'ph-users', report.behavioralAnomalies);

    } catch (error) {
        console.error(error.message);
        kpiTotal.textContent = 'Error';
        kpiPercent.textContent = 'Error';
        reportWrapper.innerHTML = `<p class="text-sm text-red-600">Error loading anomaly report. ${error.message}</p>`;
    }
};

// Helper function to render a category of anomalies
const renderAnomalyCategory = (container, title, icon, anomalies) => {
    if (anomalies.length === 0) return;

    const categoryWrapper = document.createElement('div');
    categoryWrapper.className = 'bg-white p-6 rounded-lg shadow-md flex flex-col';
    
    let anomalyHtml = '';
    anomalies.forEach(anomaly => {
        // We re-use the block element creator
        const blockElement = createLedgerBlockElement(anomaly.block);
        
        blockElement.classList.add('border-red-300', 'border-2');
        
        const reasonsList = anomaly.reasons.map(reason => 
            `<li class="text-xs font-medium text-red-700">${reason}</li>`
        ).join('');

        blockElement.innerHTML += `
            <ul class="mt-2 list-disc list-inside space-y-1">
                ${reasonsList}
            </ul>
        `;
        anomalyHtml += blockElement.outerHTML;
    });

    categoryWrapper.innerHTML = `
        <div class="flex items-center gap-3 mb-4">
            <span class="inline-flex p-3 bg-red-100 text-red-700 rounded-full">
                <i class="ph-bold ${icon} text-2xl"></i>
            </span>
            <h2 class="text-2xl font-semibold text-slate-800">${title} (${anomalies.length})</h2>
        </div>
        <div class="anomaly-list-scroll space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            ${anomalyHtml}
        </div>
    `;
    
    container.appendChild(categoryWrapper);
};