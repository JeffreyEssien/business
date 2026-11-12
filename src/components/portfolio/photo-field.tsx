'use client';
import { useEffect, useId, useState } from 'react';
import { cloudinaryImage } from '@/lib/cloudinary/delivery';
import type { PortfolioPhoto } from '@/modules/portfolio/types';
import { ExampleBadge } from './example-badge';
import styles from './builder.module.css';

/** "my-studio_portrait.jpg" → "My studio portrait": a starting point, not a requirement. */
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
 * Pick a photo from the phone or computer, see it straight away, and describe it in plain
 * words. Resizing and format conversion happen automatically after upload (Cloudinary).
 * Inputs are named `${prefix}File`, `${prefix}Alt`, `${prefix}Remove`, `${prefix}OriginalAlt`.
 */
export function PhotoField({
  prefix,
  label,
  hint,
  photo,
}: {
  prefix: string;
  label: string;
  hint: string;
  photo: PortfolioPhoto | null;
}) {
  const id = useId();
  const [preview, setPreview] = useState<string | null>(null);
  const [alt, setAlt] = useState(photo?.alt ?? '');
  const [remove, setRemove] = useState(false);
  const [problem, setProblem] = useState('');

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = remove
    ? null
    : (preview ?? (photo ? cloudinaryImage(photo.url, { width: 480 }) : null));

  return (
    <div className={styles.photoField}>
      <p className={styles.photoLabel} id={`${id}-label`}>
        {label}
        {photo?.isSample && !preview && !remove && <ExampleBadge />}
      </p>
      {photo?.isSample && !preview && !remove && (
        <p className={`${styles.notice} ${styles.noticeExample}`}>
          This is a sample photo from your template. Choose your own photo, or remove it, before
          your portfolio goes live.
        </p>
      )}
      <div className={styles.photoRow}>
        <div className={styles.photoFrame} aria-hidden="true">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview or Cloudinary URL.
            <img src={shown} alt="" />
          ) : (
            <span>No photo</span>
          )}
        </div>
        <div className={styles.photoControls}>
          <label className={styles.smallButton} htmlFor={`${id}-file`}>
            {photo || preview ? 'Choose a different photo' : 'Choose a photo'}
          </label>
          <input
            id={`${id}-file`}
            className={styles.fileInput}
            type="file"
            name={`${prefix}File`}
            accept="image/jpeg,image/png,image/webp"
            aria-describedby={`${id}-hint`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setProblem('');
              if (!file) return;
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                setProblem('Choose a JPG, PNG, or WebP photo.');
                event.target.value = '';
                return;
              }
              if (file.size > 5 * 1024 * 1024) {
                setProblem('That photo is larger than 5 MB. Choose a smaller one.');
                event.target.value = '';
                return;
              }
              setRemove(false);
              setPreview(URL.createObjectURL(file));
              if (!alt) setAlt(suggestedDescription(file.name));
            }}
          />
          <p className={styles.photoHint} id={`${id}-hint`}>
            {hint} JPG, PNG, or WebP, up to 5 MB. We resize it for you.
          </p>
          {photo && (
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                name={`${prefix}Remove`}
                checked={remove}
                onChange={(event) => setRemove(event.target.checked)}
              />
              Remove this photo
            </label>
          )}
          {problem && (
            <p className={styles.photoProblem} role="alert">
              {problem}
            </p>
          )}
        </div>
      </div>
      {!remove && (shown || alt) && (
        <div className={styles.photoAlt}>
          <label htmlFor={`${id}-alt`}>Describe this photo for someone who can’t see it</label>
          <input
            id={`${id}-alt`}
            name={`${prefix}Alt`}
            value={alt}
            maxLength={300}
            onChange={(event) => setAlt(event.target.value)}
            placeholder="e.g. Ada smiling at her desk with two laptops"
          />
        </div>
      )}
      <input type="hidden" name={`${prefix}OriginalAlt`} value={photo?.alt ?? ''} />
    </div>
  );
}
