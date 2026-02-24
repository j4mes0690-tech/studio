
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
      throw new Error('Storage Permission Denied: Please update your Firebase Storage Rules to "allow read, write: if true;" in the console.');
    }
    throw error;
  }
}

/**
 * dataUriToBlob - Converts a Base64/Data URI to a Blob for storage uploading.
 * Uses a more robust method than fetch() for wide browser compatibility.
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
