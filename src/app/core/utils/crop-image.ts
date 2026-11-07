export function cropImageToSquare(file: File): Promise<File> {
  return createImageBitmap(file).then((image) => {
    const side = Math.min(image.width, image.height);
    const sourceX = (image.width - side) / 2;
    const sourceY = (image.height - side) / 2;
    const size = Math.min(side, 512);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) {
      image.close();
      throw new Error('Le recadrage de la photo est indisponible sur cet appareil.');
    }

    context.drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size);
    image.close();

    return new Promise<File>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Impossible de préparer cette photo.'));
          return;
        }
        resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'profil'}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        }));
      }, 'image/jpeg', 0.86);
    });
  });
}
