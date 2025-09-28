class DataManager {
    constructor(baseUrl = 'https://jsonplaceholder.typicode.com') {
        this.baseUrl = baseUrl;
        this.cache = new Map();
        this.requestCount = 0;
        this.abortController = null;
        this.debounceTimer = null;

        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            cacheExpiry: 5 * 60 * 1000, // 5 minutes
            debounceDelay: 300
        };
    }

    generateCacheKey(endpoint, params = {}) {
        const paramStr = Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');
        return `${endpoint}${paramStr ? '?' + paramStr : ''}`;
    }

    isCacheValid(cacheEntry) {
        return Date.now() - cacheEntry.timestamp < this.config.cacheExpiry;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        this.notifyListeners('cache-updated');
    }

    getCache(key) {
        const entry = this.cache.get(key);
        if (entry && this.isCacheValid(entry)) {
            return entry.data;
        }
        if (entry) {
            this.cache.delete(key);
        }
        return null;
    }

    clearCache() {
        this.cache.clear();
        this.notifyListeners('cache-cleared');
    }

    getCacheSize() {
        return this.cache.size;
    }

    async fetchWithRetry(url, options = {}, retries = this.config.maxRetries) {
        try {
            this.requestCount++;
            this.notifyListeners('request-started');

            const response = await fetch(url, options);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.notifyListeners('request-success');
            return data;

        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }

            if (retries > 0) {
                await this.delay(this.config.retryDelay);
                return this.fetchWithRetry(url, options, retries - 1);
            }

            this.notifyListeners('request-error', error);
            throw error;
        }
    }

    async fetchData(endpoint, params = {}, useCache = true) {
        const cacheKey = this.generateCacheKey(endpoint, params);

        if (useCache) {
            const cachedData = this.getCache(cacheKey);
            if (cachedData) {
                this.notifyListeners('cache-hit');
                return cachedData;
            }
        }

        this.cancelPendingRequests();
        this.abortController = new AbortController();

        const url = new URL(`${this.baseUrl}${endpoint}`);
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        try {
            const data = await this.fetchWithRetry(url.toString(), {
                signal: this.abortController.signal
            });

            if (useCache) {
                this.setCache(cacheKey, data);
            }

            return data;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Fetch error:', error);
            }
            throw error;
        }
    }

    async fetchPosts(page = 1, limit = 10) {
        const start = (page - 1) * limit;
        return this.fetchData('/posts', { _start: start, _limit: limit });
    }

    async fetchAllPosts() {
        return this.fetchData('/posts');
    }

    async fetchUsers() {
        return this.fetchData('/users');
    }

    filterData(data, filterFn) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(data.filter(filterFn));
            }, 0);
        });
    }

    sortData(data, sortKey, ascending = true) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const sorted = [...data].sort((a, b) => {
                    let aVal = a[sortKey];
                    let bVal = b[sortKey];

                    if (typeof aVal === 'string') {
                        aVal = aVal.toLowerCase();
                        bVal = bVal.toLowerCase();
                    }

                    if (aVal < bVal) return ascending ? -1 : 1;
                    if (aVal > bVal) return ascending ? 1 : -1;
                    return 0;
                });
                resolve(sorted);
            }, 0);
        });
    }

    searchData(data, query, fields = ['title', 'body']) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (!query.trim()) {
                    resolve(data);
                    return;
                }

                const lowercaseQuery = query.toLowerCase();
                const filtered = data.filter(item => {
                    return fields.some(field => {
                        const value = item[field];
                        return value && value.toString().toLowerCase().includes(lowercaseQuery);
                    });
                });
                resolve(filtered);
            }, 0);
        });
    }

    debounceSearch(callback, delay = this.config.debounceDelay) {
        return (...args) => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => callback.apply(this, args), delay);
        };
    }

    cancelPendingRequests() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Event system for notifications
    listeners = {};

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    notifyListeners(event, data = null) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    getStats() {
        return {
            cacheSize: this.getCacheSize(),
            requestCount: this.requestCount,
            cachedItems: Array.from(this.cache.keys())
        };
    }
}

export default DataManager;