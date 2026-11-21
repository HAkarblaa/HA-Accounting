/* Main-admin examples. This module never reads or writes a cloud workspace. */
(()=>{'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
function expand(source,env){
 const s=clone(source),day=env.date,api=env.partners;let seq=0;const uid=()=> 'demo-extra-'+(++seq),version={...(s.adminDemoSections||{})},empty=keys=>keys.every(k=>!Array.isArray(s[k])||!s[k].length),aid=code=>s.accounts.find(a=>a.code===code)?.id;
 const entry=(id,number,amount,debit,credit,extra={})=>{if(!debit||!credit)throw Error('دليل حسابات التجربة غير مكتمل');s.entries.push({id,number,date:day(0),memo:'حركة توضيحية في مساحة التجربة',total:amount,lines:[{accountId:debit,debit:amount,credit:0},{accountId:credit,debit:0,credit:amount}],...extra});};
 if(!version.personal){
  if(empty(['personalAppointments']))s.personalAppointments=[{id:'demo-appointment',title:'متابعة حسابات المشروع',date:day(0),endDate:day(0),time:'10:00',endTime:'11:00',status:'scheduled',person:'زبون توضيحي',phone:'',location:'المكتب التجريبي',note:'مثال قابل للتعديل',createdAt:1,updatedAt:1},{id:'demo-appointment-next',title:'موعد تسديد',date:day(3),endDate:day(3),time:'12:00',endTime:'13:00',status:'scheduled',person:'مجهز توضيحي',phone:'',location:'',note:'',createdAt:2,updatedAt:2}];
  if(empty(['personalBudgets']))s.personalBudgets=[{id:'demo-budget',month:day(0).slice(0,7),accountId:aid('6104'),amount:250000}];
  if(empty(['personalSavingsGoals']))s.personalSavingsGoals=[{id:'demo-saving',name:'شراء معدات للمكتب',target:1000000,saved:250000,dueDate:day(60)}];
  if(empty(['personalBills']))s.personalBills=[{id:'demo-bill',name:'اشتراك الإنترنت التجريبي',expenseAccountId:aid('6103'),cashAccountId:aid('1101'),amount:35000,frequency:'monthly',nextDate:day(7),active:true}];
  version.personal=1;
 }
 if(!version.service){
  if(empty(['serviceTickets','serviceExpenses'])){
   const p=(s.products||[]).find(p=>p.id==='demo-product-printer')||(s.products||[])[0];
   if(p){s.serviceTickets=[{id:'demo-service-ticket',number:'DEMO-SRV-001',date:day(0),createdAt:1,receivedTime:'09:00',customer:'زبون الصيانة التجريبي',phone:'',customerType:'citizen',warehouseId:'warehouse-main',problem:'قطعة مستلمة بانتظار الإرسال — مثال تجريبي',items:[{productId:p.id,productName:p.name,qty:1,immediateQty:0,shippedQty:0,returnedQty:0,deliveredQty:0,unitPrice:p.serviceCitizenPrice||p.salePrice||5000,warehouseId:'warehouse-main',shipmentLog:[],deliveryLog:[]}]}];}
   const id='demo-service-expense';s.serviceExpenses=[{id,date:day(0),time:'09:30',category:'نقل',description:'نقل قطع للصيانة — تجربة',amount:2500,accountName:'مصروفات عامة',memo:'',entryId:'demo-service-expense-entry'}];
   entry('demo-service-expense-entry','DEMO-SRV-EXP-001',2500,aid('6104'),aid('1101'),{source:'service-expense',serviceExpenseId:id});
  }
  version.service=1;
 }
 if(!version.workshop){
  const old=s.yemen||{},keys=['invoices','movements','products','contacts','orders','workshop','maintenance'];
  if(keys.every(k=>!Array.isArray(old[k])||!old[k].length)){
   s.yemen={...old,settings:{...old.settings,shopName:'الورشة الصناعية — تجربة الأدمن',baseCode:'IQD',baseName:'دينار عراقي',foreignCode:'USD',foreignName:'دولار أمريكي',rate:1500},categories:[{id:'demo-ym-category',name:'مواد الورشة'}],contacts:[{id:'demo-ym-customer',kind:'customer',name:'زبون الورشة التجريبي',phone:'',address:''},{id:'demo-ym-supplier',kind:'supplier',name:'مجهز الورشة التجريبي',phone:'',address:''}],products:[{id:'demo-ym-raw',name:'لوح خشب تجريبي',category:'مواد الورشة',qty:7,unit:'لوح',cost:20000,price:30000},{id:'demo-ym-made',name:'رف خشبي تجريبي',category:'مواد الورشة',qty:2,unit:'قطعة',cost:20000,price:35000}],invoices:[{id:'demo-ym-purchase',type:'purchase',number:'DEMO-YM-PI-001',date:day(-2),party:'مجهز الورشة التجريبي',currency:'IQD',rate:1,baseAmount:200000,paymentMode:'credit',notes:'شراء مواد للورشة',items:[{productId:'demo-ym-raw',name:'لوح خشب تجريبي',unit:'لوح',qty:10,price:20000}]},{id:'demo-ym-sale',type:'sale',number:'DEMO-YM-SI-001',date:day(0),party:'زبون الورشة التجريبي',currency:'IQD',rate:1,baseAmount:30000,paymentMode:'cash',notes:'بيع نقدي تجريبي',items:[{productId:'demo-ym-raw',name:'لوح خشب تجريبي',unit:'لوح',qty:1,price:30000}]}],movements:[{id:'demo-ym-income',kind:'income',date:day(0),party:'عمل إضافي — تجربة',detail:'إيراد خارج الفواتير',paymentMode:'cash',amount:15000,currency:'IQD',rate:1,baseAmount:15000},{id:'demo-ym-expense',kind:'expense',date:day(0),party:'نقل تجريبي',detail:'نقل مواد الورشة',paymentMode:'cash',amount:3000,currency:'IQD',rate:1,baseAmount:3000}],orders:[{id:'demo-ym-order',date:day(0),customer:'زبون الورشة التجريبي',product:'رف خشبي تجريبي',qty:2,price:35000,status:'جديد'}],workshop:[{id:'demo-ym-work',date:day(-1),material:'لوح خشب تجريبي',materialQty:2,product:'رف خشبي تجريبي',qty:2,cost:20000}],maintenance:[{id:'demo-ym-maintenance',date:day(0),customer:'زبون الورشة التجريبي',phone:'',item:'باب خشبي',problem:'صيانة المفصلات',amount:15000,status:'جديد',notes:'مثال للتجربة'}]};
  }
  version.workshop=1;
 }
 if(!version.partners&&api){
  function partners(accounts){let m={book:api.book(),entries:[],accounts:clone(accounts)};const post=(type,input)=>{m=api.apply(m,{type,input},{today:day(0),uid,now:1});};
   post('profile',{name:'الشريك الأول — تجربة',date:day(-3),phone:''});post('profile',{name:'الشريك الثاني — تجربة',date:day(-3),phone:''});const [a,b]=m.book.partners.map(p=>p.id);post('plan',{date:day(-3),shares:[{partnerId:a,profit:60,loss:60},{partnerId:b,profit:40,loss:40}]});
   post('transaction',{partnerId:a,kind:'contribution',date:day(-2),cashId:aid('1101'),amount:600000});post('transaction',{partnerId:b,kind:'contribution',date:day(-2),cashId:aid('1102'),amount:400000});return m;}
  s.processorData=s.processorData||{};const p=s.processorData.partnership;if(!p||['partners','plans','transactions','distributions'].every(k=>!p[k]?.length)){const m=partners(s.accounts);s.processorData.partnership=m.book;s.accounts=m.accounts;s.entries.push(...m.entries);}
  const e=s.engineeringPartnerData;if(!e||['partners','plans','transactions','distributions'].every(k=>!e.book?.[k]?.length)&&!e.entries?.length){s.engineeringPartnerData={...partners(s.accounts),company:clone(s.company)};}
  version.partners=1;
 }
 if(!version.expenses){if(empty(['simpleExpenses'])){s.simpleExpenses=[{id:'demo-simple-expense',number:'DEMO-SEXP-001',date:day(0),category:'تشغيل',description:'مصروف مكتب تجريبي',amount:5000,accountName:'مصروفات عامة',entryId:'demo-simple-expense-entry'}];entry('demo-simple-expense-entry','DEMO-SEXP-001',5000,aid('6104'),aid('1101'),{source:'simple-expense',simpleExpenseId:'demo-simple-expense',processorExpense:false});}version.expenses=1;}
 if(!version.processorExtras&&s.processorData){const p=s.processorData,product=p.products?.[0];
  if(!p.quotes?.length&&product)p.quotes=[{id:'demo-pr-quote',number:'DEMO-QT-001',party:'زبون المعالجات التجريبي',date:day(0),validUntil:day(14),items:[{productId:product.id,name:product.name,unit:product.unit||'قطعة',qty:2,price:15000,expiryDate:day(20)}],subtotal:30000,discount:0,taxRate:0,taxAmount:0,deliveryFee:0,amount:30000,memo:'عرض تجريبي غير مرحّل',currency:'IQD',createdAt:1,updatedAt:'demo-quote-revision'}];
  version.processorExtras=1;
 }
 if(!version.generator){if(!s.generatorDemoData)s.generatorDemoData=generator(day);version.generator=1;}
 s.adminDemoSections=version;return s;
}
function generator(day){const month=day(0).slice(0,7);return {settings:{name:'المولدة — تجربة الأدمن',owner:'الأدمن الرئيسي (تجربة)',phone:'',area:'منطقة افتراضية',ampPrice:18000,fuelPrice:900,oilPrice:0,workerCost:0,operatingCost:0,currency:'د.ع'},subscribers:[['أحمد — تجربة',5,'normal'],['علي — تجربة',10,'golden'],['حسين — تجربة',6,'normal']].map(([name,amps,ampType],i)=>({id:'demo-gen-sub-'+i,name,amps,ampType,phone:'',area:'حي تجريبي',address:'عنوان افتراضي '+(i+1),fuseNo:String(101+i),notes:'بيانات افتراضية',createdAt:i+1})),collections:[{id:'demo-gen-col-1',subId:'demo-gen-sub-0',month,amount:90000,date:day(0),method:'نقدي',notes:'تسديد كامل',createdAt:1},{id:'demo-gen-col-2',subId:'demo-gen-sub-1',month,amount:90000,date:day(0),method:'نقدي',notes:'تسديد جزئي',createdAt:2}],expenses:[{id:'demo-gen-expense',type:'أخرى',title:'نقل وقود — تجربة',qty:1,unitPrice:10000,amount:10000,date:day(0),notes:''}],fuel:[{id:'demo-gen-fuel',liters:100,price:900,total:90000,date:day(0),notes:'تعبئة تجريبية'}],maintenance:[{id:'demo-gen-maintenance',title:'صيانة دورية — تجربة',cost:15000,tech:'فني تجريبي',date:day(0),notes:''}]};}
window.HAAdminDemo={expand};
if(typeof document!=='undefined'){const seed=()=>{const b=window.HA_ADMIN_DEMO_BRIDGE;if(!b?.allowed())return;try{window.HA_ENGINEERING_BRIDGE?.seedDemo?.();b.seed(expand);}catch(e){console.warn('تعذر إكمال أمثلة التجربة',e);}};window.HAAdminDemo.seed=seed;window.addEventListener('ha-accounting-auth-ready',seed);seed();}
})();
