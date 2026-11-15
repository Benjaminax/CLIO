from pathlib import Path
import asyncio

import httpx
import pytest

from app.api.v1.endpoints import latex as latex_endpoint
from app.dependencies import get_current_user
from app.main import app
from app.services import latex_service


def test_latex_compiler_runs_without_shell_escape(monkeypatch):
    monkeypatch.setattr(latex_service.shutil, "which", lambda _name: "/usr/bin/pdflatex")

    def successful_run(command, **kwargs):
        assert "-no-shell-escape" in command
        assert kwargs["timeout"] == latex_service.COMPILE_TIMEOUT_SECONDS
        assert kwargs["env"]["openin_any"] == "p"
        assert kwargs["env"]["openout_any"] == "p"
        output_argument = next(arg for arg in command if arg.startswith("-output-directory="))
        output_dir = output_argument.split("=", 1)[1]
        Path(output_dir, "manuscript.pdf").write_bytes(b"%PDF-1.7\ncompiled")
        return type("ProcessResult", (), {"returncode": 0, "stdout": b"", "stderr": b""})()

    monkeypatch.setattr(latex_service.subprocess, "run", successful_run)
    assert latex_service.compile_latex("\\documentclass{article}") == b"%PDF-1.7\ncompiled"


def test_latex_compiler_reports_missing_engine(monkeypatch):
    monkeypatch.setattr(latex_service.shutil, "which", lambda _name: None)
    with pytest.raises(latex_service.LatexEngineUnavailable):
        latex_service.compile_latex("\\documentclass{article}")


def test_latex_compiler_rejects_oversized_source():
    source = "x" * (latex_service.MAX_SOURCE_BYTES + 1)
    with pytest.raises(latex_service.LatexCompileError, match="200 KB"):
        latex_service.compile_latex(source)


def test_compile_api_requires_authentication():
    async def request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                "/api/v1/latex/compile",
                json={"source": "\\documentclass{article}"},
            )

    response = asyncio.run(request())
    assert response.status_code == 403


def test_compile_api_returns_pdf(monkeypatch):
    async def fake_user():
        return None

    monkeypatch.setattr(
        latex_endpoint,
        "compile_latex",
        lambda _source: b"%PDF-1.7\ncompiled",
    )
    app.dependency_overrides[get_current_user] = fake_user

    async def request():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                "/api/v1/latex/compile",
                json={"source": "\\documentclass{article}"},
            )

    try:
        response = asyncio.run(request())
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    assert response.content.startswith(b"%PDF-")
