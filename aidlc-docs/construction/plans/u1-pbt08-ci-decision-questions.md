# U1 PBT-08 CI 실행 환경 결정

U1 로컬 검증은 44개 테스트, ruff, Python 컴파일, `uv lock --check`까지 모두 통과했습니다.

그러나 PBT Partial의 **PBT-08**은 CI에서 Hypothesis shrinking 결과와 failure seed/재현 출력을 보존하도록 요구합니다. 기존 결정은 CI를 “일단” 보류하는 것이었고, U1 코드 생성 계획도 CI 구성에는 별도 명시 승인이 필요하다고 기록했습니다.

다음 선택은 U1 Code Generation 완료와 U2 진행 가능 여부를 결정합니다. `[Answer]:` 뒤에 선택지 알파벳을 입력한 뒤 “완료”라고 알려주세요.

## Question 1
PBT-08을 충족하기 위해 어떤 CI 실행 환경을 지금 구성할까요?

A) GitHub Actions를 구성한다. `uv lock --check`, `uv run pytest`, ruff를 실행하고 실패 로그/재현 정보를 보존한다. (제안)

B) EC2 자체 CI를 구성한다. uv 기반 테스트와 failure seed/출력을 보존한다.

C) CI 보류를 유지한다. 이 경우 PBT-08은 미준수이며 U1 Code Generation 완료 및 U2 진행은 차단된다.

X) Other (please describe after [Answer]: tag below)

[Answer]: B
