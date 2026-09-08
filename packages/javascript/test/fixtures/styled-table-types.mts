import type {Presentation} from '@openpresentation/opf';
const deck:Presentation={slides:[{table:{columns:[{value:'Header',colSpan:2},null],rows:[[{value:['Rich ',{text:'cell',bold:true}],rowSpan:2,colSpan:2,style:{fill:'#12345680',align:'center',verticalAlign:'middle',padding:{left:0},borders:{top:{color:'#ABCDEF',width:2,dash:'dot'}}}},null],[null,null]]}}]};
// @ts-expect-error Native alignment names are not canonical cell alignments.
const invalidAlignment:Presentation={slides:[{table:{rows:[[{value:'Cell',style:{align:'ctr'}}]]}}]};
// @ts-expect-error Span values must be numeric.
const invalidSpan:Presentation={slides:[{table:{rows:[[{value:'Cell',colSpan:'two'}]]}}]};
void [deck,invalidAlignment,invalidSpan];
