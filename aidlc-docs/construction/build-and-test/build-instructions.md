# Build Instructions

## prerequisites
- Linux EC2 development host, `uv`, Python `3.12`, `fnm 1.39+`, Node `v22.23.2`, npm `10.9.8`.
- Backend runtime environment: `AIDLC_ADMIN_USERNAME`, `AIDLC_ADMIN_PASSWORD`, `AWS_REGION`, `AIDLC_DYNAMODB_TABLE_PREFIX`, `AIDLC_S3_BUCKET_NAME`.
- AWS credentials/instance role authorized for configured DynamoDB, S3, and Bedrock resources when calling real APIs. Tests use fakes/Stubber and do not invoke a live model.

## install and build
```bash
cd /home/ec2-user/project/cop_0904

# Backend locked Python environment
cd backend
uv lock --check
uv sync --all-extras
uv run ruff format --check app tests
uv run ruff check app tests
uv run python -m compileall -q app
cd ..

# Frontend exact Node/npm environment
fnm use v22.23.2
node --version  # v22.23.2 expected
cd frontend
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run build
cd ..
```

## expected artifacts
- Backend: validated Python bytecode under source directories; no deployable package is produced for this MVP.
- Frontend: `frontend/dist/` Vite production bundle.
- Lockfiles: `backend/uv.lock` and `frontend/package-lock.json` remain unchanged after reproducible install.

## combined development run
```bash
./run-aidlc.sh
```
The runner starts FastAPI at `http://127.0.0.1:8000` and Vite at `http://127.0.0.1:5173`, forwards termination to both children, installs nothing, and does not modify systemd. It requires existing `frontend/node_modules`; first run `npm ci`.

## troubleshooting
- Node mismatch: run `fnm use v22.23.2`; do not use the older local Node 24 runtime.
- npm lock mismatch: delete only `frontend/node_modules`, run `npm ci`, and never edit `package-lock.json` manually.
- backend configuration error at live API request: export the five required backend environment variables; do not put credentials in frontend source or `.env` committed files.
- port conflict: set `AIDLC_PORT`, `AIDLC_FRONTEND_PORT`, `AIDLC_HOST`, or `AIDLC_FRONTEND_HOST` before `./run-aidlc.sh`.
