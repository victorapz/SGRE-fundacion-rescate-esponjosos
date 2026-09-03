import { useEffect, useMemo, useState } from "react";
import PublicApiImage from "../PublicApiImage";

export default function SponsorshipAnimalGallery({
  name,
  mainImage,
  galleryImages = [],
}) {
  const images = useMemo(() => {
    const values = [mainImage, ...galleryImages].filter(Boolean);
    return [...new Set(values)];
  }, [galleryImages, mainImage]);

  const [failedImages, setFailedImages] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const availableImages = useMemo(
    () => images.filter((image) => !failedImages.includes(image)),
    [failedImages, images],
  );

  useEffect(() => {
    setSelectedIndex(0);
    setFailedImages([]);
  }, [images]);

  useEffect(() => {
    if (selectedIndex >= availableImages.length) {
      setSelectedIndex(0);
    }
  }, [availableImages.length, selectedIndex]);

  const selectedImage = availableImages[selectedIndex] || null;

  const markImageAsFailed = (image) => {
    if (!image) {
      return;
    }

    setFailedImages((current) => (current.includes(image) ? current : [...current, image]));
  };

  if (!selectedImage) {
    return (
      <div className="public-sponsorship-gallery public-sponsorship-gallery--empty">
        <div className="public-sponsorship-gallery__placeholder">
          <span>Sin imagen disponible</span>
        </div>
      </div>
    );
  }

  return (
    <div className="public-sponsorship-gallery">
      <div className="public-sponsorship-gallery__stage">
        <PublicApiImage
          src={selectedImage}
          alt={`Imagen de ${name}`}
          onError={() => markImageAsFailed(selectedImage)}
          fallback={(
            <div className="public-sponsorship-gallery__placeholder">
              <span>Cargando imagen...</span>
            </div>
          )}
        />
      </div>

      {availableImages.length > 1 ? (
        <div className="public-sponsorship-gallery__thumbs" role="tablist" aria-label="Galeria pública del animal">
          {availableImages.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              role="tab"
              aria-selected={selectedIndex === index ? "true" : "false"}
              className={`public-sponsorship-gallery__thumb ${selectedIndex === index ? "is-active" : ""}`}
              onClick={() => setSelectedIndex(index)}
            >
              <PublicApiImage
                src={image}
                alt={`Vista ${index + 1} de ${name}`}
                onError={() => markImageAsFailed(image)}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
