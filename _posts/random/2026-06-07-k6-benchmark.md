---
title: K6 極限壓力測試：從 DNS 解析看系統在高負載下的脆弱性
date: 2026-06-07
categories: [random]
tags: [load test, unit test, integration test, smoke test, average-load test, soak test, spike test, breakpoint test, tail latency, p50, p90, p95, slo, sli, sla, service-level objective, service-level agreement, service-level indicator, error budgets, grafana k6, virtual user, vu, metrics, dashboard, k8s, service discovery, dns, coredns, ndots, fqdn, fully qualified domain name, resolv.conf, search path, k3d, rancher]
description: Kubernetes 的 DNS ndots 設定究竟是效能救星還是災難？結合 k6 進行 5,000 VUs 極限壓力測試，深入剖析 FQDN 與 Non-FQDN 在高併發下的延遲真相。揭開 DNS 快取穿透與 Host Header 處理開銷對系統吞吐量的真實影響。
math: true
---

# Introduction to Load Test
unit test 以及 integration test 可以很好的測試功能的正確性\
不過更進階的情況下我們可能會需要確保在高系統壓力下，他還能正確地做動\
這時候就需要 `壓力測試` 了

> 有關測試可以參考 [DevOps - 單元測試 Unit Test \| Shawn Hsu](../../devops/devops-unit-test) 以及 [DevOps - 整合測試 Integration Test \| Shawn Hsu](../../devops/devops-integration-test)

熟悉 benchmark 的朋友應該知道說\
大部分的實驗其實都是在所謂 **理想狀況下** 實驗出來的\
雖然可以得知他的表現，但顯然這並不代表真實情況

如果你只是想測試不同的方法有多少的改進\
那的確這樣就足夠了，畢竟重點是考慮 improvement\
在這種狀況下，我通常會把網路停掉，所有的 app 都關掉，使得測量出來的數據是不受到任何干擾的

現實往往殘酷，有些問題只有在高負載才會出現\
所以壓力測試正是為了查找那些很隱蔽的問題而存在

不過如果是要測試系統在高壓力下能不能撐住\
只能是透過壓力測試才能窺探一二的

