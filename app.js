import DataManager from './DataManager.js';

class DataManagerApp {
    constructor() {
        this.dataManager = new DataManager();
        this.currentData = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.totalPages = 1;

        this.initializeElements();
        this.setupEventListeners();
        this.setupDataManagerListeners();
        this.initialize();
    }

    initializeElements() {
        this.elements = {
            searchInput: document.getElementById('search-input'),
            sortSelect: document.getElementById('sort-select'),
            filterUser: document.getElementById('filter-user'),
            refreshBtn: document.getElementById('refresh-btn'),
            clearCacheBtn: document.getElementById('clear-cache-btn'),
            dataGrid: document.getElementById('data-grid'),
            loadingOverlay: document.getElementById('loading-overlay'),
            errorMessage: document.getElementById('error-message'),
            errorDetails: document.getElementById('error-details'),
            retryBtn: document.getElementById('retry-btn'),
            prevPage: document.getElementById('prev-page'),
            nextPage: document.getElementById('next-page'),
            currentPageSpan: document.getElementById('current-page'),
            totalPagesSpan: document.getElementById('total-pages'),

            // Stats
            totalPosts: document.getElementById('total-posts'),
            filteredPosts: document.getElementById('filtered-posts'),
            cacheSize: document.getElementById('cache-size'),
            requestCount: document.getElementById('request-count'),

            // Status indicators
            cacheStatus: document.getElementById('cache-status'),
            apiStatus: document.getElementById('api-status'),

            toastContainer: document.getElementById('toast-container')
        };
    }

