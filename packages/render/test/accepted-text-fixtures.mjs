export function acceptedTextFixtures() {
  const cases=[];
  for(const dimensions of [{widthInches:40/3,heightInches:7.5},{widthInches:5.625,heightInches:10}])
  for(const contentBox of [false,true])for(const alignment of ['left','center','right'])
  for(const text of [
    'Full  source\nSecond paragraph. ',
    ['Exact spacing ',{text:'with bold words',bold:true},' and ',{text:'italics.',italic:true},'\n',
      {text:'A raised ',superscript:true},{text:'note',fontSize:20,underline:true,color:'#174485'},' stays editable. '],
  ]) {
    const id=`${dimensions.widthInches>10?'wide':'portrait'}-${contentBox?'card':'plain'}-${alignment}-${Array.isArray(text)?'rich':'scalar'}`;
    cases.push({id,deck:{design:{contentBox,dimensions,titleAlignment:alignment,contentAlignment:alignment,
      // FF-31: choose Carlito itself so the accepted-text browser gate compares one exact open face.
      fontScheme:{heading:{family:'Carlito'},body:{family:'Carlito'}}},
      slides:[{tag:'Source',title:'A measured title that wraps when space is narrow',subtitle:'Supporting text',composition:{mode:'column',minFontSize:24},text}]}});
  }
  return cases;
}
