// Content script that runs on every page
console.log('Keyword Matcher content script loaded');

let currentHighlights = [];
let isHighlighting = false; // Prevent concurrent highlighting

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'getPageText') {
    // Get ALL text from the page
    let pageText = '';
    let htmlText = '';
    
    // Get visible text only (what user sees)
    if (document.body) {
      pageText += document.body.innerText || document.body.textContent || '';
    }
    
    // Get HTML source code (for detecting keywords in code)
    htmlText = document.documentElement.outerHTML || '';
    
    // Get text from all common content elements
    const allElements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6, li, a, td, th, label, button, article, section');
    allElements.forEach(el => {
      if (el.textContent && el.offsetParent !== null) {
        pageText += ' ' + el.textContent;
      }
    });
    
    // Clean up the text
    pageText = pageText.toLowerCase().replace(/\s+/g, ' ').trim();
    
    console.log('Visible page text length:', pageText.length);
    console.log('HTML source length:', htmlText.length);
    
    sendResponse({ text: pageText, html: htmlText });
  }
  
  else if (request.action === 'findAndScrollToKeyword') {
    const keyword = request.keyword.toLowerCase();
    const matchPartial = request.matchPartial === true || request.matchPartial === 'true';
    
    console.log(`Content script received: find "${keyword}" with matchPartial = ${matchPartial}`);
    
    // Prevent multiple simultaneous highlighting
    if (isHighlighting) {
      console.log('Already highlighting, please wait...');
      sendResponse({ success: false, message: 'Already processing, please wait' });
      return true;
    }
    
    isHighlighting = true;
    
    try {
      // First, clear ALL existing highlights completely
      clearHighlights();
      
      // Use setTimeout to allow DOM to settle
      setTimeout(() => {
        try {
          // Find ALL text nodes containing the keyword
          const textNodes = findAllTextNodesWithKeyword(keyword, matchPartial);
          
          if (textNodes.length > 0) {
            // Highlight ALL found instances
            highlightAllTextNodes(textNodes, keyword, matchPartial);
            sendResponse({ success: true, message: `Found "${request.keyword}" in ${textNodes.length} text locations` });
          } else {
            sendResponse({ success: false, message: `Could not find "${request.keyword}"` });
          }
        } catch (error) {
          console.error('Error in highlighting:', error);
          sendResponse({ success: false, message: error.message });
        } finally {
          isHighlighting = false;
        }
      }, 50);
      
    } catch (error) {
      console.error('Error in highlighting:', error);
      sendResponse({ success: false, message: error.message });
      isHighlighting = false;
    }
    
    return true; // Keep channel open for async response
  }
  
  else if (request.action === 'clearHighlights') {
    clearHighlights();
    sendResponse({ success: true });
  }
  
  return true;
});

