/**
 * QX 节点入口 + 落地 IP 检测
 * 风格对齐网络信息查询
 */
const timeout = 8000;

(async () => {
  try {
    // 1. 获取落地 IP（走当前节点）
    const exit = await fetchJson("http://ip-api.com/json?lang=zh-CN&fields=status,message,query,country,countryCode,regionName,city,isp,org,as,mobile,proxy,hosting");
    
    if (!exit || exit.status !== "success") {
      throw new Error(exit?.message || "落地 IP 获取失败");
    }

    // 2. 尝试获取入口 IP（节点服务器 IP）
    let entry = null;
    try {
      // 这里用一个不走代理的接口尝试获取（效果有限，QX 限制较多）
      entry = await fetchJson("http://ip-api.com/json?lang=zh-CN&fields=status,message,query,country,countryCode,regionName,city,isp,org,as", true);
    } catch (e) {}

    const result = buildResult(entry, exit);
    $done({
      title: "📍 节点入口/落地检测",
      htmlMessage: result
    });
  } catch (err) {
    $done({
      title: "📍 节点入口/落地检测",
      htmlMessage: `<p style="color:#FF3B30">检测失败：${err.message || err}</p>`
    });
  }
})();

function fetchJson(url, direct = false) {
  return new Promise((resolve, reject) => {
    const opts = { url: url, timeout: timeout };
    
    // 落地查询强制走当前节点
    if (!direct && $environment?.params) {
      opts.opts = { policy: $environment.params };
    }

    $task.fetch(opts).then(resp => {
      if (resp.statusCode === 200 && resp.body) {
        try {
          resolve(JSON.parse(resp.body));
        } catch (e) {
          reject(new Error("JSON 解析失败"));
        }
      } else {
        reject(new Error(`HTTP ${resp.statusCode}`));
      }
    }, err => reject(err));
  });
}

function getFlag(code) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 127397 + c.charCodeAt()));
}

function buildResult(entry, exit) {
  const flag = getFlag(exit.countryCode);
  const loc = [exit.country, exit.regionName, exit.city].filter(Boolean).join(" ");
  const isp = exit.isp || exit.org || "未知";

  // 落地部分
  let html = `
<p>
<b>落地 IP</b>: ${exit.query}<br>
<b>位置</b>: ${flag} ${loc}<br>
<b>运营商</b>: ${isp}
</p>
`;

  // 入口部分（如果能获取到）
  if (entry && entry.status === "success" && entry.query !== exit.query) {
    const eFlag = getFlag(entry.countryCode);
    const eLoc = [entry.country, entry.regionName, entry.city].filter(Boolean).join(" ");
    const eIsp = entry.isp || entry.org || "未知";

    html = `
<p>
<b>入口</b>: ${entry.query}<br>
<b>位置</b>: ${eFlag} ${eLoc}<br>
<b>运营商</b>: ${eIsp}
</p>
<br>
` + html;
  } else {
    html = `
<p>
<b>入口</b>: 获取失败（QX限制）
</p>
<br>
` + html;
  }

  // 家宽/机房判断
  let typeText = "未知";
  let typeColor = "#8E8E93";
  if (exit.mobile) {
    typeText = "📱 移动网络";
    typeColor = "#007AFF";
  } else if (exit.hosting) {
    typeText = "🏢 机房 / 数据中心";
    typeColor = "#FF9500";
  } else if (exit.proxy) {
    typeText = "🛡️ 代理 / VPN";
    typeColor = "#FF3B30";
  } else {
    typeText = "🏠 家宽 / ISP（大概率）";
    typeColor = "#34C759";
  }

  html += `
<p style="margin-top:12px">
<b style="color:${typeColor}">${typeText}</b>
</p>
`;

  return html;
}
