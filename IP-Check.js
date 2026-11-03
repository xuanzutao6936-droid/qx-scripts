/**
 * QX 节点出口 IP 检测（家宽 / 机房判断）
 */
const timeout = 8000;

(async () => {
  try {
    const ipapi = await fetchJson("http://ip-api.com/json?lang=zh-CN&fields=status,message,query,country,countryCode,regionName,city,isp,org,as,mobile,proxy,hosting");
    
    if (!ipapi || ipapi.status !== "success") {
      throw new Error(ipapi?.message || "ip-api 请求失败");
    }

    let ippure = null;
    try {
      ippure = await fetchJson("https://my.ippure.com/v1/info");
    } catch (e) {}

    const result = buildResult(ipapi, ippure);
    $done({
      title: "📍 节点出口检测",
      htmlMessage: result
    });
  } catch (err) {
    $done({
      title: "📍 节点出口检测",
      htmlMessage: `<p style="color:#FF3B30">检测失败：${err.message || err}</p>`
    });
  }
})();

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const opts = { url: url, timeout: timeout };
    if ($environment?.params) {
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

function buildResult(ipapi, ippure) {
  const ip = ipapi.query;
  const location = [ipapi.country, ipapi.regionName, ipapi.city].filter(Boolean).join(" · ");
  const isp = ipapi.isp || ipapi.org || "未知";
  const asn = ipapi.as || "";

  let typeText = "";
  let typeColor = "#8E8E93";

  if (ipapi.mobile) {
    typeText = "📱 移动网络";
    typeColor = "#007AFF";
  } else if (ipapi.hosting) {
    typeText = "🏢 机房 / 数据中心";
    typeColor = "#FF9500";
  } else if (ipapi.proxy) {
    typeText = "🛡️ 代理 / VPN";
    typeColor = "#FF3B30";
  } else {
    typeText = "🏠 家宽 / ISP（大概率）";
    typeColor = "#34C759";
  }

  let pureExtra = "";
  if (ippure && ippure.ip === ip) {
    const res = ippure.isResidential ? "✅ 原生家宽" : "❌ 非原生 / 机房";
    const score = ippure.fraudScore != null ? `风险分 ${ippure.fraudScore}` : "";
    pureExtra = `<br><br><b>IPPure 补充</b><br>${res}${score ? " · " + score : ""}`;
  }

  return `
<p>
<b>出口 IP</b><br>${ip}<br><br>
<b>位置</b><br>${location || "未知"}<br><br>
<b>运营商</b><br>${isp}<br>
${asn ? asn + "<br>" : ""}
<br>
<b style="color:${typeColor}">${typeText}</b>
${pureExtra}
</p>
<p style="color:#8E8E93;font-size:12px;margin-top:12px">
数据来源：ip-api.com${ippure ? " + IPPure" : ""}
</p>
`;
}
