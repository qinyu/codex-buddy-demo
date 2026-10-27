"""Live query entry points must stop at an unavailable public status."""
import json
import subprocess

import pytest

from code_wiki.graph import lookup


@pytest.mark.parametrize("kind", ["search", "cite", "impact"])
def test_uninitialized_status_stops_before_query(kind, tmp_path):
    calls = []

    def run(argv, cwd=None):
        calls.append((argv, cwd))
        return subprocess.CompletedProcess(argv, 0, '{"initialized":false}', '')

    result = lookup(kind=kind, question="bleInit", repo_abs=str(tmp_path),
                    which_fn=lambda _: "/bin/codegraph", run_cmd=run)
    assert result["status"] != 0
    assert result["error"] == "graph-unavailable"
    assert calls == [(["codegraph", "status", "--json"], str(tmp_path))]
    assert not result.get("hits")


@pytest.mark.parametrize("status_output,exit_code", [
    ('not json', 0), ('[]', 0), ('{}', 0),
    ('{"initialized":"true"}', 0), ('{"initialized":true}', 1),
])
def test_invalid_or_failed_status_never_queries(status_output, exit_code, tmp_path):
    calls = []
    def run(argv, cwd=None):
        calls.append(argv)
        return subprocess.CompletedProcess(argv, exit_code, status_output, 'status diagnostic')
    result = lookup(question="bleInit", repo_abs=str(tmp_path),
                    which_fn=lambda _: '/bin/codegraph', run_cmd=run)
    assert result['error'] == 'graph-unavailable'
    assert len(calls) == 1
    assert result['stderr'] == 'status diagnostic'


@pytest.mark.parametrize('kind', ['search', 'cite', 'impact'])
def test_ready_status_allows_query_without_sync(kind, tmp_path):
    calls = []
    def run(argv, cwd=None):
        calls.append(argv)
        if argv[1] == 'status':
            payload = {'initialized': True, 'pendingChanges': {'modified': 1}}
        elif argv[1] == 'impact':
            payload = {'affected': [{'name': 'start', 'filePath': 'ble.js', 'startLine': 2}]}
        else:
            payload = [{'name': 'bleInit', 'filePath': 'ble.js', 'startLine': 1}]
        return subprocess.CompletedProcess(argv, 0, json.dumps(payload), '')
    result = lookup(kind=kind, question='bleInit', repo_abs=str(tmp_path),
                    which_fn=lambda _: '/bin/codegraph', run_cmd=run)
    assert result['status'] == 0
    assert result['hits']
    assert [c[1] for c in calls] == ['status', 'impact' if kind == 'impact' else 'query']
