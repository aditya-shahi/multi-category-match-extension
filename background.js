// Background service worker - handles extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  console.log('Multi Keyword Category Matcher installed');
  
  // Initialize default categories if not exists
  chrome.storage.local.get(['categories'], (result) => {
    if (!result.categories) {
      const defaultCategories = {
        'Technology': ['javascript', 'python', 'react', 'angular', 'vue', 'node', 'api', 'cloud', 'ai', 'machine learning'],
        'Sports': ['football', 'basketball', 'soccer', 'tennis', 'cricket', 'baseball', 'golf', 'olympics', 'world cup'],
        'Business': ['startup', 'investment', 'stock', 'market', 'finance', 'revenue', 'profit', 'business', 'economy'],
        'Health': ['fitness', 'diet', 'workout', 'nutrition', 'healthcare', 'medical', 'wellness', 'exercise', 'yoga'],
        'Entertainment': ['movie', 'film', 'netflix', 'disney', 'hollywood', 'bollywood', 'celebrity', 'music', 'concert']
      };
      chrome.storage.local.set({ categories: defaultCategories });
    }
  });
});

// Optional: Keep service worker alive for better performance
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepAlive') {
    port.onDisconnect.addListener(() => {});
    port.postMessage('keepAlive');
  }
});