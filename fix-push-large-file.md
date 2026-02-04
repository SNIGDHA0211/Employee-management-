# Push large .exe files to GitHub using Git LFS

Your repo already has `*.exe` tracked by Git LFS in `.gitattributes`. GitHub rejected the push because `public/monitor.exe` was stored as a normal file (145 MB > 100 MB limit). Use LFS so the exes are pushed as LFS objects.

Run these in **Git Bash** from the repo root:
`c:\Users\Kunal.Desale\Desktop\Emp Management\Employee-management-`

## 1. Use Git LFS in this repo

```bash
git lfs install
```

## 2. Rewrite history so all .exe are LFS (fixes existing commits)

This makes every commit that contains a `.exe` use an LFS pointer instead of the full file, so GitHub accepts the push:

```bash
git lfs migrate import --include="*.exe" --everything
```

If you get “migrate: command not found” or similar, use a newer Git (e.g. 2.22+) or run:

```bash
git lfs migrate import --include-ref=refs/heads/main --include="*.exe"
```

## 3. Push to GitHub (force needed after history rewrite)

```bash
git push --force-with-lease origin main
```

---

**If the exe files were removed from the repo earlier:**  
Ensure they exist again in `public/` (e.g. `public/monitor.exe`, `public/admin.exe`), then:

```bash
git add public/*.exe
git commit -m "Add exe downloads (via LFS)"
git push origin main
```

No need to run `git lfs migrate` for this new commit, since `.gitattributes` already tracks `*.exe` with LFS.
