import { writeFileSync } from 'node:fs';
const T = {
  'ar-SA': { fs:'noto-sans-arabic', metric:['نتيجة المقياس','عملاء جدد'], chart:['المبيعات حسب الربع','الربع','المبيعات',['الأول','الثاني','الثالث','الرابع']], pie:['حصة المناطق',['الشرق','الغرب','الشمال']], tbl:['جدول الأرقام',['البند','المبلغ','النسبة'],['أ','ب']], list:['خطوات العمل',['جمع البيانات','تحليل النتائج','عرض التقرير','المتابعة']] },
  'fa-IR': { fs:'noto-sans-arabic', metric:['شاخص کلیدی','مشتریان جدید'], chart:['فروش به تفکیک فصل','فصل','فروش',['اول','دوم','سوم','چهارم']], pie:['سهم مناطق',['شرق','غرب','شمال']], tbl:['جدول اعداد',['مورد','مبلغ','نسبت'],['الف','ب']], list:['مراحل کار',['جمع آوری داده','تحلیل نتایج','ارائه گزارش','پیگیری']] },
  'hi-IN-u-nu-deva': { fs:'noto-sans-devangari', metric:['मुख्य मीट्रिक','नए ग्राहक'], chart:['तिमाही बिक्री','तिमाही','बिक्री',['पहली','दूसरी','तीसरी','चौथी']], pie:['क्षेत्र हिस्सेदारी',['पूर्व','पश्चिम','उत्तर']], tbl:['संख्याओं की तालिका',['मद','राशि','अनुपात'],['क','ख']], list:['कार्य के चरण',['डेटा जुटाना','परिणाम विश्लेषण','रिपोर्ट प्रस्तुत करना','अनुवर्तन']] },
  'bn-BD': { fs:'noto-sans-bengali', metric:['মূল মেট্রিক','নতুন গ্রাহক'], chart:['ত্রৈমাসিক বিক্রয়','ত্রৈমাসিক','বিক্রয়',['প্রথম','দ্বিতীয়','তৃতীয়','চতুর্থ']], pie:['অঞ্চলভিত্তিক অংশ',['পূর্ব','পশ্চিম','উত্তর']], tbl:['সংখ্যার সারণি',['আইটেম','পরিমাণ','অনুপাত'],['ক','খ']], list:['কাজের ধাপ',['তথ্য সংগ্রহ','ফলাফল বিশ্লেষণ','প্রতিবেদন উপস্থাপন','ফলো-আপ']] },
};
T['ar-SA-u-nu-latn'] = T['ar-SA'];
for (const [tag, t] of Object.entries(T)) {
  const deck = {
    $schema: 'https://openpresentation.org/schema/opf/v1',
    name: `Digits review ${tag}`,
    language: { bcp47: tag, fontScheme: t.fs },
    design: { theme: 'minimal', footer: { center: { text: '{{slide.number}} / {{deck.slideCount}}' } } },
    slides: [
      { title: t.metric[0], metric: { value: 999, label: t.metric[1] } },
      { title: t.chart[0], chart: { type: 'column', data: { columns: [t.chart[1], t.chart[2]], rows: t.chart[3].map((c, i) => [c, [120, 450, 1250, 3400][i]]) }, dataLabels: true, axisTitles: { value: t.chart[2] } } },
      { title: t.pie[0], chart: { type: 'pie', data: { columns: [t.pie[0], 'n'], rows: [[t.pie[1][0], 50], [t.pie[1][1], 30], [t.pie[1][2], 20]] }, dataLabels: { content: ['percent'], position: 'outside-end' } } },
      { title: t.tbl[0], table: { columns: [t.tbl[1][0], { name: t.tbl[1][1], format: '#,##0.00' }, { name: t.tbl[1][2], format: '#,##0' }], rows: [[t.tbl[2][0], 1234.5, 98765], [t.tbl[2][1], 2500.75, 1234567]] } },
      { title: t.list[0], items: t.list[1], numbering: 'arabic' },
    ],
  };
  writeFileSync(`digits-${tag}.opf.json`, JSON.stringify(deck, null, 2));
}
