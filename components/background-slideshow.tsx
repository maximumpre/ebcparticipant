"use client";

const BACKGROUND_IMAGE = "/image1_name_large.png";

export function BackgroundSlideshow() {
  return (
    <div
      className="w-full h-full bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(5, 97, 113, 0.82), rgba(19, 149, 168, 0.30)), url(${BACKGROUND_IMAGE})`,
      }}
    />
  );
}
