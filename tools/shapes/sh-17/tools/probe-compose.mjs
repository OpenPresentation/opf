import {composeSlide} from '@openpresentation/opf/composition';
import * as opf from '@openpresentation/opf';
const [layout='chevrons', items='Plan,Build,Test,Ship', w='1280', h='720'] = process.argv.slice(2);
const deck = {opf: '0.19', slides: [{layout, title: 'Process', items: items.split(',')}]};
const keys = Object.keys(opf).filter(k => /compose|layout/i.test(k));
console.log(keys.slice(0, 30).join(' '));
