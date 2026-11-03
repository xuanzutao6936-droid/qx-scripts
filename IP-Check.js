/**
 * 调试版：显示原始节点配置，方便定位入口IP获取问题
 */
(async () => {
  let debug = "";

  try {
    debug += `<b>$environment.params</b><br>${$environment?.params || "无"}<br><br>`;

    if ($environment?.params) {
      const { ret, error } = await $configuration.sendMessage({
        action: "get_server_description",
        content: $environment.params
      });

      debug += `<b>error</b><br>${error || "无"}<br><br>`;
      debug += `<b>ret 原始内容</b><br><pre style="font-size:11px;white-space:pre-wrap;">${JSON.stringify(ret, null, 2)}</pre><br>`;

      if (ret) {
        const proxyStr = Object.values(ret)[0] || "";
        debug += `<b>proxyStr</b><br><pre style="font-size:11px;white-space:pre-wrap;">${proxyStr}</pre>`;
      }
    } else {
      debug += "没有 $environment.params";
    }
  } catch (e) {
    debug += `<b>异常</b><br>${e.message || e}`;
  }

  $done({
    title: "调试信息",
    htmlMessage: debug
  });
})();
