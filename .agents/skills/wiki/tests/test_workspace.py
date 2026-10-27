import json
from pathlib import Path

import pytest

from code_wiki.workspace import (
    WorkspaceError,
    discard_manifest_if_complete,
    inspect_workspace,
    merge_repositories,
    normalize_repos,
    parse_repo_list,
    prepare_workspace,
    write_workspace_file,
)


def test_parse_plain_lines() -> None:
    rows = parse_repo_list(
        "# 注释\nbackend=https://git.example/be.git\nfrontend=https://git.example/fe.git @dev\n"
    )
    assert rows[0]["alias"] == "backend"
    assert rows[1]["branch"] == "dev"


def test_missing_url_does_not_write_json(tmp_ws: Path) -> None:
    with pytest.raises(WorkspaceError, match="缺 git 地址"):
        write_workspace_file(tmp_ws, repositories=[{"alias": "backend", "url": ""}])
    assert not (tmp_ws / "repos.txt").exists()
    assert not (tmp_ws / "workspace.json").exists()


def test_write_then_merge_second_repo(tmp_ws: Path) -> None:
    write_workspace_file(
        tmp_ws,
        repositories=[{"alias": "backend", "url": "https://git.example/be.git", "path": "backend"}],
    )
    write_workspace_file(
        tmp_ws,
        repositories=[{"alias": "frontend", "url": "https://git.example/fe.git"}],
    )
    text = (tmp_ws / "repos.txt").read_text(encoding="utf-8")
    assert "backend=https://git.example/be.git" in text
    assert "frontend=https://git.example/fe.git" in text
    assert not (tmp_ws / "workspace.json").exists()


def test_same_alias_overwrites_url(tmp_ws: Path) -> None:
    write_workspace_file(tmp_ws, repositories=[{"alias": "backend", "url": "https://old"}])
    write_workspace_file(tmp_ws, repositories=[{"alias": "backend", "url": "https://new", "branch": "dev"}])
    text = (tmp_ws / "repos.txt").read_text(encoding="utf-8")
    assert "backend=https://new @dev" in text
    assert "https://old" not in text


def test_discard_manifest_when_all_cloned(tmp_ws: Path) -> None:
    write_workspace_file(
        tmp_ws,
        repositories=[{"alias": "be", "url": "/origin/be", "path": "be"}],
    )
    assert (tmp_ws / "repos.txt").exists()
    (tmp_ws / "be").mkdir()
    (tmp_ws / "be" / ".git").mkdir()
    assert discard_manifest_if_complete(tmp_ws) is True
    assert not (tmp_ws / "repos.txt").exists()


def test_normalize_object_or_array() -> None:
    as_obj = normalize_repos({"repositories": {"be": {"url": "u", "path": "backend"}}})
    as_arr = normalize_repos({"repositories": [{"alias": "be", "url": "u", "path": "backend"}]})
    assert as_obj[0]["alias"] == "be"
    assert as_arr[0]["path"] == "backend"


def test_prepare_skips_existing_git(tmp_ws: Path) -> None:
    (tmp_ws / ".git").mkdir()
    result = prepare_workspace(tmp_ws, repo="https://example.invalid/repo.git")
    assert result["action"] == "skipped-existing-git"


def test_prepare_need_repo_when_empty(tmp_ws: Path) -> None:
    result = prepare_workspace(tmp_ws)
    assert result["action"] == "need-repo"
    assert inspect_workspace(tmp_ws)["empty"] is True


def test_prepare_rejects_parent_dir(tmp_ws: Path) -> None:
    with pytest.raises(WorkspaceError, match="相对目录"):
        prepare_workspace(tmp_ws, repo="https://x", dir="../escape")


def test_merge_keeps_previous_url_when_incoming_blank() -> None:
    merged = merge_repositories(
        [{"alias": "be", "url": "https://old", "path": "be", "branch": "main"}],
        [{"alias": "be", "url": "", "path": "be", "branch": ""}],
    )
    assert merged[0]["url"] == "https://old"


