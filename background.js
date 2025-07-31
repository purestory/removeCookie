// Remove Cookie Extension - Service Worker (Background Script)

// 확장 프로그램 설치/업데이트 시 실행
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Remove Cookie Extension installed/updated:', details.reason);
    
    if (details.reason === 'install') {
        // 첫 설치 시 환영 메시지
        console.log('Remove Cookie Extension이 설치되었습니다!');
        
        // 기본 설정 저장
        chrome.storage.local.set({
            'extension_settings': {
                'autoRefresh': true,
                'showNotifications': true,
                'batchSize': 10,
                'version': '1.0.0'
            }
        });
    }
});

// 확장 프로그램 시작 시 실행
chrome.runtime.onStartup.addListener(() => {
    console.log('Remove Cookie Extension started');
});

// 알람 처리 (선택적 기능)
chrome.alarms.onAlarm.addListener((alarm) => {
    console.log('Alarm triggered:', alarm.name);
    
    switch (alarm.name) {
        case 'cleanup_reminder':
            // 정기적인 정리 알림 (추후 구현 가능)
            break;
    }
});

// 메시지 처리 (popup과 통신)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'ping':
            sendResponse({ success: true, message: 'Service Worker is running' });
            break;
            
        case 'getBrowserData':
            handleGetBrowserData(request, sendResponse);
            return true; // 비동기 응답을 위해 true 반환
            
        case 'clearSiteData':
            handleClearSiteData(request, sendResponse);
            return true;
            
        case 'getStorageQuota':
            handleGetStorageQuota(sendResponse);
            return true;
            
        case 'exportData':
            handleExportData(request, sendResponse);
            return true;
            
        case 'getServiceWorkers':
            handleGetServiceWorkers(request, sendResponse);
            return true;
            
        case 'getDetailedServiceWorkers':
            handleGetDetailedServiceWorkers(request, sendResponse);
            return true;
            
        case 'removeServiceWorker':
            handleRemoveServiceWorker(request, sendResponse);
            return true;
            
        case 'getAllWorkersInfo':
            handleGetAllWorkersInfo(request, sendResponse);
            return true;
            
        case 'terminateWorker':
            handleTerminateWorker(request, sendResponse);
            return true;
            
        case 'terminateAllWorkers':
            handleTerminateAllWorkers(request, sendResponse);
            return true;
            
        default:
            sendResponse({ error: 'Unknown action' });
    }
});

// 브라우저 데이터 조회 처리
async function handleGetBrowserData(request, sendResponse) {
    try {
        const { domain } = request;
        
        // 추가적인 브라우저 데이터 조회
        const data = {
            serviceWorkers: await getServiceWorkers(domain),
            cacheStorage: await getCacheStorage(domain),
            indexedDB: await getIndexedDBInfo(domain),
            localStorage: await getLocalStorageInfo(domain)
        };
        
        sendResponse({ success: true, data });
    } catch (error) {
        console.error('Error getting browser data:', error);
        sendResponse({ error: error.message });
    }
}

// 사이트 데이터 삭제 처리
async function handleClearSiteData(request, sendResponse) {
    try {
        const { domain, dataTypes } = request;
        
        const origins = [
            `https://${domain}`,
            `http://${domain}`,
            `https://www.${domain}`,
            `http://www.${domain}`
        ];
        
        // 데이터 삭제 옵션 설정
        const removeOptions = {};
        dataTypes.forEach(type => {
            switch (type) {
                case 'cookies':
                    removeOptions.cookies = true;
                    break;
                case 'localStorage':
                    removeOptions.localStorage = true;
                    break;
                case 'cache':
                    removeOptions.cache = true;
                    removeOptions.cacheStorage = true;
                    break;
                case 'indexedDB':
                    removeOptions.indexedDB = true;
                    break;
                case 'serviceWorkers':
                    removeOptions.serviceWorkers = true;
                    break;
                case 'webSQL':
                    removeOptions.webSQL = true;
                    break;
            }
        });
        
        // browsingData API로 삭제 실행
        await chrome.browsingData.remove({ 
            origins,
            originTypes: {
                unprotectedWeb: true,
                protectedWeb: false,
                extension: false
            }
        }, removeOptions);
        
        sendResponse({ success: true });
    } catch (error) {
        console.error('Error clearing site data:', error);
        sendResponse({ error: error.message });
    }
}

