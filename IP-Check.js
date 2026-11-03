/**
 * QX 节点入口 + 落地 IP 检测
 * 入口域名会自动解析成 IP
 */
const timeout = 8000;

(async () => {
  try {
    let entryHost = "";

    // 1. 从节点配置里提取入口地址（可能是域名或 IP）
    if ($environment?.params) {
      try {
        const { ret, error } = await $configuration.sendMessage({
          action: "get_server_description",
          content: $environment.params
        });

        if (!error && ret) {
          const proxyStr = Object.values(ret)[0] || "";
          const match = proxyStr.match(/=\s*([^,\s]+):\d+/);
          if (match) {
            entryHost = match[1];
          }
        }
      } catch (e) {
        console.log("获取入口配置失败", e);
      }
    }

    // 2. 获取落地 IP
    const exit = await fetchJson(
      "http://ip-api.com/json?lang=zh-CN&fields=status,message,query,country,countryCode,regionName,city,isp,org,as,mobile,proxy,hosting"
    );

    if (!exit || exit.status !== "success") {
      throw new Error(exit?.message || "落地 IP 获取失败");
    }

    // 3. 解析入口（无论是域名还是 IP，都用 ip-api 查一次，拿到真实 IP + 位置）
    let entryInfo = null;
    if (entryHost) {
      try {
        entryInfo = await fetchJson(
          `http://ip-api.com/json/${entryHost}?lang=zh-CN&fields=status,message,query,country,countryCode,regionName,city,isp,org,as`,
          true // 直连查询，不走代理
        );
      } catch (e) {
        console.log("入口解析失败", e);
      }
    }

    const result = buildResult(entryInfo, exit);
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
    const opts = { url, timeout };
    if (!direct && $environment?.params) {
      opts.opts = { policy: $environment.params };
    }
    $task.fetch(opts).then(
      (resp) => {
        if (resp.statusCode === 200 && resp.body) {
          try {
            resolve(JSON.parse(resp.body));
          } catch (e) {
            reject(new Error("JSON 解析失败"));
          }
        } else {
          reject(new Error(`HTTP ${resp.statusCode}`));
        }
      },
      (err) => reject(err)
    );
  });
}

function getFlag(code) {
  if (!code || code.length !== 2) return "";
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt())
  );
}

function buildResult(entryInfo, exit) {
  let html = "";

  // ===== 入口 =====
  if (entryInfo && entryInfo.status === "success") {
    const flag = getFlag(entryInfo.countryCode);
    const loc = [entryInfo.country, entryInfo.regionName, entryInfo.city]
      .filter(Boolean)
      .join(" ");
    const isp = entryInfo.isp || entryInfo.org || "未知";

    html += `
<p>
<b>入口</b>: ${entryInfo.query}<br>
<b>位置</b>: ${flag} ${loc}<br>
<b>运营商</b>: ${isp}
</p>
<br>
`;
  } else {
    html += `
<p>
<b>入口</b>: 解析失败
</p>
<br>
`;
  }

  // ===== 落地 =====
  const eFlag = getFlag(exit.countryCode);
  const eLoc = [exit.country, exit.regionName, exit.city]
    .filter(Boolean)
    .join(" ");
  const eIsp = exit.isp || exit.org || "未知";

  html += `
<p>
<b>落地 IP</b>: ${exit.query}<br>
<b>位置</b>: ${eFlag} ${eLoc}<br>
<b>运营商</b>: ${eIsp}
</p>
`;

  // ===== 类型判断 =====
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
<br>
<p>
<b style="color:${typeColor}">${typeText}</b>
</p>
`;

  return html;
}
