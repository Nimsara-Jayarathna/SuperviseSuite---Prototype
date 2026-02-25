(function () {
  var listeners = [];

  function normalizePath(path) {
    var clean = String(path || "/").trim();
    if (!clean) {
      return "/";
    }
    if (clean.startsWith("#/")) {
      clean = clean.slice(1);
    }
    if (!clean.startsWith("/")) {
      clean = "/" + clean;
    }
    return clean;
  }

  function parseRouteFrom(pathAndQuery) {
    var cleanPath = normalizePath((pathAndQuery || "/").split("?")[0]);
    var segments = cleanPath.split("/").filter(Boolean);
    var queryString = (pathAndQuery || "").split("?")[1] || "";
    var query = {};

    if (queryString) {
      queryString.split("&").forEach(function (pair) {
        var p = pair.split("=");
        query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
      });
    }

    var route = { raw: cleanPath + (queryString ? "?" + queryString : ""), path: "/" + segments.join("/"), segments: segments, params: {}, query: query };

    if (segments[0] === "projects" && segments[1] && segments[1] !== "new") {
      route.path = "/projects/:id";
      route.params.id = segments[1];
    }

    if (route.path === "/BAchecklist.html") {
      route.path = "/BAchecklist";
    }

    if (cleanPath === "/") {
      route.path = "/";
    }

    return route;
  }

  function parseRoute() {
    if (location.hash && location.hash.startsWith("#/")) {
      return parseRouteFrom(location.hash.slice(1));
    }
    return parseRouteFrom(location.pathname + location.search);
  }

  function onChange(handler) {
    listeners.push(handler);
  }

  function notify() {
    var route = parseRoute();
    listeners.forEach(function (handler) {
      handler(route);
    });
  }

  function go(path) {
    var normalized = normalizePath(path || "/");
    if (location.pathname + location.search !== normalized) {
      history.pushState({}, "", normalized);
    }
    notify();
  }

  function start() {
    window.addEventListener("popstate", notify);
    document.addEventListener("click", function (event) {
      var anchor = event.target.closest("a[href]");
      if (!anchor) {
        return;
      }
      if (anchor.target && anchor.target !== "_self") {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      var href = anchor.getAttribute("href");
      if (!href || href.indexOf("http") === 0 || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) {
        return;
      }
      if (href.startsWith("/")) {
        event.preventDefault();
        go(href);
      }
    });
    window.addEventListener("load", function () {
      if (location.hash && location.hash.startsWith("#/")) {
        history.replaceState({}, "", normalizePath(location.hash.slice(1)));
      }
      notify();
    });
  }

  window.Router = {
    onChange: onChange,
    parseRoute: parseRoute,
    go: go,
    start: start
  };
})();
