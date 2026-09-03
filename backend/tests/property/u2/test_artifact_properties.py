from hypothesis import given, settings
from hypothesis import strategies as st

from app.features.artifacts.models import DiffResult, DiffSourceRequest, LineHunk, TraceLinkRequest
from app.features.artifacts.pagination import PaginationCodec


@settings(max_examples=30)
@given(
    st.text(min_size=1, max_size=30),
    st.dictionaries(st.text(min_size=1, max_size=5), st.integers(), max_size=3),
)
def test_pagination_token_round_trip(project_id: str, cursor: dict[str, int]) -> None:
    codec = PaginationCodec()
    token = codec.encode("artifacts", project_id, cursor)
    assert codec.decode(token, "artifacts", project_id).cursor == cursor


@settings(max_examples=20)
@given(st.lists(st.text(max_size=20), max_size=5))
def test_diff_result_serialization_round_trip(lines: list[str]) -> None:
    result = DiffResult(
        left=DiffSourceRequest(kind="draft"),
        right=DiffSourceRequest(kind="draft"),
        metadata_changes=(),
        body_hunks=(LineHunk(kind="unchanged", before=tuple(lines), after=tuple(lines)),),
        summary={"added": 0, "removed": 0, "unchanged": len(lines)},
    )
    assert DiffResult.model_validate_json(result.model_dump_json()) == result


@settings(max_examples=30)
@given(
    st.text("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=1, max_size=20),
    st.text("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=1, max_size=20),
    st.text("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", min_size=1, max_size=20),
)
def test_trace_link_requires_all_three_identifiers(
    story: str, requirement: str, test_case: str
) -> None:
    link = TraceLinkRequest(
        story_id=story, requirement_id=requirement, test_case_id=test_case, status="ok"
    )
    assert link.story_id and link.requirement_id and link.test_case_id
