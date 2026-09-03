"""FastAPI application factory and U2 feature composition."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.auth_routes import router as auth_router
from app.features.ai_workspace.errors import AiWorkspaceProblem
from app.features.ai_workspace.routes import router as ai_workspace_router
from app.features.artifacts.errors import ApiProblem
from app.features.artifacts.routes import router as artifacts_router
from app.features.projects.routes import router as projects_router
from app.features.rendering.errors import RenderProblem
from app.features.rendering.routes import router as rendering_router


def create_app() -> FastAPI:
    app = FastAPI(title="AIDLC Artifact Management API", version="0.2.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.exception_handler(ApiProblem)
    async def api_problem_handler(_: Request, error: ApiProblem) -> JSONResponse:
        payload = {"code": error.code, "message": error.message, "retryable": error.retryable}
        if error.current_revision is not None:
            payload["current_revision"] = error.current_revision
        return JSONResponse(status_code=error.status_code, content=payload)

    @app.exception_handler(RenderProblem)
    async def render_problem_handler(_: Request, error: RenderProblem) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={"code": error.code, "message": error.message, "retryable": error.retryable},
        )

    @app.exception_handler(AiWorkspaceProblem)
    async def ai_workspace_problem_handler(_: Request, error: AiWorkspaceProblem) -> JSONResponse:
        return JSONResponse(
            status_code=error.status_code,
            content={"code": error.code, "message": error.message, "retryable": error.retryable},
        )

    app.include_router(auth_router)
    app.include_router(projects_router)
    app.include_router(artifacts_router)
    app.include_router(rendering_router)
    app.include_router(ai_workspace_router)
    return app


app = create_app()
