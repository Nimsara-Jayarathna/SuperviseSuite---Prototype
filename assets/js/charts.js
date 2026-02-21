(function () {
  function cssVar(name, fallback) {
    var root = document.documentElement;
    var value = getComputedStyle(root).getPropertyValue(name);
    return (value && value.trim()) || fallback;
  }

  function drawLineChart(canvasId, points, labels) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext) {
      return;
    }
    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var panel = cssVar("--panel", "#ffffff");
    var grid = "#e2e8f0";
    var primary = cssVar("--primary", "#3b82f6");
    var primaryStrong = cssVar("--primary-strong", "#2563eb");
    var muted = cssVar("--muted", "#64748b");

    ctx.fillStyle = panel;
    ctx.fillRect(0, 0, w, h);

    var max = Math.max.apply(null, points.concat([1]));
    var pad = 28;
    var chartW = w - pad * 2;
    var chartH = h - pad * 2;

    ctx.strokeStyle = grid;
    for (var g = 0; g <= 4; g += 1) {
      var gy = pad + (chartH / 4) * g;
      ctx.beginPath();
      ctx.moveTo(pad, gy);
      ctx.lineTo(w - pad, gy);
      ctx.stroke();
    }

    var area = ctx.createLinearGradient(0, pad, 0, h - pad);
    area.addColorStop(0, "rgba(59, 130, 246, 0.22)");
    area.addColorStop(1, "rgba(59, 130, 246, 0.03)");

    ctx.beginPath();
    points.forEach(function (val, i) {
      var x0 = pad + (chartW / Math.max(points.length - 1, 1)) * i;
      var y0 = h - pad - (val / max) * chartH;
      if (i === 0) {
        ctx.moveTo(x0, y0);
      } else {
        ctx.lineTo(x0, y0);
      }
    });
    ctx.lineTo(w - pad, h - pad);
    ctx.lineTo(pad, h - pad);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();

    ctx.strokeStyle = primaryStrong;
    ctx.lineWidth = 2.25;
    ctx.beginPath();
    points.forEach(function (val, i) {
      var x = pad + (chartW / Math.max(points.length - 1, 1)) * i;
      var y = h - pad - (val / max) * chartH;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    ctx.fillStyle = primary;
    points.forEach(function (val, i) {
      var x = pad + (chartW / Math.max(points.length - 1, 1)) * i;
      var y = h - pad - (val / max) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = muted;
    ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
    labels.forEach(function (label, i) {
      var x2 = pad + (chartW / Math.max(labels.length - 1, 1)) * i;
      ctx.fillText(label, x2 - 10, h - 8);
    });
  }

  function drawBars(canvasId, items) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext) {
      return;
    }
    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var panel2 = cssVar("--panel", "#ffffff");
    var primary2 = cssVar("--primary", "#3b82f6");
    var primaryStrong2 = cssVar("--primary-strong", "#2563eb");
    var muted2 = cssVar("--muted", "#64748b");

    ctx.fillStyle = panel2;
    ctx.fillRect(0, 0, w, h);

    var pad = 26;
    var chartH = h - pad * 2;
    var max = 1;
    items.forEach(function (i) { if (i.value > max) { max = i.value; } });

    var slot = (w - pad * 2) / Math.max(items.length, 1);
    items.forEach(function (item, index) {
      var barH = (item.value / max) * chartH;
      var x = pad + index * slot + 8;
      var y = h - pad - barH;
      var bw = Math.max(slot - 16, 12);

      var grad = ctx.createLinearGradient(x, y, x, h - pad);
      grad.addColorStop(0, primaryStrong2);
      grad.addColorStop(1, primary2);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, bw, barH);
      ctx.fillStyle = muted2;
      ctx.font = "11px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(item.label, x, h - 8);
    });
  }

  window.Charts = {
    drawLineChart: drawLineChart,
    drawBars: drawBars
  };
})();
