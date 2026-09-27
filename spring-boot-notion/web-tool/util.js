/* ============================================================
   UTIL.JS — Table-Aware & Breadcrumb Navigation for Notion Exports
   Captures sibling links from tables and injects Back, Home,
   and Prev/Next navigation bars at top and bottom of cards.
   Injects dynamic breadcrumb navigation at top of every article.
   Supports multi-level nested tables & back-navigation state.
   ============================================================ */

(function () {
  'use strict';

  const NAV_STORAGE_KEY = 'notion_nav_links';
  const PARENT_STORAGE_KEY = 'notion_nav_parent';
  const ROOT_STORAGE_KEY = 'notion_nav_root';
  const NAV_MAP_STORAGE_KEY = 'notion_nav_map';
  const BREADCRUMB_MAP_STORAGE_KEY = 'notion_breadcrumb_map';

  // ────────────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────────────
  function normalizePath(urlStr) {
    if (!urlStr) return '';
    try {
      var u = new URL(urlStr, window.location.origin);
      return decodeURIComponent(u.pathname);
    } catch (e) {
      return decodeURIComponent(urlStr);
    }
  }

  // ────────────────────────────────────────────────────────────
  // 0. AUTO-DETECT ROOT PAGE
  // ────────────────────────────────────────────────────────────
  function detectRootPage() {
    var scripts = document.querySelectorAll('script[src*="util.js"]');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute('src');
      if (src === './web-tool/util.js' || src === 'web-tool/util.js' || src === './util.js' || src === 'util.js') {
        try {
          sessionStorage.setItem(ROOT_STORAGE_KEY, window.location.href);
        } catch (e) {}
        break;
      }
    }
  }
  detectRootPage();


  // ────────────────────────────────────────────────────────────
  // BREADCRUMB HELPER FUNCTIONS
  // ────────────────────────────────────────────────────────────

  function getCurrentPageTitle() {
    var titleEl = document.querySelector('.page-title');
    if (titleEl) {
      var text = titleEl.textContent.trim();
      if (text) return text;
    }
    if (document.title) {
      return document.title.replace(/\.html$/i, '').trim();
    }
    return 'Article';
  }

  function getRootInfo() {
    var rootUrl = null;
    try {
      rootUrl = sessionStorage.getItem(ROOT_STORAGE_KEY);
    } catch (e) {}

    if (!rootUrl) {
      var script = document.querySelector('script[src*="util.js"]');
      if (script) {
        var scriptSrc = script.getAttribute('src');
        var prefix = scriptSrc.replace(/web-tool\/util\.js$/, '').replace(/util\.js$/, '');
        rootUrl = prefix ? prefix + 'My%20Learning%20Space%203d034c0b29c980b5b5b2f826f2e83d20.html' : './';
      } else {
        rootUrl = './';
      }
    }

    return {
      title: 'Home',
      href: rootUrl
    };
  }

  function cleanTitleFromUrl(urlStr) {
    if (!urlStr) return '';
    var filename = urlStr.split('/').pop().split('?')[0];
    var decoded = decodeURIComponent(filename);
    decoded = decoded.replace(/\.html$/i, '');
    decoded = decoded.replace(/\s+[a-f0-9]{32}$/i, '');
    return decoded.trim() || 'Parent';
  }

  function getCurrentSiblingLinks() {
    var currentPathKey = normalizePath(window.location.href);
    try {
      var navMap = JSON.parse(sessionStorage.getItem(NAV_MAP_STORAGE_KEY) || '{}');
      if (navMap[currentPathKey] && Array.isArray(navMap[currentPathKey].links)) {
        return navMap[currentPathKey].links;
      }
    } catch (e) {}

    try {
      var raw = sessionStorage.getItem(NAV_STORAGE_KEY);
      if (raw) {
        var links = JSON.parse(raw);
        if (Array.isArray(links)) return links;
      }
    } catch (e) {}

    return null;
  }

  function isSiblingLink(currentPathKey, targetKey, siblingLinks) {
    if (!siblingLinks || !Array.isArray(siblingLinks) || siblingLinks.length === 0) return false;

    var hasCurrent = false;
    var hasTarget = false;

    for (var i = 0; i < siblingLinks.length; i++) {
      var key = normalizePath(siblingLinks[i].href);
      if (key === currentPathKey) hasCurrent = true;
      if (key === targetKey) hasTarget = true;
      if (hasCurrent && hasTarget) return true;
    }

    return false;
  }

  function buildTrailFromUrlPath(rootInfo, currentTitle) {
    var trail = [{ title: rootInfo.title, href: rootInfo.href }];
    var decodedPath = decodeURIComponent(window.location.pathname);

    var script = document.querySelector('script[src*="util.js"]');
    var scriptSrc = script ? script.getAttribute('src') : '';

    var match = scriptSrc.match(/\.\.\//g);
    var depth = match ? match.length : 0;

    var segments = decodedPath.split('/').filter(Boolean);
    if (segments.length > 1 && depth > 0) {
      var folderSegments = segments.slice(Math.max(0, segments.length - 1 - depth), segments.length - 1);
      var stepCount = folderSegments.length;

      folderSegments.forEach(function (folderName, idx) {
        var cleanName = folderName.replace(/\s+[a-f0-9]{32}$/i, '').trim();
        if (!cleanName || cleanName === 'web-tool') return;

        var upLevels = stepCount - idx;
        var relHref = '';
        for (var u = 0; u < upLevels; u++) {
          relHref += '../';
        }
        trail.push({
          title: cleanName,
          href: relHref
        });
      });
    }

    if (normalizePath(window.location.href) !== normalizePath(rootInfo.href)) {
      trail.push({
        title: currentTitle,
        href: window.location.href
      });
    }

    return trail;
  }

  function getCurrentBreadcrumbTrail() {
    var currentPathKey = normalizePath(window.location.href);
    var currentTitle = getCurrentPageTitle();
    var rootInfo = getRootInfo();

    // 1. Check explicit session breadcrumb trail
    try {
      var breadcrumbMap = JSON.parse(sessionStorage.getItem(BREADCRUMB_MAP_STORAGE_KEY) || '{}');
      if (breadcrumbMap[currentPathKey] && Array.isArray(breadcrumbMap[currentPathKey]) && breadcrumbMap[currentPathKey].length > 0) {
        var savedTrail = breadcrumbMap[currentPathKey].slice();
        savedTrail[savedTrail.length - 1].title = currentTitle;
        if (normalizePath(savedTrail[0].href) !== normalizePath(rootInfo.href)) {
          savedTrail.unshift({ title: rootInfo.title, href: rootInfo.href });
        }
        return savedTrail;
      }
    } catch (e) {}

    // 1b. Check if any table row sibling has a recorded breadcrumb trail
    try {
      var siblingLinks = getCurrentSiblingLinks();
      if (siblingLinks && Array.isArray(siblingLinks)) {
        var breadcrumbMap = JSON.parse(sessionStorage.getItem(BREADCRUMB_MAP_STORAGE_KEY) || '{}');
        for (var s = 0; s < siblingLinks.length; s++) {
          var sKey = normalizePath(siblingLinks[s].href);
          if (sKey !== currentPathKey && breadcrumbMap[sKey] && Array.isArray(breadcrumbMap[sKey]) && breadcrumbMap[sKey].length > 0) {
            var siblingTrail = breadcrumbMap[sKey].slice();
            siblingTrail[siblingTrail.length - 1] = { title: currentTitle, href: window.location.href };
            if (normalizePath(siblingTrail[0].href) !== normalizePath(rootInfo.href)) {
              siblingTrail.unshift({ title: rootInfo.title, href: rootInfo.href });
            }
            breadcrumbMap[currentPathKey] = siblingTrail;
            sessionStorage.setItem(BREADCRUMB_MAP_STORAGE_KEY, JSON.stringify(breadcrumbMap));
            return siblingTrail;
          }
        }
      }
    } catch (e) {}

    // 2. Check navMap parent graph recursion
    try {
      var navMap = JSON.parse(sessionStorage.getItem(NAV_MAP_STORAGE_KEY) || '{}');
      var chain = [{ title: currentTitle, href: window.location.href }];
      var currKey = currentPathKey;
      var visited = {};
      visited[currKey] = true;

      while (navMap[currKey] && navMap[currKey].parentUrl) {
        var pUrl = navMap[currKey].parentUrl;
        var pKey = normalizePath(pUrl);
        if (!pKey || visited[pKey]) break;

        visited[pKey] = true;
        var pTitle = navMap[currKey].parentTitle || (navMap[pKey] && navMap[pKey].title) || cleanTitleFromUrl(pUrl);
        chain.unshift({ title: pTitle, href: pUrl });
        currKey = pKey;

        if (pKey === normalizePath(rootInfo.href)) break;
      }

      if (normalizePath(chain[0].href) !== normalizePath(rootInfo.href)) {
        chain.unshift({ title: rootInfo.title, href: rootInfo.href });
      }

      if (chain.length > 1) {
        return chain;
      }
    } catch (e) {}

    // 3. Fallback: Parse URL directory path structure
    return buildTrailFromUrlPath(rootInfo, currentTitle);
  }

  function indexPageLinks() {
    var currentUrl = window.location.href;
    var currentTitle = getCurrentPageTitle();

    var links = document.querySelectorAll('article.page a[href]');
    try {
      var navMap = JSON.parse(sessionStorage.getItem(NAV_MAP_STORAGE_KEY) || '{}');
      var updated = false;

      links.forEach(function (a) {
        var href = a.href;
        if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

        var key = normalizePath(href);
        if (!key) return;

        if (!navMap[key]) {
          navMap[key] = {
            parentUrl: currentUrl,
            parentTitle: currentTitle,
            title: a.textContent.trim()
          };
          updated = true;
        }
      });

      if (updated) {
        sessionStorage.setItem(NAV_MAP_STORAGE_KEY, JSON.stringify(navMap));
      }
    } catch (e) {}
  }

  function buildBreadcrumbDOM(trail) {
    var nav = document.createElement('nav');
    nav.className = 'util-breadcrumb';
    nav.setAttribute('aria-label', 'Breadcrumb');

    var ol = document.createElement('ol');
    ol.className = 'util-breadcrumb-list';

    trail.forEach(function (item, index) {
      var isLast = (index === trail.length - 1);
      var isFirst = (index === 0);

      var li = document.createElement('li');
      li.className = 'util-breadcrumb-item';

      if (isLast) {
        li.className += ' util-breadcrumb-current';
        li.setAttribute('aria-current', 'page');

        var span = document.createElement('span');
        span.textContent = item.title;
        li.appendChild(span);
      } else {
        var a = document.createElement('a');
        a.className = 'util-breadcrumb-link' + (isFirst ? ' util-breadcrumb-home' : '');
        a.href = item.href;
        a.title = item.title;

        if (isFirst) {
          a.innerHTML =
            '<svg class="util-breadcrumb-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
              '<polyline points="9 22 9 12 15 12 15 22"/>' +
            '</svg>' +
            '<span>' + (item.title || 'Home') + '</span>';
        } else {
          a.textContent = item.title;
        }

        li.appendChild(a);
      }

      ol.appendChild(li);

      if (!isLast) {
        var sep = document.createElement('li');
        sep.className = 'util-breadcrumb-separator';
        sep.setAttribute('aria-hidden', 'true');
        sep.innerHTML =
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="9 18 15 12 9 6"/>' +
          '</svg>';
        ol.appendChild(sep);
      }
    });

    nav.appendChild(ol);
    return nav;
  }

  function injectBreadcrumb() {
    if (window.location.pathname.endsWith('combined.html')) return;
    var article = document.querySelector('article.page');
    if (!article) return;

    if (article.querySelector('.util-breadcrumb')) return;

    var trail = getCurrentBreadcrumbTrail();
    if (!trail || trail.length === 0) return;

    var breadcrumbDOM = buildBreadcrumbDOM(trail);

    var topNav = article.querySelector('.util-nav-bar');
    var header = article.querySelector('header');

    if (topNav) {
      article.insertBefore(breadcrumbDOM, topNav.nextSibling);
    } else if (header) {
      article.insertBefore(breadcrumbDOM, header);
    } else {
      article.insertBefore(breadcrumbDOM, article.firstChild);
    }
  }


  // ────────────────────────────────────────────────────────────
  // 1. CAPTURE LINKS ON CLICK
  // ────────────────────────────────────────────────────────────

  document.addEventListener('click', function (e) {
    var anchor = e.target.closest('a');
    if (!anchor || !anchor.href) return;

    // A. Table navigation capture
    var row = anchor.closest('tr');
    if (row) {
      var table = row.closest('table');
      if (table) {
        var tbody = table.querySelector('tbody');
        if (tbody) {
          var rows = tbody.querySelectorAll('tr');
          var links = [];

          rows.forEach(function (tr) {
            var a = tr.querySelector('a');
            if (a) {
              links.push({
                href: a.href,
                text: a.textContent.trim()
              });
            }
          });

          if (links.length > 0) {
            var currentParentUrl = window.location.href;

            try {
              sessionStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(links));
              sessionStorage.setItem(PARENT_STORAGE_KEY, currentParentUrl);

              var navMap = JSON.parse(sessionStorage.getItem(NAV_MAP_STORAGE_KEY) || '{}');
              var navData = {
                links: links,
                parentUrl: currentParentUrl
              };

              links.forEach(function (l) {
                var key = normalizePath(l.href);
                if (key) {
                  navMap[key] = navData;
                }
              });

              sessionStorage.setItem(NAV_MAP_STORAGE_KEY, JSON.stringify(navMap));
            } catch (err) {}
          }
        }
      }
    }

    // B. Save Breadcrumb trail history for target URL
    try {
      var targetUrl = anchor.href;
      var targetKey = normalizePath(targetUrl);
      var currentPathKey = normalizePath(window.location.href);

      if (targetKey && !targetUrl.startsWith('javascript:') && !targetUrl.startsWith('#')) {
        var currentTrail = getCurrentBreadcrumbTrail();
        var targetTitle = anchor.textContent.trim() || 'Article';

        var existingIndex = -1;
        for (var i = 0; i < currentTrail.length; i++) {
          if (normalizePath(currentTrail[i].href) === targetKey) {
            existingIndex = i;
            break;
          }
        }

        var siblingLinks = getCurrentSiblingLinks();
        var areSiblings = isSiblingLink(currentPathKey, targetKey, siblingLinks);

        var newTrail;
        if (existingIndex !== -1) {
          // Navigating back up to a page already in the trail
          newTrail = currentTrail.slice(0, existingIndex + 1);
        } else if (areSiblings && currentTrail.length > 1) {
          // Navigating between table row siblings (e.g. Prev/Next buttons):
          // Replace the current TR (last item) with the new target TR!
          newTrail = currentTrail.slice(0, currentTrail.length - 1).concat([{ title: targetTitle, href: targetUrl }]);
        } else {
          // Standard child page navigation: append target page to trail
          newTrail = currentTrail.concat([{ title: targetTitle, href: targetUrl }]);
        }

        var breadcrumbMap = JSON.parse(sessionStorage.getItem(BREADCRUMB_MAP_STORAGE_KEY) || '{}');
        breadcrumbMap[targetKey] = newTrail;
        sessionStorage.setItem(BREADCRUMB_MAP_STORAGE_KEY, JSON.stringify(breadcrumbMap));
      }
    } catch (err) {}
  });


  function getCombinedUrl() {
    var script = document.querySelector('script[src*="util.js"]');
    if (script) {
      var scriptSrc = script.getAttribute('src');
      var prefix = scriptSrc.replace(/util\.js$/, '');
      return prefix + 'combined.html';
    }
    return 'web-tool/combined.html';
  }

  function isHomePage(rootUrl) {
    if (window.location.pathname.endsWith('combined.html')) return false;

    var currentPathKey = normalizePath(window.location.href);
    var rootPathKey = normalizePath(rootUrl);

    if (currentPathKey && rootPathKey && currentPathKey === rootPathKey) return true;

    var script = document.querySelector('script[src*="util.js"]');
    if (script) {
      var scriptSrc = script.getAttribute('src');
      if (scriptSrc === 'web-tool/util.js' || scriptSrc === './web-tool/util.js') {
        return true;
      }
    }

    return false;
  }


  // ────────────────────────────────────────────────────────────
  // 2. INJECT NAVIGATION BARS & BREADCRUMBS ON ARTICLE PAGES
  // ────────────────────────────────────────────────────────────

  function injectNavigation() {
    if (window.location.pathname.endsWith('combined.html')) return;
    var article = document.querySelector('article.page');
    if (!article) return;

    // Inject CSS styles, index links, and inject breadcrumb on every article
    injectStyles();
    indexPageLinks();
    injectBreadcrumb();

    var rootUrl = null;
    try {
      rootUrl = sessionStorage.getItem(ROOT_STORAGE_KEY);
    } catch (e) {}

    if (!rootUrl) {
      var script = document.querySelector('script[src*="util.js"]');
      if (script) {
        var scriptSrc = script.getAttribute('src');
        var prefix = scriptSrc.replace(/web-tool\/util\.js$/, '').replace(/util\.js$/, '');
        rootUrl = prefix ? prefix + 'My%20Learning%20Space%203d034c0b29c980b5b5b2f826f2e83d20.html' : './';
      } else {
        rootUrl = './';
      }
    }

    var isHome = isHomePage(rootUrl);
    var currentPathKey = normalizePath(window.location.href);

    // Determine parent URL for Back button
    var parentUrl = null;
    try {
      var navMap = JSON.parse(sessionStorage.getItem(NAV_MAP_STORAGE_KEY) || '{}');
      if (navMap[currentPathKey] && navMap[currentPathKey].parentUrl) {
        parentUrl = navMap[currentPathKey].parentUrl;
      }
    } catch (e) {}

    if (!parentUrl) {
      try {
        parentUrl = sessionStorage.getItem(PARENT_STORAGE_KEY);
      } catch (e) {}
    }

    if (!parentUrl) {
      var trail = getCurrentBreadcrumbTrail();
      if (trail && trail.length >= 2) {
        parentUrl = trail[trail.length - 2].href;
      }
    }

    if (!parentUrl) {
      parentUrl = document.referrer || rootUrl;
    }

    // Determine table sibling links if available
    var links = null;
    try {
      var navMap = JSON.parse(sessionStorage.getItem(NAV_MAP_STORAGE_KEY) || '{}');
      if (navMap[currentPathKey] && Array.isArray(navMap[currentPathKey].links)) {
        links = navMap[currentPathKey].links;
        if (navMap[currentPathKey].parentUrl) {
          parentUrl = navMap[currentPathKey].parentUrl;
        }
      } else {
        for (var k in navMap) {
          var entry = navMap[k];
          if (entry && Array.isArray(entry.links)) {
            for (var j = 0; j < entry.links.length; j++) {
              if (normalizePath(entry.links[j].href) === currentPathKey) {
                links = entry.links;
                if (entry.parentUrl) parentUrl = entry.parentUrl;
                break;
              }
            }
          }
          if (links) break;
        }
      }
    } catch (e) {}

    if (!links) {
      try {
        var raw = sessionStorage.getItem(NAV_STORAGE_KEY);
        if (raw) links = JSON.parse(raw);
      } catch (e) {}
    }

    var currentIndex = -1;
    if (links && Array.isArray(links)) {
      for (var i = 0; i < links.length; i++) {
        if (normalizePath(links[i].href) === currentPathKey) {
          currentIndex = i;
          break;
        }
      }
    }

    var prevLink = (links && currentIndex > 0) ? links[currentIndex - 1] : null;
    var nextLink = (links && currentIndex >= 0 && currentIndex < links.length - 1) ? links[currentIndex + 1] : null;
    var totalCount = (links && currentIndex >= 0) ? links.length : 0;

    // Inject top navigation bar on article pages (including Home with Search option)
    if (!article.querySelector('.util-nav-bar')) {
      var topNav = buildNavBar(prevLink, nextLink, parentUrl, rootUrl, currentIndex, totalCount, isHome);
      article.insertBefore(topNav, article.firstChild);

      if (!isHome && totalCount > 0) {
        var bottomNav = buildNavBar(prevLink, nextLink, parentUrl, rootUrl, currentIndex, totalCount, isHome);
        article.appendChild(bottomNav);
      }

      var breadcrumbEl = article.querySelector('.util-breadcrumb');
      if (breadcrumbEl && topNav) {
        article.insertBefore(breadcrumbEl, topNav.nextSibling);
      }
    }
  }


  // ────────────────────────────────────────────────────────────
  // 3. BUILD NAV BAR DOM
  // ────────────────────────────────────────────────────────────

  function buildNavBar(prevLink, nextLink, parentUrl, rootUrl, currentIndex, totalCount, isHome) {
    var nav = document.createElement('nav');
    nav.className = 'util-nav-bar';

    var leftGroup = document.createElement('div');
    leftGroup.className = 'util-nav-left';

    // Back Button (shown on all article pages EXCEPT home)
    if (!isHome) {
      var backBtn = document.createElement('a');
      backBtn.className = 'util-nav-btn util-nav-back';
      backBtn.href = parentUrl || rootUrl;
      backBtn.title = 'Back to parent page';
      backBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="19" y1="12" x2="5" y2="12"/>' +
          '<polyline points="12 19 5 12 12 5"/>' +
        '</svg>' +
        '<span>Back</span>';
      leftGroup.appendChild(backBtn);
    }

    // Home Button
    var homeBtn = document.createElement('a');
    homeBtn.className = 'util-nav-icon-btn util-nav-home';
    homeBtn.href = rootUrl;
    homeBtn.title = 'Go to Home';
    homeBtn.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
        '<polyline points="9 22 9 12 15 12 15 22"/>' +
      '</svg>';
    leftGroup.appendChild(homeBtn);

    // Search Option Button (Opens combined.html in a new tab) - ONLY on Home page
    if (isHome) {
      var searchBtn = document.createElement('a');
      searchBtn.className = 'util-nav-search-btn';
      searchBtn.href = getCombinedUrl();
      searchBtn.target = '_blank';
      searchBtn.rel = 'noopener';
      searchBtn.title = 'Search all articles in Combined View (Cmd+K)';
      searchBtn.innerHTML =
        '<div style="display:inline-flex;align-items:center;gap:0.4rem;">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="11" cy="11" r="8"/>' +
            '<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
          '</svg>' +
          '<span>Search Knowledge Base...</span>' +
        '</div>' +
        '<kbd>⌘K</kbd>';
      leftGroup.appendChild(searchBtn);
    }

    // Counter badge (if table sibling links exist)
    if (totalCount > 0 && currentIndex >= 0) {
      var badge = document.createElement('span');
      badge.className = 'util-nav-badge';
      badge.textContent = (currentIndex + 1) + ' / ' + totalCount;
      leftGroup.appendChild(badge);
    }

    nav.appendChild(leftGroup);

    // Right side: Prev & Next buttons (if table sibling links exist)
    if (prevLink || nextLink) {
      var rightGroup = document.createElement('div');
      rightGroup.className = 'util-nav-right';

      var prevBtn = document.createElement('a');
      prevBtn.className = 'util-nav-btn util-nav-prev' + (prevLink ? '' : ' disabled');
      if (prevLink) {
        prevBtn.href = prevLink.href;
        prevBtn.title = prevLink.text;
      }
      prevBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="15 18 9 12 15 6"/>' +
        '</svg>' +
        '<span>Prev</span>';

      var nextBtn = document.createElement('a');
      nextBtn.className = 'util-nav-btn util-nav-next' + (nextLink ? '' : ' disabled');
      if (nextLink) {
        nextBtn.href = nextLink.href;
        nextBtn.title = nextLink.text;
      }
      nextBtn.innerHTML =
        '<span>Next</span>' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
          '<polyline points="9 18 15 12 9 6"/>' +
        '</svg>';

      rightGroup.appendChild(prevBtn);
      rightGroup.appendChild(nextBtn);
      nav.appendChild(rightGroup);
    }

    return nav;
  }


  // ────────────────────────────────────────────────────────────
  // 4. INJECT STYLES
  // ────────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('util-nav-styles')) return;

    var script = document.querySelector('script[src*="util.js"]');
    var prefix = script ? script.getAttribute('src').replace(/util\.js$/, '') : './';
    var bgUrl = prefix + 'imgs/bg.png';

    var style = document.createElement('style');
    style.id = 'util-nav-styles';
    style.textContent = 'body { background-image: url("' + bgUrl + '") !important; background-repeat: no-repeat !important; background-size: cover !important; background-attachment: fixed !important; background-position: center !important; }\n' +
      '/* ── Util Nav Bar ── */\n' +
      '.util-nav-bar {\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  justify-content: space-between;\n' +
      '  padding: 0.6rem 0;\n' +
      '  margin-bottom: 1.25rem;\n' +
      '  border-bottom: 1px solid var(--border-light, #E5E7EB);\n' +
      '  animation: utilNavSlideIn 0.35s ease-out both;\n' +
      '}\n' +
      '\n' +
      '/* Bottom nav bar — border on top instead */\n' +
      'article.page > .util-nav-bar:last-child {\n' +
      '  border-bottom: none;\n' +
      '  border-top: 1px solid var(--border-light, #E5E7EB);\n' +
      '  margin-bottom: 0;\n' +
      '  margin-top: 1.25rem;\n' +
      '  padding-top: 0.75rem;\n' +
      '}\n' +
      '\n' +
      '.util-nav-left {\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  gap: 0.5rem;\n' +
      '}\n' +
      '\n' +
      '.util-nav-right {\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  gap: 0.5rem;\n' +
      '}\n' +
      '\n' +
      '/* Shared Icon Buttons (Back & Home) */\n' +
      '.util-nav-icon-btn {\n' +
      '  display: inline-flex;\n' +
      '  align-items: center;\n' +
      '  justify-content: center;\n' +
      '  width: 34px;\n' +
      '  height: 34px;\n' +
      '  border-radius: 8px;\n' +
      '  background: var(--bg-tertiary, #F6F8FA);\n' +
      '  border: 1px solid var(--border-light, #E5E7EB) !important;\n' +
      '  color: var(--text-secondary, #4A5568) !important;\n' +
      '  text-decoration: none !important;\n' +
      '  transition: all 150ms ease;\n' +
      '  cursor: pointer;\n' +
      '}\n' +
      '\n' +
      '.util-nav-icon-btn:hover:not(.disabled) {\n' +
      '  background: var(--accent-primary, #3B82F6) !important;\n' +
      '  color: #fff !important;\n' +
      '  border-color: var(--accent-primary, #3B82F6) !important;\n' +
      '  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);\n' +
      '  transform: translateY(-1px);\n' +
      '}\n' +
      '\n' +
      '.util-nav-icon-btn.disabled {\n' +
      '  opacity: 0.35;\n' +
      '  cursor: default;\n' +
      '  pointer-events: none;\n' +
      '}\n' +
      '\n' +
      '/* Counter badge */\n' +
      '.util-nav-badge {\n' +
      '  font-size: 0.75rem;\n' +
      '  font-weight: 600;\n' +
      '  color: var(--text-tertiary, #718096);\n' +
      '  background: var(--bg-tertiary, #F6F8FA);\n' +
      '  padding: 0.2em 0.65em;\n' +
      '  border-radius: 20px;\n' +
      '  border: 1px solid var(--border-light, #E5E7EB);\n' +
      '  letter-spacing: 0.02em;\n' +
      '  margin-left: 0.25rem;\n' +
      '  white-space: nowrap;\n' +
      '}\n' +
      '\n' +
      '/* Prev / Next buttons */\n' +
      '.util-nav-btn {\n' +
      '  display: inline-flex;\n' +
      '  align-items: center;\n' +
      '  gap: 0.3rem;\n' +
      '  padding: 0.4rem 0.85rem;\n' +
      '  font-size: 0.8rem;\n' +
      '  font-weight: 600;\n' +
      '  font-family: \'Inter\', -apple-system, BlinkMacSystemFont, sans-serif;\n' +
      '  color: var(--text-secondary, #4A5568) !important;\n' +
      '  background: var(--bg-tertiary, #F6F8FA);\n' +
      '  border: 1px solid var(--border-light, #E5E7EB) !important;\n' +
      '  border-radius: 8px;\n' +
      '  text-decoration: none !important;\n' +
      '  cursor: pointer;\n' +
      '  transition: all 150ms ease;\n' +
      '  user-select: none;\n' +
      '}\n' +
      '\n' +
      '.util-nav-btn:hover:not(.disabled) {\n' +
      '  background: var(--accent-primary, #3B82F6) !important;\n' +
      '  color: #fff !important;\n' +
      '  border-color: var(--accent-primary, #3B82F6) !important;\n' +
      '  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);\n' +
      '  transform: translateY(-1px);\n' +
      '}\n' +
      '\n' +
      '.util-nav-btn.disabled {\n' +
      '  opacity: 0.35;\n' +
      '  cursor: default;\n' +
      '  pointer-events: none;\n' +
      '}\n' +
      '\n' +
      '/* ── Breadcrumb Navigation ── */\n' +
      '.util-breadcrumb {\n' +
      '  display: flex;\n' +
      '  align-items: center;\n' +
      '  margin-bottom: 1.25rem;\n' +
      '  padding: 0.55rem 0.9rem;\n' +
      '  background: var(--bg-tertiary, #F6F8FA);\n' +
      '  border: 1px solid var(--border-light, #E5E7EB);\n' +
      '  border-radius: var(--radius-md, 8px);\n' +
      '  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);\n' +
      '  font-family: \'Inter\', -apple-system, BlinkMacSystemFont, sans-serif;\n' +
      '  font-size: 0.825rem;\n' +
      '  line-height: 1.4;\n' +
      '  overflow-x: auto;\n' +
      '  white-space: nowrap;\n' +
      '  animation: utilNavSlideIn 0.35s ease-out both;\n' +
      '}\n' +
      '.util-breadcrumb::-webkit-scrollbar { height: 3px; }\n' +
      '.util-breadcrumb::-webkit-scrollbar-thumb { background: var(--border-medium, #D1D5DB); border-radius: 3px; }\n' +
      '.util-breadcrumb-list { display: flex; align-items: center; flex-wrap: nowrap; list-style: none !important; margin: 0 !important; padding: 0 !important; gap: 0.25rem; }\n' +
      '.util-breadcrumb-item { display: inline-flex; align-items: center; margin: 0 !important; padding: 0 !important; }\n' +
      '.util-breadcrumb-link { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--text-secondary, #4A5568) !important; font-weight: 500; text-decoration: none !important; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm, 6px); transition: all 150ms ease; border: 1px solid transparent; }\n' +
      '.util-breadcrumb-link:hover { color: var(--accent-primary, #3B82F6) !important; background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.2); transform: translateY(-1px); }\n' +
      '.util-breadcrumb-icon { flex-shrink: 0; stroke: currentColor; }\n' +
      '.util-breadcrumb-separator { display: inline-flex; align-items: center; justify-content: center; color: var(--text-muted, #A0AEC0); padding: 0 0.15rem; user-select: none; opacity: 0.7; }\n' +
      '.util-breadcrumb-current { display: inline-flex; align-items: center; color: var(--text-primary, #111827); font-weight: 600; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm, 6px); background: rgba(0, 0, 0, 0.04); border: 1px solid var(--border-light, #E5E7EB); }\n' +
      '\n' +
      '/* Entry animation */\n' +
      '@keyframes utilNavSlideIn {\n' +
      '  from { opacity: 0; transform: translateY(-6px); }\n' +
      '  to   { opacity: 1; transform: translateY(0); }\n' +
      '}\n' +
      '\n' +
      '/* Responsive */\n' +
      '@media (max-width: 480px) {\n' +
      '  .util-nav-btn span {\n' +
      '    display: none;\n' +
      '  }\n' +
      '  .util-nav-btn {\n' +
      '    padding: 0.4rem 0.55rem;\n' +
      '  }\n' +
      '  .util-nav-badge {\n' +
      '    font-size: 0.65rem;\n' +
      '  }\n' +
      '}\n' +
      '\n' +
      '/* ── Pre & Code Block Overflow Scroll ── */\n' +
      'pre, .code, pre.code, .code-wrap { overflow: auto !important; overflow-x: auto !important; max-width: 100% !important; white-space: pre !important; word-break: normal !important; word-wrap: normal !important; overflow-wrap: normal !important; }\n' +
      'pre code, .code > code, .code-wrap > code { white-space: pre !important; word-break: normal !important; word-wrap: normal !important; overflow-wrap: normal !important; }\n' +
      'pre::-webkit-scrollbar, .code::-webkit-scrollbar { height: 6px; width: 6px; }\n' +
      'pre::-webkit-scrollbar-thumb, .code::-webkit-scrollbar-thumb { background: var(--border-medium, #D1D5DB); border-radius: 4px; }\n' +
      'pre::-webkit-scrollbar-track, .code::-webkit-scrollbar-track { background: var(--bg-tertiary, #F6F8FA); }\n' +
      '\n' +
      '/* ── Table Overflow Scroll ── */\n' +
      '.table-wrapper, figure.table, .collection-content { width: 100% !important; max-width: 100% !important; overflow-x: auto !important; margin: 1em 0 !important; border-radius: var(--radius-md, 8px) !important; -webkit-overflow-scrolling: touch; }\n' +
      '.table-wrapper::-webkit-scrollbar, figure.table::-webkit-scrollbar, .collection-content::-webkit-scrollbar, table::-webkit-scrollbar { height: 6px; width: 6px; }\n' +
      '.table-wrapper::-webkit-scrollbar-thumb, figure.table::-webkit-scrollbar-thumb, .collection-content::-webkit-scrollbar-thumb, table::-webkit-scrollbar-thumb { background: var(--border-medium, #D1D5DB); border-radius: 4px; }\n' +
      '.table-wrapper::-webkit-scrollbar-track, figure.table::-webkit-scrollbar-track, .collection-content::-webkit-scrollbar-track, table::-webkit-scrollbar-track { background: var(--bg-tertiary, #F6F8FA); }\n' +
      'table { width: 100% !important; min-width: 100%; border-collapse: separate !important; border-spacing: 0 !important; margin: 0 !important; }\n' +
      '\n' +
      '/* Print: hide nav & breadcrumb */\n' +
      '@media print {\n' +
      '  .util-nav-bar, .util-breadcrumb, .article-bookmark-wrapper { display: none !important; }\n' +
      '}\n' +
      '/* Bookmark Icon & Dropdown Styles */\n' +
      '.article-bookmark-wrapper { position: relative; display: inline-flex; align-items: center; margin-left: 0.6rem; vertical-align: middle; }\n' +
      '.article-bookmark-btn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; background: var(--bg-tertiary, #F6F8FA); border: 1px solid var(--border-light, #E5E7EB); color: var(--accent-primary, #3B82F6); cursor: pointer; transition: all 180ms ease; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }\n' +
      '.article-bookmark-btn:hover, .article-bookmark-btn.active { background: var(--accent-primary, #3B82F6); color: #FFFFFF; border-color: var(--accent-primary, #3B82F6); box-shadow: 0 3px 10px rgba(59,130,246,0.3); transform: translateY(-1px); }\n' +
      '.article-bookmark-dropdown { position: absolute; top: calc(100% + 6px); left: 0; z-index: 1000; min-width: 220px; max-width: 340px; background: var(--bg-secondary, #FFFFFF); border: 1px solid var(--border-medium, #D1D5DB); border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15); padding: 0.5rem; display: none; opacity: 0; transform: translateY(-6px); transition: opacity 150ms ease, transform 150ms ease; }\n' +
      '.article-bookmark-dropdown.show { display: block; opacity: 1; transform: translateY(0); }\n' +
      '.article-bookmark-dropdown-header { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-tertiary, #718096); padding: 0.35rem 0.6rem 0.4rem; border-bottom: 1px solid var(--border-light, #E5E7EB); margin-bottom: 0.35rem; }\n' +
      '.article-bookmark-item { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.65rem; font-size: 0.85rem; font-weight: 500; color: var(--text-primary, #111827); background: transparent; border: none; border-radius: 6px; cursor: pointer; text-align: left; transition: background 150ms ease, color 150ms ease; word-break: break-word; }\n' +
      '.article-bookmark-item:hover { background: var(--bg-tertiary, #F3F4F6); color: var(--accent-primary, #3B82F6); }\n' +
      '@keyframes collectionFlash { 0% { outline: 3px solid rgba(59,130,246,0.8); box-shadow: 0 0 15px rgba(59,130,246,0.4); } 100% { outline: 3px solid transparent; box-shadow: none; } }\n' +
      '.collection-highlight-flash { animation: collectionFlash 1.5s ease-out forwards; border-radius: 8px; }\n';

    document.head.appendChild(style);
  }

  function wrapTables() {
    var tables = document.querySelectorAll('article.page table');
    tables.forEach(function (table) {
      var parent = table.parentElement;
      if (parent && (parent.classList.contains('table-wrapper') || parent.classList.contains('collection-content') || parent.tagName === 'FIGURE')) return;
      var wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      parent.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }


  function setupCombinedSearch() {
    var isCombinedPage = window.location.pathname.endsWith('combined.html');
    if (!isCombinedPage) return;

    var container = document.querySelector('.combined-toc');
    if (!container || document.getElementById('combined-search-input')) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'combined-search-wrapper';
    wrapper.style.cssText = 'margin-bottom: 1.25rem;';

    wrapper.innerHTML =
      '<div style="position:relative; display:flex; align-items:center;">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute; left:12px; color:var(--text-tertiary, #718096); pointer-events:none;">' +
          '<circle cx="11" cy="11" r="8"/>' +
          '<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
        '</svg>' +
        '<input type="text" id="combined-search-input" placeholder="⚡ Type to search all articles in real-time..." autofocus style="width:100%; padding:0.65rem 1rem 0.65rem 2.4rem; font-size:0.95rem; font-family:inherit; border-radius:8px; border:1px solid var(--border-medium, #D1D5DB); background:var(--bg-secondary, #fff); color:var(--text-primary, #111827); box-shadow:0 1px 3px rgba(0,0,0,0.04); outline:none;">' +
      '</div>';

    container.parentNode.insertBefore(wrapper, container);

    var searchInput = document.getElementById('combined-search-input');
    if (searchInput) {
      searchInput.focus();

      searchInput.addEventListener('input', function () {
        var query = searchInput.value.toLowerCase().trim();
        var sections = document.querySelectorAll('.combined-section');
        var tocItems = document.querySelectorAll('.combined-toc-item');

        sections.forEach(function (sec, idx) {
          var text = sec.textContent.toLowerCase();
          var matches = !query || text.indexOf(query) !== -1;
          sec.style.display = matches ? '' : 'none';
          if (tocItems[idx]) {
            tocItems[idx].style.display = matches ? '' : 'none';
          }
        });
      });
    }
  }


  // ────────────────────────────────────────────────────────────
  // 5. KEYBOARD SHORTCUTS (← / → / Cmd+K)
  // ────────────────────────────────────────────────────────────

  function setupKeyboardNav() {
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.open(getCombinedUrl(), '_blank');
        return;
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      var nav = document.querySelector('.util-nav-bar');
      if (!nav) return;

      if (e.key === 'ArrowLeft') {
        var prev = nav.querySelector('.util-nav-prev:not(.disabled)');
        if (prev) window.location.href = prev.href;
      } else if (e.key === 'ArrowRight') {
        var next = nav.querySelector('.util-nav-next:not(.disabled)');
        if (next) window.location.href = next.href;
      }
    });
  }


  // ────────────────────────────────────────────────────────────
  // 6. COLLECTION CONTENT BOOKMARK DROPDOWN
  // ────────────────────────────────────────────────────────────

  function setupCollectionBookmarks() {
    var articles = document.querySelectorAll('article.page, .combined-section');
    if (!articles || articles.length === 0) return;

    articles.forEach(function (article) {
      var rawCollections = article.querySelectorAll('div.collection-content');
      if (!rawCollections || rawCollections.length === 0) {
        rawCollections = article.querySelectorAll('.collection-content-wrapper, table.collection-content');
      }

      if (!rawCollections || rawCollections.length === 0) return;

      var collectionBlocks = [];
      rawCollections.forEach(function (el) {
        var container = (el.classList.contains('collection-content') && el.tagName === 'DIV')
          ? el
          : (el.closest('div.collection-content') || el.closest('.collection-content-wrapper') || el);
        if (container && collectionBlocks.indexOf(container) === -1) {
          collectionBlocks.push(container);
        }
      });

      if (collectionBlocks.length === 0) return;

      var titleEl = article.querySelector('.page-title, .combined-section-title');
      if (!titleEl || titleEl.querySelector('.article-bookmark-wrapper')) return;

      var wrapper = document.createElement('span');
      wrapper.className = 'article-bookmark-wrapper';

      var btn = document.createElement('button');
      btn.className = 'article-bookmark-btn';
      btn.type = 'button';
      btn.title = 'View collection tables in this article (' + collectionBlocks.length + ')';
      btn.setAttribute('aria-label', 'View collection tables');
      btn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>' +
        '</svg>';

      var dropdown = document.createElement('div');
      dropdown.className = 'article-bookmark-dropdown';

      var header = document.createElement('div');
      header.className = 'article-bookmark-dropdown-header';
      header.textContent = 'Collections (' + collectionBlocks.length + ')';
      dropdown.appendChild(header);

      collectionBlocks.forEach(function (block, idx) {
        var titleNode = block.querySelector('.collection-title, h4, h3, caption');
        var tableName = '';
        if (titleNode && titleNode.textContent.trim()) {
          tableName = titleNode.textContent.trim();
        } else {
          tableName = 'Collection Table ' + (idx + 1);
        }

        var item = document.createElement('button');
        item.className = 'article-bookmark-item';
        item.type = 'button';
        item.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' +
            '<line x1="3" y1="9" x2="21" y2="9"/>' +
            '<line x1="9" y1="21" x2="9" y2="9"/>' +
          '</svg>' +
          '<span>' + escapeHtmlStr(tableName) + '</span>';

        item.addEventListener('click', function (e) {
          e.stopPropagation();
          dropdown.classList.remove('show');
          btn.classList.remove('active');

          block.scrollIntoView({ behavior: 'smooth', block: 'start' });

          block.classList.remove('collection-highlight-flash');
          void block.offsetWidth;
          block.classList.add('collection-highlight-flash');
        });

        dropdown.appendChild(item);
      });

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = dropdown.classList.contains('show');

        document.querySelectorAll('.article-bookmark-dropdown.show').forEach(function (d) {
          d.classList.remove('show');
        });
        document.querySelectorAll('.article-bookmark-btn.active').forEach(function (b) {
          b.classList.remove('active');
        });

        if (!isOpen) {
          dropdown.classList.add('show');
          btn.classList.add('active');
        }
      });

      wrapper.appendChild(btn);
      wrapper.appendChild(dropdown);
      titleEl.appendChild(wrapper);
    });

    if (!window._bookmarkClickListenerAdded) {
      window._bookmarkClickListenerAdded = true;
      document.addEventListener('click', function () {
        document.querySelectorAll('.article-bookmark-dropdown.show').forEach(function (d) {
          d.classList.remove('show');
        });
        document.querySelectorAll('.article-bookmark-btn.active').forEach(function (b) {
          b.classList.remove('active');
        });
      });
    }
  }

  function escapeHtmlStr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }


  // ────────────────────────────────────────────────────────────
  // INIT
  // ────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      wrapTables();
      injectNavigation();
      setupKeyboardNav();
      setupCombinedSearch();
      setupCollectionBookmarks();
    });
  } else {
    wrapTables();
    injectNavigation();
    setupKeyboardNav();
    setupCombinedSearch();
    setupCollectionBookmarks();
  }

})();
