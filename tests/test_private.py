"""Private guard: path matching, client-name detection, delivery outside the repo."""
from __future__ import annotations

import pathlib
import sys
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import private  # noqa: E402


class PrivateTests(unittest.TestCase):
    PATS = ["projects/acme/", "public/store/", "src/scenes/Acme.tsx", "public/audio/vo/acme-*.wav"]

    def test_paths(self):
        for p in ("projects/acme/film.json", "public/store/x/img/a.png", "src/scenes/Acme.tsx", "public/audio/vo/acme-01.wav"):
            self.assertTrue(private.is_private(p, self.PATS), p)
        for p in ("projects/acme2/film.json", "src/scenes/Gfx.tsx", "public/audio/vo/b01-1.wav"):
            self.assertFalse(private.is_private(p, self.PATS), p)

    def test_client_names_in_added_lines_only(self):
        diff = "+++ b/src/film/Film.tsx\n+import {Acme} from '../scenes/Acme';\n-  old: Acme,\n context acme\n"
        with mock.patch.object(private, "private_words", return_value=["acme"]):
            hits = private.leaked_words(diff)
        self.assertEqual(len(hits), 1)
        self.assertIn("import {Acme}", hits[0])

    def test_delivery_root_is_outside_the_repo(self):
        self.assertFalse(private.inside_repo(private.private_root()))

    def test_backup_branches_never_push(self):
        zero = "0" * 40
        with mock.patch("sys.stdin") as stdin:
            stdin.read.return_value = f"refs/heads/backup/x {'1' * 40} refs/heads/backup/x {zero}\n"
            self.assertEqual(private.cmd_check_push(None), 1)


if __name__ == "__main__":
    unittest.main()
