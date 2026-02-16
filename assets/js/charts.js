(function () {
  function drawLineChart(canvasId, points, labels) {
    var canvas = document.getElementById(canvasId);
    if (!canvas || !canvas.getContext) {
      return;
    }
    var ctx = canvas.getContext("2d");
    var w = canvas.width;
    var h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    var max = Math.max.apply(null, points.concat([1]));
    var pad = 28;
    var chartW = w - pad * 2;
    var chartH = h - pad * 2;

    ctx.strokeStyle = "#e2e8f0";
    for (var g = 0; g <= 4; g += 1) {
      var gy = pad + (chartH / 4) * g;
      ctx.beginPath();
      ctx.moveTo(pad, gy);
      ctx.lineTo(w - pad, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2;
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

    ctx.fillStyle = "#2563eb";
    points.forEach(function (val, i) {
      var x = pad + (chartW / Math.max(points.length - 1, 1)) * i;
      var y = h - pad - (val / max) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
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
    ctx.fillStyle = "#ffffff";
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
      ctx.fillStyle = "#60a5fa";
      ctx.fillRect(x, y, bw, barH);
      ctx.fillStyle = "#64748b";
      ctx.font = "11px sans-serif";
      ctx.fillText(item.label, x, h - 8);
    });
  }

  window.Charts = {
    drawLineChart: drawLineChart,
    drawBars: drawBars
  };
})();
