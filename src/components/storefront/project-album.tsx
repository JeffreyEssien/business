'use client';
import { useEffect, useRef, useState } from 'react';
import { cloudinaryImage, cloudinarySrcSet } from '@/lib/cloudinary/delivery';
import styles from './portfolio-sections.module.css';

type Photo = { url: string; alt: string | null };

const SHOWN = 4;

/**
 * A project's extra photos: a row of thumbnails, each opening a full-screen viewer that
 * steps through the cover and every album photo. Uses the native <dialog>, so focus is
 * trapped and Escape closes it without extra code; arrow keys move between photos.
 */
export function ProjectAlbum({
  title,
  cover,
  photos,
}: {
  title: string;
  cover: Photo | null;
  photos: Photo[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const all = cover ? [cover, ...photos] : photos;
  const offset = cover ? 1 : 0;
  const current = all[index];
  const hidden = photos.length - SHOWN;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((value) => (value + 1) % all.length);
      if (event.key === 'ArrowLeft') setIndex((value) => (value - 1 + all.length) % all.length);
    };
    element.addEventListener('keydown', onKey);
    return () => element.removeEventListener('keydown', onKey);
  }, [all.length]);

  function open(at: number) {
    setIndex(at);
    dialog.current?.showModal();
  }

  return (
    <>
      <ul className={styles.albumStrip} aria-label={`More photos of ${title}`}>
        {photos.slice(0, SHOWN).map((photo, position) => (
          <li key={photo.url + position}>
            <button
              type="button"
              onClick={() => open(position + offset)}
              aria-label={`Open photo ${position + offset + 1} of ${all.length}${photo.alt ? `: ${photo.alt}` : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tenant or sample image. */}
              <img
                src={cloudinaryImage(photo.url, { width: 240, aspect: 1 })}
                alt=""
                loading="lazy"
                decoding="async"
              />
              {position === SHOWN - 1 && hidden > 0 && (
                <span className={styles.albumMore} aria-hidden="true">
                  +{hidden}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        className={styles.albumViewer}
        aria-label={`${title}: photo ${index + 1} of ${all.length}`}
        onClick={(event) => {
          // A click on the dark backdrop (the dialog itself) closes the viewer.
          if (event.target === dialog.current) dialog.current.close();
        }}
      >
        {current && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- tenant or sample image. */}
            <img
              src={cloudinaryImage(current.url, { width: 1600 })}
              srcSet={cloudinarySrcSet(current.url, [800, 1200, 1600, 2000])}
              sizes="92vw"
              alt={current.alt ?? ''}
            />
            <figcaption>
              <span>{current.alt}</span>
              <span>
                {index + 1} / {all.length}
              </span>
            </figcaption>
          </figure>
        )}
        <div className={styles.albumViewerControls}>
          <button
            type="button"
            onClick={() => setIndex((index - 1 + all.length) % all.length)}
            aria-label="Previous photo"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setIndex((index + 1) % all.length)}
            aria-label="Next photo"
          >
            →
          </button>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close">
            ✕
          </button>
        </div>
      </dialog>
    </>
  );
}
