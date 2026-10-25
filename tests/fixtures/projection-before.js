// Pre-optimization oracle retained for parity tests.
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
      const opening=Object.fromEntries(assets.map(asset=>[asset.name,asset.current]));
      const balances={...opening},pendingAnnualInterest=Object.fromEntries(assets.map(asset=>[asset.name,0])),rows=[],start=projectionMonthIndex(projectionMonthKey(projectionMonthIndex(currentMonthKey())+1));
      const startMonth=projectionMonthKey(start),startFinancialYear=Number(startMonth.slice(0,4))-(Number(startMonth.slice(5,7))<4?1:0);
      let currentYear=null,yearRow=null;
      const includeMonthly=state.projectionSettings?.includeMonthlyContributions!==false;
      const excludedMonthly=new Set(state.projectionSettings?.excludedMonthlyContributions||[]);
      const assetInputs=new Map(assets.map(asset=>{
        const rate=Number(asset.returns?.[scenario])||0;
        const step=Math.min(100,Math.max(0,Number(asset.stepUpPercent??state.projectionSettings?.annualStepUpPercentByAsset?.[asset.name])||0));
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
        if(fyStart!==currentYear){currentYear=fyStart;yearRow={fyStart,opening:Object.values(balances).reduce((sum,value)=>sum+value,0),contributions:0,additions:0,withdrawals:0,growth:0,closing:0};rows.push(yearRow);}
        const monthlyAdjustments=adjustmentsByMonth.get(month);
        let monthlyGrowth=0;
        for(const asset of assets){
          if(asset.kind==='gratuity'){
            const nextValue=totalGratuityEstimate(projectionMonthEndDate(month));
            monthlyGrowth+=nextValue-(balances[asset.name]||0);
            balances[asset.name]=nextValue;
            continue;
          }
          const inputs=assetInputs.get(asset.name),fyStep=Math.max(0,fyStart-startFinancialYear);
          const monthly=inputs.monthly*Math.pow(inputs.stepFactor,fyStep);
          const flows=monthlyAdjustments?.get(asset.name);
          const additions=flows?.additions||0,withdrawals=flows?.withdrawals||0;
          const preReturn=balances[asset.name]+monthly+additions-withdrawals;
          if(preReturn < -0.005)throw new Error(`${asset.name} withdrawal in ${month} exceeds its projected available balance in the ${scenario} scenario.`);
          const {rate,monthlyFactor}=inputs;
          let afterReturn;
          if(asset.kind==='pf'||asset.kind==='ppf'){
            // Accumulate interest on each month's opening-of-month contributions and
            // planned flows, but do not compound or add it to the account balance
            // until the March financial-year close.
            pendingAnnualInterest[asset.name]+=Math.max(0,preReturn)*Math.max(0,rate)/1200;
            const isFinancialYearEnd=month.slice(5,7)==='03';
            const interestCredit=isFinancialYearEnd?pendingAnnualInterest[asset.name]:0;
            afterReturn=Math.max(0,preReturn)+interestCredit;
            if(isFinancialYearEnd)pendingAnnualInterest[asset.name]=0;
            monthlyGrowth+=interestCredit;
          }else{
            afterReturn=Math.max(0,preReturn)*monthlyFactor;
            monthlyGrowth+=afterReturn-preReturn;
          }
          balances[asset.name]=afterReturn;
          yearRow.contributions+=monthly;yearRow.additions+=additions;yearRow.withdrawals+=withdrawals;
        }
        yearRow.growth+=monthlyGrowth;
        yearRow.closing=Object.values(balances).reduce((sum,value)=>sum+value,0);
      }
      return {rows,ending:rows.at(-1)?.closing||0,totalContributions:rows.reduce((sum,row)=>sum+row.contributions,0),totalAdditions:rows.reduce((sum,row)=>sum+row.additions,0),totalWithdrawals:rows.reduce((sum,row)=>sum+row.withdrawals,0),totalGrowth:rows.reduce((sum,row)=>sum+row.growth,0)};
    }