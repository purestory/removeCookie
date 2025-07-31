// Remove Cookie Extension - Content Script
// 각 웹사이트에서 실행되어 Service Worker 정보를 수집

console.log('Remove Cookie Extension - Content Script Loaded');

// Service Worker 정보 수집
async function getServiceWorkerInfo() {
    try {
        if (!('serviceWorker' in navigator)) {
            return [];
        }

        const registration = await navigator.serviceWorker.getRegistrations();
        const serviceWorkers = [];

        for (const reg of registration) {
            const swInfo = {
                scope: reg.scope,
                scriptURL: reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL,
                state: reg.active?.state || reg.waiting?.state || reg.installing?.state,
                updateViaCache: reg.updateViaCache,
                active: !!reg.active,
                waiting: !!reg.waiting,
                installing: !!reg.installing,
                lastUpdateCheck: reg.lastUpdateCheck || null
            };

            // 현재 도메인과 관련된 Service Worker만 포함
            if (swInfo.scope && swInfo.scope.includes(window.location.hostname)) {
                serviceWorkers.push(swInfo);
            }
        }

        return serviceWorkers;
    } catch (error) {
        console.warn('Service Worker 정보 수집 오류:', error);
        return [];
    }
}

// Cache Storage 정보 수집
async function getCacheStorageInfo() {
    try {
        if (!('caches' in window)) {
            return [];
        }

        const cacheNames = await caches.keys();
        const cacheInfo = [];

        for (const cacheName of cacheNames) {
            try {
                const cache = await caches.open(cacheName);
                const requests = await cache.keys();
                
                cacheInfo.push({
                    name: cacheName,
                    size: requests.length,
                    urls: requests.slice(0, 5).map(req => req.url) // 처음 5개만
                });
            } catch (error) {
                console.warn('Cache 정보 수집 오류:', cacheName, error);
            }
        }

        return cacheInfo;
    } catch (error) {
        console.warn('Cache Storage 정보 수집 오류:', error);
        return [];
    }
}

// IndexedDB 정보 수집
async function getIndexedDBInfo() {
    try {
        if (!('indexedDB' in window)) {
            return [];
        }

        // IndexedDB 데이터베이스 목록 조회는 보안상 제한적
        // 대신 localStorage와 sessionStorage 정보를 제공
        const storageInfo = {
            localStorage: {
                count: Object.keys(localStorage).length,
                keys: Object.keys(localStorage).slice(0, 10) // 처음 10개만
            },
            sessionStorage: {
                count: Object.keys(sessionStorage).length,
                keys: Object.keys(sessionStorage).slice(0, 10) // 처음 10개만
            }
        };

        return storageInfo;
    } catch (error) {
        console.warn('Storage 정보 수집 오류:', error);
        return {};
    }
}

// Web Worker 정보 수집 (제한적)
async function getWebWorkerInfo() {
    try {
        // Web Worker는 직접 목록을 가져올 수 없음
        // 대신 현재 페이지에서 사용 중인 Worker 스크립트 감지
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        const workerScripts = scripts.filter(script => 
            script.src.includes('worker') || 
            script.src.includes('sw.js') ||
            script.src.includes('service-worker')
        );

        return workerScripts.map(script => ({
            src: script.src,
            type: 'detected-worker-script'
        }));
    } catch (error) {
        console.warn('Web Worker 정보 수집 오류:', error);
        return [];
    }
}

