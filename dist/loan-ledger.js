/* Dated changes extend the existing monthly loan model; no storage or UI side effects. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PFT_LOAN_LEDGER=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const number=x=>typeof x==='number'&&Number.isFinite(x);
  const dateOK=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
  const round=x=>Math.round(x*100)/100;
  function monthEnd(date){const[y,m]=date.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
  function legacyEndDate(debt,payments=[]){let last=debt.date;for(const row of [...(debt.loanChanges||[]),...(payments||[])])if(row.date>last)last=row.date;return monthEnd(last);}
  function firstEmiAnniversary(date){if(!dateOK(date))return null;const[y,m,d]=date.split('-').map(Number),last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(d,last))).toISOString().slice(0,10);}
  function estimateExtraFirstEmiInterest(debt){
    if(!debt||debt.dailyInterestBasis===true||!dateOK(debt.date)||!dateOK(debt.firstEmiDate))return 0;
    const anniversary=firstEmiAnniversary(debt.date);if(debt.firstEmiDate<=anniversary)return 0;
    const days=(Date.parse(debt.firstEmiDate+'T00:00:00Z')-Date.parse(anniversary+'T00:00:00Z'))/86400000;
    const principal=Number(debt.principal),rate=Number(debt.rate);
    if(!Number.isFinite(principal)||principal<=0||!Number.isFinite(rate)||rate<0)return 0;
    return round(principal*rate*days/36500);
  }
  function validate(debt){
    if(debt.firstEmiInterestMethod!==undefined&&!['monthly','short-actual365'].includes(debt.firstEmiInterestMethod))throw Error('Invalid first EMI interest method.');
    if(debt.dailyInterestBasis!==undefined&&typeof debt.dailyInterestBasis!=='boolean')throw Error('Daily interest basis must be true or false.');
    if(debt.firstEmiDate!==undefined){
      if(!dateOK(debt.firstEmiDate)||!dateOK(debt.date)||debt.firstEmiDate<=debt.date)throw Error('First EMI date must be after the loan start date.');
      if(debt.emiDueDay!==undefined){const [y,m]=debt.firstEmiDate.split('-').map(Number),expected=Math.min(debt.emiDueDay,new Date(Date.UTC(y,m,0)).getUTCDate());if(Number(debt.firstEmiDate.slice(-2))!==expected)throw Error('First EMI date must match the monthly EMI day (clamped in shorter months).');}
    }
    if(debt.firstEmiExtraInterest!==undefined&&(!number(debt.firstEmiExtraInterest)||debt.firstEmiExtraInterest<0||debt.firstEmiExtraInterest>1e12))throw Error('First EMI extra interest must be a valid non-negative amount.');
    if(debt.firstEmiExtraInterest>0&&!debt.firstEmiDate&&!debt.emiDueDay)throw Error('Enter the first EMI date or monthly due day for extra interest.');
    if(debt.loanChanges===undefined)return;
    if(!Array.isArray(debt.loanChanges)||debt.loanChanges.length>500)throw Error('Loan change history must contain at most 500 entries.');
    if(!number(debt.openingRate)||debt.openingRate<0||!number(debt.openingEmi)||debt.openingEmi<0)throw Error('Loan change history needs a valid opening rate and EMI.');
    const ids=new Set(),terms=new Set();
    for(const e of debt.loanChanges){
      if(!e||!['rate','topup','emi'].includes(e.type)||typeof e.id!=='string'||! /^[a-zA-Z0-9_-]+$/.test(e.id)||ids.has(e.id))throw Error('Invalid or duplicate loan change.');ids.add(e.id);
      if(!dateOK(e.date)||e.date<debt.date)throw Error('A loan change date cannot precede the loan start date.');
      if(e.type==='topup'&&(!number(e.amount)||e.amount<=0))throw Error('Top-up amount must be greater than zero.');
      if(e.type==='rate'&&(!number(e.rate)||e.rate<0))throw Error('Enter a valid new interest rate.');
      if(e.type==='emi'&&(e.rate!==undefined||e.amount!==undefined||e.repaymentChoice!=='manual'||!number(e.emi)||e.emi<=0))throw Error('A revised EMI must contain a positive regular EMI without changing rate or principal.');
      if(e.type==='rate'&&e.amount!==undefined)throw Error('Rate changes cannot add principal.');
      if(e.rate!==undefined&&(!number(e.rate)||e.rate<0))throw Error('Enter a valid new interest rate.');
      if(e.emi!==undefined&&(!number(e.emi)||e.emi<0))throw Error('Enter a valid revised EMI.');
      if(e.repaymentChoice!==undefined&&!['tenure','emi','manual'].includes(e.repaymentChoice))throw Error('Invalid repayment choice.');
      if(['tenure','emi'].includes(e.repaymentChoice)&&e.emi!==undefined)throw Error('Automatic repayment choices cannot contain a manual EMI.');
      if(e.repaymentChoice==='manual'&&(!number(e.emi)||e.emi<=0))throw Error('Enter the bank-confirmed EMI.');
      if(e.notes!==undefined&&(typeof e.notes!=='string'||e.notes.length>500))throw Error('Loan change notes must be at most 500 characters.');
      if(e.rate!==undefined||e.emi!==undefined||e.repaymentChoice!==undefined){if(terms.has(e.date))throw Error('Only one rate/EMI change is allowed on the same date. Combine the revised terms in one entry.');terms.add(e.date);}
    }
  }
  function totalPrincipal(debt){return Number(debt.principal)+(Array.isArray(debt.loanChanges)?debt.loanChanges.filter(e=>e.type==='topup').reduce((s,e)=>s+Number(e.amount),0):0);}
  function estimate(balance,emi,annualRate){const r=annualRate/1200;if(balance<=0)return{count:0,final:0};if(emi<=0||emi<=balance*r)return{count:null};const months=r===0?balance/emi:-Math.log1p(-balance*r/emi)/Math.log1p(r),n=Math.max(1,Math.ceil(months-1e-9));const before=r===0?balance-emi*(n-1):balance*Math.pow(1+r,n-1)-emi*Math.expm1((n-1)*Math.log1p(r))/r;return{count:n,months,final:Math.min(emi,Math.max(0,before*(1+r)))};}
  function emiFor(balance,rate,n,roundUp=false){const r=rate/1200;return (roundUp?Math.ceil:Math.round)((r===0?balance/n:balance*r/(-Math.expm1(-n*Math.log1p(r))))-(roundUp?1e-9:0));}
  function rebuildDaily(debt,payments,quoteId,asOfDate){
    validate(debt);let balance=Number(debt.principal)-(Number(debt.principalPaidBeforeTracking)||0),rate=Number(debt.openingRate??debt.rate),emi=Number(debt.openingEmi??debt.repaymentBaseEmi??debt.emi)||0;
    const day=x=>Math.floor(Date.parse(x+'T00:00:00Z')/86400000),key=n=>new Date(n*86400000).toISOString().slice(0,10);
    const cutoff=dateOK(asOfDate)?asOfDate:legacyEndDate(debt,payments),end=day(cutoff);
    const events=[...(debt.loanChanges||[]).filter(e=>e.date<=cutoff).map(e=>({...e,priority:0})),...payments.filter(row=>row.date<=cutoff).map(row=>({date:row.date,id:row.id,row,priority:row.repaymentType==='part-payment'?1:2}))].sort((a,b)=>a.date.localeCompare(b.date)||a.priority-b.priority||a.id.localeCompare(b.id));
    let i=0,accrued=0,total=Number(debt.interestPaidBeforeTracking)||0,quote;const updates=[],history=[],caps=[];
    for(let d=day(debt.date);d<=end;d++){const date=key(d);while(i<events.length&&events[i].date===date){const e=events[i++];if(!e.row){const beforeBalance=balance,beforeRate=rate,beforeEmi=emi;if(e.type==='topup')balance+=e.amount;if(e.rate!==undefined)rate=e.rate;if(e.repaymentChoice==='manual')emi=e.emi;history.push({id:e.id,balance,rate,emi,beforeBalance,beforeRate,beforeEmi});continue;}const row=e.row;let n=Number(row.amount);if(quoteId===row.id)n=round(Math.min(emi,balance));if(!Number.isFinite(n)||n<=0||n>balance+.01)throw Error('Invalid payment for daily-balance loan.');if(row.repaymentType!=='part-payment'&&debt.firstEmiDate&&date<debt.firstEmiDate)throw Error('Monthly EMI cannot precede first EMI date.');balance=Math.max(0,balance-n);updates.push({id:row.id,principalPaid:round(n),interestPaid:0});if(quoteId===row.id)quote=round(n);}
      accrued+=balance*rate/36500;const next=new Date((d+1)*86400000);if(next.getUTCDate()===1&&accrued){const credit=round(accrued);balance=round(balance+credit);total=round(total+credit);caps.push({date,amount:credit});accrued=0;}}
    return{remaining:round(balance),interestPaid:round(total),accruedInterest:round(accrued),rate,emi,payments:updates,history,totalPrincipal:totalPrincipal(debt),interestCapitalizations:caps,...(quoteId?{quoteAmount:quote}:{})};
  }
  function rebuild(debt,payments,quoteId,asOfDate){
    try{
      validate(debt);if(debt.dailyInterestBasis===true)return rebuildDaily(debt,payments,quoteId,asOfDate);
      let balance=Number(debt.principal)-(Number(debt.principalPaidBeforeTracking)||0),rate=Number(debt.openingRate??debt.rate),emi=Number(debt.openingEmi??debt.repaymentBaseEmi??debt.emi)||0;
      if(!number(balance)||balance<0||!number(rate)||rate<0)throw Error('Invalid loan opening balance or rate.');
      let interestTotal=Number(debt.interestPaidBeforeTracking)||0,lastDate=debt.date,cycleOpening=balance,adjustments=[];
      const events=[...(debt.loanChanges||[]).map(e=>({...e,priority:0})),...payments.map(row=>({type:'payment',date:row.date,id:row.id,row,priority:row.repaymentType==='part-payment'?1:2}))].sort((a,b)=>a.date.localeCompare(b.date)||a.priority-b.priority||a.id.localeCompare(b.id));
      const updates=[],history=[];let quoteAmount,firstMonthly=true;const day=x=>Date.parse(x+'T00:00:00Z')/86400000;
      const [startYear,startMonth,startDay]=debt.date.split('-').map(Number),anniversary=new Date(Date.UTC(startYear,startMonth,Math.min(startDay,new Date(Date.UTC(startYear,startMonth+1,0)).getUTCDate()))).toISOString().slice(0,10);
      for(const e of events){
        if(!dateOK(e.date)||e.date<debt.date)throw Error('A repayment or change date cannot precede the loan start date.');
        if(e.type!=='payment'){
          const beforeBalance=balance,beforeRate=rate,beforeEmi=emi,oldSchedule=estimate(balance,emi,rate);
          const oldTerm=oldSchedule.count>1&&oldSchedule.final<emi*.01?oldSchedule.count-1:oldSchedule.count;
          if(e.type==='topup'){balance=round(balance+e.amount);if(!number(balance))throw Error('Top-up exceeds the supported loan balance.');adjustments.push({date:e.date,delta:e.amount});}
          if(e.rate!==undefined)rate=e.rate;
          if(e.repaymentChoice==='tenure'){
            if(!oldTerm||!Number.isFinite(oldTerm))throw Error('The existing remaining tenure cannot be estimated. Choose bank-confirmed EMI instead.');
            emi=balance>0?emiFor(balance,rate,oldSchedule.months,true):0;
            if(balance>0&&emi<=balance*rate/1200)emi=Math.floor(balance*rate/1200)+1;
          }else if(e.repaymentChoice!=='emi'&&e.emi!==undefined)emi=Math.round(e.emi);
          if(e.repaymentChoice&&balance>0&&(!number(emi)||emi<=balance*rate/1200))throw Error('The selected EMI does not cover the revised interest. Keep remaining tenure or enter a higher bank-confirmed EMI.');
          const newSchedule=estimate(balance,emi,rate);
          history.push({id:e.id,balance:round(balance),rate,emi,beforeBalance,beforeRate,beforeEmi,oldTerm,newTerm:newSchedule.count,repaymentChoice:e.repaymentChoice});continue;
        }
        const row=e.row;let amount=Number(row.amount);if(!number(amount)||amount<=0)throw Error('Every repayment must have a positive amount.');
        if(row.repaymentType==='part-payment'){
          if(amount>balance+.01)throw Error('Part payment exceeds the outstanding principal on that date.');
          const schedule=estimate(balance,emi,rate);const term=schedule.count>1&&schedule.final<emi*.01?schedule.count-1:schedule.count;
          if(row.partPaymentAction==='reduce'&&(!term||!Number.isFinite(term)))throw Error('Enter an EMI that covers interest before reducing the EMI.');
          const applied=Math.min(amount,balance);if(row.partPaymentAction==='reduce')emi=balance<=applied?0:emiFor(balance-applied,rate,term);
          adjustments.push({date:row.date,delta:-applied});balance=round(Math.max(0,balance-applied));updates.push({id:row.id,principalPaid:round(applied),interestPaid:0});continue;
        }
        if(debt.firstEmiDate&&row.date<debt.firstEmiDate)throw Error('Monthly EMI cannot precede the bank-confirmed first EMI date.');
        const extra=firstMonthly?Number(debt.firstEmiExtraInterest)||0:0;
        const interval=Math.max(0,day(row.date)-day(lastDate));let interest;
        if(row.interestOverride===true){interest=Number(row.interestPaid);if(!number(interest)||interest<0)throw Error('Invalid statement interest correction.');}
        else if(firstMonthly&&debt.firstEmiInterestMethod==='short-actual365'&&row.date<anniversary){
          let principalDays=cycleOpening*interval;for(const a of adjustments)principalDays+=a.delta*Math.max(0,day(row.date)-day(a.date));
          interest=Math.round(Math.max(0,principalDays)*rate/36500);
        }
        else if(adjustments.length&&interval>0){let weighted=cycleOpening*interval;for(const a of adjustments)weighted+=a.delta*Math.max(0,day(row.date)-day(a.date));interest=Math.round(Math.max(0,weighted/interval)*rate/1200);}
        else interest=Math.round(balance*rate/1200);
        if(row.interestOverride!==true)interest=round(interest+extra);
        if(quoteId&&row.id===quoteId){amount=round(Math.min(emi+extra,balance+interest));quoteAmount=amount;}
        firstMonthly=false;
        const principal=amount-interest;if(principal<=0)throw Error('Monthly EMI does not cover interest ('+interest+').');if(principal>balance+.01)throw Error('EMI principal exceeds the outstanding balance on that date.');
        const applied=Math.min(principal,balance);updates.push({id:row.id,principalPaid:round(applied),interestPaid:round(interest)});balance=round(Math.max(0,balance-applied));interestTotal+=interest;lastDate=row.date;cycleOpening=balance;adjustments=[];
      }
      return{remaining:round(balance),interestPaid:round(interestTotal),rate,emi,payments:updates,history,totalPrincipal:totalPrincipal(debt),...(quoteId?{quoteAmount}:{})};
    }catch(error){return{error:error.message};}
  }
  function quotePayment(debt,payments,date){
    const dated={...debt,loanChanges:(debt.loanChanges||[]).filter(row=>row.date<=date)};
    if(debt.loanChanges===undefined)delete dated.loanChanges;
    const prior=payments.filter(row=>row.date<=date);
    const before=rebuild(dated,prior,undefined,date);if(before.error)return before;
    if(before.remaining<=0)return{paidOff:true,amount:0};
    let id='recurring_quote';while(prior.some(row=>row.id===id))id+='_';
    const result=rebuild(dated,[...prior,{id,date,amount:1,repaymentType:'emi'}],id,date);
    return result.error?result:{amount:result.quoteAmount,rate:before.rate,emi:before.emi};
  }
  function dailyStatement(debt,payments,asOfDate){
    const cutoff=dateOK(asOfDate)?asOfDate:legacyEndDate(debt,payments),throughPayments=(payments||[]).filter(row=>row.date<=cutoff),throughDebt={...debt,...(Array.isArray(debt.loanChanges)?{loanChanges:debt.loanChanges.filter(row=>row.date<=cutoff)}:{})};
    const result=rebuild(throughDebt,throughPayments,undefined,cutoff);if(result.error)return result;
    const events=[{date:debt.date,priority:-1,id:'opening',type:'opening',credit:Number(debt.principal)||0}];
    for(const change of throughDebt.loanChanges||[])events.push({date:change.date,priority:0,id:change.id,type:change.type,change});
    for(const payment of throughPayments)events.push({date:payment.date,priority:payment.repaymentType==='part-payment'?1:2,id:payment.id,type:'payment',payment});
    for(const credit of result.interestCapitalizations||[])events.push({date:credit.date,priority:3,id:'interest-'+credit.date,type:'interest',credit:credit.amount});
    events.sort((a,b)=>a.date.localeCompare(b.date)||a.priority-b.priority||String(a.id).localeCompare(String(b.id)));
    let balance=0;
    const rows=events.map(event=>{
      let debit=0,credit=0,type,description;
      if(event.type==='opening'){type='Disbursement';description='Original loan amount';credit=event.credit;}
      else if(event.type==='topup'){type='Loan top-up';description=event.change.notes||'Additional principal';credit=Number(event.change.amount)||0;}
      else if(event.type==='rate'){type='Rate change';description=`Annual interest rate changed to ${event.change.rate}%`+(event.change.notes?' · '+event.change.notes:'');}
      else if(event.type==='emi'){type='EMI revision';description='Regular EMI changed'+(event.change.notes?' · '+event.change.notes:'');}
      else if(event.type==='interest'){type='Interest capitalization';description='Month-end interest added';credit=Number(event.credit)||0;}
      else {const payment=event.payment;debit=Number(payment.amount)||0;type=payment.repaymentType==='part-payment'?'Part payment':'EMI payment';description=payment.repaymentType==='part-payment'?'Extra principal repayment':'Monthly EMI';if(payment.notes)description+=' · '+payment.notes;}
      balance=round(balance+credit-debit);
      return{date:event.date,type,description,debit:round(debit),credit:round(credit),balance};
    });
    return{rows,remaining:result.remaining,interestPaid:result.interestPaid,accruedInterest:result.accruedInterest||0,asOfDate:cutoff};
  }
  function paymentBalances(debt,payments){
    const result=rebuild(debt,payments);if(result.error)return result;
    let balance=Number(debt.principal)-(Number(debt.principalPaidBeforeTracking)||0);
    const splits=new Map(result.payments.map(row=>[row.id,row]));
    const events=[...(debt.loanChanges||[]).map(change=>({...change,priority:0})),...(payments||[]).map(payment=>({date:payment.date,id:payment.id,type:'payment',payment,priority:payment.repaymentType==='part-payment'?1:2}))].sort((a,b)=>a.date.localeCompare(b.date)||a.priority-b.priority||String(a.id).localeCompare(String(b.id)));
    const balances=new Map();
    for(const event of events){if(event.type==='topup'){balance=round(balance+Number(event.amount));continue;}if(event.type!=='payment')continue;const split=splits.get(event.id);if(!split)continue;balance=round(Math.max(0,balance-Number(split.principalPaid||0)));balances.set(event.id,balance);}
    return{balances,remaining:result.remaining};
  }
  return{validate,rebuild,totalPrincipal,estimate,quotePayment,dailyStatement,paymentBalances,firstEmiAnniversary,estimateExtraFirstEmiInterest,legacyEndDate};
});