// Find ALL text nodes containing the keyword (correctly handles both modes)
function findAllTextNodesWithKeyword(keyword, matchPartial) {
  const textNodes = [];
  
  // Create regex based on match mode
  let regex;
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  if (matchPartial) {
    // PARTIAL matching - matches anywhere in text (no word boundaries)
    regex = new RegExp(escapedKeyword, 'i');
    console.log(`Using PARTIAL matching for "${keyword}" - will match anywhere in text`);
  } else {
    // WHOLE WORD matching - true word boundaries.
    // Plain \b treats hyphens/dots as boundaries too, so it would wrongly
    // match "ai" inside "ai-powered-widget". Treat hyphen/underscore as
    // word-continuation chars so compound tokens aren't false positives.
    regex = new RegExp(`(?<![a-zA-Z0-9_-])${escapedKeyword}(?![a-zA-Z0-9_-])`, 'i');
    console.log(`Using WHOLE WORD matching for "${keyword}" - will match as complete word only`);
  }
  
  // Create a TreeWalker to find all text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        // Skip script, style, noscript tags
        const tagName = parent.tagName;
        if (tagName === 'SCRIPT' || tagName === 'STYLE' || tagName === 'NOSCRIPT') {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip if parent already has highlights (to avoid re-processing)
        if (parent.querySelector && parent.querySelector('.keyword-highlight')) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Check if text node contains the keyword
        if (regex.test(node.textContent)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );
  
  let textNode;
  while (textNode = walker.nextNode()) {
    textNodes.push(textNode);
  }
  
  console.log(`Found ${textNodes.length} text nodes containing "${keyword}"`);
  return textNodes;
}

// Highlight ALL text nodes containing the keyword
function highlightAllTextNodes(textNodes, keyword, matchPartial) {
  // Create regex based on match mode for highlighting
  let regex;
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  if (matchPartial) {
    regex = new RegExp(`(${escapedKeyword})`, 'gi');
  } else {
    // Same fix as findAllTextNodesWithKeyword: hyphen/underscore count as
    // word-continuation so highlighting doesn't light up compound tokens.
    regex = new RegExp(`(?<![a-zA-Z0-9_-])(${escapedKeyword})(?![a-zA-Z0-9_-])`, 'gi');
  }
  
  let totalHighlights = 0;
  
  textNodes.forEach((textNode) => {
    const parent = textNode.parentElement;
    if (!parent) return;
    
    const originalText = textNode.textContent;
    
    // Test if the text node contains matches
    if (!regex.test(originalText)) return;
    
    // Reset regex
    const globalRegex = regex;
    globalRegex.lastIndex = 0;
    
    // Create a document fragment to hold the highlighted content
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    
    while ((match = globalRegex.exec(originalText)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(originalText.substring(lastIndex, match.index)));
      }
      
      // Create highlighted span for the matched text
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'keyword-highlight';
      highlightSpan.setAttribute('data-keyword', keyword);
      highlightSpan.style.backgroundColor = 'yellow';
      highlightSpan.style.color = 'black';
      highlightSpan.style.padding = '2px 0px';
      highlightSpan.style.borderRadius = '2px';
      highlightSpan.style.display = 'inline';
      highlightSpan.style.cursor = 'pointer';
      highlightSpan.title = 'Keyword match';
      highlightSpan.textContent = match[1] || match[0];
      
      fragment.appendChild(highlightSpan);
      totalHighlights++;
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after the last match
    if (lastIndex < originalText.length) {
      fragment.appendChild(document.createTextNode(originalText.substring(lastIndex)));
    }
    
    // Replace the original text node with our highlighted fragment
    parent.replaceChild(fragment, textNode);
  });
  
  console.log(`Highlighted ${totalHighlights} total instances of "${keyword}"`);
  
  // Scroll to the first highlighted element
  const firstHighlight = document.querySelector('.keyword-highlight');
  if (firstHighlight) {
    firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Add pulsing effect
    firstHighlight.style.transition = 'all 0.3s ease';
    firstHighlight.style.backgroundColor = '#FF9800';
    
    setTimeout(() => {
      if (firstHighlight) {
        firstHighlight.style.backgroundColor = 'yellow';
      }
    }, 500);
  }
}

// Clear all highlights from the page - COMPLETELY restores original state
function clearHighlights() {
  console.log('Clearing all highlights...');
  
  // Find all highlighted spans
  const highlightedSpans = document.querySelectorAll('.keyword-highlight');
  console.log(`Found ${highlightedSpans.length} highlight spans to clear`);
  
  // Process each highlight span
  highlightedSpans.forEach(span => {
    const parent = span.parentNode;
    if (parent) {
      // Replace the span with its text content
      const textNode = document.createTextNode(span.textContent);
      parent.replaceChild(textNode, span);
    }
  });
  
  // Normalize all parents to merge adjacent text nodes
  const parents = new Set();
  highlightedSpans.forEach(span => {
    if (span.parentNode) {
      parents.add(span.parentNode);
    }
  });
  
  parents.forEach(parent => {
    if (parent && parent.normalize) {
      parent.normalize();
    }
  });
  
  // Remove any data-highlighted attributes
  const highlightedElements = document.querySelectorAll('[data-highlighted]');
  highlightedElements.forEach(el => {
    el.removeAttribute('data-highlighted');
  });
  
  // Clear the tracking array
  currentHighlights = [];
  
  console.log('All highlights cleared');
}