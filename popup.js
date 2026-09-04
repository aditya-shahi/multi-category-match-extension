let categories = {};
let currentMatches = {};

// Load saved categories on startup
async function loadCategories() {
  const result = await chrome.storage.local.get(['categories', 'matchPartial']);
  if (result.categories) {
    categories = result.categories;
  } else {
    // Default categories with sample keywords
    categories = {
      'Technology': ['javascript', 'python', 'react', 'angular', 'vue', 'node', 'api', 'cloud', 'ai', 'machine learning'],
      'Sports': ['football', 'basketball', 'soccer', 'tennis', 'cricket', 'baseball', 'golf', 'olympics', 'world cup'],
      'Business': ['startup', 'investment', 'stock', 'market', 'finance', 'revenue', 'profit', 'business', 'economy'],
      'Health': ['fitness', 'diet', 'workout', 'nutrition', 'healthcare', 'medical', 'wellness', 'exercise', 'yoga'],
      'Entertainment': ['movie', 'film', 'netflix', 'disney', 'hollywood', 'bollywood', 'celebrity', 'music', 'concert']
    };
    await saveCategories();
  }
  
  // Load saved match mode preference
  if (result.matchPartial !== undefined) {
    const matchModeCheckbox = document.getElementById('matchMode');
    if (matchModeCheckbox) {
      matchModeCheckbox.checked = result.matchPartial;
      console.log('Loaded match mode preference:', result.matchPartial ? 'PARTIAL' : 'WHOLE WORD');
    }
  }
  
  renderCategories();
}

// Save categories to storage
async function saveCategories() {
  await chrome.storage.local.set({ categories: categories });
  console.log('Categories saved:', categories);
}

// Save match mode preference
async function saveMatchMode(isChecked) {
  await chrome.storage.local.set({ matchPartial: isChecked });
  console.log('Match mode saved:', isChecked ? 'PARTIAL' : 'WHOLE WORD');
}

// Render all categories in the UI
function renderCategories() {
  const container = document.getElementById('categoriesList');
  if (!container) return;
  
  if (Object.keys(categories).length === 0) {
    container.innerHTML = '<p>No categories yet. Add one below!</p>';
    return;
  }
  
  container.innerHTML = '';
  
  for (const [catName, keywords] of Object.entries(categories)) {
    const catDiv = document.createElement('div');
    catDiv.className = 'category-item';
    catDiv.innerHTML = `
      <div class="category-header">
        <span class="category-name">${escapeHtml(catName)}</span>
        <button class="delete-cat" data-name="${escapeHtml(catName)}">Delete</button>
      </div>
      <textarea class="keywords-input" data-name="${escapeHtml(catName)}" rows="3" placeholder="Enter keywords (comma separated)">${keywords.join(', ')}</textarea>
    `;
    container.appendChild(catDiv);
  }
  
  // Add event listeners to textareas
  document.querySelectorAll('.keywords-input').forEach(textarea => {
    textarea.addEventListener('change', (e) => {
      const catName = textarea.dataset.name;
      const keywordsStr = textarea.value;
      const keywordsArray = keywordsStr.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
      categories[catName] = keywordsArray;
      saveCategories();
    });
  });
  
  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-cat').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const catName = btn.dataset.name;
      delete categories[catName];
      saveCategories();
      renderCategories();
    });
  });
}

// Helper to escape HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Add new category
function addCategory() {
  const nameInput = document.getElementById('newCatName');
  const keywordsInput = document.getElementById('newCatKeywords');
  
  const name = nameInput.value.trim();
  const keywordsStr = keywordsInput.value.trim();
  
  if (!name) {
    alert('Please enter a category name');
    return;
  }
  
  if (categories[name]) {
    alert('Category already exists!');
    return;
  }
  
  const keywords = keywordsStr ? keywordsStr.split(',').map(k => k.trim().toLowerCase()).filter(k => k) : [];
  categories[name] = keywords;
  
  saveCategories();
  renderCategories();
  
  // Clear inputs
  nameInput.value = '';
  keywordsInput.value = '';
}

