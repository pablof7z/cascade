import type { LayoutServerLoad } from './$types';
import { getCascadeClientRuntime } from '$lib/cascade/config';

export const load: LayoutServerLoad = ({ locals }) => {
  const cascadeEdition = locals.cascadeEdition;

  return {
    cascadeEdition,
    cascadeRuntime: getCascadeClientRuntime(cascadeEdition)
  };
};
