# bin/

`minio.exe` (gitignored — not committed, ~110MB) runs MinIO locally without Docker.

To (re)download it:

```
curl -fsSL -o bin/minio.exe https://dl.min.io/server/minio/release/windows-amd64/minio.exe
```

Then start it from the project root:

```
./bin/minio.exe server minio-data --console-address ":9001"
```

- S3 API: http://localhost:9000 (credentials from `.env`'s `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`)
- Web console: http://localhost:9001
- `minio-data/` (gitignored) is where it stores uploaded file bytes on disk.

The app auto-creates its bucket (`MINIO_BUCKET` in `.env`) on first connect — no manual bucket setup needed.
