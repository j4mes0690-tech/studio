
'use client';

import { ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';

/**
 * uploadFile - Uploads a File or Blob to Firebase Storage and returns the download URL.
 */
export async function uploadFile(storage: FirebaseStorage, path: string, file: File | Blob): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * dataUriToBlob - Converts a Base64/Data URI to a Blob for storage uploading.
 */
export async function dataUriToBlob(dataUri: string): Promise<Blob> {
  const res = await fetch(dataUri);
  return res.blob();
}
