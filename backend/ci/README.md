# EC2 자체 CI

`ci-backend.sh`는 uv로 lockfile, pytest/Hypothesis, ruff, Python 컴파일을 실행하고 `.ci-artifacts/`에 타임스탬프 로그를 남긴다. 실패 시 Hypothesis shrinking과 pytest 재현 출력도 같은 로그에 보존한다.

EC2에서 systemd timer를 활성화하려면 다음을 실행한다.

```bash
sudo cp backend/ci/systemd/aidlc-backend-ci.service /etc/systemd/system/
sudo cp backend/ci/systemd/aidlc-backend-ci.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aidlc-backend-ci.timer
systemctl list-timers aidlc-backend-ci.timer
```

즉시 1회 실행은 프로젝트 루트에서 `./ci-backend.sh`로 수행한다.
