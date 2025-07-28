# Remove Cookie - 사이트 데이터 정리 확장 프로그램

## 개요
특정 사이트의 쿠키, 세션, 로컬 스토리지 등 모든 기록을 삭제하는 Chrome 확장 프로그램입니다.

## 주요 기능
- 📋 **사이트 리스트 표시**: 최근 30일간 방문한 사이트 목록
- 🔍 **검색 기능**: 실시간 사이트 검색 및 필터링
- 🗑️ **개별 삭제**: 특정 사이트의 모든 데이터 삭제
- ✅ **일괄 삭제**: 여러 사이트 선택하여 한번에 삭제
- 📊 **데이터 통계**: 사이트별 쿠키 개수 및 방문 정보

## 삭제 가능한 데이터 유형
- 🍪 쿠키 (Cookies)
- 💾 로컬 스토리지 (Local Storage)
- 🔄 세션 스토리지 (Session Storage)
- 🗄️ IndexedDB
- 📦 캐시 스토리지 (Cache Storage)
- 🌐 브라우저 캐시 (Browser Cache)
- ⚙️ 서비스 워커 (Service Workers)
- 🗃️ WebSQL

## 설치 방법
1. Chrome 브라우저에서 `chrome://extensions/` 접속
2. 우상단 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 이 폴더 선택

## 사용 방법
1. 확장 프로그램 아이콘 클릭
2. 삭제하고 싶은 사이트 검색 또는 목록에서 선택
3. 개별 삭제 버튼 클릭 또는 여러 개 선택 후 일괄 삭제

## 기술 스택
- Chrome Extension Manifest V3
- Vanilla JavaScript
- Chrome APIs:
  - `chrome.browsingData`
  - `chrome.cookies` 
  - `chrome.history`
  - `chrome.storage`

## 파일 구조
```
removeCookie/
├── manifest.json          # 확장 프로그램 설정
├── popup.html             # 팝업 UI
├── popup.js               # 팝업 로직
├── icons/                 # 아이콘 파일들
└── README.md              # 이 파일
```

## 주의사항
⚠️ **데이터 복구 불가**: 삭제된 데이터는 복구할 수 없습니다.
⚠️ **로그아웃**: 사이트 데이터 삭제 시 해당 사이트에서 자동으로 로그아웃됩니다.

## 개발자 정보
- 버전: 1.0.0
- 라이선스: MIT