// 저장소 할당량 조회
async function handleGetStorageQuota(sendResponse) {
    try {
        // Storage API를 사용한 할당량 조회는 content script에서만 가능
        // 여기서는 기본 정보만 반환
        sendResponse({ 
            success: true, 
            message: 'Storage quota check requires content script access' 
        });
    } catch (error) {
        console.error('Error getting storage quota:', error);
        sendResponse({ error: error.message });
    }
}

// 데이터 내보내기
async function handleExportData(request, sendResponse) {
    try {
        const { sites } = request;
        
        const exportData = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            sites: sites.map(site => ({
                domain: site.domain,
                cookieCount: site.cookieCount,
                visitFrequency: site.visitFrequency,
                lastVisitTime: site.lastVisitTime,
                dataTypes: site.dataTypes
            }))
        };
        
        // JSON 데이터를 blob으로 변환
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        // 다운로드 URL 생성
        const url = URL.createObjectURL(blob);
        
        // 다운로드 실행
        await chrome.downloads.download({
            url: url,
            filename: `remove-cookie-export-${new Date().toISOString().split('T')[0]}.json`,
            saveAs: true
        });
        
        sendResponse({ success: true });
    } catch (error) {
        console.error('Error exporting data:', error);
        sendResponse({ error: error.message });
    }
}

// 서비스 워커 정보 조회 (제한적)
async function getServiceWorkers(domain) {
    try {
        // Service Worker 정보는 직접 조회가 어려움
        // 개발자 도구에서만 확인 가능
        return {
            message: 'Service Worker 정보는 개발자 도구에서 확인하세요',
            domain: domain
        };
    } catch (error) {
        return { error: error.message };
    }
}

// 캐시 스토리지 정보 조회 (제한적)
async function getCacheStorage(domain) {
    try {
        // Cache Storage 정보는 content script에서만 접근 가능
        return {
            message: 'Cache Storage 정보는 사이트별로 다릅니다',
            domain: domain
        };
    } catch (error) {
        return { error: error.message };
    }
}

// IndexedDB 정보 조회 (제한적)
async function getIndexedDBInfo(domain) {
    try {
        // IndexedDB 정보는 content script에서만 접근 가능
        return {
            message: 'IndexedDB 정보는 사이트별로 다릅니다',
            domain: domain
        };
    } catch (error) {
        return { error: error.message };
    }
}

// LocalStorage 정보 조회 (제한적)
async function getLocalStorageInfo(domain) {
    try {
        // LocalStorage 정보는 content script에서만 접근 가능
        return {
            message: 'LocalStorage 정보는 사이트별로 다릅니다',
            domain: domain
        };
    } catch (error) {
        return { error: error.message };
    }
}

// Service Worker 정보 조회
async function handleGetServiceWorkers(request, sendResponse) {
    try {
        const { domain } = request;
        
        // Service Worker 정보를 content script를 통해 조회
        const serviceWorkers = await getServiceWorkersForDomain(domain);
        
        sendResponse({ 
            success: true, 
            serviceWorkers: serviceWorkers
        });
    } catch (error) {
        console.error('Service Worker 조회 오류:', error);
        sendResponse({ 
            success: false, 
            error: error.message,
            serviceWorkers: []
        });
    }
}

// Service Worker 상세 정보 조회
async function handleGetDetailedServiceWorkers(request, sendResponse) {
    try {
        const { domain } = request;
        
        // 상세한 Service Worker 정보 조회
        const serviceWorkers = await getDetailedServiceWorkersForDomain(domain);
        
        sendResponse({ 
            success: true, 
            serviceWorkers: serviceWorkers
        });
    } catch (error) {
        console.error('Service Worker 상세 정보 조회 오류:', error);
        sendResponse({ 
            success: false, 
            error: error.message,
            serviceWorkers: []
        });
    }
}

// Service Worker 삭제
async function handleRemoveServiceWorker(request, sendResponse) {
    try {
        const { domain, scope } = request;
        
        // Service Worker 삭제 시도
        const result = await removeServiceWorkerByScope(domain, scope);
        
        if (result.success) {
            sendResponse({ 
                success: true, 
                message: 'Service Worker가 삭제되었습니다.'
            });
        } else {
            sendResponse({ 
                success: false, 
                error: result.error || 'Service Worker 삭제 실패'
            });
        }
    } catch (error) {
        console.error('Service Worker 삭제 오류:', error);
        sendResponse({ 
            success: false, 
            error: error.message
        });
    }
}

