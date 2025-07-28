// Remove Cookie Extension - Popup Script

class CookieRemover {
    constructor() {
        this.allSites = [];
        this.filteredSites = [];
        this.selectedSites = new Set();
        this.isLoading = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadSites();
    }
    
    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.sitesContainer = document.getElementById('sitesContainer');
        this.loadingState = document.getElementById('loadingState');
        this.status = document.getElementById('status');
        this.stats = document.getElementById('stats');
        this.totalSites = document.getElementById('totalSites');
        this.totalCookies = document.getElementById('totalCookies');
    }
    
    setupEventListeners() {
        // 검색 입력에 debounce 적용 (성능 최적화)
        let searchTimeout;
        this.searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.filterSites(), 300);
        });
        
        this.selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
        this.deleteSelectedBtn.addEventListener('click', () => this.deleteSelected());
        this.refreshBtn.addEventListener('click', () => this.loadSites());
    }
    
    async loadSites() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.allSites = [];
            this.filteredSites = [];
            
            this.showLoading(true);
            this.showStatus('사이트 목록을 불러오는 중...', 'info');
            this.renderSites(); // 빈 상태로 초기화
            
            // 1단계: 히스토리 조회
            const historyItems = await chrome.history.search({
                text: '',
                maxResults: 500,
                startTime: Date.now() - (30 * 24 * 60 * 60 * 1000)
            });
            
            this.showStatus('도메인 분석 중...', 'info');
            
            // 2단계: 도메인 그룹핑
            const domainMap = this.groupDomains(historyItems);
            const domains = Array.from(domainMap.values());
            
            this.showStatus('사이트 데이터 조회 중...', 'info');
            
            // 3단계: 배치 처리로 사이트 데이터 조회
            await this.loadSitesInBatches(domains);
            
            this.showStatus(`완료! ${this.allSites.length}개 사이트 로드됨`, 'success');
            this.isLoading = false;
            this.hideLoading();
            
        } catch (error) {
            this.showStatus('사이트 목록을 불러오는 중 오류가 발생했습니다: ' + error.message, 'error');
            this.isLoading = false;
            this.hideLoading();
        }
    }
    
    groupDomains(historyItems) {
        const domainMap = new Map();
        
        for (const item of historyItems) {
            try {
                const url = new URL(item.url);
                const domain = url.hostname;
                
                if (this.isValidDomain(domain)) {
                    if (!domainMap.has(domain) || item.lastVisitTime > domainMap.get(domain).lastVisitTime) {
                        domainMap.set(domain, {
                            domain: domain,
                            lastVisitTime: item.lastVisitTime,
                            title: item.title || domain,
                            url: item.url
                        });
                    }
                }
            } catch (error) {
                // URL 파싱 오류 무시
            }
        }
        
        return domainMap;
    }
    
    async loadSitesInBatches(domains) {
        const BATCH_SIZE = 10;
        const DELAY_BETWEEN_BATCHES = 50;
        
        const batches = [];
        for (let i = 0; i < domains.length; i += BATCH_SIZE) {
            batches.push(domains.slice(i, i + BATCH_SIZE));
        }
        
        for (let i = 0; i < batches.length; i++) {
            if (!this.isLoading) {
                break;
            }
            
            const batch = batches[i];
            
            const batchResults = await Promise.allSettled(
                batch.map(site => this.getSiteDataSafe(site))
            );
            
            const validSites = batchResults
                .filter(result => result.status === 'fulfilled' && result.value?.hasAnyData)
                .map(result => result.value);
            
            this.allSites.push(...validSites);
            this.allSites.sort((a, b) => b.lastVisitTime - a.lastVisitTime);
            
            if (this.isLoading) {
                this.filterSites();
            }
            
            if (i < batches.length - 1) {
                await this.delay(DELAY_BETWEEN_BATCHES);
            }
        }
    }
    
    async getSiteDataSafe(site) {
        try {
            return await this.getSiteData(site);
        } catch (error) {
            console.warn('사이트 데이터 조회 오류:', site.domain, error);
            return null;
        }
    }
    
    async getSiteData(site) {
        const [cookies, visitFrequency] = await Promise.all([
            this.getCookiesForDomain(site.domain),
            this.getVisitFrequency(site.domain)
        ]);
        
        const cookieCount = cookies.length;
        const hasFrequentVisits = visitFrequency > 3;
        const isRecentVisit = (Date.now() - site.lastVisitTime) < (7 * 24 * 60 * 60 * 1000);
        
        const hasAnyData = cookieCount > 0 || (hasFrequentVisits && isRecentVisit);
        
        if (!hasAnyData) {
            return null;
        }
        
        return {
            ...site,
            cookieCount: cookieCount,
            cookies: cookies,
            visitFrequency: visitFrequency,
            hasAnyData: hasAnyData,
            dataTypes: this.getDataTypes(cookieCount, hasFrequentVisits)
        };
    }
    
    getDataTypes(cookieCount, hasFrequentVisits) {
        const types = [];
        if (cookieCount > 0) types.push('쿠키');
        if (hasFrequentVisits) {
            types.push('로컬스토리지');
            types.push('캐시');
        }
        return types;
    }
    
    async getVisitFrequency(domain) {
        try {
            const visits = await chrome.history.search({
                text: domain,
                maxResults: 50,
                startTime: Date.now() - (30 * 24 * 60 * 60 * 1000)
            });
            
            return visits.filter(visit => {
                try {
                    return new URL(visit.url).hostname === domain;
                } catch {
                    return false;
                }
            }).length;
        } catch (error) {
            return 0;
        }
    }
    
    async getCookiesForDomain(domain) {
        try {
            const results = await Promise.allSettled([
                chrome.cookies.getAll({ domain: domain }),
                chrome.cookies.getAll({ domain: '.' + domain })
            ]);
            
            const mainCookies = results[0].status === 'fulfilled' ? results[0].value : [];
            const subdomainCookies = results[1].status === 'fulfilled' ? results[1].value : [];
            
            const allCookies = [...mainCookies, ...subdomainCookies];
            const uniqueCookies = allCookies.filter((cookie, index, arr) => 
                arr.findIndex(c => c.name === cookie.name && c.domain === cookie.domain) === index
            );
            
            return uniqueCookies;
        } catch (error) {
            return [];
        }
    }
    
    isValidDomain(domain) {
        return domain && 
               !domain.startsWith('chrome') && 
               !domain.startsWith('moz-extension') &&
               !domain.includes('localhost') &&
               domain.includes('.') &&
               domain.length > 3;
    }
    
    filterSites() {
        const searchTerm = this.searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            this.filteredSites = [...this.allSites];
        } else {
            this.filteredSites = this.allSites.filter(site => 
                site.domain.toLowerCase().includes(searchTerm) ||
                site.title.toLowerCase().includes(searchTerm)
            );
        }
        
        this.renderSites();
        this.updateStats();
    }
    
    renderSites() {
        if (this.filteredSites.length === 0) {
            this.sitesContainer.innerHTML = `
                <div class="empty-state">
                    ${this.allSites.length === 0 ? 
                        '저장된 데이터가 있는 사이트가 없습니다' : 
                        '검색 결과가 없습니다'}
                </div>
            `;
            return;
        }
        
        this.sitesContainer.innerHTML = this.filteredSites.map(site => `
            <div class="site-item">
                <input type="checkbox" class="site-checkbox" data-domain="${site.domain}">
                <div class="site-info">
                    <div class="site-domain">${site.domain}</div>
                    <div class="site-details">
                        ${site.dataTypes.join(', ')} • 
                        방문 ${site.visitFrequency}회 • 
                        최근: ${this.formatDate(site.lastVisitTime)}
                    </div>
                </div>
                <div class="site-actions">
                    <button class="delete-btn" data-domain="${site.domain}">삭제</button>
                </div>
            </div>
        `).join('');
        
        this.attachEventListeners();
    }
    
    attachEventListeners() {
        this.sitesContainer.querySelectorAll('.site-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelection());
        });
        
        this.sitesContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const domain = e.target.dataset.domain;
                this.deleteSite(domain);
            });
        });
    }
    
    updateSelection() {
        const checkboxes = this.sitesContainer.querySelectorAll('.site-checkbox');
        this.selectedSites.clear();
        
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                this.selectedSites.add(checkbox.dataset.domain);
            }
        });
        
        this.deleteSelectedBtn.disabled = this.selectedSites.size === 0;
        this.deleteSelectedBtn.textContent = this.selectedSites.size > 0 ? 
            `선택 삭제 (${this.selectedSites.size})` : '선택 삭제';
    }
    
    toggleSelectAll() {
        const checkboxes = this.sitesContainer.querySelectorAll('.site-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(checkbox => {
            checkbox.checked = !allChecked;
        });
        
        this.selectAllBtn.textContent = allChecked ? '전체 선택' : '전체 해제';
        this.updateSelection();
    }
    
    async deleteSite(domain) {
        if (!confirm(`${domain}의 모든 데이터를 삭제하시겠습니까?\n\n삭제될 데이터:\n- 쿠키\n- 로컬 스토리지\n- 캐시\n- IndexedDB\n- 서비스 워커 등`)) {
            return;
        }
        
        try {
            this.showStatus(`${domain} 삭제 중...`, 'info');
            
            await chrome.browsingData.remove({
                origins: [
                    `https://${domain}`,
                    `http://${domain}`,
                    `https://www.${domain}`,
                    `http://www.${domain}`
                ]
            }, {
                cookies: true,
                localStorage: true,
                indexedDB: true,
                cacheStorage: true,
                cache: true,
                serviceWorkers: true,
                webSQL: true
            });
            
            this.showStatus(`${domain} 삭제 완료!`, 'success');
            
            this.allSites = this.allSites.filter(site => site.domain !== domain);
            this.filterSites();
            
        } catch (error) {
            this.showStatus(`삭제 중 오류 발생: ${error.message}`, 'error');
            console.error('삭제 오류:', error);
        }
    }
    
    async deleteSelected() {
        if (this.selectedSites.size === 0) return;
        
        const count = this.selectedSites.size;
        if (!confirm(`선택된 ${count}개 사이트의 모든 데이터를 삭제하시겠습니까?\n\n삭제될 데이터:\n- 쿠키\n- 로컬 스토리지\n- 캐시\n- IndexedDB\n- 서비스 워커 등`)) {
            return;
        }
        
        try {
            this.showStatus(`${count}개 사이트 삭제 중...`, 'info');
            
            const domainsArray = Array.from(this.selectedSites);
            const BATCH_SIZE = 5;
            
            for (let i = 0; i < domainsArray.length; i += BATCH_SIZE) {
                const batch = domainsArray.slice(i, i + BATCH_SIZE);
                
                await Promise.all(batch.map(domain => 
                    chrome.browsingData.remove({
                        origins: [
                            `https://${domain}`,
                            `http://${domain}`,
                            `https://www.${domain}`,
                            `http://www.${domain}`
                        ]
                    }, {
                        cookies: true,
                        localStorage: true,
                        indexedDB: true,
                        cacheStorage: true,
                        cache: true,
                        serviceWorkers: true,
                        webSQL: true
                    })
                ));
            }
            
            this.showStatus(`${count}개 사이트 삭제 완료!`, 'success');
            
            this.allSites = this.allSites.filter(site => !this.selectedSites.has(site.domain));
            this.selectedSites.clear();
            this.filterSites();
            
        } catch (error) {
            this.showStatus(`삭제 중 오류 발생: ${error.message}`, 'error');
            console.error('일괄 삭제 오류:', error);
        }
    }
    
    updateStats() {
        const totalCookies = this.filteredSites.reduce((sum, site) => sum + site.cookieCount, 0);
        this.totalSites.textContent = this.filteredSites.length;
        this.totalCookies.textContent = totalCookies;
        this.stats.style.display = this.filteredSites.length > 0 ? 'block' : 'none';
    }
    
    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return '오늘';
        } else if (diffDays === 1) {
            return '어제';
        } else if (diffDays < 7) {
            return `${diffDays}일 전`;
        } else {
            return date.toLocaleDateString('ko-KR');
        }
    }
    
    showStatus(message, type) {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        this.status.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => this.hideStatus(), 3000);
        }
    }
    
    hideStatus() {
        this.status.style.display = 'none';
    }
    
    showLoading(show) {
        this.loadingState.style.display = show ? 'block' : 'none';
        this.refreshBtn.disabled = show;
    }
    
    hideLoading() {
        this.loadingState.style.display = 'none';
        this.refreshBtn.disabled = false;
        this.renderSites();
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    new CookieRemover();
});