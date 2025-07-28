const messages = {
  ko: {
    extensionName: "사이트 데이터 정리",
    searchPlaceholder: "사이트 검색...",
    deleteButton: "삭제",
    selectAll: "전체 선택",
    deselectAll: "전체 해제",
    deleteSelected: "선택 삭제",
    sitesFound: "개 사이트 발견",
    cookies: "쿠키",
    localStorage: "로컬스토리지",
    sessionStorage: "세션스토리지",
    lastVisited: "마지막 방문",
    deleteConfirm: "정말 삭제하시겠습니까?",
    deleteSuccess: "삭제가 완료되었습니다",
    deleteError: "삭제 중 오류가 발생했습니다",
    loading: "로딩 중...",
    noSites: "저장된 데이터가 있는 사이트가 없습니다",
    deleteAll: "모든 데이터 삭제",
    refreshList: "목록 새로고침",
    settings: "설정",
    about: "정보",
    confirmDeleteSite: "사이트의 모든 데이터를 삭제하시겠습니까?",
    confirmDeleteAll: "모든 사이트의 데이터를 삭제하시겠습니까?",
    deletingProgress: "삭제 진행 중...",
    dataTypes: "데이터 유형",
    totalSize: "총 크기"
  },
  en: {
    extensionName: "Site Data Cleaner",
    searchPlaceholder: "Search sites...",
    deleteButton: "Delete",
    selectAll: "Select All",
    deselectAll: "Deselect All",
    deleteSelected: "Delete Selected",
    sitesFound: " sites found",
    cookies: "Cookies",
    localStorage: "Local Storage",
    sessionStorage: "Session Storage", 
    lastVisited: "Last Visited",
    deleteConfirm: "Are you sure you want to delete?",
    deleteSuccess: "Deletion completed successfully",
    deleteError: "An error occurred during deletion",
    loading: "Loading...",
    noSites: "No sites with stored data found",
    deleteAll: "Delete All Data",
    refreshList: "Refresh List",
    settings: "Settings",
    about: "About",
    confirmDeleteSite: "Delete all data for this site?",
    confirmDeleteAll: "Delete data for all sites?",
    deletingProgress: "Deleting...",
    dataTypes: "Data Types",
    totalSize: "Total Size"
  }
};

export function getMessage(key) {
  const lang = navigator.language.toLowerCase();
  const langCode = lang.startsWith('ko') ? 'ko' : 'en';
  return messages[langCode][key] || messages.en[key] || key;
}