// Remove Cookie Extension - Popup Script

class CookieRemover {
    constructor() {
        this.allSites = [];
        this.filteredSites = [];
        this.selectedSites = new Set();
        this.isLoading = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkServiceWorker();
        this.loadSites();
    }
    
    initializeElements() {
        this.searchInput = document.getElementById('searchInput');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.sitesContainer = document.getElementById('sitesContainer');
        this.loadingState = document.getElementById('loadingState');
        this.status = document.getElementById('status');
        this.stats = document.getElementById('stats');
        this.totalSites = document.getElementById('totalSites');
        this.totalCookies = document.getElementById('totalCookies');
        
        // 모달 관련 요소들
        this.modal = document.getElementById('siteDetailModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalContent = document.getElementById('modalContent');
        this.closeModal = document.getElementById('closeModal');
        this.modalCloseBtn = document.getElementById('modalCloseBtn');
        this.modalDeleteBtn = document.getElementById('modalDeleteBtn');
        
        // 탭 관련 요소들
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Worker 관련 요소들
        this.refreshWorkersBtn = document.getElementById('refreshWorkersBtn');
        this.terminateAllWorkersBtn = document.getElementById('terminateAllWorkersBtn');
        this.workersContainer = document.getElementById('workersContainer');
        this.workerLoadingState = document.getElementById('workerLoadingState');
        this.workerStatus = document.getElementById('workerStatus');
        this.workerStats = document.getElementById('workerStats');
        this.totalWorkers = document.getElementById('totalWorkers');
        
        this.currentModalDomain = null;
        this.allWorkers = [];
        this.isLoadingWorkers = false;
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
        this.clearHistoryBtn.addEventListener('click', () => this.clearBrowsingHistory());
        
        // 모달 이벤트 리스너
        this.closeModal.addEventListener('click', () => this.hideModal());
        this.modalCloseBtn.addEventListener('click', () => this.hideModal());
        this.modalDeleteBtn.addEventListener('click', () => this.deleteCurrentModalSite());
        
        // 모달 배경 클릭시 닫기
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal();
            }
        });
        
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'block') {
                this.hideModal();
            }
        });
        
        // 탭 전환 이벤트
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // Worker 관련 이벤트
        this.refreshWorkersBtn.addEventListener('click', () => this.loadWorkers());
        this.terminateAllWorkersBtn.addEventListener('click', () => this.terminateAllWorkers());
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
        const [cookies, visitFrequency, serviceWorkers] = await Promise.all([
            this.getCookiesForDomain(site.domain),
            this.getVisitFrequency(site.domain),
            this.getServiceWorkersForDomain(site.domain)
        ]);
        
        const cookieCount = cookies.length;
        const serviceWorkerCount = serviceWorkers.length;
        const hasFrequentVisits = visitFrequency > 3;
        const isRecentVisit = (Date.now() - site.lastVisitTime) < (7 * 24 * 60 * 60 * 1000);
        
        const hasAnyData = cookieCount > 0 || serviceWorkerCount > 0 || (hasFrequentVisits && isRecentVisit);
        
        if (!hasAnyData) {
            return null;
        }
        
        return {
            ...site,
            cookieCount: cookieCount,
            cookies: cookies,
            serviceWorkers: serviceWorkers,
            serviceWorkerCount: serviceWorkerCount,
            visitFrequency: visitFrequency,
            hasAnyData: hasAnyData,
            dataTypes: this.getDataTypes(cookieCount, hasFrequentVisits, serviceWorkerCount)
        };
    }
    
    getDataTypes(cookieCount, hasFrequentVisits, serviceWorkerCount = 0) {
        const types = [];
        if (cookieCount > 0) types.push('쿠키');
        if (serviceWorkerCount > 0) types.push('Service Worker');
        if (hasFrequentVisits) {
            types.push('로컬스토리지');
            types.push('캐시');
        }
        return types;
    }
    
    // 사이트별 Service Worker 정보 조회
    async getServiceWorkersForDomain(domain) {
        try {
            // Service Worker 정보를 content script를 통해 가져오기
            const response = await this.sendMessageToBackground({
                action: 'getServiceWorkers',
                domain: domain
            });
            
            if (response && response.serviceWorkers) {
                return response.serviceWorkers;
            }
            
            return [];
        } catch (error) {
            console.warn('Service Worker 조회 오류:', domain, error);
            return [];
        }
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
            <div class="site-item" data-domain="${site.domain}">
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
                    <button class="detail-btn" data-domain="${site.domain}">상세보기</button>
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
                e.stopPropagation(); // 이벤트 버블링 방지
                const domain = e.target.dataset.domain;
                this.deleteSite(domain);
            });
        });
        
        this.sitesContainer.querySelectorAll('.detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 이벤트 버블링 방지
                const domain = e.target.dataset.domain;
                this.showSiteDetail(domain);
            });
        });
        
        // 사이트 항목 더블클릭 이벤트
        this.sitesContainer.querySelectorAll('.site-item').forEach(item => {
            item.addEventListener('dblclick', (e) => {
                // 체크박스나 버튼 클릭이 아닌 경우에만
                if (!e.target.classList.contains('site-checkbox') && 
                    !e.target.classList.contains('delete-btn') && 
                    !e.target.classList.contains('detail-btn')) {
                    const domain = item.dataset.domain;
                    this.showSiteDetail(domain);
                }
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
        if (!confirm(`${domain}의 데이터를 삭제하시겠습니까?\n\n삭제될 데이터:\n- 🍪 쿠키 (도메인별)\n- 💾 로컬 스토리지 (도메인별)\n- 🗄️ IndexedDB (도메인별)\n- 📦 캐시 스토리지 (도메인별)\n- ⚙️ 서비스 워커 (도메인별)\n- 🗃️ WebSQL (도메인별)\n\n※ 방문 기록은 삭제되지 않습니다.`)) {
            return;
        }
        
        try {
            this.showStatus(`${domain} 삭제 중...`, 'info');
            
            // Origin 필터링을 지원하는 데이터 타입들
            const originsToDelete = [
                `https://${domain}`,
                `http://${domain}`,
                `https://www.${domain}`,
                `http://www.${domain}`
            ];
            

            
            // 개별 쿠키 삭제 (정확한 도메인만)
            const cookies = await this.getCookiesForDomain(domain);
            for (const cookie of cookies) {
                await chrome.cookies.remove({
                    url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
                    name: cookie.name
                });
            }
            
            // 다른 데이터는 browsingData API 사용 (쿠키 제외)
            await chrome.browsingData.remove({
                origins: originsToDelete,
                originTypes: {
                    unprotectedWeb: true,
                    protectedWeb: false,
                    extension: false
                }
            }, {
                cookies: false,
                localStorage: true,
                indexedDB: true,
                cacheStorage: true,
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
    
    async clearBrowsingHistory() {
        if (!confirm(`⚠️ 경고: 방문 기록을 삭제하시겠습니까?\n\nChrome 제한으로 최근 30일의 모든 방문 기록이 삭제됩니다!\n(모든 사이트의 방문 기록이 삭제됩니다)\n\n이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }
        
        try {
            this.showStatus('방문 기록 삭제 중...', 'info');
            
            const since = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30일 전
            await chrome.browsingData.remove({
                since: since
            }, {
                history: true,
                cookies: false,
                localStorage: false,
                indexedDB: false,
                cacheStorage: false,
                serviceWorkers: false,
                webSQL: false,
                cache: false,
                downloads: false,
                formData: false,
                passwords: false
            });
            
            this.showStatus('방문 기록 삭제 완료!', 'success');
            
        } catch (error) {
            this.showStatus(`방문 기록 삭제 오류: ${error.message}`, 'error');
            console.error('방문 기록 삭제 오류:', error);
        }
    }
    
    async deleteSelected() {
        if (this.selectedSites.size === 0) return;
        
        const count = this.selectedSites.size;
        if (!confirm(`선택된 ${count}개 사이트의 데이터를 삭제하시겠습니까?\n\n삭제될 데이터:\n- 🍪 쿠키 (도메인별)\n- 💾 로컬 스토리지 (도메인별)\n- 🗄️ IndexedDB (도메인별)\n- 📦 캐시 스토리지 (도메인별)\n- ⚙️ 서비스 워커 (도메인별)\n- 🗃️ WebSQL (도메인별)\n\n※ 방문 기록은 삭제되지 않습니다.`)) {
            return;
        }
        
        try {
            this.showStatus(`${count}개 사이트 삭제 중...`, 'info');
            
            const domainsArray = Array.from(this.selectedSites);
            const BATCH_SIZE = 5;
            
            // Origin 필터링을 지원하는 데이터 타입들을 배치로 처리
            for (let i = 0; i < domainsArray.length; i += BATCH_SIZE) {
                const batch = domainsArray.slice(i, i + BATCH_SIZE);
                
                await Promise.all(batch.map(domain => 
                    chrome.browsingData.remove({
                        origins: [
                            `https://${domain}`,
                            `http://${domain}`,
                            `https://www.${domain}`,
                            `http://www.${domain}`
                        ],
                        originTypes: {
                            unprotectedWeb: true,
                            protectedWeb: false,
                            extension: false
                        }
                    }, {
                        cookies: true,
                        localStorage: true,
                        indexedDB: true,
                        cacheStorage: true,
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
    
    // Service Worker 상태 확인
    async checkServiceWorker() {
        try {
            // Service Worker와의 연결 확인
            const response = await chrome.runtime.sendMessage({ 
                action: 'ping' 
            });
            
            if (response) {
                console.log('Service Worker 연결됨');
            }
        } catch (error) {
            console.log('Service Worker 상태:', error.message);
            // Service Worker가 없어도 기본 기능은 동작하도록 함
        }
    }
    
    // Service Worker로 메시지 전송
    async sendMessageToBackground(message) {
        try {
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            console.warn('Background script communication failed:', error);
            return null;
        }
    }
    
    // 모달 관련 메서드들
    async showSiteDetail(domain) {
        const site = this.allSites.find(s => s.domain === domain);
        if (!site) return;
        
        this.currentModalDomain = domain;
        this.modalTitle.textContent = `${domain} - 세부 정보`;
        
        try {
            // 더 상세한 정보 가져오기
            const [detailedCookies, visitHistory, detailedServiceWorkers] = await Promise.all([
                this.getDetailedCookiesForDomain(domain),
                this.getDetailedVisitHistory(domain),
                this.getDetailedServiceWorkersForDomain(domain)
            ]);
            
            this.modalContent.innerHTML = this.generateDetailContent(site, detailedCookies, visitHistory, detailedServiceWorkers);
            
            // Service Worker 삭제 버튼 이벤트 리스너 추가
            this.attachServiceWorkerDeleteListeners(domain);
            
            this.modal.style.display = 'block';
        } catch (error) {
            console.error('상세 정보 로드 오류:', error);
            this.showStatus('상세 정보를 불러오는 중 오류가 발생했습니다.', 'error');
        }
    }
    
    async getDetailedCookiesForDomain(domain) {
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
    
    async getDetailedVisitHistory(domain) {
        try {
            const visits = await chrome.history.search({
                text: domain,
                maxResults: 20,
                startTime: Date.now() - (30 * 24 * 60 * 60 * 1000)
            });
            
            return visits.filter(visit => {
                try {
                    return new URL(visit.url).hostname === domain;
                } catch {
                    return false;
                }
            }).sort((a, b) => b.lastVisitTime - a.lastVisitTime);
        } catch (error) {
            return [];
        }
    }
    
    async getDetailedServiceWorkersForDomain(domain) {
        try {
            // background script를 통해 Service Worker 정보 조회
            const response = await this.sendMessageToBackground({
                action: 'getDetailedServiceWorkers',
                domain: domain
            });
            
            if (response && response.success) {
                return response.serviceWorkers || [];
            }
            
            return [];
        } catch (error) {
            console.warn('Service Worker 상세 정보 조회 오류:', domain, error);
            return [];
        }
    }
    
    generateDetailContent(site, cookies, visitHistory, serviceWorkers = []) {
        const siteInfo = `
            <div class="detail-section">
                <h5>📋 기본 정보</h5>
                <div class="detail-item">
                    <span class="detail-label">도메인:</span>
                    <span class="detail-value">${site.domain}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">방문 횟수:</span>
                    <span class="detail-value">${site.visitFrequency}회</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">최근 방문:</span>
                    <span class="detail-value">${this.formatDate(site.lastVisitTime)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">저장된 데이터:</span>
                    <span class="detail-value">${site.dataTypes.join(', ')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Service Worker:</span>
                    <span class="detail-value">${serviceWorkers.length}개</span>
                </div>
            </div>
        `;
        
        const cookieInfo = `
            <div class="detail-section">
                <h5>🍪 쿠키 정보 (${cookies.length}개)</h5>
                ${cookies.length === 0 ? 
                    '<div class="detail-item">저장된 쿠키가 없습니다.</div>' :
                    cookies.slice(0, 10).map(cookie => `
                        <div class="cookie-item">
                            <div class="cookie-name">${cookie.name}</div>
                            <div class="cookie-details">
                                도메인: ${cookie.domain}<br>
                                경로: ${cookie.path}<br>
                                보안: ${cookie.secure ? 'HTTPS만' : '모든 연결'}<br>
                                HttpOnly: ${cookie.httpOnly ? '예' : '아니오'}<br>
                                ${cookie.expirationDate ? 
                                    `만료: ${new Date(cookie.expirationDate * 1000).toLocaleString('ko-KR')}` : 
                                    '만료: 세션 종료시'}
                            </div>
                        </div>
                    `).join('')
                }
                ${cookies.length > 10 ? `<div class="detail-item">... 외 ${cookies.length - 10}개 더</div>` : ''}
            </div>
        `;
        
        const serviceWorkerInfo = `
            <div class="detail-section">
                <h5>⚙️ Service Worker 정보 (${serviceWorkers.length}개)</h5>
                ${serviceWorkers.length === 0 ? 
                    '<div class="detail-item">등록된 Service Worker가 없습니다.</div>' :
                    serviceWorkers.map(sw => `
                        <div class="cookie-item">
                            <div class="cookie-name">📍 ${sw.scope || '알 수 없음'}</div>
                            <div class="cookie-details">
                                상태: ${sw.state || '알 수 없음'}<br>
                                스크립트: ${sw.scriptURL || 'N/A'}<br>
                                업데이트: ${sw.updateViaCache || 'auto'}<br>
                                ${sw.installing ? '설치 중...<br>' : ''}
                                ${sw.waiting ? '대기 중...<br>' : ''}
                                ${sw.active ? '활성화됨<br>' : ''}
                                <button class="btn btn-danger btn-sm service-worker-delete-btn" data-scope="${sw.scope || ''}">삭제</button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;
        
        const visitInfo = `
            <div class="detail-section">
                <h5>📈 최근 방문 기록 (${visitHistory.length}개)</h5>
                ${visitHistory.length > 0 ? 
                    '<div class="detail-item" style="background:#e8f4fd;border:1px solid #b8daff;padding:8px;margin-bottom:8px;border-radius:4px;"><strong>ℹ️ 안내:</strong> 방문 기록 삭제 여부는 사이트 삭제 시 별도로 선택할 수 있습니다.</div>' : ''}
                ${visitHistory.length === 0 ? 
                    '<div class="detail-item">최근 방문 기록이 없습니다.</div>' :
                    visitHistory.slice(0, 5).map(visit => `
                        <div class="detail-item">
                            <div class="detail-value">
                                <strong>${visit.title || visit.url}</strong><br>
                                <small>${this.formatDate(visit.lastVisitTime)} • 방문 횟수: ${visit.visitCount || 1}회</small>
                            </div>
                        </div>
                    `).join('')
                }
                ${visitHistory.length > 5 ? `<div class="detail-item">... 외 ${visitHistory.length - 5}개 더</div>` : ''}
            </div>
        `;
        
        return siteInfo + cookieInfo + serviceWorkerInfo + visitInfo;
    }
    
    hideModal() {
        this.modal.style.display = 'none';
        this.currentModalDomain = null;
    }
    
    async deleteCurrentModalSite() {
        if (!this.currentModalDomain) return;
        
        this.hideModal();
        await this.deleteSite(this.currentModalDomain);
    }
    
    // Service Worker 삭제 버튼 이벤트 리스너 추가
    attachServiceWorkerDeleteListeners(domain) {
        const deleteButtons = this.modalContent.querySelectorAll('.service-worker-delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const scope = button.getAttribute('data-scope');
                if (scope) {
                    await this.removeServiceWorker(scope, domain);
                }
            });
        });
    }
    
    // Service Worker 개별 삭제
    async removeServiceWorker(scope, domain = null) {
        const targetDomain = domain || this.currentModalDomain;
        if (!targetDomain || !scope) return;
        
        if (!confirm(`Service Worker를 삭제하시겠습니까?\n\n스코프: ${scope}\n\n이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }
        
        try {
            this.showStatus('Service Worker 삭제 중...', 'info');
            
            // background script를 통해 Service Worker 삭제 요청
            const response = await this.sendMessageToBackground({
                action: 'removeServiceWorker',
                domain: targetDomain,
                scope: scope
            });
            
            if (response && response.success) {
                this.showStatus('Service Worker가 삭제되었습니다.', 'success');
                
                // 모달이 열려있으면 새로고침
                if (this.modal.style.display === 'block') {
                    await this.showSiteDetail(targetDomain);
                }
            } else {
                this.showStatus('Service Worker 삭제 중 오류가 발생했습니다.', 'error');
            }
        } catch (error) {
            console.error('Service Worker 삭제 오류:', error);
            this.showStatus('Service Worker 삭제 중 오류가 발생했습니다.', 'error');
        }
    }
    
    // 탭 전환
    switchTab(tabName) {
        // 모든 탭 버튼과 컨텐츠 비활성화
        this.tabBtns.forEach(btn => btn.classList.remove('active'));
        this.tabContents.forEach(content => content.classList.remove('active'));
        
        // 선택된 탭 활성화
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Tab`).classList.add('active');
        
        // Worker 탭이 선택되면 Worker 목록 로드
        if (tabName === 'workers') {
            this.loadWorkers();
        }
    }
    
    // 모든 Worker 정보 로드
    async loadWorkers() {
        if (this.isLoadingWorkers) return;
        
        try {
            this.isLoadingWorkers = true;
            this.allWorkers = [];
            
            this.showWorkerLoading(true);
            this.showWorkerStatus('Worker 정보를 수집하는 중...', 'info');
            
            // 모든 열린 탭에서 Worker 정보 수집
            const response = await this.sendMessageToBackground({
                action: 'getAllWorkersInfo'
            });
            
            if (response && response.success) {
                this.allWorkers = response.workers || [];
                this.renderWorkers();
                this.updateWorkerStats();
                this.showWorkerStatus(`완료! ${this.allWorkers.length}개 Worker 발견됨`, 'success');
            } else {
                this.showWorkerStatus('Worker 정보를 불러오는 중 오류가 발생했습니다.', 'error');
            }
            
        } catch (error) {
            console.error('Worker 로드 오류:', error);
            this.showWorkerStatus('Worker 정보를 불러오는 중 오류가 발생했습니다: ' + error.message, 'error');
        } finally {
            this.isLoadingWorkers = false;
            this.hideWorkerLoading();
        }
    }
    
    // Worker 목록 렌더링
    renderWorkers() {
        if (this.allWorkers.length === 0) {
            this.workersContainer.innerHTML = `
                <div class="empty-state">
                    실행 중인 Worker가 없습니다
                </div>
            `;
            return;
        }
        
        this.workersContainer.innerHTML = this.allWorkers.map(worker => `
            <div class="worker-item" data-worker-id="${worker.id || worker.scope}">
                <div class="worker-info">
                    <div class="worker-type">
                        ${this.getWorkerIcon(worker.type)} ${worker.type}
                        <span class="worker-status ${worker.state}">${this.getWorkerStateText(worker.state)}</span>
                    </div>
                    <div class="worker-details">
                        도메인: ${worker.domain || 'N/A'}<br>
                        ${worker.scope ? `스코프: ${worker.scope}<br>` : ''}
                        ${worker.scriptURL ? `스크립트: ${worker.scriptURL}<br>` : ''}
                        탭 ID: ${worker.tabId || 'N/A'} • 
                        발견 시간: ${this.formatDate(new Date(worker.timestamp).getTime())}
                    </div>
                </div>
                <div class="worker-actions">
                    <button class="delete-btn" data-worker-id="${worker.id || worker.scope}" data-tab-id="${worker.tabId}">종료</button>
                </div>
            </div>
        `).join('');
        
        this.attachWorkerEventListeners();
    }
    
    // Worker 아이콘 반환
    getWorkerIcon(type) {
        const icons = {
            'Service Worker': '⚙️',
            'Web Worker': '👷',
            'Shared Worker': '🔗',
            'Dedicated Worker': '🔧'
        };
        return icons[type] || '⚡';
    }
    
    // Worker 상태 텍스트 반환
    getWorkerStateText(state) {
        const stateTexts = {
            'active': '활성',
            'installing': '설치 중',
            'waiting': '대기 중',
            'terminated': '종료됨',
            'running': '실행 중',
            'unknown': '알 수 없음'
        };
        return stateTexts[state] || state || '알 수 없음';
    }
    
    // Worker 이벤트 리스너 연결
    attachWorkerEventListeners() {
        this.workersContainer.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const workerId = e.target.dataset.workerId;
                const tabId = parseInt(e.target.dataset.tabId);
                this.terminateWorker(workerId, tabId);
            });
        });
    }
    
    // 개별 Worker 종료
    async terminateWorker(workerId, tabId) {
        if (!workerId) return;
        
        if (!confirm(`Worker를 종료하시겠습니까?\n\nID: ${workerId}\n\n이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }
        
        try {
            this.showWorkerStatus('Worker 종료 중...', 'info');
            
            const response = await this.sendMessageToBackground({
                action: 'terminateWorker',
                workerId: workerId,
                tabId: tabId
            });
            
            if (response && response.success) {
                this.showWorkerStatus('Worker가 종료되었습니다.', 'success');
                // Worker 목록 새로고침
                await this.loadWorkers();
            } else {
                this.showWorkerStatus('Worker 종료 중 오류가 발생했습니다.', 'error');
            }
        } catch (error) {
            console.error('Worker 종료 오류:', error);
            this.showWorkerStatus('Worker 종료 중 오류가 발생했습니다.', 'error');
        }
    }
    
    // 모든 Worker 종료
    async terminateAllWorkers() {
        if (this.allWorkers.length === 0) return;
        
        const count = this.allWorkers.length;
        if (!confirm(`모든 Worker(${count}개)를 종료하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
            return;
        }
        
        try {
            this.showWorkerStatus(`${count}개 Worker 종료 중...`, 'info');
            
            const response = await this.sendMessageToBackground({
                action: 'terminateAllWorkers',
                workers: this.allWorkers
            });
            
            if (response && response.success) {
                this.showWorkerStatus(`${count}개 Worker가 종료되었습니다.`, 'success');
                // Worker 목록 새로고침
                await this.loadWorkers();
            } else {
                this.showWorkerStatus('Worker 종료 중 오류가 발생했습니다.', 'error');
            }
        } catch (error) {
            console.error('모든 Worker 종료 오류:', error);
            this.showWorkerStatus('Worker 종료 중 오류가 발생했습니다.', 'error');
        }
    }
    
    // Worker 통계 업데이트
    updateWorkerStats() {
        this.totalWorkers.textContent = this.allWorkers.length;
        this.workerStats.style.display = this.allWorkers.length > 0 ? 'block' : 'none';
    }
    
    // Worker 상태 메시지 표시
    showWorkerStatus(message, type) {
        this.workerStatus.textContent = message;
        this.workerStatus.className = `status ${type}`;
        this.workerStatus.style.display = 'block';
        
        if (type === 'success') {
            setTimeout(() => this.hideWorkerStatus(), 3000);
        }
    }
    
    hideWorkerStatus() {
        this.workerStatus.style.display = 'none';
    }
    
    showWorkerLoading(show) {
        this.workerLoadingState.style.display = show ? 'block' : 'none';
        this.refreshWorkersBtn.disabled = show;
    }
    
    hideWorkerLoading() {
        this.workerLoadingState.style.display = 'none';
        this.refreshWorkersBtn.disabled = false;
    }
}

// 전역 CookieRemover 인스턴스
let cookieRemoverInstance = null;

// Service Worker 삭제를 위한 전역 함수는 CSP 위반으로 제거됨
// 대신 이벤트 리스너를 통해 처리

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    cookieRemoverInstance = new CookieRemover();
});