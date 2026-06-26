const targetUrl = process.argv[2];

const versionRes = await fetch("http://127.0.0.1:9333/json/version");
const version = await versionRes.json();

const newTabRes = await fetch(`http://127.0.0.1:9333/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" });
const tab = await newTabRes.json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);

let id = 0;
function send(method, params = {}) {
  const msgId = ++id;
  ws.send(JSON.stringify({ id: msgId, method, params }));
  return msgId;
}

ws.addEventListener("open", () => {
  send("Runtime.enable");
  send("Log.enable");
  send("Page.enable");
});

ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.exceptionThrown") {
    console.log("=== Runtime.exceptionThrown ===");
    console.log(JSON.stringify(msg.params.exceptionDetails, null, 2));
  }
  if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    console.log("=== Log.entryAdded (error) ===");
    console.log(JSON.stringify(msg.params.entry, null, 2));
  }
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    console.log("=== console.error ===");
    console.log(JSON.stringify(msg.params.args, null, 2));
    if (msg.params.stackTrace) {
      console.log("stackTrace:", JSON.stringify(msg.params.stackTrace, null, 2));
    }
  }
});

setTimeout(() => {
  console.log("done waiting");
  process.exit(0);
}, 9000);
