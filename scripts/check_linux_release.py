"""Check static linking, SQLite initialization, and embedded Web assets in scratch."""

import http.client
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid


def run(*args):
    return subprocess.check_output(args, text=True, timeout=120).strip()


def main(binary):
    headers = run("readelf", "--program-headers", str(binary))
    dynamic = run("readelf", "--dynamic", str(binary))
    if "INTERP" in headers or "(NEEDED)" in dynamic:
        raise SystemExit("Linux release must not require a loader or shared libraries")

    image = f"rauto-static-check:{uuid.uuid4().hex}"
    container = None
    with tempfile.TemporaryDirectory(prefix="rauto-static-check-") as directory:
        root = Path(directory)
        shutil.copy2(binary, root / "rauto")
        (root / "Dockerfile").write_text(
            'FROM scratch\nCOPY rauto /rauto\nENV RAUTO_HOME=/data\nENTRYPOINT ["/rauto"]\n'
        )
        try:
            run("docker", "build", "--quiet", "--tag", image, str(root))
            print(run("docker", "run", "--rm", "--network=none", image, "--version"))
            print(run("docker", "run", "--rm", "--network=none", image, "templates", "list"))
            container = run(
                "docker", "run", "--detach", "--publish", "127.0.0.1::3000", image,
                "web", "--bind", "0.0.0.0", "--port", "3000",
            )
            port = int(run("docker", "port", container, "3000/tcp").rsplit(":", 1)[1])
            for attempt in range(100):
                try:
                    html = fetch(port, "/")
                    break
                except (OSError, http.client.HTTPException):
                    if attempt == 99:
                        raise
                    time.sleep(0.1)
            asset = re.search(rb'src="([^"]+\.js)"', html)
            if asset is None or len(fetch(port, asset[1].decode())) < 100:
                raise RuntimeError("Embedded frontend JavaScript is missing")
            print("Static binary, SQLite, and embedded Web assets verified in scratch")
        finally:
            if container:
                subprocess.run(["docker", "rm", "--force", container], check=False)
            subprocess.run(["docker", "image", "rm", "--force", image], check=False)


def fetch(port, path):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
    try:
        connection.request("GET", path)
        response = connection.getresponse()
        if response.status != 200:
            raise RuntimeError(f"{path} returned HTTP {response.status}")
        return response.read()
    finally:
        connection.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python3 scripts/check_linux_release.py PATH_TO_BINARY")
    main(Path(sys.argv[1]).resolve())
