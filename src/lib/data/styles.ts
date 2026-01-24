import type { Style } from '$lib/types/minutes';
import NOVO_NORDISK from './styles/novo-nordisk.json';
import GENERIC from './styles/generic.json';

export const DEFAULT_STYLES: Style[] = [
    GENERIC as Style,
    NOVO_NORDISK as Style
];