// 실제 Service Worker 정보 조회 (제한적)
async function getServiceWorkersForDomain(domain) {
    try {
        // Chrome Extension API로는 다른 사이트의 Service Worker 정보에 직접 접근 불가
        // content script를 통해 조회해야 함
        const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });
        
        if (tabs.length > 0) {
            // 활성 탭에서 Service Worker 정보 조회 시도
            try {
                const result = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'getServiceWorkers'
                });
                return result.serviceWorkers || [];
            } catch (error) {
                console.warn('Content script를 통한 Service Worker 조회 실패:', error);
                return [];
            }
        }
        
        return [];
    } catch (error) {
        console.warn('Service Worker 조회 오류:', error);
        return [];
    }
}

// 상세한 Service Worker 정보 조회
async function getDetailedServiceWorkersForDomain(domain) {
    try {
        // 기본 Service Worker 정보 조회
        const basicServiceWorkers = await getServiceWorkersForDomain(domain);
        
        // 각 Service Worker에 대한 상세 정보 추가
        const detailedServiceWorkers = basicServiceWorkers.map(sw => ({
            ...sw,
            domain: domain,
            detectedAt: new Date().toISOString()
        }));
        
        return detailedServiceWorkers;
    } catch (error) {
        console.warn('Service Worker 상세 정보 조회 오류:', error);
        return [];
    }
}

// Service Worker 삭제 (제한적)
async function removeServiceWorkerByScope(domain, scope) {
    try {
        // Chrome Extension API로는 다른 사이트의 Service Worker를 직접 삭제할 수 없음
        // browsingData API를 사용해서 해당 도메인의 Service Worker 데이터 삭제
        // Origin 필터링을 지원하는 데이터 타입
        await chrome.browsingData.remove({
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
            serviceWorkers: true
        });
        
        // Service Worker 삭제 시에는 방문 기록을 삭제하지 않음
        // (사용자가 명시적으로 요청한 경우에만 삭제)
        
        return { 
            success: true, 
            message: 'Service Worker 데이터가 삭제되었습니다.' 
        };
    } catch (error) {
        console.error('Service Worker 삭제 오류:', error);
        return { 
            success: false, 
            error: error.message 
        };
    }
}

// 모든 Worker 정보 수집
async function handleGetAllWorkersInfo(request, sendResponse) {
    try {
        const allWorkers = await getAllActiveWorkers();
        
        sendResponse({
            success: true,
            workers: allWorkers
        });
    } catch (error) {
        console.error('모든 Worker 정보 수집 오류:', error);
        sendResponse({
            success: false,
            error: error.message,
            workers: []
        });
    }
}

