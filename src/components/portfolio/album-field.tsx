'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { cloudinaryImage } from '@/lib/cloudinary/delivery';
import type { AlbumPhoto } from '@/modules/portfolio/types';
import { ExampleBadge } from './example-badge';
import styles from './builder.module.css';

/** Mirrors ALBUM_LIMIT / ALBUM_ADD_LIMIT in modules/portfolio/photos.ts. */
const ALBUM_LIMIT = 24;
const ADD_LIMIT = 8;
const LONGEST_SIDE = 2000;
const accepted = ['image/jpeg', 'image/png', 'image/webp'];

type NewPhoto = { key: string; file: File; preview: string; alt: string };
type Existing = AlbumPhoto & { remove: boolean };

/** "lagos_market-02.jpg" → "Lagos market 02": a starting point for the description. */
function suggestedDescription(fileName: string) {
  const words = fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words || /^(img|dsc|photo|image)?\s?\d+$/i.test(words)) return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Phone photos are often 5–12 MB. Shrinking to 2000px before upload keeps several photos
 * within one save and makes uploads fast on mobile data. Falls back to the original file
 * when the browser cannot decode it.
 */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg', {
      type: 'image/jpeg',
    });
  } catch {
    return file;
  }
}

/**
 * A project's photo album: reorder, describe, and remove existing photos, and add several
 * new ones at once. Writes `album` (existing photos, in order), `albumFiles`,
 * `albumNewAlts`, and `albumChanged` for readAlbum on the server.
 */
export function AlbumField({ photos }: { photos: AlbumPhoto[] }) {
  const id = useId();
  const [existing, setExisting] = useState<Existing[]>(
    photos.map((photo) => ({ ...photo, remove: false })),
  );
  const [added, setAdded] = useState<NewPhoto[]>([]);
  const [changed, setChanged] = useState(false);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const filesInput = useRef<HTMLInputElement>(null);

  // Keep the named file input in step with the shrunk photos, so the form posts them.
  useEffect(() => {
    if (!filesInput.current) return;
    const transfer = new DataTransfer();
    for (const photo of added) transfer.items.add(photo.file);
    filesInput.current.files = transfer.files;
  }, [added]);

  useEffect(
    () => () => {
      for (const photo of added) URL.revokeObjectURL(photo.preview);
    },
    // Revoke on unmount only; individual removals revoke their own preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const kept = existing.filter((photo) => !photo.remove).length;
  const room = Math.min(ALBUM_LIMIT - kept - added.length, ADD_LIMIT - added.length);

  function update(next: Existing[]) {
    setExisting(next);
    setChanged(true);
  }

  function move(index: number, step: -1 | 1) {
    const target = index + step;
    if (target < 0 || target >= existing.length) return;
    const next = [...existing];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  async function choose(list: FileList | null) {
    setProblem('');
    const files = [...(list ?? [])];
    if (!files.length) return;
    if (files.some((file) => !accepted.includes(file.type))) {
      setProblem('Choose JPG, PNG, or WebP photos.');
      return;
    }
    if (files.length > room) {
      setProblem(
        room > 0
          ? `You can add ${room} more ${room === 1 ? 'photo' : 'photos'} now. Save, then add more.`
          : 'This album is full for now. Save, or remove a photo, before adding more.',
      );
      return;
    }
    setBusy(true);
    const shrunk = await Promise.all(files.map(shrink));
    setBusy(false);
    if (shrunk.some((file) => file.size > 5 * 1024 * 1024)) {
      setProblem('One of those photos is still larger than 5 MB. Choose a smaller one.');
      return;
    }
    setAdded((current) => [
      ...current,
      ...shrunk.map((file, index) => ({
        key: `${Date.now()}-${index}-${file.name}`,
        file,
        preview: URL.createObjectURL(file),
        alt: suggestedDescription(files[index].name),
      })),
    ]);
  }

  return (
    <fieldset className={styles.album} aria-describedby={`${id}-hint`}>
      <legend className={styles.photoLabel}>Album (optional)</legend>
      <p className={styles.photoHint} id={`${id}-hint`}>
        More photos of this project, shown in this order. Up to {ALBUM_LIMIT} photos. Large photos
        are made smaller on your device before they upload.
      </p>

      <input
        type="hidden"
        name="album"
        value={JSON.stringify(
          existing.map((photo) => ({ id: photo.id, alt: photo.alt, remove: photo.remove })),
        )}
      />
      <input
        type="hidden"
        name="albumNewAlts"
        value={JSON.stringify(added.map((photo) => photo.alt))}
      />
      <input type="hidden" name="albumChanged" value={changed ? '1' : '0'} />
      <input ref={filesInput} type="file" name="albumFiles" multiple hidden tabIndex={-1} />

      {(existing.length > 0 || added.length > 0) && (
        <ol className={styles.albumGrid}>
          {existing.map((photo, index) => (
            <li key={photo.id} className={styles.albumItem} data-removed={photo.remove}>
              {/* eslint-disable-next-line @next/next/no-img-element -- tenant or sample image. */}
              <img src={cloudinaryImage(photo.url, { width: 360, aspect: 1 })} alt="" />
              {photo.isSample && <ExampleBadge />}
              <label className={styles.albumAlt}>
                <span>Description</span>
                <input
                  value={photo.alt}
                  maxLength={300}
                  disabled={photo.remove}
                  onChange={(event) =>
                    update(
                      existing.map((item) =>
                        item.id === photo.id ? { ...item, alt: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <div className={styles.albumActions}>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move photo ${index + 1} earlier`}
                >
                  ←
                </button>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => move(index, 1)}
                  disabled={index === existing.length - 1}
                  aria-label={`Move photo ${index + 1} later`}
                >
                  →
                </button>
                <button
                  type="button"
                  className={styles.smallButton}
                  aria-pressed={photo.remove}
                  onClick={() =>
                    update(
                      existing.map((item) =>
                        item.id === photo.id ? { ...item, remove: !item.remove } : item,
                      ),
                    )
                  }
                >
                  {photo.remove ? 'Keep' : 'Remove'}
                </button>
              </div>
            </li>
          ))}
          {added.map((photo) => (
            <li key={photo.key} className={styles.albumItem} data-new="true">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview. */}
              <img src={photo.preview} alt="" />
              <label className={styles.albumAlt}>
                <span>Description</span>
                <input
                  value={photo.alt}
                  maxLength={300}
                  placeholder="What is in this photo?"
                  onChange={(event) =>
                    setAdded((current) =>
                      current.map((item) =>
                        item.key === photo.key ? { ...item, alt: event.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
              <div className={styles.albumActions}>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => {
                    URL.revokeObjectURL(photo.preview);
                    setAdded((current) => current.filter((item) => item.key !== photo.key));
                  }}
                >
                  Don’t add
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <label className={styles.smallButton} htmlFor={`${id}-pick`} aria-disabled={room <= 0}>
        {busy ? 'Preparing photos…' : '+ Add photos'}
      </label>
      <input
        id={`${id}-pick`}
        className={styles.fileInput}
        type="file"
        multiple
        accept={accepted.join(',')}
        disabled={room <= 0 || busy}
        onChange={(event) => {
          void choose(event.target.files);
          event.target.value = '';
        }}
      />
      {problem && (
        <p className={styles.photoProblem} role="alert">
          {problem}
        </p>
      )}
      {/* Words save automatically; photos upload only with the Save button. */}
      <p className={styles.photoHint} role="status">
        {changed || added.length > 0 ? 'Press “Save and go back” to keep these album changes.' : ''}
      </p>
    </fieldset>
  );
}
