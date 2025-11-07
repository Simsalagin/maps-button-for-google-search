// Chrome Extension: Maps Button for Google Search
// Adds a Google Maps button above maps in Google Search results

(function() {
  'use strict';

  // Track already processed maps to avoid duplicates
  const processedMaps = new WeakSet();

  /**
   * Extracts the search query from the URL
   */
  function getSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q') || '';
  }

  /**
   * Creates a Google Maps link
   */
  function createMapsLink(query) {
    const encodedQuery = encodeURIComponent(query);
    return `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  }

  /**
   * Creates the link element
   */
  function createLinkElement(mapsUrl) {
    const linkContainer = document.createElement('div');
    linkContainer.className = 'gmaps-link-container';

    const link = document.createElement('a');
    link.href = mapsUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'gmaps-link';
    link.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
      Open in Google Maps
    `;

    linkContainer.appendChild(link);
    return linkContainer;
  }

  /**
   * Adds the Google Maps link above the map
   */
  function addMapsLink(mapContainer) {
    const query = getSearchQuery();
    if (!query) {
      console.log('No search query found');
      return;
    }

    // Find the most stable parent container
    let targetContainer = mapContainer;
    let current = mapContainer.parentElement;

    // Go up until we find a stable container
    while (current && current !== document.body) {
      // lu_map_section is the outer container that remains stable
      if (current.classList.contains('lu_map_section')) {
        targetContainer = current;
        break;
      }
      // Alternative stable container
      if (current.hasAttribute('data-hveid') && current.className.includes('ULSxyf')) {
        targetContainer = current;
        break;
      }
      current = current.parentElement;
    }

    // Check if a link already exists in this container
    const existingLink = targetContainer.querySelector('.gmaps-link-container');
    if (existingLink) {
      console.log('Link already present in this container');
      return;
    }

    // Mark the container to avoid duplicates
    if (targetContainer.hasAttribute('data-gmaps-link-added')) {
      return;
    }
    targetContainer.setAttribute('data-gmaps-link-added', 'true');

    const mapsUrl = createMapsLink(query);
    const linkElement = createLinkElement(mapsUrl);

    // Insert link before the first child of the stable container
    if (targetContainer.firstChild) {
      targetContainer.insertBefore(linkElement, targetContainer.firstChild);
    } else {
      targetContainer.appendChild(linkElement);
    }

    // Mark as processed
    processedMaps.add(mapContainer);

    console.log('Google Maps link added for:', query, 'in container:', targetContainer.className);
  }

  /**
   * Checks if a container is a real geographic map (not stock charts, etc.)
   */
  function isGeographicMap(container) {
    // Explicitly exclude financial/stock charts
    const excludeSelectors = [
      '[data-attrid*="stock"]',
      '[data-attrid*="finance"]',
      '[class*="finance"]',
      '[class*="stock"]',
      '[id*="knowledge-finance"]'
    ];

    // Check if the container or a parent is an excluded type
    for (const selector of excludeSelectors) {
      if (container.matches(selector) || container.closest(selector)) {
        console.log('DEBUG: Container is a financial chart, skipping');
        return false;
      }
    }

    // Positive indicators for geographic maps
    const geoIndicators = [
      // Specific location attributes
      () => container.querySelector('[data-attrid="kc:/location/location:map"]'),
      // Maps iframe
      () => container.querySelector('iframe[src*="maps.google"]'),
      // Local results with addresses
      () => container.closest('[data-attrid="kc:/location"]'),
      // Lu map section (local businesses)
      () => container.closest('.lu_map_section'),
      // Canvas with aria-label containing "map"
      () => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          const ariaLabel = canvas.getAttribute('aria-label') || '';
          return ariaLabel.toLowerCase().includes('map');
        }
        return false;
      }
    ];

    // If at least one positive indicator matches, it's probably a real map
    return geoIndicators.some(check => check());
  }

  /**
   * Searches for map containers on the page
   */
  function findMapContainers() {
    const foundContainers = new Set();

    // Method 1: Search for specific map attributes
    const selectors = [
      // Knowledge Panel with map (very specific for locations)
      '[data-attrid="kc:/location/location:map"]',
      // Local businesses/addresses
      '.lu_map_section',
      // Local results
      '[data-md]',
      // Known Maps container
      '[jsname="WZSFy"]',
    ];

    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        console.log(`DEBUG: Selector "${selector}" found ${elements.length} elements`);
        elements.forEach(el => {
          // Check if the element is visible
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 100) {
            console.log(`DEBUG: Found element:`, el.tagName, el.getAttribute('data-attrid'), `${rect.width}x${rect.height}`);
            foundContainers.add(el);
          }
        });
      } catch (e) {
        console.log(`DEBUG: Error with selector "${selector}":`, e);
      }
    });

    // Method 2: Search for Maps iframes
    const mapsIframes = document.querySelectorAll('iframe[src*="maps.google"]');
    console.log(`DEBUG: Maps iframes found: ${mapsIframes.length}`);
    mapsIframes.forEach(iframe => {
      const parent = iframe.closest('div[class*="map" i]');
      if (parent) {
        foundContainers.add(parent);
      }
    });

    // Filter and validate all found containers
    const validContainers = Array.from(foundContainers).filter(container => {
      const isValid = isGeographicMap(container);
      console.log(`DEBUG: Container ${container.className} is ${isValid ? 'valid' : 'invalid'} geographic map`);
      return isValid;
    });

    return validContainers;
  }

  /**
   * Processes all maps on the page
   */
  function processAllMaps() {
    // Debug: Show all iframes on the page
    const allIframes = document.querySelectorAll('iframe');
    console.log(`DEBUG: ${allIframes.length} iframes found on the page`);
    allIframes.forEach((iframe, index) => {
      console.log(`DEBUG: iframe ${index}: src="${iframe.src}"`);
    });

    const mapContainers = findMapContainers();

    if (mapContainers.length > 0) {
      console.log(`${mapContainers.length} map(s) found`);
      mapContainers.forEach(container => {
        addMapsLink(container);
      });
    } else {
      console.log('No map containers found');
    }
  }

  /**
   * Debounce function to avoid too frequent calls
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Initializes the extension
   */
  function init() {
    // Initial processing after loading
    processAllMaps();

    // Debounced version of processing
    const debouncedProcess = debounce(processAllMaps, 200);

    // MutationObserver for dynamically loaded content
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        // Check if new nodes were added
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }

        // Important: Also check if our link was removed
        if (mutation.removedNodes.length > 0) {
          for (const node of mutation.removedNodes) {
            if (node.classList && node.classList.contains('gmaps-link-container')) {
              console.log('Link was removed - adding it back');
              // Remove the data-attribute from parent so the link can be re-added
              if (mutation.target.hasAttribute('data-gmaps-link-added')) {
                mutation.target.removeAttribute('data-gmaps-link-added');
              }
              shouldProcess = true;
              break;
            }
          }
        }
      }

      if (shouldProcess) {
        debouncedProcess();
      }
    });

    // Start observer with extended options
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false // We only care about added/removed nodes
    });

    // Also process on URL changes (e.g., new searches)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        // Reset all data-attributes on URL change
        document.querySelectorAll('[data-gmaps-link-added]').forEach(el => {
          el.removeAttribute('data-gmaps-link-added');
        });
        processedMaps.clear();
        setTimeout(processAllMaps, 500);
      }
    }).observe(document.querySelector('head > title'), {
      subtree: true,
      characterData: true,
      childList: true
    });

    console.log('Maps Button for Google Search extension activated');
  }

  // Start extension when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
