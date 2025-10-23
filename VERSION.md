# Version Management

## Current Version

The app uses semantic versioning (MAJOR.MINOR.PATCH).

Current version is stored in:
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

## Releasing a New Version

Use the `version.sh` script to update the version and push to GitHub:

```bash
./scripts/version.sh
```

The script will:
1. ✓ Check that all files are committed (fails if working directory is dirty)
2. ✓ Show the current version
3. ✓ Prompt for the new version number
4. ✓ Validate the version format (semantic versioning)
5. ✓ Update version in `tauri.conf.json` and `Cargo.toml`
6. ✓ Update `Cargo.lock` if it exists
7. ✓ Create a git commit with message `chore: bump version to X.Y.Z`
8. ✓ Create a git tag `vX.Y.Z`
9. ✓ Push commit and tag to GitHub

## Version Numbering Guidelines

Follow semantic versioning:

- **MAJOR** (1.0.0): Breaking changes or major feature overhauls
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, minor improvements

Examples:
- `0.1.0` → `0.1.1`: Bug fix
- `0.1.1` → `0.2.0`: New feature added
- `0.9.0` → `1.0.0`: First stable release

## Safety Features

The script will **abort** if:
- Working directory has uncommitted changes
- Version format is invalid (not X.Y.Z)
- User cancels at confirmation prompt

## Manual Version Update

If you need to update the version manually:

1. Edit `src-tauri/tauri.conf.json` - update the `version` field
2. Edit `src-tauri/Cargo.toml` - update the `version` field
3. Run `cd src-tauri && cargo update --workspace` to update Cargo.lock
4. Commit changes
5. Create and push tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
