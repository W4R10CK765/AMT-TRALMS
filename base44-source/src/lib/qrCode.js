const QR_BASE = "https://api.qrserver.com/v1/create-qr-code/";

export const qrImageUrl = (value, size = 240) =>
  `${QR_BASE}?size=${size}x${size}&margin=10&data=${encodeURIComponent(value || "")}`;

export async function downloadQr(value, filename) {
  const res = await fetch(qrImageUrl(value, 600));
  if (!res.ok) throw new Error("Could not fetch the QR image.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
