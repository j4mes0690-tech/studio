'use client';

import { ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';

/**
 * uploadFile - Uploads a File or Blob to Firebase Storage and returns the download URL.
 */
export async function uploadFile(storage: FirebaseStorage, path: string, file: File | Blob): Promise<string> {
  const storageRef = ref(storage, path);
  try {
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error: any) {
    if (error.code === 'storage/unauthorized') {
      throw new Error('Storage Permission Denied: Please update your Firebase Storage Rules.');
    }
    throw error;
  }
}

/**
 * dataUriToBlob - Converts a Base64/Data URI to a Blob for storage uploading.
 */
export async function dataUriToBlob(dataUri: string): Promise<Blob> {
  const split = dataUri.split(',');
  const byteString = atob(split[1]);
  const mimeString = split[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * optimiseImage - Resizes a Data URI image to a manageable size for site documentation.
 * This ensures PDF generation is fast and reliable.
 */
export async function optimizeImage(dataUri: string, maxWidth = 1200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUri);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      // Draw timestamp onto optimised image
      const now = new Date();
      const ts = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillText(ts, width - ctx.measureText(ts).width - 15, height - 15);

      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}
