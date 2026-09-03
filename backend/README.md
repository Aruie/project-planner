# AIDLC Artifact Management Backend

U1은 프로젝트 범위, 공통 도메인 타입, 저장소 port, DynamoDB/S3 adapter의 기반을 제공한다.

## 로컬 설정

```bash
uv sync --all-extras
```

임시 관리자 자격 증명과 AWS 연결 값은 환경 변수로만 제공한다. 소스 코드에 자격 증명을 기록하지 않는다.

## 검증

```bash
uv lock --check
uv run pytest
uv run ruff check app tests
```

PBT는 Hypothesis를 사용한다. CI의 seed 보존 구성은 PBT-08 게이트이며, 별도 승인 전에는 생성하지 않는다.

## 프로젝트 루트 실행

프로젝트 루트에서 다음을 실행합니다.

```bash
./run-backend.sh
```

기본 주소는 `http://127.0.0.1:8000`입니다. 예: `AIDLC_PORT=8080 ./run-backend.sh --reload`
