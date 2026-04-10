import api from '../config/api';

/**
 * Comprime una imagen usando Canvas.
 */
export const compressImage = (file, maxWidth = 1280, quality = 0.7) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size < 300 * 1024) return resolve(file);
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
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
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
    };
  });
};

/**
 * Sube un archivo a nuestra API independiente (Node.js).
 */
export const uploadFileWithProgress = async (file, folder = 'attachments', onProgress = null) => {
  if (!file) return null;

  let fileToUpload = file;
  if (file.type.startsWith('image/') && file.type !== 'image/gif') {
    fileToUpload = await compressImage(file);
  }

  const formData = new FormData();
  formData.append('file', fileToUpload);
  formData.append('folder', folder);

  try {
    const { data } = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percent = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(percent);
        }
      }
    });

    return {
      name: fileToUpload.name,
      type: fileToUpload.type,
      size: fileToUpload.size,
      data: data.url, // URL local del servidor
      originalSize: file.size,
       filename: data.filename
    };
  } catch (err) {
    console.error("Error en subida API local:", err);
    throw err;
  }
};
