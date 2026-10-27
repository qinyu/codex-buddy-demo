from pathlib import Path

from code_wiki.init import init_workspace


def test_init_workspace_clones_then_graphs(tmp_path: Path) -> None:
    calls = []

    def fake_git(args):
        target = Path(args[-1])
        target.mkdir(parents=True, exist_ok=True)
        (target / ".git").mkdir()
        (target / "README.md").write_text("ok\n", encoding="utf-8")
        calls.append(args)
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    def fake_run(argv):
        calls.append(argv)
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    repos_file = tmp_path / "repos.txt"
    repos_file.write_text("backend=/origin/be\n", encoding="utf-8")
    workspace = tmp_path / "ws"
    result = init_workspace(
        workspace,
        repos_file=repos_file,
        which_fn=lambda cmd, path=None: f"/bin/{cmd}",
        run_git=fake_git,
        run_cmd=fake_run,
    )
    assert result["prepared"]["action"] == "multi"
    assert result["graphs"]["repos"][0]["alias"] == "backend"
    assert any(argv[:2] == ["codegraph", "init"] for argv in calls if argv and argv[0] != "git")
    assert (workspace / "AGENTS.md").exists()
