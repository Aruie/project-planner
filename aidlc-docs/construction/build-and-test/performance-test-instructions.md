# Performance Test Instructions

## scope
This MVP has one private-network administrator, no numerical latency/throughput SLO, no queue/cache/background polling, and no approved load-test dependency. Formal load/stress testing is therefore **N/A for the current acceptance gate**. Do not install k6, JMeter, cache, queue, or retry tooling solely for this stage.

## repeatable baseline check
1. Run both CI gates before measuring:
```bash
cd /home/ec2-user/project/cop_0904
./ci-backend.sh
./ci-frontend.sh
```
2. Start `./run-aidlc.sh` with configured real backend environment.
3. In a browser, measure one explicit Draft save, version confirmation, DOCX/XLSX export request, AI session start, and one AI message request. Record timestamp, endpoint/action, success/error code, and observed client completion time in a private test note.
4. Confirm action-local pending state appears and no automatic retry/background request occurs.

## acceptance interpretation
- Pass: browser stays responsive; an action reports a safe success/error; stale/project-switched response does not adopt state; no unrequested request/retry is observed.
- N/A: p95 latency, throughput, concurrency, stress breakpoint, and long-running availability figures. They require an approved load profile, non-production AWS test environment, cost boundary, and explicit future scope.

## future load-test prerequisite
Before performance automation, define target APIs, real AWS isolation, allowed request volume/cost, concurrent user target, response SLO, success/error assertions, report path, and cleanup policy. Obtain explicit approval before generating load traffic.
