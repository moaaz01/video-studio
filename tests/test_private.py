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

    # --- commit messages: a client name in a message reached GitHub because only
    # file diffs were checked (the word was already on the list).

    def test_client_name_in_a_commit_message(self):
        msg = "fix(engine): acme 9:16 frame 0 was washed out\n\n# acme in a git comment line is ignored\n"
        with mock.patch.object(private, "private_words", return_value=["acme"]):
            hits = private.leaked_message(msg)
            clean = private.leaked_message("fix(engine): frame 0 was washed out\n# acme\n")
        self.assertEqual(len(hits), 1)
        self.assertIn("frame 0", hits[0])
        self.assertEqual(clean, [])

    def test_commit_msg_hook_refuses_a_client_name(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            bad, good = pathlib.Path(tmp, "bad"), pathlib.Path(tmp, "good")
            bad.write_text("feat: new Acme store film\n", encoding="utf-8")
            good.write_text("feat: new store film\n", encoding="utf-8")
            with mock.patch.object(private, "private_words", return_value=["acme"]):
                self.assertEqual(private.cmd_check_msg(mock.Mock(file=str(bad))), 1)
                self.assertEqual(private.cmd_check_msg(mock.Mock(file=str(good))), 0)

    def test_push_reads_the_messages_of_pushed_commits(self):
        def fake_git(*args):
            if args[0] == "log":
                return "fix: acme frame 0\n"
            return ""
        with mock.patch.object(private, "private_words", return_value=["acme"]), \
                mock.patch.object(private, "git", side_effect=fake_git), mock.patch("sys.stdin") as stdin:
            stdin.read.return_value = f"refs/heads/fix {'1' * 40} refs/heads/fix {'2' * 40}\n"
            self.assertEqual(private.cmd_check_push(None), 1)

    def test_push_with_clean_messages_passes(self):
        with mock.patch.object(private, "private_words", return_value=["acme"]), \
                mock.patch.object(private, "git", return_value="fix: frame 0\n"), mock.patch("sys.stdin") as stdin:
            stdin.read.return_value = f"refs/heads/fix {'1' * 40} refs/heads/fix {'2' * 40}\n"
            self.assertEqual(private.cmd_check_push(None), 0)

    def test_guard_installs_a_commit_msg_hook(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(private, "common_dir", return_value=pathlib.Path(tmp)):
            private.cmd_guard(None)
            hook = pathlib.Path(tmp, "hooks", "commit-msg")
            self.assertTrue(hook.exists())
            self.assertIn('check-msg "$1"', hook.read_text(encoding="utf-8"))

    def test_backup_branches_never_push(self):
        zero = "0" * 40
        with mock.patch("sys.stdin") as stdin:
            stdin.read.return_value = f"refs/heads/backup/x {'1' * 40} refs/heads/backup/x {zero}\n"
            self.assertEqual(private.cmd_check_push(None), 1)


if __name__ == "__main__":
    unittest.main()
