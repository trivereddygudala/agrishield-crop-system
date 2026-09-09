/**
 * Client-Side Image Compression & Optimization Utility
 * Automatically downsamples heavy camera photos (8MB–15MB) into lightweight,
 * high-resolution web-optimized images (~200KB–350KB) in milliseconds before uploading.
 * Preserves botanical and pathology micro-features for deep learning inference.
 */

export const compressImageForUpload = (file, options = {}) => {
  const {
    maxDimension = 1280,
    quality = 0.82,
    maxSizeKB = 350,
    outputType = 'image/jpeg'
  } = options;

  return new Promise((resolve) => {
    // If not a compressable image or already under 180KB, return as-is
    if (!file || !['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      resolve({ file, originalSize: file?.size || 0, compressedSize: file?.size || 0, savingsPercent: 0, wasCompressed: false });
      return;
    }

    if (file.size <= 180 * 1024) {
      resolve({ file, originalSize: file.size, compressedSize: file.size, savingsPercent: 0, wasCompressed: false });
      return;
    }

    const originalSize = file.size;
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate proportional downsampled dimensions preserving aspect ratio
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          resolve({ file, originalSize, compressedSize: originalSize, savingsPercent: 0, wasCompressed: false });
          return;
        }

        // Use high quality image smoothing for pathology feature preservation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to compressed Blob
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve({ file, originalSize, compressedSize: originalSize, savingsPercent: 0, wasCompressed: false });
            return;
          }

          const compressedSize = blob.size;
          const savingsPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

          const cleanBaseName = file.name ? file.name.replace(/\.[^/.]+$/, "") : `scan_${Date.now()}`;
          const compressedFile = new File([blob], `${cleanBaseName}.jpg`, {
            type: outputType,
            lastModified: Date.now()
          });

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize,
            savingsPercent,
            wasCompressed: true,
            dimensions: { width, height }
          });
        }, outputType, quality);
      };

      img.onerror = () => {
        resolve({ file, originalSize, compressedSize: originalSize, savingsPercent: 0, wasCompressed: false });
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      resolve({ file, originalSize, compressedSize: originalSize, savingsPercent: 0, wasCompressed: false });
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Format bytes into human-friendly string (e.g. "11.4 MB", "230 KB")
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
