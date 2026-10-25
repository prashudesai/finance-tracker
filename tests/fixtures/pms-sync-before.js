    function syncStallionPmsFromInvestments() {
      // Sync Stallion PMS investments with stallionPms array
      state.investments.forEach(inv => {
        if (inv.type === 'Stallion PMS') {
          const exists = state.stallionPms.find(s => s.id === inv.id);
          if (exists) {
            exists.member = inv.member; exists.name = inv.name;
            exists.invested = inv.invested; exists.profit = inv.current - inv.invested;
          }
          if (!exists) {
            const profit = inv.current - inv.invested;
            state.stallionPms.push({
              id: inv.id,
              member: inv.member,
              name: inv.name,
              invested: inv.invested,
              profit: profit,
              createdDate: inv.date
            });
          }
        }
      });
      
      // Remove stallionPms entries that no longer have corresponding investments
      state.stallionPms = state.stallionPms.filter(s => {
        const inv = allAccounts('investments').find(i => i.id === s.id && i.type === 'Stallion PMS');
        return inv !== undefined;
      });
    }
