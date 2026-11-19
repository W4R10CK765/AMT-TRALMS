const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
let jsqrPromise = null;

function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (jsqrPromise) return jsqrPromise;
  jsqrPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = JSQR_URL;
    script.async = true;
    script.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error("decoder unavailable")));
    script.onerror = () => reject(new Error("decoder failed to load"));
    document.head.appendChild(script);
  });
  return jsqrPromise;
}

/**
 * Returns a decoder with an async detect(videoElement) -> string ("" when nothing found).
 * Uses the native BarcodeDetector when the browser has it, otherwise falls back to
 * a canvas + jsQR decode so camera scanning works on Safari, Firefox and older Chrome.
 */
export async function createQrDecoder() {
  if ("BarcodeDetector" in window) {
    try {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      return {
        detect: async (video) => {
          const codes = await detector.detect(video);
          return codes && codes.length ? codes[0].rawValue : "";
        },
      };
    } catch {
      /* fall through to the scripted decoder */
    }
  }

  const jsQR = await loadJsQR();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  return {
    detect: async (video) => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return "";
      const scale = Math.min(1, 720 / Math.max(width, height));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
      return result ? result.data : "";
    },
  };
}
