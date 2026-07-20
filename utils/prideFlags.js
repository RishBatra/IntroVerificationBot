/**
 * Pride flag palettes for rank card customisation.
 *
 * Colours validated against flagcolorcodes.com (and brandpalettes.com for
 * Progress). Stripes are listed top-to-bottom as on the real flag; the card
 * renders them as a diagonal ribbon, so chevron/triangle/symbol elements are
 * represented by their palette (intersex keeps its circle via a special case).
 *
 * `weights` (optional) sets relative stripe thickness, e.g. bisexual 2:1:2.
 */
const PRIDE_FLAGS = {
    rainbow: {
        name: 'LGBT Pride (Rainbow)',
        colors: ['#E40303', '#FF8C00', '#FFED00', '#008026', '#004CFF', '#732982'],
    },
    progress: {
        name: 'Progress Pride',
        colors: [
            '#FFFFFF', '#FFAFC8', '#74D7EE', '#613915', '#000000',
            '#E40303', '#FF8C00', '#FFED00', '#008026', '#004DFF', '#750787',
        ],
    },
    philadelphia: {
        name: 'Philadelphia Pride',
        colors: ['#000000', '#784F17', '#D12229', '#F68A1E', '#FDE01A', '#007940', '#24408E', '#732982'],
    },
    transgender: {
        name: 'Transgender',
        colors: ['#5BCEFA', '#F5A9B8', '#FFFFFF', '#F5A9B8', '#5BCEFA'],
    },
    bisexual: {
        name: 'Bisexual',
        colors: ['#D60270', '#9B4F96', '#0038A8'],
        weights: [2, 1, 2],
    },
    pansexual: {
        name: 'Pansexual',
        colors: ['#FF218C', '#FFD800', '#21B1FF'],
    },
    polysexual: {
        name: 'Polysexual',
        colors: ['#F714BA', '#01D66A', '#1594F6'],
    },
    omnisexual: {
        name: 'Omnisexual',
        colors: ['#FE9ACE', '#FF53BF', '#200044', '#6760FE', '#8EA6FF'],
    },
    lesbian: {
        name: 'Lesbian',
        colors: ['#D52D00', '#EF7627', '#FF9A56', '#FFFFFF', '#D162A4', '#B55690', '#A30262'],
    },
    gaymen: {
        name: 'Gay Men',
        colors: ['#078D70', '#26CEAA', '#98E8C1', '#FFFFFF', '#7BADE2', '#5049CC', '#3D1A78'],
    },
    asexual: {
        name: 'Asexual',
        colors: ['#000000', '#A3A3A3', '#FFFFFF', '#800080'],
    },
    demisexual: {
        name: 'Demisexual',
        colors: ['#000000', '#FFFFFF', '#6E0070', '#D2D2D2'],
        weights: [2, 2, 1, 2],
    },
    aromantic: {
        name: 'Aromantic',
        colors: ['#3DA542', '#A7D379', '#FFFFFF', '#A9A9A9', '#000000'],
    },
    queer: {
        name: 'Queer',
        colors: ['#000000', '#99D9EA', '#00A2E8', '#B5E61D', '#FFFFFF', '#FFC90E', '#FD6666', '#FFAEC9'],
    },
    genderqueer: {
        name: 'Genderqueer',
        colors: ['#B57EDC', '#FFFFFF', '#4A8123'],
    },
    nonbinary: {
        name: 'Nonbinary',
        colors: ['#FCF434', '#FFFFFF', '#9C59D1', '#2C2C2C'],
    },
    genderfluid: {
        name: 'Genderfluid',
        colors: ['#FF76A4', '#FFFFFF', '#C011D7', '#000000', '#2F3CBE'],
    },
    genderflux: {
        name: 'Genderflux',
        colors: ['#F57694', '#F2A3B9', '#CFCFCF', '#7BE1F5', '#3ECDFA', '#FFF48C'],
    },
    agender: {
        name: 'Agender',
        colors: ['#000000', '#BCC4C7', '#FFFFFF', '#B7F684', '#FFFFFF', '#BCC4C7', '#000000'],
    },
    neutrois: {
        name: 'Neutrois',
        colors: ['#FFFFFF', '#1F9F00', '#000000'],
    },
    bigender: {
        name: 'Bigender',
        colors: ['#C479A2', '#EDA5CD', '#D6C7E8', '#FFFFFF', '#D6C7E8', '#9AC7E8', '#6D82D1'],
    },
    trigender: {
        name: 'Trigender',
        colors: ['#FF95C5', '#9581FF', '#67D966', '#9581FF', '#FF95C5'],
    },
    demiboy: {
        name: 'Demiboy',
        colors: ['#7F7F7F', '#C4C4C4', '#9DD7EA', '#FFFFFF', '#9DD7EA', '#C4C4C4', '#7F7F7F'],
    },
    demigirl: {
        name: 'Demigirl',
        colors: ['#7F7F7F', '#C4C4C4', '#FDADC8', '#FFFFFF', '#FDADC8', '#C4C4C4', '#7F7F7F'],
    },
    demigender: {
        name: 'Demigender',
        colors: ['#7F7F7F', '#C4C4C4', '#FBFF74', '#FFFFFF', '#FBFF74', '#C4C4C4', '#7F7F7F'],
    },
    intersex: {
        name: 'Intersex',
        colors: ['#FFD800'],
        special: 'intersex', // yellow band + purple ring drawn by the renderer
    },
    polyamory: {
        name: 'Polyamory',
        colors: ['#0000FF', '#FF0000', '#000000'],
    },
    ally: {
        name: 'Straight Ally',
        colors: ['#000000', '#FFFFFF', '#F00000', '#FE7E00', '#FFFF00', '#007A41', '#4041FE', '#A001BE'],
    },
};

const DEFAULT_FLAG_VALUE = 'default';
const DEFAULT_FLAG_NAME = 'Server Default (Pride + India ribbon)';

function getFlag(key) {
    return PRIDE_FLAGS[key] || null;
}

/** Choices for autocomplete: [{ name, value }], Default first. */
function getFlagChoices() {
    return [
        { name: DEFAULT_FLAG_NAME, value: DEFAULT_FLAG_VALUE },
        ...Object.entries(PRIDE_FLAGS).map(([value, { name }]) => ({ name, value })),
    ];
}

module.exports = {
    PRIDE_FLAGS,
    DEFAULT_FLAG_VALUE,
    getFlag,
    getFlagChoices,
};
