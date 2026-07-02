from app.services.llm import Delta, Usage, parse_stream_line


def test_parse_delta_line():
    line = 'data: {"choices":[{"delta":{"content":"سلام"}}]}'
    assert parse_stream_line(line) == Delta("سلام")


def test_parse_usage_line():
    line = 'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20}}'
    assert parse_stream_line(line) == Usage(10, 20)


def test_parse_ignores_done_comments_and_garbage():
    assert parse_stream_line("data: [DONE]") is None
    assert parse_stream_line(": keepalive") is None
    assert parse_stream_line("") is None
    assert parse_stream_line("data: {not json") is None
    assert parse_stream_line('data: {"choices":[{"delta":{}}]}') is None