def test_prepare_multi_clone_uses_injected_git(tmp_ws: Path) -> None:
    calls = []

    def fake_git(args):
        target = Path(args[-1])
        target.mkdir(parents=True, exist_ok=True)
        (target / ".git").mkdir()
        (target / "README.md").write_text("ok\n", encoding="utf-8")
        calls.append(args)

        class R:
            returncode = 0
            stdout = ""
            stderr = ""

        return R()

    repos = [
        {"alias": "backend", "url": "/origin/be", "path": "backend", "branch": ""},
        {"alias": "frontend", "url": "/origin/fe", "path": "frontend", "branch": ""},
    ]
    result = prepare_workspace(tmp_ws, repos=repos, run_git=fake_git)
    assert result["action"] == "multi"
    assert [row["action"] for row in result["repos"]] == ["cloned", "cloned"]
    assert (tmp_ws / "backend" / "README.md").exists()
    assert len(calls) == 2
    assert calls[0][0] == "git"
    assert "--depth" in calls[0]


def test_manifest_and_failure_result_never_echo_https_credentials(tmp_ws: Path) -> None:
    from code_wiki.workspace import write_workspace_file

    url = "https://oauth2:EXAMPLE-NOT-SECRET@git.example.test/group/be.git"
    written = write_workspace_file(tmp_ws, repositories=[{"alias": "be", "url": url}])
    assert "EXAMPLE-NOT-SECRET" not in Path(written["dest"]).read_text(encoding="utf-8")
    assert "EXAMPLE-NOT-SECRET" not in str(written)

    def failed_git(argv):
        return type("R", (), {"returncode": 128, "stderr": f"fatal: {url}", "stdout": ""})()

    result = prepare_workspace(tmp_ws, repos=[{"alias": "be", "url": url, "path": "be"}], run_git=failed_git)
    assert "EXAMPLE-NOT-SECRET" not in str(result)
    assert "EXAMPLE-NOT-SECRET" not in Path(written["dest"]).read_text(encoding="utf-8")
    assert result["repos"][0]["strippedToken"] is True


def test_legacy_manifest_with_token_is_migrated_to_clean_list(tmp_ws: Path) -> None:
    import json
    from code_wiki.workspace import read_manifest

    url = "https://oauth2:EXAMPLE-NOT-SECRET@git.example.test/group/be.git"
    legacy = tmp_ws / "workspace.json"
    legacy.write_text(json.dumps({"repositories": [{"alias": "be", "url": url}]}), encoding="utf-8")
    rows = read_manifest(tmp_ws)
    assert rows[0]["url"] == "https://git.example.test/group/be.git"
    assert rows[0]["strippedToken"] is True
    assert not legacy.exists()
    assert "EXAMPLE-NOT-SECRET" not in (tmp_ws / "repos.txt").read_text(encoding="utf-8")


def test_git_clone_strips_embedded_token(tmp_ws: Path) -> None:
    seen = []

    def fake_git(args):
        seen.append(args)
        target = Path(args[-1])
        target.mkdir(parents=True, exist_ok=True)
        (target / ".git").mkdir()
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    from code_wiki.workspace import git_clone

    git_clone("https://oauth2:secret-token@git.example.test/group/be.git", tmp_ws / "be", run_git=fake_git)
    assert seen[0][-2] == "https://git.example.test/group/be.git"
    assert "secret-token" not in " ".join(seen[0])


def test_prepare_need_repo_when_url_missing_in_multi(tmp_ws: Path) -> None:
    result = prepare_workspace(
        tmp_ws,
        repos=[{"alias": "be", "url": "", "path": "be", "branch": ""}],
    )
    assert result["action"] == "need-repo"
    assert result["repos"][0]["action"] == "need-repo"


def test_prepare_multi_keeps_going_after_one_clone_fails(tmp_ws: Path) -> None:
    def fake_git(args):
        target = Path(args[-1])

        class R:
            returncode = 0
            stdout = ""
            stderr = ""

        if "/origin/be" in args:
            target.mkdir(parents=True, exist_ok=True)
            (target / "partial").write_text("partial\n", encoding="utf-8")
            R.returncode = 128
            R.stderr = "fatal: could not read Username"
            return R()
        target.mkdir(parents=True, exist_ok=True)
        (target / ".git").mkdir()
        return R()

    repos = [
        {"alias": "backend", "url": "/origin/be", "path": "backend", "branch": ""},
        {"alias": "frontend", "url": "/origin/fe", "path": "frontend", "branch": ""},
    ]
    result = prepare_workspace(tmp_ws, repos=repos, run_git=fake_git)
    assert result["action"] == "multi"
    assert [row["action"] for row in result["repos"]] == ["failed", "cloned"]
    assert "could not read Username" in result["repos"][0]["error"]
    assert not (tmp_ws / "backend").exists()
    assert (tmp_ws / "frontend" / ".git").is_dir()
