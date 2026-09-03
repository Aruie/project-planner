# U4 NFR Requirements Clarification

Question 1 응답은 “하이쿠 4.5 모델 글로벌 인퍼런스 버전”으로 의도는 명확하지만, Bedrock Converse API에서 사용할 exact inference profile ID를 코드/config에 고정해야 합니다.

## Clarification Question 1: Claude Haiku 4.5 global inference profile ID

A) `global.anthropic.claude-haiku-4-5-20251001-v1:0`를 사용한다. (사용자 지정 global inference 의도에 따른 제안)

B) EC2가 us profile을 호출하도록 `us.anthropic.claude-haiku-4-5-20251001-v1:0`를 사용한다.

X) Other (please describe exact Bedrock inference profile ID after [Answer]: tag below)

[Answer]: A
