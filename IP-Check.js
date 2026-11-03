/**
 * QX 节点入口 + 落地 IP 检测
 * 使用 get_server_description 获取真实入口
 */
const timeout = 8000;

(async () => {
  try {
    // 1. 获取入口 IP（节点服务器地址）
    let entryIP = "";
    let entryInfo = null;

    if ($environment?.params) {
      try {
        const { ret, error } = await $configuration.sendMessage({
          action: "get_server_description",
          content: $environment.params
        });
        if (!error && ret) {
          const proxyStr = Object.values(ret)[0] || "";
          // 匹配 server=xxx:port 或 =xxx:port
          const match = proxyStr.match(/=\s*([^,\s]+):\d+/);
          if (match) {
            entryIP = match[1];
            // 如果是域名，尝试解析成 IP（可选）
            if (!/^\d+\.\d+\.\d+\.\d+$/.test(entryIP)) {
              // 域名暂时直接显示
            }
          }
        }
      } catch (e) {
        console.log("获取入口失败:", e);
      }
    }

    // 2. 获取落地 IP（走当前节点）
    const exit = await fetchJson(
      "http://ip-api.com/json?lang=zh-CN&fields=status,message,query,country,countryCode,regionName,city,isp,org,as,mobile,proxy,hosting"
    );

    if (!exit || exit.status !== "success") {
      throw new Error(exit?.message || "落地 IP 获取失败");
    }

    // 3. 如果有入口 IP，再查一下入口的地理位置
    if (entryIP && /^\d+\.\d+\.\d+\.\d+$/.test(entryIP)) {
      try {
        entryInfo = await fetchJson(
          `http://ip-api.com/json/${entryIP}?lang=zh-CN&fields=status,message,query,country,countryCode,regionName,city,isp,org,as`,
          true
        );
      } catch (e) {}
    }

    const result = buildResult(entryIP, entryInfo, exit);
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

function buildResult(entryIP, entryInfo, exit) {
  let html = "";

  // ===== 入口 =====
  if (entryIP) {
    const flag = entryInfo ? getFlag(entryInfo.countryCode) : "";
    const loc = entryInfo
      ? [entryInfo.country, entryInfo.regionName, entryInfo.city]
          .filter(Boolean)
          .join(" ")
      : "解析中 / 域名";
    const isp = entryInfo ? entryInfo.isp || entryInfo.org || "未知" : "未知";

    html += `
<p>
<b>入口</b>: ${entryIP}<br>
<b>位置</b>: ${flag} ${loc}<br>
<b>运营商</b>: ${isp}
</p>
<br>
`;
  } else {
    html += `
<p>
<b>入口</b>: 获取失败
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
