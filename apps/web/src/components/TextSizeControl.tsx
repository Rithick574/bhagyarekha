'use client';

import { useSyncExternalStore } from 'react';

export type TextSize = 'standard' | 'large' | 'xlarge';
export const TEXT_SIZE_STORAGE_KEY = 'br_text_size';
const CHANGE_EVENT = 'br:text-size-change';

interface Props {
  label: string;
  names: { standard: string; large: string; xlarge: string };
}

function readStored(): TextSize {
  try {
    const v = window.localStorage.getItem(TEXT_SIZE_STORAGE_KEY);
    return v === 'large' || v === 'xlarge' ? v : 'standard';
  } catch {
    return 'standard';
  }
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function applyToDocument(size: TextSize) {
  const root = document.documentElement;
  if (size === 'standard') root.removeAttribute('data-text-size');
  else root.setAttribute('data-text-size', size);
}

export function TextSizeControl({ label, names }: Props) {
  // Server snapshot is always 'standard'; the inline boot script in RootHtml has already
  // applied the saved attribute before paint, so there is no visible jump.
  const size = useSyncExternalStore(subscribe, readStored, () => 'standard' as TextSize);

  function choose(next: TextSize) {
    applyToDocument(next);
    try {
      if (next === 'standard') window.localStorage.removeItem(TEXT_SIZE_STORAGE_KEY);
      else window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable: preference applies for this page only */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const options: { value: TextSize; glyph: string; name: string }[] = [
    { value: 'standard', glyph: 'text-[0.85rem]', name: names.standard },
    { value: 'large', glyph: 'text-[1.05rem]', name: names.large },
    { value: 'xlarge', glyph: 'text-[1.3rem]', name: names.xlarge },
  ];

  return (
    <div className="inline-flex items-center gap-2">
      <span className="hidden text-[0.9rem] text-ink-secondary xl:inline" id="text-size-label">
        {label}
      </span>
      <div role="group" aria-labelledby="text-size-label" aria-label={label} className="inline-flex overflow-hidden rounded-control border border-line bg-card">
        {options.map((option) => {
          const pressed = option.value === size;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => choose(option.value)}
              className={`touch-target inline-flex items-center justify-center px-3 font-bold leading-none transition-colors ${
                pressed ? 'bg-primary text-white' : 'text-ink hover:bg-primary-soft'
              }`}
            >
              <span aria-hidden="true" className={option.glyph}>
                A
              </span>
              <span className="sr-only">{option.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
