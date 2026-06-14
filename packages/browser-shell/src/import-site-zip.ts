import { importFromZip } from "@sosb/zip";

export async function importSiteZip() {
  const blob = await pickZipBlob();
  if (blob === null) return null;
  return importSiteZipBlob(blob);
}

export async function importSiteZipBlob(blob: Blob) {
  const imported = await importFromZip(blob);
  return { site: imported.siteData, assetVfs: imported.vfs };
}

function pickZipBlob(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.style.display = "none";

    const cleanup = (): void => {
      input.remove();
    };

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0];
        cleanup();
        resolve(file ?? null);
      },
      { once: true },
    );
    input.addEventListener(
      "cancel",
      () => {
        cleanup();
        resolve(null);
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  });
}