// Worker 종료
async function handleTerminateWorker(request, sendResponse) {
    try {
        const { workerId, tabId } = request;
        
        const result = await terminateWorkerById(workerId, tabId);
        
        sendResponse({
            success: result.success,
            message: result.message || 'Worker 종료 완료'
        });
    } catch (error) {
        console.error('Worker 종료 오류:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// 모든 Worker 종료
async function handleTerminateAllWorkers(request, sendResponse) {
    try {
        const { workers } = request;
        
        const results = await Promise.allSettled(
            workers.map(worker => terminateWorkerById(worker.id || worker.scope, worker.tabId))
        );
        
        const successCount = results.filter(result => 
            result.status === 'fulfilled' && result.value.success
        ).length;
        
        sendResponse({
            success: true,
            message: `${successCount}/${workers.length}개 Worker 종료 완료`
        });
    } catch (error) {
        console.error('모든 Worker 종료 오류:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// 모든 활성 Worker 정보 수집
async function getAllActiveWorkers() {
    try {
        const allWorkers = [];
        
        // 모든 열린 탭 조회
        const tabs = await chrome.tabs.query({});
        
        // 각 탭에서 Worker 정보 수집
        const workerPromises = tabs.map(async (tab) => {
            try {
                // http/https 탭만 처리
                if (!tab.url.startsWith('http')) {
                    return [];
                }
                
                const result = await chrome.tabs.sendMessage(tab.id, {
                    action: 'getAllSiteData'
                });
                
                if (result && result.success && result.data) {
                    const workers = [];
                    
                    // Service Worker 정보 추가
                    if (result.data.serviceWorkers) {
                        result.data.serviceWorkers.forEach(sw => {
                            workers.push({
                                id: sw.scope,
                                type: 'Service Worker',
                                domain: result.data.domain,
                                scope: sw.scope,
                                scriptURL: sw.scriptURL,
                                state: sw.state,
                                tabId: tab.id,
                                tabTitle: tab.title,
                                tabUrl: tab.url,
                                timestamp: result.data.timestamp
                            });
                        });
                    }
                    
                    // Web Worker 정보 추가 (감지된 스크립트 기반)
                    if (result.data.webWorkers) {
                        result.data.webWorkers.forEach(ww => {
                            workers.push({
                                id: ww.src,
                                type: 'Web Worker',
                                domain: result.data.domain,
                                scriptURL: ww.src,
                                state: 'running',
                                tabId: tab.id,
                                tabTitle: tab.title,
                                tabUrl: tab.url,
                                timestamp: result.data.timestamp
                            });
                        });
                    }
                    
                    return workers;
                }
                
                return [];
            } catch (error) {
                console.warn(`탭 ${tab.id} Worker 정보 수집 실패:`, error);
                return [];
            }
        });
        
        const workerResults = await Promise.allSettled(workerPromises);
        
        // 결과 취합
        workerResults.forEach(result => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                allWorkers.push(...result.value);
            }
        });
        
        // 중복 제거 (같은 scope의 Service Worker)
        const uniqueWorkers = allWorkers.filter((worker, index, arr) => 
            arr.findIndex(w => w.id === worker.id && w.type === worker.type) === index
        );
        
        return uniqueWorkers;
    } catch (error) {
        console.error('모든 Worker 정보 수집 오류:', error);
        return [];
    }
}

// Worker 종료 (ID 기반)
async function terminateWorkerById(workerId, tabId) {
    try {
        if (!workerId) {
            return { success: false, message: 'Worker ID가 필요합니다.' };
        }
        
        // Service Worker인 경우 해당 도메인 전체 삭제
        if (workerId.startsWith('http')) {
            try {
                const url = new URL(workerId);
                const domain = url.hostname;
                
                // Origin 필터링을 지원하는 데이터 타입
                await chrome.browsingData.remove({
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
                    serviceWorkers: true
                });
                
                // Worker 종료 시에는 방문 기록을 삭제하지 않음
                
                return { success: true, message: 'Service Worker 종료됨' };
            } catch (error) {
                console.error('Service Worker 종료 오류:', error);
                return { success: false, message: error.message };
            }
        }
        
        // Web Worker인 경우 해당 탭에 종료 메시지 전송
        if (tabId) {
            try {
                await chrome.tabs.sendMessage(tabId, {
                    action: 'terminateWorker',
                    workerId: workerId
                });
                
                return { success: true, message: 'Worker 종료 요청 전송됨' };
            } catch (error) {
                console.warn('Worker 종료 메시지 전송 실패:', error);
                return { success: false, message: '탭에 접근할 수 없습니다.' };
            }
        }
        
        return { success: false, message: '종료할 수 없는 Worker입니다.' };
    } catch (error) {
        console.error('Worker 종료 오류:', error);
        return { success: false, message: error.message };
    }
}

// 오류 처리
chrome.runtime.onSuspend.addListener(() => {
    console.log('Remove Cookie Extension is being suspended');
});

// 컨텍스트 메뉴 추가 (선택적)
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'removeCookieForSite',
        title: '이 사이트의 데이터 삭제',
        contexts: ['page']
    });
});

// 컨텍스트 메뉴 클릭 처리
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'removeCookieForSite' && tab.url) {
        try {
            const url = new URL(tab.url);
            const domain = url.hostname;
            
            // Origin 필터링을 지원하는 데이터 타입들
            await chrome.browsingData.remove({
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
            });
            
            // 컨텍스트 메뉴 삭제 시에는 방문 기록을 삭제하지 않음
            // (너무 파괴적이므로 기본 데이터만 삭제)
            
            // 알림 표시 (선택적)
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Remove Cookie',
                message: `${domain}의 데이터가 삭제되었습니다.`
            });
            
        } catch (error) {
            console.error('Context menu error:', error);
        }
    }
});

console.log('Remove Cookie Extension - Background Script Loaded');