// Navigate to a specific keyword on the page
async function navigateToKeyword(keyword, category, source, matchPartial) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    console.log(`Navigating to "${keyword}" with matchPartial = ${matchPartial}`);
    
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'findAndScrollToKeyword', 
      keyword: keyword,
      category: category,
      matchPartial: matchPartial
    });
    
    if (response && response.success) {
      const scanStatusDiv = document.getElementById('scanStatus');
      if (scanStatusDiv) {
        scanStatusDiv.innerHTML = `📍 Found "${keyword}" - ${response.message}`;
        setTimeout(() => {
          if (scanStatusDiv.innerHTML.includes('Found')) {
            scanStatusDiv.innerHTML = `✅ Ready - Click any keyword button to jump to it`;
          }
        }, 3000);
      }
    } else {
      console.error('Could not find keyword:', keyword);
      const scanStatusDiv = document.getElementById('scanStatus');
      if (scanStatusDiv) {
        scanStatusDiv.innerHTML = `⚠️ Could not find "${keyword}" on the page`;
      }
    }
  } catch (error) {
    console.error('Navigation error:', error);
    const scanStatusDiv = document.getElementById('scanStatus');
    if (scanStatusDiv) {
      scanStatusDiv.innerHTML = `⚠️ Error: ${error.message}. Try refreshing the page.`;
    }
  }
}

// Clear all highlights on the page
async function clearHighlights() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: 'clearHighlights' });
  } catch (error) {
    console.error('Error clearing highlights:', error);
  }
}

