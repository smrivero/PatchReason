"""Gateway contract checks using a simulated Ollama HTTP server in memory."""
import httpx
from fastapi.testclient import TestClient

from api import main


client = TestClient(main.app)


def fake_ollama(request: httpx.Request) -> httpx.Response:
    if request.url.path == '/api/tags':
        return httpx.Response(200, json={'models': [{'name': main.OLLAMA_MODEL}]})
    if request.url.path == '/api/chat':
        posted = __import__('json').loads(request.content)
        assert posted['model'] == main.OLLAMA_MODEL
        return httpx.Response(200, json={
            'message': {'content': __import__('json').dumps({
                'vulnerable': True,
                'summary': 'Potential SQL injection from request input.',
                'findings': [{
                    'title': 'SQL injection', 'severity': 'high', 'cwe': 'CWE-89',
                    'line': 2, 'explanation': 'Raw request input is concatenated into SQL.',
                    'recommendation': 'Use bound query parameters.',
                }],
            })},
            'prompt_eval_count': 120,
            'eval_count': 55,
        })
    return httpx.Response(404)


def install_transport(monkeypatch, handler=fake_ollama):
    monkeypatch.setattr(
        main,
        'make_client',
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


def test_status_and_models(monkeypatch):
    install_transport(monkeypatch)
    status = client.get('/api/status')
    assert status.status_code == 200
    assert status.json()['inference_ready'] is True
    assert status.json()['model_trained_with_lora'] is False
    models = client.get('/api/models').json()
    assert models['models'][0]['id'] == 'jetson-qwen35-4b'
    assert models['models'][0]['available'] is True


def test_real_review_contract(monkeypatch):
    install_transport(monkeypatch)
    result = client.post('/api/reviews', json={
        'code': 'const id = req.query.id;\ndb.query("select * from t where id=" + id);',
        'language': 'javascript',
        'model': 'jetson-qwen35-4b',
    })
    assert result.status_code == 200, result.text
    payload = result.json()
    assert payload['mode'] == 'live'
    assert payload['is_demo'] is False
    assert payload['provider'] == 'ollama'
    assert payload['findings'][0]['cwe'] == 'CWE-89'
    assert payload['model_name'] == main.OLLAMA_MODEL
    assert payload['usage']['completion_tokens'] == 55


def test_no_fake_lora_routing(monkeypatch):
    install_transport(monkeypatch)
    result = client.post('/api/reviews', json={
        'code': 'const x = process.env.SECRET;',
        'language': 'javascript',
        'model': 'qwen35-lora',
    })
    assert result.status_code == 409


def test_empty_real_evidence():
    assert client.get('/api/evaluations/summary').json()['metrics'] is None
    assert client.get('/api/gpu/telemetry').json()['samples'] == []
    assert client.get('/api/runs').json()['runs'] == []


def test_unavailable_upstream(monkeypatch):
    def bad_ollama(request):
        raise httpx.ConnectError('connection refused', request=request)
    install_transport(monkeypatch, bad_ollama)
    assert client.get('/api/status').json()['inference_ready'] is False
    result = client.post('/api/reviews', json={
        'code': 'const id = req.query.id;', 'language': 'typescript',
    })
    assert result.status_code == 503


def test_rejects_giant_code():
    result = client.post('/api/reviews', json={
        'code': 'x' * (main.MAX_CODE_CHARS + 1), 'language': 'javascript',
    })
    assert result.status_code == 422
