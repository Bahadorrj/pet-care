import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { ChoreType, Species } from '../db/types';

// Minimal monochrome glyphs replacing the old colorful emoji. Single source of
// truth — both the pets screens and Tasks render from these maps.
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const SPECIES_ICON: Record<Species, IconName> = {
  dog: 'dog',
  cat: 'cat',
  bird: 'bird',
  rabbit: 'rabbit',
  other: 'paw',
};

export const CHORE_TYPE_ICON: Record<ChoreType, IconName> = {
  feeding: 'food-drumstick-outline',
  meds: 'pill',
  play: 'tennis-ball',
  grooming: 'content-cut',
  vet: 'hospital-box-outline',
  other: 'clipboard-text-outline',
};
