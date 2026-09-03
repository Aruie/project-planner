from hypothesis import strategies as st

from app.features.ai_workspace.services import PROMPT_MAX_BYTES

bounded_prompt = st.text(min_size=1, max_size=200)
oversized_prompt = st.just("가" * (PROMPT_MAX_BYTES + 1))
project_session_scope = st.tuples(st.uuids(), st.uuids())
