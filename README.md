# 사이 — 두 장소 사이의 거리

한국어 반응형 거리 측정 웹앱. Nominatim으로 장소 이름/주소를 조회하고, 선택한 두 좌표의 **직선거리**를 Haversine 공식(평균 지구 반경 6,371.0088 km)으로 계산합니다. 1 km 미만은 m, 그 이상은 km로 표시합니다. 도로·도보·자동차 이동거리를 계산하는 앱은 아닙니다.

## 기능

- 출발지·도착지 검색 버튼과 검색 결과 선택(각 5개까지)
- 선택한 장소의 전체 주소 표시, 출발지/도착지 교환
- 총거리 아래 **지도에서 보기**: 선택한 두 좌표를 OpenStreetMap 길찾기에 전달
- 입력 수정 시 이전 선택과 거리 결과 초기화
- 로딩·결과 없음·오류·요청 제한 안내, 키보드 조작, 모바일 지원
- 외부 패키지 및 프런트엔드 빌드 도구 없이 실행

## 로컬 실행

Node.js 22 이상을 설치한 다음:

```sh
npm run dev
```

http://localhost:3000 접속. 패키지 설치는 필요 없습니다. 로컬에서는 메모리 캐시/요청 제한을 사용합니다. `.env.example`을 `.env.local`로 복사하면 운영 환경 설정도 로컬에서 확인할 수 있습니다.

검색 시 “검색 서비스에 연결하지 못했어요”가 나오면 개발 서버의 외부 HTTPS 연결 권한을 확인하세요. Codex의 네트워크 제한 안에서 서버를 시작하면 Nominatim 연결이 `EACCES`로 차단될 수 있습니다. 해당 서버를 종료한 뒤 IDE의 일반 터미널에서 `npm run dev`를 실행하거나, Codex의 네트워크 접근 승인을 받아 다시 실행하세요. 로컬 검색에는 Redis 설정이 필요하지 않습니다.

```sh
npm test
npm run build
```

`dist/`는 자동 생성되므로 GitHub에 올릴 필요가 없습니다.

## GitHub → Vercel

1. 이 폴더의 소스 전체를 GitHub 저장소에 올립니다. `.env.local`은 올리지 마세요.
2. Vercel에서 **Add New → Project → Import Git Repository**로 해당 저장소를 선택합니다.
3. Framework Preset은 **Other**, Root Directory는 이 프로젝트 루트로 지정합니다. `vercel.json`에 Build Command `npm run build`, Output Directory `dist`가 설정되어 있습니다.
4. 추가 환경변수 없이 Deploy합니다.
5. 배포 URL에서 두 장소 검색 → 결과 선택 → 거리 측정 → 지도 링크를 확인합니다.

### 선택 환경변수

기본적으로 서버 메모리 캐시와 요청 제한을 사용합니다. Redis를 사용하려면 Upstash Redis를 만들고 Vercel 프로젝트 **Settings → Environment Variables**에 REST URL과 TOKEN을 함께 등록하세요.

| 변수 | 값 |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST TOKEN (서버 전용 비밀 값) |
| `NOMINATIM_USER_AGENT` | 선택. 미설정 시 Vercel 도메인 기반 식별자 자동 생성. 운영자 연락처를 추가할 수 있습니다. |
| `NOMINATIM_SEARCH_URL` | 선택. 기본 `https://nominatim.openstreetmap.org/search` |

환경변수를 변경했다면 Redeploy합니다. Redis 사용 시 모든 인스턴스·Preview·Production에 **같은 Redis**를 연결해야 앱 전체 요청 제한이 공유됩니다. 다른 앱은 별도 데이터베이스를 사용하세요.

Redis는 선택 사항입니다. 설정한 Redis에 장애가 나면 안전을 위해 검색을 중단합니다. Redis의 무료 한도/요금은 제공자 정책을 확인하세요.

## Nominatim 공개 API 이용 조건

공개 서버는 무제한 무료 서비스가 아닙니다. 반드시 [공식 이용 정책](https://operations.osmfoundation.org/policies/nominatim/)을 확인하고 운영자가 준수해야 합니다.

- 앱의 모든 사용자를 합쳐 최대 초당 1회입니다. 기본 메모리 제한은 서버 인스턴스별로만 작동하므로 Vercel 다중 인스턴스에서는 앱 전체 제한을 보장하지 않습니다. 공개 운영에서 이 제한을 보장하려면 공유 Redis를 연결하거나 자체 호스팅/호환 제공자를 사용하세요.
- 서버는 응답 완료 후 1.1초 동안 추가 요청을 차단하고 결과를 최대 24시간 캐시합니다. 기본 메모리 캐시는 최대 200개이며 서버 재시작 시 사라집니다. Redis 사용 시 인스턴스 간 캐시와 원자적 잠금을 공유합니다.
- 검색은 사용자 버튼 클릭/Enter로만 실행합니다. 입력 중 자동완성, 자동 재시도, 주기적 검색을 하지 않습니다.
- 식별 가능한 User-Agent를 서버에서 전송합니다. 기본값은 Vercel 도메인을 사용하며 운영자 연락처를 환경변수로 추가할 수 있습니다.
- 화면에 OpenStreetMap 출처와 이용 정책을 표시합니다. 데이터는 ODbL입니다.
- 사용자가 검색한 문구는 Nominatim에 전송되고, 검색어 해시와 결과는 서버 메모리 또는 선택한 Redis에 최대 24시간 저장됩니다. 개인정보·기밀 주소는 입력하지 마세요.
- 트래픽이 늘거나 제공자 요청이 있을 때 `NOMINATIM_SEARCH_URL`을 자체 호스팅/호환 제공자로 바꾸고 재배포하세요. 브라우저 코드 수정은 필요 없습니다.
- 요청 제한 초과, 장애 또는 차단 시 검색이 실패할 수 있습니다. 실제 장소라도 OSM에 등록되지 않았거나 명칭이 다르면 검색되지 않을 수 있습니다.

지도 링크는 OpenStreetMap 길찾기 화면을 열므로 도로 경로가 표시될 수 있으며, 그 화면의 이동거리는 이 앱의 직선거리와 다릅니다.

## 구조

`public/`: 화면·스타일·거리 계산, `api/search.js`: Vercel Node.js Function, `scripts/`: 로컬 실행·정적 빌드, `tests/`: 거리 계산·검색 API 테스트.

참고: [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/), [Vercel Git 배포](https://vercel.com/docs/git).
