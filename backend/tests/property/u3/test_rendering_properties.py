from hypothesis import given
from hypothesis import strategies as st

from app.features.rendering.models import BodyBlock, CoverModel, RenderModel


@given(st.text(max_size=50))
def test_render_model_round_trip(content: str) -> None:
    model = RenderModel(
        cover=CoverModel(
            public_document_id="PRJ-001",
            title="t",
            description="",
            artifact_type="MarkdownDocument",
        ),
        change_history=(),
        body_blocks=(BodyBlock(kind="paragraph", content=content),),
    )
    assert RenderModel.model_validate_json(model.model_dump_json()) == model
