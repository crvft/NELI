import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { RADII, SHADOWS, TEXT_STYLES } from '@/utils/tokens';

export { type ClassValue } from 'clsx';

export const twMergeConfig = {
  extend: {
    classGroups: {
      'font-size': [{ text: [...TEXT_STYLES] }],
      shadow: [{ shadow: [...SHADOWS] }],
      rounded: [{ rounded: [...RADII] }],
    },
  },
};

const customTwMerge = extendTailwindMerge(twMergeConfig);

/** clsx + tailwind-merge aware of NELI's custom tokens. */
export function cn(...classes: ClassValue[]) {
  return customTwMerge(clsx(...classes));
}