// Scan current page for keyword matches
async function scanPage() {
  const matchResultsDiv = document.getElementById('matchResults');
  const scanStatusDiv = document.getElementById('scanStatus');
  
  if (!matchResultsDiv) return;
  
  matchResultsDiv.innerHTML = '<div>🔍 Scanning...</div>';
  scanStatusDiv.innerHTML = '';
  
  // Clear previous highlights
  await clearHighlights();
  
  // Check if partial matching is enabled
  const matchPartial = document.getElementById('matchMode')?.checked || false;
  console.log(`=== SCANNING WITH MODE: ${matchPartial ? 'PARTIAL' : 'WHOLE WORD'} ===`);
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('brave://') || tab.url.startsWith('about:')) {
      matchResultsDiv.innerHTML = '<div class="no-match">❌ Cannot scan browser internal pages. Please try on a normal webpage.</div>';
      scanStatusDiv.innerHTML = '⚠️ Try on http:// or https:// pages only';
      return;
    }
    
    // Try to send message with timeout
    let response;
    try {
      response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { action: 'getPageText' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
    } catch (sendError) {
      console.log('Content script not responding, injecting manually...');
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(resolve => setTimeout(resolve, 200));
      response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageText' });
    }
    
    if (response && response.text) {
      const pageText = response.text.toLowerCase();
      const htmlSource = response.html ? response.html.toLowerCase() : '';
      
      const matches = {};
      let totalMatchesFound = 0;
      
      // Check each category
      for (const [category, keywords] of Object.entries(categories)) {
        if (keywords.length === 0) continue;
        
        const matchedKeywords = [];
        for (const keyword of keywords) {
          const keywordLower = keyword.toLowerCase();
          let foundInPage = false;
          let foundInHTML = false;
          
          if (matchPartial) {
            // PARTIAL MATCHING - simple includes
            foundInPage = pageText.includes(keywordLower);
            foundInHTML = htmlSource.includes(keywordLower);
            if (foundInPage || foundInHTML) {
              console.log(`✅ PARTIAL MATCH: "${keyword}"`);
            }
          } else {
            // WHOLE WORD MATCHING - true word boundaries.
            // Note: JS's \b only treats letters/digits/underscore as "word"
            // characters, so it would still match "ai" inside "ai-powered"
            // or "ai.example.com" since hyphens/dots count as boundaries too.
            // We treat hyphens and underscores as word-continuation characters
            // so compound/kebab-case tokens (very common in raw HTML: class
            // names, ids, URLs) aren't mistaken for the standalone keyword.
            const escapedKeyword = keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wholeWordRegex = new RegExp(`(?<![a-zA-Z0-9_-])${escapedKeyword}(?![a-zA-Z0-9_-])`, 'i');
            foundInPage = wholeWordRegex.test(pageText);
            foundInHTML = wholeWordRegex.test(htmlSource);
            if (foundInPage || foundInHTML) {
              console.log(`✅ WHOLE WORD MATCH: "${keyword}"`);
            }
          }
          
          if (foundInPage || foundInHTML) {
            let matchSource = '';
            if (foundInPage && foundInHTML) {
              matchSource = 'page content & HTML';
            } else if (foundInPage) {
              matchSource = 'page content';
            } else if (foundInHTML) {
              matchSource = 'HTML source';
            }
            
            matchedKeywords.push({ keyword: keyword, source: matchSource });
            totalMatchesFound++;
          }
        }
        
        if (matchedKeywords.length > 0) {
          matches[category] = matchedKeywords;
        }
      }
      
      console.log(`Total matches found: ${totalMatchesFound}`);
      console.log('Categories with matches:', Object.keys(matches));
      
      currentMatches = matches;
      
      if (Object.keys(matches).length === 0) {
        matchResultsDiv.innerHTML = `
          <div class="no-match">❌ No categories matched on this page</div>
          <div style="margin-top: 10px; padding: 8px; background: #e3f2fd; border-radius: 4px; font-size: 12px;">
            <strong>💡 Current Mode:</strong> ${matchPartial ? 'Partial Matching (matches within words)' : 'Whole Word Only'}<br>
            <strong>Categories checked:</strong> ${Object.keys(categories).length}<br>
            <strong>Total keywords checked:</strong> ${Object.values(categories).flat().length}<br>
            ${!matchPartial ? '<br>💡 Tip: Try enabling "Match partial words" to find keywords inside other words!' : ''}
          </div>
        `;
        scanStatusDiv.innerHTML = `✅ Scan completed - No matches found (${matchPartial ? 'partial mode' : 'whole word mode'})`;
      } else {
        let html = `<div><strong>✅ Matched Categories (${matchPartial ? 'Partial Mode' : 'Whole Words Only'}):</strong></div>`;
        
        for (const [category, matchedKeywords] of Object.entries(matches)) {
          html += `<div class="match-category">📁 ${escapeHtml(category)} (${matchedKeywords.length} keywords)</div>`;
          html += `<div class="match-details">`;
          
          for (const item of matchedKeywords) {
            const sourceIcon = item.source.includes('HTML') ? '📄' : '👁️';
            const sourceText = item.source;
            const sourceColor = item.source.includes('HTML') ? '#FF9800' : '#4CAF50';
            
            html += `<div class="keyword-badge" style="border-left: 3px solid ${sourceColor};">
                        🔍 "${escapeHtml(item.keyword)}" 
                        <span style="font-size: 10px; color: ${sourceColor}; margin: 0 5px;">${sourceIcon} ${sourceText}</span>
                        <button class="nav-keyword-btn" data-keyword="${escapeHtml(item.keyword)}" data-category="${escapeHtml(category)}" data-source="${escapeHtml(sourceText)}">📍 Jump to this word</button>
                      </div>`;
          }
          
          html += `</div>`;
        }
        
        html += `<div class="nav-controls" style="margin-top: 10px; padding: 8px; background: #e8f5e9; border-radius: 4px;">
                   💡 <strong>Tip:</strong> Click "Jump to this word" to highlight ALL instances (${matchPartial ? 'partial mode - will highlight everywhere the text appears' : 'whole word mode - will highlight only standalone words'})
                 </div>`;
        
        matchResultsDiv.innerHTML = html;
        scanStatusDiv.innerHTML = `✅ Found ${Object.keys(matches).length} matching categories with ${totalMatchesFound} keyword matches (${matchPartial ? 'partial mode' : 'whole words only'})`;
        
        // Add event listeners to all navigation buttons
        document.querySelectorAll('.nav-keyword-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const keyword = btn.dataset.keyword;
            const category = btn.dataset.category;
            const source = btn.dataset.source;
            navigateToKeyword(keyword, category, source, matchPartial);
          });
        });
      }
    } else {
      matchResultsDiv.innerHTML = '<div class="no-match">❌ Could not read page content. Try refreshing the page.</div>';
      scanStatusDiv.innerHTML = '⚠️ No page content received. Please refresh the page and try again.';
    }
  } catch (error) {
    console.error('Scan error:', error);
    matchResultsDiv.innerHTML = `<div class="no-match">❌ Error scanning page: ${error.message}</div>`;
    scanStatusDiv.innerHTML = 'Please refresh the page and try again. Check console (F12) for details.';
  }
}

// Tab switching
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      if (tabName === 'categories') {
        document.getElementById('categoriesTab').classList.add('active');
      } else if (tabName === 'results') {
        document.getElementById('resultsTab').classList.add('active');
        scanPage();
      }
    });
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadCategories();
  setupTabs();
  
  // Save match mode preference when checkbox changes
  const matchModeCheckbox = document.getElementById('matchMode');
  if (matchModeCheckbox) {
    matchModeCheckbox.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      saveMatchMode(isChecked);
      console.log(`Match mode changed to: ${isChecked ? 'PARTIAL' : 'WHOLE WORD'}`);
      // Auto-scan when mode changes
      scanPage();
    });
  }
  
  const scanBtn = document.getElementById('scanBtn');
  if (scanBtn) {
    scanBtn.addEventListener('click', scanPage);
  }
  
  const addBtn = document.getElementById('addCategoryBtn');
  if (addBtn) {
    addBtn.addEventListener('click', addCategory);
  }
  
  const saveBtn = document.getElementById('saveCategoriesBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      await saveCategories();
      alert('Categories saved successfully!');
    });
  }
});