// Formulas frozen from the older app, for parity tests only. Do not edit.

    function calculateXirr(cashflows) {
      const flows=cashflows.filter(flow=>validCalendarDate(flow.date)&&Number.isFinite(flow.amount)&&flow.amount!==0);
      if(!flows.some(flow=>flow.amount<0)||!flows.some(flow=>flow.amount>0))return null;
      const origin=flows.reduce((earliest,flow)=>Math.min(earliest,Date.parse(flow.date+'T00:00:00Z')),Infinity);
      const dated=flows.map(flow=>({amount:flow.amount,years:(Date.parse(flow.date+'T00:00:00Z')-origin)/(365*86400000)}));
      const npv=rate=>dated.reduce((sum,flow)=>sum+flow.amount/Math.pow(1+rate,flow.years),0);
      let low=-0.9999,high=0.1,lowValue=npv(low),highValue=npv(high);
      while((lowValue>0)===(highValue>0)&&high<1000000){high=high*2+0.1;highValue=npv(high);}
      if(!Number.isFinite(lowValue)||Number.isNaN(highValue)||(lowValue>0)===(highValue>0))return null;
      for(let i=0;i<240;i++){
        const mid=(low+high)/2,value=npv(mid);
        if(!Number.isFinite(value))return null;
        if(Math.abs(value)<0.000001)return mid;
        if((value>0)===(lowValue>0)){low=mid;lowValue=value;}else{high=mid;highValue=value;}
      }
      return (low+high)/2;
    }

    function shiftGratuityDate(dateString,months){
      const [year,month,day]=dateString.split('-').map(Number),index=year*12+(month-1)+months,targetYear=Math.floor(index/12),targetMonth=index%12;
      const lastDay=new Date(targetYear,targetMonth+1,0).getDate();
      return `${targetYear}-${String(targetMonth+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
    }

    function gratuityService(account,asOf=localDateKey()){
      if(!validCalendarDate(account?.date)||!validCalendarDate(asOf)||account.date>asOf)return {completedYears:0,countedYears:0,eligible:false};
      const [joinYear]=account.date.split('-').map(Number),[asOfYear]=asOf.split('-').map(Number);
      let completedYears=asOfYear-joinYear;
      if(shiftGratuityDate(account.date,completedYears*12)>asOf)completedYears--;
      completedYears=Math.max(0,completedYears);
      const sixMonthMark=shiftGratuityDate(account.date,completedYears*12+6);
      const countedYears=completedYears+(asOf>sixMonthMark?1:0);
      return {completedYears,countedYears,eligible:completedYears>=5};
    }

    function estimateGratuity(account,asOf=localDateKey()){
      const service=gratuityService(account,asOf),salary=Number(account?.basicSalary)||0;
      const amount=service.eligible?Math.min(GRATUITY_CAP,salary*15/26*service.countedYears):0;
      return {...service,amount};
    }

    function totalGratuityEstimate(asOf=localDateKey()){
      return profileRows(state.gratuityAccounts||[]).reduce((sum,account)=>sum+estimateGratuity(account,asOf).amount,0);
    }

    function projectionMonthIndex(monthKey) {
      const [year,month]=monthKey.split('-').map(Number);
      return year*12+month-1;
    }

    function projectionMonthKey(index) {
      const year=Math.floor(index/12),month=index%12+1;
      return `${year}-${String(month).padStart(2,'0')}`;
    }

    function projectionMonthEndDate(month){const [year,monthNumber]=month.split('-').map(Number);return `${year}-${String(monthNumber).padStart(2,'0')}-${String(new Date(year,monthNumber,0).getDate()).padStart(2,'0')}`;}

    function runGrowthProjection(assets,years,scenario) {
      const balances=new Map(assets.map(asset=>[asset.name,asset.current])),pendingAnnualInterest=new Map(assets.map(asset=>[asset.name,0])),rows=[],start=projectionMonthIndex(projectionMonthKey(projectionMonthIndex(currentMonthKey())+1));
      const startMonth=projectionMonthKey(start),startFinancialYear=Number(startMonth.slice(0,4))-(Number(startMonth.slice(5,7))<4?1:0);
      let currentYear=null,yearRow=null;
      const includeMonthly=state.projectionSettings?.includeMonthlyContributions!==false;
      const excludedMonthly=new Set(state.projectionSettings?.excludedMonthlyContributions||[]);
      if(excludedMonthly.has('PF'))excludedMonthly.add('EPS');
      const assetInputs=new Map(assets.map(asset=>{
        const rate=asset.kind==='eps'?0:Number(asset.returns?.[scenario])||0;
        const step=asset.kind==='eps'?0:Math.min(100,Math.max(0,Number(asset.stepUpPercent??state.projectionSettings?.annualStepUpPercentByAsset?.[asset.name])||0));
        return [asset.name,{rate,monthlyFactor:Math.pow(1+rate/100,1/12),monthly:includeMonthly&&!excludedMonthly.has(asset.name)?(Number(asset.monthly)||0):0,stepFactor:1+step/100}];
      }));
      const adjustmentsByMonth=new Map();
      for(const row of state.projectionAdjustments||[]){
        const month=row.date.slice(0,7);let categories=adjustmentsByMonth.get(month);
        if(!categories){categories=new Map();adjustmentsByMonth.set(month,categories);}
        let totals=categories.get(row.category);if(!totals){totals={additions:0,withdrawals:0};categories.set(row.category,totals);}
        if(row.type==='add')totals.additions+=row.amount;else if(row.type==='withdraw')totals.withdrawals+=row.amount;
      }
      for(let offset=0;offset<years*12;offset++){
        const monthIndex=start+offset,month=projectionMonthKey(monthIndex),fyStart=Number(month.slice(0,4))-(Number(month.slice(5,7))<4?1:0);
        if(fyStart!==currentYear){const fyStep=Math.max(0,fyStart-startFinancialYear);for(const input of assetInputs.values())input.yearMonthly=input.monthly*Math.pow(input.stepFactor,fyStep);currentYear=fyStart;yearRow={fyStart,opening:[...balances.values()].reduce((sum,value)=>sum+value,0),contributions:0,additions:0,withdrawals:0,growth:0,closing:0};rows.push(yearRow);}
        const monthlyAdjustments=adjustmentsByMonth.get(month);
        let monthlyGrowth=0;
        for(const asset of assets){
          if(asset.kind==='gratuity'){
            const nextValue=totalGratuityEstimate(projectionMonthEndDate(month));
            monthlyGrowth+=nextValue-(balances.get(asset.name)||0);
            balances.set(asset.name,nextValue);
            continue;
          }
          const inputs=assetInputs.get(asset.name),monthly=inputs.yearMonthly;
          const flows=monthlyAdjustments?.get(asset.name);
          const additions=flows?.additions||0,withdrawals=flows?.withdrawals||0;
          const preReturn=balances.get(asset.name)+monthly+additions-withdrawals;
          if(preReturn < -0.005)throw new Error(`${asset.name} withdrawal in ${month} exceeds its projected available balance in the ${scenario} scenario.`);
          const {rate,monthlyFactor}=inputs;
          let afterReturn;
          if(asset.kind==='pf'||asset.kind==='ppf'){
            // Accumulate interest on each month's opening-of-month contributions and
            // planned flows, but do not compound or add it to the account balance
            // until the March financial-year close.
            pendingAnnualInterest.set(asset.name,pendingAnnualInterest.get(asset.name)+Math.max(0,preReturn)*Math.max(0,rate)/1200);
            const isFinancialYearEnd=month.slice(5,7)==='03';
            const interestCredit=isFinancialYearEnd?pendingAnnualInterest.get(asset.name):0;
            afterReturn=Math.max(0,preReturn)+interestCredit;
            if(isFinancialYearEnd)pendingAnnualInterest.set(asset.name,0);
            monthlyGrowth+=interestCredit;
          }else{
            afterReturn=Math.max(0,preReturn)*monthlyFactor;
            monthlyGrowth+=afterReturn-preReturn;
          }
          balances.set(asset.name,afterReturn);
          yearRow.contributions+=monthly;yearRow.additions+=additions;yearRow.withdrawals+=withdrawals;
        }
        yearRow.growth+=monthlyGrowth;
        yearRow.closing=[...balances.values()].reduce((sum,value)=>sum+value,0);
      }
      return {rows,ending:rows.at(-1)?.closing||0,totalContributions:rows.reduce((sum,row)=>sum+row.contributions,0),totalAdditions:rows.reduce((sum,row)=>sum+row.additions,0),totalWithdrawals:rows.reduce((sum,row)=>sum+row.withdrawals,0),totalGrowth:rows.reduce((sum,row)=>sum+row.growth,0)};
    }
