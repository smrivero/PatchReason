# Start here (macOS)

1. Unpack this archive into your preferred project directory and rename its folder to `PatchReason`.
2. Run `python3 scripts/validate_dataset.py datasets/reference_examples.jsonl`.
3. Run `git init -b main`, `git add .`, `git commit -m "Initialize PatchReason project documentation"`.
4. Create a new, empty GitHub repository named `PatchReason` under `smrivero` (no README/license initialized on GitHub).
5. If your `github-smrivero` SSH alias is configured, connect using:

```bash
git remote add origin git@github-smrivero:smrivero/PatchReason.git
git push -u origin main
```

Until the repo exists on GitHub, `git remote add` does not create it. If the repository is already configured, inspect `git remote -v` rather than adding it twice.
