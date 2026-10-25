const A=require('node:assert/strict'),fs=require('./app-source.cjs').fs,vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../dist/index.html'),'utf8');
function fn(name,next){return html.slice(html.indexOf('    function '+name+'('),html.indexOf('    '+next,html.indexOf('    function '+name+'(')));}
let printed='';const debt={id:'a',type:'Loan <unsafe>'};
const ctx={loanHistoryOrdered:()=>[{date:'2026-01-01',entry:'EMI',amount:100,interest:0,principal:100,balance:0,notes:'<script>bad</script>'}],allAccounts:()=>[debt],document:{getElementById:()=>({dataset:{loanId:'a'}})},window:{open:()=>({document:{write:x=>printed=x,close(){}}})},analyticEscape:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),calendarDate:s=>new Date(s),formatCurrency:n=>'INR '+n,alert(){throw Error('unexpected alert')}};
vm.createContext(ctx);vm.runInContext(fn('printLoanHistory',"document.getElementById('debtEmiHistoryPdf')")+';printLoanHistory()',ctx);
A(printed.includes('INR 0'),'paid-off balance must print zero');A(!printed.includes('<script>bad</script>'),'notes escaped');A(printed.includes('Loan &lt;unsafe&gt;'),'title escaped');
let size=0,pages=1;const pdf={setFont(){},setFontSize:n=>size=n,text(){},setFillColor(){},setDrawColor(){},rect(){A(size===7||size===8)},splitTextToSize:s=>[s],addPage(){pages++},setPage(){},save(){}};
ctx.window.jspdf={jsPDF:function(){return pdf}};ctx.loanHistoryOrdered=()=>Array.from({length:100},()=>({date:'2026-01-01',entry:'EMI',amount:100,interest:0,principal:100,balance:0,notes:''}));ctx.loanHistoryFilename=()=> 'test.pdf';
vm.runInContext(fn('saveLoanHistoryPdf','function printLoanHistory')+';saveLoanHistoryPdf()',ctx);A(pages>1);
A(html.includes('rowsById.get(split.id)'));A(!html.includes("const rows=data.expenses.filter(e=>e.category==='EMI Payment'&&e.loanId===d.id),fields="));
console.log('PASS zero-balance printing, HTML escaping, multipage PDF execution, indexed validation integration');