## Load Test Type
![](https://grafana.com/media/docs/k6-oss/chart-load-test-types-overview.png)
> ref: [Load test types](https://grafana.com/docs/k6/latest/testing-guides/test-types/)

系統有負載的情況下，我們不能假設系統不會出錯\
針對不同負載等級，需要的測試是不同的，大致上有

+ `smoke test`: 確保系統在 minimum load 可以正常運作，且驗證你的測試 script 會動
+ `average-load test`: 評估在 average load 的狀況下系統可以正常運作與否
+ `stress test`: 超出平均的高負載系統能否運作
+ `soak test`: 測量系統在長時間運轉下功能正常與否
+ `spike test`: 測量系統在突發流量(i.e. 升高、下降)的應對
+ `breakpoint test`: 逐步提升負載以找出系統極限

所以在測量的時候，你應該要先從 `smoke test` 開始\
至於說之後要使用哪一種方法，很大程度上取決於你的系統\
你需要根據系統的架構去選擇相對應的策略，不過注意到，並不是有測試就確保萬無一失了

## Tail Latency Matters
我們怎麼定義說這個系統在高壓力之下服務是正常，穩定的\
通常是確保說每個使用者的 *體驗*，都要是類似甚至一樣的\
所以在進行壓力測試的時候，我們通常會看不同的百分位數

`p50` 指的是請求中位數\
也就是說有 50% 的請求比他慢，也同時有 50% 的請求比他快\
而 `p95` 則是最後 **5%** 的數據\
通常來說 `p95` 的參考價值會比較高，因為系統的流暢度並不是由大多數人決定的，往往就是那少數起到關鍵作用\
系統的崩潰都是由少數人先感受到，然後在一步步往 `p50` 擴散，最後導致系統癱瘓

因此在進行壓力測試的時候，我們通常會去測試說 `p95` 的指標\
因為他如果出現異常，很可能表示系統內部是有隱患的，如果不處理，可能最終會導致掛站等級的事故

## SLO, SLI 與 SLA
前一個章節提到的服務正常，其實業界有指標專門在測量這件事情

**Service-level Objective(SLO)** 服務水準目標，旨在明確定義出你的服務需要達成什麼樣的目標\
並且他是一個內部目標，團隊需要盡力確保提供的服務符合客戶的期望\
具體來說是哪些目標呢？ 比方說是 *99.9% 的正常運行時間*

這個指標通常包含，`指標`, `目標` 以及 `時間窗口`\
以上述例子來說就是
+ `指標`: 當前測量出來的數字，用以確認有沒有達到目標
+ `目標`: 是一個你期望達到的數字門檻，比如說 *99.9% 正常運行時間*
+ `時間窗口`: 衡量指標所需要的時長範圍，通常是月或年

**Service-level Agreement(SLA)** 服務水準協議是更高階的合約\
通常是你與客戶直接簽訂的正式合約，裡面通常包含
+ 承諾服務的品質
+ 服務的可用性
+ 責任以及賠償條款

如果 SLA 裡面，比方說有一條是 `你可以期待一個月內有 99.9% 的時間服務都是可用的`\
那在 SLO 裡面也會有一條 `工程團隊需要確保伺服器與軟體一年中最多停機時間為 30 分鐘`

> 雖然 99.9% 的 uptime 可以容許 43.2 分鐘的停機\
> 不過通常 SLO 會比 SLA 更嚴格，就是多留一點緩衝這樣

**Service-level Indicator(SLI)** 服務級別指標，他可以讓你用來測量服務的品質\
你在 SLA 當中與客戶明定想要的服務水準，對應到內部 SLO 會具體的維持住這個目標\
團隊會使用 SLI 指標，確認當前是符合 SLO 的期待的

### Error Budgets
當初在訂定 SLO 的時候，可能會需要留一點空間\
比方說當更新上新的功能版本，會因為各種因素而導致違反 SLA\
就拿 99.9% 的可用性來說，如果你訂得太高標準，一次錯誤的上版可能會面臨賠償\
雖然保證可用性很重要，不過這邊想說的只是你永遠要為不確定性留下一點犯錯的空間

# Grafana K6
[Grafana K6](https://grafana.com/docs/k6/) 是一個開源的效能測試工具\
專門測量應用程式或 infrastructure 的效能

`K6` 本身優化成使用少量系統資源去執行高負載的測試，如 spike, stress, soak 測試(可參考 [Load Test Type](#load-test-type))\
除此之外，他也可以與瀏覽器整合，針對不同的瀏覽器進行測試並搜集相關指標

## Installation
```shell
$ brew install k6

$ docker pull grafana/k6
```

## Simulating Load
K6 主要透過 **virtual user(VU)** 以及 **requests per second** 這兩個參數去模擬壓力\
通常來說，你會使用 `scenario` 去控制細項的參數

```js
export const options = {
  scenarios: {
    example_scenario: {
      executor: 'shared-iterations',

      startTime: '10s',
      gracefulStop: '5s',
      env: { EXAMPLEVAR: 'testing' },
      tags: { example_tag: 'testing' },

      vus: 10,
      iterations: 200,
      maxDuration: '10s',
    },
    another_scenario: {
      /*...*/
    },
  },
};
```

在同一個 [K6 scripts](#k6-scripts) 內部你可以設定多個 scenario\
其中 [executor](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/) 的參數是用於控制 **virtual user** 與 **iteration** 的東西\
他有以下這幾類

+ [shared-iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/shared-iterations/): 總共有 *X* 個 `VU` 要共同完成 *Y* 次 iteration(不保證 iteration 會均勻分布到 `VU`)
+ [per-vu-iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/per-vu-iterations/): 總共有 *X* 個 `VU`，每個 `VU` 要完成 *Y* 次 iteration
+ [constant-vus](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-vus/): 給定 *X* 個 `VU`，一起同時跑一段時間
+ [ramping-vus](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/): 根據特定階段動態調整 `VU` 數量。比如說 0 ~ 10 秒 *X* 個 `VU`, 10 ~ 30 秒提升至 *Y*
+ [constant-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/): 固定 request per second(RPS)
+ [ramping-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-arrival-rate/): 根據特定階段動態調整 RPS，與 [ramping-vus](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/ramping-vus/) 類似，你是指定 *X* RPS

## Metrics
除了要如何進行測試，評估測試結果也是很重要的一環\
K6 本身有一些內建的 metric 可以使用，這邊列幾個

+ `checks`: 包含 3 個數值，成功次數、失敗次數以及總共執行次數
+ `data_sent`, `data_received`: 收送的資料大小
+ `http_req_blocked`: 送出 request 以前的時間
+ `http_req_duration`: 整個 request time 的時間(不包含 dns lookup 等時間)

除了基本的 HTTP，K6 本身也還有 [Browser](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/#browser), [gRPC](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/#grpc) 以及 [WebSocket](https://grafana.com/docs/k6/latest/using-k6/metrics/reference/#websockets) 的 metric 可以使用

> 可參考 [網頁程式設計三兩事 - gRPC 與 JSON-RPC \| Shawn Hsu](../../website/website-rpc)

## K6 Scripts
K6 這個工具本身是使用 JavaScript/TypeScript 來撰寫測試腳本的\
其內容會根據你要測試的內容而有所不同，比方說一些參數的設定(可參考 [Simulating Load](#simulating-load) 以及 [Metrics](#metrics))

> 注意到 K6 不是跑 Node.js，所以有些 npm package 無法使用

```js
import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  thresholds: {
    http_req_blocked: ['p(95)>=0'],
  },
  scenarios: {
    test: {
      executor: 'ramping-vus',
      startVus: 100,
      stages: [
        { duration: '30s', target: 300 },
        { duration: '10s', target: 500 },
      ],
      gracefulRampDown: '0s',
    },
  },
};

export default function () {
  http.get('https://api.ambersuncreates.com');
  sleep(0.5);
}
```

以上就是一個簡單的 K6 scripts 的例子\
你的測試主要會寫在 default function 這個地方，需要 export 讓 K6 載入\
然後設定檔的部分是在 `options` 這裡指定

K6 本身有自己帶 GUI，所以可以帶參數進去，用圖形化介面看結果

```shell
$ K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_OPEN=true k6 run k6.js
```

![](/assets/img/posts/k6.png)

![](/assets/img/posts/k62.png)

# Kubernetes Service Discovery
我想要親眼看看系統在極端壓力下會有什麼樣的問題，我想要以 [Kubernetes ndots issue](#kubernetes-ndots-issue) 為基礎，進行壓力測試\
在此之前，我們需要先了解一下背景知識

## DNS Recap
網際網路上我們使用 domain name 來存取網站，不過實際上他都會轉換成 ip address 來進行存取\
domain name 就是方便人類理解的，而這個轉換的步驟是由 DNS 來完成的

在 K8s 內部中也是同樣的道理，當你需要連接不同服務的時候，通常是直接叫他們的名字\
然後 [CoreDNS](https://coredns.io/) 會幫你轉換成 ip address

## FQDN(Fully Qualified Domain Name)
名字這件事情是有唯一性的，比如說 `secure.payments.ssl.com` 就是一個 FQDN\
他是一個完整且明確的地址，可以讓你精確識別網路上的設備或服務

可是有些名字就很長，所以人們發明了所謂的 `search path` 來解決這個問題\
你會在 **/etc/resolv.conf** 中看到類似以下的設定
```
nameserver 10.0.0.1
search example.com example.org
```

根據 [man resolv.conf](https://linux.die.net/man/5/resolv.conf)

> `search` Search list for host-name lookup.\
>   The search list is normally determined from the local domain name; by default, it contains only the local domain name.

這些 search list 通常會是 "local domain name"，也就是說他會優先搜尋內網的服務\
如果真的都找不到才會去外網

> 裡面也有提到說如果 search list 都是外網，那可能會很慢

比方說你輸入 `web` 的時候\
DNS 會嘗試去找 `web.example.com`, `web.example.org` 這樣的東西\
等於說你不需要每次都輸入完整的名字，只要輸入 `web` 就可以了

## ndots
我們知道了 [FQDN](#fqdnfully-qualified-domain-name) 的絕對精準\
也知道因為名字太長而引入 `search path` 來解決這個問題\
不過這又更引申出另一個問題

如果我是輸入 `home.ai` 的時候，你要怎麼知道他到底是內網還是外網\
搞不好全名是 `home.ai.example.com` 呢？

所以要怎麼區分他到底是不是 [FQDN](#fqdnfully-qualified-domain-name) 呢？\
你需要 `ndots` 這個參數

根據 [man resolv.conf](https://linux.die.net/man/5/resolv.conf)

> `ndots`:n\
>   sets a threshold for the number of dots which must appear in a name given to res_query(3) (see resolver(3)) before an initial absolute query will be made. The default for n is 1, meaning that if there are any dots in a name, the name will be tried first as an absolute name before any search list elements are appended to it. The value for this option is silently capped to 15.

如果你的 domain name 有超過 `ndots` 的數量，那麼他就會被視為 [FQDN](#fqdnfully-qualified-domain-name)\
則會優先搜尋，真的找不到才會嘗試 `search path` 裡面的東西

## Experiment
### Prerequisites
```shell
$ k3d cluster create mycluster --image rancher/k3s:v1.34.8-k3s1

$ kubectl version
Client Version: v1.34.0
Kustomize Version: v5.7.1
Server Version: v1.34.8+k3s1
```

### Setup Cluster
```shell
$ kubectl create deployment test-deployment --image nginx --replicas 3 --80
$ kubectl expose deployment test-deployment --name test-svc --port 80
$ kubectl get endpointslices
NAME             ADDRESSTYPE   PORTS   ENDPOINTS                          AGE
kubernetes       IPv4          6443    192.168.155.2                      3m3s
test-svc-5qn74   IPv4          80      10.42.0.11,10.42.0.12,10.42.0.10   48s
$ kubectl run test -it --restart Never --rm --image busybox -- wget -O - 10.42.0.11
Connecting to 10.42.0.11 (10.42.0.11:80)
writing to stdout
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, nginx is successfully installed and working.
Further configuration is required for the web server, reverse proxy, 
API gateway, load balancer, content cache, or other features.</p>

<p>For online documentation and support please refer to
<a href="https://nginx.org/">nginx.org</a>.<br/>
To engage with the community please visit
<a href="https://community.nginx.org/">community.nginx.org</a>.<br/>
For enterprise grade support, professional services, additional 
security features and capabilities please refer to
<a href="https://f5.com/nginx">f5.com/nginx</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>
-                    100% |********************************|   896  0:00:00 ETA
written to stdout
pod "test" deleted from default namespace
```

簡單講就是先建 deployment 以及 service\
後面的指令是確保以上有正常運作且打得通這樣

### Observation
#### DNS Resolution
那我們先看一下 DNS 是怎麼被 resolve 的

```shell
$ kubectl run test -it --restart Never --rm --image busybox -- nslookup test-svc   
Server:         10.43.0.10
Address:        10.43.0.10:53

** server can't find test-svc.cluster.local: NXDOMAIN

Name:   test-svc.default.svc.cluster.local
Address: 10.43.111.46

** server can't find test-svc.svc.cluster.local: NXDOMAIN

** server can't find test-svc.cluster.local: NXDOMAIN


** server can't find test-svc.svc.cluster.local: NXDOMAIN

pod "test" deleted from default namespace
pod default/test terminated (Error)
```

你可以看到說，他確實是有找到一條 record，也就是 **test-svc.default.svc.cluster.local**\
對應到的實體 ip 為 10.43.111.46\
換句話說其實我也可以這樣

```shell
$ kubectl run test -it --restart Never --rm --image busybox -- wget -O - test-svc
Connecting to test-svc (10.43.111.46:80)
writing to stdout
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, nginx is successfully installed and working.
Further configuration is required for the web server, reverse proxy, 
API gateway, load balancer, content cache, or other features.</p>

<p>For online documentation and support please refer to
<a href="https://nginx.org/">nginx.org</a>.<br/>
To engage with the community please visit
<a href="https://community.nginx.org/">community.nginx.org</a>.<br/>
For enterprise grade support, professional services, additional 
security features and capabilities please refer to
<a href="https://f5.com/nginx">f5.com/nginx</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>
-                    100% |********************************|   896  0:00:00 ETA
written to stdout
pod "test" deleted from default namespace
```

你可以看到說我 wget 的時候也不用打 [FQDN](#fqdnfully-qualified-domain-name) 了，直接打 `test-svc` 就可以了\
當然你要打完整的也是可以

#### resolv.conf
那 pod 的 `resolv.conf` 長怎麼樣呢？

```shell
$ kubectl run test -it --restart Never --rm --image busybox -- cat /etc/resolv.conf
search default.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.43.0.10
options ndots:5
pod "test" deleted from default namespace
```

在 [DNS Resolution](#dns-resolution) 的時候，我們看到說他只有找 5 筆紀錄\
照理說應該要是 6 筆(search list 總共 3 組，每組都要試 2 次 ipv4 以及 ipv6)\
如果我換一個不存在的 DNS record 會怎麼樣？

```shell
$ kubectl run test -it --restart Never --rm --image busybox -- nslookup unknown-svc
Server:         10.43.0.10
Address:        10.43.0.10:53

** server can't find unknown-svc.cluster.local: NXDOMAIN

** server can't find unknown-svc.svc.cluster.local: NXDOMAIN

** server can't find unknown-svc.cluster.local: NXDOMAIN

** server can't find unknown-svc.default.svc.cluster.local: NXDOMAIN

** server can't find unknown-svc.default.svc.cluster.local: NXDOMAIN

** server can't find unknown-svc.svc.cluster.local: NXDOMAIN

pod "test" deleted from default namespace
pod default/test terminated (Error)
```

可以看到說，他確實嘗試了每個 search path 的東西，但是都找不到

# Kubernetes ndots Issue
如果你在 K8s 內查詢的 domain name 小於 5 個點，理論上他會把它當成是內網的服務對吧\
可是你其實無從得知啊？ 這只是一個假設，如果他真的不是呢？\
那不就要先走完 search path 的東西找完內網，再去找外網？\
所以這種 overhead 其實在高併發的情況下會非常明顯

## Benchmark Testing with K6
所以我想做個實驗，利用 K6 將系統負載提高，觀測 DNS 解析在這樣的情況下會有多大的影響

### Setup
請參考 [Prerequisites](#prerequisites) 與 [Setup Cluster](#setup-cluster)\
基本的設定完之後要手動把需要用到的 image 載入

```shell
$ docker pull grafana/k6
$ k3d image import -c mycluster grafana/k6
```

### CoreDNS
為了方便觀察，需要對 CoreDNS 進行一些調整\
首先是加入 `log` 參數至 Corefile 設定檔內

再來是把 `import /etc/coredns/custom/*.override` 以及 `import /etc/coredns/custom/*.server` 這兩行註解掉\
因為他會在 log 那邊出現 warning 的錯誤訊息，先關閉比較好觀察

```shell
$ kubectl edit configmap -n kube-system coredns
apiVersion: v1
 data:
   Corefile: |
     .:53 {
          errors
          health
          ready
          log
          kubernetes cluster.local in-addr.arpa ip6.arpa {
            pods insecure
            fallthrough in-addr.arpa ip6.arpa
          }
          hosts /etc/coredns/NodeHosts {
            ttl 60
            reload 15s
            fallthrough
          }
          prometheus :9153
          loop
          reload
          loadbalance
          # import /etc/coredns/custom/*.override
          forward . /etc/resolv.conf
      }
      # import /etc/coredns/custom/*.server
$ kubectl rollout restart deployment -n kube-system coredns
```

### K6 Benchmark Script
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: k6-job
spec:
  template:
    spec:
      restartPolicy: Never
      volumes:
      - name: dns-config
        emptyDir: {}
      hostAliases:
      - ip: "127.0.0.1"
        hostnames:
        - "stats.grafana.org"
        - "grafana.org"
      initContainers:
      - name: dns-modifier
        image: busybox
        command: ["sh", "-c"]
        args:
          - |
            cat /etc/resolv.conf | sed '/^search/d' > /tmp/resolv.conf
            echo "search cluster.local svc.cluster.local default.svc.cluster.local" >> /tmp/resolv.conf
            cp /tmp/resolv.conf /etc/dns-config/resolv.conf
        volumeMounts:
        - name: dns-config
          mountPath: /etc/dns-config
      containers:
      - name: k6
        image: grafana/k6
        imagePullPolicy: Never
        volumeMounts:
        - name: dns-config
          mountPath: /etc/resolv.conf
          subPath: resolv.conf
        command: ["/bin/sh", "-c"]
        args:
          - >
            echo "import http from 'k6/http'; export const options = { dns: { ttl: '0', select: 'random' }, }; export default function() { http.get('http://test-svc.default.svc.cluster.local.'); }" > test.js;

            k6 run --vus 5000 --no-connection-reuse --duration 30s 
            --summary-mode full 
            --summary-trend-stats "avg,min,med,max,p(90),p(95)" test.js
```

這份 yaml 有不少東西需要注意\
首先，我們想要測試的是 [ndots](#ndots) issue，所以在 DNS 解析這一層不能讓他 cache 住\
因此 K6 scripts 裡面 `export const options` 需要指定 DNS 的 TTL

再來，K6 預設輸出是 compact 模式，所以如果你要看全部的內建 metric 需要指定 summary mode 為 `full`\
以我們的例子來說我們想要看 `http_req_blocked`

另外在 [FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name) 當中我們有提到\
搜尋的時候會使用 search path 的字串一個一個比對\
他是照順序的，也就是說假設你給 `web`\
因為 K8s 裡面 `/etc/resolv.conf` 的 search path 的順序為

1. `default.svc.cluster.local`
2. `svc.cluster.local`
3. `cluster.local`

所以他搜尋的第一個會是 `web.default.svc.cluster.local`\
這會造成一個問題，就是即使會有 [ndots](#ndots) issue 的存在\
也會因為他是第一個，所以就命中，致使你實驗起來看起來完全沒有 [ndots](#ndots) issue\
因此應對方法為把 `default.svc.cluster.local` 安排在 search path 最後面

最後是，在實驗的過程中我發現 K6 會嘗試連線 `stats.grafana.org`\
因為測試 [ndots](#ndots) issue 的差距會很小，細微的變量都會造成實驗結果不準確\
我原本打算從源頭關閉，不過沒找到方法，也有嘗試過用 NetworkPolicy 限制，不過因為測試過程中會需要對外連線所以這個解法也不太行\
最終比較暴力一點讓他直接轉到 localhost，反正對我使用的也沒有影響，這樣是最方便的

### Results
主要就是測試 `test-svc` 與 `test-svc.default.svc.cluster.local`\
也就是 [FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name) 的差別\
首先要確定 search path 與 ndots 是不是有正確作動

```shell
$ kubectl logs -n kube-system -l k8s-app=kube-dns -f
```

non [FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name)
```
[INFO] 10.42.0.27:37314 - 62389 "A IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.000080918s
[INFO] 10.42.0.27:44946 - 44386 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000101544s
[INFO] 10.42.0.27:33911 - 48055 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000050876s
[INFO] 10.42.0.27:37329 - 35770 "AAAA IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.000047126s
[INFO] 10.42.0.27:46556 - 53593 "A IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.000037709s
[INFO] 10.42.0.27:56911 - 62502 "AAAA IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.000027709s
[INFO] 10.42.0.27:47136 - 32874 "A IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.00002525s
[INFO] 10.42.0.27:47861 - 57978 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000024917s
[INFO] 10.42.0.27:58926 - 18539 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000012375s
[INFO] 10.42.0.27:47242 - 34194 "AAAA IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.000086209s
[INFO] 10.42.0.27:38099 - 677 "A IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.000058501s
[INFO] 10.42.0.27:33188 - 56442 "A IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.00010421s
[INFO] 10.42.0.27:59805 - 16534 "AAAA IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.000064376s
[INFO] 10.42.0.27:33532 - 45470 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000102502s
[INFO] 10.42.0.27:59717 - 55087 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000066584s
[INFO] 10.42.0.27:50368 - 37814 "AAAA IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.000086126s
[INFO] 10.42.0.27:44936 - 63170 "A IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.00011071s
[INFO] 10.42.0.27:39566 - 20347 "AAAA IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.000054793s
[INFO] 10.42.0.27:60716 - 26604 "A IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.000023417s
[INFO] 10.42.0.27:60057 - 31393 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000019042s
[INFO] 10.42.0.27:55680 - 10574 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000014542s
[INFO] 10.42.0.27:35434 - 6204 "AAAA IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.000076001s
[INFO] 10.42.0.27:40063 - 11053 "A IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.000053043s
[INFO] 10.42.0.27:41788 - 3720 "AAAA IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.000130335s
[INFO] 10.42.0.27:53580 - 57858 "A IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.00013296s
[INFO] 10.42.0.27:35202 - 34971 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000059668s
[INFO] 10.42.0.27:44453 - 7340 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000054626s
[INFO] 10.42.0.27:38512 - 5930 "AAAA IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.000092418s
[INFO] 10.42.0.27:37053 - 2273 "A IN test-svc.cluster.local. udp 51 false 1232" NXDOMAIN qr,aa,rd 133 0.000087459s
[INFO] 10.42.0.27:35645 - 31544 "AAAA IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.000074667s
[INFO] 10.42.0.27:48513 - 62624 "A IN test-svc.svc.cluster.local. udp 55 false 1232" NXDOMAIN qr,aa,rd 137 0.000097084s
[INFO] 10.42.0.27:54429 - 32841 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000072668s
[INFO] 10.42.0.27:58941 - 32034 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000059126s
```

[FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name)
```
[INFO] 10.42.0.28:58545 - 26227 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000122543s
[INFO] 10.42.0.28:49768 - 55808 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000068043s
[INFO] 10.42.0.28:54201 - 29265 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000060959s
[INFO] 10.42.0.28:44064 - 20785 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000107127s
[INFO] 10.42.0.28:43803 - 10704 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000091876s
[INFO] 10.42.0.28:33269 - 26862 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000092084s
[INFO] 10.42.0.28:48885 - 46077 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000096626s
[INFO] 10.42.0.28:52586 - 43684 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000108126s
[INFO] 10.42.0.28:52723 - 26094 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000090501s
[INFO] 10.42.0.28:48032 - 61614 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000091501s
[INFO] 10.42.0.28:48966 - 24598 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.00007146s
[INFO] 10.42.0.28:34432 - 47600 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.00008196s
[INFO] 10.42.0.28:42113 - 6343 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000092459s
[INFO] 10.42.0.28:57321 - 11146 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000091668s
[INFO] 10.42.0.28:46612 - 27227 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000078876s
[INFO] 10.42.0.28:48120 - 23921 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.00008696s
[INFO] 10.42.0.28:58211 - 8814 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000105044s
[INFO] 10.42.0.28:52595 - 36519 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000121002s
[INFO] 10.42.0.28:43502 - 41097 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.002523829s
[INFO] 10.42.0.28:50183 - 48611 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000178503s
[INFO] 10.42.0.28:48074 - 65248 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000095293s
[INFO] 10.42.0.28:44816 - 39442 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000057417s
[INFO] 10.42.0.28:45759 - 56834 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000097877s
[INFO] 10.42.0.28:36268 - 23366 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.00010446s
[INFO] 10.42.0.28:47205 - 59103 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000068793s
[INFO] 10.42.0.28:39578 - 8430 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000058835s
[INFO] 10.42.0.28:53248 - 62322 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000067584s
[INFO] 10.42.0.28:33277 - 27360 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000122336s
[INFO] 10.42.0.28:49964 - 4936 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000069709s
[INFO] 10.42.0.28:58079 - 10320 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000092834s
[INFO] 10.42.0.28:50382 - 15655 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000060876s
[INFO] 10.42.0.28:59723 - 6151 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000094752s
[INFO] 10.42.0.28:43105 - 32967 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000100251s
[INFO] 10.42.0.28:32978 - 45223 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000197712s
[INFO] 10.42.0.28:38480 - 42597 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.00013371s
[INFO] 10.42.0.28:51286 - 24316 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.002347243s
[INFO] 10.42.0.28:56589 - 3312 "AAAA IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 145 0.000085001s
[INFO] 10.42.0.28:55186 - 53404 "A IN test-svc.default.svc.cluster.local. udp 63 false 1232" NOERROR qr,aa,rd 102 0.000091668s
```

你可以發現說，每一次針對 non [FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name) 其實都會有幾個 NXDOMAIN 的狀況發生\
這其實證明說 DNS 對此有進行 search path 補全搜尋，近一步證明 [ndots](#ndots) issue 確實會造成效能瓶頸\
而下方 [FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name) 則是清一色 NOERROR

那最終壓力測試結果如何呢

non [FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name)\
也就是 `test-svc`
```
  █ TOTAL RESULTS 

    HTTP
    http_req_blocked...............: avg=66.04ms  min=9ms     med=57.03ms max=293.02ms p(90)=114.2ms  p(95)=132.09ms
    http_req_connecting............: avg=23.54ms  min=15.79µs med=19.37ms max=230.73ms p(90)=32.41ms  p(95)=57.19ms 
    http_req_duration..............: avg=31.66ms  min=28.87µs med=27.64ms max=227.09ms p(90)=47.44ms  p(95)=69.89ms 
      { expected_response:true }...: avg=31.66ms  min=28.87µs med=27.64ms max=227.09ms p(90)=47.44ms  p(95)=69.89ms 
    http_req_failed................: 0.00%   0 out of 1374921
    http_req_receiving.............: avg=3.49ms   min=3.5µs   med=2.63ms  max=151.93ms p(90)=6.59ms   p(95)=8.61ms  
    http_req_sending...............: avg=4.08ms   min=3.95µs  med=2.67ms  max=163.16ms p(90)=8.01ms   p(95)=11.38ms 
    http_req_tls_handshaking.......: avg=0s       min=0s      med=0s      max=0s       p(90)=0s       p(95)=0s      
    http_req_waiting...............: avg=24.08ms  min=12.37µs med=21.09ms max=133.71ms p(90)=36.83ms  p(95)=55.16ms 
    http_reqs......................: 1374921 45674.172595/s

    EXECUTION
    iteration_duration.............: avg=103.28ms min=21.82ms med=93.59ms max=350.12ms p(90)=156.15ms p(95)=171.03ms
    iterations.....................: 1374921 45674.172595/s
    vus............................: 5000    min=5000         max=5000
    vus_max........................: 5000    min=5000         max=5000

    NETWORK
    data_received..................: 1.6 GB  52 MB/s
    data_sent......................: 114 MB  3.8 MB/s
```

[FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name) 後綴有 `.`\
也就是 `test-svc.default.svc.cluster.local.`
```
  █ TOTAL RESULTS 

    HTTP
    http_req_blocked...............: avg=61.42ms min=292µs   med=52.97ms max=1.11s    p(90)=108.65ms p(95)=121.34ms
    http_req_connecting............: avg=31.98ms min=14.37µs med=26.54ms max=1.08s    p(90)=49.58ms  p(95)=78.96ms 
    http_req_duration..............: avg=39.9ms  min=23µs    med=34.65ms max=251.84ms p(90)=59.32ms  p(95)=88.62ms 
      { expected_response:true }...: avg=39.9ms  min=23µs    med=34.65ms max=251.84ms p(90)=59.32ms  p(95)=88.62ms 
    http_req_failed................: 0.00%   0 out of 1381186
    http_req_receiving.............: avg=4.23ms  min=3.83µs  med=2.88ms  max=161.51ms p(90)=7.56ms   p(95)=10.48ms 
    http_req_sending...............: avg=4.32ms  min=3.87µs  med=2.85ms  max=168.66ms p(90)=8.6ms    p(95)=12.18ms 
    http_req_tls_handshaking.......: avg=0s      min=0s      med=0s      max=0s       p(90)=0s       p(95)=0s      
    http_req_waiting...............: avg=31.33ms min=9.45µs  med=27.54ms max=148.63ms p(90)=45.87ms  p(95)=70.76ms 
    http_reqs......................: 1381186 45911.581267/s

    EXECUTION
    iteration_duration.............: avg=105ms   min=10.6ms  med=93.88ms max=1.23s    p(90)=158.46ms p(95)=170.22ms
    iterations.....................: 1381186 45911.581267/s
    vus............................: 5000    min=5000         max=5000
    vus_max........................: 5000    min=5000         max=5000

    NETWORK
    data_received..................: 1.6 GB  52 MB/s
    data_sent......................: 152 MB  5.1 MB/s
```

[FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name)
也就是 `test-svc.default.svc.cluster.local`
```
  █ TOTAL RESULTS 

    HTTP
    http_req_blocked...............: avg=65.91ms  min=486.5µs med=57.59ms max=244.14ms p(90)=112.71ms p(95)=130.59ms
    http_req_connecting............: avg=23.29ms  min=13.7µs  med=19.5ms  max=190.46ms p(90)=33.06ms  p(95)=58.6ms  
    http_req_duration..............: avg=32.61ms  min=25.91µs med=28.17ms max=211.22ms p(90)=50.01ms  p(95)=76.49ms 
      { expected_response:true }...: avg=32.61ms  min=25.91µs med=28.17ms max=211.22ms p(90)=50.01ms  p(95)=76.49ms 
    http_req_failed................: 0.00%   0 out of 1351420
    http_req_receiving.............: avg=3.51ms   min=3.66µs  med=2.61ms  max=100.27ms p(90)=6.71ms   p(95)=8.77ms  
    http_req_sending...............: avg=4.2ms    min=3.83µs  med=2.75ms  max=99.84ms  p(90)=8.24ms   p(95)=11.67ms 
    http_req_tls_handshaking.......: avg=0s       min=0s      med=0s      max=0s       p(90)=0s       p(95)=0s      
    http_req_waiting...............: avg=24.89ms  min=10.7µs  med=21.47ms max=137.91ms p(90)=39.1ms   p(95)=61.42ms 
    http_reqs......................: 1351420 44936.117068/s

    EXECUTION
    iteration_duration.............: avg=104.19ms min=7.96ms  med=94.94ms max=296.31ms p(90)=159.09ms p(95)=173.11ms
    iterations.....................: 1351420 44936.117068/s
    vus............................: 5000    min=5000         max=5000
    vus_max........................: 5000    min=5000         max=5000

    NETWORK
    data_received..................: 1.5 GB  51 MB/s
    data_sent......................: 147 MB  4.9 MB/s
```

||FQDN with dots|FQDN|non FQDN|
|:--:|:--:|:--:|:--:|
|http_req_blocked|61.42ms|65.91ms|66.04ms|
|iterations|45911.581267/s|44936.117068/s|45674.172595/s|

DNS 的解析是發生在 `http_req_blocked` 這個 metric 中所展現的\
你可以發現說 [FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name) 後綴有 `.` 的這個測項的用時是最短的\
因為他不完全繞過了 [ndots](#ndots) issue

在這份報表中你也可以看到，在 **p(95)** 的情況下，你所花費的時間大概會多接近一倍(`61.42ms` to `121.34ms`)\
可以看到說，系統在極端壓力下會有多麽嚴重的效能瓶頸

如果你想要自己測試我當然是贊成的\
不過請注意 VU 不要開太大，實驗結果會有誤差\
我原本開 25k VU 怎麼測 [FQDN(Fully Qualified Domain Name)](#fqdnfully-qualified-domain-name) 後綴有 `.` 這個測項他的 iteration 就是比較少，duration 就是比較慢

後來發現 `EXECUTION.vus` 這邊 min 居然為 0\
因為 25k VU 這個數字很接近 file descriptor 上限，我原本以為只要 http_req_failed 為 0 就保證實驗是完美的\
結果就是因為這個才會一直失敗

所以後來調整為 5k VU，你可以看到每個測項的 `EXECUTION.vus` min 與 max 數字都是正確的

# References
+ [What is a service-level objective (SLO)? SLO vs. SLA vs. SLI](https://www.atlassian.com/incident-management/kpis/sla-vs-slo-vs-sli)
+ [Grafana K6](https://grafana.com/docs/k6/latest/)
+ [什麼是完全限定域名 (FQDN)？](https://www.ssl.com/zh-TW/%E5%B8%B8%E8%A6%8B%E5%95%8F%E9%A1%8C/%E4%BB%80%E9%BA%BC%E6%98%AF%E5%AE%8C%E5%85%A8%E9%99%90%E5%AE%9A%E7%B6%B2%E5%9F%9F%E5%90%8D%E7%A8%B1-%28fqdn%29/)
+ [In /etc/resolv.conf, what exactly does the "search" configuration option do?](https://superuser.com/questions/570082/in-etc-resolv-conf-what-exactly-does-the-search-configuration-option-do)
+ [docker exec -it returns "cannot enable tty mode on non tty input"](https://stackoverflow.com/questions/29380344/docker-exec-it-returns-cannot-enable-tty-mode-on-non-tty-input)
+ [Grafana are trying to resolve stats.grafana.org even when reporting is disabled](https://community.grafana.com/t/grafana-are-trying-to-resolve-stats-grafana-org-even-when-reporting-is-disabled/70470)
+ [ndots:5 The Kubernetes Default That’s Silently Slowing Your Services](https://aws.plainenglish.io/ndots-5-the-kubernetes-default-thats-silently-slowing-your-services-ca92c877e349)
+ [End of test](https://grafana.com/docs/k6/latest/results-output/end-of-test/#end-of-test)