    setupEventListeners() {
        const debouncedSearch = this.dataManager.debounceSearch(
            () => this.handleSearch()
        );
        this.elements.searchInput.addEventListener('input', debouncedSearch);
        this.elements.sortSelect.addEventListener('change', () => this.handleSort());
        this.elements.filterUser.addEventListener('change', () => this.handleFilter());
        this.elements.refreshBtn.addEventListener('click', () => this.refreshData());
        this.elements.clearCacheBtn.addEventListener('click', () => this.clearCache());
        this.elements.prevPage.addEventListener('click', () => this.previousPage());
        this.elements.nextPage.addEventListener('click', () => this.nextPage());
        this.elements.retryBtn.addEventListener('click', () => this.initialize());
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'r':
                        e.preventDefault();
                        this.refreshData();
                        break;
                    case 'k':
                        e.preventDefault();
                        this.elements.searchInput.focus();
                        break;
                }
            }
        });
    }

    setupDataManagerListeners() {
        this.dataManager.on('request-started', () => {
            this.updateApiStatus('loading');
        });

        this.dataManager.on('request-success', () => {
            this.updateApiStatus('success');
            this.updateStats();
        });

        this.dataManager.on('request-error', (error) => {
            this.updateApiStatus('error');
            this.showError(error.message);
        });

        this.dataManager.on('cache-hit', () => {
            this.showToast('Data loaded from cache', 'success');
        });

        this.dataManager.on('cache-updated', () => {
            this.updateCacheStatus('active');
            this.updateStats();
        });

        this.dataManager.on('cache-cleared', () => {
            this.updateCacheStatus('cleared');
            this.showToast('Cache cleared successfully', 'warning');
            this.updateStats();
        });
    }

    async initialize() {
        this.showLoading(true);
        this.hideError();

        try {
            const [posts, users] = await Promise.all([
                this.dataManager.fetchAllPosts(),
                this.dataManager.fetchUsers()
            ]);

            this.currentData = posts;
            this.populateUserFilter(users);
            await this.applyFiltersAndSort();
            this.showToast('Data loaded successfully!', 'success');

        } catch (error) {
            this.showError(`Failed to load data: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    populateUserFilter(users) {
        const userSelect = this.elements.filterUser;
        userSelect.innerHTML = '<option value="">All Users</option>';

        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name} (ID: ${user.id})`;
            userSelect.appendChild(option);
        });
    }

    async handleSearch() {
        const query = this.elements.searchInput.value;
        await this.applyFiltersAndSort();

        if (query) {
            this.showToast(`Searching for: "${query}"`, 'info');
        }
    }

    async handleSort() {
        await this.applyFiltersAndSort();
        const sortBy = this.elements.sortSelect.value;
        this.showToast(`Sorted by ${sortBy}`, 'info');
    }

    async handleFilter() {
        await this.applyFiltersAndSort();
        const userId = this.elements.filterUser.value;
        if (userId) {
            this.showToast(`Filtered by User ID: ${userId}`, 'info');
        }
    }

    async applyFiltersAndSort() {
        let data = [...this.currentData];

        const selectedUserId = this.elements.filterUser.value;
        if (selectedUserId) {
            data = await this.dataManager.filterData(data,
                item => item.userId.toString() === selectedUserId
            );
        }

        const searchQuery = this.elements.searchInput.value;
        if (searchQuery) {
            data = await this.dataManager.searchData(data, searchQuery);
        }

        const sortBy = this.elements.sortSelect.value;
        data = await this.dataManager.sortData(data, sortBy);

        this.filteredData = data;
        this.currentPage = 1;
        this.updatePagination();
        this.renderData();
        this.updateStats();
    }

    updatePagination() {
        this.totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        this.elements.totalPagesSpan.textContent = this.totalPages;
        this.elements.currentPageSpan.textContent = this.currentPage;

        this.elements.prevPage.disabled = this.currentPage <= 1;
        this.elements.nextPage.disabled = this.currentPage >= this.totalPages;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderData();
            this.updatePagination();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderData();
            this.updatePagination();
        }
    }

    renderData() {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        this.elements.dataGrid.innerHTML = '';

        if (pageData.length === 0) {
            this.elements.dataGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                    <h3>No data found</h3>
                    <p>Try adjusting your search or filter criteria</p>
                </div>
            `;
            return;
        }

        pageData.forEach((item, index) => {
            const card = this.createDataCard(item, startIndex + index);
            this.elements.dataGrid.appendChild(card);
        });
    }

    createDataCard(item, index) {
        const card = document.createElement('div');
        card.className = 'data-card';
        card.style.animationDelay = `${index * 0.1}s`;

        card.innerHTML = `
            <div class="card-header">
                <span class="card-id">ID: ${item.id}</span>
                <span class="user-id">User: ${item.userId}</span>
            </div>
            <h3 class="card-title">${this.highlightText(item.title, this.elements.searchInput.value)}</h3>
            <p class="card-body">${this.highlightText(item.body, this.elements.searchInput.value)}</p>
        `;

        return card;
    }

    highlightText(text, query) {
        if (!query) return text;

        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark style="background: var(--warning); color: var(--dark); padding: 2px 4px; border-radius: 4px;">$1</mark>');
    }


    async refreshData() {
        this.elements.refreshBtn.querySelector('.btn-icon').style.animation = 'spin 1s linear infinite';

        try {
            this.dataManager.clearCache();
            await this.initialize();
        } finally {
            this.elements.refreshBtn.querySelector('.btn-icon').style.animation = '';
        }
    }

    clearCache() {
        this.dataManager.clearCache();
    }

    showLoading(show) {
        this.elements.loadingOverlay.classList.toggle('active', show);
    }

    showError(message) {
        this.elements.errorDetails.textContent = message;
        this.elements.errorMessage.classList.add('active');
        this.updateApiStatus('error');
    }

    hideError() {
        this.elements.errorMessage.classList.remove('active');
    }

    updateStats() {
        const stats = this.dataManager.getStats();

        this.elements.totalPosts.textContent = this.currentData.length;
        this.elements.filteredPosts.textContent = this.filteredData.length;
        this.elements.cacheSize.textContent = stats.cacheSize;
        this.elements.requestCount.textContent = stats.requestCount;
    }

    updateApiStatus(status) {
        const indicator = this.elements.apiStatus.querySelector('.dot');
        const label = this.elements.apiStatus.querySelector('.label');

        switch (status) {
            case 'loading':
                indicator.style.background = 'var(--warning)';
                indicator.style.boxShadow = '0 0 10px var(--warning)';
                label.textContent = 'Loading...';
                break;
            case 'success':
                indicator.style.background = 'var(--success)';
                indicator.style.boxShadow = '0 0 10px var(--success)';
                label.textContent = 'API Connected';
                break;
            case 'error':
                indicator.style.background = 'var(--danger)';
                indicator.style.boxShadow = '0 0 10px var(--danger)';
                label.textContent = 'API Error';
                break;
        }
    }

    updateCacheStatus(status) {
        const indicator = this.elements.cacheStatus.querySelector('.dot');
        const label = this.elements.cacheStatus.querySelector('.label');

        switch (status) {
            case 'active':
                indicator.style.background = 'var(--success)';
                indicator.style.boxShadow = '0 0 10px var(--success)';
                label.textContent = 'Cache Active';
                break;
            case 'cleared':
                indicator.style.background = 'var(--warning)';
                indicator.style.boxShadow = '0 0 10px var(--warning)';
                label.textContent = 'Cache Cleared';
                break;
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span>${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new DataManagerApp();
});