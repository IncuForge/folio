# Folio signed desktop releases

Folio checks the latest public GitHub Release at `IncuForge/folio` and installs only packages signed by the updater key embedded in the application.

## One-time GitHub setup

Two local files were generated under the gitignored `.secrets/` directory:

- `folio-updater.key` — the private signing key
- `folio-updater-password.txt` — its randomly generated password

In GitHub, open **Settings → Secrets and variables → Actions** and create:

1. `TAURI_SIGNING_PRIVATE_KEY` with the complete contents of `.secrets/folio-updater.key`.
2. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` with the complete contents of `.secrets/folio-updater-password.txt`.

Keep an encrypted offline backup of both files. They must never be committed. Losing them means existing installations cannot trust packages signed by a replacement key.

## Publishing an update

1. Update the version in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Commit and push the version change to `main`.
3. Create and push a matching tag, for example:

   ```powershell
   git tag v0.1.1
   git push origin v0.1.1
   ```

The **Folio Desktop Release** workflow builds all four targets, signs updater packages, creates the GitHub Release, and uploads `latest.json`. The version in the tag and application configuration must match.

Ordinary pushes continue to produce unsigned workflow artifacts for testing; they are not offered through the in-app updater.
