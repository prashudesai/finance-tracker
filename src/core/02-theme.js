    // Theme Management
    const themeToggle = document.getElementById('themeToggle');
    const themeOptions = document.getElementById('themeOptions');
    const htmlElement = document.documentElement;
    const COLOR_THEME_KEY = 'familyWealthColorTheme';
    const COLOR_THEMES = {
      'navy-emerald': {label:'Navy + Emerald', colors:['#127c70','#1e3346','#d5a85f','#e5f2ef'], darkHeader:['#1e3346','#142638'], light:['#127c70','#1e3346','#e5f2ef','#d5a85f'], dark:['#55c4a0','#bae6d6','#143737','#e0b766']},
      'classic-teal': {label:'Classic Teal', colors:['#0f7c7e','#084b4d','#d4976f','#e8f5f5'], darkHeader:['#0b3f40','#062a2b'], light:['#0f7c7e','#084b4d','#e8f5f5','#d4976f'], dark:['#5eead4','#b5fff0','#173e44','#99f6e4']},
      'ocean-blue': {label:'Ocean Blue', colors:['#2563eb','#1e3a8a','#38bdf8','#dbeafe'], darkHeader:['#102b5c','#071a3b'], light:['#2563eb','#1e3a8a','#eff6ff','#38bdf8'], dark:['#60a5fa','#bfdbfe','#172554','#93c5fd']},
      'emerald-green': {label:'Emerald Green', colors:['#059669','#064e3b','#34d399','#d1fae5'], darkHeader:['#064e3b','#032d22'], light:['#059669','#064e3b','#ecfdf5','#34d399'], dark:['#34d399','#a7f3d0','#064e3b','#6ee7b7']},
      'warm-amber': {label:'Warm Amber', colors:['#b45309','#78350f','#f59e0b','#fef3c7'], darkHeader:['#5b3106','#351b03'], light:['#b45309','#78350f','#fffbeb','#f59e0b'], dark:['#fbbf24','#fde68a','#451a03','#fcd34d']},
      'midnight-aurora': {label:'Midnight Aurora', colors:['#7c3aed','#312e81','#22d3ee','#ede9fe'], darkHeader:['#27245a','#17153a'], light:['#6d28d9','#312e81','#f5f3ff','#22d3ee'], dark:['#a78bfa','#ddd6fe','#1e1b4b','#22d3ee']},
      'sunset-luxe': {label:'Sunset Luxe', colors:['#e6536f','#8f2749','#f5a65b','#ffe4e6'], darkHeader:['#63253b','#3c1729'], light:['#c2415d','#7f1d3d','#fff1f2','#f5a65b'], dark:['#fb7185','#fecdd3','#4c1d2a','#fdba74']},
      'forest-gold': {label:'Forest & Gold', colors:['#357a57','#1f5139','#d4a72c','#dcfce7'], darkHeader:['#163d2b','#0b281c'], light:['#357a57','#1f5139','#f0fdf4','#d4a72c'], dark:['#86efac','#bbf7d0','#123b2a','#facc15']},
      'arctic-glass': {label:'Arctic Glass', colors:['#0e7490','#164e63','#67e8f9','#cffafe'], darkHeader:['#0b3e52','#062a39'], light:['#0e7490','#164e63','#ecfeff','#67e8f9'], dark:['#67e8f9','#a5f3fc','#083344','#a5f3fc']}
    };

    function renderThemeOptions() {
      if (!themeOptions) return;
      themeOptions.innerHTML = Object.entries(COLOR_THEMES).map(([key,theme]) => `<button type="button" class="theme-choice" data-theme-key="${key}" aria-pressed="false" aria-label="Apply ${theme.label} theme"><span class="theme-choice-colors" aria-hidden="true">${theme.colors.map(color=>`<span style="background:${color}"></span>`).join('')}</span><span class="theme-choice-name">${theme.label}</span></button>`).join('');
    }
    renderThemeOptions();

    function applyColorTheme(key, persist = true) {
      const safeKey = Object.prototype.hasOwnProperty.call(COLOR_THEMES, key) ? key : 'navy-emerald';
      const theme = COLOR_THEMES[safeKey];
      const mode = htmlElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const [primary, primaryDark, primaryLight, accent] = theme[mode];
      const vars = {'primary':primary,'primary-dark':primaryDark,'primary-light':primaryLight,'accent':accent,
        'header-from':mode === 'dark' ? theme.darkHeader[0] : primary,'header-to':mode === 'dark' ? theme.darkHeader[1] : primaryDark,
        'button-text':mode === 'dark' ? '#0f172a' : '#ffffff','button-hover':primaryDark,
        'chart-secondary':theme.colors[1],'chart-tertiary':theme.colors[2],'chart-quaternary':theme.colors[3]};
      if (safeKey === 'arctic-glass') vars['card-bg'] = mode === 'dark' ? 'rgba(8, 51, 68, .88)' : 'rgba(255, 255, 255, .88)';
      else htmlElement.style.removeProperty('--card-bg');
      Object.entries(vars).forEach(([name,value]) => htmlElement.style.setProperty(`--${name}`,value));
      htmlElement.setAttribute('data-color-theme',safeKey);window.PFTPaint?.remember();
      themeOptions?.querySelectorAll('.theme-choice').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeKey===safeKey)));
      if (persist) { try { trackerStorage.setItem(COLOR_THEME_KEY,safeKey); } catch (error) { /* Theme still changes for this session. */ } }
    }

    function syncThemeModeSwitch(mode) {
      const button=themeToggle?.querySelector('[data-mode]');
      if(!button)return;
      const next=mode==='dark'?'light':'dark';
      const label=`Switch to ${next} mode`;
      button.dataset.mode=next;
      button.setAttribute('aria-label',label);
      button.title=label;
      themeToggle.setAttribute('aria-label',label);
      button.innerHTML=next==='light'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.9 13A8.7 8.7 0 0 1 11 3.1 8.9 8.9 0 1 0 20.9 13Z"/></svg>';
    }

    function initTheme() {
      let saved = 'dark';
      try { saved = trackerStorage.getItem('theme') || 'dark'; } catch (error) { /* Use default theme when storage is unavailable. */ }
      if (saved !== 'dark' && saved !== 'light') saved = 'dark';
      htmlElement.setAttribute('data-theme', saved);
      syncThemeModeSwitch(saved);
      let savedColors = 'navy-emerald';
      try { savedColors = trackerStorage.getItem(COLOR_THEME_KEY) || 'navy-emerald'; } catch (error) { /* Use default colors when storage is unavailable. */ }
      applyColorTheme(savedColors,!Object.prototype.hasOwnProperty.call(COLOR_THEMES,savedColors));
    }

    themeToggle.addEventListener('click', event => {
      const option=event.target.closest('[data-mode]');
      if(!option)return;
      const next=option.dataset.mode;
      if(next!=='dark'&&next!=='light')return;
      htmlElement.setAttribute('data-theme', next);
      try { trackerStorage.setItem('theme', next); } catch (error) { /* Theme still changes for this session. */ }
      applyColorTheme(htmlElement.getAttribute('data-color-theme'),false);
      syncThemeModeSwitch(next);
      if(document.getElementById('analytics')?.classList.contains('active'))renderCharts();
    });
    themeOptions?.addEventListener('click', event => {
      const button=event.target.closest('.theme-choice');
      if(!button||!COLOR_THEMES[button.dataset.themeKey])return;
      applyColorTheme(button.dataset.themeKey);
      if(document.getElementById('analytics')?.classList.contains('active'))renderCharts();
    });

