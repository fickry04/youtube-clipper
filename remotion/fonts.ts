import { loadFont as loadBebasNeue } from '@remotion/google-fonts/BebasNeue';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins';
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto';

const loadedFonts = new Set<string>();

/**
 * Ensure the requested Google Font is loaded into the Remotion document
 * and pauses rendering until font glyphs are 100% available.
 */
export function ensureFontLoaded(family?: string): string {
  const normalized = (family || 'Montserrat').trim();
  const lower = normalized.toLowerCase();

  if (loadedFonts.has(lower)) {
    return normalized;
  }

  try {
    switch (lower) {
      case 'bebas neue':
      case 'bebasneue':
        loadBebasNeue('normal', { weights: ['400'] });
        break;
      case 'montserrat':
        loadMontserrat('normal', { weights: ['600', '700', '800', '900'] });
        break;
      case 'poppins':
        loadPoppins('normal', { weights: ['600', '700', '800', '900'] });
        break;
      case 'oswald':
        loadOswald('normal', { weights: ['500', '600', '700'] });
        break;
      case 'inter':
        loadInter('normal', { weights: ['400', '600', '700', '800'] });
        break;
      case 'roboto':
        loadRoboto('normal', { weights: ['400', '500', '700', '900'] });
        break;
      default:
        loadMontserrat('normal', { weights: ['700', '800'] });
        break;
    }
    loadedFonts.add(lower);
  } catch (err) {
    console.warn(`[Remotion Fonts] Could not load font ${normalized}:`, err);
  }

  return normalized;
}
