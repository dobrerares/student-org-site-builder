# @sosb/assets

Image processing pipeline with environment-specific implementations behind a unified interface.

This package owns upload-time asset preparation:

- image uploads are normalized into content-addressed `AssetRef` records;
- document uploads are stored as content-addressed downloadable files;
- metadata sidecars are written beside each asset so editor previews, exported zips,
  and rendered document links do not have to inspect raw bytes.

See `docs/PRD.md` for the canonical scope of this module.
