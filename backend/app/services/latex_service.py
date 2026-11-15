import logging
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from threading import BoundedSemaphore


logger = logging.getLogger(__name__)
MAX_SOURCE_BYTES = 200_000
MAX_PDF_BYTES = 25 * 1024 * 1024
COMPILE_TIMEOUT_SECONDS = 20
MAX_CONCURRENT_COMPILES = 2
_compile_slots = BoundedSemaphore(MAX_CONCURRENT_COMPILES)


class LatexCompileError(Exception):
    pass


class LatexEngineUnavailable(Exception):
    pass


class LatexCompileCapacityError(Exception):
    pass


def compile_latex(source: str) -> bytes:
    source_bytes = source.encode("utf-8")
    if len(source_bytes) > MAX_SOURCE_BYTES:
        raise LatexCompileError("LaTeX source exceeds the 200 KB limit.")

    executable = shutil.which("pdflatex")
    if not executable:
        raise LatexEngineUnavailable(
            "LaTeX compilation is unavailable: the server has no pdflatex engine installed."
        )
    if not _compile_slots.acquire(blocking=False):
        raise LatexCompileCapacityError(
            "The LaTeX compiler is busy. Please try again shortly."
        )

    try:
        with tempfile.TemporaryDirectory(prefix="clio-latex-") as directory:
            work_dir = Path(directory).resolve()
            source_path = work_dir / "manuscript.tex"
            pdf_path = work_dir / "manuscript.pdf"
            source_path.write_bytes(source_bytes)
            for directory_name in ("texmf", "texmf-config", "texmf-var"):
                (work_dir / directory_name).mkdir()

            environment = {
                "HOME": str(work_dir),
                "PATH": os.pathsep.join(
                    dict.fromkeys(
                        [str(Path(executable).parent), "/usr/bin", "/bin"]
                    )
                ),
                "TEXMFHOME": str(work_dir / "texmf"),
                "TEXMFCONFIG": str(work_dir / "texmf-config"),
                "TEXMFVAR": str(work_dir / "texmf-var"),
                "TEXMFOUTPUT": str(work_dir),
                "openin_any": "p",
                "openout_any": "p",
                "shell_escape": "f",
            }
            command = [
                executable,
                "-no-shell-escape",
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-file-line-error",
                f"-output-directory={work_dir}",
                source_path.name,
            ]

            try:
                result = subprocess.run(
                    command,
                    cwd=work_dir,
                    env=environment,
                    capture_output=True,
                    check=False,
                    timeout=COMPILE_TIMEOUT_SECONDS,
                )
            except subprocess.TimeoutExpired as exc:
                raise LatexCompileError(
                    f"LaTeX compilation exceeded the {COMPILE_TIMEOUT_SECONDS}-second time limit."
                ) from exc
            except OSError as exc:
                logger.exception("Unable to start the LaTeX compiler")
                raise LatexEngineUnavailable(
                    "The LaTeX compiler could not be started on the server."
                ) from exc

            if result.returncode != 0 or not pdf_path.is_file():
                diagnostics = (result.stdout + b"\n" + result.stderr).decode(
                    "utf-8", errors="replace"
                )
                diagnostics = diagnostics.replace(str(work_dir), "<temporary directory>")
                diagnostics = diagnostics[-4_000:].strip()
                diagnostics = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", diagnostics)
                logger.warning("LaTeX compilation failed: %s", diagnostics[-1_000:])
                detail = diagnostics or "The LaTeX source could not be compiled."
                raise LatexCompileError(detail)

            if pdf_path.stat().st_size > MAX_PDF_BYTES:
                raise LatexCompileError("The generated PDF exceeds the 25 MB limit.")

            pdf_bytes = pdf_path.read_bytes()
            if not pdf_bytes.startswith(b"%PDF-"):
                raise LatexCompileError("The compiler produced an invalid PDF.")
            return pdf_bytes
    finally:
        _compile_slots.release()