// 통합 데이터 수집
async function collectSiteData() {
    try {
        const [serviceWorkers, cacheStorage, indexedDBInfo, webWorkers] = await Promise.all([
            getServiceWorkerInfo(),
            getCacheStorageInfo(),
            getIndexedDBInfo(),
            getWebWorkerInfo()
        ]);

        return {
            domain: window.location.hostname,
            url: window.location.href,
            serviceWorkers: serviceWorkers,
            cacheStorage: cacheStorage,
            storage: indexedDBInfo,
            webWorkers: webWorkers,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('사이트 데이터 수집 오류:', error);
        return {
            domain: window.location.hostname,
            url: window.location.href,
            serviceWorkers: [],
            cacheStorage: [],
            storage: {},
            webWorkers: [],
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// Background script로부터 메시지 처리
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);

    switch (request.action) {
        case 'getServiceWorkers':
            getServiceWorkerInfo().then(serviceWorkers => {
                sendResponse({ 
                    success: true, 
                    serviceWorkers: serviceWorkers 
                });
            }).catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    serviceWorkers: [] 
                });
            });
            return true; // 비동기 응답

        case 'getCacheStorage':
            getCacheStorageInfo().then(cacheStorage => {
                sendResponse({ 
                    success: true, 
                    cacheStorage: cacheStorage 
                });
            }).catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    cacheStorage: [] 
                });
            });
            return true;

        case 'getStorageInfo':
            getIndexedDBInfo().then(storage => {
                sendResponse({ 
                    success: true, 
                    storage: storage 
                });
            }).catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message,
                    storage: {} 
                });
            });
            return true;

        case 'getAllSiteData':
            collectSiteData().then(data => {
                sendResponse({ 
                    success: true, 
                    data: data 
                });
            }).catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            });
            return true;

        case 'terminateWorker':
            terminateWorkerByScript(request.workerId).then(result => {
                sendResponse({ 
                    success: result.success, 
                    message: result.message 
                });
            }).catch(error => {
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            });
            return true;

        default:
            sendResponse({ 
                success: false, 
                error: 'Unknown action' 
            });
    }
});

// Worker 종료 함수
async function terminateWorkerByScript(workerId) {
    try {
        if (!workerId) {
            return { success: false, message: 'Worker ID가 필요합니다.' };
        }

        // Service Worker 종료 시도
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                
                for (const registration of registrations) {
                    if (registration.scope === workerId || 
                        (registration.active && registration.active.scriptURL === workerId)) {
                        
                        await registration.unregister();
                        return { 
                            success: true, 
                            message: 'Service Worker가 등록 해제되었습니다.' 
                        };
                    }
                }
            } catch (error) {
                console.warn('Service Worker 종료 시도 실패:', error);
            }
        }

        // Web Worker 종료는 직접적으로 불가능 (페이지에서 관리)
        // 대신 페이지에 알림을 보내는 방식으로 처리
        try {
            // 페이지에 커스텀 이벤트 발송
            const event = new CustomEvent('terminateWorker', {
                detail: { workerId: workerId }
            });
            document.dispatchEvent(event);
            
            return { 
                success: true, 
                message: 'Worker 종료 이벤트가 전송되었습니다.' 
            };
        } catch (error) {
            console.warn('Worker 종료 이벤트 전송 실패:', error);
            return { 
                success: false, 
                message: 'Worker를 종료할 수 없습니다.' 
            };
        }
    } catch (error) {
        console.error('Worker 종료 오류:', error);
        return { 
            success: false, 
            message: error.message 
        };
    }
}

// Worker 모니터링 기능 추가
function startWorkerMonitoring() {
    // Service Worker 변화 감지
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('Service Worker controller changed');
        });
        
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('Service Worker message:', event.data);
        });
    }
    
    // Web Worker 종료 이벤트 리스너
    document.addEventListener('terminateWorker', (event) => {
        console.log('Worker 종료 요청:', event.detail.workerId);
        // 실제 페이지의 Worker 종료 로직은 페이지에서 구현해야 함
    });
}

// 페이지 로드 완료 시 자동으로 데이터 수집 (선택적)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Remove Cookie Extension - Page loaded, ready to collect data');
        startWorkerMonitoring();
    });
} else {
    console.log('Remove Cookie Extension - Page already loaded, ready to collect data');
    startWorkerMonitoring();
}

console.log('Remove Cookie Extension - Content Script Ready');