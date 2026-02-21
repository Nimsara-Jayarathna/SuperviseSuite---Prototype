(function () {
  var listeners = [];

  function normalizeHash() {
    var hash = location.hash || "#/";
    if (!hash.startsWith("#/")) {
      return "#/";
    }
    return hash;
  }

  function parseRoute() {
    var hash = normalizeHash();
    var clean = hash.slice(2);
    var segments = clean.split("?")[0].split("/").filter(Boolean);
    var queryString = hash.split("?")[1] || "";
    var query = {};

    if (queryString) {
      queryString.split("&").forEach(function (pair) {
        var p = pair.split("=");
        query[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || "");
      });
    }

    var route = { raw: hash, path: "/" + segments.join("/"), segments: segments, params: {}, query: query };

    if (segments[0] === "projects" && segments[1] && segments[1] !== "new") {
      route.path = "/projects/:id";
      route.params.id = segments[1];
    }

    if (clean === "") {
      route.path = "/";
    }

    return route;
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

  function go(hashPath) {
    location.hash = hashPath;
  }

  function start() {
    window.addEventListener("hashchange", notify);
    window.addEventListener("load", function () {
      if (!location.hash) {
        location.hash = "#/";
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
